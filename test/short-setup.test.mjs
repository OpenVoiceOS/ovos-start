import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { DEFAULTS, validateState, buildYaml, encodePreset } from '../dist/scenario.mjs';
import { COMPACT_FIELDS, encodeRecipeCode, decodeRecipeCode } from '../dist/recipe-code.mjs';
import { issueSetup, sameSetupChoices, setupStatus, buildShortCommand, buildSetupScript, readSetupSession, LAUNCHER_URL } from '../dist/short-setup.mjs';

const base = { ...DEFAULTS, device: 'computer' };
const issuedAt=1800000000;
const artifact=issueSetup(base,issuedAt), token='L'.repeat(22);
const launcher=process.env.OVOS_LAUNCHER_ROOT?join(process.env.OVOS_LAUNCHER_ROOT,'v2.sh'):null;

test('short commands use only the bound relay capability and remain one line', () => {
  const state = { ...base, locale: 'fr-fr', speech: 'public', homeassistant: true, llmMode: 'online', extraSkills: true };
  const setup = issueSetup(state,issuedAt);
  const code=setup.code;
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.deepEqual(decodeRecipeCode(code,{now:issuedAt}), state);
  assert.ok(buildShortCommand(setup,issuedAt,token).includes('/s/'+token));
  assert.match(LAUNCHER_URL,/^https:\/\/raw\.githubusercontent\.com\/goldyfruit\/ovos-start-launcher\/[a-f0-9]{40}\/v2\.sh$/);
  assert.ok(!buildShortCommand(setup,issuedAt,token).includes(code));
  assert.equal(buildShortCommand(setup,issuedAt,token).split('\n').length, 1);
  assert.ok(buildShortCommand(setup,issuedAt,token).endsWith(' | sh'));
  assert.throws(() => issueSetup({ ...state, token: 'not-for-a-code' }));
});

test('new compact links and existing versioned links restore the same complete recipe', () => {
  assert.deepEqual(readSetupSession(`#setup=${artifact.code}`,issuedAt).state, base);
  assert.deepEqual(readSetupSession(`#${encodePreset(base)}`).state, base);
  assert.equal(readSetupSession(''), null);
  assert.throws(() => readSetupSession(`#setup=${artifact.code}&token=secret`));
  assert.throws(() => readSetupSession('#setup=2400-00K0'));
});

test('the shell decoder and YAML match the wizard across options and local-speech boundaries', {skip:!launcher&&'Set OVOS_LAUNCHER_ROOT to check canonical v2.sh'}, () => {
  const states = [base,
    { ...base, device: 'pi', speech: 'local', channel: 'alpha', cpu: 'arm64', memory: '8plus', piModel: 'pi5' },
    { ...base, device: 'mac', channel: 'alpha', speech: 'local', cpu: 'arm64', memory: '8plus' },
    { ...base, speech: 'local', channel: 'alpha', cpu: 'avx2', memory: '8plus', homeassistant: true, llmMode: 'local' },
    { ...base, device: 'mark2', channel: 'alpha', speech: 'public' },
    { ...base, device: 'devkit', channel: 'alpha', speech: 'public' },
    { ...base, device: 'server', experience: 'hub', method: 'containers' },
  ];
  for (const field of COMPACT_FIELDS) {
    for (const value of field.values) states.push({ ...base, [field.name]: value });
  }
  for (const state of [...states]) {
    if (state.speech === 'local') {
      for (const field of COMPACT_FIELDS) for (const value of field.values) states.push({ ...state, [field.name]: value });
    }
  }
  for (const state of states) {
    const code = encodeRecipeCode(state);
    let valid = true;
    try { validateState(state); } catch { valid = false; }
    const result = spawnSync('sh', [launcher, '--decode', code], { encoding: 'utf8' });
    assert.equal(result.status === 0, valid, `${code}: ${JSON.stringify(state)} ${result.stderr}`);
    if (valid) {
      assert.deepEqual(JSON.parse(result.stdout), state);
      assert.equal(execFileSync('sh', [launcher, '--scenario', code], { encoding: 'utf8' }), buildYaml(state));
    }
  }
});


test('one artifact preserves its exact code and deadline across copy, script and saved-link reload',()=>{
  const restored=readSetupSession(`#setup=${artifact.code}`,issuedAt+3540);
  assert.equal(restored.code,artifact.code);
  assert.equal(restored.issuedAt,issuedAt);
  assert.equal(restored.expiresAt,issuedAt+3600);
  assert.equal(buildShortCommand(artifact,issuedAt,token),buildShortCommand(restored,issuedAt+3599,token));
  assert.equal(buildSetupScript(artifact,issuedAt+3599,token),buildSetupScript(restored,issuedAt+3599,token));
  assert.equal(setupStatus(restored,issuedAt+3540).message,'Expires in 1 min.');
  assert.ok(sameSetupChoices(restored,{...base}));
  assert.ok(!sameSetupChoices(restored,{...base,locale:'fr-fr'}));
  assert.ok(Object.isFrozen(restored));assert.ok(Object.isFrozen(restored.state));
});

test('exact one-hour deadline blocks copied commands and script downloads without dropping choices',()=>{
  assert.equal(setupStatus(artifact,issuedAt+3599).kind,'active');
  for(const now of [issuedAt+3600,issuedAt+86400]){
    assert.equal(setupStatus(artifact,now).kind,'expired');
    assert.throws(()=>buildShortCommand(artifact,now),/expir/i);
    assert.throws(()=>buildSetupScript(artifact,now),/expir/i);
    const restored=readSetupSession(`#setup=${artifact.code}`,now);
    assert.deepEqual(restored.state,base);assert.equal(restored.expiresAt,artifact.expiresAt);
  }
  const renewed=issueSetup(artifact.state,issuedAt+3600);
  assert.notEqual(renewed.code,artifact.code);assert.equal(renewed.expiresAt,issuedAt+7200);
});

test('legacy links recover choices but cannot produce a runnable command until new issuance',()=>{
  for(const fragment of ['#setup=2400-00KZ',`#${encodePreset(base)}`]){
    const legacy=readSetupSession(fragment,issuedAt);
    assert.deepEqual(legacy.state,base);assert.equal(setupStatus(legacy,issuedAt).kind,'legacy');
    assert.throws(()=>buildShortCommand(legacy,issuedAt));
    assert.throws(()=>buildSetupScript(legacy,issuedAt));
    assert.equal(issueSetup(legacy.state,issuedAt).expiresAt,issuedAt+3600);
  }
});

test('invalid or backward clocks fail closed instead of silently renewing a command',()=>{
  for(const now of [NaN,Infinity,-1,0,2**40,issuedAt-1])assert.equal(setupStatus(artifact,now).kind,'clock');
  assert.throws(()=>readSetupSession(`#setup=${artifact.code}`,issuedAt-1));
  assert.throws(()=>buildShortCommand(artifact,issuedAt-1));
});
