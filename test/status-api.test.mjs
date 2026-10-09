import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,ownerKey,RELAY_ORIGIN} from '../server/worker.mjs';
import {issueSetup} from '../dist/short-setup.mjs';
import {DEFAULTS} from '../dist/scenario.mjs';
const env={RELAY_ADMIN_KEY:'a'.repeat(64),ASSETS:{fetch:()=>new Response('asset')}};
const setup=issueSetup({...DEFAULTS,device:'pi'});
const request=(data,headers={})=>new Request('https://wizard.test/api/install',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://wizard.test','oai-authenticated-user-id':'owner',...headers},body:JSON.stringify(data)});
test('API requires platform identity, same-origin JSON and a configured secret',async()=>{
  for(const [headers,status] of [[{'oai-authenticated-user-id':''},401],[{Origin:'https://evil.test'},403],[{'sec-fetch-site':'cross-site'},403],[{'Content-Type':'text/plain'},400]])assert.equal((await handle(request({code:setup.code},headers),env)).status,status);
  assert.equal((await handle(request({code:setup.code}),{})).status,503);
});
test('owner scope is server derived and never accepts arbitrary callback destinations or payloads',async()=>{
  const sends=[];const fetcher=async(url,options)=>{sends.push({url,options});return Response.json({id:'b'.repeat(32),status:'waiting'});};
  let response=await handle(request({code:setup.code}),env,fetcher);assert.equal(response.status,200);assert.equal(sends[0].url,RELAY_ORIGIN+'/v1/sessions');assert.equal(sends[0].options.redirect,'manual');
  const data=JSON.parse(sends[0].options.body);assert.equal(data.owner,await ownerKey(env.RELAY_ADMIN_KEY,'owner'));assert.ok(!Object.values(data).includes('owner'));
  for(const data of [{code:setup.code,owner:'forged'},{code:setup.code,url:'https://evil.test'},{id:'b'.repeat(32),token:'x'},null,[],{code:'x'.repeat(2000)}])assert.equal((await handle(request(data),env,fetcher)).status,400);
  assert.equal(sends.length,1);assert.notEqual(await ownerKey(env.RELAY_ADMIN_KEY,'owner'),await ownerKey(env.RELAY_ADMIN_KEY,'other'));
});
test('expired recipe can retrieve existing progress but the proxy never reissues it',async()=>{
  const old=issueSetup({...DEFAULTS,device:'pi'},Math.floor(Date.now()/1000)-7200);let sent;
  await handle(request({code:old.code}),env,async(url,options)=>{sent=JSON.parse(options.body);return Response.json({error:'expired'},{status:410});});
  assert.equal(sent.code,old.code);
});

test('malformed session IDs return JSON errors without coercion or relay requests',async()=>{
  let requests=0;
  for(const id of [{toString:'oops'},['b'.repeat(32)],42,true,null,{},'b'.repeat(31),'b'.repeat(33)]){
    const response=await handle(request({id}),env,async()=>{requests++;return Response.json({});});
    assert.equal(response.status,400);
    assert.deepEqual(await response.json(),{error:'invalid_payload'});
  }
  assert.equal(requests,0);
});
test('relay outage or sign-in HTML produces recoverable JSON, without exposing secrets',async()=>{
  for(const fetcher of [async()=>{throw Error('secret internals');},async()=>new Response('<html>sign in</html>',{headers:{'Content-Type':'text/html'}})]){
    const response=await handle(request({code:setup.code}),env,fetcher);assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'unavailable'});assert.equal(response.headers.get('cache-control'),'private, no-store');
  }
});
test('normal browser assets still use the asset binding; unknown APIs are not served as HTML',async()=>{
  assert.equal(await(await handle(new Request('https://wizard.test/'),env)).text(),'asset');assert.equal((await handle(new Request('https://wizard.test/api/missing'),env)).status,404);
});
test('relay diagnostics log only safe classification and omit sensitive error details',async()=>{
  const messages=[];const original=console.warn;console.warn=(...args)=>messages.push(args.join(' '));
  try{
    await handle(request({code:setup.code}),env,async()=>{throw new TypeError('1042 credential '+env.RELAY_ADMIN_KEY);});
    assert.equal(messages.length,1);assert.match(messages[0],/1042/);assert.ok(!messages[0].includes(env.RELAY_ADMIN_KEY));assert.ok(!messages[0].includes('credential'));
  }finally{console.warn=original;}
});

test('redirects are refused even when a relay returns a JSON body',async()=>{
  let calls=0;
  const response=await handle(request({code:setup.code}),env,async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return Response.json({id:'b'.repeat(32)},{status:307,headers:{Location:'https://elsewhere.test'}});});
  assert.equal(response.status,503);assert.equal(calls,1);assert.deepEqual(await response.json(),{error:'unavailable'});
});

test('the browser receives a launch capability but no installer callback secret',async()=>{
 const response=await handle(request({code:setup.code}),env,async()=>Response.json({id:'b'.repeat(32),launchToken:'L'.repeat(22),writeToken:'c'.repeat(64)}));
 assert.deepEqual(await response.json(),{id:'b'.repeat(32),launchToken:'L'.repeat(22)});
});

test('the authenticated owner receives a report link without a callback secret',async()=>{
 const errorUrl='https://paste.uoi.io/Report123';
 const result=await handle(request({id:'b'.repeat(32)}),env,async()=>Response.json({id:'b'.repeat(32),status:'failed',errorUrl,writeToken:'c'.repeat(64)}));
 assert.equal(result.status,200);assert.deepEqual(await result.json(),{id:'b'.repeat(32),status:'failed',errorUrl});
 assert.equal(result.headers.get('cache-control'),'private, no-store');
});
