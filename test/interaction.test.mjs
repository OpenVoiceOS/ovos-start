import test from 'node:test';
import assert from 'node:assert/strict';
import {ChoiceInputGuard,focusCurrentChoice} from '../dist/interaction.mjs';

function fixture(){let time=0;return {guard:new ChoiceInputGuard(()=>time),at:value=>{time=value;}};}
function pointer(guard,target,{x=100,y=100,kind='mouse',detail=1}={}){guard.pointerDown({clientX:x,clientY:y,pointerType:kind},target);return guard.allowClick({detail},target);}

test('rapid same-position clicks cannot choose across normal or reduced-motion transitions',()=>{
  for(const delay of [0,180]){
    const {guard,at}=fixture();const old={},next={};
    assert.ok(pointer(guard,old));at(delay);guard.nextScreen();at(delay+60);
    assert.equal(pointer(guard,next),false);
    at(450);assert.ok(pointer(guard,next));
  }
});
test('a press originating on an old screen cannot click a replacement even after waiting',()=>{
  const {guard,at}=fixture();const old={},next={};guard.pointerDown({clientX:1,clientY:1,pointerType:'mouse'},old);
  guard.nextScreen();at(1000);assert.equal(guard.allowClick({detail:1},next),false);
  assert.ok(pointer(guard,next));
});
test('mouse multiclicks are ignored but deliberate movement and ordinary touch taps work',()=>{
  const {guard,at}=fixture();const a={},b={};assert.ok(pointer(guard,a));
  assert.equal(pointer(guard,a,{detail:2}),false);guard.nextScreen();at(190);
  assert.ok(pointer(guard,b,{x:120}));guard.nextScreen();at(700);
  assert.ok(pointer(guard,a,{kind:'touch'}));guard.nextScreen();at(900);
  assert.equal(pointer(guard,b,{kind:'touch'}),false);at(1200);assert.ok(pointer(guard,b,{kind:'touch'}));
});
test('held Enter/Space and old key presses cannot activate a new default; fresh keys and AT can',()=>{
  for(const key of ['Enter',' ']){
    const {guard}=fixture();const a={},b={};assert.ok(guard.keyDown({key,repeat:false},a));
    assert.ok(guard.allowClick({detail:0},a));guard.nextScreen();
    assert.equal(guard.keyDown({key,repeat:true},b),false);
    assert.ok(guard.keyDown({key,repeat:false},b));assert.ok(guard.allowClick({detail:0},b));
    guard.keyDown({key,repeat:false},b);guard.nextScreen();assert.equal(guard.allowClick({detail:0},a),false);
    assert.ok(guard.allowClick({detail:0},a));
  }
});
test('default focus keeps context and chooses enabled selection, then primary action, then heading',()=>{
  const make=id=>({id,attributes:{},classes:new Set(),getAttribute(k){return this.attributes[k];},setAttribute(k,v){this.attributes[k]=v;},classList:{add(){},remove(){}},addEventListener(){},focus(options){this.focused=options;}});
  const selected=make(''),primary=make(''),heading=make('step-title');
  for(const [saved,action,expected] of [[selected,primary,selected],[null,primary,primary],[null,null,heading]]){
    const root={querySelector(selector){if(selector.includes('aria-pressed')){assert.ok(selector.includes(':not(:disabled)'));assert.ok(selector.includes('.answer-card['));return saved;}if(selector.includes('data-confirm'))return action;return heading;}};
    assert.equal(focusCurrentChoice(root),expected);assert.deepEqual(expected.focused,{preventScroll:true});
    if(expected!==heading)assert.equal(expected.attributes['aria-describedby'],'step-title');
  }
});
test('cancelled or released keys do not swallow assistive activation, and release keeps newer presses',()=>{
  const {guard}=fixture(),a={},b={};guard.keyDown({key:' ',repeat:false},a);
  guard.keyDown({key:'Tab',repeat:false},a);assert.ok(guard.allowClick({detail:0},b));
  guard.keyDown({key:' ',repeat:false},a);let cleanup;guard.keyUp({key:' '},fn=>{cleanup=fn;});
  cleanup();assert.ok(guard.allowClick({detail:0},b));
  guard.keyDown({key:' ',repeat:false},a);guard.keyUp({key:' '},fn=>{cleanup=fn;});
  guard.keyDown({key:'Enter',repeat:false},b);cleanup();assert.equal(guard.allowClick({detail:0},a),false);
});
