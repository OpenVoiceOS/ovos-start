/** Prefer the browser's language list, falling back to its primary language when empty. @param {unknown} languages @param {unknown} primary @returns {string[]} */
export function browserLanguages(languages, primary) {
  const list=Array.isArray(languages)?languages.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()):[];
  return list.length?list:typeof primary==='string'&&primary.trim()?[primary.trim()]:[];
}

/** Explain the displayed language without presenting a default as detection. @param {string} locale @param {object} suggestion @param {boolean} confirmed @returns {string} */
export function languageSource(locale,suggestion,confirmed=false) {
  if(confirmed||locale!==suggestion.locale)return 'Your chosen language.';
  if(!suggestion.matched)return 'A starting point. Change it if you like.';
  return suggestion.exact?'Detected from your browser.':'Suggested from your browser.';
}

/** Match browser preferences to supported assistant languages without guessing location. @param {string[]} languages @param {object} supported @returns {object} */
export function suggestLanguage(languages, supported) {
  for (const raw of languages || []) {
    if (typeof raw !== 'string') continue;
    const language = raw.toLowerCase().replaceAll('_', '-');
    if (Object.hasOwn(supported, language)) return { locale: language, matched: true, exact: true };
    const match = Object.keys(supported).find(key => key.split('-')[0] === language.split('-')[0]);
    if (match) return { locale: match, matched: true, exact: false };
  }
  return { locale: 'en-us', matched: false, exact: false };
}

/** Estimate PR 648 eligibility from provisional hardware choices; the target checks actual capabilities. @param {object} state @returns {object} */
export function speechEligibility(state) {
  if (state.experience === 'hub') return { eligible: false, code: 'hub', reason: 'This headless hub does not listen or speak locally. Speech belongs on its room devices.' };
  if (['hi-in', 'kab-dz', 'pl-pl'].includes(state.locale)) return { eligible: false, code: 'language', reason: 'The preview has no local speech recommendation for this language yet.' };
  if (['mark1', 'mark2', 'devkit'].includes(state.device)) return { eligible: false, code: 'mycroft', reason: 'This Mycroft hardware is outside the preview’s local-speech requirements. Public services keep processing off the device.' };
  if (state.device === 'pi' && state.piModel !== 'pi5') return { eligible: false, code: 'pi', reason: 'Local speech requires a Pi 5, Pi 500 or Compute Module 5; older or unconfirmed Pi models use public services.' };
  if (state.device === 'mac' && state.cpu !== 'arm64') return { eligible: false, code: 'mac', reason: 'The preview supports local speech on Apple Silicon Macs, but not Intel Macs.' };
  if (state.memory !== '8plus') return { eligible: false, code: 'memory', reason: 'Local speech needs at least 7.5 GiB of usable RAM (usually an 8 GB+ device). Confirm memory before choosing it.' };
  if (['pi','jetson'].includes(state.device) && state.cpu !== 'arm64') return { eligible: false, code: 'arm', reason: 'Recheck the processor details for this board. All OVOS setups require a 64-bit operating system.' };
  if (!['arm64', 'avx2'].includes(state.cpu)) return { eligible: false, code: 'cpu', reason: 'Confirm a 64-bit ARM CPU with NEON or an Intel/AMD CPU with AVX2. The installer will check it again.' };
  return { eligible: true, code: 'eligible', reason: 'Your answers suggest on-device speech may work. The installer checks the actual hardware and may use online services instead.' };
}

/** Explain a disabled speech choice without mistaking unknown details for incompatible hardware.
 * @param {object} state Selected device details. @returns {{disabled: boolean, description: string}} Local option.
 */
export function localSpeechOption(state) {
  const {eligible,code}=speechEligibility(state);
  const descriptions={
    eligible:'Runs speech on your OVOS device. Needs more memory and downloads. Your voice may still go to an online backup.',
    hub:'This headless hub does not listen or speak locally. Speech belongs on its room devices.',
    language:'On-device speech is not supported for your language in this version.',
    mycroft:'On-device speech is not supported for this hardware in this version.',
    pi:state.piModel==='older'?'Requires a Raspberry Pi 5, Pi 500 or Compute Module 5.':'Confirm your Pi model to use on-device speech.',
    memory:state.memory==='under8'?'Requires at least 8 GB of RAM.':'Confirm your device’s memory to use on-device speech.',
    mac:state.cpu==='intel-mac'?'Requires an Apple Silicon Mac.':'Confirm your Mac’s processor to use on-device speech.',
    cpu:'Confirm a compatible processor to use on-device speech.',
    arm:'Recheck your device details to use on-device speech.',
  };
  return {disabled:!eligible,description:descriptions[code]};
}

/** Recommend meaningful defaults without enabling optional services silently. @param {object} state @returns {object} */
export function recommend(state) {
  const eligibility = speechEligibility(state);
  return { speech: eligibility.eligible ? 'local' : 'public', reason: eligibility.reason,
    skills: state.expertise !== 'expert' && state.experience !== 'tinker',
    integrations: state.experience !== 'hub',
    extras: state.experience !== 'hub' || state.method !== 'containers' };
}

/** Explain local AI independently of the smaller speech models' eligibility. @param {object} state @returns {string} */
export function localModelGuidance(state) {
  if (state.memory === 'under8' || ['mark1', 'mark2', 'devkit'].includes(state.device)) return 'For this smaller device, use a model server on another capable computer. OVOS connects to it over your network.';
  return 'Use an existing model server on this device or another computer. Speech eligibility does not guarantee enough memory or speed for your chosen AI model.';
}

/** Return the bundled flag for a supported preset region, never inferred user nationality. @param {string} locale @returns {string|null} */
export function localeFlag(locale) {
  const regions={'en-us':'us','fr-fr':'fr','de-de':'de','es-es':'es','it-it':'it','nl-nl':'nl','pt-pt':'pt','ca-es':'es','eu-es':'es','gl-es':'es','hi-in':'in','kab-dz':'dz'};
  return Object.hasOwn(regions,locale)?'./assets/flags/'+regions[locale]+'.svg':null;
}
