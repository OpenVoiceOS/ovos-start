// Relay regressions preserved from ovos-install-status 89eee176; Apache-2.0.
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {LAUNCH_ERRORS,launchError} from '../server/relay/server/launch-errors.mjs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handle, digest, mac, TTL_SECONDS, transition } from '../server/relay/server/worker.mjs';
import { encodeRecipeCode, COMPACT_FIELDS } from '../server/relay/vendor/recipe-code.mjs';

const now=1800000000,secret='a'.repeat(64),owner='b'.repeat(64);
const state=Object.fromEntries(COMPACT_FIELDS.map(field=>[field.name,field.values[0]]));
const code=encodeRecipeCode(state,{issuedAt:now});
/** Exercise actual migration and prepared SQL using an in-memory SQLite binding. @returns {object} */
function fixture(){
  const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../server/relay/drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../server/relay/drizzle/'+file,import.meta.url),'utf8'));
  const DB={prepare(sql){const statement=db.prepare(sql);return {bind(...args){return {async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};}};}};}};
  const env={DB,RELAY_ADMIN_KEY:secret};
  const call=(path,data,token=secret,time=now)=>handle(new Request('https://relay.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data)}),env,time);
  return {db,env,call,async create(overrides={}){const response=await call('/v1/sessions',{code,owner,...overrides});assert.equal(response.status,200);const data=await response.json();assert.equal(Object.hasOwn(data,'writeToken'),false);return {...data,writeToken:await mac(secret,`install:${data.id}`)};}};
}

test('owner-scoped creation exposes only the launch capability and stores callback tokens as hashes',async()=>{
  const f=fixture(),a=await f.create(),b=await f.create();assert.deepEqual(a,b);assert.match(a.writeToken,/^[a-f0-9]{64}$/);
  const row=f.db.prepare('SELECT * FROM installs').get();assert.equal(row.write_hash,await digest(a.writeToken));assert.ok(!Object.values(row).includes(a.writeToken));
  const other=await f.create({owner:'c'.repeat(64)});assert.notEqual(other.id,a.id);assert.notEqual(other.writeToken,a.writeToken);
  assert.equal((await f.call('/v1/session',{id:a.id,owner:'c'.repeat(64)})).status,410);
  assert.equal((await f.call('/v1/session',{id:a.id,owner})).headers.get('cache-control'),'private, no-store');
});
test('public requests and write capabilities cannot create or read installs',async()=>{
  const f=fixture(),s=await f.create();for(const path of ['/v1/sessions','/v1/session'])assert.equal((await f.call(path,{code,owner},s.writeToken)).status,401);
  assert.equal((await f.call('/v1/events',{event:'installed'},'d'.repeat(64))).status,401);
  assert.equal((await f.call('/v1/session',{id:s.id,owner},'')).status,401);
});
test('milestones do not regress; install success is separate from service and voice checks',async()=>{
  const f=fixture(),s=await f.create();
  for(const event of ['started','downloading','installing','installed','services_ready','needs_attention'])assert.equal((await f.call('/v1/events',{event},s.writeToken)).status,200);
  const get=async()=>(await f.call('/v1/session',{id:s.id,owner})).json();
  assert.deepEqual(await get(),{id:s.id,status:'services_ready',attention:true,createdAt:now,startedAt:now,installedAt:now,phase:0,progressRank:5,estimate:null,updatedAt:now,expiresAt:now+TTL_SECONDS});
  for(const event of ['started','installing','failed','cancelled'])await f.call('/v1/events',{event},s.writeToken);
  assert.equal((await get()).status,'services_ready');
  await f.call('/v1/events',{event:'voice_ready'},s.writeToken);assert.equal((await get()).status,'voice_ready');assert.equal((await get()).attention,false);
  await f.call('/v1/events',{event:'needs_attention'},s.writeToken);assert.equal((await get()).attention,false);
});
test('a one-hour code cannot start later; a started install can report for 24 hours',async()=>{
  const f=fixture(),s=await f.create();assert.equal((await f.call('/v1/events',{event:'started'},s.writeToken,now+3600)).status,410);
  assert.equal((await f.call('/v1/events',{event:'started'},s.writeToken,now+3599)).status,200);
  assert.equal((await f.call('/v1/events',{event:'installed'},s.writeToken,now+7200)).status,200);
  assert.equal((await f.call('/v1/events',{event:'voice_ready'},s.writeToken,now+TTL_SECONDS)).status,410);
  assert.equal((await f.call('/v1/session',{id:s.id,owner},secret,now+TTL_SECONDS)).status,410);
});
test('expiry is not silently renewed on restore; expired rows are inaccessible and cleaned',async()=>{
  const f=fixture(),s=await f.create();let response=await f.call('/v1/sessions',{code,owner},secret,now+3601);assert.equal(response.status,200);assert.equal((await response.json()).expiresAt,s.expiresAt);
  response=await f.call('/v1/sessions',{code,owner},secret,now+TTL_SECONDS);assert.equal(response.status,410);assert.equal(f.db.prepare('SELECT count(*) n FROM installs').get().n,0);
});
test('callback accepts only exact enum payloads and rejects body expansion',async()=>{
  const f=fixture(),s=await f.create();
  for(const data of [{event:'installed',logs:'private'},{event:'invented'},['installed'],{event:'installed',token:'x'.repeat(1500)}])assert.equal((await f.call('/v1/events',data,s.writeToken)).status,400);
  assert.equal((await f.call('/v1/events',{event:'services_ready'},s.writeToken)).status,200);assert.equal(f.db.prepare('SELECT rank FROM installs').get().rank,0);
  assert.equal((await handle(new Request('https://relay.test/v1/events'),f.env,now)).status,404);
});
test('failed and cancelled runs never turn into successful installations',async()=>{
  for(const event of ['failed','cancelled']){const f=fixture(),s=await f.create();await f.call('/v1/events',{event},s.writeToken);await f.call('/v1/events',{event:'installed'},s.writeToken);assert.equal(f.db.prepare('SELECT status FROM installs').get().status,event);}
});
test('database failure is recoverable and does not expose internals',async()=>{
  const f=fixture();f.db.close();const response=await f.call('/v1/sessions',{code,owner});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'unavailable'});
});
test('rate limits bound live installs and callback writes',async()=>{
  const f=fixture(),s=await f.create();f.db.prepare('UPDATE installs SET updates=120').run();assert.equal((await f.call('/v1/events',{event:'started'},s.writeToken)).status,429);
  for(let i=1;i<20;i++)await f.call('/v1/sessions',{code:encodeRecipeCode(state,{issuedAt:now-i}),owner});
  assert.equal((await f.call('/v1/sessions',{code:encodeRecipeCode(state,{issuedAt:now-20}),owner})).status,429);
});
test('transition rejects unknown events and service verification without install receipt',()=>{
  assert.equal(transition({status:'waiting',rank:0},'voice_ready'),null);assert.equal(transition({status:'installed',rank:4},'nonsense'),null);
});


test('short launch capability is distinct, hash-only, idempotent and scoped to the original hour',async()=>{
  const f=fixture(),a=await f.create(),b=await f.create();
  assert.equal(a.launchToken,b.launchToken);assert.match(a.launchToken,/^[A-Za-z0-9_-]{22}$/);
  const row=f.db.prepare('SELECT * FROM installs WHERE id = ?').get(a.id);
  assert.equal(row.launch_hash,await digest(a.launchToken));assert.ok(!Object.values(row).includes(a.launchToken));
  const launch=(token,time=now,method='GET',suffix='')=>handle(new Request('https://relay.test/s/'+token+suffix,{method}),f.env,time);
  let response=await launch(a.launchToken);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const script=await response.text();assert.ok(script.includes(code));assert.ok(script.includes(a.writeToken));assert.ok(!script.includes(owner));assert.ok(!script.includes(a.id));
  assert.equal((await launch(a.launchToken,now+3599)).status,200);
  await f.call('/v1/events',{event:'started'},a.writeToken,now+3599);
  const expired=await launch(a.launchToken,now+3600);assert.equal(expired.status,200);const expiredScript=await expired.text();assert.ok(!expiredScript.includes(a.writeToken));assert.ok(!expiredScript.includes(code));assert.match(expiredScript,/unavailable or expired/);
  assert.equal((await f.call('/v1/events',{event:'installed'},a.writeToken,now+3601)).status,200);
  for(const token of [a.id,a.writeToken,'bad'])assert.equal((await launch(token)).status,404);
  assert.equal((await launch(a.launchToken,now,'POST')).status,404);
  assert.equal((await launch(a.launchToken,now,'GET','?url=https://evil.test')).status,404);
  const read=await (await f.call('/v1/session',{id:a.id,owner})).json();assert.equal(read.launchToken,undefined);assert.equal(read.writeToken,undefined);
  const other=await f.create({owner:'c'.repeat(64)});assert.notEqual(other.launchToken,a.launchToken);
  assert.equal((await f.call('/v1/events',{event:'started'},a.launchToken)).status,401);
});
test('existing sessions gain a launch hash on authenticated restore without moving any deadlines',async()=>{
  const f=fixture(),a=await f.create();f.db.prepare('UPDATE installs SET launch_hash=NULL WHERE id = ?').run(a.id);
  const b=await f.create();assert.deepEqual(b,a);
  assert.equal(f.db.prepare('SELECT launch_hash FROM installs WHERE id = ?').get(a.id).launch_hash,await digest(a.launchToken));
});


test('previously accepted lowercase and ungrouped codes launch canonically without renewing expiry',async()=>{
 for(const variant of [code.toLowerCase(),code.replaceAll('-','')]){
  const f=fixture(),s=await f.create({code:variant});
  const response=await handle(new Request('https://relay.test/s/'+s.launchToken),f.env,now);
  assert.equal(response.status,200);assert.ok((await response.text()).includes(code));
  assert.equal(f.db.prepare('SELECT start_before FROM installs').get().start_before,now+3600);
 }
});


test('real installation phases remain monotonic and preserve the failed checkpoint',async()=>{
 const f=fixture(),s=await f.create();
 const read=async()=>(await f.call('/v1/session',{id:s.id,owner})).json();
 for(const [event,phase] of [['stage_system',1],['stage_packages',2],['stage_services',3],['stage_finalize',4]]){
  await f.call('/v1/events',{event},s.writeToken,now+phase);
  const value=await read();assert.equal(value.status,'installing');assert.equal(value.phase,phase);assert.equal(value.installedAt,null);
 }
 await f.call('/v1/events',{event:'stage_packages'},s.writeToken,now+10);assert.equal((await read()).phase,4);
 await f.call('/v1/events',{event:'failed'},s.writeToken,now+11);
 const failed=await read();assert.equal(failed.status,'failed');assert.equal(failed.phase,4);assert.equal(failed.progressRank,3);assert.equal(failed.installedAt,null);
 await f.call('/v1/events',{event:'installed'},s.writeToken,now+12);assert.equal((await read()).status,'failed');
});

test('completion time is first installer success, never later checks or replayed events',async()=>{
 const f=fixture(),s=await f.create();
 await f.call('/v1/events',{event:'started'},s.writeToken,now+1);
 await f.call('/v1/events',{event:'installed'},s.writeToken,now+600);
 for(const event of ['installed','services_ready','voice_ready','stage_finalize'])await f.call('/v1/events',{event},s.writeToken,now+900);
 const value=await (await f.call('/v1/session',{id:s.id,owner})).json();
 assert.equal(value.installedAt,now+600);assert.equal(value.startedAt,now+1);assert.equal(value.status,'voice_ready');
});

test('ETA needs five successful comparable owner runs within existing retention',async()=>{
 const f=fixture(),current=await f.create();
 const get=async()=>(await f.call('/v1/session',{id:current.id,owner})).json();
 const add=async(i,changes={},viewer=owner)=>{
  const sample=await f.create({code:encodeRecipeCode({...state,...changes},{issuedAt:now-i}),owner:viewer});
  f.db.prepare('UPDATE installs SET started_at=?, installed_at=?, status=?, rank=4 WHERE id=?').run(now-2000,now-2000+600+i*60,'installed',sample.id);return sample;
 };
 for(let i=1;i<=4;i++)await add(i);
 assert.equal((await get()).estimate,null);
 const fifth=await add(5);assert.deepEqual((await get()).estimate,{lowSeconds:660,highSeconds:900,samples:5});
 await add(6,{device:'mark2'});await add(7,{speech:'local'});await add(8,{},'e'.repeat(64));
 assert.equal((await get()).estimate.samples,5);
 f.db.prepare('UPDATE installs SET expires_at=? WHERE id=?').run(now,fifth.id);assert.equal((await get()).estimate,null);
 // Pre-migration successes, failures and pending voice checks cannot invent durations.
 f.db.prepare('UPDATE installs SET installed_at=NULL WHERE id != ?').run(current.id);assert.equal((await get()).estimate,null);
});


test('valid-shaped unavailable links explain failure without revealing any capability',async()=>{
 const f=fixture();const s=await f.create();
 for(const [token,time] of [['z'.repeat(22),now],[s.launchToken,now+3600],[s.launchToken,now+86400]]){
  const response=await handle(new Request('https://relay.test/s/'+token),f.env,time);
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const script=await response.text();assert.doesNotMatch(script,new RegExp(s.writeToken+'|'+s.id+'|'+code));
  for(const shell of ['sh','bash']){const result=spawnSync(shell,{input:script,encoding:'utf8'});assert.equal(result.status,1);assert.equal(result.stderr,LAUNCH_ERRORS['en-us'][0]+'\n');}
 }
 f.db.close();const response=await handle(new Request('https://relay.test/s/'+s.launchToken),f.env,now);
 const result=spawnSync('sh',{input:await response.text(),encoding:'utf8'});assert.equal(result.status,1);assert.equal(result.stderr,LAUNCH_ERRORS['en-us'][1]+'\n');
});

test('expired commands use their chosen language and every diagnostic remains safe shell source',async()=>{
 for(const [locale,messages] of Object.entries(LAUNCH_ERRORS)){
  const f=fixture(),session=await f.create({code:encodeRecipeCode({...state,locale},{issuedAt:now})});
  const response=await handle(new Request('https://relay.test/s/'+session.launchToken),f.env,now+3600);
  const result=spawnSync('sh',{input:await response.text(),encoding:'utf8'});assert.equal(result.status,1);assert.equal(result.stderr,messages[0]+'\n');
  for(const unavailable of [false,true]){const run=spawnSync('sh',{input:launchError(locale,unavailable),encoding:'utf8'});assert.equal(run.status,1);assert.equal(run.stderr,messages[unavailable?1:0]+'\n');assert.equal(run.stdout,'');}
 }
});


test('unconfigured download service gives a diagnostic only for well-formed launch requests',async()=>{
 const f=fixture();delete f.env.RELAY_ADMIN_KEY;
 for(const path of ['/s/bad','/s/'+'a'.repeat(22)+'?url=other'])assert.equal((await handle(new Request('https://relay.test'+path),f.env,now)).status,404);
 const response=await handle(new Request('https://relay.test/s/'+'a'.repeat(22)),f.env,now);
 assert.equal(response.status,200);const result=spawnSync('sh',{input:await response.text(),encoding:'utf8'});
 assert.equal(result.status,1);assert.equal(result.stderr,LAUNCH_ERRORS['en-us'][1]+'\n');
});

test('failure and its report link arrive atomically, remain owner-scoped and immutable',async()=>{
  const f=fixture(),s=await f.create(),errorUrl='https://paste.uoi.io/Abc_123-xyz/';
  const posted=await f.call('/v1/events',{event:'failed',errorUrl},s.writeToken);
  assert.equal(posted.status,200);assert.deepEqual(await posted.json(),{accepted:true});
  const result=await f.call('/v1/session',{id:s.id,owner});
  const failed=await result.json();assert.equal(failed.status,'failed');assert.equal(failed.errorUrl,errorUrl);
  assert.equal(result.headers.get('cache-control'),'private, no-store');
  assert.equal((await (await f.call('/v1/sessions',{code,owner})).json()).errorUrl,errorUrl);
  assert.equal((await f.call('/v1/session',{id:s.id,owner:'c'.repeat(64)})).status,410);
  assert.equal((await f.call('/v1/session',{id:s.id,owner},s.writeToken)).status,401);
  await f.call('/v1/events',{event:'failed',errorUrl:'https://paste.uoi.io/replacement'},s.writeToken);
  await f.call('/v1/events',{event:'installed'},s.writeToken);
  assert.equal((await (await f.call('/v1/session',{id:s.id,owner})).json()).errorUrl,errorUrl);
  assert.equal((await f.call('/v1/session',{id:s.id,owner},secret,now+TTL_SECONDS)).status,410);
});

test('report metadata accepts only direct paste links attached to failures',async()=>{
  const f=fixture(),s=await f.create();
  for(const errorUrl of [null,17,{},['https://paste.uoi.io/abc'],'','http://paste.uoi.io/abc','https://paste.uoi.io.evil.test/abc','https://user@paste.uoi.io/abc','https://paste.uoi.io:443/abc','https://paste.uoi.io/a?token=private','https://paste.uoi.io/a#fragment','https://paste.uoi.io/a\n','https://paste.uoi.io/a/b','https://paste.uoi.io/..','https://paste.uoi.io/'+ 'a'.repeat(129),'javascript:alert(1)']){
    assert.equal((await f.call('/v1/events',{event:'failed',errorUrl},s.writeToken)).status,400,JSON.stringify(errorUrl));
  }
  for(const event of ['installed','cancelled','installing'])assert.equal((await f.call('/v1/events',{event,errorUrl:'https://paste.uoi.io/abc'},s.writeToken)).status,400);
  assert.equal((await f.call('/v1/events',{event:'failed',errorUrl:'https://paste.uoi.io/abc',logs:'private'},s.writeToken)).status,400);
  assert.equal(f.db.prepare('SELECT status FROM installs').get().status,'waiting');
  await f.call('/v1/events',{event:'failed'},s.writeToken);
  assert.equal(Object.hasOwn(await (await f.call('/v1/session',{id:s.id,owner})).json(),'errorUrl'),false);
});

test('a late failed event cannot attach a report to an installed session',async()=>{
  const f=fixture(),s=await f.create();await f.call('/v1/events',{event:'installed'},s.writeToken);
  await f.call('/v1/events',{event:'failed',errorUrl:'https://paste.uoi.io/abc'},s.writeToken);
  const result=await (await f.call('/v1/session',{id:s.id,owner})).json();
  assert.equal(result.status,'installed');assert.equal(Object.hasOwn(result,'errorUrl'),false);
});
