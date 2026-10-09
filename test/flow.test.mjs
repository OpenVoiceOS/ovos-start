import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, buildYaml, encodePreset, decodePreset } from '../dist/scenario.mjs';
import { devicesForExperience, hardwareCardsForExperience, platformTarget, chooseExperience, applySkillDefaults, chooseHardware, chooseSpeech, chooseCapability } from '../dist/flow.mjs';

test('changing speech or hardware returns to the Alpha default', () => {
  const local = chooseSpeech({...DEFAULTS, device:'computer', cpu:'avx2', memory:'8plus'}, 'local');
  assert.equal(local.channel,'alpha');
  assert.equal(chooseSpeech(local,'public').channel,'alpha');
  assert.equal(chooseSpeech(local,'auto').channel,'alpha');
  assert.equal(chooseHardware(local,'mark1').channel,'alpha');
  assert.equal(chooseHardware(local,'mark2').channel,'alpha');
  assert.equal(chooseSpeech({...local,device:'mac'},'public').channel,'alpha');
});


test('each purpose shows only compatible hardware', () => {
  assert.deepEqual(hardwareCardsForExperience('ready'), ['pi', 'computer', 'mark1', 'mark2', 'devkit', 'jetson']);
  assert.deepEqual(hardwareCardsForExperience('tinker'), ['pi', 'computer', 'mark1', 'mark2', 'devkit', 'jetson']);
  assert.deepEqual(hardwareCardsForExperience('hub'), ['pi', 'computer', 'jetson', 'server']);
  for (const invalid of ['constructor', '__proto__', null, ['ready'], 'satellite']) assert.throws(() => devicesForExperience(invalid));
});

test('two card choices produce a validated recipe for all twenty-five supported device/profile paths', () => {
  for (const experience of ['ready', 'tinker', 'hub']) {
    const purpose = chooseExperience({ ...DEFAULTS }, experience);
    for (const device of devicesForExperience(experience)) {
      const recipe = chooseHardware(purpose, device);
      assert.equal(recipe.experience, experience);
      assert.equal(recipe.device, device);
      assert.equal(recipe.channel, 'alpha');
      assert.match(buildYaml(recipe), /^channel: alpha$/m);
      assert.deepEqual(decodePreset(encodePreset(recipe)), recipe);
      assert.match(buildYaml(recipe), experience === 'hub' ? /profile: server/ : /profile: ovos/);
      if (['mark2', 'devkit'].includes(device)) { assert.equal(recipe.channel, 'alpha'); assert.equal(recipe.method, 'virtualenv'); }
    }
  }
});

test('changing a purpose clears incompatible hardware without losing language', () => {
  for (const device of ['mark1', 'mark2', 'devkit']) {
    const enclosed = chooseHardware({ ...DEFAULTS, locale: 'fr-fr' }, device);
    const hub = chooseExperience(enclosed, 'hub');
    assert.equal(hub.device, null); assert.equal(hub.channel, 'alpha'); assert.equal(hub.locale, 'fr-fr');
  }
  const hub = chooseExperience(DEFAULTS, 'hub');
  const server = chooseHardware(hub, 'server');
  const talk = chooseExperience(server, 'ready');
  assert.equal(talk.device, null); assert.equal(talk.experience, 'ready');
});

test('tinkering clears extra skills and device selection cannot override intent', () => {
  const tinkering = chooseExperience({ ...DEFAULTS, device: 'pi', extraSkills: true }, 'tinker');
  assert.equal(tinkering.extraSkills, false); assert.equal(tinkering.device, 'pi');
  assert.match(buildYaml(chooseHardware(tinkering, 'computer')), /  skills: false/);
  assert.throws(() => chooseHardware(tinkering, 'server'));
  assert.throws(() => chooseHardware(chooseExperience(DEFAULTS, 'hub'), 'mark2'));
});

test('previously published v1 links still restore the exact installer choices', () => {
  const legacy = '#v=1&device=pi&experience=ready&language=fr-fr&method=virtualenv&channel=testing&extras=0&telemetry=0';
  const restored = decodePreset(legacy);
  assert.equal(restored.locale, 'fr-fr');
  assert.equal(restored.device, 'pi');
  assert.equal(restored.speech, 'auto');
  assert.equal(restored.channel, 'testing');
  assert.equal(restored.homeassistant, false);
  assert.deepEqual(decodePreset(encodePreset(restored)), restored);
});

test('explicit Testing choices survive compatible hardware, purpose and speech edits', () => {
  const selected = {...DEFAULTS, device:'computer', channel:'testing'};
  for (const device of ['pi','computer','mark1','jetson','server','windows','other']) {
    const state=device==='server'?chooseExperience(selected,'hub'):selected;
    assert.equal(chooseHardware(state,device).channel,'testing');
  }
  for (const experience of ['ready','tinker','hub']) {
    assert.equal(chooseExperience(selected,experience).channel,'testing');
  }
  for (const speech of ['auto','public']) {
    assert.equal(chooseSpeech(selected,speech).channel,'testing');
  }
  assert.equal(chooseHardware(selected,'mac').channel,'alpha');
});

test('computer and unlisted-device routing never guesses an unknown OS', () => {
  assert.equal(platformTarget('linux'), 'computer');
  assert.equal(platformTarget('linux', true), 'other');
  assert.equal(platformTarget('mac'), 'mac');
  assert.equal(platformTarget('windows'), 'windows');
  assert.equal(platformTarget('unknown'), null);
  assert.throws(() => platformTarget('constructor'));
});

test('reselecting a device preserves local speech; changing it clears capabilities', () => {
  const local = chooseSpeech({...DEFAULTS, device:'computer', memory:'8plus', cpu:'avx2'}, 'local');
  assert.deepEqual(chooseHardware(local,'computer'), local);
  const changed = chooseHardware(local,'pi');
  assert.equal(changed.speech,'auto');
  assert.equal(changed.memory,'unknown');
  assert.equal(changed.cpu,'unknown');
  assert.equal(changed.piModel,'unknown');
  assert.throws(() => chooseHardware(local, null));
});



test('saved Pi recipes gain board capability only when answering memory and still round-trip',()=>{
  const old=decodePreset('#v=1&device=pi&experience=ready&language=fr-fr&method=virtualenv&channel=testing&extras=0&telemetry=0');
  assert.equal(old.cpu,'unknown');
  const confirmed=chooseSpeech(chooseCapability({...old,piModel:'pi5'},'memory','8plus'),'local');
  assert.equal(confirmed.cpu,'arm64');
  assert.deepEqual(decodePreset(encodePreset(confirmed)),confirmed);
  assert.equal(chooseHardware(confirmed,'computer').cpu,'unknown');
});

test('starter skills follow setup style and purpose without an extra question',()=>{
  for(const expertise of ['guided','tinker','expert']){
    const original=Object.freeze({...DEFAULTS,expertise});
    const custom=chooseExperience(original,'tinker');
    assert.equal(custom.skills,false);assert.equal(custom.extraSkills,false);
    const ready=chooseExperience(custom,'ready');
    assert.equal(ready.skills,expertise!=='expert','Back from custom must restore the suggested bundle');
    assert.equal(ready.extraSkills,false);
    assert.equal(applySkillDefaults({...ready,expertise:'expert'}).skills,false);
    assert.equal(applySkillDefaults({...ready,expertise:'guided'}).skills,true);
  }
});

test('explicit and saved skill choices survive profile edits with container-hub limits',()=>{
  for(const bundle of [{skills:false,extraSkills:false},{skills:true,extraSkills:false},{skills:true,extraSkills:true}]){
    const explicit=Object.freeze({...DEFAULTS,device:'computer',...bundle});
    for(const expertise of ['guided','expert']){
      assert.deepEqual(applySkillDefaults({...explicit,expertise},true),{...explicit,expertise});
    }
    for(const experience of ['ready','tinker','hub']){
      const changed=chooseExperience(explicit,experience,true);
      assert.equal(changed.skills,bundle.skills);
      assert.equal(changed.extraSkills,bundle.extraSkills);
      assert.deepEqual(decodePreset(encodePreset(changed)),changed);
    }
  }
  const hub=chooseExperience({...DEFAULTS,device:'computer',method:'containers',extraSkills:true},'hub',true);
  assert.equal(hub.skills,true);assert.equal(hub.extraSkills,false);
  assert.match(buildYaml(hub),/extra_skills: false/);
});
