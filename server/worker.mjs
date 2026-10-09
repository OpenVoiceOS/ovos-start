import { decodeRecipeEnvelope } from '../dist/recipe-code.mjs';
import { validateState } from '../dist/scenario.mjs';

export const RELAY_ORIGIN='https://ovos-install-status.goldyfruit.chatgpt.site';
const encoder=new TextEncoder();

/** Stable opaque owner identifier; email and platform identity stay in the wizard. @param {string} secret @param {string} id @returns {Promise<string>} */
export async function ownerKey(secret,id) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,encoder.encode(`owner:${id}`));
  return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

/** Bound the small same-origin browser API body. @param {Request} request @returns {Promise<object>} */
async function payload(request) {
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new Error('payload');
  const reader=request.body?.getReader();if(!reader)throw new Error('payload');
  const parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512){await reader.cancel();throw new Error('payload');}parts.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Same-origin, signed-in proxy: a viewer can only read their own install. @param {Request} request @param {object} env @param {Function} fetcher @returns {Promise<Response>} */
export async function handle(request,env,fetcher=(...args)=>fetch(...args)) {
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  if(url.pathname!=='/api/install'||request.method!=='POST')return reply({error:'not_found'},404);
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)return reply({error:'sign_in_required'},401);
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'forbidden'},403);
  if(!/^[a-f0-9]{64}$/.test(env.RELAY_ADMIN_KEY||''))return reply({error:'unavailable'},503);
  let data;try{data=await payload(request);}catch{return reply({error:'invalid_payload'},400);}
  if(!data||Array.isArray(data)||Object.keys(data).length!==1)return reply({error:'invalid_payload'},400);
  let route;
  if(Object.hasOwn(data,'code')){
    try{const recipe=decodeRecipeEnvelope(data.code,{allowExpired:true});validateState(recipe.state);if(recipe.version!==2)throw new Error();}catch{return reply({error:'invalid_code'},400);}
    route='/v1/sessions';
  }else if(typeof data.id==='string'&&/^[a-f0-9]{32}$/.test(data.id)){route='/v1/session';}
  else return reply({error:'invalid_payload'},400);
  try {
    const owner=await ownerKey(env.RELAY_ADMIN_KEY,user);
    const result=await fetcher(RELAY_ORIGIN+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.RELAY_ADMIN_KEY}`},body:JSON.stringify({...data,owner}),redirect:'manual',signal:AbortSignal.timeout(8000)});
    // Do not accidentally forward the hosting platform's sign-in HTML or a redirect.
    if(result.status>=300&&result.status<400)return reply({error:'unavailable'},503);
    if(!result.headers.get('content-type')?.startsWith('application/json')){
      console.warn('install_relay_unavailable',JSON.stringify({kind:'response',status:result.status}));
      return reply({error:'unavailable'},503);
    }
    const received=await result.json();
    if(received&&typeof received==='object')delete received.writeToken;
    return reply(received,result.status);
  }catch(error){
    // Diagnostics deliberately exclude messages, payloads, identities and secrets.
    const name=['TypeError','AbortError','TimeoutError'].includes(error?.name)?error.name:'Error';
    const code=String(error?.message||'').match(/\b10\d{2}\b/)?.[0]||null;
    console.warn('install_relay_unavailable',JSON.stringify({kind:'exception',name,code,reason:/illegal invocation|incorrect this/i.test(error?.message||'')?'binding':/fetch|network/i.test(error?.message||'')?'network':/AbortSignal|timeout/i.test(error?.message||'')?'timeout':'other'}));
    return reply({error:'unavailable'},503);
  }
}
export default {fetch(request,env) {return handle(request,env);}};
