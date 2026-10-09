import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,selectDevice} from '../dist/scenario.mjs';
import {issueSetup,setupStatus} from '../dist/short-setup.mjs';
import {DRAFT_KEY,readDraft,writeDraft,validateDraft,canResumeDraft} from '../dist/draft.mjs';

/** In-memory storage with the browser Storage contract. @returns {object} Store. */
function storage(){const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};}
/** Build a partial or reviewed draft. @param {object} changes Overrides. @returns {object} Draft. */
function draft(changes={}){return {version:1,id:'session-1',state:{...DEFAULTS},confirmedState:{...DEFAULTS},routes:[{step:'language'}],cursor:0,answered:[],skillsAnswered:false,preparedFor:null,welcomeHeard:true,issuedFragment:'',...changes};}

test('unfinished choices with no device survive reload without becoming deliberate skills',()=>{
 const store=storage(),value=draft({state:{...DEFAULTS,locale:'fr-fr'},answered:['language']});
 assert.equal(writeDraft(store,value),true);
 const restored=readDraft(store);assert.equal(restored.state.device,null);assert.equal(restored.state.locale,'fr-fr');assert.equal(restored.skillsAnswered,false);assert.equal(restored.routes[0].step,'language');
});
test('draft round trip retains deliberate unknown capability answers and original expired deadline',()=>{
 const state=selectDevice(DEFAULTS,'pi'),setup=issueSetup(state,Math.floor(Date.now()/1000)-3601),store=storage();
 const value=draft({state,confirmedState:state,routes:[{step:'review'}],answered:['language','device','prepare','piModel'],issuedFragment:'#setup='+setup.code});
 writeDraft(store,value);const restored=readDraft(store);
 assert.equal(restored.issuedFragment,value.issuedFragment);assert.equal(restored.state.piModel,'unknown');assert.ok(restored.answered.includes('piModel'));assert.equal(setupStatus(setup).kind,'expired');
});
test('external setup links win over an unrelated local draft',()=>{
 const value=validateDraft(draft());
 assert.equal(canResumeDraft(value,null,'#setup=external'),false);
 assert.equal(canResumeDraft(value,{id:'another',cursor:0},'#setup=external'),false);
 assert.equal(canResumeDraft(value,{id:value.id,cursor:0},'#setup=old-confirmed-code'),true);
 assert.equal(canResumeDraft(value,null,''),true);
});
test('corrupt, future-schema and impossible drafts cannot enter the UI',()=>{
 for(const value of [draft({version:2}),draft({cursor:12}),draft({routes:[{step:'arbitrary'}]}),draft({routes:[{step:'speech'}]}),draft({state:{...DEFAULTS,secret:'token'}}),draft({state:{...DEFAULTS,locale:'xx'}})])assert.throws(()=>validateDraft(value));
 const store=storage();store.setItem(DRAFT_KEY,'{bad');assert.equal(readDraft(store),null);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(readDraft(blocked),null);assert.equal(writeDraft(blocked,draft()),false);
});
test('metadata allowlist excludes arbitrary fields and retains an edit baseline',()=>{
 const state=selectDevice(DEFAULTS,'pi'),value=validateDraft(draft({state,confirmedState:state,token:'secret',issuedFragment:'#setup='+issueSetup(state).code,routes:[{step:'skills',editing:true,editSnapshot:state,editAnswered:['language','device'],editSkillsAnswered:true,secret:'never'}]}));
 assert.equal(JSON.stringify(value).includes('secret'),false);assert.equal(value.routes[0].editSnapshot.device,'pi');assert.equal(value.routes[0].editSkillsAnswered,true);
});

test('review and active edit baselines must match their issued recipe',()=>{
 const state=selectDevice(DEFAULTS,'pi'),different={...state,telemetry:true},code=issueSetup(state).code;
 assert.throws(()=>validateDraft(draft({state:different,routes:[{step:'review'}],issuedFragment:'#setup='+code})),/matching/);
 assert.throws(()=>validateDraft(draft({state,routes:[{step:'skills',editing:true,editSnapshot:different}],issuedFragment:'#setup='+code})),/baseline/);
});
