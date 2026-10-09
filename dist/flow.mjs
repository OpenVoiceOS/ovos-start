import { DEFAULTS, DEVICES, EXPERIENCES, allowedExperiences, usesAlphaPreset, selectDevice, validateState } from './scenario.mjs';
import { recommend } from './recommendations.mjs';

/** Return compatible hardware for the chosen purpose. @param {string} experience @returns {string[]} */
export function devicesForExperience(experience) {
  if (typeof experience !== 'string' || !Object.hasOwn(EXPERIENCES, experience)) throw new Error('Choose an experience.');
  return Object.keys(DEVICES).filter(device => allowedExperiences(device).includes(experience));
}

/** Derive starter skills from earlier choices unless a bundle was explicitly chosen or restored.
 * @param {object} state Recipe. @param {boolean} skillsAnswered Preserve a deliberate bundle. @returns {object} Recipe.
 */
export function applySkillDefaults(state, skillsAnswered = false) {
  if (skillsAnswered) return state;
  return { ...state, skills: recommend(state).skills, extraSkills: false };
}

/** Change purpose while preserving compatible preferences and deliberate skill choices.
 * @param {object} state @param {string} experience @param {boolean} skillsAnswered @returns {object}
 */
export function chooseExperience(state, experience, skillsAnswered = false) {
  const compatible = devicesForExperience(experience);
  const device = compatible.includes(state.device) ? state.device : null;
  const next = { ...DEFAULTS, ...state, experience, device,
    channel: (usesAlphaPreset(state.device) && !device) || (experience === 'hub' && state.speech === 'local' && !usesAlphaPreset(device)) ? 'testing' : state.channel,
    speech: experience === 'hub' ? 'auto' : state.speech,
    homeassistant: experience === 'hub' ? false : state.homeassistant,
    llmMode: experience === 'hub' ? 'off' : state.llmMode,
    extraSkills: experience === 'hub' && state.method === 'containers' ? false : state.extraSkills };
  return applySkillDefaults(next,skillsAnswered);
}

/** Finish the recipe without changing the selected purpose. @param {object} state @param {string} device @returns {object} */
export function chooseHardware(state, device) {
  if (!devicesForExperience(state.experience).includes(device)) throw new Error('That device does not fit this experience.');
  if (state.device === device) return validateState(state);
  return validateState(selectDevice(state, device));
}

/** Show physical devices first; resolve computer operating systems separately. @param {string} experience @returns {string[]} */
export function hardwareCardsForExperience(experience) {
  return devicesForExperience(experience).filter(device => !DEVICES[device].routeOnly);
}

/** Resolve an explicit OS choice without guessing an unknown system. @param {string} platform @param {boolean} unlisted @returns {string|null} */
export function platformTarget(platform, unlisted = false) {
  if (platform === 'linux') return unlisted ? 'other' : 'computer';
  if (platform === 'mac' || platform === 'windows') return platform;
  if (platform === 'unknown') return null;
  throw new Error('Choose an operating system.');
}

/** Apply speech requirements and release their channel override when no longer needed. @param {object} state @param {string} speech @returns {object} */
export function chooseSpeech(state, speech) {
  if (!['auto', 'public', 'local'].includes(speech)) throw new Error('Choose a speech setup.');
  return { ...state, speech,
    method: speech === 'local' ? 'virtualenv' : state.method,
    channel: speech === 'local' || usesAlphaPreset(state.device) ? 'alpha' : state.speech === 'local' ? 'testing' : state.channel };
}

/** Apply a capability answer and derive known board architecture, never the installed OS. @param {object} state @param {string} key @param {string} value @returns {object} */
export function chooseCapability(state,key,value) {
  const values={memory:['unknown','under8','8plus'],cpu:['unknown','arm64','avx2','intel-mac'],piModel:['unknown','older','pi5']};
  if(!Object.hasOwn(values,key)||!values[key].includes(value))throw new Error('Choose a device detail.');
  const next={...state,[key]:value};
  if(key==='memory'&&['pi','jetson'].includes(state.device))next.cpu='arm64';
  return next;
}
