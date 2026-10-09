import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as scenario from '../dist/scenario.mjs';
import * as flow from '../dist/flow.mjs';
import * as journey from '../dist/journey.mjs';
import * as recommendations from '../dist/recommendations.mjs';
import * as handoff from '../dist/handoff.mjs';
import * as short from '../dist/short-setup.mjs';
import {PrerequisiteGate,prerequisitesView} from '../dist/prerequisites.mjs';
import {preparationFor} from '../dist/preparation.mjs';
import {liveWizardUrl} from '../dist/preview.mjs';
import {icon,deviceIcon} from '../dist/icons.mjs';
import {translateMessage} from '../dist/i18n.mjs';
const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
/** Load production renderers with actual domain modules and controlled state. @returns {object} View scope. */
function views(){
 const c=vm.createContext({prerequisiteGate:new PrerequisiteGate(),manualCopyFor:null,installTracker:{session:null},prerequisitesView,previewOnly:false,liveWizardUrl,...scenario,...flow,...journey,...recommendations,...handoff,...short,preparationFor,icon,deviceIcon,
 state:{...scenario.DEFAULTS,device:'pi'},answered:new Set(),step:'piModel',devicePane:'cards',unlistedDevice:false,platformUnsure:false,detailsOpen:false,setupSession:null,shareUrl:()=>'',launchToken:()=> 'L'.repeat(22),});
 const names=['escape','intro','card','answerCard','deviceView','platformView','experienceView','capabilityView','preparationView','detailsView','prerequisitePageView','reviewOptionsView','setupEditorView','manualCopyReady','resultView'];
 const declarations=names.map(name=>source.match(new RegExp(`^function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`,'m'))?.[0]);
 // Escape is intentionally a one-line utility.
 declarations[0]=source.match(/^function escape\(.*$/m)[0];
 assert.ok(declarations.every(Boolean));
 vm.runInContext(source.slice(source.indexOf('const IDEAS ='),source.indexOf('const languageSuggestion'))+'\n'+declarations.join('\n'),c);return c;
}
/** Complete both deliberate actions for tests exercising the unlocked handoff. */
function acceptPreparation(c){
 c.prerequisiteGate.selectDevice(c.state.device);
 c.prerequisiteGate.selectFamily(['mark1','mark2','devkit'].includes(c.state.device)?'debian13':c.state.device==='windows'?'ubuntu-wsl':'debian');
 c.prerequisiteGate.confirm(true);assert.equal(c.prerequisiteGate.accept(c.state.device),true);
}
test('hardware and purpose cards render with real helpers for every intended use',()=>{
 const c=views();
 for(const experience of ['ready','tinker','hub']){c.state.experience=experience;assert.match(c.deviceView(),/data-value="server"/);assert.match(c.experienceView(),/data-pick="experience"/);}
 for(const device of Object.keys(scenario.DEVICES)){c.state.device=device;assert.match(c.preparationView(),/data-prepared/);assert.match(c.resultView(),/data-prerequisite-continue/);assert.ok(c.resultView().includes(deviceIcon(device)));}
});

test('install summary groups device identity, confirmation and labelled settings',()=>{
 const c=views();Object.assign(c.state,{device:'mark2',speech:'public',homeassistant:true,llmMode:'online'});
 acceptPreparation(c);const html=c.resultView(),row=html.match(/<ul class="setup-icon-summary"[\s\S]*?<\/ul>/)[0];
 const header=html.slice(html.indexOf('<div class="install-target install-target-summary">'),html.indexOf('<ul class="setup-icon-summary"'));
 assert.equal(header.split(deviceIcon('mark2')).length-1,1);
 assert.match(header,/class="setup-device" data-edit="device" aria-label="Edit Device: Mycroft Mark II"/);
 assert.match(header,/<strong>Mycroft Mark II<\/strong><span>English \(US\)<\/span>/);
 assert.doesNotMatch(row,/data-edit="device"|device-symbol|setup-summary-connector|aria-current|aria-pressed/);
 for(const choice of handoff.setupSummary(c.state).filter(choice=>choice.target!=='device')){
  assert.ok(row.includes(`data-edit="${choice.target}" aria-label="Edit ${choice.label}: ${choice.value}"`));
  assert.ok(row.includes(`<span class="setup-feature-kind">${choice.label}</span><strong>${choice.value}</strong>`));
 }
 assert.match(row,/<span class="setup-feature-kind">AI<\/span><strong>Online provider<\/strong>/);
 assert.equal((row.match(/class="setup-summary-icon"/g)||[]).length,4);
 assert.doesNotMatch(row,/setup-summary-hint/);
 assert.equal((header.match(/data-review-prerequisites/g)||[]).length,1);
 assert.match(header,/aria-labelledby="preparation-state preparation-review-label"/);
 assert.match(header,/>Tools confirmed<\/span>/);
 assert.doesNotMatch(header,/data-code-expiry/);
 const copyStep=html.slice(html.indexOf('data-handoff-step="copy"'),html.indexOf('data-handoff-step="paste"'));
 assert.match(copyStep,/Copy install command[\s\S]*data-code-expiry/);
 const french=JSON.parse(readFileSync(new URL('../dist/locales/fr-fr.json',import.meta.url),'utf8'));
 assert.equal(translateMessage('Edit Speech: Online services',french),'Modifier Voix : Services en ligne');
 assert.equal(translateMessage('Edit AI: My model server',french),'Modifier IA : Mon serveur d’IA');
});

for(const [device,hardware] of Object.entries(scenario.DEVICES)){
 for(const experience of scenario.allowedExperiences(device)){
  test(`${hardware.name}: shared summary and command gates for ${experience}`,()=>{
   const hub=experience==='hub';
   const variants=[
    {skills:false,extraSkills:false,speech:'auto',homeassistant:false,llmMode:'off'},
    {skills:true,extraSkills:false,speech:'auto',homeassistant:false,llmMode:'off'},
    {skills:true,extraSkills:true,speech:hub?'auto':'public',homeassistant:!hub,llmMode:hub?'off':'online'},
   ];
   for(const options of variants){
    const c=views();
    c.state=Object.freeze({...scenario.selectDevice({...scenario.DEFAULTS,experience},device),...options});
    c.setupSession=short.issueSetup(c.state);
    const recipe=scenario.encodePreset(c.state);
    assert.doesNotMatch(c.resultView(),/data-install-action|>Tools confirmed<|id="install-command"/);
    acceptPreparation(c);
    const html=c.resultView();
    const header=html.slice(html.indexOf('<div class="install-target install-target-summary">'),html.indexOf('<ul class="setup-icon-summary"'));
    const row=html.match(/<ul class="setup-icon-summary"[\s\S]*?<\/ul>/)[0];
    assert.ok(header.includes(`<strong>${hardware.name}</strong><span>English (US)</span>`));
    assert.equal(header.split(deviceIcon(device)).length-1,1);
    assert.match(header,/data-edit="device"/);
    assert.match(header,/data-review-prerequisites[^>]*aria-labelledby="preparation-state preparation-review-label"/);
    assert.match(header,/>Tools confirmed<\/span>/);
    assert.doesNotMatch(header,/data-code-expiry/);
    const expected=[
     ...(hub?[['purpose','Use','Voice hub']]:[]),
     ...(options.skills?[['skills','Skills',options.extraSkills?'Everyday + extras':'Everyday essentials']]:[]),
     ...(!hub?[['speech','Speech',options.speech==='public'?'Online services':'Installer chooses']]:[]),
     ...(options.homeassistant?[['homeassistant','Home Assistant','Connect my server']]:[]),
     ...(options.llmMode==='online'?[['llm','AI','Online provider']]:[]),
    ];
    assert.deepEqual([...row.matchAll(/data-edit="([^"]+)"/g)].map(match=>match[1]),expected.map(([target])=>target));
    for(const [target,label,value] of expected){
     assert.ok(row.includes(`data-edit="${target}" aria-label="Edit ${label}: ${value}"`));
     assert.ok(row.includes(`<span class="setup-feature-kind">${label}</span><strong>${value}</strong>`));
    }
    const copyStep=html.slice(html.indexOf('data-handoff-step="copy"'),html.indexOf('data-handoff-step="paste"'));
    assert.match(copyStep,/data-install-action >[\s\S]*Copy install command[\s\S]*data-code-expiry/);
    assert.match(copyStep,/<div class="command-fallback" hidden>/);
    assert.match(copyStep,/id="install-command"[^>]*><\/textarea>/);
    c.manualCopyFor=c.setupSession.code;
    assert.doesNotMatch(c.resultView(),/<div class="command-fallback" hidden>/);
    assert.equal(scenario.encodePreset(c.state),recipe,'Rendering must preserve the selected recipe');
    c.prerequisiteGate.confirm(false);
    assert.doesNotMatch(c.resultView(),/data-install-action|>Tools confirmed<|id="install-command"/);
   }
  });
 }
}

test('every hardware change requires fresh acknowledgement before showing its command',()=>{
 for(const previous of Object.keys(scenario.DEVICES)){
  for(const next of Object.keys(scenario.DEVICES).filter(device=>device!==previous)){
   const c=views();c.state=scenario.selectDevice(scenario.DEFAULTS,previous);acceptPreparation(c);
   c.state=scenario.selectDevice(c.state,next);c.setupSession=short.issueSetup(c.state);
   const html=c.resultView();
   assert.match(html,/data-prerequisite-continue disabled/,`${previous} → ${next}`);
   assert.doesNotMatch(html,/data-install-action|>Tools confirmed<|id="install-command"/,`${previous} → ${next}`);
  }
 }
});
test('only accepted capability answers appear selected, including deliberate unknowns',()=>{
 const c=views();const choices={piModel:['pi5','older','unknown'],memory:['under8','8plus','unknown'],cpu:['arm64','avx2','unknown']};
 for(const [key,values] of Object.entries(choices)){
  c.step=key;c.answered.clear();assert.equal((c.capabilityView().match(/aria-pressed="true"/g)||[]).length,0);
  c.answered.add(key);
  for(const value of values){c.state[key]=value;const html=c.capabilityView();assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);assert.match(html,new RegExp(`data-value="${value}" aria-pressed="true"`));}
 }
});
test('expert review exposes advanced controls and the reboot check has a keyboard-copyable field',()=>{
 const c=views();c.state.expertise='expert';acceptPreparation(c);assert.match(c.detailsView(),/advanced-install" open/);assert.match(c.resultView(),/<textarea id="check-command"[^>]+readonly/);
});

test('Edit setup exposes every saved setting before preparation without granting installer access',()=>{
 const c=views();c.detailsOpen=true;const html=c.resultView();
 assert.match(html,/<h1[^>]*>Your setup<\/h1>/);
 for(const target of ['language','device','speech','skills','guidance','method','channel','telemetry'])assert.ok(html.includes(`data-edit="${target}"`),target);
 assert.match(html,/data-edit="homeassistant"/);assert.match(html,/data-edit="llm"/);
 assert.match(html,/data-review-prerequisites>Continue/);
 assert.doesNotMatch(html,/data-install-action|id="install-command"|data-prerequisite-continue/);
 assert.equal(c.prerequisiteGate.ready(c.state.device),false);
 c.detailsOpen=false;assert.match(c.resultView(),/data-prerequisite-continue disabled/);
});

test('preparation advances with Continue while keeping target-specific help available',()=>{
 const c=views();
 for(const device of Object.keys(scenario.DEVICES)){
  c.state.device=device;const html=c.preparationView();assert.match(html, /data-prepared><span>Continue<\/span>/);assert.doesNotMatch(html,/I can open/);assert.match(html,/<details class="preparation-help">/);
 }
 assert.match(preparationFor({device:'pi'}).description,/guide you through the commands in Terminal/);assert.match(preparationFor({device:'windows'}).description,/Ubuntu.*WSL2/);
});
test('processor cards use familiar names and lookup hints; features remain in optional help',()=>{
 const c=views();c.step='cpu';
 for(const device of ['computer','windows','other']){
  c.state.device=device;const html=c.capabilityView(),visible=html.split('<details')[0].replace(/<[^>]*>/g,'');
  assert.doesNotMatch(visible,/64-bit|ARM64|NEON|AVX2/);assert.match(visible,/Settings → About/);assert.match(visible,/Intel Core or AMD Ryzen/);assert.match(visible,/Snapdragon/);assert.match(visible,/may use online speech/);
  assert.match(html,/<details class="speech-details processor-help">/);assert.doesNotMatch(html,/<details[^>]+open/);assert.match(html,/ARM64 with NEON.*AVX2/);
 }
 c.state.device='mac';const mac=c.capabilityView();assert.match(mac,/About This Mac/);assert.doesNotMatch(mac,/Snapdragon/);
 const result=recommendations.speechEligibility({...scenario.DEFAULTS,device:'computer',memory:'8plus',cpu:'avx2'});assert.equal(result.eligible,true);assert.match(result.reason,/may work.*may use online services/);
});

test('install handoff exposes one instruction and keeps recovery and tracking details inside help',()=>{
 const c=views();
 for(const device of Object.keys(scenario.DEVICES)){
  c.state.device=device;acceptPreparation(c);const html=c.resultView();
  const primary=html.slice(0,html.indexOf('<details class="install-help-short handoff-help">'));
  assert.match(primary,/Install <em>OVOS\.<\/em>/);
  assert.equal((primary.match(/data-install-action/g)||[]).length,1);
  assert.equal((primary.match(/data-paste-title/g)||[]).length,1);
  assert.match(primary,/data-install-waiting hidden/);
  assert.doesNotMatch(primary,/After a restart|24 hours|Follow the steps|No device logs/);
  if(device==='windows')assert.match(primary,/Open Ubuntu in WSL2, paste and press Enter/);
  else assert.ok(primary.includes(`Open Terminal on your ${scenario.DEVICES[device].name}, paste and press Enter.`));
  assert.match(html,/<summary>Installation help<\/summary>[\s\S]*After a restart[\s\S]*data-progress-privacy/);
  assert.doesNotMatch(html,/install-followup/);
 }
});


test('automatic failure-report notice is visible before copying for every device',()=>{
 const c=views();
 for(const device of Object.keys(scenario.DEVICES)){
  c.state.device=device;acceptPreparation(c);const html=c.resultView();
  const primary=html.slice(0,html.indexOf('<ol class="handoff-actions"'));
  assert.match(primary,/<p class="details-note progress-privacy" id="install-report-note" data-report-notice>If installation fails, logs are automatically uploaded to paste.uoi.io. Anyone with the report link can read them.<\/p>/);
  assert.doesNotMatch(primary,/<details[\s\S]*data-report-notice|data-report-notice[^>]*hidden/);
  assert.match(html,/<button[^>]+aria-describedby="install-report-note"[^>]+data-install-action/);
  assert.doesNotMatch(html,/No logs or passwords are sent here/);
 }
});

test('preview handoff is labelled, disables install exports and links only choices to production',()=>{
 const c=views();c.previewOnly=true;c.setupSession=short.issueSetup(c.state);acceptPreparation(c);
 const html=c.resultView();assert.match(html,/Preview only — no installation will run/);
 assert.ok(html.includes('https://ovos-start-wizard.goldyfruit.chatgpt.site/#setup='+c.setupSession.code));
 assert.match(html,/data-install-action disabled/);assert.match(html,/data-download="script" disabled/);
 assert.match(html,/id="install-command"[^>]*><\/textarea>/);assert.doesNotMatch(html,/curl -[a-zA-Z]/);
});

test('manual copy is beside the primary action and sharing stays in installation help',()=>{
 const c=views();c.setupSession=short.issueSetup(c.state);acceptPreparation(c);const html=c.resultView();
 const actions=html.slice(html.indexOf('<ol class="handoff-actions"'),html.indexOf('</ol>',html.indexOf('<ol class="handoff-actions"')));
 assert.match(actions,/data-handoff-step="copy"/);assert.match(actions,/aria-current="step"/);
 assert.match(actions,/data-handoff-step="paste"/);
 assert.match(actions,/<div class="command-fallback" hidden>/);
 assert.doesNotMatch(html,/View command|<details class="command-fallback"/);
 assert.match(actions,/id="install-command"/);
 assert.equal((html.match(/id="install-command"/g)||[]).length,1);
 assert.equal((html.match(/id="share-link"/g)||[]).length,1);
 assert.doesNotMatch(c.detailsView(),/id="install-command"|data-copy="link"/);
 assert.match(html,/<details class="install-help-short handoff-help">[\s\S]*Using another computer\?[\s\S]*data-copy="link"/);
});

test('standalone prerequisites expose no executable handoff even after the checkbox alone',()=>{
 const c=views();c.setupSession=short.issueSetup(c.state);
 let html=c.resultView();assert.match(html,/preparation-required/);assert.match(html,/data-prerequisite-continue disabled/);
 assert.doesNotMatch(html,/data-install-action|data-download="script"|id="install-command"|install-options|data-paste-title/);
 assert.match(html,/data-install-progress hidden/);
 c.prerequisiteGate.selectFamily('debian');c.prerequisiteGate.confirm(true);html=c.resultView();
 assert.doesNotMatch(html,/data-prerequisite-continue disabled/);assert.doesNotMatch(html,/data-install-action|id="install-command"/);
 c.prerequisiteGate.accept(c.state.device);html=c.resultView();assert.match(html,/id="install-command"[^>]*><\/textarea>/);assert.match(html,/data-review-prerequisites/);assert.doesNotMatch(html,/data-prerequisite-confirm/);
 c.state.device='mac';html=c.resultView();assert.doesNotMatch(html,/data-install-action/);assert.match(html,/brew install bash/);
});

test('handoff contains only the short command after a launch capability is available',()=>{
 const c=views();c.setupSession=short.issueSetup(c.state);acceptPreparation(c);
 c.launchToken=()=>null;let html=c.resultView();
 assert.match(html,/<div class="command-fallback" hidden>/);
 assert.match(html,/id="install-command"[^>]*><\/textarea>/);assert.doesNotMatch(html,/mktemp|raw\.githubusercontent\.com[^<]*-o/);
 c.launchToken=()=> 'L'.repeat(22);html=c.resultView();
 assert.match(html,/<div class="command-fallback" hidden>/);
 c.manualCopyFor=c.setupSession.code;html=c.resultView();
 assert.match(html,/id="install-command"[^>]*>curl -qfsS -m120 [^<]* \| sh<\/textarea>/);
 assert.doesNotMatch(html,/<div class="command-fallback" hidden>/);
});

test('all targets require OS acknowledgement plus Continue before installation exports',()=>{
 const c=views();
 for(const device of Object.keys(scenario.DEVICES)){
  c.state=scenario.selectDevice(scenario.DEFAULTS,device);c.setupSession=short.issueSetup(c.state);
  let html=c.resultView();assert.match(html,/data-prerequisite-continue disabled/,device);assert.doesNotMatch(html,/id="install-command"|data-install-action/,device);
  acceptPreparation(c);html=c.resultView();assert.match(html,/data-install-action/,device);assert.doesNotMatch(html,/data-prerequisite-required hidden/,device);
  c.prerequisiteGate.confirm(false);html=c.resultView();assert.doesNotMatch(html,/id="install-command"|data-install-action/,device);
 }
});

test('compact preparation pairs device artwork with visible system requirements before Continue',()=>{
 const c=views();
 for(const device of Object.keys(scenario.DEVICES)){
  c.state.device=device;const html=c.preparationView(),visible=html.split('<details')[0];
  assert.ok(visible.includes(deviceIcon(device)),device);assert.ok(visible.includes(preparationFor(c.state).help),device);
  assert.match(visible,/Ready for <em>OVOS\?<\/em>/);assert.equal((html.match(/data-prepared/g)||[]).length,1);
  assert.ok(visible.indexOf('preparation-requirement')<visible.indexOf('data-prepared'));
  assert.doesNotMatch(html,/data-prerequisite-confirm/);
 }
 c.state.device='mark2';assert.match(c.preparationView(),/Install the supported Debian 13 image first/);
});

test('compact preparation copy is translated in every wizard locale',()=>{
 const keys=['Ready for <em>OVOS?</em>','We’ll guide you through the commands in Terminal.','Install the supported Debian 13 image first.','Need help preparing it?'];
 for(const locale of Object.keys(scenario.LANGUAGES)){
  const catalog=JSON.parse(readFileSync(new URL(`../dist/locales/${locale}.json`,import.meta.url),'utf8'));
  for(const key of keys)assert.ok(catalog[key],`${locale}: ${key}`);
 }
});

test('readable summary keeps only enabled settings and has no progress connectors',()=>{
 const c=views();
 for(const state of [scenario.selectDevice(scenario.DEFAULTS,'mark2'),{...scenario.selectDevice(scenario.DEFAULTS,'computer'),skills:false,llmMode:'off'},scenario.selectDevice(scenario.DEFAULTS,'server')]){
  c.state=state;acceptPreparation(c);const row=c.resultView().match(/<ul class="setup-icon-summary"[\s\S]*?<\/ul>/)[0],choices=handoff.setupSummary(state).filter(choice=>choice.target!=='device');
  assert.doesNotMatch(row,/setup-summary-connector|aria-current|aria-pressed/);
  assert.deepEqual([...row.matchAll(/data-edit="([^"]+)"/g)].map(match=>match[1]),choices.map(choice=>choice.target));
  assert.match(row,/<\/button><\/li><\/ul>$/);assert.match(row,/role="list" aria-label="Your setup"/);
 }
});
