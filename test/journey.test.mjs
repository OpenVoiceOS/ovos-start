import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, validateState } from '../dist/scenario.mjs';
import { speechEligibility } from '../dist/recommendations.mjs';
import { chooseHardware, chooseExperience, chooseCapability } from '../dist/flow.mjs';
import { nextQuestion, canExploreLocal, firstCapability, afterCapability, questionChapter, progressStages, canGoBack } from '../dist/journey.mjs';

test('review navigation remains available without a trail; the welcome screen has no Back', () => {
  assert.equal(canGoBack('language',0,false),false);
  assert.equal(canGoBack('review',0,false),true);
  assert.equal(canGoBack('speech',3,false),true);
  assert.equal(canGoBack('device',0,true),true);
  assert.equal(canGoBack('device',0,false,'prepare'),true);
});

test('each ordinary transition asks a single named question before review', () => {
  const state={...DEFAULTS,device:'mark2',channel:'alpha'};
  const questions=[];
  for(let q='language';q!=='review';q=nextQuestion(q,state))questions.push(q);
  assert.deepEqual(questions,['language','device','prepare','speech']);
  assert.throws(()=>nextQuestion('invented',state));
});

test('headless setup skips speech, skill confirmation and unavailable integrations', () => {
  const state={...DEFAULTS,device:'server',experience:'hub'};
  assert.equal(nextQuestion('device',state),'prepare');assert.equal(nextQuestion('prepare',state),'review');
  assert.equal(nextQuestion('skills',state),'review');
  assert.equal(canExploreLocal(state),false);
  assert.equal(progressStages('purpose',{...state,device:null},new Set(['language']))[1].status,'upcoming');
  assert.equal(progressStages('device',{...state,device:null},new Set(['language','device']))[1].status,'current');
});

test('local capability branching stops after unknown or incompatible answers', () => {
  assert.equal(firstCapability({...DEFAULTS,device:'pi'}),'piModel');
  assert.equal(afterCapability('piModel',{piModel:'older'}),'speech');
  assert.equal(afterCapability('piModel',{piModel:'unknown'}),'speech');
  assert.equal(afterCapability('piModel',{piModel:'pi5'}),'memory');
  for(const memory of ['unknown','under8'])assert.equal(afterCapability('memory',{device:'computer',memory}),'speech');
  assert.equal(afterCapability('memory',{device:'computer',memory:'8plus'}),'cpu');
  assert.equal(afterCapability('cpu',{device:'computer',cpu:'unknown'}),'speech');
  assert.equal(firstCapability({...DEFAULTS,device:'mac'}),'cpu');
  assert.equal(afterCapability('cpu',{device:'mac',cpu:'intel-mac'}),'speech');
  assert.equal(afterCapability('cpu',{device:'mac',cpu:'arm64'}),'memory');
  assert.equal(afterCapability('memory',{device:'mac',memory:'8plus'}),'speech');
  for(const device of ['mark1','mark2','devkit'])assert.equal(firstCapability({...DEFAULTS,device}),'speech');
  assert.equal(canExploreLocal({...DEFAULTS,device:'computer',locale:'hi-in'}),false);
});

test('same-device edits retain confirmed capabilities and chosen speech', () => {
  const local={...DEFAULTS,device:'computer',memory:'8plus',cpu:'avx2',speech:'local',channel:'alpha'};
  assert.deepEqual(chooseHardware(local,'computer'),local);
  assert.equal(chooseHardware(local,'pi').memory,'unknown');
});

test('changing purpose normalizes dependent features immediately for review edits', () => {
  const voice={...DEFAULTS,device:'computer',memory:'8plus',cpu:'avx2',speech:'local',channel:'alpha',homeassistant:true,llmMode:'online'};
  const hub=chooseExperience(voice,'hub');
  assert.equal(hub.speech,'auto');assert.equal(hub.homeassistant,false);assert.equal(hub.llmMode,'off');assert.equal(hub.channel,'alpha');
  assert.deepEqual(validateState(hub),hub);
  const containers=chooseExperience({...DEFAULTS,device:'computer',method:'containers',extraSkills:true},'hub');
  assert.equal(containers.extraSkills,false);validateState(containers);
});

test('adaptive questions keep a compact four-chapter progress indicator', () => {
  assert.equal(questionChapter('language'),1);assert.equal(questionChapter('guidance'),4);
  assert.equal(questionChapter('device'),2);assert.equal(questionChapter('memory'),2);
  assert.equal(questionChapter('homeassistant'),4);assert.equal(questionChapter('review'),4);
});

test('progress marks only accepted stages complete and keeps capability questions in Device',()=>{
  const partial=new Set(['language','guidance']);
  assert.deepEqual(progressStages('purpose',DEFAULTS,partial).map(stage=>stage.status),['complete','upcoming','upcoming','current']);
  const accepted=new Set([...partial,'purpose','device']);
  assert.deepEqual(progressStages('memory',{...DEFAULTS,device:'computer'},accepted).map(stage=>stage.status),['complete','current','upcoming','upcoming']);
  assert.equal(progressStages('speech',{...DEFAULTS,device:null},accepted)[1].status,'upcoming');
});
test('hub progress names skipped Speech without claiming it was completed',()=>{
  const accepted=new Set(['language','guidance','purpose','device','prepare']);
  const stages=progressStages('review',{...DEFAULTS,experience:'hub',device:'server'},accepted);
  assert.deepEqual(stages.map(stage=>stage.status),['complete','complete','skipped','current']);
  assert.deepEqual(stages.map(stage=>stage.number),[1,2,3,4]);
});
test('targeted review edits retain other accepted stages and a single current stage',()=>{
  const accepted=new Set(['language','device','prepare','speech']);
  const state={...DEFAULTS,device:'mark2'};
  for(const question of ['language','device','speech','homeassistant']){
    const stages=progressStages(question,state,accepted);
    assert.equal(stages.filter(stage=>stage.status==='current').length,1);
    assert.equal(stages.filter(stage=>stage.status==='complete').length,question==='homeassistant'?3:2);
    assert.equal(stages[3].status,question==='homeassistant'?'current':'upcoming');
  }
});

test('unsure or unsupported details lead to speech once without choosing it silently', () => {
  const cases = [
    ['piModel',{...DEFAULTS,device:'pi',piModel:'older'}],
    ['piModel',{...DEFAULTS,device:'pi',piModel:'unknown'}],
    ['memory',{...DEFAULTS,device:'computer',memory:'under8'}],
    ['memory',{...DEFAULTS,device:'computer',memory:'unknown'}],
    ['cpu',{...DEFAULTS,device:'mac',cpu:'intel-mac'}],
    ['cpu',{...DEFAULTS,device:'computer',cpu:'unknown'}]
  ];
  for (const [question,state] of cases) {
    const next=afterCapability(question,state);
    assert.equal(next,'speech');
    assert.equal(speechEligibility(state).eligible,false);
    assert.equal(nextQuestion(next,state),'review');
    assert.equal(questionChapter(next),3);
    assert.equal(state.speech,'auto');
  }
});

test('capable Pi still needs a speech choice and offers an explicit way to revise specs', () => {
  const state={...DEFAULTS,device:'pi',piModel:'pi5',memory:'8plus',cpu:'arm64'};
  assert.equal(afterCapability('cpu',state),'speech');
  assert.equal(speechEligibility(state).eligible,true);
  assert.equal(firstCapability(state),'piModel');
  const before=new Set(['language','guidance','purpose','device']);
  assert.equal(progressStages('speech',state,before)[2].status,'current');
  assert.equal(progressStages('skills',state,before)[2].status,'upcoming');
  before.add('speech');
  assert.equal(progressStages('skills',state,before)[2].status,'complete');
});


test('Pi and Jetson use known ARM hardware and skip the redundant 64-bit question',()=>{
  for(const device of ['pi','jetson']){
    const original=Object.freeze({...DEFAULTS,device,piModel:device==='pi'?'pi5':'unknown'});
    for(const memory of ['under8','unknown','8plus']){
      const state=chooseCapability(original,'memory',memory);
      assert.equal(state.cpu,'arm64');
      assert.equal(afterCapability('memory',state),'speech');
      assert.equal(speechEligibility(state).eligible,memory==='8plus');
      assert.equal(state.speech,'auto');
    }
    assert.equal(original.cpu,'unknown');
  }
  const pc=chooseCapability({...DEFAULTS,device:'computer'},'memory','8plus');
  assert.equal(pc.cpu,'unknown');
  assert.equal(afterCapability('memory',pc),'cpu');
  for(const [key,value] of [['__proto__','arm64'],['memory','64'],['cpu','32bit']])assert.throws(()=>chooseCapability(pc,key,value));
});

/** Follow the actual device and capability transitions using a visitor's answers.
 * @param {string} device @param {object} answers @param {string} locale @returns {object}
 */
function reachSpeech(device,answers,locale='en-us') {
  let state=chooseHardware({...DEFAULTS,locale},device),question=nextQuestion('prepare',state);
  const path=[];
  while(question!=='speech'){
    assert.ok(['piModel','memory','cpu'].includes(question),question);
    assert.ok(path.length<3,'Capability questions must terminate');
    path.push(question);
    assert.ok(Object.hasOwn(answers,question),`Unexpected question: ${question}`);
    state=chooseCapability(state,question,answers[question]);
    question=nextQuestion(question,state);
  }
  return {state,path};
}

test('device details come before speech and stop at the first unavailable requirement',()=>{
  const cases=[
    ['pi',{piModel:'pi5',memory:'under8'},['piModel','memory'],false],
    ['pi',{piModel:'pi5',memory:'8plus'},['piModel','memory'],true],
    ['pi',{piModel:'older'},['piModel'],false],
    ['pi',{piModel:'unknown'},['piModel'],false],
    ['jetson',{memory:'8plus'},['memory'],true],
    ['computer',{memory:'unknown'},['memory'],false],
    ['computer',{memory:'8plus',cpu:'unknown'},['memory','cpu'],false],
    ['computer',{memory:'8plus',cpu:'avx2'},['memory','cpu'],true],
    ['windows',{memory:'8plus',cpu:'arm64'},['memory','cpu'],true],
    ['mac',{cpu:'intel-mac'},['cpu'],false],
    ['mac',{cpu:'arm64',memory:'8plus'},['cpu','memory'],true],
    ['mark2',{},[],false],
  ];
  for(const [device,answers,path,eligible] of cases){
    const result=reachSpeech(device,answers);
    assert.deepEqual(result.path,path,device);
    assert.equal(speechEligibility(result.state).eligible,eligible,device);
    assert.equal(result.state.speech,'auto','Hardware answers cannot accept speech');
    assert.equal(nextQuestion('speech',result.state),'review');
  }
  assert.deepEqual(reachSpeech('pi',{},'hi-in').path,[]);
});

test('starter skills never add a mandatory question, but remain a review edit destination',()=>{
  for(const expertise of ['guided','tinker','expert'])for(const experience of ['ready','tinker','hub']){
    const state=chooseHardware(chooseExperience({...DEFAULTS,expertise},experience),'computer');
    const path=[];
    for(let question='language';question!=='review';question=nextQuestion(question,state)){
      assert.ok(path.length<12,'The setup must terminate');path.push(question);
    }
    assert.equal(path.includes('skills'),false,`${expertise}/${experience}`);
    assert.equal(path.includes('homeassistant'),false);assert.equal(path.includes('llm'),false);assert.equal(path.includes('guidance'),false);assert.equal(path.includes('purpose'),false);
    assert.equal(questionChapter('skills'),4);
  }
  assert.deepEqual(progressStages('review', {...DEFAULTS,device:'computer'},new Set(['language','device','prepare','speech'])).map(stage=>stage.status),['complete','complete','complete','current']);
});
