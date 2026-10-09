import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WELCOME_TEXT,markOneFace,mouthFrame,sampleEnvelope,WelcomePlayback,eyeLevels,animateEyes} from '../dist/welcome.mjs';
import {nextQuestion,canGoBack} from '../dist/journey.mjs';
import {DEFAULTS} from '../dist/scenario.mjs';

const envelope=JSON.parse(readFileSync(new URL('../dist/assets/mark1-welcome-envelope.json',import.meta.url)));
function fixture({play=()=>Promise.resolve(),reducedMotion=false}={}){
  const events=new Map(),frames=[],states=[],done=[],scheduled=new Map();let count=0,pauses=0;
  const audio={currentTime:.8,play,pause(){pauses++;},addEventListener(k,v){events.set(k,v);},removeEventListener(k){events.delete(k);}};
  const player=new WelcomePlayback({audio,envelope,reducedMotion,onFrame:(...args)=>frames.push(args),onState:value=>states.push(value),onDone:value=>done.push(value),request:callback=>{scheduled.set(++count,callback);return count;},cancel:id=>scheduled.delete(id)});
  return {player,audio,events,frames,states,done,scheduled,pauses:()=>pauses};
}
test('welcome is separate from choices, with an intact 24-eye-LED and 32×8 front face',()=>{
  assert.equal(nextQuestion('welcome',DEFAULTS),'language');assert.equal(canGoBack('welcome',0,false),false);
  const svg=markOneFace();assert.equal((svg.match(/data-eye-led=/g)||[]).length,24);assert.equal((svg.match(/data-mouth-led=/g)||[]).length,256);
  assert.ok(svg.includes('mic-grille'));assert.equal(WELCOME_TEXT,'Welcome to the Open Voice OS Installer Wizard.');
});
test('mouth responds to real greeting amplitude and rests in a smile',()=>{
  assert.equal(mouthFrame().length,256);assert.ok(mouthFrame().some(Boolean));
  assert.deepEqual(mouthFrame(NaN),mouthFrame());assert.notDeepEqual(mouthFrame(1,true),mouthFrame());
  assert.equal(sampleEnvelope(envelope,-1),0);assert.equal(sampleEnvelope(envelope,NaN),0);assert.equal(sampleEnvelope(envelope,1000),0);
  assert.ok(envelope.duration>2&&envelope.duration<8);assert.ok(envelope.values.every(value=>value>=0&&value<=1));
  assert.equal(sampleEnvelope(envelope,.04),envelope.values[1]);
});
test('the two shared eye rings blink fully, reopen and stay within LED brightness bounds',()=>{
  assert.deepEqual(eyeLevels(0),Array(12).fill(1));assert.deepEqual(eyeLevels(2,false,0),Array(12).fill(0));
  assert.deepEqual(eyeLevels(2.4,false,1),Array(12).fill(1));assert.deepEqual(eyeLevels(2.68,false,.5),Array(12).fill(.5));
  assert.deepEqual(eyeLevels(3,false,5),eyeLevels(3,false,NaN));
  assert.ok(eyeLevels(.9,true).every(value=>value>=0&&value<=1));assert.notDeepEqual(eyeLevels(.9,true),eyeLevels(.9));
});
test('idle blinking is cancellable and reduced motion never schedules a frame',()=>{
  const frames=[],pending=new Map();let id=0,time=0;
  const options={clock:()=>time,random:()=>0,request:fn=>{pending.set(++id,fn);return id;},cancel:key=>pending.delete(key)};
  const stop=animateEyes(frame=>frames.push(frame),options);assert.equal(pending.size,1);
  const advance=value=>{time=value;const [key,tick]=pending.entries().next().value;pending.delete(key);tick();};
  advance(800);advance(890);assert.deepEqual(frames.at(-1),Array(12).fill(0));
  stop();stop();assert.equal(pending.size,0);assert.deepEqual(frames.at(-1),Array(12).fill(1));
  animateEyes(frame=>frames.push(frame),{...options,reducedMotion:true});assert.equal(pending.size,0);
});
test('random pauses and occasional double blinks continue while idle after speech',()=>{
  const sequence=[0,0,.1,0,0,.8,0,.9,.4];let time=0,next,frame,speaking=false;
  const stop=animateEyes(value=>{frame=value;},{clock:()=>time,random:()=>sequence.shift()??.5,speaking:()=>speaking,request:fn=>{next=fn;return 1;},cancel:()=>{next=null;}});
  const advance=value=>{time=value;next();};
  advance(800);advance(890);assert.equal(frame[0],0);advance(980);
  advance(1140);advance(1230);assert.equal(frame[0],0);advance(1320);
  advance(2000);assert.ok(frame.every(value=>value===1));
  speaking=true;advance(3000);assert.notDeepEqual(frame,Array(12).fill(1));
  speaking=false;advance(7120);advance(7210);assert.equal(frame[0],0);
  stop();assert.equal(next,null);assert.deepEqual(frame,Array(12).fill(1));
});
test('audio starts only on explicit start and ends once with animation stopped',async()=>{
  let plays=0;const f=fixture({play:()=>{plays++;return Promise.resolve();}});
  assert.equal(plays,0);assert.deepEqual(f.states,[]);await f.player.start();await f.player.start();assert.equal(plays,1);
  assert.deepEqual(f.states,['loading','playing']);assert.equal(f.scheduled.size,1);
  f.events.get('ended')();f.events.get('error')();assert.deepEqual(f.done,['ended']);assert.equal(f.scheduled.size,0);assert.equal(f.player.active,false);
  await f.player.start();assert.equal(plays,1);
});
test('skipping while play is pending cannot revive audio or advance twice',async()=>{
  let resolve;const f=fixture({play:()=>new Promise(done=>{resolve=done;})});const started=f.player.start();
  f.player.finish('skip');resolve();await started;assert.deepEqual(f.done,['skip']);assert.deepEqual(f.states,['loading']);assert.equal(f.scheduled.size,0);assert.ok(f.pauses()>0);
});
test('playback denial advances gracefully and reduced motion never schedules animated LEDs',async()=>{
  const denied=fixture({play:()=>Promise.reject(new Error('NotAllowedError'))});await denied.player.start();assert.deepEqual(denied.done,['error']);assert.equal(denied.scheduled.size,0);
  const reduced=fixture({reducedMotion:true});await reduced.player.start();assert.deepEqual(reduced.frames[0],[mouthFrame(),0,false]);assert.equal(reduced.scheduled.size,0);
  reduced.events.get('ended')();assert.deepEqual(reduced.done,['ended']);
});
test('navigation disposes the sound and pending callbacks without reopening the wizard',async()=>{
  let resolve;const f=fixture({play:()=>new Promise(done=>{resolve=done;})});const started=f.player.start();
  f.player.dispose();resolve();await started;assert.equal(f.events.size,0);assert.equal(f.scheduled.size,0);assert.deepEqual(f.done,[]);assert.equal(f.player.active,false);
});
test('changing motion preference stops and resumes only LED animation during speech',async()=>{
  let plays=0;const f=fixture({play:()=>{plays++;return Promise.resolve();}});await f.player.start();
  f.player.setReducedMotion(true);assert.equal(f.scheduled.size,0);assert.deepEqual(f.frames.at(-1),[mouthFrame(),0,false]);
  assert.equal(f.pauses(),0);assert.equal(plays,1);assert.equal(f.player.active,true);
  f.player.setReducedMotion(false);assert.equal(f.scheduled.size,1);
  f.player.setReducedMotion(false);assert.equal(f.scheduled.size,1);
  f.player.dispose();f.player.setReducedMotion(false);assert.equal(f.scheduled.size,0);
});
test('motion changes while audio loads cannot start a premature animation loop',async()=>{
  let resolve;const f=fixture({play:()=>new Promise(done=>{resolve=done;})});const started=f.player.start();
  f.player.setReducedMotion(true);f.player.setReducedMotion(false);assert.equal(f.scheduled.size,0);
  resolve();await started;assert.equal(f.scheduled.size,1);assert.equal(f.pauses(),0);
  f.events.get('ended')();f.player.setReducedMotion(false);assert.equal(f.scheduled.size,0);
});
