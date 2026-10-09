import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserCredential,InstallTracker,INSTALL_API_URL} from '../dist/install-progress.mjs';
import {INSTALL_LINK_ORIGIN,issueSetup,buildShortCommand,buildSetupScript} from '../dist/short-setup.mjs';
import {DEFAULTS} from '../dist/scenario.mjs';

/** Small browser storage fixture, isolated from the developer's real browser.
 * @returns {object} In-memory localStorage interface and captured values.
 */
function storageFixture(){
  const values=new Map();
  return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}

const session={id:'b'.repeat(32),launchToken:'L'.repeat(22),status:'waiting',
  expiresAt:1900000000,createdAt:1800000000,updatedAt:1800000000,attention:false};

test('a random browser owner survives reloads and is never encoded in the recipe or install command',()=>{
  const storage=storageFixture();let randomCalls=0;
  const getCredential=createBrowserCredential({getStorage:()=>storage,randomBytes:bytes=>{
    randomCalls++;assert.equal(bytes.length,32);bytes.forEach((_,index)=>{bytes[index]=index;});
  }});
  assert.equal(storage.values.size,0,'no browser identity until status access is needed');
  const first=getCredential();
  assert.match(first,/^[a-f0-9]{64}$/);assert.equal(first,'000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
  assert.equal(getCredential(),first);assert.equal(randomCalls,1);
  const reloaded=createBrowserCredential({getStorage:()=>storage,randomBytes:()=>assert.fail('saved owner should be reused')});
  assert.equal(reloaded(),first);assert.deepEqual([...storage.values.values()],[first]);
  const setup=issueSetup({...DEFAULTS,device:'computer'},1800000000);
  assert.ok(!JSON.stringify(setup).includes(first));
  assert.ok(!buildShortCommand(setup,1800000000,session.launchToken).includes(first));
});

test('invalid saved values are replaced with fresh cryptographic credentials',()=>{
  for(const saved of ['',null,'123','a'.repeat(63),'a'.repeat(64)+'\n','A'.repeat(64)]){
    let replacement;
    const credential=createBrowserCredential({getStorage:()=>({getItem:()=>saved,setItem:(_,value)=>{replacement=value;}}),randomBytes:bytes=>bytes.fill(77)});
    assert.equal(credential(),'4d'.repeat(32));assert.equal(replacement,credential());
  }
});

test('blocked storage keeps one in-memory owner for the current page',()=>{
  for(const getStorage of [
    ()=>{throw new Error('SecurityError');},
    ()=>({getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}}),
    ()=>({getItem:()=>null,setItem(){throw new Error('quota');}}),
    ()=>undefined,
  ]){
    let draws=0;
    const credential=createBrowserCredential({getStorage,randomBytes:bytes=>{draws++;bytes.fill(30);}});
    assert.equal(credential(),'1e'.repeat(32));assert.equal(credential(),'1e'.repeat(32));assert.equal(draws,1);
  }
});

test('creation and status polling authenticate to the fixed API without cookies or URL secrets',async()=>{
  const requests=[],credential='f'.repeat(64);
  const tracker=new InstallTracker({credential:()=>credential,fetcher:async(url,options)=>{
    requests.push({url,options});return Response.json(session);
  },schedule:()=>0,cancel(){}});
  await tracker.connect('current-recipe');await tracker.poll();
  assert.equal(requests.length,2);
  assert.deepEqual(requests.map(({options})=>JSON.parse(options.body)),[{code:'current-recipe'},{id:session.id}]);
  for(const {url,options} of requests){
    assert.equal(url,'https://start-api.smartgic.io/api/install');
    assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');
    assert.equal(options.cache,'no-store');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');
    assert.deepEqual(options.headers,{'Content-Type':'application/json',Authorization:'Bearer '+credential});
    assert.ok(!url.includes(credential)&&!options.body.includes(credential));assert.ok(options.signal instanceof AbortSignal);
  }
  assert.ok(!JSON.stringify(tracker.snapshot()).includes(credential));
  tracker.reset();await tracker.connect('new-recipe');
  assert.equal(requests[2].options.headers.Authorization,'Bearer '+credential,'reinstall preserves browser identity');
  tracker.stop();
});

test('missing secure randomness or invalid browser credentials fail before sending a request',async()=>{
  const unavailable=createBrowserCredential({getStorage:()=>undefined,randomBytes:()=>{throw new Error('private browser detail');}});
  for(const credential of [unavailable,()=>'',()=>undefined,()=>('a'.repeat(64)+'\n')]){
    const tracker=new InstallTracker({credential,fetcher:()=>assert.fail('must not send an unauthenticated request'),schedule:()=>0,cancel(){}});
    assert.equal(await tracker.connect('current-recipe'),null);
    assert.equal(tracker.snapshot().error,'unavailable');
  }
});

test('copied and downloaded commands use the branded alias while browser tracking stays on the API origin',()=>{
  const issuedAt=1800000000;
  const setup=issueSetup({...DEFAULTS,device:'computer'},issuedAt);
  const command=buildShortCommand(setup,issuedAt,session.launchToken);
  const download=buildSetupScript(setup,issuedAt,session.launchToken);
  assert.equal(INSTALL_LINK_ORIGIN,'https://installer.openvoiceos.org');
  assert.equal(command,`curl -qfsS -m120 https://installer.openvoiceos.org/s/${session.launchToken} | sh`);
  assert.ok(download.includes(`'https://installer.openvoiceos.org/s/${session.launchToken}'`));
  assert.ok(!command.includes('start-api.smartgic.io')&&!download.includes('start-api.smartgic.io'));
  assert.equal(INSTALL_API_URL,'https://start-api.smartgic.io/api/install');
});
