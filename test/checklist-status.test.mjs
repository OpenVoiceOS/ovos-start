import test from 'node:test';
import assert from 'node:assert/strict';
import {installationStages,progressCopy} from '../dist/install-progress.mjs';

const ids=['download','system','components','services','finish'];
const labels=['Download installer','Prepare your device','Install OVOS','Set up services','Finish installation'];

test('the handoff has no installation checklist before a device starts',()=>{
  for(const model of [{},{session:{status:'waiting'}},{session:{status:'unexpected'}}]){
    assert.deepEqual(installationStages(model),[]);
  }
});

test('every started, completed or stopped run retains the same five checkpoints',()=>{
  for(const status of ['started','downloading','installing','installed','services_ready','voice_ready','failed','cancelled']){
    const steps=installationStages({session:{status}});
    assert.deepEqual(steps.map(step=>step.id),ids,status);
    assert.deepEqual(steps.map(step=>step.label),labels,status);
    assert.ok(steps.every(step=>step.icon&&step.description&&Array.isArray(step.receipts)),status);
  }
});

test('startup shows the download as current and preserves the remaining path',()=>{
  for(const status of ['started','downloading']){
    const steps=installationStages({session:{status}});
    assert.deepEqual(steps.map(step=>step.state),['current','upcoming','upcoming','upcoming','upcoming']);
    assert.ok(steps.every(step=>step.receipts.length===0));
  }
});

test('reported phases advance the broad checkpoint without erasing future rows',()=>{
  for(const phase of [1,2,3,4]){
    const steps=installationStages({session:{status:'installing',phase,progressRank:3}});
    assert.deepEqual(steps.map(step=>step.state),Array.from({length:5},(_,index)=>index<phase?'complete':index===phase?'current':'upcoming'));
    assert.ok(steps.every(step=>step.receipts.length===0),'a phase is not a package, audio or service receipt');
  }
});

test('the first receipt attaches to its checkpoint without replacing the checklist',()=>{
  const steps=installationStages({session:{status:'installing',phase:2,completedSteps:['packages_installed']}});
  assert.deepEqual(steps.map(step=>step.id),ids);
  assert.deepEqual(steps[2].receipts,[{id:'packages_installed',label:'System packages installed'}]);
  assert.equal(steps[2].state,'current','a package receipt does not finish component installation');
  assert.deepEqual(steps.slice(3).map(step=>step.state),['upcoming','upcoming']);
  assert.ok(steps.filter(step=>step.id!=='components').every(step=>step.receipts.length===0));
});

test('all explicit receipts appear once under the right checkpoint in a stable order',()=>{
  const completedSteps=['services_started','components_installed','audio_configured','packages_installed','packages_installed','unknown'];
  const steps=installationStages({session:{status:'services_ready',completedSteps}});
  assert.deepEqual(steps.map(step=>step.receipts.map(receipt=>receipt.id)),[
    [],['audio_configured'],['packages_installed','components_installed'],['services_started'],[],
  ]);
  assert.equal(steps.flatMap(step=>step.receipts).length,4);
  assert.equal(completedSteps.length,6,'rendering must not mutate the server snapshot');
});

test('successful installation completes broad checkpoints without inventing receipts',()=>{
  for(const status of ['installed','services_ready','voice_ready']){
    const steps=installationStages({session:{status}});
    assert.deepEqual(steps.map(step=>step.state),Array(5).fill('complete'));
    assert.ok(steps.every(step=>step.receipts.length===0),'older runs may not report detailed completion receipts');
  }
});

test('older coarse reports keep unreported preparation and installation phases unknown',()=>{
  for(const phase of [undefined,0])for(const status of ['installing','failed','cancelled']){
    const steps=installationStages({session:{status,phase,progressRank:3}});
    assert.deepEqual(steps.map(step=>step.state),['complete','unknown','unknown','unknown','unknown']);
    assert.ok(steps.every(step=>step.receipts.length===0));
  }
});

test('stopped runs preserve known progress and show unreported steps without guessing',()=>{
  for(const status of ['failed','cancelled']){
    const known=installationStages({session:{status,phase:3,progressRank:3,completedSteps:['components_installed']}});
    assert.deepEqual(known.map(step=>step.state),['complete','complete','complete','stopped','unknown']);
    assert.deepEqual(known[2].receipts,[{id:'components_installed',label:'OVOS components installed'}]);
    const unreported=installationStages({session:{status}});
    assert.deepEqual(unreported.map(step=>step.state),Array(5).fill('unknown'));
    assert.ok(unreported.every(step=>step.receipts.length===0));
  }
});

test('tracking errors and attention preserve the last confirmed checklist and receipts',()=>{
  const session={status:'installing',phase:2,progressRank:3,completedSteps:['audio_configured','packages_installed']};
  const expected=installationStages({session});
  for(const error of ['unavailable','expired']){
    assert.deepEqual(installationStages({session,error}),expected);
  }
  assert.deepEqual(installationStages({session:{...session,attention:true}}),expected);
});

test('both reported audio checks complete any installed state without waiting for voice_ready',()=>{
  for(const status of ['installed','services_ready','voice_ready']){
    const session={status,audioStatus:'passed',microphoneStatus:'passed'};
    for(const error of [undefined,'unavailable','expired']){
      const copy=progressCopy({session,error});
      assert.equal(copy.installed,true);
      assert.equal(copy.complete,true,`${status}: both successful checks remain confirmed during ${error||'normal tracking'}`);
    }
  }
});

test('one unfinished or failed audio check never completes an installed run',()=>{
  for(const status of ['installed','services_ready','voice_ready']){
    for(const field of ['audioStatus','microphoneStatus'])for(const result of ['pending','checking','failed']){
      const session={status,audioStatus:'passed',microphoneStatus:'passed',[field]:result};
      assert.equal(progressCopy({session}).complete,false,`${status}: ${field} ${result}`);
    }
  }
});

test('audio results cannot declare completion before a confirmed installation',()=>{
  for(const status of ['waiting','started','downloading','installing','failed','cancelled']){
    const copy=progressCopy({session:{status,audioStatus:'passed',microphoneStatus:'passed'}});
    assert.equal(copy.installed,false);
    assert.equal(copy.complete,false,status);
  }
});

test('legacy voice_ready confirms audio while installed without results remains incomplete',()=>{
  assert.equal(progressCopy({session:{status:'voice_ready'}}).complete,true);
  for(const status of ['installed','services_ready']){
    assert.equal(progressCopy({session:{status}}).complete,false);
    assert.equal(progressCopy({session:{status,audioStatus:'passed'}}).complete,false);
    assert.equal(progressCopy({session:{status,microphoneStatus:'passed'}}).complete,false);
  }
});
