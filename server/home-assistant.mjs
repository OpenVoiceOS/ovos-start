import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { normalizeHomeAssistant } from '../dist/home-assistant.mjs';
import { decodeRecipeEnvelope } from '../dist/recipe-code.mjs';

/** Erase a bounded batch of expired or unusable encrypted handoffs.
 * @param {object} store Open SQLite store. @param {number} now Unix seconds. @returns {void}
 */
export function purgeHomeAssistant(store, now = Math.floor(Date.now() / 1000)) {
  store.database.prepare(`UPDATE homeassistant_handoffs SET nonce = NULL, auth_tag = NULL, ciphertext = NULL
    WHERE session_id IN (SELECT h.session_id FROM homeassistant_handoffs h JOIN installs i ON i.id = h.session_id
      WHERE h.ciphertext IS NOT NULL AND (h.expires_at <= ? OR i.expires_at <= ? OR i.rank >= 3
        OR i.status IN ('failed', 'cancelled')) ORDER BY h.expires_at LIMIT 128)`).run(now, now);
}

/** Expose only readiness receipts; connection addresses and tokens stay private.
 * @param {object} store Open SQLite store. @param {string} id Session ID. @param {number} now Unix seconds. @returns {object}
 */
export function homeAssistantStatus(store, id, now) {
  const row = store.database.prepare(`SELECT h.ciphertext IS NOT NULL AS ready, h.consumed_at, h.expires_at,
    i.expires_at AS session_expires_at, i.rank, i.status FROM homeassistant_handoffs h JOIN installs i ON i.id = h.session_id
    WHERE h.session_id = ?`).get(id);
  return { homeassistantReady: Boolean(row && row.ready && row.expires_at > now && row.session_expires_at > now
    && row.rank < 3 && !['failed', 'cancelled'].includes(row.status)), homeassistantClaimed: Boolean(row && row.consumed_at !== null) };
}

/** Bind authenticated ciphertext to its session and exact non-secret recipe.
 * @param {object} row Install row. @returns {Buffer}
 */
function aad(row) { return Buffer.from(JSON.stringify(['ovos-start-homeassistant-v1', row.id, row.code])); }

/** Derive a distinct encryption key without reusing the capability-signing key.
 * @param {string} secret Private service key. @returns {Buffer}
 */
function key(secret) { return createHmac('sha256', secret).update('ovos-start:homeassistant:encryption:v1').digest(); }

/** Store or remove credentials only while their owner can still change an unused setup.
 * @param {object} store Open SQLite store. @param {string} secret Private service key.
 * @param {string} owner Hashed browser capability. @param {object} data Validated request body.
 * @param {number} now Unix seconds. @returns {{status: number, data: object}}
 */
export function saveHomeAssistant(store, secret, owner, data, now) {
  if (Object.keys(data).sort().join(',') !== 'homeassistant,id' || typeof data.id !== 'string' || !/^[a-f0-9]{32}$/.test(data.id)) {
    return { status: 400, data: { error: 'invalid_payload' } };
  }
  let details;
  try { details = data.homeassistant === null ? null : normalizeHomeAssistant(data.homeassistant); }
  catch { return { status: 400, data: { error: 'invalid_payload' } }; }
  const database = store.database;
  database.exec('BEGIN IMMEDIATE');
  try {
    const row = database.prepare('SELECT * FROM installs WHERE id = ? AND owner = ?').get(data.id, owner);
    if (!row || now >= row.start_before || now >= row.expires_at || now < row.created_at) {
      database.exec('COMMIT'); return { status: 410, data: { error: 'expired' } };
    }
    const previous = database.prepare('SELECT consumed_at FROM homeassistant_handoffs WHERE session_id = ?').get(row.id);
    if (row.status !== 'waiting' || row.rank !== 0 || row.started_at !== null || (previous && previous.consumed_at !== null)) {
      database.exec('COMMIT'); return { status: 409, data: { error: 'already_started' } };
    }
    if (!details) {
      database.prepare('DELETE FROM homeassistant_handoffs WHERE session_id = ?').run(row.id);
      database.exec('COMMIT'); return { status: 200, data: { ready: false } };
    }
    const state = decodeRecipeEnvelope(row.code, { now }).state;
    if (!state.homeassistant || state.experience === 'hub') {
      database.exec('COMMIT'); return { status: 409, data: { error: 'invalid_setup' } };
    }
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(secret), nonce);
    cipher.setAAD(aad(row));
    const ciphertext = Buffer.concat([cipher.update(`${details.url}\n${details.token}\n`, 'utf8'), cipher.final()]);
    database.prepare(`INSERT INTO homeassistant_handoffs (session_id, nonce, auth_tag, ciphertext, expires_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET nonce = excluded.nonce,
      auth_tag = excluded.auth_tag, ciphertext = excluded.ciphertext, expires_at = excluded.expires_at`).run(
      row.id, nonce, cipher.getAuthTag(), ciphertext, Math.min(row.start_before, row.expires_at));
    database.exec('COMMIT'); return { status: 200, data: { ready: true } };
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}

/** Redeem an install capability once and erase its authenticated encrypted payload atomically.
 * @param {object} store Open SQLite store. @param {string} secret Private service key.
 * @param {string} token Device write capability. @param {number} now Unix seconds.
 * @returns {{status: number, text?: string, data?: object}}
 */
export function claimHomeAssistant(store, secret, token, now) {
  const database = store.database, writeHash = createHash('sha256').update(token).digest('hex');
  database.exec('BEGIN IMMEDIATE');
  try {
    const row = database.prepare('SELECT * FROM installs WHERE write_hash = ?').get(writeHash);
    if (!row) { database.exec('COMMIT'); return { status: 401, data: { error: 'unauthorized' } }; }
    if (now >= row.start_before || now >= row.expires_at || now < row.created_at || row.rank >= 3 || ['failed', 'cancelled'].includes(row.status)) {
      database.exec('COMMIT'); return { status: 410, data: { error: 'expired' } };
    }
    const handoff = database.prepare('SELECT * FROM homeassistant_handoffs WHERE session_id = ?').get(row.id);
    if (!handoff) { database.exec('COMMIT'); return { status: 204 }; }
    if (handoff.consumed_at !== null || !handoff.ciphertext || now >= handoff.expires_at) {
      database.exec('COMMIT'); return { status: 410, data: { error: 'expired' } };
    }
    const decipher = createDecipheriv('aes-256-gcm', key(secret), handoff.nonce);
    decipher.setAAD(aad(row)); decipher.setAuthTag(handoff.auth_tag);
    const text = Buffer.concat([decipher.update(handoff.ciphertext), decipher.final()]).toString('utf8');
    database.prepare('UPDATE homeassistant_handoffs SET nonce = NULL, auth_tag = NULL, ciphertext = NULL, consumed_at = ? WHERE session_id = ?').run(now, row.id);
    database.exec('COMMIT'); return { status: 200, text };
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}
