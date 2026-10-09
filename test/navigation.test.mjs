import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as scenario from '../dist/scenario.mjs';
import * as flow from '../dist/flow.mjs';
import * as journey from '../dist/journey.mjs';
import * as short from '../dist/short-setup.mjs';
import * as draft from '../dist/draft.mjs';
import * as recommendations from '../dist/recommendations.mjs';
import {InstallTracker,INSTALLED_STATES} from '../dist/install-progress.mjs';
import {PrerequisiteGate} from '../dist/prerequisites.mjs';
import {RECIPE_QUESTIONS} from '../dist/journey.mjs';
const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
/** Extract production navigation functions for boundary-level regression tests. @param {string} name Function. @returns {string} Source. */
function declaration(name){const match=source.match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`,'m'));assert.ok(match,name);return match[0];}
/** Model browser storage and native history, using real production transition functions. @param {object} options Optional installed-review disclosure. @returns {object} Harness. */
function harness({installOptions=null}={}){
 const values=new Map(),entries=[{state:null,url:'/'}];let cursor=0,context,navigationSequence=0,renders=0;
 const location={pathname:'/',hash:''};
 const main={inert:false,setAttribute(){},removeAttribute(){}},notice={};
 const history={get state(){return entries[cursor].state;},pushState(value,unused,url){entries.splice(cursor+1);entries.push({state:value,url});cursor++;location.hash=url.includes('#')?url.slice(url.indexOf('#')):'';},replaceState(value,unused,url){entries[cursor]={state:value,url};location.hash=url.includes('#')?url.slice(url.indexOf('#')):'';},back(){if(cursor>0){cursor--;location.hash=entries[cursor].url.includes('#')?entries[cursor].url.slice(entries[cursor].url.indexOf('#')):'';return context.restoreRoute();}},forward(){if(cursor+1<entries.length){cursor++;location.hash=entries[cursor].url.includes('#')?entries[cursor].url.slice(entries[cursor].url.indexOf('#')):'';return context.restoreRoute();}}};
 const initial={...scenario.DEFAULTS};
 context=vm.createContext({installTracker:new InstallTracker({schedule:()=>0,cancel(){}}),prerequisiteGate:new PrerequisiteGate(),INSTALLED_STATES,trackingShown:false,progressSignature:'',expiryTimer:null,clearTimeout(){},...scenario,...flow,...journey,...short,...draft,...recommendations,RECIPE_QUESTIONS,
  state:initial,confirmedState:{...initial},setupSession:null,step:'welcome',answered:new Set(),telemetrySelection:scenario.DEFAULTS.telemetry,skillsAnswered:false,preparedFor:null,editing:false,editSnapshot:null,editAnswered:[],editSkillsAnswered:false,editPreparedFor:null,
  navigationId:'test-session',routes:[],routeCursor:-1,browserBaseCursor:0,trail:[],devicePane:'cards',unlistedDevice:false,platformUnsure:false,detailsOpen:false,welcomeHeard:false,languageChooserOpen:false,localeRequest:0,
  history,location,crypto:{randomUUID:()=> 'restored-session-'+(++navigationSequence)},languageSuggestion:{locale:'en-us'},triviaStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
  document:{querySelector:s=>s==='main'?main:s==='#notice'?notice:s==='.install-options'?installOptions:null},cancelTransition(){},toast(){},loadLocale:async()=>{},render(){renders++;context.localeRequest++;context.saveJourney();}});
 vm.runInContext(['currentRoute','saveJourney','recordRoute','showDevicePane','restoreRoute','go','finish','confirmTelemetry','continueToInstall','complete','acceptDevice','answer','back','reviewPrerequisites','editQuestion','cancelEdit','returnToWelcome','restartWizard','restore','persist'].map(declaration).join('\n'),context);
 context.recordRoute(true);
 return {c:context,history,location,values,entries,get cursor(){return cursor;},get renders(){return renders;}};
}
/** Reach the diagnostics decision using actual answers. @param {object} h Harness. @returns {void} */
function piTelemetry(h){const c=h.c;c.go('language');c.complete('');assert.equal(c.step,'device');c.acceptDevice('pi');assert.equal(c.step,'prepare');c.preparedFor='pi';c.answered.add('prepare');c.go(journey.nextQuestion('prepare',c.state));c.answer('piModel','pi5');c.answer('memory','8plus');c.answer('speech','public');assert.equal(c.step,'telemetry');}
/** Review a Pi recipe after the explicit diagnostics decision. @param {object} h Harness. @param {boolean} telemetry Choice. @returns {void} */
function piReview(h,telemetry=scenario.DEFAULTS.telemetry){piTelemetry(h);h.c.telemetrySelection=telemetry;h.c.confirmTelemetry();assert.equal(h.c.step,'review');}
/** Acknowledge preparation without accepting the separate Continue action. @param {object} h Harness. @returns {void} */
function acknowledgePrerequisites(h){h.c.prerequisiteGate.selectDevice(h.c.state.device,h.c.state.cpu);h.c.prerequisiteGate.selectFamily('debian');h.c.prerequisiteGate.confirm(true);}
/** Check diagnostics survives both executable recipe formats with usage sharing disabled. @param {object} h Harness. @param {boolean} telemetry Choice. @returns {void} */
function assertDiagnosticsRecipe(h,telemetry){
 assert.equal(h.c.state.telemetry,telemetry);assert.equal(h.c.setupSession.state.telemetry,telemetry);
 const decoded=short.readSetupSession('#setup='+h.c.setupSession.code);
 assert.equal(decoded.state.telemetry,telemetry);assert.equal(decoded.state.channel,'alpha');
 for(const state of [h.c.state,decoded.state]){
  assert.match(scenario.buildYaml(state),new RegExp(`^share_telemetry: ${telemetry}$`,'m'));
  assert.match(scenario.buildYaml(state),/^share_usage_telemetry: false$/m);
 }
}


test('recommended path reaches review without optional integration or style decisions',()=>{const h=harness();piReview(h);assert.equal(h.c.state.homeassistant,false);assert.equal(h.c.state.llmMode,'off');assert.equal(h.c.state.skills,true);assert.equal(h.c.answered.has('guidance'),false);assert.equal(h.c.answered.has('homeassistant'),false);});
test('diagnostics is checked by default but requires Continue before issuing a recipe',()=>{
 const h=harness();piTelemetry(h);
 assert.equal(h.c.telemetrySelection,true);assert.equal(h.c.state.telemetry,true);
 assert.equal(h.c.answered.has('telemetry'),false);assert.equal(h.c.setupSession,null);
 h.c.confirmTelemetry();assert.equal(h.c.step,'review');assert.equal(h.c.answered.has('telemetry'),true);
 assertDiagnosticsRecipe(h,true);
});

test('continuing with diagnostics unchecked produces an opted-out YAML and compact recipe',()=>{
 const h=harness();piTelemetry(h);h.c.telemetrySelection=false;
 assert.equal(h.c.state.telemetry,true,'The toggle remains pending until Continue');
 assert.equal(h.c.answered.has('telemetry'),false);assert.equal(h.c.setupSession,null);
 h.c.confirmTelemetry();assert.equal(h.c.step,'review');assert.equal(h.c.answered.has('telemetry'),true);
 assertDiagnosticsRecipe(h,false);
 const issued=h.c.setupSession;h.c.confirmTelemetry();assert.equal(h.c.setupSession,issued,'An unchanged confirmation keeps its deadline');
});

test('an unfinished toggle choice is not consent and is discarded on reload or Back',async()=>{
 const h=harness();piTelemetry(h);h.c.telemetrySelection=false;h.c.saveJourney();
 const saved=draft.readDraft(h.c.triviaStorage);
 assert.equal(saved.state.telemetry,true);assert.equal(saved.answered.includes('telemetry'),false);assert.equal(saved.issuedFragment,'');
 await h.c.restore();assert.equal(h.c.step,'telemetry');assert.equal(h.c.telemetrySelection,true);
 assert.equal(h.c.answered.has('telemetry'),false);assert.equal(h.c.setupSession,null);
 h.c.telemetrySelection=false;await h.history.back();assert.equal(h.c.step,'speech');
 await h.history.forward();assert.equal(h.c.step,'telemetry');assert.equal(h.c.telemetrySelection,true);
 assert.equal(h.c.state.telemetry,true);assert.equal(h.c.answered.has('telemetry'),false);assert.equal(h.c.setupSession,null);
});

test('accepted diagnostics choices survive reload, cancelled edits and browser Back without pending changes leaking',async()=>{
 for(const telemetry of [true,false]){
  const h=harness();piReview(h,telemetry);const original=h.c.setupSession;
  h.c.editQuestion('telemetry');assert.equal(h.c.telemetrySelection,telemetry);
  h.c.telemetrySelection=!telemetry;h.c.saveJourney();await h.c.restore();
  assert.equal(h.c.step,'telemetry');assert.equal(h.c.editing,true);assert.equal(h.c.telemetrySelection,telemetry);
  assert.equal(h.c.state.telemetry,telemetry);assert.equal(h.c.setupSession.code,original.code);
  h.c.telemetrySelection=!telemetry;h.c.cancelEdit();
  assert.equal(h.c.step,'review');assert.equal(h.c.state.telemetry,telemetry);assert.equal(h.c.answered.has('telemetry'),true);
  assert.equal(h.c.setupSession.code,original.code);assertDiagnosticsRecipe(h,telemetry);
  h.c.editQuestion('telemetry');assert.equal(h.c.telemetrySelection,telemetry);h.c.telemetrySelection=!telemetry;
  await h.history.back();assert.equal(h.c.step,'review');assert.equal(h.c.state.telemetry,telemetry);
  await h.history.forward();assert.equal(h.c.step,'telemetry');assert.equal(h.c.telemetrySelection,telemetry);
  h.c.telemetrySelection=!telemetry;h.c.confirmTelemetry();
  assert.equal(h.c.editing,false);assert.notEqual(h.c.setupSession.code,original.code);assertDiagnosticsRecipe(h,!telemetry);
 }
});

test('imported compact and legacy recipes preserve choices but require a fresh diagnostics Continue',async()=>{
 for(const format of ['compact','preset'])for(const telemetry of [true,false]){
  const h=harness(),state={...scenario.selectDevice(scenario.DEFAULTS,'pi'),channel:'testing',telemetry};
  const shared=short.issueSetup(state),fragment=format==='compact'?'#setup='+shared.code:'#'+scenario.encodePreset(state);
  h.history.replaceState(null,'','/'+fragment);await h.c.restore();const original=h.c.setupSession;
  assert.equal(h.c.step,'review');assert.deepEqual({...h.c.state},state);assert.equal(h.c.setupSession.code,format==='compact'?shared.code:null);
  assert.equal(h.c.answered.has('telemetry'),false);assert.equal(h.c.telemetrySelection,telemetry);
  h.c.continueToInstall();assert.equal(h.c.step,'review');assert.equal(h.c.prerequisiteGate.ready('pi'),false);
  acknowledgePrerequisites(h);h.c.continueToInstall();
  assert.equal(h.c.step,'telemetry');assert.equal(h.c.telemetrySelection,telemetry);assert.equal(h.c.prerequisiteGate.ready('pi'),true);
  assert.equal(h.c.answered.has('telemetry'),false);assert.equal(h.c.setupSession,original);
  h.c.telemetrySelection=!telemetry;h.c.confirmTelemetry();
  assert.equal(h.c.step,'review');assert.equal(h.c.answered.has('telemetry'),true);assert.notEqual(h.c.setupSession.code,original.code);
  assertDiagnosticsRecipe(h,!telemetry);assert.equal(h.location.hash,'#setup='+h.c.setupSession.code);
 }
});

test('confirming an unchanged imported choice grants this journey acknowledgement without extending its recipe',async()=>{
 for(const telemetry of [true,false]){
  const h=harness(),shared=short.issueSetup({...scenario.selectDevice(scenario.DEFAULTS,'pi'),telemetry},Math.floor(Date.now()/1000)-120);
  h.history.replaceState(null,'','/#setup='+shared.code);await h.c.restore();
  acknowledgePrerequisites(h);h.c.continueToInstall();assert.equal(h.c.step,'telemetry');
  assert.equal(h.c.answered.has('telemetry'),false);assert.equal(h.c.telemetrySelection,telemetry);
  h.c.confirmTelemetry();assert.equal(h.c.answered.has('telemetry'),true);assert.equal(h.c.setupSession.code,shared.code);
  assert.equal(h.c.setupSession.expiresAt,shared.expiresAt);assertDiagnosticsRecipe(h,telemetry);
 }
});

test('hidden release-picker actions are ignored and finishing a legacy Testing setup always issues Alpha',()=>{
 const h=harness();piReview(h);const original=h.c.setupSession,route=h.c.routeCursor;
 h.c.editQuestion('channel');assert.equal(h.c.step,'review');assert.equal(h.c.editing,false);assert.equal(h.c.routeCursor,route);
 h.c.answer('channel','testing');assert.equal(h.c.state.channel,'alpha');assert.equal(h.c.setupSession,original);
 h.c.state={...h.c.state,channel:'testing'};h.c.setupSession=short.issueSetup(h.c.state);const legacy=h.c.setupSession;
 assert.equal(short.readSetupSession('#setup='+legacy.code).state.channel,'testing');
 h.c.finish();assert.equal(h.c.state.channel,'alpha');assert.notEqual(h.c.setupSession.code,legacy.code);
 assertDiagnosticsRecipe(h,true);
});

test('reload and both Back routes retain RAM choice, deliberate unknown and command deadline',async()=>{
 const h=harness();piReview(h);const code=h.c.setupSession.code;
 await h.history.back();assert.equal(h.c.step,'telemetry');await h.history.back();assert.equal(h.c.step,'speech');h.c.back();await Promise.resolve();assert.equal(h.c.step,'memory');assert.equal(h.c.state.memory,'8plus');assert.ok(h.c.answered.has('memory'));
 await h.c.restore();assert.equal(h.c.step,'memory');assert.equal(h.c.setupSession.code,code);assert.equal(h.c.state.memory,'8plus');
 h.c.answer('memory','unknown');await h.c.restore();assert.equal(h.c.step,'speech');assert.equal(h.c.state.memory,'unknown');assert.ok(h.c.answered.has('memory'));
});
test('review edits and cancellation preserve original code, skills provenance and preparation',()=>{
 const h=harness();piReview(h);const code=h.c.setupSession.code;
 h.c.editQuestion('device');h.c.acceptDevice('computer');h.c.preparedFor='computer';h.c.cancelEdit();
 assert.equal(h.c.state.device,'pi');assert.equal(h.c.preparedFor,'pi');assert.equal(h.c.skillsAnswered,false);assert.equal(h.c.setupSession.code,code);assert.equal(h.c.step,'review');
 h.c.editQuestion('guidance');h.c.answer('expertise','expert');assert.equal(h.c.state.skills,true);
});
test('restoring historical review keeps latest confirmed command and address bar consistent',async()=>{
 const h=harness();piReview(h);const first=h.c.setupSession.code;
 h.c.editQuestion('homeassistant');h.c.answer('homeassistant','yes');const second=h.c.setupSession.code;assert.notEqual(first,second);
 await h.history.back();await h.history.back();assert.equal(h.c.step,'review');assert.equal(h.c.state.homeassistant,true);assert.equal(h.location.hash,'#setup='+second);
});
test('old voice and locked setting routes normalize after incompatible choices change',async()=>{
 const h=harness();piReview(h);h.c.state=flow.chooseExperience(h.c.state,'hub');h.c.finish();
 const speechIndex=h.c.routes.findIndex(r=>r.step==='speech');h.history.replaceState({ovosWizard:{id:h.c.navigationId,cursor:speechIndex,base:0}},'','/');await h.c.restoreRoute();assert.equal(h.c.step,'review');
 const local={...scenario.selectDevice(scenario.DEFAULTS,'pi'),piModel:'pi5',memory:'8plus',cpu:'arm64',speech:'local',channel:'alpha'};
 for(const step of ['method','channel'])assert.equal(draft.normalizeRoute({step},local,true).step,'review');
});
test('a resumed draft rebuilds Back destinations when the tab has no session marker',async()=>{
 const h=harness();piReview(h);await h.history.back();await h.history.back();await h.history.back();assert.equal(h.c.step,'memory');
 h.history.replaceState(null,'','/');await h.c.restore();assert.equal(h.c.step,'memory');assert.equal(h.c.browserBaseCursor,0);h.c.back();await Promise.resolve();assert.equal(h.c.step,'piModel');
});
test('out-of-range stale markers fall back to the saved cursor without crashing',async()=>{
 const h=harness();h.c.go('language');h.history.replaceState({ovosWizard:{id:h.c.navigationId,cursor:999}},'','/');await h.c.restore();assert.equal(h.c.step,'language');assert.equal(h.c.routeCursor,1);
});
test('Home server remains reachable from default setup and includes preparation',()=>{
 const h=harness();h.c.go('device');h.c.acceptDevice('server');assert.equal(h.c.state.experience,'hub');assert.equal(h.c.step,'prepare');
 h.c.preparedFor='server';h.c.complete();assert.equal(h.c.step,'telemetry');assert.equal(h.c.setupSession,null);
 assert.equal(h.c.telemetrySelection,true);h.c.confirmTelemetry();assert.equal(h.c.step,'review');assertDiagnosticsRecipe(h,true);
});

test('header home cancels incomplete edits before replaying the greeting',()=>{
 const h=harness();piReview(h);const original=h.c.setupSession.code;
 h.c.editQuestion('device');h.c.acceptDevice('server');assert.equal(h.c.editing,true);
 h.c.returnToWelcome();assert.equal(h.c.step,'welcome');assert.equal(h.c.editing,false);assert.equal(h.c.state.device,'pi');assert.equal(h.c.preparedFor,'pi');assert.equal(h.c.setupSession.code,original);
 h.c.go('language');h.c.complete('');assert.equal(h.c.step,'device');
});

/** Model a real completed prior attempt without relying on a wall-clock delay. @param {string} status Confirmed completion. @returns {object} */
function completedJourney(status='installed'){
 const h=harness();h.c.issueSetup=state=>short.issueSetup(state,Math.floor(Date.now()/1000)-120);piReview(h);h.c.issueSetup=short.issueSetup;
 h.c.installTracker.code=h.c.setupSession.code;h.c.installTracker.session={status};
 h.c.prerequisiteGate.selectDevice('pi');h.c.prerequisiteGate.selectFamily('debian');h.c.prerequisiteGate.confirm(true);h.c.prerequisiteGate.accept('pi');
 return h;
}

test('each completed status can start another full journey with the same choices and a distinct code',()=>{
 for(const status of INSTALLED_STATES){
  const h=completedJourney(status),old=h.c.setupSession,previousUrl=h.entries[h.cursor].url;
  h.c.state.homeassistant=true; // An unfinished edit cannot replace the completed recipe.
  h.c.editing=true;h.c.editSnapshot={...old.state};h.c.trackingShown=true;h.c.progressSignature='old';
  h.c.restartWizard();const fresh=h.c.setupSession;
  assert.notEqual(fresh.code,old.code);assert.deepEqual(fresh.state,old.state);assert.equal(fresh.expiresAt-fresh.issuedAt,3600);
  assert.equal(h.c.step,'language');assert.equal(h.c.editing,false);assert.equal(h.c.editSnapshot,null);assert.equal(h.c.preparedFor,null);assert.equal(h.c.answered.size,0);
  assert.equal(h.c.prerequisiteGate.ready('pi'),false);assert.equal(h.c.installTracker.session,null);assert.equal(h.c.installTracker.code,null);assert.equal(h.c.trackingShown,false);
  assert.equal(h.entries[h.cursor-1].url,previousUrl);assert.equal(h.location.hash,'#setup='+fresh.code);
  piReview(h);assert.equal(h.c.setupSession.code,fresh.code);assert.notEqual(h.c.setupSession.code,old.code);
 }
});

test('reinstall resets old Testing and opt-out choices to Alpha with diagnostics enabled and unacknowledged',async()=>{
 const h=completedJourney();
 const old=short.issueSetup({...h.c.setupSession.state,channel:'testing',telemetry:false},Math.floor(Date.now()/1000)-120);
 h.c.state={...old.state};h.c.confirmedState={...old.state};h.c.setupSession=old;h.c.installTracker.code=old.code;
 h.c.recordRoute(true);h.c.restartWizard();const fresh=h.c.setupSession;
 assert.deepEqual({...fresh.state},{...old.state,channel:'alpha',telemetry:true});
 assert.equal(h.c.telemetrySelection,true);assert.equal(h.c.answered.has('telemetry'),false);assert.equal(h.c.prerequisiteGate.ready('pi'),false);
 assert.equal(old.state.telemetry,false);assert.equal(old.state.channel,'testing');
 await h.c.restore();assert.equal(h.c.state.telemetry,true);assert.equal(h.c.answered.has('telemetry'),false);
 await h.history.back();assert.equal(h.c.setupSession.code,old.code);assert.equal(h.c.state.telemetry,false);assert.equal(h.c.state.channel,'testing');
 assert.equal(h.c.answered.has('telemetry'),false,'Reopening the prior link does not import its acknowledgement');
 await h.history.forward();assert.equal(h.c.setupSession.code,fresh.code);assert.equal(h.c.state.telemetry,true);
 acknowledgePrerequisites(h);h.c.continueToInstall();assert.equal(h.c.step,'telemetry');
 assert.equal(h.c.telemetrySelection,true);assert.equal(h.c.answered.has('telemetry'),false);
 h.c.telemetrySelection=false;h.c.confirmTelemetry();assertDiagnosticsRecipe(h,false);
});

test('restarted journey survives reload and preserves the old result through browser Back',async()=>{
 const h=completedJourney(),old=h.c.setupSession;h.c.restartWizard();const fresh=h.c.setupSession;
 await h.c.restore();assert.equal(h.c.step,'language');assert.equal(h.c.setupSession.code,fresh.code);
 await h.history.back();assert.equal(h.c.step,'review');assert.equal(h.c.setupSession.code,old.code);
 await h.history.forward();assert.equal(h.c.setupSession.code,fresh.code);assert.notEqual(h.c.setupSession.code,old.code);
});

test('restart excludes active/unrelated attempts and never invents a future timestamp for a collision',()=>{
 for(const status of ['waiting','started','downloading','installing','failed','cancelled']){
  const h=completedJourney(status),old=h.c.setupSession,entry=h.cursor;h.c.restartWizard();assert.equal(h.c.setupSession,old);assert.equal(h.cursor,entry);
 }
 for(const reason of ['unrelated','collision','clock']){
  const h=completedJourney(),old=h.c.setupSession,entry=h.cursor;
  if(reason==='unrelated')h.c.installTracker.code='different';
  if(reason==='collision')h.c.issueSetup=()=>old;
  if(reason==='clock')h.c.setupStatus=()=>({kind:'clock'});
  h.c.restartWizard();assert.equal(h.c.setupSession,old);assert.equal(h.cursor,entry);assert.equal(h.c.step,'review');
 }
});

test('home link after installation also detaches completion before replaying the greeting',()=>{
 const h=completedJourney(),old=h.c.setupSession;h.c.returnToWelcome();assert.equal(h.c.step,'welcome');assert.notEqual(h.c.setupSession.code,old.code);
 piReview(h);assert.notEqual(h.c.setupSession.code,old.code);
});

test('another shared setup link for the same device requires a fresh prerequisite acknowledgement',async()=>{
 const h=harness();piReview(h);const original=h.c.setupSession;
 h.c.prerequisiteGate.selectDevice('pi');h.c.prerequisiteGate.selectFamily('debian');h.c.prerequisiteGate.confirm(true);h.c.prerequisiteGate.accept('pi');
 await h.c.restore();assert.equal(h.c.prerequisiteGate.ready('pi'),true);
 const other=short.issueSetup({...original.state,telemetry:!original.state.telemetry});
 h.history.pushState(null,'','/#setup='+other.code);await h.c.restore();
 assert.equal(h.c.setupSession.code,other.code);assert.equal(h.c.state.device,'pi');assert.equal(h.c.prerequisiteGate.ready('pi'),false);
});


/** Restore a shared recipe with no prior question trail. @param {object} h Harness. @returns {Promise<object>} Shared recipe. */
async function sharedReview(h){
 const shared=short.issueSetup({...scenario.selectDevice(scenario.DEFAULTS,'pi'),locale:'fr-fr',piModel:'pi5',memory:'8plus',cpu:'arm64',speech:'public',skills:false,homeassistant:true,llmMode:'online'});
 h.history.replaceState(null,'','/#setup='+shared.code);await h.c.restore();
 assert.equal(h.c.step,'review');assert.equal(h.c.trail.length,0);assert.equal(h.c.routeCursor,h.c.browserBaseCursor);
 return shared;
}

test('shared setup Edit setup opens and closes the full overview without starting an edit or changing the recipe',async()=>{
 const h=harness(),shared=await sharedReview(h),entry=h.cursor,route=h.c.routeCursor,renders=h.renders;
 assert.equal(h.c.prerequisiteGate.ready('pi'),false);assert.equal(h.c.detailsOpen,false);
 assert.doesNotThrow(()=>h.c.back());
 assert.equal(h.c.detailsOpen,true);assert.equal(h.renders,renders+1);assert.equal(h.c.step,'review');
 assert.equal(h.c.editing,false);assert.equal(h.c.editSnapshot,null);assert.deepEqual({...h.c.state},shared.state);
 assert.equal(h.c.setupSession.code,shared.code);assert.equal(h.location.hash,'#setup='+shared.code);
 assert.equal(h.cursor,entry);assert.equal(h.c.routeCursor,route);assert.equal(h.c.prerequisiteGate.ready('pi'),false);
 h.c.back();assert.equal(h.c.detailsOpen,false);assert.equal(h.renders,renders+2);assert.equal(h.c.step,'review');
 assert.equal(h.c.editing,false);assert.equal(h.c.editSnapshot,null);assert.deepEqual({...h.c.state},shared.state);assert.equal(h.cursor,entry);
});

test('setup overview Continue returns to prerequisites and clears an unaccepted acknowledgement',async()=>{
 const h=harness(),shared=await sharedReview(h);
 h.c.prerequisiteGate.selectDevice('pi');h.c.prerequisiteGate.selectFamily('debian');h.c.prerequisiteGate.confirm(true);
 assert.equal(h.c.prerequisiteGate.canContinue('pi'),true);assert.equal(h.c.prerequisiteGate.ready('pi'),false);
 h.c.back();assert.equal(h.c.detailsOpen,true);const renders=h.renders;
 h.c.reviewPrerequisites();assert.equal(h.c.detailsOpen,false);assert.equal(h.renders,renders+1);assert.equal(h.c.step,'review');
 assert.equal(h.c.prerequisiteGate.confirmed,false);assert.equal(h.c.prerequisiteGate.ready('pi'),false);
 assert.equal(h.c.editing,false);assert.equal(h.c.editSnapshot,null);assert.equal(h.c.setupSession.code,shared.code);assert.deepEqual({...h.c.state},shared.state);
});

test('full setup overview can edit an integration while preserving every unrelated saved choice',async()=>{
 const h=harness(),shared=await sharedReview(h);
 h.c.back();h.c.editQuestion('homeassistant');
 assert.equal(h.c.step,'homeassistant');assert.equal(h.c.editing,true);assert.deepEqual({...h.c.editSnapshot},shared.state);
 h.c.answer('homeassistant','no');
 assert.equal(h.c.step,'review');assert.equal(h.c.editing,false);assert.deepEqual({...h.c.state},{...shared.state,homeassistant:false});
 assert.notEqual(h.c.setupSession.code,shared.code);assert.equal(h.location.hash,'#setup='+h.c.setupSession.code);assert.equal(h.c.prerequisiteGate.ready('pi'),false);
});

test('cancelling a language edit from the full overview restores the exact recipe and reopens its overview',async()=>{
 const h=harness(),shared=await sharedReview(h),answered=[...h.c.answered];
 h.c.back();h.c.editQuestion('language');assert.equal(h.c.editing,true);assert.deepEqual({...h.c.editSnapshot},shared.state);
 h.c.state={...h.c.state,locale:'de-de'}; // Language selection is previewed before its explicit Continue action.
 h.c.cancelEdit();
 assert.equal(h.c.step,'review');assert.equal(h.c.detailsOpen,true);assert.equal(h.c.editing,false);assert.equal(h.c.editSnapshot,null);
 assert.deepEqual({...h.c.state},shared.state);assert.deepEqual([...h.c.answered],answered);assert.equal(h.c.skillsAnswered,true);assert.equal(h.c.preparedFor,'pi');
 assert.equal(h.c.setupSession.code,shared.code);assert.equal(h.location.hash,'#setup='+shared.code);assert.equal(h.c.prerequisiteGate.ready('pi'),false);
});

test('targeted edits from the full overview survive reload and preserve their baseline through browser history',async()=>{
 const h=harness(),shared=await sharedReview(h);
 h.c.back();h.c.editQuestion('llm');await h.c.restore();
 assert.equal(h.c.step,'llm');assert.equal(h.c.editing,true);assert.deepEqual({...h.c.editSnapshot},shared.state);
 await h.history.back();assert.equal(h.c.step,'review');assert.equal(h.c.editing,false);assert.deepEqual({...h.c.state},shared.state);
 assert.equal(h.c.setupSession.code,shared.code);assert.equal(h.location.hash,'#setup='+shared.code);
 await h.history.forward();assert.equal(h.c.step,'llm');assert.equal(h.c.editing,true);assert.deepEqual({...h.c.editSnapshot},shared.state);
 h.c.answer('llmMode','off');const revised=h.c.setupSession.code;assert.notEqual(revised,shared.code);
 await h.history.back();await h.history.back();assert.equal(h.c.step,'review');assert.equal(h.c.state.llmMode,'off');assert.equal(h.c.setupSession.code,revised);assert.equal(h.location.hash,'#setup='+revised);
});

test('accepted shared setup Edit setup still opens and focuses the install options disclosure',async()=>{
 let focused=false,scrolled=false;
 const panel={open:false,querySelector:selector=>{assert.equal(selector,'summary');return {focus(){focused=true;}};},scrollIntoView(){scrolled=true;}};
 const h=harness({installOptions:panel}),shared=await sharedReview(h);
 h.c.prerequisiteGate.selectDevice('pi');h.c.prerequisiteGate.selectFamily('debian');h.c.prerequisiteGate.confirm(true);assert.equal(h.c.prerequisiteGate.accept('pi'),true);
 const renders=h.renders;h.c.back();
 assert.equal(panel.open,true);assert.equal(focused,true);assert.equal(scrolled,true);assert.equal(h.c.detailsOpen,true);assert.equal(h.renders,renders);
 assert.equal(h.c.step,'review');assert.equal(h.c.editing,false);assert.equal(h.c.setupSession.code,shared.code);
});
