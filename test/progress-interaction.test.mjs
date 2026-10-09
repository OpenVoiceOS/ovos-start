import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveProgressInteraction} from '../dist/progress-interaction.mjs';

/** Model replaced/hidden DOM nodes and track focus without a browser dependency. @returns {object} */
function harness(){
  const doc={activeElement:null},nodes=[],focus=[];
  function node(key,extra={}){
    const item={dataset:{progressFocus:key},isConnected:true,hidden:false,
      closest(){return this.hidden?{}:null;},focus(options){focus.push({key,options});doc.activeElement=this;},...extra};
    nodes.push(item);return item;
  }
  const root={ownerDocument:doc,contains:item=>nodes.includes(item)&&!item.navigation,
    querySelectorAll(selector){return nodes.filter(item=>item.isConnected&&(
      selector==='[data-progress-focus]'?!!item.dataset.progressFocus:
      !!item.dataset.progressDisclosure&&(!selector.endsWith('[open]')||item.open)));},
    querySelector(selector){return nodes.find(item=>item.isConnected&&!item.hidden&&item.dataset.progressFocus===(selector.includes('progress-title')?'heading':'install-action'));}};
  const navigation={contains:item=>item.navigation};
  return {doc,nodes,focus,node,root,navigation};
}

test('starting installation moves focus out of a now-hidden handoff without scrolling',()=>{
  for(const navigation of [false,true]){
    const h=harness(),old=h.node('install-action',{navigation});h.doc.activeElement=old;
    const restore=preserveProgressInteraction(h.root,h.navigation);
    old.hidden=true;h.node('heading');restore();
    assert.deepEqual(h.focus,[{key:'heading',options:{preventScroll:true}}]);
  }
});

test('ordinary polling never steals focus from a surviving control or elsewhere on the page',()=>{
  for(const outside of [false,true]){
    const h=harness();h.doc.activeElement=outside?{dataset:{}}:h.node('copy-check');
    const restore=preserveProgressInteraction(h.root,h.navigation);h.node('heading');restore();
    assert.equal(h.focus.length,0);
  }
});

test('reconnecting preserves an open check and the manual-copy selection',()=>{
  const h=harness();const oldDetail=h.node(null,{dataset:{progressDisclosure:'check'},open:true});
  const field=h.node('check-field',{selectionStart:3,selectionEnd:18});h.doc.activeElement=field;
  const restore=preserveProgressInteraction(h.root);
  field.isConnected=false;oldDetail.isConnected=false;
  const newDetail=h.node(null,{dataset:{progressDisclosure:'check'},open:false});
  let selected;h.node('check-field',{setSelectionRange:(...range)=>{selected=range;}});restore();
  assert.equal(newDetail.open,true);assert.deepEqual(selected,[3,18]);
  assert.deepEqual(h.focus,[{key:'check-field',options:{preventScroll:true}}]);
});

test('a removed retry control hands focus to the result heading, not the document body',()=>{
  const h=harness(),old=h.node('refresh');h.doc.activeElement=old;
  const restore=preserveProgressInteraction(h.root);old.isConnected=false;h.node('heading');restore();
  assert.equal(h.focus[0].key,'heading');
});

test('recovering waiting status returns focus to the copy action when the retry disappears',()=>{
  const h=harness(),old=h.node('refresh');h.doc.activeElement=old;
  const restore=preserveProgressInteraction(h.root);old.isConnected=false;h.node('install-action');restore();
  assert.equal(h.focus[0].key,'install-action');
});

test('closed disclosures stay closed across updates',()=>{
  const h=harness(),old=h.node(null,{dataset:{progressDisclosure:'check'},open:false});
  const restore=preserveProgressInteraction(h.root);old.isConnected=false;
  const detail=h.node(null,{dataset:{progressDisclosure:'check'},open:false});restore();assert.equal(detail.open,false);
});


test('an unchanged post-install guide link keeps keyboard focus after a live refresh',()=>{
  for(const key of ['next-skills','next-homeassistant','next-ai','next-help','guide-satellite','guide-language','demo-0']){
    const h=harness(),old=h.node(key);h.doc.activeElement=old;
    const restore=preserveProgressInteraction(h.root);old.isConnected=false;
    h.node('heading');h.node(key);restore();
    assert.deepEqual(h.focus,[{key,options:{preventScroll:true}}]);
  }
});
