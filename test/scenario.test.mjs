import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, DEVICES, LANGUAGES, allowedExperiences, selectDevice, validateState, buildYaml, encodePreset, decodePreset, compatibility } from '../dist/scenario.mjs';

/** Return a fresh complete configuration. @param {object} overrides @returns {object} */
function setup(overrides = {}) { return { ...DEFAULTS, device: 'pi', ...overrides }; }

test('default Pi recipe includes tuning and installer statistics while voice usage remains off', () => {
  assert.equal(DEFAULTS.telemetry, true);
  const yaml = buildYaml(setup());
  for (const line of ['uninstall: false', 'method: virtualenv', 'channel: alpha', 'profile: ovos', '  skills: true', '  gui: false', '  homeassistant: false', '  llm: false', 'raspberry_pi_tuning: true', 'share_telemetry: true', 'share_usage_telemetry: false']) assert.ok(yaml.split('\n').includes(line));
  assert.ok(!yaml.includes('locale:') && !yaml.includes('hardware:'));
});

test('tuning follows the selected hardware through shared links and device changes', () => {
  for (const device of Object.keys(DEVICES)) {
    const state = selectDevice(setup(), device);
    const expected = ['pi', 'mark1', 'mark2', 'devkit'].includes(device);
    for (const recipe of [state, decodePreset(encodePreset(state))]) {
      assert.match(buildYaml(recipe), new RegExp(`^raspberry_pi_tuning: ${expected}$`, 'm'), device);
    }
    assert.match(buildYaml(selectDevice(state, 'computer')), /^raspberry_pi_tuning: false$/m);
    assert.match(buildYaml(selectDevice(state, 'pi')), /^raspberry_pi_tuning: true$/m);
  }
});

test('Mark II and DevKit force the supported channel, method and exact hardware override', () => {
  for (const device of ['mark2', 'devkit']) {
  const state = selectDevice(setup({ method: 'containers' }), device);
  assert.equal(state.channel, 'alpha'); assert.equal(state.method, 'virtualenv');
  const yaml = buildYaml(state); assert.match(yaml, new RegExp(`hardware: ${device}`)); assert.match(yaml, /  gui: true/);
  assert.throws(() => buildYaml({ ...state, channel: 'testing' }));
  assert.throws(() => buildYaml({ ...state, method: 'containers' }));
  assert.throws(() => buildYaml({ ...state, experience: 'hub' }));
  assert.equal(selectDevice(state, 'computer').channel, 'alpha');
  assert.match(compatibility(state), /64-bit Debian 13/);
  }
});

test('Mark I and Jetson use automatic detection without unsupported hardware keys', () => {
  for (const device of ['mark1', 'jetson']) {
    const state = selectDevice(setup(), device);
    assert.doesNotMatch(buildYaml(state), /hardware:/);
    assert.match(buildYaml(state), /  gui: false/);
    assert.equal(state.channel, 'alpha');
  }
  assert.match(compatibility(setup({ device: 'mark1' })), /64-bit Debian 13/);
  assert.equal(selectDevice(setup({ method: 'containers' }), 'mark1').method, 'virtualenv');
  assert.throws(() => buildYaml(setup({ device: 'mark1', method: 'containers' })));
  assert.doesNotThrow(() => buildYaml(setup({ device: 'mark1', channel: 'alpha' })));
  assert.match(compatibility(setup({ device: 'jetson' })), /Ubuntu 18.04 are not supported/);
  assert.throws(() => buildYaml(setup({ device: 'mark1', experience: 'hub' })));
});

test('server is headless and tinkering omits the standard skills bundle', () => {
  const hub = selectDevice(setup(), 'server');
  assert.equal(hub.experience, 'hub'); assert.match(buildYaml(hub), /profile: server/); assert.match(buildYaml(hub), /  gui: false/);
  assert.match(buildYaml(setup({ experience: 'tinker', skills: false })), /  skills: false/);
  assert.throws(() => buildYaml(setup({ experience: 'tinker', skills: false, extraSkills: true })));
});

test('all device, experience and language combinations round-trip as validated recipes', () => {
  let checked = 0;
  for (const device of Object.keys(DEVICES)) for (const experience of allowedExperiences(device)) for (const locale of Object.keys(LANGUAGES)) {
    const state = { ...selectDevice(setup(), device), experience, locale };
    assert.deepEqual(decodePreset('#' + encodePreset(state)), state);
    assert.match(buildYaml(state), /profile: (ovos|server)/);
    checked++;
  }
  assert.equal(checked, 300);
});

test('optional choices preserve either installer-statistics answer and never enable voice usage', () => {
  for (const telemetry of [false, true]) {
    const state = setup({ method: 'containers', channel: 'alpha', extraSkills: true, telemetry });
    assert.deepEqual(decodePreset(encodePreset(state)), state);
    assert.match(buildYaml(state), new RegExp(`^share_telemetry: ${telemetry}$`, 'm'));
    assert.match(buildYaml(state), /^share_usage_telemetry: false$/m);
  }
});

test('malformed, ambiguous, prototype and injection choices fail closed', () => {
  const good = encodePreset(setup());
  for (const bad of ['v=2', good + '&device=pi', good + '&token=secret', good.replace('v=2', 'v=99'), good.replace('extraSkills=0', 'extraSkills=yes'), good.replace('device=pi', 'device=__proto__'), good.replace('locale=en-us', 'locale=en-us%3Btouch%20%2Ftmp%2Finjected'), good.slice(0, 20), 'x'.repeat(501), 'main']) assert.throws(() => decodePreset(bad), bad);
  for (const changes of [{ locale: '$(id)' }, { device: ['pi'] }, { device: null }, { method: 'docker' }, { channel: 'stable' }, { telemetry: 'false' }, { extraSkills: 1 }, { password: 'secret' }]) assert.throws(() => validateState(setup(changes)));
  assert.equal(decodePreset(''), null);
});

test('every target states the universal 64-bit requirement, independent of speech',()=>{
  for(const device of Object.keys(DEVICES)) {
    assert.match(compatibility({...DEFAULTS,device}),device==='mac'?/Apple Silicon and macOS 15/:/64-bit/);
  }
});
