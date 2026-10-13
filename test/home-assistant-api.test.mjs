import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { configuration, createApi } from '../server/node-api.mjs';
import { createHttpServer } from '../server/node-server.mjs';
import { openDatabase } from '../server/node-database.mjs';
import { purgeHomeAssistant } from '../server/home-assistant.mjs';
import { DEFAULTS } from '../dist/scenario.mjs';
import { encodeRecipeCode } from '../dist/recipe-code.mjs';

const now = 1800000000, secret = 'a'.repeat(64), browser = 'b'.repeat(64), other = 'c'.repeat(64);
const publicOrigin = 'https://api.start.example.org', wizard = 'https://start.example.org';
const config = configuration({ PUBLIC_ORIGIN: publicOrigin, ALLOWED_ORIGINS: wizard, RELAY_ADMIN_KEY: secret });
const details = { url: 'http://homeassistant.local:8123', token: 'private-long-lived-token-123456' };
const code = encodeRecipeCode({ ...DEFAULTS, device: 'computer', homeassistant: true }, { issuedAt: now });

/** Build a private persistent service and capability-aware request helpers.
 * @param {object} t Test context. @returns {object}
 */
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ovos-ha-api-')), filename = join(directory, 'installs.sqlite');
  let store = openDatabase(filename), time = now, api = createApi(store, config, () => time);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const call = (path, data, token = browser, origin = wizard, extra = {}) => api(new Request(publicOrigin + path, {
    method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(data),
  }), '127.0.0.1');
  return {
    get store() { return store; }, get api() { return api; }, filename,
    call, setTime(value) { time = value; },
    restart() { store.close(); store = openDatabase(filename); api = createApi(store, config, () => time); },
    async create(token = browser, recipe = code) {
      const response = await call('/api/install', { code: recipe }, token); assert.equal(response.status, 200); return response.json();
    },
    save(id, value = details, token = browser, origin = wizard) { return call('/api/connections', { id, homeassistant: value }, token, origin); },
    claim(id, body = {}) { return call('/v1/homeassistant', body, createHmac('sha256', secret).update(`install:${id}`).digest('hex'), ''); },
    event(id, event) { return call('/v1/events', { event }, createHmac('sha256', secret).update(`install:${id}`).digest('hex'), ''); },
    async status(id) { const response = await call('/api/install', { id }); assert.equal(response.status, 200); return response.json(); },
    row(id) { return store.database.prepare('SELECT * FROM homeassistant_handoffs WHERE session_id = ?').get(id); },
  };
}

test('Home Assistant credentials are encrypted at rest and only redacted receipts reach browser status', async t => {
  const f = fixture(t), session = await f.create();
  assert.equal(session.homeassistantReady, false); assert.equal(session.homeassistantClaimed, false);
  const saved = await f.save(session.id); assert.equal(saved.status, 200); assert.deepEqual(await saved.json(), { ready: true });
  assert.equal(saved.headers.get('cache-control'), 'private, no-store'); assert.equal(saved.headers.get('access-control-allow-origin'), wizard);
  const row = f.row(session.id); assert.equal(row.expires_at, now + 3600); assert.equal(row.nonce.length, 12); assert.equal(row.auth_tag.length, 16);
  assert.equal(row.consumed_at, null); assert.equal(Buffer.from(row.ciphertext).includes(Buffer.from(details.token)), false);
  for (const response of [await f.call('/api/install', { id: session.id }), await f.call('/api/install', { code }), await f.api(new Request(publicOrigin + '/s/' + session.launchToken))]) {
    const text = await response.text(); assert.equal(text.includes(details.token), false); assert.equal(text.includes(details.url), false);
  }
  const status = await f.status(session.id); assert.equal(status.homeassistantReady, true); assert.equal(status.homeassistantClaimed, false);
  f.store.database.exec('PRAGMA wal_checkpoint(FULL)');
  for (const path of [f.filename, f.filename + '-wal']) {
    const bytes = readFileSync(path); assert.equal(bytes.includes(Buffer.from(details.token)), false); assert.equal(bytes.includes(Buffer.from(details.url)), false);
  }
});

test('saved handoffs survive service restarts and are consumed exactly once', async t => {
  const f = fixture(t), session = await f.create(); await f.save(session.id);
  f.restart(); assert.equal((await f.status(session.id)).homeassistantReady, true);
  const response = await f.claim(session.id); assert.equal(response.status, 200); assert.equal(await response.text(), `${details.url}\n${details.token}\n`);
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8'); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const row = f.row(session.id); assert.equal(row.ciphertext, null); assert.equal(row.nonce, null); assert.equal(row.auth_tag, null); assert.equal(row.consumed_at, now);
  const status = await f.status(session.id); assert.equal(status.homeassistantReady, false); assert.equal(status.homeassistantClaimed, true);
  assert.equal((await f.claim(session.id)).status, 410);
  assert.equal((await f.save(session.id)).status, 409); assert.equal((await f.save(session.id, null)).status, 409);
  f.restart(); assert.equal((await f.claim(session.id)).status, 410); assert.equal((await f.status(session.id)).homeassistantClaimed, true);
});

test('parallel redemption exposes the token to exactly one caller', async t => {
  const f = fixture(t), session = await f.create(); await f.save(session.id);
  const replies = await Promise.all(Array.from({ length: 12 }, () => f.claim(session.id)));
  assert.equal(replies.filter(response => response.status === 200).length, 1);
  assert.equal(replies.filter(response => response.status === 410).length, 11);
  assert.equal(f.row(session.id).ciphertext, null);
});

test('browser origin, browser ownership and device capabilities remain separate', async t => {
  const f = fixture(t), session = await f.create(), second = await f.create(other);
  assert.equal((await f.save(session.id, details, other)).status, 410);
  for (const origin of ['', 'null', 'https://start.example.org.evil.test', 'http://start.example.org']) {
    const response = await f.save(session.id, details, browser, origin); assert.equal(response.status, 403); assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  assert.equal((await f.save(session.id, details, '')).status, 401);
  await f.save(session.id);
  for (const token of [browser, other, secret, session.launchToken, '']) assert.equal((await f.call('/v1/homeassistant', {}, token)).status, 401);
  assert.equal((await f.claim(second.id)).status, 204); assert.equal(f.row(session.id).consumed_at, null);
  const preflight = headers => f.api(new Request(publicOrigin + '/api/connections', { method: 'OPTIONS', headers: {
    Origin: wizard, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type', ...headers,
  } }));
  assert.equal((await preflight({})).status, 204); assert.equal((await preflight({ 'Access-Control-Request-Headers': 'cookie' })).status, 403);
  assert.equal((await f.api(new Request(publicOrigin + '/v1/homeassistant', { method: 'OPTIONS' }))).status, 404);
});

test('save, replace and clear are allowed before starting; clearing preserves legacy Terminal fallback', async t => {
  const f = fixture(t), session = await f.create();
  assert.equal((await f.claim(session.id)).status, 204); await f.save(session.id);
  const first = f.row(session.id); await f.save(session.id); const second = f.row(session.id);
  assert.notDeepEqual(first.nonce, second.nonce); assert.notDeepEqual(first.ciphertext, second.ciphertext);
  const replacement = { url: 'https://192.168.1.5:8123', token: 'replacement-private-token-12345' };
  await f.save(session.id, replacement);
  const cleared = await f.save(session.id, null); assert.equal(cleared.status, 200); assert.deepEqual(await cleared.json(), { ready: false });
  assert.equal(f.row(session.id), undefined); assert.equal((await f.claim(session.id)).status, 204);
  await f.save(session.id, replacement); assert.equal(await (await f.claim(session.id)).text(), `${replacement.url}\n${replacement.token}\n`);
});

test('device can claim during download, while changing a started installation is refused', async t => {
  for (const event of ['started', 'downloading']) {
    const f = fixture(t), session = await f.create(); await f.save(session.id); await f.event(session.id, event);
    assert.equal((await f.save(session.id)).status, 409, event); assert.equal((await f.save(session.id, null)).status, 409, event);
    assert.equal((await f.claim(session.id)).status, 200, event);
  }
});

test('expired and terminal handoffs are erased and never fall back to fresh credential prompts', async t => {
  for (const event of ['installing', 'installed', 'failed', 'cancelled']) {
    const f = fixture(t), session = await f.create(); await f.save(session.id); await f.event(session.id, event);
    assert.equal(f.row(session.id).ciphertext, null, event); assert.equal((await f.claim(session.id)).status, 410, event);
    assert.equal((await f.status(session.id)).homeassistantReady, false, event);
  }
  const f = fixture(t), session = await f.create(); await f.save(session.id); await f.event(session.id, 'started'); f.setTime(now + 3600);
  assert.equal((await f.claim(session.id)).status, 410); assert.equal(f.row(session.id).ciphertext, null);
  assert.equal((await f.save(session.id)).status, 410); assert.equal((await f.status(session.id)).homeassistantReady, false);
});

test('cleanup remains bounded and the timer erases idle expired ciphertext', async t => {
  const f = fixture(t), session = await f.create(); await f.save(session.id);
  const row = f.row(session.id);
  const insert = f.store.database.prepare('INSERT INTO installs (id,owner,code,write_hash,created_at,start_before,expires_at,updated_at) VALUES (?,?,?,?,?,?,?,?)');
  const handoff = f.store.database.prepare('INSERT INTO homeassistant_handoffs (session_id,nonce,auth_tag,ciphertext,expires_at) VALUES (?,?,?,?,?)');
  for (let i = 0; i < 130; i++) {
    const id = i.toString(16).padStart(32, '0'); insert.run(id, browser, String(i), id, now, now + 3600, now + 86400, now);
    handoff.run(id, row.nonce, row.auth_tag, row.ciphertext, now + 3600);
  }
  purgeHomeAssistant(f.store, now + 3600);
  assert.equal(f.store.database.prepare('SELECT count(*) n FROM homeassistant_handoffs WHERE ciphertext IS NOT NULL').get().n, 3);
  t.mock.timers.enable({ apis: ['setInterval'] });
  const server = createHttpServer(f.store, config, () => now + 3600); t.after(() => server.emit('close'));
  t.mock.timers.tick(60000);
  assert.equal(f.store.database.prepare('SELECT count(*) n FROM homeassistant_handoffs WHERE ciphertext IS NOT NULL').get().n, 0);
});

test('malformed and oversized connection data fail without reflecting private values', async t => {
  const f = fixture(t), session = await f.create();
  const invalid = [null, {}, [], { ...details, extra: true }, { ...details, token: '' }, { ...details, token: 'a'.repeat(2049) },
    { ...details, token: 'private token has spaces' }, { ...details, token: 'private\ntoken has controls' },
    ...['ftp://homeassistant.local', '//homeassistant.local', 'http://u:p@local', 'http://local/?key=private', 'http://local/#private', 'http://local/\nprivate', 'http://local/' + 'a'.repeat(2048)].map(url => ({ ...details, url }))];
  for (const homeassistant of invalid.filter(value => value !== null)) {
    const response = await f.save(session.id, homeassistant); assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error: 'invalid_payload' });
  }
  for (const data of [{ id: [session.id], homeassistant: details }, { id: session.id, homeassistant: details, extra: true }, [], { id: session.id }]) {
    assert.equal((await f.call('/api/connections', data)).status, 400);
  }
  assert.equal((await f.call('/api/connections', { id: session.id, homeassistant: details }, browser, wizard, { 'Content-Type': 'text/plain' })).status, 400);
  assert.equal((await f.claim(session.id, { token: details.token })).status, 400);
  assert.equal((await f.call('/api/connections', { id: session.id, homeassistant: { ...details, token: 'a'.repeat(6200) } })).status, 400);
  assert.equal(f.row(session.id), undefined);
});

test('credentials cannot be attached to a recipe without Home Assistant', async t => {
  const f = fixture(t), plain = encodeRecipeCode({ ...DEFAULTS, device: 'computer', homeassistant: false }, { issuedAt: now });
  const session = await f.create(browser, plain); assert.equal((await f.save(session.id)).status, 409); assert.equal(f.row(session.id), undefined);
});

test('authenticated encryption rejects ciphertext replacement, recipe substitution and wrong keys', async t => {
  for (const tamper of ['ciphertext', 'recipe', 'key']) {
    const f = fixture(t), session = await f.create(); await f.save(session.id);
    if (tamper === 'ciphertext') {
      const bytes = Buffer.from(f.row(session.id).ciphertext); bytes[0] ^= 1;
      f.store.database.prepare('UPDATE homeassistant_handoffs SET ciphertext = ? WHERE session_id = ?').run(bytes, session.id);
    } else if (tamper === 'recipe') {
      f.store.database.prepare('UPDATE installs SET code = ? WHERE id = ?').run(encodeRecipeCode({ ...DEFAULTS, device: 'mark2', homeassistant: true }, { issuedAt: now }), session.id);
    }
    const response = tamper === 'key'
      ? await createApi(f.store, { ...config, secret: 'd'.repeat(64) }, () => now)(new Request(publicOrigin + '/v1/homeassistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createHmac('sha256', secret).update(`install:${session.id}`).digest('hex')}` }, body: '{}',
      })) : await f.claim(session.id);
    assert.equal(response.status, 503, tamper); assert.deepEqual(await response.json(), { error: 'unavailable' }); assert.equal(f.row(session.id).consumed_at, null);
  }
});

test('removing a session also removes its encrypted handoff and consumed receipt', async t => {
  const f = fixture(t), session = await f.create(); await f.save(session.id);
  f.store.database.prepare('DELETE FROM installs WHERE id = ?').run(session.id); assert.equal(f.row(session.id), undefined);
});

test('only the connection endpoint accepts bounded bodies larger than one KiB over HTTP', async t => {
  const f = fixture(t), session = await f.create(), server = createHttpServer(f.store, config, () => now);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(url + path, { method: 'POST', headers: { Origin: wizard, Authorization: `Bearer ${browser}`, 'Content-Type': 'application/json' }, body });
  const body = JSON.stringify({ id: session.id, homeassistant: { ...details, token: 'a'.repeat(2048) } });
  assert.equal((await post('/api/connections', body)).status, 200);
  for (const path of ['/api/install', '/v1/homeassistant', '/v1/events']) assert.equal((await post(path, body)).status, 413, path);
  assert.equal((await post('/api/connections', 'x'.repeat(6145))).status, 413);
});
