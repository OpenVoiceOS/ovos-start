import {canExploreLocal,firstCapability,afterCapability} from './journey.mjs';
import { DEFAULTS, DEVICES, usesVirtualenvPreset, usesAlphaPreset, validateState } from './scenario.mjs';
import { readSetupSession, sameSetupChoices } from './short-setup.mjs';

export const DRAFT_KEY = 'ovos.wizard.draft.v1';
export const DRAFT_STEPS = Object.freeze(['welcome','language','device','prepare','piModel','memory','cpu','speech','review','guidance','purpose','skills','homeassistant','llm','method','channel','telemetry']);

/** Validate partial, secret-free choices using the same contract as issued recipes.
 * @param {object} value Partial setup. @returns {object} Validated choices.
 */
function choices(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== Object.keys(DEFAULTS).length) throw new Error('Invalid draft choices.');
  const checked=validateState({...value,device:value.device===null?'computer':value.device});
  return {...checked,device:value.device};
}

/** Retain only bounded navigation metadata, never arbitrary persisted markup.
 * @param {object} value Route. @returns {object} Safe route.
 */
export function draftRoute(value) {
  if (!value || !DRAFT_STEPS.includes(value.step)) throw new Error('Invalid draft route.');
  return {step:value.step,devicePane:value.devicePane==='platform'?'platform':'cards',unlistedDevice:value.unlistedDevice===true,
    editing:value.editing===true,editSnapshot:value.editSnapshot?choices(value.editSnapshot):null,
    editAnswered:Array.isArray(value.editAnswered)?value.editAnswered.filter(key=>DRAFT_STEPS.includes(key)):[],
    editSkillsAnswered:value.editSkillsAnswered===true,editPreparedFor:Object.hasOwn(DEVICES,value.editPreparedFor)?value.editPreparedFor:null};
}

/** Validate a persisted draft without issuing or extending an executable command.
 * @param {object} value Saved draft. @returns {object} Safe draft.
 */
export function validateDraft(value) {
  if (!value || value.version!==1 || typeof value.id!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id)) throw new Error('Invalid draft.');
  if (!Array.isArray(value.routes) || !value.routes.length || value.routes.length>256 || !Number.isInteger(value.cursor) || value.cursor<0 || value.cursor>=value.routes.length) throw new Error('Invalid draft history.');
  const state=choices(value.state),routes=value.routes.map(draftRoute);
  const issuedFragment=typeof value.issuedFragment==='string'?value.issuedFragment:'';
  const setup=issuedFragment?readSetupSession(issuedFragment):null;
  if(issuedFragment&&!setup)throw new Error('Invalid issued setup.');
  const route=routes[value.cursor];
  if(!state.device&&!['welcome','language','device','guidance','purpose'].includes(route.step))throw new Error('Draft needs a device.');
  if(route.step==='review'&&(!setup||!sameSetupChoices(setup,state)))throw new Error('Review needs matching issued choices.');
  if(route.editing&&(!setup||!route.editSnapshot||!sameSetupChoices(setup,route.editSnapshot)))throw new Error('Active edit needs its issued baseline.');
  if(routes.some(item=>item.editing&&(!item.editSnapshot?.device||!setup)))throw new Error('An edit needs a reviewed baseline.');
  return {version:1,id:value.id,state,confirmedState:choices(value.confirmedState||state),routes,cursor:value.cursor,
    answered:Array.isArray(value.answered)?value.answered.filter(key=>DRAFT_STEPS.includes(key)):[],
    skillsAnswered:value.skillsAnswered===true,preparedFor:Object.hasOwn(DEVICES,value.preparedFor)?value.preparedFor:null,
    welcomeHeard:value.welcomeHeard===true,issuedFragment};
}

/** Read an optional local draft; corrupt/blocked storage cannot break setup.
 * @param {Storage|null} storage Browser storage. @returns {object|null} Valid draft.
 */
export function readDraft(storage) {
  try { const text=storage?.getItem(DRAFT_KEY);return text?validateDraft(JSON.parse(text)):null; } catch { return null; }
}

/** Save only the validated allowlist. Credentials never enter this representation.
 * @param {Storage|null} storage Browser storage. @param {object} value Draft. @returns {boolean} Stored.
 */
export function writeDraft(storage,value) {
  try { storage?.setItem(DRAFT_KEY,JSON.stringify(validateDraft(value)));return !!storage; } catch { return false; }
}

/** A shared link takes precedence unless this browser history entry owns the draft.
 * @param {object|null} draft Stored draft. @param {object|null} marker History marker.
 * @param {string} fragment Current fragment. @returns {boolean} Whether to resume.
 */
export function canResumeDraft(draft,marker,fragment) {
  if(!draft)return false;
  if(ownsDraftHistory(draft,marker))return true;
  return !fragment || fragment==='#';
}

/** Normalize historical destinations against current choices, never old capabilities.
 * @param {object} route Requested route. @param {object} state Latest choices.
 * @param {boolean} reviewed Whether the issued artifact matches. @returns {object} Usable route.
 */
export function normalizeRoute(route,state,reviewed=false) {
  let step=route.step;
  const fallback=reviewed?'review':state.device?'prepare':'device';
  if(!state.device&&!['welcome','language','device','guidance','purpose'].includes(step))step='device';
  if(state.experience==='hub'&&['speech','piModel','memory','cpu','homeassistant','llm'].includes(step))step=fallback;
  if(['piModel','memory','cpu'].includes(step)){
    const path=[];let question=firstCapability(state);
    while(question!=='speech'&&path.length<4){path.push(question);question=afterCapability(question,state);}
    if(!canExploreLocal(state)||!path.includes(step))step='speech';
  }
  if(step==='method'&&(usesVirtualenvPreset(state.device)||state.speech==='local'))step=fallback;
  if(step==='channel'&&(usesAlphaPreset(state.device)||state.speech==='local'))step=fallback;
  if(step==='review'&&!reviewed)step=state.device?(state.experience==='hub'?'prepare':'speech'):'device';
  return {...route,step,...step==='review'?{editing:false,editSnapshot:null}:{}};
}

/** Check a persisted browser cursor before dereferencing its route.
 * @param {object|null} draft Draft. @param {object|null} marker History entry. @returns {boolean} Valid owner.
 */
export function ownsDraftHistory(draft,marker){
  return !!draft&&marker?.id===draft.id&&Number.isInteger(marker.cursor)&&marker.cursor>=0&&marker.cursor<draft.routes.length;
}
