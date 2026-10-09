import test from 'node:test';
import assert from 'node:assert/strict';
import {InstallTracker,progressCopy} from '../dist/install-progress.mjs';
import {progressView} from '../dist/post-install.mjs';
import {DEFAULTS} from '../dist/scenario.mjs';

const state={...DEFAULTS,device:'mark2'};
const passed={audioStatus:'passed',microphoneStatus:'passed'};
const installedStatuses=['installed','services_ready','voice_ready'];
const voicedDevices=['pi','computer','mark1','mark2','devkit','jetson','mac','windows','other'];

test('every voiced device celebrates both successful checks after installation',()=>{
  for(const device of voicedDevices)for(const status of installedStatuses){
    const html=progressView({session:{status,...passed}},{...state,device});
    assert.equal((html.match(/class="installation-success"/g)||[]).length,1,`${device}/${status}`);
    assert.match(html,/<h1[^>]+><em>OVOS<\/em> is ready!<\/h1>/);
    assert.match(html,/<p class="celebration-kicker">You did it!<\/p>/);
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert.doesNotMatch(html,/Now let’s try your voice\.|Open Terminal to finish the sound and voice checks\./);
  }
});

test('success removes the installation checklist and receipt without repeating the audio checks',()=>{
  for(const status of installedStatuses){
    const html=progressView({session:{status,...passed,completedSteps:['packages_installed','audio_configured','components_installed','services_started']}},state);
    assert.doesNotMatch(html,/class="installation-flow"|class="installation-stages"|data-install-step=|data-completed-step=|class="installation-receipt"|Installation complete/);
    assert.doesNotMatch(html,/data-audio-result=|celebration-checks|<span>Passed<\/span>/);
    assert.doesNotMatch(html,/class="voice-check-panel|Final audio checks|Check your speaker and microphone|At the first prompt|Answer the questions in Terminal|Keep this page open for the check result/);
    assert.equal((html.match(/data-copy-check\b/g)||[]).length,1,'a single optional recheck remains available');
    assert.equal((html.match(/id="post-check-command"/g)||[]).length,1);
  }
});

test('the installation checklist disappears immediately after installation while audio is still pending',()=>{
  for(const status of installedStatuses)for(const error of [undefined,'unavailable','expired']){
    const html=progressView({session:{status,audioStatus:'pending',microphoneStatus:'pending',completedSteps:['packages_installed','audio_configured','components_installed','services_started']},error},state);
    assert.doesNotMatch(html,/class="installation-flow"|class="installation-stages"|data-install-step=|data-completed-step=|class="installation-receipt"|Installation complete/,`${status}/${error}`);
    assert.match(html,/class="voice-check-panel/,'the next audio action remains visible');
    assert.doesNotMatch(html,/class="installation-success"/);
  }
});

test('pending, checking or failed audio cannot trigger a celebration even after voice_ready',()=>{
  for(const status of installedStatuses)for(const field of ['audioStatus','microphoneStatus']){
    for(const result of ['pending','checking','failed']){
      const html=progressView({session:{status,...passed,[field]:result}},state);
      assert.doesNotMatch(html,/class="installation-success"|You did it!|is ready!/,`${status}/${field}/${result}`);
      assert.match(html,/class="voice-check-panel/);
      assert.equal((html.match(/data-audio-result=/g)||[]).length,2);
    }
  }
});

test('successful audio values cannot celebrate an uninstalled or stopped run',()=>{
  for(const status of ['waiting','started','downloading','installing','failed','cancelled']){
    const html=progressView({session:{status,...passed}},state);
    assert.doesNotMatch(html,/class="installation-success"|You did it!|is ready!/,status);
  }
});

test('startup password guidance stays absent after installation begins and after success',()=>{
  for(const status of ['installing',...installedStatuses])for(const error of [undefined,'unavailable','expired']){
    const html=progressView({session:{status,...passed},error},state);
    assert.doesNotMatch(html,/class="sudo-notice"|Terminal may ask for your password/,`${status}/${error}`);
  }
});

test('rerunning setup remains one secondary footer action instead of competing with success',()=>{
  for(const status of installedStatuses){
    const html=progressView({session:{status,...passed}},state);
    const header=html.match(/<header class="installation-heading">([\s\S]*?)<\/header>/)?.[1];
    assert.ok(header);
    assert.doesNotMatch(header,/data-rerun-wizard|Run the wizard again/);
    assert.equal((html.match(/data-rerun-wizard\b/g)||[]).length,1);
    assert.match(html,/<div class="rerun-footer"><button[^>]+class="text-button rerun-wizard"[^>]+data-rerun-wizard/);
  }
});

test('the celebration is one static, unfocusable decorative SVG',()=>{
  const html=progressView({session:{status:'installed',...passed}},state);
  const artwork=html.match(/<svg class="celebration-art"[^>]*>[\s\S]*?<\/svg>/g)||[];
  assert.equal(artwork.length,1);
  assert.match(artwork[0],/aria-hidden="true"/);
  assert.match(artwork[0],/focusable="false"/);
  assert.doesNotMatch(artwork[0],/<animate\b|<animateTransform\b|<set\b|<image\b|tabindex|aria-live|\bon\w+=/);
  assert.doesNotMatch(html,/mark1-eye--animated| is-working /);
});

test('headless hubs retain pairing guidance rather than celebrating spoken audio',()=>{
  const html=progressView({session:{status:'voice_ready',...passed}},{...state,device:'server',experience:'hub'});
  assert.doesNotMatch(html,/class="installation-success"|You did it!|data-audio-result=/);
  assert.match(html,/Connect your first satellite/);
});

test('legacy voice-ready reports still render the confirmed success screen',()=>{
  const html=progressView({session:{status:'voice_ready'}},state);
  assert.match(html,/class="installation-success"/);
  assert.doesNotMatch(html,/data-audio-result=|celebration-checks/);
});

test('live audio updates enter success without a status change and leave it for a failed recheck',async()=>{
  const now=1800000000;
  let value={id:'b'.repeat(32),launchToken:'d'.repeat(22),status:'services_ready',attention:false,createdAt:now,updatedAt:now,expiresAt:now+86400,audioStatus:'pending',microphoneStatus:'pending'};
  let html='',complete=false;
  const tracker=new InstallTracker({
    fetcher:async()=>Response.json(value),credential:()=> 'a'.repeat(64),
    now:()=>now*1000,schedule:()=>1,cancel:()=>{},
    onChange:model=>{html=progressView(model,state);complete=progressCopy(model).complete;},
  });
  try{
    await tracker.connect('recipe');
    assert.equal(complete,false);
    assert.doesNotMatch(html,/class="installation-success"/);
    value={...value,updatedAt:now+1,audioStatus:'passed',microphoneStatus:'checking'};
    await tracker.poll();
    assert.equal(complete,false);
    assert.doesNotMatch(html,/class="installation-success"/);
    value={...value,updatedAt:now+2,microphoneStatus:'passed'};
    await tracker.poll();
    assert.equal(tracker.session.status,'services_ready');
    assert.equal(complete,true);
    assert.match(html,/class="installation-success"/);
    value={...value,updatedAt:now+3,microphoneStatus:'failed',attention:true};
    await tracker.poll();
    assert.equal(complete,false);
    assert.doesNotMatch(html,/class="installation-success"/);
    assert.match(html,/audio-result--failed" data-audio-result="microphone"/);
  }finally{
    tracker.stop();
  }
});
