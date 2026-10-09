import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DEFAULTS, PRESET_SCHEMA, LANGUAGES, selectDevice, validateState, buildYaml, compatibility, encodePreset, decodePreset } from '../dist/scenario.mjs';
import { suggestLanguage, browserLanguages, languageSource, localeFlag, speechEligibility, localSpeechOption, recommend, localModelGuidance } from '../dist/recommendations.mjs';

const capable = { ...DEFAULTS, device: 'computer', cpu: 'avx2', memory: '8plus', channel: 'alpha', speech: 'local' };

test('local AI guidance separates remote model hosting from speech eligibility', () => {
  assert.match(localModelGuidance({...DEFAULTS,device:'mark2'}), /another capable computer/);
  assert.match(localModelGuidance({...capable,memory:'under8'}), /another capable computer/);
  assert.match(localModelGuidance(capable), /does not guarantee/);
});

test('browser-agent schema can express complete guided presets and rejects undefined fields', () => {
  assert.deepEqual(Object.keys(PRESET_SCHEMA.properties).sort(), Object.keys(DEFAULTS).sort());
  assert.deepEqual(PRESET_SCHEMA.required, Object.keys(DEFAULTS));
  assert.equal(PRESET_SCHEMA.additionalProperties, false);
  for (const [key, value] of Object.entries(capable)) {
    const field = PRESET_SCHEMA.properties[key];
    assert.equal(typeof value, field.type);
    if (field.enum) assert.ok(field.enum.includes(value));
  }
});

test('language suggestion handles exact, regional, fallback and malformed browser preferences', () => {
  assert.deepEqual(suggestLanguage(['fr-FR'], LANGUAGES), {locale:'fr-fr',matched:true,exact:true});
  assert.deepEqual(suggestLanguage(['fr-CA','en-US'], LANGUAGES), {locale:'fr-fr',matched:true,exact:false});
  assert.equal(suggestLanguage(['xx-ZZ', 'de-DE'], LANGUAGES).locale,'de-de');
  assert.equal(suggestLanguage([null, 'xx-ZZ'], LANGUAGES).matched,false);
});

test('speech recommendations explain hardware, language, memory and CPU limits', () => {
  assert.equal(speechEligibility(capable).eligible,true);
  for (const change of [{memory:'under8'},{memory:'unknown'},{cpu:'unknown'},{locale:'hi-in'},{locale:'kab-dz'},{device:'mark1'},{device:'mark2'},{device:'devkit'},{experience:'hub'}]) {
    const result = speechEligibility({...capable,...change});
    assert.equal(result.eligible,false,JSON.stringify(change)); assert.ok(result.reason.length>20);
  }
  assert.equal(speechEligibility({...capable,device:'pi',cpu:'arm64',piModel:'pi5'}).eligible,true);
  assert.equal(speechEligibility({...capable,device:'pi',cpu:'arm64',piModel:'older'}).eligible,false);
  assert.equal(speechEligibility({...capable,device:'pi',piModel:'pi5'}).eligible,false);
  assert.equal(speechEligibility({...capable,device:'mac',cpu:'arm64'}).eligible,true);
  assert.equal(speechEligibility({...capable,device:'mac',cpu:'intel-mac'}).eligible,false);
});

test('local speech requests are constrained and public/main remain distinct contracts', () => {
  assert.match(buildYaml(capable),/speech_engine: local/);
  assert.match(buildYaml({...capable,speech:'public',channel:'testing'}),/speech_engine: public/);
  assert.doesNotMatch(buildYaml({...capable,speech:'auto'}),/speech_engine/);
  for (const change of [{channel:'testing'},{method:'containers'},{memory:'unknown'},{device:'mark2'}]) assert.throws(()=>validateState({...capable,...change}));

});

test('profiles and experience affect suggestions without silently adding integrations', () => {
  assert.equal(recommend({...capable,expertise:'guided'}).skills,true);
  assert.equal(recommend({...capable,expertise:'expert'}).skills,false);
  assert.equal(recommend({...capable,experience:'hub'}).integrations,false);
  const hub={...DEFAULTS,device:'server',experience:'hub'};
  for(const change of [{homeassistant:true},{llmMode:'online'},{speech:'public'},{method:'containers',extraSkills:true}]) assert.throws(()=>validateState({...hub,...change}));
});

test('Mac and Windows keep their actual platform constraints', () => {
  const mac=selectDevice({...DEFAULTS,method:'containers'},'mac');
  assert.equal(mac.method,'virtualenv');assert.equal(mac.channel,'alpha');
  assert.throws(()=>validateState({...mac,channel:'testing'}));
  assert.equal(selectDevice(mac,'computer').channel,'testing');
  const windows=selectDevice({...DEFAULTS,method:'containers'},'windows');
  assert.equal(windows.method,'virtualenv');
  assert.match(compatibility(windows),/WSL2/);
});

test('all integration and speech combinations generate parseable secret-free artifacts', () => {
  for(const speech of ['auto','public','local']) for(const homeassistant of [false,true]) for(const llmMode of ['off','local','online']) {
    const state={...capable,speech,homeassistant,llmMode};
    const yaml=buildYaml(state), link=encodePreset(state);
    assert.deepEqual(decodePreset(link),state);
    assert.doesNotMatch(yaml,/api_key:|token:|api_url:|persona:/);
    assert.doesNotMatch(link,/API_KEY|api_url|token/);

  }
});

test('empty browser language lists fall back to the primary preference',()=>{
  assert.deepEqual(browserLanguages([], 'fr-CA'),['fr-CA']);
  assert.deepEqual(browserLanguages(undefined,'de-DE'),['de-DE']);
  assert.deepEqual(browserLanguages([null,' '], ' FR_fr '),['FR_fr']);
  assert.deepEqual(browserLanguages(['fr-FR','en-US'],'de-DE'),['fr-FR','en-US']);
  assert.deepEqual(browserLanguages([],null),[]);
  assert.equal(suggestLanguage(browserLanguages([], 'FR_fr'),LANGUAGES).locale,'fr-fr');
});
test('language provenance distinguishes exact, regional and unmatched browser preferences',()=>{
  assert.equal(languageSource('fr-fr',suggestLanguage(['fr-FR'],LANGUAGES)),'Detected from your browser.');
  assert.equal(languageSource('fr-fr',suggestLanguage(['fr-CA'],LANGUAGES)),'Suggested from your browser.');
  assert.equal(languageSource('en-us',suggestLanguage(['xx-ZZ'],LANGUAGES)),'A starting point. Change it if you like.');
});
test('chosen and saved languages are not relabelled as the browser suggestion',()=>{
  const browser=suggestLanguage(['fr-FR'],LANGUAGES);
  assert.equal(languageSource('it-it',browser),'Your chosen language.');
  assert.equal(languageSource('fr-fr',browser,true),'Your chosen language.');
  assert.equal(suggestLanguage(browserLanguages(['xx','it-IT'],'fr-FR'),LANGUAGES).locale,'it-it');
});

test('every supported locale has a bundled, script-free flag for its preset region',()=>{
  for(const locale of Object.keys(LANGUAGES)){
    const asset=localeFlag(locale);
    assert.match(asset,/^\.\/assets\/flags\/[a-z]{2}\.svg$/);
    const svg=readFileSync(new URL('../dist/'+asset,import.meta.url),'utf8');
    assert.match(svg,/<svg/);
    assert.doesNotMatch(svg,/<script|onload=|https?:\/\/[^"]+\.js/);
  }
  assert.equal(localeFlag('ca-es'),localeFlag('es-es'));
  assert.equal(localeFlag('kab-dz'),'./assets/flags/dz.svg');
  assert.equal(localeFlag('en-us'),'./assets/flags/us.svg');
  assert.equal(localeFlag('__proto__'),null);
});


test('speech result distinguishes unknown answers from hardware exclusions', () => {
  const cases = [
    [{device:'pi',piModel:'unknown'}, /Not sure which Pi/],
    [{device:'pi',piModel:'older'}, /Pi 5, Pi 500 or Compute Module 5/],
    [{device:'mac',cpu:'unknown'}, /Not sure which Mac/],
    [{device:'mac',cpu:'intel-mac'}, /Intel Mac/],
    [{memory:'under8'}, /less memory/],
    [{memory:'unknown'}, /Not sure how much memory/],
    [{cpu:'unknown'}, /processor type is still unknown/],
    [{device:'jetson',cpu:'unknown'}, /saved processor details need updating/],
    [{locale:'hi-in'}, /language/],
    [{device:'mark2'}, /Mycroft device/],
    [{experience:'hub'}, /devices in your rooms/],
  ];
  for (const [change,message] of cases) {
    const state=Object.freeze({...capable,...change,speech:'auto'});
    assert.equal(speechEligibility(state).eligible,false);
    assert.equal(state.speech,'auto','a recommendation must not accept a choice');
  }
});

test('Pi and Jetson memory results explain the answered question before an unasked CPU question', () => {
  for (const device of ['pi','jetson']) {
    for (const memory of ['under8','unknown']) {
      const state={...DEFAULTS,device,piModel:'pi5',memory,cpu:'unknown'};
      assert.equal(speechEligibility(state).code,'memory');
    }
  }
  assert.equal(speechEligibility({...DEFAULTS,device:'mac',cpu:'intel-mac'}).code,'mac');
  assert.equal(speechEligibility({...DEFAULTS,device:'pi',piModel:'older'}).code,'pi');
});

test('eligible result stays provisional and never claims a device scan', () => {
  for (const change of [{},{device:'pi',piModel:'pi5',cpu:'arm64'},{device:'mac',cpu:'arm64'},{device:'jetson',cpu:'arm64'}]) {
    const state=Object.freeze({...capable,...change,speech:'auto'});
    assert.equal(speechEligibility(state).code,'eligible');
    assert.equal(state.speech,'auto');
  }
});

test('unavailable speech choices explain the limiting detail and stay closed until eligible',()=>{
  const cases=[
    [{device:'pi',piModel:'pi5',cpu:'arm64',memory:'under8'},'Requires at least 8 GB of RAM.'],
    [{device:'pi',piModel:'pi5',cpu:'arm64',memory:'unknown'},'Confirm your device’s memory to use on-device speech.'],
    [{device:'pi',piModel:'older'},'Requires a Raspberry Pi 5, Pi 500 or Compute Module 5.'],
    [{device:'pi',piModel:'unknown'},'Confirm your Pi model to use on-device speech.'],
    [{device:'mac',cpu:'intel-mac'},'Requires an Apple Silicon Mac.'],
    [{device:'mac',cpu:'unknown'},'Confirm your Mac’s processor to use on-device speech.'],
    [{cpu:'unknown'},'Confirm a compatible processor to use on-device speech.'],
    [{device:'mark2'},'On-device speech is not supported for this hardware in this version.'],
    [{locale:'hi-in'},'On-device speech is not supported for your language in this version.'],
  ];
  for(const [details,description] of cases){
    assert.deepEqual(localSpeechOption({...capable,...details}),{disabled:true,description});
  }
  const allowed=localSpeechOption(capable);
  assert.equal(allowed.disabled,false);
  assert.match(allowed.description,/online backup/);
  const lowMemory={...capable,memory:'under8'};
  assert.equal(localSpeechOption(lowMemory).disabled,true);
  assert.equal(localSpeechOption({...lowMemory,memory:'8plus'}).disabled,false);
});
