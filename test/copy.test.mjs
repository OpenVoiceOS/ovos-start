import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url).pathname;
const {DEFAULTS,DEVICES}=await import(root+'scenario.mjs');
const {issueSetup,setupStatus,buildShortCommand}=await import(root+'short-setup.mjs');
const {revealCopyFallback,updateHandoffStep}=await import(root+'handoff.mjs');
const {PrerequisiteGate}=await import(root+'prerequisites.mjs');
const source=readFileSync(root+'app.mjs','utf8');
function declaration(name){const m=source.match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`,'m'));assert.ok(m,name);return m[0];}
const initialNow=1800000000;
function harness(){
 let now=initialNow,resolve,reject;const writes=[],toasts=[],events=[];
 const setup=issueSetup({...DEFAULTS,device:'computer'},now);
 const outer={tagName:'DETAILS',open:false,parentElement:null};
 const inner={tagName:'DETAILS',open:false,parentElement:outer};
 const fallback={tagName:'DIV',hidden:true,parentElement:inner,classList:{contains:x=>x==='link-fallback'}};
 function field(parent){return {isConnected:true,parentElement:parent,value:'',focus(){events.push('focus');},select(){events.push('select');},scrollIntoView(){events.push('scroll');}};}
 const manual={tagName:'DIV',hidden:true,parentElement:null};
 const command=field(manual),link=field(fallback);
 const handoffSteps=['copy','paste'].map(name=>({dataset:{handoffStep:name},attributes:{},done:false,setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},classList:{toggle(k,v){handoffSteps.find(x=>x.dataset.handoffStep===name).done=v;}}}));
 const gatedRegions=Array.from({length:5},()=>({hidden:false}));
 const classes=new Set();
 const button={isConnected:true,innerHTML:'Copy install command',disabled:false,dataset:{installAction:'copy'},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};
 const linkButton={isConnected:true};
 const title={textContent:'Next'},paste={textContent:'Paste'},status={textContent:''},expiry={textContent:''};
 const nodes={'.command-fallback':manual,'[data-install-action]':button,'#install-command':command,'#share-link':link,'[data-copy="link"]':linkButton,'[data-paste-title]':title,'.paste-step p':paste,'[data-copy-status]':status,'[data-code-expiry]':expiry};
 const prerequisiteGate=new PrerequisiteGate();prerequisiteGate.selectDevice('computer');prerequisiteGate.selectFamily('debian');prerequisiteGate.confirm(true);prerequisiteGate.accept('computer');
 const context=vm.createContext({answered:new Set(['telemetry']),go:target=>{context.step=target;events.push('go:'+target);},finish:()=>context.render(true),prerequisiteGate,manualCopyFor:null,commandCopyAttempt:0,previewOnly:false,Date:{now:()=>now*1000},Math,setupStatus:(s,t=now)=>setupStatus(s,t),buildShortCommand,revealCopyFallback,updateHandoffStep,DEVICES,state:{...setup.state},setupSession:setup,step:'review',expiryTimer:null,
 navigator:{clipboard:{writeText(value){writes.push(value);return new Promise((a,b)=>{resolve=a;reject=b;});}}},
 document:{querySelector:s=>nodes[s]??null},wizard:{querySelector:s=>nodes[s]??null,querySelectorAll:s=>s==='[data-prerequisite-required]'?gatedRegions:handoffSteps},shareUrl:()=>`https://example.test/#setup=${setup.code}`,
 installTracker:{session:{launchToken:'L'.repeat(22)},code:setup.code},trackingShown:false,updateInstallProgress(){},icon:x=>`[${x}]`,toast:x=>toasts.push(x),localize:()=>events.push('localize'),applyTranslations(){},clearTimeout(){},setTimeout:()=>1,
 });
 vm.runInContext([declaration('launchToken'),declaration('manualCopyReady'),declaration('updateManualCopy'),declaration('updateExpiry'),declaration('copy')].join('\n'),context);
 return {context,nodes,button,handoffSteps,gatedRegions,classes,command,link,outer,inner,manual,fallback,writes,toasts,events,title,status,expiry,setNow:n=>{now=n;},resolve:()=>resolve(),reject:()=>reject(Error('clipboard denied'))};
}
test('clipboard rejection reveals and selects the actual command without claiming success',async()=>{
 const h=harness(),pending=h.context.copy('command');h.reject();await pending;
 assert.equal(h.manual.hidden,false);assert.equal(h.outer.open,false);assert.equal(h.inner.open,false);assert.deepEqual(h.events,['focus','select','scroll']);assert.match(h.toasts[0],/Text selected/);assert.equal(h.classes.has('copied'),false);assert.equal(h.handoffSteps[1].attributes['aria-current'],undefined);
});
test('missing clipboard API reveals manual copying without a disclosure control',async()=>{
 const h=harness();h.context.navigator.clipboard=undefined;
 await h.context.copy('command');
 assert.equal(h.manual.hidden,false);assert.match(h.command.value,/^curl /);
 assert.ok(h.events.includes('select'));assert.equal(h.classes.has('copied'),false);
});
test('late clipboard outcomes cannot override a newer copy result',async()=>{
 for(const success of [true,false]){
  const h=harness(),outcomes=[];
  h.context.navigator.clipboard.writeText=()=>new Promise((resolve,reject)=>outcomes.push({resolve,reject}));
  const first=h.context.copy('command'),latest=h.context.copy('command');
  outcomes[1][success?'resolve':'reject']();await latest;
  outcomes[0][success?'reject':'resolve']();await first;
  assert.equal(h.manual.hidden,success);
  assert.equal(h.classes.has('copied'),success);
  assert.equal(h.command.value==='',success);
 }
});
test('expired choices remain shareable without extending the executable code',async()=>{
 const h=harness();const artifact=h.context.setupSession;h.setNow(initialNow+3600);const pending=h.context.copy('link');h.resolve();await pending;
 assert.equal(h.writes.length,1);assert.match(h.writes[0],new RegExp(artifact.code));assert.equal(h.context.setupSession,artifact);assert.match(h.toasts[0],/Setup link copied/);
 const rejected=h.context.copy('link');h.reject();await rejected;assert.equal(h.fallback.hidden,false);assert.ok(h.events.includes('select'));
 await h.context.copy('command');assert.equal(h.writes.length,2);assert.equal(h.button.dataset.installAction,'renew');assert.equal(h.context.setupSession,artifact);
});
test('late clipboard outcomes cannot update detached or replaced recipes',async()=>{
 for(const outcome of ['resolve','reject']){
  const h=harness(),pending=h.context.copy('command');h.context.step='speech';h.button.isConnected=false;h.command.isConnected=false;h[outcome]();await pending;
  assert.equal(h.button.innerHTML,'Copy install command');assert.equal(h.classes.has('copied'),false);assert.equal(h.events.length,0);assert.equal(h.toasts.length,0);
 }
 const h=harness(),pending=h.context.copy('command');h.context.setupSession=issueSetup({...h.context.state,telemetry:!h.context.state.telemetry},initialNow);h.resolve();await pending;
 assert.equal(h.button.innerHTML,'Copy install command');assert.equal(h.events.length,0);assert.equal(h.toasts.length,0);
});
test('expiration while copying clears stale command success and offers explicit renewal',async()=>{
 const h=harness(),pending=h.context.copy('command');h.classes.add('copied');h.command.value='stale';h.setNow(initialNow+3600);h.resolve();await pending;
 assert.equal(h.button.dataset.installAction,'renew');assert.match(h.button.innerHTML,/Copy new command/);assert.equal(h.classes.has('copied'),false);assert.equal(h.command.value,'');assert.match(h.title.textContent,/copy a new command/);assert.match(h.toasts[0],/expired while copying/);assert.equal(h.handoffSteps[0].attributes['aria-current'],'step');assert.equal(h.handoffSteps[1].attributes['aria-current'],undefined);
});

test('successful copy stays concise and preserves the existing paste instruction',async()=>{
 const h=harness(),pending=h.context.copy('command');h.resolve();await pending;
 assert.match(h.button.innerHTML,/<span>Copied<\/span>/);assert.doesNotMatch(h.button.innerHTML,/Copy again/);
 assert.equal(h.classes.has('copied'),true);assert.equal(h.handoffSteps[1].attributes['aria-current'],'step');assert.equal(h.handoffSteps[0].done,true);assert.equal(h.title.textContent,'Next');assert.match(h.status.textContent,/Paste.*terminal/);
});

test('successful and pending copies have no command disclosure; rejection reveals manual selection',async()=>{
 const h=harness();h.context.updateExpiry();
 assert.equal(h.manual.hidden,true);assert.equal(h.command.value,'');
 const shared=h.context.copy('link');h.resolve();await shared;
 assert.equal(h.context.manualCopyFor,null);h.context.updateManualCopy();assert.equal(h.manual.hidden,true);
 let pending=h.context.copy('command');
 assert.equal(h.manual.hidden,true);assert.equal(h.command.value,'');
 h.reject();await pending;
 assert.equal(h.manual.hidden,false);assert.equal(h.classes.has('copied'),false);
 assert.equal(h.context.manualCopyFor,h.context.setupSession.code);
 assert.equal(h.command.value,h.writes.at(-1));assert.ok(h.events.includes('select'));
 h.context.updateExpiry();assert.equal(h.manual.hidden,false);
 pending=h.context.copy('command');assert.equal(h.manual.hidden,true);h.resolve();await pending;
 assert.equal(h.manual.hidden,true);assert.equal(h.command.value,'');assert.equal(h.context.manualCopyFor,null);
});

test('manual fallback is cleared on expiry, failed attempts, missing readiness and a different recipe',async()=>{
 for(const change of ['expired','failed','cancelled','unconfirmed','token','preview','recipe']){
  const h=harness(),pending=h.context.copy('command');h.reject();await pending;
  assert.equal(h.manual.hidden,false);
  if(change==='expired')h.setNow(initialNow+3600);
  if(['failed','cancelled'].includes(change))h.context.installTracker.session.status=change;
  if(change==='unconfirmed')h.context.prerequisiteGate.confirm(false);
  if(change==='token')h.context.installTracker.session.launchToken=null;
  if(change==='preview')h.context.previewOnly=true;
  if(change==='recipe'){h.context.setupSession=issueSetup({...h.context.state,telemetry:!h.context.state.telemetry},initialNow);h.context.installTracker.code=h.context.setupSession.code;}
  h.context.updateExpiry();
  assert.equal(h.manual.hidden,true,change);assert.equal(h.command.value,'',change);
 }
});

test('copy uses the current short launch link and never puts it into the shared setup link',async()=>{
 const h=harness();const token='L'.repeat(22);h.context.launchToken=()=>token;
 let pending=h.context.copy('command');assert.ok(h.writes[0].includes('/s/'+token));assert.ok(h.writes[0].startsWith('curl -qfsS -m120 '));assert.ok(!h.writes[0].includes('--track'));
 assert.equal(h.classes.has('copied'),false);h.resolve();await pending;assert.equal(h.classes.has('copied'),true);
 pending=h.context.copy('link');h.resolve();await pending;assert.ok(!h.writes[1].includes(token));assert.ok(h.writes[1].includes(h.context.setupSession.code));
});

test('missing launch capability never exposes or copies the longer fallback, and retry recovers',async()=>{
 const h=harness();let token=null,connections=0;
 h.context.launchToken=()=>token;h.context.installTracker.session=null;
 h.context.installTracker.connect=async()=>{connections++;if(connections===2)token='R'.repeat(22);};
 h.command.value='stale';h.context.updateExpiry();
 assert.equal(h.command.value,'');assert.equal(h.manual.hidden,true);
 await h.context.copy('command');
 assert.equal(h.writes.length,0);assert.equal(h.classes.has('copied'),false);assert.equal(h.context.trackingShown,false);
 assert.equal(h.button.disabled,false);assert.match(h.button.innerHTML,/Copy install command/);
 assert.deepEqual(h.toasts,['Could not prepare your install command. Please try again.']);
 const pending=h.context.copy('command');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.writes.length,1);assert.equal(h.writes[0],'curl -qfsS -m120 https://installer.openvoiceos.pt/s/'+token+' | sh');assert.ok(h.writes[0].length<80);
 h.resolve();await pending;assert.equal(h.classes.has('copied'),true);
 h.context.updateExpiry();assert.equal(h.manual.hidden,true);assert.equal(h.command.value,'');
});


test('simulation previews cannot copy install commands or populate the fallback field',async()=>{
 const h=harness();h.context.previewOnly=true;await h.context.copy('command');
 assert.equal(h.writes.length,0);assert.deepEqual(h.toasts,['Preview only — no installation will run.']);
 h.context.updateExpiry();assert.equal(h.button.disabled,true);assert.equal(h.command.value,'');assert.ok(h.gatedRegions.every(x=>!x.hidden));
});


test('preview download and device-check handlers cannot export executable artifacts',async()=>{
 const h=harness();h.context.previewOnly=true;
 vm.runInContext([declaration('download'),declaration('copyDeviceCheck')].join('\n'),h.context);
 await h.context.download('script');await h.context.copyDeviceCheck({});
 assert.equal(h.writes.length,0);assert.equal(h.toasts.length,2);
 assert.ok(h.toasts.every(x=>x==='Preview only — no installation will run.'));
});

test('retry preserves choices but binds a new one-hour command before copying',async()=>{
 for(const outcome of ['resolve','reject']){
  const h=harness(),old=h.context.setupSession,token='R'.repeat(22);h.setNow(initialNow+100);
  h.context.issueSetup=state=>issueSetup(state,initialNow+100);
  h.context.installTracker.session={status:'failed'};
  h.context.persist=()=>h.events.push('persist');h.button.focus=()=>h.events.push('focus-button');
  h.context.render=()=>{h.context.installTracker.session=null;h.context.updateExpiry();};
  h.context.installTracker.connect=async code=>{h.context.installTracker.code=code;h.context.installTracker.session={status:'waiting',launchToken:token};};
  h.context.launchToken=()=>h.context.installTracker.code===h.context.setupSession.code?h.context.installTracker.session?.launchToken:null;
  vm.runInContext(declaration('retryInstallation'),h.context);
  const pending=h.context.retryInstallation();await new Promise(resolve=>setImmediate(resolve));
  assert.notEqual(h.context.setupSession.code,old.code);assert.deepEqual(h.context.setupSession.state,old.state);
  assert.equal(h.context.setupSession.expiresAt-h.context.setupSession.issuedAt,3600);
  assert.equal(h.context.installTracker.code,h.context.setupSession.code);
  assert.equal(h.writes.length,1);assert.ok(h.writes[0].includes('/s/'+token));
  h[outcome]();await pending;
  assert.equal(h.classes.has('copied'),outcome==='resolve');
  if(outcome==='reject'){assert.equal(h.manual.hidden,false);assert.ok(h.events.includes('select'));}
 }
});

test('retry cannot replace an active, unrelated, preview, or same-second attempt',async()=>{
 for(const scenario of ['active','unrelated','preview','same-second','clock','away']){
  const h=harness(),old=h.context.setupSession;h.context.installTracker.session={status:'failed'};
  h.context.issueSetup=state=>issueSetup(state,initialNow);h.context.persist=()=>assert.fail('Must not persist');h.context.render=()=>assert.fail('Must not render');
  if(scenario==='active')h.context.installTracker.session.status='installing';
  if(scenario==='unrelated')h.context.installTracker.code='other';
  if(scenario==='preview')h.context.previewOnly=true;
  if(scenario==='clock')h.setNow(initialNow-1);
  if(scenario==='away')h.context.step='speech';
  vm.runInContext(declaration('retryInstallation'),h.context);await h.context.retryInstallation();
  assert.equal(h.context.setupSession,old);assert.equal(h.writes.length,0);
  if(scenario==='same-second')assert.match(h.toasts[0],/wait a second/);
 }
});

test('unconfirmed prerequisites block copy, manual command and executable download but preserve sharing',async()=>{
 const h=harness();h.context.prerequisiteGate.confirm(false);const setup=h.context.setupSession;
 h.context.updateExpiry();assert.equal(h.button.disabled,true);assert.equal(h.command.value,'');assert.ok(h.gatedRegions.every(x=>x.hidden));
 await h.context.copy('command');assert.equal(h.writes.length,0);assert.match(h.toasts.at(-1),/Confirm the required tools/);
 vm.runInContext(declaration('download'),h.context);await h.context.download('script');assert.equal(h.writes.length,0);assert.equal(h.context.setupSession,setup);
 const shared=h.context.copy('link');h.resolve();await shared;assert.equal(h.writes.length,1);assert.match(h.writes[0],/#setup=/);
 h.context.prerequisiteGate.confirm(true);h.context.prerequisiteGate.accept('computer');h.context.updateExpiry();assert.equal(h.button.disabled,false);assert.equal(h.command.value,'');assert.equal(h.manual.hidden,true);assert.ok(h.gatedRegions.every(x=>!x.hidden));
 h.context.prerequisiteGate.confirm(false);h.context.updateExpiry();assert.equal(h.command.value,'');assert.equal(h.button.disabled,true);assert.ok(h.gatedRegions.every(x=>x.hidden));
});

/** Model a command block with its own code, translated Copy button, and live status.
 * @param {object} h Copy harness. @param {string} value Exact command. @returns {object} Block fixture.
 */
function preparationBlock(h,value){
 const classes=new Set(),status={textContent:''},selection={target:null};
 const range={selectNodeContents(target){selection.target=target;h.events.push('range');}};
 const document={createRange:()=>range,getSelection:()=>({removeAllRanges(){h.events.push('clear-selection');},addRange(selected){assert.equal(selected,range);h.events.push('add-range');}})};
 const block={parentElement:h.inner,textContent:value+' Copier',querySelector(selector){if(selector==='code')return code;if(selector==='[data-command-status]')return status;assert.fail('Unexpected block selector: '+selector);}};
 const code={isConnected:true,parentElement:block,ownerDocument:document,textContent:value,innerHTML:value.replaceAll('&','&amp;'),focus(){h.events.push('focus');},scrollIntoView(){h.events.push('scroll');}};
 const button={isConnected:true,innerHTML:'<span>Copier</span>',classList:{add:name=>classes.add(name)},closest(selector){assert.equal(selector,'[data-command-block]');return block;}};
 return {block,code,button,status,classes,selection};
}

test('preparation copies the clicked block exact text, excluding HTML and translated controls',async()=>{
 const h=harness(),primary=preparationBlock(h,'sudo apt update && sudo apt install curl git sudo bash'),recovery=preparationBlock(h,'sudo dnf install git sudo bash');
 h.context.prerequisiteGate.confirm(false);vm.runInContext(declaration('copyPrerequisites'),h.context);
 h.context.wizard.querySelector=()=>assert.fail('Preparation must use the clicked block, not a global command field.');
 for(const item of [recovery,primary,recovery]){
  const pending=h.context.copyPrerequisites(item.button);assert.equal(h.writes.at(-1),item.code.textContent);h.resolve();await pending;
  assert.equal(item.classes.has('copied'),true);assert.match(item.button.innerHTML,/<span>Copied<\/span>/);assert.equal(item.status.textContent,'Copied');
 }
 assert.deepEqual(h.writes,[recovery.code.textContent,primary.code.textContent,recovery.code.textContent]);
 assert.ok(h.writes.every(value=>!value.includes('&amp;')&&!value.includes('Copier')&&!value.includes('<')));
 assert.equal(h.context.prerequisiteGate.confirmed,false);assert.equal(h.context.prerequisiteGate.ready('computer'),false);
});

test('copying preparation never changes acknowledgement or accepts installation',async()=>{
 for(const confirmed of [false,true]){
  const h=harness(),item=preparationBlock(h,'brew install bash');h.context.prerequisiteGate.confirm(confirmed);
  vm.runInContext(declaration('copyPrerequisites'),h.context);
  const pending=h.context.copyPrerequisites(item.button);h.resolve();await pending;
  assert.equal(h.context.prerequisiteGate.confirmed,confirmed);assert.equal(h.context.prerequisiteGate.accepted,false);assert.equal(h.context.prerequisiteGate.ready('computer'),false);
  assert.equal(h.handoffSteps[1].attributes['aria-current'],undefined);
 }
});

test('denied or missing clipboard selects only the actual code with a DOM Range',async()=>{
 for(const missing of [false,true]){
  const h=harness(),item=preparationBlock(h,'sudo apt update && sudo apt install curl git sudo bash');h.context.prerequisiteGate.confirm(false);
  vm.runInContext(declaration('copyPrerequisites'),h.context);
  if(missing)delete h.context.navigator.clipboard;
  const pending=h.context.copyPrerequisites(item.button);if(!missing)h.reject();await pending;
  assert.equal(item.selection.target,item.code);assert.equal(h.outer.open,true);assert.equal(h.inner.open,true);
  assert.deepEqual(h.events,['focus','range','clear-selection','add-range','scroll']);
  assert.deepEqual(h.toasts,['Text selected. Use your device’s Copy action.']);assert.equal(item.classes.has('copied'),false);assert.equal(item.status.textContent,'');
  assert.equal(h.context.prerequisiteGate.confirmed,false);assert.equal(h.context.prerequisiteGate.ready('computer'),false);
 }
});

test('preparation previews allow only exact read-only system detection',async()=>{
 const h=harness();h.context.previewOnly=true;vm.runInContext(declaration('copyPrerequisites'),h.context);
 for(const command of ['sudo apt update && sudo apt install curl git sudo bash','sudo dnf install git sudo bash','xcode-select --install','brew install bash','cat /etc/os-release && sudo apt update']){
  const item=preparationBlock(h,command);await h.context.copyPrerequisites(item.button);
  assert.equal(item.classes.has('copied'),false);assert.equal(item.status.textContent,'');
 }
 assert.equal(h.writes.length,0);assert.equal(h.toasts.length,5);assert.ok(h.toasts.every(value=>value==='Preview only — no installation will run.'));
 const detection=preparationBlock(h,'cat /etc/os-release'),pending=h.context.copyPrerequisites(detection.button);h.resolve();await pending;
 assert.deepEqual(h.writes,['cat /etc/os-release']);assert.equal(detection.classes.has('copied'),true);assert.equal(detection.status.textContent,'Copied');
});

test('late preparation copy outcomes cannot update or select detached buttons or code',async()=>{
 for(const outcome of ['resolve','reject'])for(const detached of ['button','code']){
  const h=harness(),item=preparationBlock(h,'sudo dnf install git sudo bash');vm.runInContext(declaration('copyPrerequisites'),h.context);
  const pending=h.context.copyPrerequisites(item.button);item[detached].isConnected=false;h[outcome]();await pending;
  assert.equal(item.button.innerHTML,'<span>Copier</span>');assert.equal(item.status.textContent,'');assert.equal(item.classes.has('copied'),false);
  assert.equal(item.selection.target,null);assert.deepEqual(h.events,[]);assert.deepEqual(h.toasts,[]);
 }
});

test('missing or already detached preparation blocks never attempt clipboard access',async()=>{
 for(const unavailable of ['block','button','code']){
  const h=harness(),item=preparationBlock(h,'brew install bash');vm.runInContext(declaration('copyPrerequisites'),h.context);
  if(unavailable==='block')item.button.closest=()=>null;else item[unavailable].isConnected=false;
  await h.context.copyPrerequisites(item.button);assert.deepEqual(h.writes,[]);assert.deepEqual(h.events,[]);assert.deepEqual(h.toasts,[]);
 }
});

test('unavailable text selection does not claim the command was selected',async()=>{
 const h=harness(),item=preparationBlock(h,'xcode-select --install');item.code.ownerDocument.getSelection=()=>null;
 vm.runInContext(declaration('copyPrerequisites'),h.context);
 const pending=h.context.copyPrerequisites(item.button);h.reject();await pending;
 assert.equal(item.selection.target,null);assert.deepEqual(h.toasts,[]);assert.equal(item.status.textContent,'');assert.equal(item.classes.has('copied'),false);
});

test('changing prerequisite confirmation during session creation cancels install export',async()=>{
 const h=harness();let finish;h.context.installTracker.session=null;
 h.context.installTracker.connect=()=>new Promise(resolve=>{finish=resolve;});
 const pending=h.context.copy('command');h.context.prerequisiteGate.confirm(false);finish();await pending;
 assert.equal(h.writes.length,0);assert.equal(h.button.disabled,true);
});

test('reopened failed installation directs retry to prerequisites without promising a copied command',async()=>{
 const h=harness();h.context.prerequisiteGate.confirm(false);h.setNow(initialNow+100);
 h.context.installTracker.session={status:'failed'};h.context.issueSetup=state=>issueSetup(state,initialNow+100);
 h.context.persist=()=>{};h.context.render=()=>{};h.nodes['[data-prerequisite-confirm]']=h.command;
 vm.runInContext(declaration('retryInstallation'),h.context);await h.context.retryInstallation();
 assert.equal(h.writes.length,0);assert.deepEqual(h.events,['focus','scroll']);assert.equal(h.toasts.length,0);
});

test('checkbox alone cannot copy or download; Continue is the separate handoff action',async()=>{
 const h=harness();h.context.prerequisiteGate.confirm(false);const renders=[];h.context.render=focus=>renders.push(focus);
 vm.runInContext([declaration('continueToInstall'),declaration('reviewPrerequisites'),declaration('download')].join('\n'),h.context);
 h.context.continueToInstall();assert.equal(renders.length,0);
 h.context.prerequisiteGate.confirm(true);await h.context.copy('command');await h.context.download('script');assert.equal(h.writes.length,0);
 h.context.continueToInstall();assert.deepEqual(renders,[true]);assert.equal(h.context.prerequisiteGate.ready('computer'),true);
 h.context.reviewPrerequisites();assert.deepEqual(renders,[true,true]);assert.equal(h.context.prerequisiteGate.ready('computer'),false);assert.equal(h.context.prerequisiteGate.confirmed,false);
 h.context.prerequisiteGate.confirm(true);h.context.step='speech';h.context.continueToInstall();assert.equal(renders.length,2);assert.equal(h.context.prerequisiteGate.ready('computer'),false);
});

test('dedicated page updates Continue even when no install command elements exist',()=>{
 const h=harness(),next={disabled:true},ackStates=[];delete h.nodes['[data-install-action]'];delete h.nodes['#install-command'];
 h.nodes['[data-prerequisite-continue]']=next;h.nodes['.prerequisite-ack']={classList:{toggle:(name,value)=>ackStates.push(value)}};
 h.context.prerequisiteGate.confirm(false);h.context.updateExpiry();assert.equal(next.disabled,true);
 h.context.prerequisiteGate.confirm(true);h.context.updateExpiry();assert.equal(next.disabled,false);assert.equal(h.context.prerequisiteGate.ready('computer'),false);
 h.context.prerequisiteGate.selectFamily('unknown');h.context.updateExpiry();assert.equal(next.disabled,true);assert.deepEqual(ackStates,[false,true,false]);
});

test('failed launch preparation never falls back to an untracked script download',async()=>{
 const h=harness();h.context.installTracker.session=null;
 h.context.installTracker.connect=async()=>null;
 h.context.Blob=class {constructor(){assert.fail('No download may be built without its capability');}};
 vm.runInContext(declaration('download'),h.context);
 await h.context.download('script');
 assert.equal(h.context.trackingShown,false);
 assert.deepEqual(h.toasts,['Could not prepare your install command. Please try again.']);
});

test('report copy is scoped to the failed attempt and has a selectable fallback',async()=>{
 const {errorReportUrl}=await import('../dist/report-link.mjs');
 const value='https://paste.uoi.io/report123';
 const status={textContent:''},writes=[],fallback=[],toasts=[];
 let resolve,reject;
 const link={isConnected:true,getAttribute:()=>value};
 const block={querySelector:s=>s==='.report-url'?link:status};
 const button={isConnected:true,closest:()=>block,innerHTML:'Copy link'};
 const tracker={session:{id:'first',status:'failed',errorUrl:value}};
 const navigator={clipboard:{writeText(text){writes.push(text);return new Promise((a,b)=>{resolve=a;reject=b;});}}};
 const c=vm.createContext({errorReportUrl,installTracker:tracker,navigator,icon:x=>`[${x}]`,localize(){},revealCopyFallback:field=>{fallback.push(field);return true;},toast:x=>toasts.push(x)});
 vm.runInContext(declaration('copyReportLink'),c);
 let pending=c.copyReportLink(button);resolve();await pending;
 assert.deepEqual(writes,[value]);assert.match(button.innerHTML,/Copied/);assert.equal(status.textContent,'Copied');
 pending=c.copyReportLink(button);reject(new Error('denied'));await pending;
 assert.deepEqual(fallback,[link]);assert.equal(toasts.length,1);
 button.innerHTML='Copy link';status.textContent='';
 pending=c.copyReportLink(button);tracker.session={id:'second',status:'failed',errorUrl:value};resolve();await pending;
 assert.equal(button.innerHTML,'Copy link');assert.equal(status.textContent,'');
 pending=c.copyReportLink(button);button.isConnected=false;reject(new Error('denied'));await pending;
 assert.equal(fallback.length,1);
 button.isConnected=true;tracker.session.status='installed';await c.copyReportLink(button);assert.equal(writes.length,4);
 tracker.session={id:'third',status:'failed',errorUrl:'https://evil.test/a'};await c.copyReportLink(button);assert.equal(writes.length,4);
 tracker.session={id:'fourth',status:'failed',errorUrl:value};delete navigator.clipboard;
 await c.copyReportLink(button);assert.equal(fallback.length,2);
});

test('telemetry approval gates copied commands, downloads and failed-install retries',async()=>{
 for(const action of ['copy','script','yaml','retry']){
  const h=harness();h.context.answered.delete('telemetry');
  h.context.installTracker.session={status:'failed'};
  vm.runInContext([declaration('download'),declaration('retryInstallation')].join('\n'),h.context);
  const original=h.context.setupSession;
  if(action==='copy')await h.context.copy('command');
  else if(action==='retry')await h.context.retryInstallation();
  else await h.context.download(action);
  assert.equal(h.context.step,'telemetry',action);
  assert.deepEqual(h.events,['go:telemetry']);
  assert.equal(h.writes.length,0);assert.equal(h.context.setupSession,original);
 }
});
