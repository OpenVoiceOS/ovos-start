import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {canRotateTrivia,TriviaRotation} from '../dist/trivia-rotation.mjs';
import {PROJECT_FACTS,updateTriviaNote} from '../dist/facts.mjs';

/** Run deterministic reading intervals without sleeping. @returns {object} Fake clock. */
function clock() {
  let now=0,sequence=0;
  const timers=new Map();
  return {
    setTimer(callback,delay){const id=++sequence;timers.set(id,{at:now+delay,callback});return id;},
    clearTimer(id){timers.delete(id);},
    get pending(){return timers.size;},
    advance(duration){
      const until=now+duration;
      for(;;){
        const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
        if(!next||next[1].at>until)break;
        now=next[1].at;timers.delete(next[0]);next[1].callback();
      }
      now=until;
    },
  };
}

test('only healthy active installation rotates; waiting, completion and interruptions stay still',()=>{
  for(const status of ['started','downloading','installing'])assert.equal(canRotateTrivia({session:{status}}),true,status);
  for(const status of ['waiting','installed','services_ready','voice_ready','failed','cancelled',undefined]){
    assert.equal(canRotateTrivia({session:{status}}),false,status);
  }
  assert.equal(canRotateTrivia({}),false);
  for(const model of [{session:{status:'installing'},error:'network'},{session:{status:'installing',attention:true}}]){
    assert.equal(canRotateTrivia(model),false);
  }
  for(const options of [{visible:false},{reducedMotion:true},{interacting:true},{paused:true}]){
    assert.equal(canRotateTrivia({session:{status:'installing'}},options),false);
  }
});

test('trivia rotates every 20 seconds even when frequent progress polls resynchronize it',()=>{
  const time=clock();let rotations=0;
  const rotation=new TriviaRotation({...time,canRotate:()=>true,onRotate:()=>rotations++});
  rotation.sync();
  for(let i=0;i<99;i++){time.advance(200);rotation.sync();}
  assert.equal(rotations,0);assert.equal(time.pending,1);
  time.advance(200);assert.equal(rotations,1);assert.equal(time.pending,1);
  time.advance(40000);assert.equal(rotations,3);assert.equal(time.pending,1);
  rotation.stop();assert.equal(time.pending,0);
});

test('default browser timers keep their native receiver instead of binding the rotation controller',()=>{
  const source=readFileSync(new URL('../dist/trivia-rotation.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
  let callback,cleared,delay;
  const context=vm.createContext({
    setTimeout(fn,ms){assert.equal(this,undefined,'Window.setTimeout rejects an unrelated receiver');callback=fn;delay=ms;return 7;},
    clearTimeout(id){assert.equal(this,undefined,'Window.clearTimeout rejects an unrelated receiver');cleared=id;},
  });
  vm.runInContext(`'use strict';\n${source}\nglobalThis.rotation=new TriviaRotation({canRotate:()=>true,onRotate:()=>{}});`,context);
  context.rotation.sync();assert.equal(typeof callback,'function');assert.equal(delay,20000);
  context.rotation.stop();assert.equal(cleared,7);
});

test('manual next restarts the reading interval and cannot leave competing timers',()=>{
  const time=clock();let rotations=0;
  const rotation=new TriviaRotation({...time,canRotate:()=>true,onRotate:()=>rotations++});
  rotation.sync();time.advance(19000);rotation.restart();rotation.restart();
  assert.equal(time.pending,1);
  time.advance(19999);assert.equal(rotations,0);
  time.advance(1);assert.equal(rotations,1);
});

test('hidden, paused or interrupted trivia cancels rotation and resumes after a full interval',()=>{
  const time=clock();let rotations=0,allowed=true;
  const rotation=new TriviaRotation({...time,canRotate:()=>allowed,onRotate:()=>rotations++});
  rotation.sync();time.advance(19000);allowed=false;rotation.sync();
  assert.equal(time.pending,0);time.advance(100000);assert.equal(rotations,0);
  allowed=true;rotation.sync();time.advance(19999);assert.equal(rotations,0);
  time.advance(1);assert.equal(rotations,1);
  // Recheck eligibility even if a late timer races with the browser's visibility event.
  allowed=false;time.advance(20000);assert.equal(rotations,1);assert.equal(time.pending,0);
});

test('automatic refresh updates the story and source quietly while preserving the focused control',()=>{
  const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
  const declaration=source.match(/^function advanceTrivia\([^\n]*\) \{[\s\S]*?^\}/m)[0];
  const story={textContent:'Old fact',attributes:{},setAttribute(name,value){this.attributes[name]=value;}};
  const link={href:'',setAttribute(){}},control=Object.freeze({focused:true});
  const nodes={'[data-fact-text]':story,a:link,'[data-next-trivia]':control};
  const note={querySelector:selector=>nodes[selector]};let restarts=0,translations=0;
  const context=vm.createContext({wizard:{querySelector:()=>note},state:{locale:'en-us'},currentFact:PROJECT_FACTS[0],
    drawTrivia(){},updateTriviaNote,applyTranslations(){translations++;},triviaRotation:{restart(){restarts++;}}});
  vm.runInContext(declaration,context);context.advanceTrivia(true);
  assert.equal(story.textContent,PROJECT_FACTS[0].text);assert.equal(link.href,PROJECT_FACTS[0].source);
  assert.equal(story.attributes['aria-live'],'off');assert.equal(restarts,0);assert.equal(translations,1);
  assert.equal(note.querySelector('[data-next-trivia]'),control);
  context.currentFact=PROJECT_FACTS[1];context.advanceTrivia();
  assert.equal(story.textContent,PROJECT_FACTS[1].text);assert.equal(story.attributes['aria-live'],'polite');
  assert.equal(restarts,1);assert.equal(note.querySelector('[data-next-trivia]'),control);
});

test('mounted trivia rotates only for the matching visible setup and pauses for reading or focus',()=>{
  const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
  const declaration=source.match(/^function triviaMayRotate\([^\n]*\) \{[\s\S]*?^\}/m)[0];
  const control={matches:()=>false};let hovered=false,focused=false;
  const note={hidden:false,matches:()=>hovered,contains:target=>focused&&target===control};
  const context=vm.createContext({wizard:{querySelector:()=>note},step:'review',setupSession:{code:'current'},
    document:{hidden:false,activeElement:control},motionQuery:{matches:false},triviaPaused:false,
    installTracker:{code:'current',snapshot:()=>({session:{status:'installing'}})},canRotateTrivia});
  vm.runInContext(declaration,context);assert.equal(context.triviaMayRotate(),true);
  hovered=true;assert.equal(context.triviaMayRotate(),false);hovered=false;
  focused=true;assert.equal(context.triviaMayRotate(),false);focused=false;
  context.document.hidden=true;assert.equal(context.triviaMayRotate(),false);context.document.hidden=false;
  note.hidden=true;assert.equal(context.triviaMayRotate(),false);note.hidden=false;
  context.installTracker.code='previous';assert.equal(context.triviaMayRotate(),false);context.installTracker.code='current';
  context.step='device';assert.equal(context.triviaMayRotate(),false);context.step='review';
  context.triviaPaused=true;assert.equal(context.triviaMayRotate(),false);context.triviaPaused=false;
  context.motionQuery.matches=true;assert.equal(context.triviaMayRotate(),false);
});

test('Resume restarts rotation after the pointer leaves without moving focus off its button',()=>{
  const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
  const declaration=source.match(/^function triviaMayRotate\([^\n]*\) \{[\s\S]*?^\}/m)[0];
  const resume={matches:selector=>selector==='[data-pause-trivia]'},link={matches:()=>false},next={matches:()=>false};
  let hovered=true,rotations=0;
  const note={hidden:false,matches:()=>hovered,contains:target=>[resume,link,next].includes(target)};
  const context=vm.createContext({wizard:{querySelector:()=>note},step:'review',setupSession:{code:'current'},
    document:{hidden:false,activeElement:resume},motionQuery:{matches:false},triviaPaused:true,
    installTracker:{code:'current',snapshot:()=>({session:{status:'installing'}})},canRotateTrivia});
  vm.runInContext(declaration,context);
  const time=clock(),rotation=new TriviaRotation({...time,canRotate:()=>context.triviaMayRotate(),onRotate:()=>rotations++});
  rotation.sync();assert.equal(time.pending,0);
  context.triviaPaused=false;rotation.sync();assert.equal(time.pending,0,'Hover still pauses reading');
  hovered=false;rotation.sync();time.advance(20000);
  assert.equal(rotations,1);assert.equal(context.document.activeElement,resume,'Resume preserves keyboard focus');
  context.document.activeElement=link;rotation.sync();time.advance(40000);
  assert.equal(rotations,1,'The focused Backstory link keeps its current destination');
  context.document.activeElement=next;rotation.sync();time.advance(40000);
  assert.equal(rotations,1,'Manual browsing remains undisturbed');
  context.document.activeElement=resume;context.triviaPaused=true;rotation.sync();assert.equal(time.pending,0);
  context.triviaPaused=false;rotation.sync();time.advance(20000);
  assert.equal(rotations,2,'Keyboard Resume starts a fresh interval while the button remains focused');
});

test('the persistent pause control changes to resume without replacing the button',()=>{
  const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
  const declaration=source.match(/^function syncTriviaRotation\([^\n]*\) \{[\s\S]*?^\}/m)[0];
  const control={dataset:{},attributes:{},setAttribute(name,value){this.attributes[name]=value;}};
  let syncs=0;
  const context=vm.createContext({wizard:{querySelector:()=>control},motionQuery:{matches:false},
    installTracker:{session:{status:'installing'}},triviaPaused:false,state:{locale:'en-us'},icon:name=>name,
    applyTranslations(){},triviaRotation:{sync(){syncs++;}}});
  vm.runInContext(declaration,context);context.syncTriviaRotation();
  assert.equal(control.hidden,false);assert.equal(control.attributes['aria-label'],'Pause trivia');assert.equal(control.innerHTML,'pause');
  context.triviaPaused=true;context.syncTriviaRotation();
  assert.equal(control.attributes['aria-label'],'Resume trivia');assert.equal(control.innerHTML,'play');
  assert.equal(syncs,2);
  context.installTracker.session.status='installed';context.syncTriviaRotation();assert.equal(control.hidden,true);
  context.installTracker.session.status='installing';context.motionQuery.matches=true;
  context.syncTriviaRotation();assert.equal(control.hidden,true);
});
