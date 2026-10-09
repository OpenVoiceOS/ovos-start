import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../dist/scenario.mjs';
import { PROJECT_FACTS,nextTrivia,readTriviaHistory,updateTriviaNote } from '../dist/facts.mjs';

test('each trivia card appears once before the deck restarts, without a boundary repeat',()=>{
  let history=[],last;
  for(let cycle=0;cycle<3;cycle++){
    const seen=new Set();
    for(let i=0;i<PROJECT_FACTS.length;i++){
      const next=nextTrivia(history,()=>.4);assert.notEqual(next.fact.id,last);assert.ok(!seen.has(next.fact.id));
      seen.add(next.fact.id);last=next.fact.id;history=next.history;
    }
    assert.equal(seen.size,PROJECT_FACTS.length);
  }
});

test('browser-local history survives reload and tolerates blocked or stale storage',()=>{
  const first=nextTrivia([],()=>0);
  const storage={getItem:()=>JSON.stringify(first.history)};
  const next=nextTrivia(readTriviaHistory(storage),()=>0);
  assert.notEqual(first.fact.id,next.fact.id);
  assert.deepEqual(readTriviaHistory({getItem:()=>{throw new Error('blocked');}}),[]);
  assert.deepEqual(readTriviaHistory({getItem:()=>'{bad'}),[]);
  assert.equal(nextTrivia(['removed-id'],()=>0).history.length,1);
  assert.ok(nextTrivia(null,()=>NaN).fact);
});

test('facts have unique IDs, direct primary sources, and never mutate recipe choices',()=>{
  const allowed=new Set(['www.openvoiceos.org','openvoiceos.org','openvoiceos.github.io','github.com','blog.openvoiceos.org']);
  const recipe=Object.freeze({...DEFAULTS,device:'pi'}),before=JSON.stringify(recipe);
  assert.equal(new Set(PROJECT_FACTS.map(f=>f.id)).size,PROJECT_FACTS.length);
  for(const fact of PROJECT_FACTS){
    assert.ok(fact.text&&fact.sourceLabel);assert.ok(Object.isFrozen(fact));
    const url=new URL(fact.source);assert.equal(url.protocol,'https:');assert.ok(allowed.has(url.hostname));
  }
  nextTrivia([],()=>.8);assert.equal(JSON.stringify(recipe),before);
});

test('refresh keeps the inline link and control intact while updating story and accessible source',()=>{
  const story={textContent:''};
  const source={textContent:'Backstory',href:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;}};
  const control=Object.freeze({focused:true});
  const nodes={'[data-fact-text]':story,a:source,'[data-next-trivia]':control};
  const note={querySelector:selector=>nodes[selector]};
  for(const fact of [PROJECT_FACTS[0],PROJECT_FACTS[5]]){
    updateTriviaNote(note,fact);
    assert.equal(story.textContent,fact.text);
    assert.equal(source.href,fact.source);
    assert.equal(source.attributes['title'],fact.sourceLabel);
    assert.equal(source.textContent,'Backstory');
    assert.equal(note.querySelector('[data-next-trivia]'),control);
  }
});

test('short stories represent the current team, Hall of Fame and requested community testers',()=>{
  // Public roster checked at https://www.openvoiceos.org/team on 2026-10-07.
  const names=[
    'Daniel McKnight','Casimiro Ferreira','Peter Steenbergen','Gaëtan Trellu','Mike Gray',
    'Jeremy Brodie','Swen Gross','Suvan Banerjee','Parker Seaman','Timon van Hasselt',
    'Flávio De Melo','andlo','joergz','Menne Bos',
  ];
  const normalize=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  for(const fact of PROJECT_FACTS){
    assert.ok(Array.from(fact.text).length<=115,`${fact.id} exceeds 115 characters`);
  }
  const stories=PROJECT_FACTS.map(fact=>normalize(fact.text));
  for(const name of names){
    assert.ok(stories.some(story=>story.includes(normalize(name))),`${name} needs a short story`);
  }
});

test('saved history from the original 17 cards receives every new addition before any repeat',()=>{
  const legacyIds=[
    'volunteers','origins','wake-phrase','space','contribute','founding-trio','daniel-neon',
    'mike-easter-eggs','andlo-fairytales','reading-pipeline','menne-satellites','smartgic-tools',
    'localize','portuguese-puns','grandma-mode','foundation','hivemind',
  ];
  const legacy=new Set(legacyIds);
  assert.ok(legacyIds.every(id=>PROJECT_FACTS.some(fact=>fact.id===id)));
  const additions=new Set(PROJECT_FACTS.filter(fact=>!legacy.has(fact.id)).map(fact=>fact.id));
  assert.equal(additions.size,PROJECT_FACTS.length-legacyIds.length);
  for(const sample of [0,.4,.999]){
    let history=readTriviaHistory({getItem:()=>JSON.stringify(legacyIds)});
    const seen=new Set();
    for(let i=0;i<additions.size;i++){
      const next=nextTrivia(history,()=>sample);
      assert.ok(additions.has(next.fact.id),`legacy card ${next.fact.id} repeated too soon`);
      assert.ok(!seen.has(next.fact.id),`new card ${next.fact.id} repeated too soon`);
      seen.add(next.fact.id);history=next.history;
    }
    assert.deepEqual(seen,additions);
    assert.equal(history.length,PROJECT_FACTS.length);
    const next=nextTrivia(history,()=>sample);
    assert.notEqual(next.fact.id,history.at(-1));
    assert.equal(next.history.length,1);
  }
});


test('returning visitors receive new team and Mycroft stories before any previously seen card',()=>{
  const newest=PROJECT_FACTS.slice(25),old=PROJECT_FACTS.slice(0,25).map(f=>f.id);
  assert.equal(newest.length,10);
  assert.ok(newest.some(f=>/Suvan.*website and blog/.test(f.text)));
  assert.ok(newest.filter(f=>f.id.startsWith('mycroft-')).length>=4);
  let history=old;
  const seen=new Set();
  for(let i=0;i<newest.length;i++){
    const next=nextTrivia(history,()=>.63);
    assert.ok(!old.includes(next.fact.id));
    assert.ok(!seen.has(next.fact.id));
    seen.add(next.fact.id);history=next.history;
  }
});
