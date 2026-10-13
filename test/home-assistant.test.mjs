import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {HomeAssistantDraft,normalizeHomeAssistant} from '../dist/home-assistant.mjs';
import {DEFAULTS,buildYaml,encodePreset} from '../dist/scenario.mjs';
import {issueSetup} from '../dist/short-setup.mjs';
import {InstallTracker} from '../dist/install-progress.mjs';
const token='fixture.token.for_homeassistant_123';
const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
/** Extract actual app handlers for deterministic network-race checks. @param {string} name Handler. @returns {string} */
function declaration(name){return source.match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`,'m'))[0];}
/** A secret form with a controlled service boundary. @returns {object} */
function harness(){
 const state={...DEFAULTS,device:'mark2',homeassistant:true};const setupSession=issueSetup(state);
 const homeAssistantDraft=new HomeAssistantDraft();homeAssistantDraft.input('url','http://homeassistant.local:8123');homeAssistantDraft.input('token',token);
 const session={id:'a'.repeat(32),status:'waiting',homeassistantReady:false,homeassistantClaimed:false};
 const saves=[],focus=[];
 const c=vm.createContext({homeAssistantSaving:false,state,setupSession,homeAssistantDraft,homeAssistantCleanup:Promise.resolve(),previewOnly:false,step:'review',
 installTracker:{code:setupSession.code,session,connect:async()=>session,saveHomeAssistant:async(id,value)=>{saves.push({id,value});session.homeassistantReady=value!==null;return value!==null;}},
 wizard:{querySelector:selector=>selector==='#ha-error'?{scrollIntoView(){}}:selector.startsWith('#ha-')?{value:selector==='#ha-url'?homeAssistantDraft.url:homeAssistantDraft.token,setAttribute(){},focus(){focus.push(selector);}}:null},
 mountHomeAssistant(){},refreshConnections(){},
 });
 vm.runInContext(['homeAssistantModel','prepareHomeAssistant','clearHomeAssistantHandoff','forgetHomeAssistant'].map(declaration).join('\n'),c);
 return {c,session,saves,focus};
}
test('accepts local HTTP and remote HTTPS addresses with literal tokens',()=>{
 for(const url of ['http://homeassistant.local:8123','https://ha.example.org/','http://192.168.1.20:8123','http://[fd00::1]:8123','https://ha.example.org/proxy']){
  const value=normalizeHomeAssistant({url,token});assert.equal(value.token,token);assert.ok(value.url.startsWith('http'));
 }
});
test('rejects URL credentials, ambiguous framing, schemes and malformed tokens without echoing secrets',()=>{
 for(const url of ['https://user:secret@ha.test','https://ha.test/?key=secret','https://ha.test/#secret','https://ha.test/?','file:///tmp/x','javascript:alert(1)','ha.test','https://ha.test\\evil','http://ha.test\n',' https://ha.test','https://'+'x'.repeat(2050)])assert.throws(()=>normalizeHomeAssistant({url,token}),/url/);
 for(const value of ['', 'short',token+'\n','x'.repeat(2049),'$(exec-code)',token+' secret'])assert.throws(()=>normalizeHomeAssistant({url:'http://ha.local',token:value}),/token/);
 assert.throws(()=>normalizeHomeAssistant({url:'http://ha.local',token,extra:'x'}),/connection/);
});
test('draft secrets are separate from recipes, links and exported scenario',()=>{
 const draft=new HomeAssistantDraft();draft.input('url','http://private-ha.local:8123');draft.input('token',token);
 const state={...DEFAULTS,device:'mark2',homeassistant:true};const output=buildYaml(state)+encodePreset(state)+JSON.stringify(issueSetup(state));
 assert.ok(!output.includes(token)&&!output.includes(draft.url));draft.saved();assert.equal(draft.editing,false);
 draft.edit();assert.equal(draft.token,'');draft.input('token',token);draft.clear();assert.equal(draft.url,'');assert.equal(draft.token,'');
 assert.match(source,/pagehide[\s\S]*?homeAssistantDraft.clear\(\)/);
});
test('invalid input blocks handoff and focuses the actionable field',async()=>{
 const h=harness();h.c.homeAssistantDraft.url='wrong';assert.equal(await h.c.prepareHomeAssistant(),false);assert.equal(h.saves.length,0);assert.deepEqual(h.focus,['#ha-url']);assert.match(h.c.homeAssistantDraft.error,/address/);
 h.c.homeAssistantDraft.url='http://ha.local';h.c.homeAssistantDraft.token='';assert.equal(await h.c.prepareHomeAssistant(),false);assert.equal(h.saves.length,0);assert.equal(h.focus.at(-1),'#ha-token');
});
test('successful save collapses form without claiming HA connection success',async()=>{
 const h=harness();assert.equal(await h.c.prepareHomeAssistant(),true);assert.equal(h.saves.length,1);assert.equal(h.saves[0].value.token,token);assert.equal(h.c.homeAssistantDraft.editing,false);assert.equal(h.session.homeassistantReady,true);
 assert.equal(await h.c.prepareHomeAssistant(),true);assert.equal(h.saves.length,1,'an unchanged confirmed handoff needs no second secret upload');
});
test('failed network save keeps editable input and blocks copy readiness',async()=>{
 const h=harness();h.c.installTracker.saveHomeAssistant=async()=>{throw Error(token);};assert.equal(await h.c.prepareHomeAssistant(),false);assert.equal(h.c.homeAssistantDraft.token,token);assert.match(h.c.homeAssistantDraft.error,/try again/);assert.ok(!h.c.homeAssistantDraft.error.includes(token));assert.equal(h.c.homeAssistantDraft.saving,false);
});
test('started, consumed, preview and concurrent saves are refused',async()=>{
 for(const change of [h=>h.session.status='started',h=>h.session.homeassistantClaimed=true,h=>h.c.previewOnly=true,h=>h.c.homeAssistantSaving=true]){const h=harness();change(h);assert.equal(await h.c.prepareHomeAssistant(),false);assert.equal(h.saves.length,0);}
});
test('navigation during save clears the stale handoff before another save can start',async()=>{
 const h=harness();let finish;h.c.installTracker.saveHomeAssistant=async(id,value)=>{h.saves.push({id,value});if(value)await new Promise(resolve=>finish=resolve);return value!==null;};
 const pending=h.c.prepareHomeAssistant();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.c.homeAssistantDraft.saving,true);
 h.c.setupSession={...h.c.setupSession};finish();assert.equal(await pending,false);assert.equal(h.saves.at(-1).value,null);assert.equal(h.c.homeAssistantDraft.saving,false);
});
test('removal erases memory and cleanup completes before a new handoff save',async()=>{
 const h=harness();h.session.homeassistantReady=true;let clear;
 h.c.installTracker.saveHomeAssistant=async(id,value)=>{h.saves.push({id,value});if(value===null)await new Promise(resolve=>clear=resolve);return value!==null;};
 h.c.forgetHomeAssistant();assert.equal(h.c.homeAssistantDraft.token,'');assert.equal(h.c.homeAssistantDraft.url,'');
 h.c.homeAssistantDraft.input('url','http://new-ha.local');h.c.homeAssistantDraft.input('token',token);const pending=h.c.prepareHomeAssistant();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.saves.length,1);clear();assert.equal(await pending,true);assert.equal(h.saves.length,2);assert.equal(h.saves[1].value.url,'http://new-ha.local');
});
test('the browser sends secrets only in an authenticated no-store POST body',async()=>{
 const calls=[];const tracker=new InstallTracker({credential:()=> 'b'.repeat(64),fetcher:async(url,options)=>{calls.push({url,options});return Response.json({ready:true});}});
 assert.equal(await tracker.saveHomeAssistant('a'.repeat(32),{url:'http://ha.local',token}),true);
 const {url,options}=calls[0];assert.equal(url,'https://start-api.smartgic.io/api/connections');assert.ok(!url.includes(token));assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers.Authorization,'Bearer '+'b'.repeat(64));assert.equal(JSON.parse(options.body).homeassistant.token,token);
});
