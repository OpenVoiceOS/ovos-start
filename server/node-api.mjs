import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { handle as relay, body } from './relay/server/worker.mjs';
import { decodeRecipeEnvelope } from '../dist/recipe-code.mjs';
import { validateState } from '../dist/scenario.mjs';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Validate an exact HTTPS origin without credentials, paths or wildcards.
 * @param {string} value Configured origin. @returns {string}
 */
function origin(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.origin !== value || parsed.username || parsed.password || parsed.hostname.includes('*')) {
    throw new Error('Configure exact HTTPS origins.');
  }
  return parsed.origin;
}

/** Read non-public runtime configuration; never include secret values in errors.
 * @param {object} env Service environment. @returns {object}
 */
export function configuration(env = process.env) {
  if (!/^[a-f0-9]{64}$/.test(env.RELAY_ADMIN_KEY || '')) throw new Error('Configure a 256-bit relay key.');
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(value => origin(value.trim()));
  if (!allowedOrigins.length || allowedOrigins.length > 8) throw new Error('Configure the wizard origins.');
  const port = env.PORT === undefined ? 8787 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid service port.');
  return Object.freeze({ publicOrigin: origin(env.PUBLIC_ORIGIN), allowedOrigins: new Set(allowedOrigins), secret: env.RELAY_ADMIN_KEY,
    databasePath: env.DATABASE_PATH || '/var/lib/ovos-start/installs.sqlite', port });
}

/** Generic, uncacheable responses contain no capabilities or diagnostic internals.
 * @param {object} data Response payload. @param {number} status HTTP status. @returns {Response}
 */
function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}

/** One-minute counters are bounded by the global limit, even with rotating IPs.
 * @param {number} perAddress Per-address limit. @param {number} total Global limit. @returns {Function}
 */
function limiter(perAddress, total) {
  let window = -1, count = 0;
  const addresses = new Map();
  return (key, now) => {
    const current = Math.floor(now / 60);
    if (current !== window) { window = current; count = 0; addresses.clear(); }
    const used = addresses.get(key) || 0;
    if (count >= total || used >= perAddress) return false;
    count += 1; addresses.set(key, used + 1); return true;
  };
}

/** Cloudflare's client IP influences throttling only, never ownership/authentication.
 * @param {Request} request Incoming request. @param {string} peer TCP peer address. @returns {string}
 */
export function rateAddress(request, peer) {
  const forwarded = request.headers.get('cf-connecting-ip');
  return LOOPBACK.has(peer) && isIP(forwarded || '') ? forwarded : peer || 'unknown';
}

/** Wrap the relay with anonymous browser capabilities and strict cross-origin access.
 * @param {object} store Open database. @param {object} config Validated configuration.
 * @param {Function} clock Unix-second clock for deterministic expiry tests. @returns {Function}
 */
export function createApi(store, config, clock = () => Math.floor(Date.now() / 1000)) {
  const requests = limiter(180, 1200), creations = limiter(10, 60);
  const env = { DB: store.DB, RELAY_ADMIN_KEY: config.secret };
  const sign = value => createHmac('sha256', config.secret).update(value).digest('hex');
  // Serialize creation's capacity check and insert; callbacks/readers remain independent.
  let creationQueue = Promise.resolve();
  return async (request, peer = 'unknown') => {
    let cors = null;
    const finish = response => {
      if (cors) {
        response.headers.set('Access-Control-Allow-Origin', cors);
        response.headers.set('Vary', 'Origin');
      }
      return response;
    };
    try {
      const url = new URL(request.url), now = clock();
      if (url.origin !== config.publicOrigin || url.search) return json({ error: 'not_found' }, 404);
      if (url.pathname === '/healthz' && request.method === 'GET') {
        store.database.prepare('SELECT 1').get(); return json({ ok: true });
      }
      // Administrative relay routes are intentionally not reachable through this service.
      const browser = url.pathname === '/api/install';
      const capability = url.pathname === '/v1/events' || /^\/s\/[A-Za-z0-9_-]{22}$/.test(url.pathname);
      if (!browser && !capability) return json({ error: 'not_found' }, 404);
      const suppliedOrigin = request.headers.get('origin');
      if (browser && config.allowedOrigins.has(suppliedOrigin)) cors = suppliedOrigin;
      const address = sign(`rate:${rateAddress(request, peer)}`);
      if (!requests(address, now)) return finish(json({ error: 'rate_limited' }, 429));
      if (!browser) return await relay(request, env, now);
      if (!config.allowedOrigins.has(suppliedOrigin)) return json({ error: 'forbidden' }, 403);
      if (request.method === 'OPTIONS') {
        const headers = (request.headers.get('access-control-request-headers') || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
        if (request.headers.get('access-control-request-method') !== 'POST' || headers.some(value => !['authorization', 'content-type'].includes(value))) {
          return finish(json({ error: 'forbidden' }, 403));
        }
        return finish(new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600', 'Cache-Control': 'no-store' } }));
      }
      if (request.method !== 'POST') return finish(json({ error: 'not_found' }, 404));
      // No cookies or hosting-specific identity headers participate in authentication.
      const bearer = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if (!bearer) return finish(json({ error: 'unauthorized' }, 401));
      let data; try { data = await body(request); } catch { return finish(json({ error: 'invalid_payload' }, 400)); }
      if (Object.keys(data).length !== 1) return finish(json({ error: 'invalid_payload' }, 400));
      const owner = sign(`browser:${bearer}`);
      let route;
      if (Object.hasOwn(data, 'code')) {
        try {
          const recipe = decodeRecipeEnvelope(data.code, { now, allowExpired: true });
          validateState(recipe.state);
          if (recipe.version !== 2 || recipe.issuedAt > now) throw new Error();
        } catch { return finish(json({ error: 'invalid_code' }, 400)); }
        route = '/v1/sessions';
      } else if (typeof data.id === 'string' && /^[a-f0-9]{32}$/.test(data.id)) route = '/v1/session';
      else return finish(json({ error: 'invalid_payload' }, 400));
      const invoke = () => relay(new Request(config.publicOrigin + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secret}` }, body: JSON.stringify({ ...data, owner }) }), env, now);
      if (route === '/v1/session') return finish(await invoke());
      const create = async () => {
        const existing = store.database.prepare('SELECT id FROM installs WHERE owner = ? AND code = ?').get(owner, data.code);
        if (!existing) {
          if (!creations(address, now)) return json({ error: 'rate_limited' }, 429);
          // Durable row cap survives restarts and cannot be bypassed with fresh browser tokens.
          store.database.prepare('DELETE FROM installs WHERE id IN (SELECT id FROM installs WHERE expires_at <= ? ORDER BY expires_at LIMIT 128)').run(now);
          if (store.database.prepare('SELECT count(*) AS n FROM installs').get().n >= 2000) return json({ error: 'rate_limited' }, 429);
        }
        return invoke();
      };
      const pending = creationQueue.then(create);
      creationQueue = pending.catch(() => {});
      return finish(await pending);
    } catch { return finish(json({ error: 'unavailable' }, 503)); }
  };
}
