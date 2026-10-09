import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise production functions with only network and DOM boundaries mocked.
const appUrl=new URL('../dist/app.mjs',import.meta.url);
const source=readFileSync(appUrl,'utf8');
const {DEFAULTS,LANGUAGES,selectDevice}=await import(new URL('./scenario.mjs',appUrl));
const {PrerequisiteGate}=await import(new URL('./prerequisites.mjs',appUrl));
const {RECIPE_QUESTIONS}=await import(new URL('./journey.mjs',appUrl));
const {issueSetup,readSetupSession}=await import(new URL('./short-setup.mjs',appUrl));

/** Read an actual top-level declaration, failing visibly if its layout changes.
 * @param {string} name Declaration name. @returns {string} Production source.
 */
function declaration(name){
  const match=source.match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`,'m'));
  assert.ok(match,`Missing production declaration: ${name}`);
  return match[0];
}

/** Build the small DOM surface needed by loading, navigation and render.
 * @returns {object} Attribute and focus capable node.
 */
function element(){
  const attrs=new Map();
  return {attrs,inert:false,hidden:false,disabled:false,value:'',textContent:'',focused:false,
    setAttribute(name,value){attrs.set(name,value);},
    removeAttribute(name){attrs.delete(name);},
    getAttribute(name){return attrs.get(name)??null;},
    focus(){this.focused=true;}};
}

/** Build a valid recipe with an identifiable locale and device.
 * @param {string} locale Locale. @param {string} device Device. @returns {object} Recipe.
 */
function recipe(locale='en-us',device='pi'){return selectDevice({...DEFAULTS,locale},device);}

/** Run production loading and render functions with a controllable network boundary.
 * @param {object} options Initial state. @returns {object} Context and observations.
 */
function harness({state=recipe(),step='language',suggestedLocale='en-us'}={}){
  const main=element(),notice=element(),workbench={dataset:{}},loads=[],renders=[],toasts=[];
  let context,ui;
  const rebuild=()=>{ui={confirm:element(),panel:element(),select:element(),language:element(),flag:element()};ui.select.value=context?.state.locale||state.locale;};
  rebuild();
  const wizard={
    querySelector(selector){
      if(context.step!=='language')return null;
      return {'[data-confirm-language]':ui.confirm,'.language-simple':ui.panel,'[data-language-select]':ui.select,'.current-language strong':ui.language,'.language-globe img':ui.flag}[selector]??null;
    },
    set innerHTML(value){
      renders.push({html:value,state:{...context.state},step:context.step,session:context.setupSession});
      rebuild();
    }
  };
  context=vm.createContext({prerequisiteGate:new PrerequisiteGate(),
    DEFAULTS,LANGUAGES,RECIPE_QUESTIONS,readSetupSession,readDraft:()=>null,canResumeDraft:()=>false,ownsDraftHistory:()=>false,localeFlag:()=>'',triviaStorage:null,history:{state:null},crypto:{randomUUID:()=> 'test-session'},navigationId:'test-session',routes:[],routeCursor:-1,browserBaseCursor:0,preparedFor:null,editAnswered:[],editSkillsAnswered:false,editPreparedFor:null,
    installTracker:{stop(){},connect:async()=>null},updateInstallProgress(){},trackingShown:false,progressSignature:"",state:{...state},confirmedState:{...state},step,setupSession:null,manualCopyFor:null,
    languageSuggestion:{locale:suggestedLocale},localeRequest:0,languageChooserOpen:true,
    answered:new Set(),trail:[],editing:false,editSnapshot:null,skillsAnswered:false,
    detailsOpen:false,devicePane:'cards',platformUnsure:false,welcomeHeard:false,
    stopWelcomeEyes:null,stopMotionListener:null,welcomePlayback:null,replayWelcome:null,currentFact:{},
    wizard,location:{hash:''},window:{scrollTo(){}},choiceInput:{nextScreen(){}},
    document:{querySelector(selector){return {main,'#notice':notice,'.workbench':workbench}[selector];}},
    loadLocale(locale){
      let resolve,reject;
      const promise=new Promise((accept,fail)=>{resolve=accept;reject=fail;});
      loads.push({locale,resolve,reject});return promise;
    },
    recordRoute(){},saveJourney(){},cancelTransition(){},drawTrivia(){},renderSteps(){},updateExpiry(){},localize(){},
    mountWelcome(){},focusCurrentChoice(){},projectTriviaView(){return '';},
    toast(message){toasts.push(message);},
    speechEligibility(){return {eligible:true};},
  });
  for(const name of ['welcomeView','languageView','guidanceView','experienceView','deviceView',
    'preparationView','speechView','speechResultView','skillsView','homeAssistantView','aiView','resultView',
    'capabilityView','tweakView'])context[name]=()=>`${context.step}:${context.state.locale}`;
  vm.runInContext(['render','go','selectLanguage','restore'].map(declaration).join('\n\n'),context,{filename:appUrl.pathname});
  return {context,main,notice,loads,renders,toasts,get ui(){return ui;}};
}

test('pending language selection blocks Continue until the selected locale is committed',async()=>{
  const h=harness(),pending=h.context.selectLanguage('fr-fr');
  assert.equal(h.ui.confirm.disabled,true);
  assert.equal(h.ui.panel.getAttribute('aria-busy'),'true');
  assert.equal(h.context.state.locale,'en-us');
  assert.equal(h.renders.length,0);
  h.loads[0].resolve();await pending;
  assert.equal(h.context.state.locale,'fr-fr');
  assert.equal(h.context.languageChooserOpen,true);
  assert.equal(h.renders.length,0);
  assert.equal(h.ui.confirm.disabled,false);
  assert.equal(h.ui.confirm.focused,false);
  assert.equal(h.ui.panel.getAttribute('aria-busy'),null);
});

test('failed selection restores its control, leaves the recipe intact and can retry',async()=>{
  const h=harness();h.ui.select.value='fr-fr';
  const first=h.context.selectLanguage('fr-fr');
  h.loads[0].reject(new Error('offline'));await first;
  assert.equal(h.context.state.locale,'en-us');
  assert.equal(h.ui.select.value,'en-us');
  assert.equal(h.ui.confirm.disabled,false);
  assert.equal(h.ui.panel.getAttribute('aria-busy'),null);
  assert.deepEqual(h.toasts,['Couldn’t load this language. Please try again.']);
  const retry=h.context.selectLanguage('fr-fr');
  assert.equal(h.ui.confirm.disabled,true);
  h.loads[1].resolve();await retry;
  assert.equal(h.context.state.locale,'fr-fr');
  assert.equal(h.renders.length,0);
});

test('an older selection cannot commit or unlock a newer pending selection',async()=>{
  const h=harness(),older=h.context.selectLanguage('fr-fr'),newer=h.context.selectLanguage('de-de');
  h.loads[0].resolve();await older;
  assert.equal(h.context.state.locale,'en-us');
  assert.equal(h.renders.length,0);
  assert.equal(h.ui.confirm.disabled,true);
  assert.equal(h.ui.panel.getAttribute('aria-busy'),'true');
  h.loads[1].resolve();await newer;
  assert.equal(h.context.state.locale,'de-de');
  assert.equal(h.renders.length,0);
});

test('a late selection failure does not reset or notify over the latest successful selection',async()=>{
  const h=harness(),older=h.context.selectLanguage('fr-fr'),newer=h.context.selectLanguage('de-de');
  h.loads[1].resolve();await newer;
  h.loads[0].reject(new Error('old request failed'));await older;
  assert.equal(h.context.state.locale,'de-de');
  assert.equal(h.ui.select.value,'de-de');
  assert.equal(h.ui.confirm.disabled,false);
  assert.deepEqual(h.toasts,[]);
  assert.equal(h.renders.length,0);
});

test('navigation invalidates a pending selection without returning to the language screen',async()=>{
  const h=harness(),pending=h.context.selectLanguage('fr-fr');
  h.context.go('guidance');
  h.loads[0].resolve();await pending;
  assert.equal(h.context.step,'guidance');
  assert.equal(h.context.state.locale,'en-us');
  assert.equal(h.renders.length,1);
});

test('restoring a link supersedes a pending language selection across both workflows',async()=>{
  const h=harness(),selection=h.context.selectLanguage('fr-fr'),session=issueSetup(recipe('de-de','server'));
  h.context.location.hash='#setup='+session.code;const restoration=h.context.restore();
  h.loads[1].resolve();await restoration;
  h.loads[0].resolve();await selection;
  assert.equal(h.context.step,'review');assert.equal(h.context.state.locale,'de-de');
  assert.equal(h.context.state.device,'server');assert.equal(h.context.setupSession.code,session.code);
  assert.equal(h.main.inert,false);assert.equal(h.renders.length,1);
});

test('restore keeps the old recipe intact and inert until a complete replacement is ready',async()=>{
  const h=harness({step:'review'}),oldSession=issueSetup(recipe()),nextSession=issueSetup(recipe('fr-fr','devkit'));
  h.context.setupSession=oldSession;
  h.context.editing=true;h.context.editSnapshot=recipe();h.context.trail=[{step:'device'}];
  h.context.location.hash='#setup='+nextSession.code;
  const pending=h.context.restore();
  assert.equal(h.main.inert,true);
  assert.equal(h.main.getAttribute('aria-busy'),'true');
  assert.equal(h.context.setupSession,oldSession);
  assert.equal(h.context.state.device,'pi');
  assert.equal(h.context.state.locale,'en-us');
  assert.equal(h.renders.length,0);
  h.loads[0].resolve();await pending;
  assert.equal(h.context.state.device,'devkit');
  assert.equal(h.context.state.locale,'fr-fr');
  assert.equal(h.context.setupSession.code,nextSession.code);
  assert.equal(h.context.confirmedState.locale,'fr-fr');
  assert.deepEqual(Array.from(h.context.answered),[...RECIPE_QUESTIONS,'prepare','memory','cpu','piModel']);
  assert.equal(h.context.editing,false);assert.equal(h.context.editSnapshot,null);
  assert.equal(h.context.trail.length,0);
  assert.equal(h.main.inert,false);assert.equal(h.main.getAttribute('aria-busy'),null);
  assert.equal(h.notice.hidden,true);
  assert.equal(h.renders.length,1);assert.equal(h.renders[0].state.device,'devkit');
});

test('an older restore cannot commit or release inert while a newer restore is pending',async()=>{
  const h=harness({step:'review'}),firstSession=issueSetup(recipe('fr-fr','devkit')),lastSession=issueSetup(recipe('de-de','server'));
  h.context.location.hash='#setup='+firstSession.code;const first=h.context.restore();
  h.context.location.hash='#setup='+lastSession.code;const last=h.context.restore();
  h.loads[0].resolve();await first;
  assert.equal(h.context.state.locale,'en-us');assert.equal(h.main.inert,true);
  assert.equal(h.renders.length,0);
  h.loads[1].resolve();await last;
  assert.equal(h.context.state.locale,'de-de');assert.equal(h.context.state.device,'server');
  assert.equal(h.context.setupSession.code,lastSession.code);
  assert.equal(h.main.inert,false);assert.equal(h.renders.length,1);
});

test('a late restore failure cannot replace the latest recipe or show a stale failure',async()=>{
  const h=harness({step:'review'}),firstSession=issueSetup(recipe('fr-fr','devkit')),lastSession=issueSetup(recipe('de-de','server'));
  h.context.location.hash='#setup='+firstSession.code;const first=h.context.restore();
  h.context.location.hash='#setup='+lastSession.code;const last=h.context.restore();
  h.loads[1].resolve();await last;
  h.loads[0].reject(new Error('old request failed'));await first;
  assert.equal(h.context.state.locale,'de-de');assert.equal(h.context.setupSession.code,lastSession.code);
  assert.equal(h.notice.hidden,true);assert.equal(h.notice.textContent,'');
  assert.equal(h.main.inert,false);assert.equal(h.renders.length,1);
});

test('restore load failure preserves the requested recipe, unblocks interaction and can retry',async()=>{
  const h=harness({step:'review'}),session=issueSetup(recipe('fr-fr','devkit'));
  h.context.location.hash='#setup='+session.code;const first=h.context.restore();
  h.loads[0].reject(new Error('offline'));await first;
  assert.equal(h.context.state.locale,'fr-fr');assert.equal(h.context.state.device,'devkit');
  assert.equal(h.context.setupSession.code,session.code);assert.equal(h.context.step,'review');
  assert.equal(h.main.inert,false);assert.equal(h.main.getAttribute('aria-busy'),null);
  assert.equal(h.notice.hidden,false);assert.equal(h.notice.textContent,'Couldn’t load this language. Please try again.');
  const retry=h.context.restore();assert.equal(h.main.inert,true);
  h.loads[1].resolve();await retry;
  assert.equal(h.context.setupSession.code,session.code);
  assert.equal(h.notice.hidden,true);assert.equal(h.notice.textContent,'');
  assert.equal(h.main.inert,false);assert.equal(h.renders.length,2);
});

test('invalid shared links commit a fresh language screen only after its locale is ready',async()=>{
  const h=harness({step:'review',suggestedLocale:'fr-fr'});
  h.context.setupSession=issueSetup(recipe());h.context.location.hash='#setup=invalid';
  const pending=h.context.restore();
  assert.equal(h.context.step,'review');assert.equal(h.main.inert,true);
  assert.equal(h.loads[0].locale,'fr-fr');
  h.loads[0].resolve();await pending;
  assert.equal(h.context.step,'language');assert.equal(h.context.setupSession,null);
  assert.equal(h.context.state.locale,'fr-fr');assert.equal(h.context.skillsAnswered,false);
  assert.equal(h.context.answered.size,0);assert.equal(h.main.inert,false);
  assert.equal(h.notice.hidden,false);
  assert.equal(h.notice.textContent,'That link needs a fresh start. Let’s make a new recipe.');
});
