import { decodeRecipeEnvelope, encodeRecipeCode } from '../vendor/recipe-code.mjs';
import { bootstrap } from './launch.mjs';
import { launchError } from './launch-errors.mjs';
import { estimateFor } from './timing.mjs';
import { errorReportUrl } from './report-link.mjs';

export const TTL_SECONDS = 86400;
const ranks = Object.freeze({started:1,downloading:2,installing:3,installed:4,services_ready:5,voice_ready:6});
const phases=Object.freeze({stage_system:1,stage_packages:2,stage_services:3,stage_finalize:4});
const completions=Object.freeze({packages_installed:1,audio_configured:2,components_installed:4});
const completedSteps=Object.freeze({...completions,services_started:8});
const checks=Object.freeze({
  audio_checking:['audio_status','checking'],audio_passed:['audio_status','passed'],audio_failed:['audio_status','failed'],
  microphone_checking:['microphone_status','checking'],microphone_passed:['microphone_status','passed'],microphone_failed:['microphone_status','failed'],
});
export const EVENTS = Object.freeze([...Object.keys(ranks),...Object.keys(phases),...Object.keys(completions),...Object.keys(checks),'needs_attention','failed','cancelled']);
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');

/** Hash a capability before durable storage. @param {string} value @returns {Promise<string>} */
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value))); }

/** Reproduce only an authorized owner's install capability. @param {string} secret @param {string} value @returns {Promise<string>} */
export async function mac(secret,value) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}

/** Separate 128-bit launch capability; session IDs never authorize downloads.
 * @param {string} secret @param {string} id @returns {Promise<string>}
 */
export async function launchCapability(secret,id) {
  const value=await mac(secret,`launch:${id}`);
  return btoa(String.fromCharCode(...value.slice(0,32).match(/../g).map(byte=>parseInt(byte,16)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

/** Resolve only a fixed recipe and write capability, never private status or identity.
 * @param {Request} request @param {object} env @param {number} now @returns {Promise<Response>}
 */
async function launch(request,env,now) {
  const url=new URL(request.url),token=url.pathname.slice(3);
  if(request.method!=='GET'||url.search||token.length!==22||!/^[A-Za-z0-9_-]{22}$/.test(token))return json({error:'not_found'},404);
  if(!/^[a-f0-9]{64}$/.test(env.RELAY_ADMIN_KEY||''))return shellResponse(launchError('en-us',true));
  try {
    const row=await env.DB.prepare('SELECT * FROM installs WHERE launch_hash = ?').bind(await digest(token)).first();
    if(!row)return shellResponse(launchError());
    let locale='en-us';try{locale=decodeRecipeEnvelope(row.code,{now,allowExpired:true}).state.locale;}catch{}
    if(now>=row.start_before||now>=row.expires_at||now<row.created_at)return shellResponse(launchError(locale));
    const recipe=decodeRecipeEnvelope(row.code,{now});
    const code=encodeRecipeCode(recipe.state,{issuedAt:recipe.issuedAt});
    return shellResponse(bootstrap(code,await mac(env.RELAY_ADMIN_KEY,`install:${row.id}`)));
  }catch{return shellResponse(launchError('en-us',true));}
}

/** The transport succeeded; a diagnostic script still exits unsuccessfully.
 * @param {string} script Complete trusted shell source. @returns {Response}
 */
function shellResponse(script) {
  return new Response(script,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; sandbox"}});
}

/** Keep error bodies and all status/capability responses out of caches. @param {object} data @param {number} status @returns {Response} */
function json(data,status=200) {
  return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}

/** Read at most 1 KiB, even when Content-Length is absent or dishonest. @param {Request} request @returns {Promise<object>} */
export async function body(request) {
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new Error('payload');
  const reader=request.body?.getReader();if(!reader)throw new Error('payload');
  const chunks=[];let size=0;
  try { for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();throw new Error('payload');}chunks.push(value);} }
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('payload');return data;
}

/** Return owner-scoped progress and an optional report link, never logs or capabilities. @param {object} row @returns {object} */
function view(row) {
  const errorUrl=row.status==='failed'?errorReportUrl(row.error_url):null;
  return {id:row.id,status:row.status,attention:Boolean(row.attention),audioStatus:row.audio_status,microphoneStatus:row.microphone_status,completedSteps:Object.entries(completedSteps).filter(([,bit])=>row.completed_steps&bit).map(([step])=>step),createdAt:row.created_at,startedAt:row.started_at,installedAt:row.installed_at,phase:row.phase,progressRank:row.rank,updatedAt:row.updated_at,expiresAt:row.expires_at,...(errorUrl?{errorUrl}:{})};
}

/** Apply monotonic milestones, preserving truthful install and voice boundaries. @param {object} row @param {string} event @returns {object|null} */
export function transition(row,event) {
  if(!EVENTS.includes(event))return null;
  if(['failed','cancelled'].includes(row.status))return null;
  const phase=row.phase||0;
  const audio={audio_status:row.audio_status||'pending',microphone_status:row.microphone_status||'pending'};
  const facts={completed_steps:row.completed_steps||0};
  if(Object.hasOwn(completions,event)){
    if(row.rank<3)return null;
    return {status:row.status,rank:row.rank,attention:row.attention,phase,...audio,completed_steps:facts.completed_steps|completions[event]};
  }
  if(Object.hasOwn(checks,event)){
    if(row.rank<4)return null;
    const [field,status]=checks[event];
    // Success needs a running check; a failure stays visible even if its start was missed.
    if(status==='passed'&&audio[field]!=='checking'&&audio[field]!=='passed')return null;
    audio[field]=status;
    if(event==='audio_checking')audio.microphone_status='pending';
    return {status:row.status,rank:row.rank,attention:Number(Object.values(audio).includes('failed')),phase,...audio,...facts};
  }
  if(Object.hasOwn(phases,event)){
    if(row.rank>3||phases[event]<phase)return null;
    return {status:'installing',rank:3,attention:0,phase:phases[event],...audio,...facts};
  }
  if(event==='failed'||event==='cancelled')return row.rank<4?{status:event,rank:row.rank,attention:0,phase,...audio,...facts}:null;
  if(event==='needs_attention'){
    if(row.rank<4)return null;
    for(const field of Object.keys(audio))if(audio[field]==='checking')audio[field]='pending';
    return {status:row.status,rank:row.rank,attention:1,phase,...audio,...facts};
  }
  // A late successful process check adds its receipt without undoing voice readiness.
  if(event==='services_ready'){
    facts.completed_steps|=completedSteps.services_started;
    if(row.rank>=5)return {status:row.status,rank:row.rank,attention:row.attention,phase,...audio,...facts};
  }
  const rank=ranks[event];
  if(rank<row.rank||(rank>=5&&row.rank<4))return null;
  if(event==='voice_ready')audio.audio_status=audio.microphone_status='passed';
  return {status:event,rank,attention:rank>row.rank||event==='voice_ready'?0:row.attention,phase,...audio,...facts};
}

/** Compare fixed-size secrets without early mismatch exit. @param {string} a @param {string} b @returns {boolean} */
function equal(a,b) {if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}

/** Service-only create/read and one write-only installer endpoint. @param {Request} request @param {object} env @param {number} now @returns {Promise<Response>} */
export async function handle(request,env,now=Math.floor(Date.now()/1000)) {
  const path=new URL(request.url).pathname;
  if(path.startsWith('/s/'))return launch(request,env,now);
  if(request.method!=='POST'||!['/v1/sessions','/v1/session','/v1/events'].includes(path))return json({error:'not_found'},404);
  if(!/^[a-f0-9]{64}$/.test(env.RELAY_ADMIN_KEY||''))return json({error:'unavailable'},503);
  const bearer=request.headers.get('authorization')||'';
  const token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
  if(!/^[a-f0-9]{64}$/.test(token))return json({error:'unauthorized'},401);
  if(path!=='/v1/events'&&!equal(token,env.RELAY_ADMIN_KEY))return json({error:'unauthorized'},401);
  let data;try{data=await body(request);}catch{return json({error:'invalid_payload'},400);}
  try {
    if(path==='/v1/sessions') {
      if(Object.keys(data).sort().join(',')!=='code,owner'||!/^[a-f0-9]{64}$/.test(data.owner))return json({error:'invalid_payload'},400);
      let recipe;try{recipe=decodeRecipeEnvelope(data.code,{now,allowExpired:true});}catch{return json({error:'invalid_code'},400);}
      if(recipe.version!==2||recipe.issuedAt>now)return json({error:'invalid_code'},400);
      // Bounded opportunistic deletion. Expired rows are inaccessible even before deletion.
      await env.DB.prepare('DELETE FROM installs WHERE id IN (SELECT id FROM installs WHERE expires_at <= ? ORDER BY expires_at LIMIT 128)').bind(now).run();
      let row=await env.DB.prepare('SELECT * FROM installs WHERE owner = ? AND code = ?').bind(data.owner,data.code).first();
      if(!row) {
        if(recipe.expiresAt<=now)return json({error:'expired'},410);
        const count=await env.DB.prepare('SELECT count(*) AS n FROM installs WHERE owner = ?').bind(data.owner).first();
        if(count.n>=20)return json({error:'rate_limited'},429);
        const id=hex(crypto.getRandomValues(new Uint8Array(16)));
        const writeToken=await mac(env.RELAY_ADMIN_KEY,`install:${id}`);
        await env.DB.prepare('INSERT OR IGNORE INTO installs (id,owner,code,write_hash,created_at,start_before,expires_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM installs WHERE owner = ?) < 20').bind(id,data.owner,data.code,await digest(writeToken),now,recipe.expiresAt,now+TTL_SECONDS,now,data.owner).run();
        row=await env.DB.prepare('SELECT * FROM installs WHERE owner = ? AND code = ?').bind(data.owner,data.code).first();
      }
      if(!row)return json({error:'rate_limited'},429);
      const launchToken=await launchCapability(env.RELAY_ADMIN_KEY,row.id);
      if(!row.launch_hash)await env.DB.prepare('UPDATE installs SET launch_hash = ? WHERE id = ? AND launch_hash IS NULL').bind(await digest(launchToken),row.id).run();
      return json({...view(row),estimate:await estimateFor(env.DB,row,now),launchToken});
    }
    if(path==='/v1/session') {
      if(Object.keys(data).sort().join(',')!=='id,owner'||!/^[a-f0-9]{32}$/.test(data.id)||!/^[a-f0-9]{64}$/.test(data.owner))return json({error:'invalid_payload'},400);
      const row=await env.DB.prepare('SELECT * FROM installs WHERE id = ? AND owner = ?').bind(data.id,data.owner).first();
      if(!row||row.expires_at<=now)return json({error:'expired'},410);
      return json({...view(row),estimate:await estimateFor(env.DB,row,now)});
    }
    const hasReport=Object.hasOwn(data,'errorUrl');
    if(!EVENTS.includes(data.event)||Object.keys(data).sort().join(',')!==(hasReport?'errorUrl,event':'event')||
      (hasReport&&(data.event!=='failed'||!errorReportUrl(data.errorUrl))))return json({error:'invalid_payload'},400);
    const writeHash=await digest(token);
    for(let attempt=0;attempt<3;attempt++) {
      const row=await env.DB.prepare('SELECT * FROM installs WHERE write_hash = ?').bind(writeHash).first();
      if(!row)return json({error:'unauthorized'},401);
      if(row.expires_at<=now||(!row.started_at&&row.start_before<=now))return json({error:'expired'},410);
      if(row.updates>=120)return json({error:'rate_limited'},429);
      const next=transition(row,data.event);
      if(!next)return json({accepted:false});
      if(next.status===row.status&&next.attention===row.attention&&next.phase===row.phase&&next.audio_status===row.audio_status&&next.microphone_status===row.microphone_status&&next.completed_steps===row.completed_steps)return json({accepted:true});
      const result=await env.DB.prepare("UPDATE installs SET status = ?, rank = ?, attention = ?, phase = ?, audio_status = ?, microphone_status = ?, completed_steps = ?, error_url = ?, installed_at = CASE WHEN ? = 'installed' THEN COALESCE(installed_at, ?) ELSE installed_at END, started_at = COALESCE(started_at, ?), updated_at = ?, updates = updates + 1 WHERE id = ? AND updates = ?").bind(next.status,next.rank,next.attention,next.phase,next.audio_status,next.microphone_status,next.completed_steps,hasReport?data.errorUrl:null,data.event,now,now,now,row.id,row.updates).run();
      if(result.meta.changes)return json({accepted:true});
    }
    return json({error:'retry'},409);
  }catch {return json({error:'unavailable'},503);}
}

export default {fetch(request,env) {return handle(request,env);}};
