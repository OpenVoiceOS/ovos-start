import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, DEVICES, selectDevice, encodePreset } from '../dist/scenario.mjs';
import { installHandoff, reviewChoices, setupSummary, revealCopyFallback } from '../dist/handoff.mjs';

test('summary icons include actual enabled features in a stable order without altering choices',()=>{
  const state=Object.freeze({...DEFAULTS,device:'mark2',speech:'public',homeassistant:true,llmMode:'online',extraSkills:true});
  const summary=setupSummary(state);
  assert.deepEqual(summary.map(item=>item.target),['device','skills','speech','homeassistant','llm']);
  assert.equal(summary[0].value,'Mycroft Mark II');
  assert.equal(summary[1].value,'Everyday + extras');
  assert.equal(summary[2].icon,'globe');assert.equal(summary[2].value,'Online services');
  assert.equal(summary[4].value,'Online provider');
  assert.deepEqual(setupSummary({...state,skills:false,homeassistant:false,llmMode:'off'}).map(item=>item.target),['device','speech']);
  assert.deepEqual(setupSummary(state),summary);
});

test('summary distinguishes speech modes and never promises voice or AI on a hub',()=>{
  for(const [speech,icon,value] of [['auto','voice','Installer chooses'],['public','globe','Online services'],['local','chip','On device + online backup']]){
    const actual=setupSummary({...DEFAULTS,device:'pi',speech}).find(item=>item.target==='speech');
    assert.equal(actual.icon,icon);assert.equal(actual.value,value);
  }
  const hub=setupSummary({...DEFAULTS,device:'computer',experience:'hub',homeassistant:true,llmMode:'online'});
  assert.deepEqual(hub.map(item=>item.target),['device','purpose','skills']);
  assert.equal(hub[0].value,'Linux computer');assert.equal(hub[1].icon,'server');
  assert.equal(setupSummary({...DEFAULTS,device:'pi',llmMode:'local'}).at(-1).value,'My model server');
});

test('every handoff retains 64-bit prerequisites and sends Windows users to Ubuntu',()=>{
  for(const device of Object.keys(DEVICES)){
    const state=Object.freeze(selectDevice(DEFAULTS,device));
    const before=encodePreset(state),notes=installHandoff(state);
    assert.match(notes.requirement,device==='mac'?/Apple Silicon and macOS 15/:/64-bit/);
    assert.equal(encodePreset(state),before);
    if(device==='windows'){
      assert.equal(notes.terminal,'Ubuntu terminal in WSL2');
      assert.match(notes.requirement,/systemd/);assert.match(notes.audio,/WSLg/);
    }
    if(device==='mac')assert.match(notes.requirement,/Homebrew, Bash 4\+ and Xcode/);
    if(['mark2','devkit'].includes(device))assert.match(notes.requirement,/Debian 13.*Pi 4/);
  }
});

test('installation help retains speech, preview and integration information',()=>{
  const base=selectDevice(DEFAULTS,'pi');
  const online=installHandoff({...base,speech:'public'});
  assert.equal(online.preview,true);assert.match(online.speech,/voice and reply text.*online/);
  const local=installHandoff({...base,speech:'local'});
  assert.equal(local.preview,true);assert.match(local.speech,/online backup.*receive your voice/);
  const auto=installHandoff(base);assert.equal(auto.preview,false);assert.match(auto.speech,/may use online/);
  assert.equal(auto.integrations,'');
  for(const state of [{homeassistant:true},{llmMode:'online'},{llmMode:'local'}]){
    assert.match(installHandoff({...base,...state}).integrations,/terminal.*server details and keys/);
  }
  const hub=installHandoff({...base,experience:'hub'});
  assert.match(hub.speech,/installed and paired separately/);
  assert.equal(hub.preview,false);assert.equal(hub.audio,'');assert.equal(hub.integrations,'');
});

test('manual-copy fallback opens every disclosure before selecting the actual field',()=>{
  const order=[];
  const outer={tagName:'DETAILS',open:false,parentElement:null};
  const inner={tagName:'DETAILS',open:false,parentElement:outer};
  const wrapper={tagName:'DIV',hidden:true,parentElement:inner,classList:{contains:name=>name==='link-fallback'}};
  const field={isConnected:true,parentElement:wrapper,focus(){assert.equal(outer.open,true);assert.equal(inner.open,true);assert.equal(wrapper.hidden,false);order.push('focus');},select(){order.push('select');},scrollIntoView(options){assert.equal(options.block,'center');order.push('scroll');}};
  assert.equal(revealCopyFallback(field),true);
  assert.deepEqual(order,['focus','select','scroll']);
});

test('clipboard rejection after navigation cannot focus or reveal a stale field',()=>{
  assert.equal(revealCopyFallback(null),false);
  assert.equal(revealCopyFallback({isConnected:false,focus(){assert.fail('stale focus');}}),false);
});


test('compact review retains every edit destination and summarizes the confirmed choices',()=>{
  const state=Object.freeze({...selectDevice(DEFAULTS,'pi'),speech:'public',homeassistant:true,llmMode:'local',extraSkills:true});
  const before=encodePreset(state),choices=reviewChoices(state);
  assert.deepEqual(new Set(choices.map(x=>x.target)),new Set(['device','language','speech','skills','homeassistant','llm','purpose','guidance']));
  assert.equal(new Set(choices.map(x=>x.target)).size,choices.length);
  assert.equal(choices.find(x=>x.target==='speech').value,'Online services');
  assert.equal(choices.find(x=>x.target==='homeassistant').value,'Connect my server');
  assert.equal(choices.find(x=>x.target==='llm').value,'My model server');
  assert.equal(encodePreset(state),before);
});

test('hub review omits voice-only choices while local speech retains its online-backup meaning',()=>{
  const hub=reviewChoices({...selectDevice(DEFAULTS,'server'),experience:'hub',homeassistant:true,llmMode:'online'});
  assert.deepEqual(hub.map(x=>x.target),['device','language','skills','purpose','guidance']);
  const local=reviewChoices({...selectDevice(DEFAULTS,'computer'),speech:'local'});
  assert.match(local.find(x=>x.target==='speech').value,/online backup/);
  const empty=reviewChoices({...selectDevice(DEFAULTS,'computer'),skills:false,llmMode:'off'});
  assert.equal(empty.find(x=>x.target==='skills').value,'A blank canvas');
  assert.equal(empty.find(x=>x.target==='llm').value,'Off');
});


test('code fallback opens disclosures and selects only code contents using its owner document',()=>{
 const order=[],outer={tagName:'DETAILS',open:false,parentElement:null},inner={tagName:'DETAILS',open:false,parentElement:null};inner.parentElement=outer;
 const block={parentElement:inner,textContent:'sudo apt update && sudo apt install curl git sudo bash Copier'},range={selectNodeContents(target){assert.equal(target,code);order.push('select-code');}};
 const selection={removeAllRanges(){order.push('clear-selection');},addRange(value){assert.equal(value,range);order.push('add-range');}};
 const code={isConnected:true,parentElement:block,textContent:'sudo apt update && sudo apt install curl git sudo bash',ownerDocument:{getSelection:()=>selection,createRange:()=>range},focus(){assert.equal(outer.open,true);assert.equal(inner.open,true);order.push('focus');},scrollIntoView(options){assert.equal(options.block,'center');order.push('scroll');}};
 assert.equal(revealCopyFallback(code),true);assert.deepEqual(order,['focus','select-code','clear-selection','add-range','scroll']);
});

test('code fallback reports unavailable selection without inventing a successful range',()=>{
 const code={isConnected:true,parentElement:null,ownerDocument:{getSelection:()=>null,createRange(){assert.fail('No selection is available.');}},focus(){},scrollIntoView(){assert.fail('Unselected code must not report success.');}};
 assert.equal(revealCopyFallback(code),false);
 code.isConnected=false;code.focus=()=>assert.fail('Detached code cannot take focus.');assert.equal(revealCopyFallback(code),false);
});
