import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {InstallTracker} from '../dist/install-progress.mjs';

const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const start=source.indexOf("window.addEventListener('pagehide',()=>{installTracker.stop()");
const handlers=source.slice(start,source.indexOf('/** Expose the same validated recipe',start));
const session={id:'b'.repeat(32),launchToken:'L'.repeat(22),status:'installing',phase:2,
  expiresAt:1900000000,createdAt:1800000000,updatedAt:1800000010,attention:false};

/** Exercise the real browser handlers and tracker without network or a device.
 * @param {string} step Mounted screen. @returns {Promise<object>} Lifecycle fixture.
 */
async function fixture(step='review'){
  const timers=new Map(),events={},requests=[];let serial=0,renders=0,updates=0;
  const tracker=new InstallTracker({fetcher:async(url,options)=>{requests.push(JSON.parse(options.body));return Response.json(session);},
    schedule:fn=>{timers.set(++serial,fn);return serial;},cancel:id=>timers.delete(id)});
  await tracker.connect('unchanged-recipe');
  const setupSession=Object.freeze({code:'unchanged-recipe',expiresAt:1800003600});
  vm.runInNewContext(handlers,{window:{addEventListener:(name,callback)=>{events[name]=callback;}},
    step,setupSession,installTracker:tracker,stopWelcomeEyes:null,welcomePlayback:null,
    render(){renders++;},updateExpiry(){updates++;}});
  return {tracker,timers,events,requests,setupSession,get renders(){return renders;},get updates(){return updates;}};
}

test('Back restores progress polling for the existing recipe without extending expiry',async()=>{
  const f=await fixture();
  f.events.pagehide();assert.equal(f.tracker.active,false);assert.equal(f.timers.size,0);
  f.events.pageshow({persisted:true});f.events.pageshow({persisted:true});
  await new Promise(setImmediate);
  assert.equal(f.tracker.active,true);assert.equal(f.timers.size,1);
  assert.deepEqual(f.requests,[{code:'unchanged-recipe'},{id:session.id}]);
  assert.equal(f.tracker.code,f.setupSession.code);assert.equal(f.setupSession.expiresAt,1800003600);
  assert.equal(f.tracker.session.status,'installing');assert.equal(f.renders,0);
});

test('ordinary loads and unrelated restored screens do not start installation requests',async()=>{
  for(const step of ['review','welcome','device']){
    const f=await fixture(step);f.events.pagehide();f.events.pageshow({persisted:false});
    assert.equal(f.tracker.active,false);assert.equal(f.renders,0);
    if(step!=='review'){
      f.events.pageshow({persisted:true});await new Promise(setImmediate);
      assert.equal(f.requests.length,1);assert.equal(f.timers.size,0);
      assert.equal(f.renders,step==='welcome'?1:0);
    }
  }
});
