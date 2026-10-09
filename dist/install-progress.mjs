import { errorReportUrl } from './report-link.mjs';
import { STARTER_EXAMPLES } from './starter-examples.mjs';
import { DEMO_THUMBNAILS } from './demo-thumbnails.mjs';
/** Device callback and launch capabilities never enter recipe links or storage. */
export const INSTALL_API_URL='https://start-api.smartgic.io/api/install';
const BROWSER_CREDENTIAL_KEY='ovos-start-browser-v1';

/** Keep one browser's status access across reloads without third-party cookies.
 * Storage-blocked browsers retain access for the lifetime of the current page.
 * @param {object} options Injectable storage and cryptographic randomness.
 * @returns {function(): string} Lazy getter for a private 256-bit browser credential.
 */
export function createBrowserCredential({getStorage=()=>globalThis.localStorage,randomBytes=bytes=>globalThis.crypto.getRandomValues(bytes)}={}) {
  let credential;
  return ()=>{
    if(credential)return credential;
    let storage;
    try {
      storage=getStorage();
      const saved=storage?.getItem(BROWSER_CREDENTIAL_KEY);
      if(typeof saved==='string'&&/^[a-f0-9]{64}$/.test(saved))return credential=saved;
    } catch { /* Browser privacy settings may disable storage. */ }
    const bytes=new Uint8Array(32);
    randomBytes(bytes);
    credential=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
    try { storage?.setItem(BROWSER_CREDENTIAL_KEY,credential); } catch { /* Keep the current page working. */ }
    return credential;
  };
}

const browserCredential=createBrowserCredential();
export const CHECK_COMMAND='sh "$HOME/.config/ovos-installer/check-setup.sh"';
export const INSTALLED_STATES=Object.freeze(['installed','services_ready','voice_ready']);
export const VOICE_EXAMPLES=Object.freeze(Object.fromEntries(Object.entries(STARTER_EXAMPLES).filter(([,items])=>items.some(item=>item.kind==='time')).map(([locale,items])=>[locale,items.find(item=>item.kind==='time').phrase])));
export const DEMOS=Object.freeze([
  {thumbnail:DEMO_THUMBNAILS['coffee-demo'],asset:'coffee-demo.jpg',title:'A coffee, by voice',url:'https://www.youtube.com/watch?v=PRzGxmTCFb0',meta:'Dutch audio · 19 sec'},
  {thumbnail:DEMO_THUMBNAILS['ai-demo'],asset:'ai-demo.jpg',title:'A conversation with AI',url:'https://www.youtube.com/watch?v=C_xS87EbsiM',meta:'Dutch audio · 45 sec'},
]);
const messages={
  waiting:['Waiting for your device','Paste the command in Terminal to begin. You can leave this page open.'],
  started:['Checking your device','Follow any prompts in Terminal. This can take a while.'],
  downloading:['Downloading the installer','Follow any prompts in Terminal. This can take a while.'],
  installing:['Installing OVOS','Follow any prompts in Terminal. This can take a while.'],
  installed:['OVOS is installed','Now let’s try your voice.'],
  services_ready:['OVOS is installed','Open Terminal to finish the sound and voice checks.'],
  voice_ready:['Your voice check passed',''],
  failed:['Installation stopped','Check Terminal for the reason. Your choices are saved.'],
  cancelled:['Installation cancelled','You can return to Terminal when you’re ready.'],
};

/** Derive accessible, honest status text without fake percentages. @param {object} model @returns {object} */
export function progressCopy(model) {
  const installed=INSTALLED_STATES.includes(model.session?.status);
  let [title,description]=messages[model.session?.status]||messages.waiting;
  if(['failed','cancelled'].includes(model.session?.status))return {title,description,installed:false,complete:false};
  if(model.session?.attention){title='A check needs your attention';description='Open Terminal to finish the sound and voice checks.';}
  if(model.error==='expired'){title='Installation updates have ended';description='Live updates end after 24 hours. You can still run the device check.';}
  else if(model.error&&!['failed','cancelled','voice_ready'].includes(model.session?.status)){title=model.session?'Reconnecting…':'Continue in Terminal';description=model.session&&!installed?'Your device may still be installing. We’ll reconnect automatically.':model.session?'We’ll reconnect automatically.':'Live updates are unavailable. Follow the installer in Terminal.';}
  return {title,description,installed,complete:model.session?.status==='voice_ready'};
}

/** Confirmed installer checkpoints. An active phase is never a completion receipt.
 * @param {object} model Current confirmed session. @returns {Array<object>}
 */
export function installationMilestones(model) {
  const session=model.session,status=session?.status,installed=INSTALLED_STATES.includes(status);
  if(!session||status==='waiting')return [];
  const interrupted=['failed','cancelled'].includes(status);
  const phase=Number.isInteger(session.phase)?Math.max(0,Math.min(4,session.phase)):0;
  const rank=session.progressRank??(status==='installing'?3:['started','downloading'].includes(status)?2:0);
  if(interrupted&&!rank)return [];
  // Older launchers only reported that installation began. Do not invent a
  // preparation checkpoint, including after those installations have stopped.
  const coarse=!installed&&rank>=3&&phase===0;
  const current=installed?5:rank>=3?phase:0;
  const steps=[
    ['Download installer','Fetch the tools for your setup.'],
    ['Prepare your device','Check the system and configure your hardware.'],
    ['Install OVOS','Install OVOS and your selected skills.'],
    ['Set up services','Prepare OVOS to run on your device.'],
    ['Finish installation','Save settings and finish the installer.'],
  ];
  return steps.map(([label,description],index)=>({label,description,state:coarse?(index===0?'complete':'unknown'):index<current?'complete':index===current?(interrupted?'stopped':'current'):interrupted?'unknown':'upcoming'}));
}

/** Three honest stages even when an older installer omits detailed checkpoints.
 * @param {object} model Confirmed tracker state. @returns {Array<object>}
 */
export function installationStages(model) {
  const status=model.session?.status;
  if(!['started','downloading','installing',...INSTALLED_STATES].includes(status))return [];
  const installed=INSTALLED_STATES.includes(status);
  const current=installed?3:status==='installing'?1:0;
  return [['Downloading','download'],['Installing','settings'],['Installed','schedule']].map(([label,icon],index)=>({label,icon,state:index<current?'complete':index===current?'current':'upcoming'}));
}

/** Display real elapsed time; a remaining range requires server-side comparable runs.
 * @param {object} model Confirmed tracker state. @param {number} now Unix seconds.
 * @returns {object|null} Timing copy without an invented duration or percentage.
 */
export function installationTiming(model,now=Math.floor(Date.now()/1000)) {
  const session=model.session;
  if(!Number.isSafeInteger(session?.startedAt)||session.startedAt<=0)return null;
  const installed=INSTALLED_STATES.includes(session.status),stopped=['failed','cancelled'].includes(session.status);
  const end=installed?session.installedAt:stopped?session.updatedAt:model.error?(model.observedAt??session.updatedAt):now;
  if(!Number.isSafeInteger(end)||end<session.startedAt)return null;
  const elapsed=end-session.startedAt,minutes=Math.floor(elapsed/60);
  const elapsedText=installed?`Finished in ${Math.max(1,Math.ceil(elapsed/60))} min`:minutes?`${minutes} min elapsed`:'Less than a minute elapsed';
  if(installed||stopped)return {elapsedText,remaining:null,note:null};
  if(model.error)return {elapsedText,remaining:null,note:model.error==='expired'?null:'Timing paused while reconnecting.'};
  const estimate=session.estimate;
  if(!estimate||estimate.samples<5||!Number.isSafeInteger(estimate.lowSeconds)||!Number.isSafeInteger(estimate.highSeconds)||estimate.lowSeconds<60||estimate.highSeconds<estimate.lowSeconds||estimate.highSeconds>=86400)return {elapsedText,remaining:null,note:'Time varies by device and connection.'};
  if(elapsed>=estimate.highSeconds)return {elapsedText,remaining:null,note:'Taking longer than recent setups.'};
  const low=Math.max(1,Math.ceil((estimate.lowSeconds-elapsed)/60)),high=Math.max(low+1,Math.ceil((estimate.highSeconds-elapsed)/60));
  return {elapsedText,remaining:`About ${low}–${high} min`,note:'Based on your recent setups for this device.'};
}

/** Only show voice examples applicable to the selected recipe. @param {object} state @returns {string} */
export function guideKind(state) {return state.experience==='hub'?'hub':!state.skills?'skills':VOICE_EXAMPLES[state.locale]?'voice':'language';}

/** Small cancellable polling client. Durable state lives in the authenticated service. */
export class InstallTracker {
  /** @param {object} options Injectable browser interfaces for meaningful lifecycle tests. */
  constructor({fetcher=(...args)=>fetch(...args),credential=browserCredential,onChange=()=>{},schedule=(...args)=>setTimeout(...args),cancel=timer=>clearTimeout(timer),now=()=>Date.now()}={}) {
    Object.assign(this,{fetcher,credential,onChange,schedule,cancel,now});this.code=null;this.session=null;this.error=null;this.active=false;this.generation=0;this.timer=null;this.pending=null;this.polling=null;this.observedAt=null;
  }
  /** Current view state. @returns {object} */
  snapshot(){return {code:this.code,session:this.session,error:this.error,observedAt:this.observedAt};}
  /** Authenticate to the fixed public API without cookies or redirects. @param {object} data @returns {Promise<object>} */
  async request(data){
    let credential;
    try { credential=this.credential(); } catch { throw new Error('unavailable'); }
    if(typeof credential!=='string'||!/^[a-f0-9]{64}$/.test(credential))throw new Error('unavailable');
    const response=await this.fetcher(INSTALL_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+credential},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(response.status===410?'expired':'unavailable');
    const value=await response.json();
    if(!/^[a-f0-9]{32}$/.test(value.id)||!Object.hasOwn(messages,value.status)||!Number.isSafeInteger(value.expiresAt)||!Number.isSafeInteger(value.updatedAt)||!Number.isSafeInteger(value.createdAt)||typeof value.attention!=='boolean')throw new Error('unavailable');
    if(value.phase!==undefined&&(!Number.isInteger(value.phase)||value.phase<0||value.phase>4))throw new Error('unavailable');
    if(data.code&&(typeof value.launchToken!=='string'||value.launchToken.length!==22||!/^[A-Za-z0-9_-]{22}$/.test(value.launchToken)))throw new Error('unavailable');
    if(value.status!=='failed'||!errorReportUrl(value.errorUrl))delete value.errorUrl;
    delete value.writeToken;
    return value;
  }
  /** Restore the same server session on reload; never issue a new recipe. @param {string} code @returns {Promise<object|null>} */
  connect(code){
    this.active=true;
    if(this.code===code&&this.pending)return this.pending;
    if(this.code===code&&this.session){this.queue();return Promise.resolve(this.session);}
    this.cancel(this.timer);this.code=code;this.session=null;this.error=null;this.polling=null;this.observedAt=null;const generation=++this.generation;
    this.pending=this.request({code}).then(session=>{if(generation===this.generation){this.session=session;this.error=null;this.observedAt=Math.floor(this.now()/1000);}return generation===this.generation?session:null;}).catch(error=>{if(generation===this.generation)this.error=error.message;return null;}).finally(()=>{if(generation===this.generation){this.pending=null;this.emit();this.queue();}});
    return this.pending;
  }
  /** Emit only into the current mounted review screen. @returns {void} */
  emit(){if(this.active)this.onChange(this.snapshot());}
  /** Schedule a bounded poll without overlapping requests. @returns {void} */
  queue(){this.cancel(this.timer);if(this.active&&this.session&&!this.polling&&!['voice_ready','failed','cancelled'].includes(this.session.status)&&this.error!=='expired')this.timer=this.schedule(()=>{void this.poll();},this.error?15000:5000);}
  /** Fetch new milestones while preserving already confirmed completion on network failure. @returns {Promise<void>} */
  async poll(){
    if(!this.active||!this.session||this.pending)return;
    if(this.polling)return this.polling;
    const generation=this.generation,id=this.session.id;
    this.cancel(this.timer);
    this.polling=(async()=>{
      try{
        const value=await this.request({id});
        if(generation!==this.generation||value.id!==id||value.updatedAt<this.session.updatedAt)return;
        const order=Object.keys(messages),before=order.indexOf(this.session.status),after=order.indexOf(value.status);
        if((value.phase??0)<(this.session.phase??0)||after<before||(['failed','cancelled'].includes(this.session.status)&&value.status!==this.session.status))return;
        this.session={...this.session,...value};this.error=null;this.observedAt=Math.floor(this.now()/1000);
      }
      catch(error){if(generation!==this.generation)return;this.error=error.message;}
    })().finally(()=>{if(generation===this.generation){this.polling=null;this.emit();this.queue();}});
    return this.polling;
  }
  /** Stop work when leaving the screen; late results cannot update other recipes. @returns {void} */
  stop(){this.active=false;this.cancel(this.timer);}
  /** Detach a completed attempt, discarding late requests without changing its server record. @returns {void} */
  reset(){this.stop();this.generation++;this.code=null;this.session=null;this.error=null;this.pending=null;this.polling=null;this.observedAt=null;this.timer=null;}
  /** Retry a temporary service failure without renewing the one-hour code. @returns {Promise<object|null|void>} */
  retry(){if(this.session)return this.poll();return this.connect(this.code);}
}
