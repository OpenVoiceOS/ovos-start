import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, statSync, writeFileSync, mkdirSync, symlinkSync, chmodSync, readdirSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { configuration, createApi, rateAddress } from '../server/node-api.mjs';
import { openDatabase } from '../server/node-database.mjs';
import { createHttpServer } from '../server/node-server.mjs';
import { DEFAULTS } from '../dist/scenario.mjs';
import { encodeRecipeCode } from '../dist/recipe-code.mjs';

const now = 1800000000, secret = 'a'.repeat(64), browser = 'b'.repeat(64), other = 'c'.repeat(64);
const publicOrigin = 'https://api.start.example.org', wizard = 'https://start.example.org';
const state = { ...DEFAULTS, device: 'computer' };
const code = encodeRecipeCode(state, { issuedAt: now });
const config = configuration({ PUBLIC_ORIGIN: publicOrigin, ALLOWED_ORIGINS: wizard, RELAY_ADMIN_KEY: secret });

/** Build isolated on-disk state with deterministic request helpers.
 * @param {object} t Test context. @returns {object}
 */
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ovos-node-api-')), filename = join(directory, 'installs.sqlite');
  const store = openDatabase(filename); let time = now;
  const api = createApi(store, config, () => time);
  t.after(() => { try { store.close(); } catch {} rmSync(directory, { recursive: true, force: true }); });
  const call = (data, token = browser, headers = {}, peer = '127.0.0.1') => api(new Request(publicOrigin + '/api/install', {
    method: 'POST', headers: { Origin: wizard, 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(data),
  }), peer);
  const event = (data, token) => api(new Request(publicOrigin + '/v1/events', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }), '127.0.0.1');
  return { directory, filename, store, api, call, event, setTime(value) { time = value; }, async create(token = browser, headers = {}) {
    const response = await call({ code }, token, headers); assert.equal(response.status, 200); return response.json();
  } };
}

test('configuration accepts only exact HTTPS origins and a private 256-bit key', () => {
  const env = { PUBLIC_ORIGIN: publicOrigin, ALLOWED_ORIGINS: wizard, RELAY_ADMIN_KEY: secret };
  for (const origin of ['http://example.org', 'https://example.org/', 'https://example.org/path', 'https://u:p@example.org', 'https://*.example.org', 'https://example.org?x=1']) {
    assert.throws(() => configuration({ ...env, PUBLIC_ORIGIN: origin }));
    assert.throws(() => configuration({ ...env, ALLOWED_ORIGINS: origin }));
  }
  for (const key of ['', 'not-a-key', 'a'.repeat(63), 'A'.repeat(64)]) assert.throws(() => configuration({ ...env, RELAY_ADMIN_KEY: key }));
  for (const port of [0, -1, 65536, 'x']) assert.throws(() => configuration({ ...env, PORT: port }));
  assert.equal(configuration(env).port, 8787);
});

test('the shipped API configuration accepts the current wizard origin and keeps the existing API origin', async t => {
  const env = Object.fromEntries(readFileSync(new URL('../.env.example', import.meta.url), 'utf8').trim().split('\n').map(line => {
    const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  const deployment = configuration({ ...env, RELAY_ADMIN_KEY: secret });
  assert.equal(deployment.publicOrigin, 'https://start-api.smartgic.io');
  assert.deepEqual([...deployment.allowedOrigins], ['https://start.openvoiceos.org', 'https://openvoiceos.github.io']);
  const f = fixture(t), api = createApi(f.store, deployment, () => now);
  const response = await api(new Request(deployment.publicOrigin + '/api/install', {
    method: 'POST', headers: { Origin: 'https://start.openvoiceos.org', 'Content-Type': 'application/json', Authorization: `Bearer ${browser}` },
    body: JSON.stringify({ code }),
  }), '127.0.0.1');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://start.openvoiceos.org');
  assert.match((await response.json()).launchToken, /^[A-Za-z0-9_-]{22}$/);
});

test('browser capabilities isolate installs without cookies or platform identity headers', async t => {
  const f = fixture(t), a = await f.create(), b = await f.create(other);
  assert.notEqual(a.id, b.id); assert.notEqual(a.launchToken, b.launchToken);
  assert.equal((await f.call({ id: a.id }, other)).status, 410);
  const read = await f.call({ id: a.id }); assert.equal(read.status, 200);
  assert.equal(read.headers.get('access-control-allow-origin'), wizard);
  assert.equal(read.headers.get('access-control-allow-credentials'), null);
  assert.equal(read.headers.get('set-cookie'), null);
  assert.equal(read.headers.get('cache-control'), 'private, no-store');
  assert.equal((await read.json()).writeToken, undefined);
  const row = f.store.database.prepare('SELECT * FROM installs WHERE id = ?').get(a.id);
  assert.notEqual(row.owner, browser); assert.equal(Object.values(row).includes(browser), false);
  assert.equal((await f.call({ id: a.id }, '', { 'oai-authenticated-user-id': 'admin', Cookie: `session=${browser}`, Authorization: '' })).status, 401);
});

test('administrative relay routes stay unavailable even with the server secret', async t => {
  const f = fixture(t);
  for (const path of ['/v1/sessions', '/v1/session', '/api/install/other', '/healthz?secret=1']) {
    const response = await f.api(new Request(publicOrigin + path, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Origin: wizard }, body: JSON.stringify({ code, owner: browser }) }));
    assert.equal(response.status, 404);
  }
});

test('CORS preflight is exact and disallows unlisted origins and headers', async t => {
  const f = fixture(t);
  const preflight = headers => f.api(new Request(publicOrigin + '/api/install', { method: 'OPTIONS', headers: { Origin: wizard, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type', ...headers } }));
  const good = await preflight({}); assert.equal(good.status, 204); assert.equal(good.headers.get('access-control-allow-origin'), wizard);
  assert.equal(good.headers.get('vary'), 'Origin'); assert.equal(good.headers.get('access-control-allow-credentials'), null);
  assert.equal((await preflight({ 'Access-Control-Request-Headers': 'authorization, x-admin' })).status, 403);
  assert.equal((await preflight({ 'Access-Control-Request-Method': 'GET' })).status, 403);
  for (const origin of ['null', 'https://start.example.org.evil.test', 'http://start.example.org', '']) {
    const denied = await f.call({ code }, browser, { Origin: origin }); assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
});

test('strict payload validation rejects expanded bodies and unsupported recipe combinations', async t => {
  const f = fixture(t);
  for (const data of [{ code, owner: other }, [], { id: '../other' }, { code: 'bad' }, { code, extra: 'x'.repeat(1100) }]) {
    assert.equal((await f.call(data)).status, 400);
  }
  const incompatible = encodeRecipeCode({ ...state, device: 'mark2', method: 'containers', channel: 'testing' }, { issuedAt: now });
  assert.equal((await f.call({ code: incompatible })).status, 400);
  assert.equal((await f.call({ code }, browser, { 'Content-Type': 'text/plain' })).status, 400);
  assert.equal((await f.call({ code }, browser, { Authorization: `Bearer ${browser}, Bearer ${other}` })).status, 401);
});

test('capability endpoints accept device callbacks but never browser ownership tokens', async t => {
  const f = fixture(t), session = await f.create();
  const writeToken = createHmac('sha256', secret).update(`install:${session.id}`).digest('hex');
  assert.equal((await f.event({ event: 'started' }, browser)).status, 401);
  assert.equal((await f.event({ event: 'started' }, writeToken)).status, 200);
  const failure = { event: 'failed', errorUrl: 'https://paste.uoi.io/report_123' };
  assert.equal((await f.event(failure, writeToken)).status, 200);
  assert.equal((await (await f.call({ id: session.id })).json()).errorUrl, failure.errorUrl);
  const launch = await f.api(new Request(publicOrigin + '/s/' + session.launchToken));
  assert.equal(launch.status, 200); assert.match(await launch.text(), /raw\.githubusercontent\.com/);
  assert.equal((await f.api(new Request(publicOrigin + '/s/' + session.id))).status, 404);
});

test('creation quotas cannot be bypassed by rotating browser ownership tokens', async t => {
  const f = fixture(t);
  for (let i = 0; i < 10; i++) assert.equal((await f.call({ code }, i.toString(16).padStart(64, '0'), { 'CF-Connecting-IP': '198.51.100.2' })).status, 200);
  assert.equal((await f.call({ code }, 'f'.repeat(64), { 'CF-Connecting-IP': '198.51.100.2' })).status, 429);
  // A genuine restore does not consume a new-creation allowance.
  assert.equal((await f.call({ code }, '0'.repeat(64), { 'CF-Connecting-IP': '198.51.100.2' })).status, 200);
  for (let i = 10; i < 60; i++) assert.equal((await f.call({ code }, i.toString(16).padStart(64, '0'), { 'CF-Connecting-IP': `198.51.100.${i}` })).status, 200);
  assert.equal((await f.call({ code }, 'e'.repeat(64), { 'CF-Connecting-IP': '203.0.113.1' })).status, 429);
  f.setTime(now + 60);
  assert.equal((await f.call({ code }, 'e'.repeat(64), { 'CF-Connecting-IP': '203.0.113.1' })).status, 200);
});

test('only a loopback proxy can supply a client IP and no forwarded header authenticates', () => {
  const request = new Request(publicOrigin, { headers: { 'CF-Connecting-IP': '198.51.100.2', 'X-Forwarded-For': '203.0.113.1' } });
  assert.equal(rateAddress(request, '127.0.0.1'), '198.51.100.2');
  assert.equal(rateAddress(request, '192.0.2.1'), '192.0.2.1');
  assert.equal(rateAddress(new Request(publicOrigin, { headers: { 'CF-Connecting-IP': 'not an ip' } }), '127.0.0.1'), '127.0.0.1');
});

test('request throttling bounds repeated reads and remains readable through CORS', async t => {
  const f = fixture(t), session = await f.create();
  for (let i = 1; i < 180; i++) assert.equal((await f.call({ id: session.id })).status, 200);
  const limited = await f.call({ id: session.id }); assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('access-control-allow-origin'), wizard);
  f.setTime(now + 60); assert.equal((await f.call({ id: session.id })).status, 200);
});

test('the durable global capacity limit survives a fresh API instance, serializes new sessions and allows restores', async t => {
  const f = fixture(t), session = await f.create();
  const insert = f.store.database.prepare('INSERT INTO installs (id,owner,code,write_hash,created_at,start_before,expires_at,updated_at) VALUES (?,?,?,?,?,?,?,?)');
  f.store.database.exec('BEGIN');
  for (let i = 0; i < 1998; i++) insert.run(i.toString(16).padStart(32, '0'), i.toString(16).padStart(64, '0'), code, i.toString(16).padStart(64, '0'), now, now + 3600, now + 86400, now);
  f.store.database.exec('COMMIT');
  const restarted = createApi(f.store, config, () => now);
  const responses = await Promise.all([other, 'd'.repeat(64)].map(token => restarted(new Request(publicOrigin + '/api/install', { method: 'POST', headers: { Origin: wizard, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ code }) }))));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 429]);
  assert.equal((await f.call({ code })).status, 200);
  assert.equal((await f.call({ id: session.id })).status, 200);
  assert.equal(f.store.database.prepare('SELECT count(*) n FROM installs').get().n, 2000);
});

test('launch and status deadlines stay bounded', async t => {
  const f = fixture(t), session = await f.create();
  const writeToken = createHmac('sha256', secret).update(`install:${session.id}`).digest('hex');
  f.setTime(now + 3599); assert.equal((await f.event({ event: 'started' }, writeToken)).status, 200);
  f.setTime(now + 3600);
  const expired = await f.api(new Request(publicOrigin + '/s/' + session.launchToken));
  const diagnostic = await expired.text(); assert.doesNotMatch(diagnostic, new RegExp(writeToken)); assert.match(diagnostic, /expired/);
  assert.equal((await f.event({ event: 'installed' }, writeToken)).status, 200);
  f.setTime(now + 86400);
  assert.equal((await f.call({ id: session.id })).status, 410);
  assert.equal((await f.event({ event: 'voice_ready' }, writeToken)).status, 410);
});

test('persistent database, capabilities and migration journal survive restarts', async t => {
  const f = fixture(t), first = await f.create();
  assert.equal(f.store.database.prepare('SELECT count(*) n FROM node_migrations').get().n, 6);
  assert.equal(statSync(f.filename).mode & 0o777, 0o600);
  f.store.close();
  const reopened = openDatabase(f.filename); t.after(() => reopened.close());
  assert.equal(reopened.database.prepare('SELECT count(*) n FROM node_migrations').get().n, 6);
  const api = createApi(reopened, config, () => now);
  const response = await api(new Request(publicOrigin + '/api/install', { method: 'POST', headers: { Origin: wizard, 'Content-Type': 'application/json', Authorization: `Bearer ${browser}` }, body: JSON.stringify({ code }) }));
  assert.deepEqual(await response.json(), first);
});

test('audio progress survives a process restart and stays private to its browser owner',async t=>{
  const f=fixture(t),session=await f.create();
  const writeToken=createHmac('sha256',secret).update(`install:${session.id}`).digest('hex');
  for(const event of ['installing','packages_installed','installed','services_ready','audio_checking','audio_passed','microphone_checking','microphone_failed']){
    assert.equal((await f.event({event},writeToken)).status,200);
  }
  const before=await (await f.call({id:session.id})).json();
  assert.equal(before.audioStatus,'passed');assert.equal(before.microphoneStatus,'failed');assert.equal(before.attention,true);
  assert.deepEqual(before.completedSteps,['packages_installed','services_started']);
  f.store.close();
  const reopened=openDatabase(f.filename);t.after(()=>reopened.close());
  const api=createApi(reopened,config,()=>now);
  const read=token=>api(new Request(publicOrigin+'/api/install',{method:'POST',headers:{Origin:wizard,'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id:session.id})}));
  assert.equal((await read(other)).status,410);
  assert.deepEqual(await (await read(browser)).json(),before);
});

test('audio migration preserves prior sessions and backfills only confirmed voice checks',t=>{
  const directory=mkdtempSync(join(tmpdir(),'ovos-audio-migration-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const legacyMigrations=join(directory,'old-migrations');mkdirSync(legacyMigrations);
  const migrationRoot=new URL('../server/relay/drizzle/',import.meta.url);
  for(const name of readdirSync(migrationRoot).filter(name=>/^000[0-3]_.*\.sql$/.test(name)))copyFileSync(new URL(name,migrationRoot),join(legacyMigrations,name));
  const filename=join(directory,'installs.sqlite'),legacy=openDatabase(filename,legacyMigrations);
  const states=['waiting','installed','services_ready','voice_ready'];
  const insert=legacy.database.prepare('INSERT INTO installs (id,owner,code,write_hash,status,rank,created_at,start_before,expires_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  for(const [index,status] of states.entries())insert.run(String(index),String(index),String(index),String(index),status,status==='waiting'?0:index+3,now,now+3600,now+86400,now);
  legacy.close();
  const migrated=openDatabase(filename);t.after(()=>migrated.close());
  assert.equal(migrated.database.prepare('SELECT count(*) n FROM node_migrations').get().n,6);
  for(const row of migrated.database.prepare('SELECT * FROM installs').all()){
    assert.equal(row.audio_status,row.status==='voice_ready'?'passed':'pending');
    assert.equal(row.microphone_status,row.status==='voice_ready'?'passed':'pending');
    assert.equal(row.completed_steps,row.status==='services_ready'?8:0);
    assert.equal(row.created_at,now);assert.equal(row.expires_at,now+86400);
  }
  for(const field of ['audio_status','microphone_status']){
    assert.throws(()=>migrated.database.prepare(`UPDATE installs SET ${field} = ?`).run('untrusted status'),/CHECK/);
  }
});

test('completed-step migration preserves prior audio outcomes and only backfills confirmed service state',t=>{
  const directory=mkdtempSync(join(tmpdir(),'ovos-steps-migration-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const legacyMigrations=join(directory,'old-migrations');mkdirSync(legacyMigrations);
  const migrationRoot=new URL('../server/relay/drizzle/',import.meta.url);
  for(const name of readdirSync(migrationRoot).filter(name=>/^000[0-4]_.*\.sql$/.test(name)))copyFileSync(new URL(name,migrationRoot),join(legacyMigrations,name));
  const filename=join(directory,'installs.sqlite'),legacy=openDatabase(filename,legacyMigrations);
  assert.equal(legacy.database.prepare('SELECT count(*) n FROM node_migrations').get().n,5);
  const insert=legacy.database.prepare('INSERT INTO installs (id,owner,code,write_hash,status,rank,audio_status,microphone_status,created_at,start_before,expires_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for(const [index,status] of ['installed','services_ready','voice_ready'].entries()){
    insert.run(String(index),String(index),String(index),String(index),status,index+4,'passed','failed',now,now+3600,now+86400,now);
  }
  legacy.close();
  const migrated=openDatabase(filename);t.after(()=>migrated.close());
  assert.equal(migrated.database.prepare('SELECT count(*) n FROM node_migrations').get().n,6);
  for(const row of migrated.database.prepare('SELECT * FROM installs').all()){
    assert.equal(row.completed_steps,row.status==='services_ready'?8:0);
    assert.equal(row.audio_status,'passed');assert.equal(row.microphone_status,'failed');
    assert.equal(row.created_at,now);assert.equal(row.expires_at,now+86400);
  }
  for(const value of [-1,16,1.5,'untrusted'])assert.throws(()=>migrated.database.prepare('UPDATE installs SET completed_steps = ?').run(value),/CHECK/);
});

test('database health fails closed without exposing paths, SQL or secrets', async t => {
  const f = fixture(t);
  assert.deepEqual(await (await f.api(new Request(publicOrigin + '/healthz'))).json(), { ok: true });
  f.store.close();
  const response = await f.api(new Request(publicOrigin + '/healthz')); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
  assert.equal((await f.call({ code })).status, 503);
});

test('transactional migration failures roll back schema and journal together', t => {
  const directory = mkdtempSync(join(tmpdir(), 'ovos-migration-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const migrations = join(directory, 'migrations'); mkdirSync(migrations);
  writeFileSync(join(migrations, '0000_first.sql'), 'CREATE TABLE example (id INTEGER);');
  writeFileSync(join(migrations, '0001_broken.sql'), 'INVALID SQL;');
  const filename = join(directory, 'db.sqlite');
  assert.throws(() => openDatabase(filename, migrations));
  const db = new DatabaseSync(filename);
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(), []); db.close();
  writeFileSync(join(migrations, '0001_broken.sql'), 'ALTER TABLE example ADD value TEXT;');
  const good = openDatabase(filename, migrations); assert.equal(good.database.prepare('SELECT count(*) n FROM node_migrations').get().n, 2); good.close();
  writeFileSync(join(migrations, '0000_first.sql'), 'CREATE TABLE replaced (id INTEGER);');
  assert.throws(() => openDatabase(filename, migrations), /migration changed/);
});

test('SQLite refuses symlinks and non-private state directories', t => {
  const directory = mkdtempSync(join(tmpdir(), 'ovos-private-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const real = join(directory, 'real.sqlite'), link = join(directory, 'linked.sqlite'); writeFileSync(real, ''); symlinkSync(real, link);
  assert.throws(() => openDatabase(link));
  chmodSync(directory, 0o755); assert.throws(() => openDatabase(real), /private/);
});

test('HTTP adapter serves real requests and enforces body bounds with no forwarded-host trust', async t => {
  const f = fixture(t), server = createHttpServer(f.store, config, () => now);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(url + '/healthz', { headers: { 'X-Forwarded-Host': 'evil.test' } }); assert.equal(health.status, 200);
  const created = await fetch(url + '/api/install', { method: 'POST', headers: { Origin: wizard, 'Content-Type': 'application/json', Authorization: `Bearer ${browser}` }, body: JSON.stringify({ code }) });
  assert.equal(created.status, 200); assert.match((await created.json()).id, /^[a-f0-9]{32}$/);
  const tooLarge = await fetch(url + '/api/install', { method: 'POST', headers: { Origin: wizard, 'Content-Type': 'application/json', Authorization: `Bearer ${browser}` }, body: 'x'.repeat(1025) });
  assert.equal(tooLarge.status, 413);
  const chunked = await new Promise((resolve, reject) => {
    const request = httpRequest(url + '/api/install', { method: 'POST', headers: { Origin: wizard, 'Content-Type': 'application/json', Authorization: `Bearer ${browser}` } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    request.on('error', reject); request.write('x'.repeat(800)); request.end('x'.repeat(800));
  });
  assert.equal(chunked, 413); assert.equal(server.maxConnections, 64); assert.equal(server.requestTimeout, 10000);
});

test('the real CLI stays listening through a release-directory symlink and stops cleanly', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'ovos-cli-'));
  const current = join(directory, 'current');
  symlinkSync(fileURLToPath(new URL('../', import.meta.url)), current, 'dir');
  const reservation = createTcpServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, [join(current, 'server/node-server.mjs')], {
    env: { PUBLIC_ORIGIN: publicOrigin, ALLOWED_ORIGINS: wizard, RELAY_ADMIN_KEY: secret, DATABASE_PATH: join(directory, 'state/installs.sqlite'), PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited; rmSync(directory, { recursive: true, force: true });
  });
  child.stderr.resume();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI did not start listening.')), 5000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('CLI exited before listening.')); });
    child.stdout.on('data', chunk => {
      if (chunk.toString().includes('OVOS API listening on loopback.')) { clearTimeout(timer); resolve(); }
    });
  });
  const health = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(3000), headers: { Connection: 'close' } });
  assert.equal(health.status, 200); assert.deepEqual(await health.json(), { ok: true });
  assert.equal(child.exitCode, null);
  child.kill('SIGTERM');
  const stopped = await Promise.race([exited, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('CLI did not stop.')), 5000); timer.unref(); })]);
  assert.deepEqual(stopped, [0, null]);
});
