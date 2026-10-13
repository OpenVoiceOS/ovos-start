import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { InstallTracker } from '../dist/install-progress.mjs';
import { HomeAssistantDraft } from '../dist/home-assistant.mjs';
import { DEFAULTS } from '../dist/scenario.mjs';
import { issueSetup } from '../dist/short-setup.mjs';

const id = 'a'.repeat(32), credential = 'b'.repeat(64), token = 'test_private_token_not_a_real_credential';
const details = { url: 'http://homeassistant.local:8123', token };
const source = readFileSync(new URL('../dist/app.mjs', import.meta.url), 'utf8');

/** Controlled network completion independent of call ordering. @returns {object} */
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Valid owner-scoped status with independently varied handoff receipts. @param {object} changes Overrides. @returns {object} */
function status(changes = {}) {
  return { id, status: 'waiting', attention: false, createdAt: 100, updatedAt: 100, expiresAt: 1000,
    launchToken: 'L'.repeat(22), homeassistantReady: false, homeassistantClaimed: false, ...changes };
}

/** Poll and write through the actual tracker with a deterministic network. @returns {object} */
function trackerFixture() {
  const requests = [], tracker = new InstallTracker({ credential: () => credential, now: () => 100000,
    schedule: () => 0, cancel() {}, fetcher(url, options) { const pending = deferred(); requests.push({ url, options, ...pending }); return pending.promise; },
  });
  tracker.code = 'recipe-A'; tracker.session = status(); tracker.active = true;
  return { tracker, requests };
}

test('a poll started before credential saving cannot erase the successful readiness receipt', async () => {
  const { tracker, requests } = trackerFixture();
  const poll = tracker.poll(), save = tracker.saveHomeAssistant(id, details);
  requests[1].resolve(Response.json({ ready: true })); assert.equal(await save, true);
  requests[0].resolve(Response.json(status())); await poll;
  assert.equal(tracker.session.homeassistantReady, true);
  assert.equal(tracker.session.homeassistantClaimed, false);
});

test('a poll started during saving cannot restore credentials after successful removal', async () => {
  const { tracker, requests } = trackerFixture(); tracker.session.homeassistantReady = true;
  const clear = tracker.saveHomeAssistant(id, null), poll = tracker.poll();
  requests[0].resolve(Response.json({ ready: false })); assert.equal(await clear, false);
  requests[1].resolve(Response.json(status({ homeassistantReady: true }))); await poll;
  assert.equal(tracker.session.homeassistantReady, false);
});

test('failed writes invalidate overlapping polls but the next fresh poll can recover an uncertain result', async () => {
  for (const failure of ['network', 'http', 'malformed']) {
    const { tracker, requests } = trackerFixture();
    const save = tracker.saveHomeAssistant(id, details), poll = tracker.poll();
    const failed = assert.rejects(save);
    if (failure === 'network') requests[0].reject(new Error('disconnected'));
    else requests[0].resolve(Response.json(failure === 'http' ? { error: 'unavailable' } : { ready: 'true' }, { status: failure === 'http' ? 503 : 200 }));
    await failed;
    requests[1].resolve(Response.json(status({ homeassistantReady: true }))); await poll;
    assert.equal(tracker.session.homeassistantReady, false, failure);
    const recovery = tracker.poll(); requests[2].resolve(Response.json(status({ homeassistantReady: true }))); await recovery;
    assert.equal(tracker.session.homeassistantReady, true, failure);
  }
});

test('late saves cannot set readiness after reset and reconnection to the identical session', async () => {
  const { tracker, requests } = trackerFixture();
  const save = tracker.saveHomeAssistant(id, details);
  tracker.reset(); const reconnect = tracker.connect('recipe-A');
  requests[1].resolve(Response.json(status())); await reconnect;
  requests[0].resolve(Response.json({ ready: true })); await save;
  assert.equal(tracker.session.id, id); assert.equal(tracker.session.homeassistantReady, false);
});

test('late saves cannot re-arm readiness after a device has already claimed the token', async () => {
  const { tracker, requests } = trackerFixture();
  const save = tracker.saveHomeAssistant(id, details);
  tracker.session.homeassistantClaimed = true;
  requests[0].resolve(Response.json({ ready: true })); await save;
  assert.equal(tracker.session.homeassistantReady, false); assert.equal(tracker.session.homeassistantClaimed, true);
});

test('a completed handoff write does not block fresh device progress or confirmed redemption', async () => {
  const { tracker, requests } = trackerFixture();
  const save = tracker.saveHomeAssistant(id, details); requests[0].resolve(Response.json({ ready: true })); await save;
  const poll = tracker.poll(); requests[1].resolve(Response.json(status({ status: 'started', updatedAt: 101, homeassistantClaimed: true }))); await poll;
  assert.equal(tracker.session.status, 'started'); assert.equal(tracker.session.homeassistantReady, false); assert.equal(tracker.session.homeassistantClaimed, true);
});

test('unknown handoff receipts fail closed and legacy status without receipt fields still works', async () => {
  for (const field of ['homeassistantReady', 'homeassistantClaimed']) for (const value of ['true', 1, {}, null]) {
    const { tracker, requests } = trackerFixture();
    const read = tracker.request({ id }), rejected = assert.rejects(read, /unavailable/);
    requests[0].resolve(Response.json(status({ [field]: value }))); await rejected;
  }
  const { tracker, requests } = trackerFixture(), legacy = status();
  delete legacy.homeassistantReady; delete legacy.homeassistantClaimed;
  const read = tracker.request({ id }); requests[0].resolve(Response.json(legacy)); assert.deepEqual(await read, legacy);
});

test('invalid browser ownership and session identifiers never send a credential request', async () => {
  const calls = [], tracker = new InstallTracker({ credential: () => [credential], fetcher: (...args) => calls.push(args) });
  await assert.rejects(tracker.saveHomeAssistant(id, details), /unavailable/);
  tracker.credential = () => credential;
  await assert.rejects(tracker.saveHomeAssistant([id], details), /unavailable/);
  assert.equal(calls.length, 0);
});

/** Extract actual UI handlers without replacing their ordering logic. @param {string} name Handler. @returns {string} */
function declaration(name) { return source.match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`, 'm'))[0]; }

/** Isolate the real browser handoff coordination with controlled save and cleanup requests. @returns {object} */
function appFixture() {
  const state = { ...DEFAULTS, device: 'mark2', homeassistant: true }, setupSession = issueSetup(state);
  const draft = new HomeAssistantDraft(); draft.input('url', details.url); draft.input('token', token);
  const requests = [], renders = [], session = status(), context = vm.createContext({ state, setupSession, homeAssistantDraft: draft,
    previewOnly: false, step: 'review', mountHomeAssistant() {}, refreshConnections() { renders.push({ busy: vm.runInContext('homeAssistantSaving', context), draftBusy: draft.saving }); },
    installTracker: { code: setupSession.code, session, connect: async () => session,
      saveHomeAssistant(id, value) { const pending = deferred(); requests.push({ id, value, ...pending }); return pending.promise; } },
    wizard: { querySelector: selector => selector === '#ha-error' ? { scrollIntoView() {} } : selector === '#ha-url' ? { value: draft.url } : selector === '#ha-token' ? { value: draft.token } : null },
  });
  const globals = source.match(/^let homeAssistant\w+\s*=.*;$/gm) || [];
  vm.runInContext([...globals, ...['homeAssistantModel', 'clearHomeAssistantHandoff', 'forgetHomeAssistant', 'prepareHomeAssistant'].map(declaration)].join('\n'), context);
  return { context, session, draft, requests, renders };
}

/** Flush awaited continuations without guessing an arbitrary timing delay. @returns {Promise<void>} */
async function flush() { await new Promise(resolve => setImmediate(resolve)); }

test('a stale A→B→A save waits for its deletion before releasing the next save', async () => {
  const h = appFixture(), first = h.context.prepareHomeAssistant(); await flush();
  h.context.setupSession = { ...h.context.setupSession };
  h.requests[0].resolve(true); await flush();
  assert.equal(h.requests[1].value, null); assert.equal(await h.context.prepareHomeAssistant(), false);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve(false); assert.equal(await first, false);
  const second = h.context.prepareHomeAssistant(); await flush(); assert.equal(h.requests[2].value.token, token);
  h.requests[2].resolve(true); assert.equal(await second, true);
});

test('a page lifecycle reset cannot overlap a second save with a pending stale save and cleanup', async () => {
  const h = appFixture(), first = h.context.prepareHomeAssistant(); await flush();
  h.draft.clear(); h.draft.input('url', details.url); h.draft.input('token', token);
  assert.equal(await h.context.prepareHomeAssistant(), false); assert.equal(h.requests.length, 1);
  h.requests[0].resolve(true); await flush(); assert.equal(h.requests[1].value, null);
  assert.equal(await h.context.prepareHomeAssistant(), false);
  h.requests[1].resolve(false); assert.equal(await first, false);
  assert.equal(h.renders.at(-1).busy, false); assert.equal(h.renders.at(-1).draftBusy, false);
  const next = h.context.prepareHomeAssistant(); await flush(); h.requests[2].resolve(true); assert.equal(await next, true);
});

test('unknown readiness still clears a possibly accepted request before the next save', async () => {
  const h = appFixture(); h.session.homeassistantReady = false;
  h.context.clearHomeAssistantHandoff(); await flush();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].value, null);
  const next = h.context.prepareHomeAssistant(); await flush(); assert.equal(h.requests.length, 1);
  h.requests[0].resolve(false); await flush(); assert.equal(h.requests.length, 2);
  h.requests[1].resolve(true); assert.equal(await next, true);
});

test('switching to a recipe without Home Assistant still deletes the prior recipe handoff', async () => {
  const h = appFixture(); h.context.state = { ...h.context.state, homeassistant: false };
  h.context.clearHomeAssistantHandoff(); await flush();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].id, id); assert.equal(h.requests[0].value, null);
  h.requests[0].resolve(false);
});
