import { DEVICES, LANGUAGES } from './scenario.mjs';

/** Brief, target-specific installation instructions. No browser hardware inference.
 * @param {object} state Validated recipe. @returns {object} Handoff copy.
 */
export function installHandoff(state) {
  const requirements = {
    pi: 'Needs 64-bit Linux already installed on your Pi.',
    computer: 'Needs a supported 64-bit Linux installation.',
    other: 'Needs a supported 64-bit Linux installation.',
    server: 'Needs a supported 64-bit Linux installation.',
    mark1: 'Needs 64-bit Debian 13 already installed.',
    mark2: 'Needs 64-bit Debian 13 on its Raspberry Pi 4.',
    devkit: 'Needs 64-bit Debian 13 on its Raspberry Pi 4.',
    jetson: 'Needs supported 64-bit Linux, such as Ubuntu 22.04.',
    mac: 'Apple Silicon and macOS 15 or later are required. Install Homebrew, Bash 4+ and Xcode Command Line Tools first.',
    windows: 'Needs 64-bit Ubuntu in WSL2 with systemd enabled.',
  };
  const hub=state.experience==='hub';
  return {
    requirement:requirements[state.device],
    terminal:state.device==='windows'?'Ubuntu terminal in WSL2':'Terminal',
    speech:hub?'Room devices are installed and paired separately.':state.speech==='local'?'On-device speech has an online backup that may receive your voice.':state.speech==='public'?'Online speech sends your voice and reply text to online services.':'Speech providers may use online services.',
    preview:state.device==='mac'||(!hub&&state.speech!=='auto'),
    audio:hub?'':state.device==='windows'?'Voice needs working microphone and speaker forwarding through WSLg.':'',
    integrations:!hub&&(state.homeassistant||state.llmMode!=='off')?'The terminal will ask for your server details and keys.':'',
  };
}

/** Compact, editable choices; omit voice-only settings on a headless hub.
 * @param {object} state Validated recipe. @returns {object[]} Labelled edit targets.
 */
export function reviewChoices(state) {
  const hub=state.experience==='hub';
  return [
    {target:'device',label:'Device',value:DEVICES[state.device].name,icon:'chip'},
    {target:'language',label:'Language',value:LANGUAGES[state.locale],icon:'globe'},
    ...hub?[]:[{target:'speech',label:'Speech',value:state.speech==='local'?'On device + online backup':state.speech==='public'?'Online services':'Installer chooses',icon:state.speech==='local'?'chip':'cloud'}],
    {target:'skills',label:'Skills',value:!state.skills?'A blank canvas':state.extraSkills?'Everyday + extras':'Everyday essentials',icon:'widgets'},
    ...hub?[]:[
      {target:'homeassistant',label:'Home Assistant',value:state.homeassistant?'Connect my server':'Not connected',icon:'home_assistant'},
      {target:'llm',label:'AI',value:state.llmMode==='off'?'Off':state.llmMode==='local'?'My model server':'Online provider',icon:'spark'},
    ],
    {target:'purpose',label:'Use',value:{ready:'Everyday assistant',tinker:'Custom assistant',hub:'Voice hub'}[state.experience],icon:hub?'server':'voice'},
    {target:'guidance',label:'Setup style',value:{guided:'Guided',tinker:'Tinker',expert:'Advanced'}[state.expertise],icon:'settings'},
  ];
}

/** Summarize the actual recipe in a fixed order, omitting disabled integrations.
 * @param {object} state Validated recipe. @returns {object[]} Labelled icon targets.
 */
export function setupSummary(state) {
  const hub=state.experience==='hub',choices=reviewChoices(state);
  const targets=['device',...(hub?['purpose']:[]),...(state.skills?['skills']:[]),
    ...hub?[]:['speech',...(state.homeassistant?['homeassistant']:[]),...(state.llmMode!=='off'?['llm']:[])]];
  return targets.map(target=>{
    const choice=choices.find(item=>item.target===target);
    return {...choice,icon:target==='speech'?{public:'globe',local:'chip',auto:'voice'}[state.speech]:choice.icon};
  });
}

/** Reveal the actual fallback field, including every enclosing disclosure.
 * @param {HTMLElement|null} target Readonly command or setup-link field.
 * @returns {boolean} Whether the connected field was revealed and selected.
 */
export function revealCopyFallback(target) {
  if(!target?.isConnected)return false;
  for(let node=target.parentElement;node;node=node.parentElement){
    if(node.tagName==='DETAILS')node.open=true;
    if(node.classList?.contains('link-fallback'))node.hidden=false;
  }
  target.focus();
  if(typeof target.select==='function')target.select();
  else{
    const selection=target.ownerDocument?.getSelection();
    if(!selection)return false;
    const range=target.ownerDocument.createRange();range.selectNodeContents(target);
    selection.removeAllRanges();selection.addRange(range);
  }
  target.scrollIntoView({block:'center',behavior:'instant'});
  return true;
}

/** Advance the handoff only after clipboard success; expiry returns to copying.
 * @param {Element} root Wizard surface. @param {boolean} copied Current command copied. @param {boolean} ready Required tools acknowledged.
 * @returns {void}
 */
export function updateHandoffStep(root,copied,ready=true) {
  const steps=root.querySelectorAll('[data-handoff-step]');
  for(const step of steps){
    const current=ready&&step.dataset.handoffStep===(copied?'paste':'copy');
    if(current)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');
    step.classList.toggle('is-done',copied&&step.dataset.handoffStep==='copy');
  }
}
