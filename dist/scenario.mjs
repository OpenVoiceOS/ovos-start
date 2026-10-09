import { speechEligibility } from './recommendations.mjs';
export const DEVICES = Object.freeze({
  pi: { name: 'Raspberry Pi', short: 'Raspberry Pi', icon: 'cpu', desc: 'Tiny computer. Big personality.', detail: 'Pi 3, 4 or 5 · Linux installed', badge: 'SMALL & MIGHTY' },
  computer: { name: 'Linux computer', short: 'Linux computer', icon: 'laptop', desc: 'Give your laptop a little voice.', detail: 'Laptop, desktop or mini PC' },
  mark1: { name: 'Mycroft Mark I', short: 'Mycroft Mark I', detail: '64-bit Debian 13' },
  mark2: { name: 'Mycroft Mark II', short: 'Mycroft Mark II', icon: 'speaker', desc: 'A fresh chapter for your Mark II.', detail: '64-bit Debian 13' },
  devkit: { name: 'Mycroft DevKit', short: 'Mycroft DevKit', detail: 'Pi 4 · 64-bit Debian 13' },
  jetson: { name: 'Jetson Orin Nano', short: 'Jetson Orin Nano', detail: 'Supported Ubuntu Linux' },
  server: { name: 'Home server', short: 'Home server', icon: 'server', desc: 'One brain. Room to grow.', detail: 'A hub for your future satellites' },
  mac: { name: 'Mac', short: 'Mac', routeOnly: true, detail: 'Apple Silicon · macOS 15+' },
  windows: { name: 'Windows PC', short: 'Windows PC (Ubuntu / WSL2)', routeOnly: true, detail: 'Ubuntu terminal in WSL2' },
  other: { name: 'Other Linux device', short: 'Linux device', routeOnly: true, detail: 'Supported Linux system confirmed' },
});
export const EXPERIENCES = Object.freeze({
  ready: { name: 'Ready to chat', icon: 'mic', desc: 'The voice assistant, with standard skills included.', result: 'Your everyday sidekick.', summary: 'Voice + standard skills', profile: 'ovos' },
  tinker: { name: 'I like to tinker', icon: 'sliders', desc: 'Start with the voice engine. Add your own skills later.', result: 'A voice of your own.', summary: 'Voice · bring your skills', profile: 'ovos' },
  hub: { name: 'A brain for my home', icon: 'network', desc: 'A headless hub. Connect room satellites after setup.', result: 'Big ideas. One little hub.', summary: 'HiveMind server + skills', profile: 'server' },
});
export const LANGUAGES = Object.freeze({ 'en-us': 'English (US)', 'fr-fr': 'Français', 'de-de': 'Deutsch', 'es-es': 'Español', 'it-it': 'Italiano', 'nl-nl': 'Nederlands', 'pt-pt': 'Português', 'ca-es': 'Català', 'eu-es': 'Euskara', 'gl-es': 'Galego', 'hi-in': 'हिन्दी', 'kab-dz': 'Taqbaylit' });
export const DEFAULTS = Object.freeze({ device: null, experience: 'ready', locale: 'en-us', method: 'virtualenv', channel: 'alpha', extraSkills: false, telemetry: true, expertise: 'guided', skills: true, speech: 'auto', memory: 'unknown', cpu: 'unknown', piModel: 'unknown', homeassistant: false, llmMode: 'off' });
/** Describe every accepted option for optional browser agents; cross-field rules use validateState. */
export const PRESET_SCHEMA = Object.freeze({ type: 'object', properties: {
  device: { type: 'string', enum: Object.keys(DEVICES) }, experience: { type: 'string', enum: Object.keys(EXPERIENCES) },
  locale: { type: 'string', enum: Object.keys(LANGUAGES) }, method: { type: 'string', enum: ['virtualenv', 'containers'] },
  channel: { type: 'string', enum: ['testing', 'alpha'] }, expertise: { type: 'string', enum: ['guided', 'tinker', 'expert'] },
  speech: { type: 'string', enum: ['auto', 'public', 'local'] }, memory: { type: 'string', enum: ['unknown', 'under8', '8plus'] },
  cpu: { type: 'string', enum: ['unknown', 'arm64', 'avx2', 'intel-mac'] }, piModel: { type: 'string', enum: ['unknown', 'older', 'pi5'] },
  llmMode: { type: 'string', enum: ['off', 'local', 'online'] },
  ...Object.fromEntries(['extraSkills', 'telemetry', 'skills', 'homeassistant'].map(key => [key, { type: 'boolean' }])),
}, required: Object.keys(DEFAULTS), additionalProperties: false });
/** Return the experiences the selected hardware can actually install. @param {string} device @returns {string[]} */
export function allowedExperiences(device) { return device === 'server' ? ['hub'] : ['mark1', 'mark2', 'devkit'].includes(device) ? ['ready', 'tinker'] : ['ready', 'tinker', 'hub']; }
/** Identify devices requiring the installer screen hardware override. @param {string} device @returns {boolean} */
export function usesScreenHardware(device) { return ['mark2', 'devkit'].includes(device); }
/** Include installer tuning for Raspberry Pi-based devices. @param {string} device @returns {boolean} */
export function usesRaspberryPiTuning(device) { return ['pi', 'mark1', 'mark2', 'devkit'].includes(device); }
/** Keep the wizard's enclosure presets on the verified Python install path. @param {string} device @returns {boolean} */
export function usesVirtualenvPreset(device) { return ['mark1', 'mark2', 'devkit', 'mac', 'windows'].includes(device); }
/** Identify presets constrained to the alpha release. @param {string} device @returns {boolean} */
export function usesAlphaPreset(device) { return usesScreenHardware(device) || device === 'mac'; }
/** Apply device requirements when a person changes cards. @param {object} state @param {string} device @returns {object} */
export function selectDevice(state, device) {
  if (!Object.hasOwn(DEVICES, device)) throw new Error('Choose a supported device.');
  const experience = allowedExperiences(device).includes(state.experience) ? state.experience : allowedExperiences(device)[0];
  return { ...state, device, experience, method: usesVirtualenvPreset(device) ? 'virtualenv' : state.method, channel: usesAlphaPreset(device) ? 'alpha' : state.channel, extraSkills: experience === 'hub' && state.method === 'containers' ? false : state.extraSkills, speech: 'auto', homeassistant: experience === 'hub' ? false : state.homeassistant, llmMode: experience === 'hub' ? 'off' : state.llmMode, memory: ['mark1', 'mark2', 'devkit'].includes(device) ? 'under8' : 'unknown', cpu: ['mark1', 'mark2', 'devkit'].includes(device) ? 'arm64' : 'unknown', piModel: 'unknown' };
}
/** Validate all external/shared choices before producing shell or YAML. @param {object} state @returns {object} */
export function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid setup.');
  if (Object.keys(state).some(key => !Object.hasOwn(DEFAULTS, key))) throw new Error('Unknown setup option.');
  for (const key of Object.keys(DEFAULTS)) if (!Object.hasOwn(state, key)) throw new Error(`Missing setup option: ${key}`);
  if (['device', 'experience', 'locale', 'method', 'channel'].some(key => typeof state[key] !== 'string')) throw new Error('Setup choices must be text.');
  if (!Object.hasOwn(DEVICES, state.device)) throw new Error('Choose a supported device.');
  if (!allowedExperiences(state.device).includes(state.experience)) throw new Error('This experience does not fit this device.');
  if (!Object.hasOwn(LANGUAGES, state.locale)) throw new Error('Choose a supported language.');
  if (!['virtualenv', 'containers'].includes(state.method)) throw new Error('Invalid installation method.');
  if (!['testing', 'alpha'].includes(state.channel)) throw new Error('Invalid release channel.');
  if (typeof state.extraSkills !== 'boolean' || typeof state.telemetry !== 'boolean') throw new Error('Invalid optional settings.');
  if (usesScreenHardware(state.device) && (state.method !== 'virtualenv' || state.channel !== 'alpha')) throw new Error('Mark II and DevKit require virtualenv and alpha.');
  if (state.device === 'mark1' && state.method !== 'virtualenv') throw new Error('The Mark I preset uses virtualenv for enclosure support.');
  if (state.device === 'mac' && (state.method !== 'virtualenv' || state.channel !== 'alpha')) throw new Error('macOS requires virtualenv and alpha.');
  if (state.device === 'windows' && state.method !== 'virtualenv') throw new Error('The Windows WSL2 preset uses virtualenv.');
  for (const [key, values] of Object.entries({ expertise: ['guided', 'tinker', 'expert'], speech: ['auto', 'public', 'local'], memory: ['unknown', 'under8', '8plus'], cpu: ['unknown', 'arm64', 'avx2', 'intel-mac'], piModel: ['unknown', 'older', 'pi5'], llmMode: ['off', 'local', 'online'] })) if (!values.includes(state[key])) throw new Error('Invalid ' + key + '.');
  if (typeof state.skills !== 'boolean' || typeof state.homeassistant !== 'boolean') throw new Error('Invalid feature choice.');
  if (state.extraSkills && !state.skills) throw new Error('Extra skills require standard skills.');
  if (state.experience === 'hub' && (state.speech !== 'auto' || state.homeassistant || state.llmMode !== 'off')) throw new Error('This hub preset does not support local speech or these integrations.');
  if (state.experience === 'hub' && state.method === 'containers' && state.extraSkills) throw new Error('Container hubs do not install extra skills.');
  if (state.speech === 'local' && (state.method !== 'virtualenv' || state.channel !== 'alpha' || !speechEligibility(state).eligible)) throw new Error('This setup does not meet local-speech preview requirements.');
  return { ...state };
}
/** Produce the real installer scenario, with privacy and tuning explicit. @param {object} input @returns {string} */
export function buildYaml(input) {
  const s = validateState(input);
  return `# Created with OVOS Start · contract checked 2026-10-06\nuninstall: false\nmethod: ${s.method}\nchannel: ${s.channel}\nprofile: ${EXPERIENCES[s.experience].profile}\n${s.speech === 'auto' ? '' : 'speech_engine: ' + s.speech + '\n'}${usesScreenHardware(s.device) ? `hardware: ${s.device}\n` : ''}features:\n  skills: ${s.skills}\n  extra_skills: ${s.extraSkills}\n  gui: ${usesScreenHardware(s.device)}\n  homeassistant: ${s.homeassistant}\n  llm: ${s.llmMode !== 'off'}\nraspberry_pi_tuning: ${usesRaspberryPiTuning(s.device)}\nshare_telemetry: ${s.telemetry}\nshare_usage_telemetry: false\n`;
}
/** Serialize every non-secret recommendation choice into a versioned link. @param {object} input @returns {string} */
export function encodePreset(input) {
  const s = validateState(input);
  return new URLSearchParams({ v: '2', ...Object.fromEntries(Object.entries(s).map(([key, value]) => [key, typeof value === 'boolean' ? value ? '1' : '0' : value])) }).toString();
}
/** Decode old links conservatively and reject unsupported or injected options. @param {string} fragment @returns {object|null} */
export function decodePreset(fragment) {
  const raw = fragment.replace(/^#/, '');
  if (!raw) return null;
  if (raw.length > 1200) throw new Error('This setup link is too long.');
  const params = new URLSearchParams(raw);
  const legacy = params.get('v') === '1';
  const keys = legacy ? ['v','device','experience','language','method','channel','extras','telemetry'] : ['v', ...Object.keys(DEFAULTS)];
  if (!['1','2'].includes(params.get('v')) || [...params.keys()].some(key => !keys.includes(key)) || keys.some(key => params.getAll(key).length !== 1)) throw new Error('This setup link is incomplete or unsupported.');
  const booleans = legacy ? ['extras', 'telemetry'] : ['extraSkills','telemetry','skills','homeassistant'];
  for (const key of booleans) if (!['0','1'].includes(params.get(key))) throw new Error('Invalid option.');
  if (legacy) return validateState({ ...DEFAULTS, device: params.get('device'), experience: params.get('experience'), locale: params.get('language'), method: params.get('method'), channel: params.get('channel'), extraSkills: params.get('extras') === '1', telemetry: params.get('telemetry') === '1', skills: params.get('experience') !== 'tinker' });
  const state = Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, booleans.includes(key) ? params.get(key) === '1' : params.get(key)]));
  return validateState(state);
}
/** Describe device and profile prerequisites without inferring the visitor's hardware. @param {object} state @returns {string} */
export function compatibility(state) {
  if (state.device === 'mac') return 'Apple Silicon and macOS 15 or later are required. Install Homebrew, Bash 4+ and Xcode Command Line Tools first. Allow your terminal microphone access for voice. Uses a Python environment; no GUI.';
  if (state.device === 'windows') return 'Run inside a 64-bit Ubuntu system on WSL2, with systemd=true under [boot] in /etc/wsl.conf. For voice, WSLg must provide working microphone and audio forwarding. This is not a PowerShell command.';
  if (state.device === 'other') return 'Use a supported 64-bit Linux distribution. A virtual machine needs audio and microphone access inside the guest for voice. Unlisted operating systems are not assumed compatible.';
  if (usesScreenHardware(state.device)) return `${DEVICES[state.device].short} needs 64-bit Debian 13 (Trixie) on its Raspberry Pi 4. Includes the screen interface. It does not flash your SD card.`;
  if (state.device === 'mark1') return 'Mark I needs 64-bit Debian 13. This preset uses a Python environment for its enclosure plugin. The installer detects the enclosure automatically. This installs OVOS; it does not flash an SD card.';
  if (state.device === 'jetson') return `Use supported 64-bit Linux on your Jetson Orin Nano, such as Ubuntu 22.04. This is a generic Linux preset; GPU and CUDA setup are not included.${state.experience === 'hub' ? ' Room satellites need separate installation and pairing.' : ' Connect a microphone and speaker.'} Original Jetson Nano stock images with Ubuntu 18.04 are not supported.`;
  if (state.device === 'server' || state.experience === 'hub') return 'Requires 64-bit Linux. This sets up the server only, without local voice input or playback. Room satellites need a separate install and pairing with your server.';
  if (state.device === 'pi') return 'Start with a supported 64-bit Linux OS on your Pi 3, 4 or 5, plus a microphone, speaker and internet connection. This installs OVOS; it does not flash an SD card.';
  return 'Use a supported 64-bit Linux system with a microphone, speaker and internet connection. This preset is for Linux, not a Windows or macOS terminal.';
}
