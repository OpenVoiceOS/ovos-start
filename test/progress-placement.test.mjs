import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {progressView,waitingView,timingView} from '../dist/post-install.mjs';
import {INSTALLED_STATES} from '../dist/install-progress.mjs';
import {DEFAULTS} from '../dist/scenario.mjs';
const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const declaration=['manualCopyReady','updateManualCopy','updateInstallProgress'].map(name=>source.match(new RegExp(`^function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`,'m'))[0]).join('\n');

test('waiting stays in the handoff; actual installation replaces it with progress and guidance',()=>{
 const region={querySelector:()=>null},waiting={},card={},heading={},privacy={},intro={},setup={},navigation={},trivia={};
 const nodes={'[data-install-progress]':region,'[data-install-waiting]':waiting,'.install-card':card,'#step-title':heading,'[data-progress-privacy]':privacy,'.ready-wrap>.intro':intro,'.install-options':setup,'.project-fact':trivia};
 let model={session:{status:'waiting'}};
 const c=vm.createContext({prerequisiteGate:{ready:()=>true},document:{querySelector:()=>navigation},previewOnly:false,manualCopyFor:null,step:'review',setupSession:{code:'recipe'},installTracker:{code:'recipe',snapshot:()=>model},state:{...DEFAULTS,device:'pi'},trackingShown:false,progressSignature:'',wizard:{querySelector:name=>nodes[name]||null},progressView,waitingView,timingView,INSTALLED_STATES,preserveProgressInteraction:()=>()=>{},applyTranslations(){},launchToken:()=>null,t:x=>x,updateExpiry(){}});
 vm.runInContext(declaration,c);c.updateInstallProgress();assert.equal(waiting.hidden,true);assert.equal(region.hidden,true);assert.equal(card.hidden,false);assert.equal(intro.hidden,false);assert.equal(setup.hidden,false);assert.equal(navigation.hidden,false);
 c.trackingShown=true;c.updateInstallProgress();assert.equal(waiting.hidden,false);assert.equal(region.hidden,true);assert.match(waiting.innerHTML,/Waiting for your device/);
 for(const status of ['started','downloading','installing','installed','services_ready','voice_ready']){
  model={session:{status}};c.updateInstallProgress();assert.equal(waiting.hidden,true,status);assert.equal(region.hidden,false,status);assert.equal(card.hidden,true,status);assert.equal(intro.hidden,true,status);assert.equal(setup.hidden,true,status);assert.equal(navigation.hidden,true,status);assert.equal((region.innerHTML.match(/<h1/g)||[]).length,1);
  if(INSTALLED_STATES.includes(status))assert.match(region.innerHTML,/demo-thumbnail/);
 }
 model={session:{status:'services_ready',audioStatus:'checking',microphoneStatus:'pending'}};c.updateInstallProgress();
 assert.match(region.innerHTML,/audio-result--checking" data-audio-result="audio"/);
 model.session.audioStatus='passed';c.updateInstallProgress();
 assert.match(region.innerHTML,/audio-result--passed" data-audio-result="audio"/);
 model.session.microphoneStatus='failed';c.updateInstallProgress();
 assert.match(region.innerHTML,/audio-result--failed" data-audio-result="microphone"/);
 model={session:{status:'installing',phase:2,completedSteps:['packages_installed']}};c.updateInstallProgress();
 assert.match(region.innerHTML,/System packages installed/);assert.doesNotMatch(region.innerHTML,/Audio configured/);
 model.session.completedSteps.push('audio_configured');c.updateInstallProgress();
 assert.match(region.innerHTML,/Audio configured/);
 for(const status of ['failed','cancelled']){model={session:{status}};c.updateInstallProgress();assert.equal(card.hidden,true);assert.equal(region.hidden,false);assert.match(region.innerHTML,/install-recovery/);assert.equal(setup.hidden,true);assert.equal(navigation.hidden,true);assert.equal(trivia.hidden,true);assert.equal(heading.textContent,status==='failed'?'Installation stopped':'Installation cancelled');}
 model={session:{status:'failed'}};c.updateInstallProgress();assert.doesNotMatch(region.innerHTML,/data-copy-report/);
 model={session:{status:'failed',errorUrl:'https://paste.uoi.io/report123'}};c.updateInstallProgress();assert.match(region.innerHTML,/data-copy-report/);
 model={session:{status:'waiting'}};c.updateInstallProgress();assert.equal(setup.hidden,false);assert.equal(navigation.hidden,false);assert.equal(trivia.hidden,false);assert.equal(card.hidden,false);
});

test('status callbacks cannot fill the manual install field before prerequisite acknowledgement',()=>{
 const region={querySelector:()=>null},field={value:''};
 const nodes={'[data-install-progress]':region,'#install-command':field};
 const c=vm.createContext({document:{querySelector:()=>null},previewOnly:false,manualCopyFor:null,prerequisiteGate:{ready:()=>false},step:'review',setupSession:{code:'recipe'},installTracker:{code:'recipe',snapshot:()=>({session:{status:'waiting'}})},state:{...DEFAULTS,device:'pi'},trackingShown:false,progressSignature:'',wizard:{querySelector:name=>nodes[name]||null},progressView,waitingView,timingView,INSTALLED_STATES,preserveProgressInteraction:()=>()=>{},applyTranslations(){},launchToken:()=>null,t:x=>x,setupStatus:()=>({kind:'active'}),buildShortCommand(){assert.fail('Unconfirmed tools must not expose the command');}});
 vm.runInContext(declaration,c);c.updateInstallProgress();assert.equal(field.value,'');
});

test('a tracking token cannot expose View command until Copy was requested for that setup',()=>{
 const field={value:''},manual={hidden:true,open:false},region={querySelector:()=>null};
 const nodes={'[data-install-progress]':region,'#install-command':field,'.command-fallback':manual};
 const c=vm.createContext({document:{querySelector:()=>null},previewOnly:false,manualCopyFor:null,prerequisiteGate:{ready:()=>true},step:'review',setupSession:{code:'recipe'},installTracker:{code:'recipe',session:{status:'waiting'},snapshot:()=>({session:{status:'waiting'}})},state:{...DEFAULTS,device:'pi'},trackingShown:false,progressSignature:'',wizard:{querySelector:name=>nodes[name]||null},progressView,waitingView,timingView,INSTALLED_STATES,preserveProgressInteraction:()=>()=>{},applyTranslations(){},launchToken:()=> 'L'.repeat(22),t:x=>x,setupStatus:()=>({kind:'active'}),buildShortCommand:()=> 'current command'});
 vm.runInContext(declaration,c);c.updateInstallProgress();assert.equal(manual.hidden,true);assert.equal(field.value,'');
 c.manualCopyFor='recipe';c.updateInstallProgress();assert.equal(manual.hidden,false);assert.equal(field.value,'current command');
 c.manualCopyFor='previous recipe';c.updateInstallProgress();assert.equal(manual.hidden,true);assert.equal(field.value,'');
});
