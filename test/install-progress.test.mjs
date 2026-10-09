import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {InstallTracker,progressCopy,guideKind,VOICE_EXAMPLES,CHECK_COMMAND,DEMOS,installationStages,installationMilestones,installationTiming,installationUpdate,audioChecks,installationReceipts} from '../dist/install-progress.mjs';
import {progressView,timingView} from '../dist/post-install.mjs';
import {DEFAULTS,DEVICES} from '../dist/scenario.mjs';
import {issueSetup,buildShortCommand,buildSetupScript,readSetupSession} from '../dist/short-setup.mjs';
const base={...DEFAULTS,device:'pi'},now=1800000000;
const session={id:'b'.repeat(32),launchToken:'d'.repeat(22),status:'waiting',attention:false,createdAt:now,updatedAt:now,expiresAt:now+86400};
const reply=(value=session,status=200)=>Response.json(value,{status});

test('device artwork and readable name remain together throughout installation',()=>{
  for(const status of ['downloading','installing','failed','installed']){
    const html=progressView({session:{...session,status}},{...base,device:'mark2'});
    assert.match(html,/<p class="progress-device"><span class="device-symbol" aria-hidden="true"><img src="\.\/assets\/hardware-mark2\.png" alt=""[^>]+><\/span><span>Mycroft Mark II<\/span><\/p>/);
  }
});

test('installation completion exposes localized next steps without claiming voice works',()=>{
  for(const status of ['waiting','started','downloading','installing','failed','cancelled'])assert.equal(progressCopy({session:{...session,status}}).installed,false);
  for(const status of ['installed','services_ready']){const copy=progressCopy({session:{...session,status}});assert.equal(copy.installed,true);assert.equal(copy.complete,false);}
  assert.equal(progressCopy({session:{...session,status:'voice_ready'}}).complete,true);
  assert.equal(progressCopy({session:{...session,status:'voice_ready'},error:'unavailable'}).installed,true);
});
test('guidance respects language, hub and skill selection, with real video links',()=>{
  for(const locale of Object.keys(VOICE_EXAMPLES)){
    const state={...base,locale},html=progressView({session:{...session,status:'voice_ready'}},state);
    assert.equal(guideKind(state),'voice');assert.ok(html.includes(VOICE_EXAMPLES[locale]));assert.ok(html.includes('lang="'+locale+'"'));assert.match(html,/data-no-translate/);assert.match(html,/PRzGxmTCFb0/);assert.match(html,/C_xS87EbsiM/);assert.match(html,/Dutch audio/);
  }
  for(const [state,kind] of [[{...base,experience:'hub'},'hub'],[{...base,skills:false},'skills'],[{...base,locale:'hi-in'},'language']]){
    assert.equal(guideKind(state),kind);const html=progressView({session:{...session,status:'services_ready',attention:true}},state);assert.doesNotMatch(html,/Say “Hey Mycroft”/);if(kind==='hub')assert.doesNotMatch(html,/finish the sound and voice checks/);
  }
  assert.match(CHECK_COMMAND,/check-setup\.sh/);
});
test('new capability is only in executable artifact, never shared recipe link and never moves expiry',()=>{
  const artifact=issueSetup(base,now);const command=buildShortCommand(artifact,now,session.launchToken);
  assert.equal(command.split('\n').length,1);assert.ok(command.includes('/s/'+session.launchToken));assert.ok(command.startsWith('curl -qfsS -m120 '));assert.ok(!command.includes('c'.repeat(64)));assert.ok(!command.includes(artifact.code));
  const script=buildSetupScript(artifact,now,session.launchToken);assert.match(script,/mktemp/);assert.ok(script.includes('/s/'+session.launchToken));assert.doesNotMatch(script,/\| sh/);
  const restored=readSetupSession('#setup='+artifact.code,now);assert.equal(restored.expiresAt,artifact.expiresAt);assert.equal(restored.writeToken,undefined);assert.equal(restored.launchToken,undefined);
  for(const token of ['$(touch x)','x','a'.repeat(21),'a'.repeat(22)+'\n','a'.repeat(64)])assert.throws(()=>buildShortCommand(artifact,now,token));
  assert.throws(()=>buildShortCommand(artifact,now+3600,session.launchToken));
});
test('session restores from server without saving install capabilities and polling stops off screen',async()=>{
  const calls=[],timers=new Map();let n=0;const tracker=new InstallTracker({fetcher:async(url,options)=>{calls.push(JSON.parse(options.body));return reply();},schedule:fn=>{timers.set(++n,fn);return n;},cancel:id=>timers.delete(id)});
  await tracker.connect('code');await tracker.connect('code');assert.equal(calls.length,1);assert.equal(timers.size,1);tracker.stop();assert.equal(timers.size,0);
  await tracker.connect('code');assert.equal(timers.size,1);tracker.stop();
});
test('late response from an older recipe cannot replace the new owner session',async()=>{
  const pending=[];const tracker=new InstallTracker({fetcher:()=>new Promise(resolve=>pending.push(resolve)),schedule:()=>1,cancel(){}});
  const a=tracker.connect('A'),b=tracker.connect('B');pending[1](reply({...session,id:'d'.repeat(32)}));await b;pending[0](reply());await a;
  assert.equal(tracker.code,'B');assert.equal(tracker.session.id,'d'.repeat(32));tracker.stop();
});
test('poll and retry are single-flight; stale snapshots cannot regress completion',async()=>{
  let resolve;let calls=0;const tracker=new InstallTracker({fetcher:async()=>{calls++;if(calls===1)return reply({...session,status:'installed'});return new Promise(done=>{resolve=done;});},schedule:()=>1,cancel(){}});
  await tracker.connect('code');const a=tracker.poll(),b=tracker.retry();assert.equal(calls,2);resolve(reply({...session,status:'voice_ready',updatedAt:now+10}));await Promise.all([a,b]);assert.equal(tracker.session.status,'voice_ready');
  const stale=tracker.poll();resolve(reply({...session,status:'installed',updatedAt:now+1}));await stale;assert.equal(tracker.session.status,'voice_ready');tracker.stop();
  tracker.active=true;const sameSecond=tracker.poll();resolve(reply({...session,status:'services_ready',updatedAt:now+10}));await sameSecond;assert.equal(tracker.session.status,'voice_ready');tracker.stop();
});
test('loss of contact preserves confirmed installation and can recover',async()=>{
  let fail=false;const tracker=new InstallTracker({fetcher:async()=>{if(fail)throw Error('offline');return reply({...session,status:'installed'});},schedule:()=>1,cancel(){}});
  await tracker.connect('code');fail=true;await tracker.poll();assert.equal(tracker.session.status,'installed');assert.ok(tracker.error);fail=false;await tracker.retry();assert.equal(tracker.error,null);tracker.stop();
});
test('expired tracking stops retries without renewing setup or hiding the device check',async()=>{
  let calls=0;const timers=new Set();const tracker=new InstallTracker({fetcher:async()=>++calls===1?reply():reply({},410),schedule:fn=>{timers.add(fn);return fn;},cancel:fn=>timers.delete(fn)});
  await tracker.connect('code');await tracker.poll();assert.equal(tracker.error,'expired');assert.equal(timers.size,0);assert.equal(tracker.code,'code');assert.match(progressCopy(tracker.snapshot()).description,/24 hours/);tracker.stop();
});

test('video previews carry original JPEG bytes and need no late image request',()=>{
  const html=progressView({session:{...session,status:'installed'}},base);
  assert.equal((html.match(/class="demo-link"/g)||[]).length,2);
  assert.equal((html.match(/width="480" height="360" alt="" loading="lazy" decoding="async"/g)||[]).length,2);
  for(const demo of DEMOS){assert.ok(demo.thumbnail.startsWith('data:image/jpeg;base64,'));assert.deepEqual(Buffer.from(demo.thumbnail.split(',')[1],'base64'),readFileSync(new URL('../dist/assets/'+demo.asset,import.meta.url)));assert.ok(html.includes('src="'+demo.thumbnail+'"'));}
  assert.doesNotMatch(html,/<iframe|i\.ytimg\.com/);
});

test('waiting status has a clear title and compact reminder; failures retain an actionable retry',async()=>{
 const {waitingView}=await import('../dist/post-install.mjs');
 const waiting=waitingView({session});assert.match(waiting,/role="status"/);assert.match(waiting,/Waiting for your device/);
 assert.doesNotMatch(waiting,/<h\d|<p\b|Installation progress|Paste the command/);
 const offline=waitingView({error:'unavailable'});assert.match(offline,/Continue in Terminal/);assert.match(offline,/data-progress-retry/);
 const expired=waitingView({error:'expired'});assert.match(expired,/Installation updates have ended/);assert.doesNotMatch(expired,/data-progress-retry/);
});

test('keep-open guidance accompanies live waiting and installation, not finished or unavailable updates',async()=>{
 const {waitingView}=await import('../dist/post-install.mjs');
 const hint='Keep this page open to follow the installation.';
 assert.ok(waitingView({session}).includes(hint));
 for(const status of ['started','downloading','installing'])assert.ok(progressView({session:{...session,status}},base).includes('Keep this page open. Follow any prompts in Terminal.'),status);
 for(const status of ['installed','services_ready','voice_ready','failed','cancelled'])assert.ok(!progressView({session:{...session,status}},base).includes(hint),status);
 for(const error of ['expired','unavailable']){assert.ok(!waitingView({session,error}).includes(hint));assert.ok(!progressView({session:{...session,status:'installing'},error},base).includes(hint));}
});


test('missing or malformed launch capabilities cannot reach the command builder',async()=>{
 for(const launchToken of [undefined,'a'.repeat(21),'a'.repeat(22)+'\n','$(touch nope)']){
  const tracker=new InstallTracker({fetcher:async()=>reply({...session,launchToken}),schedule:()=>1,cancel(){}});
  assert.equal(await tracker.connect('code'),null);assert.equal(tracker.session,null);assert.equal(tracker.error,'unavailable');tracker.stop();
 }
});


test('activity is decorative and limited to healthy waiting or working states',async()=>{
 const {waitingView}=await import('../dist/post-install.mjs');
 const waiting=waitingView({session});assert.match(waiting,/install-waiting is-waiting/);assert.match(waiting,/class="mark1-eye mark1-eye--animated mark1-eye--compact"[^>]*aria-hidden="true"/);assert.match(waiting,/role="status" aria-live="polite" aria-atomic="true"/);assert.match(waiting,/<strong class="waiting-title">Waiting for your device<\/strong>/);
 assert.equal((waiting.match(/class="mark1-eye-ring"/g)||[]).length,1);
 assert.doesNotMatch(waiting,/aria-busy|progressbar|percent|[0-9]+%/);
 for(const status of ['started','downloading','installing'])assert.match(progressView({session:{...session,status}},base),/mark1-eye--animated/,status);
 for(const status of ['installed','services_ready','voice_ready','failed','cancelled'])assert.doesNotMatch(progressView({session:{...session,status}},base),/mark1-eye--animated/,status);
 for(const error of ['expired','unavailable']){
  assert.doesNotMatch(waitingView({session,error}),/mark1-eye--animated|is-waiting/);
  assert.doesNotMatch(progressView({session:{...session,status:'installing'},error},base),/mark1-eye--animated/);
 }
 assert.doesNotMatch(waitingView({}),/mark1-eye--animated|is-waiting/);
 assert.doesNotMatch(waitingView({session:{...session,attention:true}}),/mark1-eye--animated/);
 assert.doesNotMatch(progressView({session:{...session,status:'installing',attention:true}},base),/mark1-eye--animated/);
});

test('attention replaces the current task with one clear Terminal instruction and static eyes',()=>{
 const model={session:{...session,status:'installing',phase:2,attention:true}};
 const html=progressView(model,base);
 assert.match(html,/class="installation-current installation-current--attention"[^>]*role="status"/);
 assert.match(html,/<h2>A check needs your attention<\/h2><p>Open Terminal to finish the sound and voice checks\.<\/p>/);
 assert.equal((html.match(/Open Terminal to finish the sound and voice checks\./g)||[]).length,1);
 assert.equal((html.match(/class="mark1-eye-ring"/g)||[]).length,2);
 assert.doesNotMatch(html,/mark1-eye--animated/);
 const reconnected=progressView({session:{...model.session,attention:false}},base);
 assert.match(reconnected,/mark1-eye--animated/);
 assert.doesNotMatch(reconnected,/installation-current--attention|A check needs your attention/);
});


test('real milestones retain their last confirmed phase through reconnects and never imply voice readiness',()=>{
 for(const [status,current,completed] of [['started',0,0],['downloading',0,0],['installing',-1,1],['installed',-1,5],['services_ready',-1,5],['voice_ready',-1,5]]){
  const model={session:{...session,status}},stages=installationMilestones(model);
  assert.equal(stages.length,5);assert.equal(stages.findIndex(x=>x.state==='current'),current);assert.equal(stages.filter(x=>x.state==='complete').length,completed);
  assert.deepEqual(installationMilestones({...model,error:'unavailable'}),stages);
  const live=progressView(model,base),offline=progressView({...model,error:'unavailable'},base);
  assert.equal((live.match(/<h1/g)||[]).length,1);assert.doesNotMatch(live,/class="eyebrow"/);
  if(['started','downloading','installing'].includes(status))assert.match(offline,/Last confirmed progress/);assert.doesNotMatch(offline,/Updates paused|mark1-eye--animated|aria-valuenow|progressbar/);
  assert.ok(offline.replace(/<\/?em>/g,'').includes(['started','downloading','installing'].includes(status)?'Installing OVOS':progressCopy(model).title));
  if(status!=='voice_ready')assert.match(offline,/data-progress-retry/);
  if(['installed','services_ready'].includes(status)){assert.match(offline,/Voice check pending/);assert.doesNotMatch(offline,/Try your first question/);assert.equal(progressCopy(model).complete,false);}
 }
 for(const status of ['waiting','failed','cancelled'])assert.deepEqual(installationMilestones({session:{...session,status}}),[]);
 const expired=progressView({session:{...session,status:'installing'},error:'expired'},base);
 assert.match(expired,/Installation updates have ended/);assert.match(expired,/data-copy-check/);assert.doesNotMatch(expired,/data-progress-retry|mark1-eye--animated/);
});


test('simulated completion is labelled inside the headline and failed installs never show success content',()=>{
 const preview=progressView({session:{...session,status:'installed'}},base,{preview:true});
 assert.match(preview,/<h1[^>]*>Preview: <em>OVOS<\/em> is installed<\/h1>/);
 for(const error of [null,'unavailable']){
  const failed=progressView({session:{...session,status:'failed'},error},base);
  assert.match(failed,/Installation stopped/);assert.doesNotMatch(failed,/OVOS is installed|post-install-guide|demo-thumbnail|milestone-complete/);
 }
});


test('granular phases check completed work and keep remaining steps visible on failure',()=>{
 for(let phase=1;phase<=4;phase++){
  const model={session:{...session,status:'installing',phase,progressRank:3}};
  const steps=installationMilestones(model);assert.equal(steps.filter(s=>s.state==='complete').length,phase);assert.equal(steps[phase].state,'current');
  const failed={session:{...model.session,status:'failed'}};
  assert.equal(installationMilestones(failed)[phase].state,'stopped');
  const html=progressView(failed,base);assert.match(html,/Last reported step/);assert.doesNotMatch(html,/OVOS is installed|post-install-guide|mark1-eye--animated|Up next|Not reached/);
 }
});

test('legacy stopped runs keep download evidence without inventing the step that failed',()=>{
 for(const status of ['failed','cancelled'])for(const phase of [undefined,0]){
  const model={session:{...session,status,phase,progressRank:3,attention:true},error:'expired'};
  const stages=installationMilestones(model);
  assert.deepEqual(stages.map(stage=>stage.state),['complete','unknown','unknown','unknown','unknown']);
  const html=progressView(model,base);
  assert.match(html,/The exact step wasn’t reported/);
  assert.match(html,/Download installer<\/span><small>Completed/);
  assert.equal((html.match(/<small>Not confirmed<\/small>/g)||[]).length,4);
  assert.doesNotMatch(html,/Up next|Not reached|In progress|Last reported step|steps done|mark1-eye--animated|installation-layout|data-progress-retry|post-install-guide/);
  assert.match(html,/data-restart-install/);
  assert.equal(progressCopy(model).title,status==='failed'?'Installation stopped':'Installation cancelled');
 }
});

test('recovery shows help and an explicit retry without a duplicate device or simulated execution',()=>{
 const model={session:{...session,status:'failed',phase:3,progressRank:3}};
 const html=progressView(model,{...base,device:'mark2'},{preview:true});
 assert.equal((html.match(/Mycroft Mark II/g)||[]).length,1);
 assert.match(html,/Preview: Installation stopped/);
 assert.match(html,/href="https:\/\/matrix.to\/#\/#openvoiceos:matrix.org"/);
 assert.match(html,/After fixing the error, copy a new command. Your choices are saved./);
 assert.match(html,/data-restart-install disabled/);
 assert.match(html,/<details class="recovery-history"[^>]*><summary[^>]*>Installation details/);
 assert.doesNotMatch(html,/steps done|Estimated time left|Copy new command|Your setup|The exact step wasn’t reported/);
 assert.equal((html.match(/<small>Completed<\/small>/g)||[]).length,3);
 assert.match(html,/Set up services<\/span><small>Last reported step/);
 const cancelled=progressView({session:{...model.session,status:'cancelled'}},base);
 assert.match(cancelled,/You can start again with the same choices/);
 assert.doesNotMatch(cancelled,/Check the error|After fixing the error/);
 const disconnected=progressView({session:{...model.session,status:'installing'},error:'unavailable'},base);
 assert.match(disconnected,/data-progress-retry/);
 assert.doesNotMatch(disconnected,/install-recovery|data-restart-install/);
});

test('elapsed and ETA require real clocks and enough comparable samples; no zero countdown',()=>{
 const model={session:{...session,status:'installing',startedAt:now,updatedAt:now+120}};
 assert.equal(installationTiming(model,now+180).elapsedText,'3 min elapsed');assert.equal(installationTiming(model,now+180).remaining,null);
 model.session.estimate={samples:5,lowSeconds:600,highSeconds:1200};
 assert.equal(installationTiming(model,now+180).remaining,'About 7–17 min');
 assert.equal(installationTiming(model,now+1300).remaining,null);assert.equal(installationTiming(model,now+1300).note,'Taking longer than recent setups.');
 const disconnected=installationTiming({...model,error:'unavailable',observedAt:now+540},now+600);assert.equal(disconnected.elapsedText,'9 min elapsed');assert.equal(disconnected.remaining,null);
 const finished=installationTiming({session:{...model.session,status:'installed',installedAt:now+640}},now+5000);assert.equal(finished.elapsedText,'Finished in 11 min');assert.equal(finished.remaining,null);
 for(const bad of [null,{samples:4,lowSeconds:600,highSeconds:1200},{samples:5,lowSeconds:0,highSeconds:1200},{samples:5,lowSeconds:900,highSeconds:600}])assert.equal(installationTiming({session:{...model.session,estimate:bad}},now+180).remaining,null);
 assert.equal(installationTiming({session:{...session,status:'installing'}},now),null);
 assert.equal(installationTiming(model,now-1),null);
});

test('older same-second phase responses cannot regress an installation checkpoint',async()=>{
 let value={...session,status:'installing',phase:3};
 const tracker=new InstallTracker({fetcher:async()=>reply(value),schedule:()=>1,cancel(){}});
 await tracker.connect('recipe');value={...value,phase:1};await tracker.poll();assert.equal(tracker.session.phase,3);
 value={...value,phase:4};await tracker.poll();assert.equal(tracker.session.phase,4);tracker.stop();
});

test('detailed installation shows all five checkpoints and only confirms earlier work',()=>{
 for(const phase of [1,2,3,4]){
  const model={session:{...session,status:'installing',phase,progressRank:3}};
  const steps=installationStages(model);
  assert.equal(steps.length,5);
  assert.deepEqual(steps.map(step=>step.state),Array.from({length:5},(_,index)=>index<phase?'complete':index===phase?'current':'upcoming'));
  const html=progressView(model,base);
  assert.equal((html.match(/<li class="stage-/g)||[]).length,5);
  assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
  assert.equal((html.match(/class="mark1-eye mark1-eye--animated"/g)||[]).length,2);
  assert.ok(html.indexOf('mark1-eye')<html.indexOf('installation-stages'));
  assert.doesNotMatch(html,/Installation complete|percent|aria-valuenow/);
  for(const step of steps)assert.ok(html.includes(step.label));
  const offline=progressView({...model,error:'unavailable'},base);
  assert.match(offline,/class="mark1-eye"/);
  assert.doesNotMatch(offline,/mark1-eye--animated|Last device update/);
 }
});

test('device freshness ages real events, without mistaking polling for a heartbeat',()=>{
 const model={session:{...session,status:'installing',startedAt:now-600},observedAt:now};
 assert.equal(installationUpdate(model,now+59).text,'Last device update just now');
 assert.equal(installationUpdate(model,now+60).text,'Last device update 1 min ago');
 assert.equal(installationUpdate(model,now+119).note,null);
 const quiet=installationUpdate({...model,observedAt:now+120},now+120);
 assert.equal(quiet.text,'Last device update 2 min ago');
 assert.match(quiet.note,/Check Terminal for progress or a password prompt/);
 assert.equal(installationUpdate({...model,session:{...model.session,updatedAt:now+120}},now+120).note,null);
 for(const updatedAt of [undefined,null,0,-1,now+1,1.5,'1800000000'])assert.equal(installationUpdate({...model,session:{...model.session,updatedAt}},now),null);
 for(const status of ['waiting','installed','services_ready','voice_ready','failed','cancelled'])assert.equal(installationUpdate({...model,session:{...model.session,status}},now+120),null);
 for(const error of ['unavailable','expired'])assert.equal(installationUpdate({...model,error},now+120),null);
 assert.equal(installationUpdate({...model,session:{...model.session,attention:true}},now+120),null);
 assert.match(timingView(model,now+120),/12 min elapsed[\s\S]*Last device update 2 min ago[\s\S]*Some steps take a while/);
 assert.doesNotMatch(timingView({...model,error:'unavailable'},now+120),/Last device update|Some steps/);
});


test('coarse progress stays understandable without presenting unreported phases as problems',()=>{
 const model={session:{...session,status:'installing',phase:0,progressRank:3}};
 for(const status of ['waiting','failed','cancelled','invented'])assert.deepEqual(installationStages({session:{status}}),[]);
 assert.deepEqual(installationStages(model).map(x=>x.state),['complete','current','upcoming']);
 const html=progressView(model,base);
 assert.match(html,/aria-current="step"/);assert.doesNotMatch(html,/Not confirmed|exact step|steps done|Live updates|installation-companion|Time varies/);
 assert.equal((html.match(/<li class="stage-/g)||[]).length,3);
 assert.deepEqual(installationStages({...model,error:'unavailable'}),installationStages(model));
 for(const phase of [1,2,3,4]){const view=progressView({session:{...model.session,phase}},base);assert.ok(view.includes(installationMilestones({session:{...model.session,phase}})[phase].description));}
 assert.deepEqual(installationStages({session:{...session,status:'installed'}}).map(x=>x.state),['complete','complete','complete']);
});


test('installed services never imply verified voice; pending instructions match the terminal menu',()=>{
 for(const status of ['installed','services_ready'])for(const attention of [false,true])for(const error of [null,'unavailable','expired']){
  const html=progressView({session:{...session,status,attention},error},base);
  assert.match(html,/Installation complete/);assert.match(html,/Voice check pending/);
  assert.match(html,/At the first prompt, enter 1 and press Enter/);
  assert.match(html,attention?/Run the check again/:/Terminal already closed/);assert.match(html,/data-copy-check/);
  assert.doesNotMatch(html,/Your voice check passed|A check needs your attention|installation-stages|mark1-eye--animated/);
  assert.match(html,/<details class="voice-examples-preview"[^>]*><summary[^>]*>[\s\S]*?Try asking[\s\S]*?After your voice check[\s\S]*?Show examples[\s\S]*?<\/summary>/);
  assert.doesNotMatch(html,/<details class="voice-examples-preview"[^>]* open/);
  assert.equal((html.match(/id="post-check-command"/g)||[]).length,1);
  assert.equal(html.includes('Keep this page open for the check result.'),!error);
 }
});

test('voice confirmation reveals the guide and keeps a check-again disclosure',()=>{
 for(const error of [null,'unavailable']){
  const html=progressView({session:{...session,status:'voice_ready'},error},base);
  assert.match(html,/Your voice check passed/);assert.match(html,/Try asking/);
  assert.match(html,/Run the check again/);assert.match(html,/What time is it/);
  assert.doesNotMatch(html,/Voice check pending|At the first prompt|Terminal already closed|installation-stages/);
 }
});

test('final audio guidance appears during installation and reports independent device results',()=>{
 const hint='At the end, answer the speaker and microphone questions in Terminal.';
 for(const device of Object.keys(DEVICES)){
  assert.ok(progressView({session:{...session,status:'installing'}},{...base,device}).includes(hint));
 }
 assert.ok(!progressView({session:{...session,status:'installing'}},{...base,experience:'hub'}).includes(hint));
 const model={session:{...session,status:'services_ready',audioStatus:'passed',microphoneStatus:'failed',attention:true}};
 assert.deepEqual(audioChecks(model).map(check=>check.status),['passed','failed']);
 const html=progressView(model,base);
 assert.match(html,/audio-result--passed" data-audio-result="audio"/);
 assert.match(html,/audio-result--failed" data-audio-result="microphone"/);
 assert.match(html,/Microphone &amp; voice/);assert.match(html,/Results appear here/);
 assert.match(html,/<em>OVOS<\/em> is installed/);assert.doesNotMatch(html,/Installation stopped|Speaker and microphone checks passed/);
 assert.doesNotMatch(progressView(model,{...base,experience:'hub'}),/data-audio-result/);
 assert.deepEqual(audioChecks({session:{...session,status:'installed'}}).map(check=>check.status),['pending','pending']);
 const offline=audioChecks({session:{...session,status:'installed',audioStatus:'checking'},error:'unavailable'});
 assert.equal(offline[0].statusLabel,'Awaiting result');
});

test('a later failed voice check replaces old success without undoing installation',()=>{
 const old={session:{...session,status:'voice_ready'}};
 assert.deepEqual(audioChecks(old).map(check=>check.status),['passed','passed']);
 const rerun={session:{...old.session,audioStatus:'passed',microphoneStatus:'failed',attention:true}};
 assert.equal(progressCopy(rerun).complete,false);assert.equal(progressCopy(rerun).installed,true);
 const html=progressView(rerun,base);
 assert.match(html,/<em>OVOS<\/em> is installed/);assert.match(html,/audio-result--failed/);
 assert.doesNotMatch(html,/Your voice check passed|Speaker and microphone checks passed/);
 const complete=progressView({session:{...rerun.session,microphoneStatus:'passed',attention:false}},base);
 assert.match(complete,/Speaker and microphone checks passed/);
 assert.equal((complete.match(/audio-result--passed/g)||[]).length,2);
 assert.match(complete,/Run the check again/);
});

test('completed checks poll slowly for reruns, speed up for a new check and stop at expiry',async()=>{
 let clock=now*1000,value={...session,status:'voice_ready',audioStatus:'passed',microphoneStatus:'passed'};
 const delays=[];
 const tracker=new InstallTracker({fetcher:async()=>reply(value),now:()=>clock,schedule:(fn,delay)=>{delays.push(delay);return 1;},cancel(){}});
 await tracker.connect('code');assert.equal(delays.at(-1),30000);
 value={...value,audioStatus:'checking',microphoneStatus:'pending',updatedAt:now+1};await tracker.poll();assert.equal(delays.at(-1),5000);assert.equal(progressCopy(tracker.snapshot()).complete,false);
 value={...value,audioStatus:'failed',attention:true,updatedAt:now+2};await tracker.poll();assert.equal(audioChecks(tracker.snapshot())[0].status,'failed');
 clock=(value.expiresAt-1)*1000;tracker.queue();assert.equal(delays.at(-1),1000);
 clock=value.expiresAt*1000;const count=delays.length;tracker.queue();assert.equal(tracker.error,'expired');assert.equal(delays.length,count);tracker.stop();
});

test('tracker rejects unknown check values and accepts legacy absent fields',async()=>{
 for(const field of ['audioStatus','microphoneStatus'])for(const value of ['success','<script>',null,1,{}]){
  const tracker=new InstallTracker({fetcher:async()=>reply({...session,[field]:value}),schedule:()=>1,cancel(){}});
  assert.equal(await tracker.connect('code'),null);assert.equal(tracker.error,'unavailable');tracker.stop();
 }
});

test('completed task receipts stay factual across progress, failure and completion',()=>{
 const completedSteps=['packages_installed','components_installed'];
 for(const status of ['installing','failed','installed','services_ready','voice_ready']){
  const model={session:{...session,status,phase:4,progressRank:status==='installing'?3:4,completedSteps}};
  assert.deepEqual(installationReceipts(model).map(step=>step.id),completedSteps);
  const html=progressView(model,base);
  assert.match(html,/System packages installed/);assert.match(html,/OVOS components installed/);
  assert.doesNotMatch(html,/Audio configured|Services started/);
  if(status==='installing')assert.doesNotMatch(html,/class="installation-stages/);
 }
 for(const status of ['installing','installed','voice_ready']){
  assert.deepEqual(installationReceipts({session:{status,phase:4}}),[]);
  assert.doesNotMatch(progressView({session:{...session,status,phase:4}},base),/data-completed-step/);
 }
 const all=progressView({session:{...session,status:'services_ready',completedSteps:[...completedSteps,'audio_configured','services_started']}},base);
 assert.match(all,/Audio configured/);assert.match(all,/Services started/);
 assert.match(all,/<details class="install-help-short completed-install-details"/);
});

test('tracker validates task receipts and permits older sessions without them',async()=>{
 for(const completedSteps of [null,'packages_installed',{},['unknown'],['packages_installed','packages_installed'],['__proto__']]){
  const tracker=new InstallTracker({fetcher:async()=>reply({...session,completedSteps}),schedule:()=>1,cancel(){}});
  assert.equal(await tracker.connect('code'),null);assert.equal(tracker.error,'unavailable');tracker.stop();
 }
 for(const fields of [{},{completedSteps:[]},{completedSteps:['audio_configured','services_started']}]){
  const tracker=new InstallTracker({fetcher:async()=>reply({...session,...fields}),schedule:()=>1,cancel(){}});
  assert.ok(await tracker.connect('code'));tracker.stop();
 }
});

test('headless hubs get satellite and service guidance without a local voice check',()=>{
 for(const status of ['installed','services_ready'])for(const attention of [true,false]){
  const html=progressView({session:{...session,status,attention}},{...base,experience:'hub'});
  assert.match(html,/Connect a satellite/);assert.match(html,/Check OVOS services/);
  assert.doesNotMatch(html,/Voice check pending|speaker and microphone|At the first prompt|Check sound and microphone|Now let’s try your voice/);
 }
});

test('no-skills and unsupported-example locales get useful next steps without invented phrases',()=>{
 for(const state of [{...base,skills:false},{...base,locale:'hi-in'},{...base,locale:'kab-dz'}]){
  const pending=progressView({session:{...session,status:'services_ready'}},state);
  assert.match(pending,/Voice check pending/);assert.doesNotMatch(pending,/voice-example-grid/);
  const ready=progressView({session:{...session,status:'voice_ready'}},state);
  assert.doesNotMatch(ready,/Voice check pending|Say “Hey Mycroft”|voice-example-grid/);
  for(const html of [pending,ready])assert.match(html,state.skills===false?/Add your first skill/:/Examples for your language/);
 }
});

test('recovery labels unconfirmed prerequisites before promising a copied retry command',()=>{
 const model={session:{status:'failed'}};
 const html=progressView(model,{...DEFAULTS,device:'pi'},{prerequisitesReady:false});
 assert.match(html,/<span>Prepare to retry<\/span>/);assert.doesNotMatch(html,/<span>Copy retry command<\/span>/);
 assert.match(progressView(model,{...DEFAULTS,device:'pi'},{prerequisitesReady:true}),/<span>Copy retry command<\/span>/);
});

test('restart action is available for every installed state, including deferred or offline checks',()=>{
 for(const status of ['installed','services_ready','voice_ready'])for(const error of [null,'unavailable','expired']){
  const html=progressView({session:{...session,status,attention:true},error},base);
  assert.match(html,/data-rerun-wizard/);assert.match(html,/data-progress-focus="rerun-wizard"/);assert.match(html,/Your choices are kept/);
 }
 for(const status of ['waiting','started','downloading','installing','failed','cancelled'])assert.doesNotMatch(progressView({session:{...session,status}},base),/data-rerun-wizard/);
});

test('reset discards late connection and poll responses without mutating an old server record',async()=>{
 for(const phase of ['connect','poll']){
  const pending=[],calls=[],events=[];
  const tracker=new InstallTracker({fetcher:(url,options)=>{calls.push(JSON.parse(options.body));return new Promise(resolve=>pending.push(resolve));},schedule:()=>1,cancel(){},onChange:value=>events.push(value)});
  let old=tracker.connect('old');
  if(phase==='poll'){pending.shift()(reply({...session,status:'installed'}));await old;old=tracker.poll();}
  tracker.reset();assert.equal(tracker.session,null);assert.equal(tracker.code,null);assert.equal(tracker.active,false);
  const next=tracker.connect('new');pending[1](reply({...session,id:'a'.repeat(32)}));await next;
  pending[0](reply({...session,status:'voice_ready'}));await old;
  assert.equal(tracker.code,'new');assert.equal(tracker.session.status,'waiting');assert.equal(tracker.session.id,'a'.repeat(32));
  assert.ok(calls.every(call=>Object.keys(call).length===1));tracker.stop();
 }
});

test('tracking needs only the launch capability and discards legacy callback secrets',async()=>{
 const tracker=new InstallTracker({fetcher:async()=>new Response(JSON.stringify({...session,writeToken:'c'.repeat(64)}),{headers:{'Content-Type':'application/json'}}),schedule:()=>0,cancel:()=>{}});
 await tracker.connect('recipe');
 assert.equal(tracker.error,null);assert.equal(tracker.session.launchToken,session.launchToken);
 assert.equal(Object.hasOwn(tracker.session,'writeToken'),false);
 tracker.stop();
});

test('failure reports use direct safe paste links and fall back to Terminal otherwise',async()=>{
 const errorUrl='https://paste.uoi.io/Abc_123-xyz/';
 const model={session:{...session,status:'failed',errorUrl}};
 const html=progressView(model,base);
 assert.match(html,/Installation report/);assert.match(html,/data-copy-report/);
 assert.ok(html.includes(`href="${errorUrl}" target="_blank" rel="noopener noreferrer" data-no-translate`));
 assert.doesNotMatch(html,/This page doesn’t receive the error details|<iframe/);
 for(const value of [null,{},['https://paste.uoi.io/abc'],'http://paste.uoi.io/abc','https://paste.uoi.io.evil.test/a','https://u@paste.uoi.io/abc','https://paste.uoi.io:443/a','https://paste.uoi.io/a?token=x','https://paste.uoi.io/a\n','https://paste.uoi.io/..','https://paste.uoi.io/'+ 'a'.repeat(129),'javascript:alert(1)','https://paste.uoi.io/\"><img src=x>']){
   const invalid={...model.session,errorUrl:value};
   assert.doesNotMatch(progressView({session:invalid},base),/data-copy-report/);
   const tracker=new InstallTracker({fetcher:async()=>reply(invalid),schedule:()=>0,cancel(){}});
   await tracker.connect('code');assert.equal(tracker.session.status,'failed');assert.equal(Object.hasOwn(tracker.session,'errorUrl'),false);
 }
 const tracker=new InstallTracker({fetcher:async()=>reply(model.session),schedule:()=>0,cancel(){}});
 await tracker.connect('code');assert.equal(tracker.session.errorUrl,errorUrl);
 for(const status of ['cancelled','installed','services_ready','voice_ready'])assert.doesNotMatch(progressView({session:{...model.session,status}},base),/data-copy-report/);
});


test('live installation highlights OVOS, frames the task and explains sudo without claiming a detected prompt',()=>{
 const hint='If Terminal asks for your sudo password, enter your device password. Nothing appears while you type.';
 for(const status of ['started','downloading','installing']){
  const model={session:{...session,status,phase:1}};
  const html=progressView(model,base);
  assert.match(html,/class="install-progress install-dashboard[^"\n]* is-working /);
  assert.match(html,/<h1[^>]+>Installing <em>OVOS<\/em><\/h1>/);
  assert.equal((html.match(/class="mark1-eye-ring"/g)||[]).length,2);
  assert.match(html,/<p>[^<]+<\/p><\/div><svg class="mark1-eye/);
  assert.ok(html.includes(hint));
  for(const paused of [{...model,error:'unavailable'},{session:{...model.session,attention:true}}]){
   const stopped=progressView(paused,base);
   assert.doesNotMatch(stopped,/ is-working |mark1-eye--animated/);
  }
 }
 for(const status of ['installed','services_ready','voice_ready','failed','cancelled']){
  const html=progressView({session:{...session,status}},base);
  assert.doesNotMatch(html,/ is-working /);
  assert.ok(!html.includes(hint));
 }
});
