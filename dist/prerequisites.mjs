import {icon} from './icons.mjs';
import {preparationFor} from './preparation.mjs';
import {DISTRIBUTIONS,distributionsFor,fixedSystemFor} from './distributions.mjs';

/** Package commands run by the user on the target, never by the browser. */
export const PACKAGE_SYSTEMS=Object.freeze({
  debian:{label:'Debian / Ubuntu / Linux Mint / Raspberry Pi OS',command:'sudo apt update && sudo apt install curl git sudo bash'},
  fedora:{label:'Fedora / Rocky / AlmaLinux / CentOS',command:'sudo dnf install curl git sudo bash'},
  arch:{label:'Arch / Manjaro / EndeavourOS / CachyOS',command:'sudo pacman -Syu --needed curl git sudo bash'},
  suse:{label:'openSUSE',command:'sudo zypper refresh && sudo zypper install curl git sudo bash'},
});
export const DNF_CURL_CONFLICT_COMMAND='sudo dnf install git sudo bash';
const SYSTEMS_GUIDE='https://github.com/OpenVoiceOS/ovos-installer/blob/main/docs/supported-systems.md';

/** Render selectable shell text with its own accessible clipboard action.
 * @param {string} id Stable, trusted field ID. @param {string} command Literal shell text.
 * @param {boolean} preview Disable preparation copying in previews. @returns {string} Code block.
 */
export function commandBlock(id,command,preview=false){
  const text=command.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return `<div class="command-block" data-command-block><pre><code id="${id}" class="language-shell" tabindex="0" data-no-translate>${text}</code></pre><button type="button" class="command-copy" data-copy-prerequisites aria-label="Copy command" title="Copy command" aria-describedby="${id}" ${preview&&command!=='cat /etc/os-release'?'disabled':''}>${icon('copy')}<span>Copy</span></button><span class="sr-only" role="status" aria-live="polite" data-command-status></span></div>`;
}

/** In-memory, two-action acknowledgement; links and drafts cannot assert readiness. */
export class PrerequisiteGate {
  /** Start with no target, OS selection, acknowledgement or accepted handoff. */
  constructor(){this.device=null;this.cpu='unknown';this.family='';this.confirmed=false;this.accepted=false;}
  /** Reset when the target or known Mac processor changes. @param {string} device Target ID. @param {string} [cpu] Selected processor. @returns {void} */
  selectDevice(device,cpu){
    const nextCpu=cpu??(this.device===device?this.cpu:'unknown');
    if(device==='mac'&&this.cpu!==nextCpu){this.cpu=nextCpu;this.confirm(false);}
    if(this.device===device){
      const fixed=fixedSystemFor(device);
      if(fixed&&this.family!==fixed){this.family=fixed;this.confirm(false);}
      return;
    }
    this.device=device;this.cpu=nextCpu;this.family=device==='mac'?'mac':fixedSystemFor(device);this.confirm(false);
  }
  /** Changing instructions invalidates both actions. @param {string} family OS family. @returns {void} */
  selectFamily(family){
    const value=this.device==='mac'?'mac':Object.hasOwn(distributionsFor(this.device),family)||(family==='unknown'&&!fixedSystemFor(this.device))?family:'';
    if(value!==this.family){this.family=value;this.confirm(false);}
  }
  /** Enforce installer-specific hardware requirements without assuming the OS. @returns {boolean} */
  supported(){
    if(!this.device)return false;
    if(this.device==='mac')return this.family==='mac'&&['arm64','unknown'].includes(this.cpu);
    return Object.hasOwn(distributionsFor(this.device),this.family);
  }
  /** Resolve the selected system's package command only when supported. @returns {string} */
  command(){return this.supported()?(PACKAGE_SYSTEMS[distributionsFor(this.device)[this.family]?.family]?.command||''):'';}
  /** Checking a box alone never exposes installation. @param {boolean} checked User acknowledgement. @returns {void} */
  confirm(checked){this.confirmed=checked===true&&this.supported();this.accepted=false;}
  /** Whether the separate Continue action can be used. @param {string} device Target ID. @returns {boolean} */
  canContinue(device){return this.confirmed&&this.supported()&&this.device===device;}
  /** Accept only a deliberate, valid handoff. @param {string} device Target ID. @returns {boolean} */
  accept(device){this.accepted=this.canContinue(device);return this.accepted;}
  /** Never reuse acknowledgement for a different device. @param {string} device Target ID. @returns {boolean} */
  ready(device){return this.accepted&&this.canContinue(device);}
}

/** Render one local, decorative brand mark; unknown systems get a neutral help icon.
 * @param {object|undefined} item Allowlisted option. @returns {string} Decorative icon.
 */
function distributionLogo(item){
  return `<span class="distribution-logo" aria-hidden="true">${item?`<img src="./assets/distributions/${item.logo}.${item.format||'svg'}" alt="" width="28" height="28">`:icon('help')}</span>`;
}

/** Keep distribution names literal while localizing release descriptions.
 * @param {object} item Distribution entry. @returns {string} Name and supported version.
 */
function distributionLabel(item) {
  return `<span class="distro-label"><span ${item.version!==undefined?'data-no-translate':''}>${item.label}</span>${item.version?`<small ${item.version==='Rolling release'?'':'data-no-translate'}>${item.version}</small>`:''}</span>`;
}

/** Select-only combobox with real distro names, keyboard navigation and local logos.
 * @param {object} state Recipe. @param {PrerequisiteGate} gate Acknowledgement state.
 * @returns {string} Dropdown markup.
 */
function distributionPicker(state,gate){
  const systems=distributionsFor(state.device),selected=systems[gate.family];
  const fixed=fixedSystemFor(state.device);
  if(fixed)return `<div class="distro-fixed">${distributionLogo(systems[fixed])}${distributionLabel(systems[fixed])}</div>`;
  const choices={...systems,unknown:{label:'Other / I’m not sure'}};
  return `<div class="prerequisite-system"><span id="prerequisite-system-label">Choose the system installed on your OVOS device.</span><div class="distro-picker" data-distro-picker>
    <button type="button" id="prerequisite-system" class="distro-trigger" data-prerequisite-system data-value="${selected||gate.family==='unknown'?gate.family:''}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="distro-options" aria-labelledby="prerequisite-system-label">${distributionLogo(selected)}${distributionLabel(selected||{label:gate.family==='unknown'?'Other / I’m not sure':'Choose your Linux system'})}${icon('expand_more')}</button>
    <div id="distro-options" class="distro-options" role="listbox" aria-labelledby="prerequisite-system-label" hidden>${Object.entries(choices).map(([id,item])=>`<div id="distro-option-${id}" class="distro-option" role="option" data-distro-option data-value="${id}" aria-selected="${id===gate.family}">${distributionLogo(id==='unknown'?undefined:item)}${distributionLabel(item)}<span class="distro-check" aria-hidden="true">${icon('check')}</span></div>`).join('')}</div>
  </div></div>`;
}

/** Dedicated required preparation screen. @param {object} state Recipe. @param {PrerequisiteGate} gate Local acknowledgement. @param {boolean} preview Disable executable copying. @returns {string} */
export function prerequisitesView(state,gate,preview=false){
  gate.selectDevice(state.device,state.cpu);
  const mac=state.device==='mac',fixed=fixedSystemFor(state.device),restricted=['mark1','mark2','devkit'].includes(state.device),wsl=state.device==='windows',command=gate.command();
  return `<section class="prerequisite-panel" aria-labelledby="prerequisite-title"><h2 id="prerequisite-title">${mac?'Required tools':'Linux system'}</h2>
    ${mac?`<p class="preparation-requirement">${gate.supported()?'Apple Silicon and macOS 15 or later are required.':'This Mac is not supported. Choose an Apple Silicon Mac with macOS 15 or later.'}</p>${gate.supported()?`<p>Open Terminal without Rosetta.</p><p>On your Mac, install Xcode Command Line Tools, Homebrew and Bash 4 or newer first.</p><ol class="mac-prerequisites"><li>${commandBlock('xcode-command','xcode-select --install',preview)}</li><li><a href="https://brew.sh/" target="_blank" rel="noopener noreferrer">Homebrew</a><p>Finish Homebrew’s “Next steps” in Terminal, then install Bash.</p></li><li>${commandBlock('brew-command','brew install bash',preview)}</li></ol>`:''}<a class="text-button" href="${preparationFor(state).url}" target="_blank" rel="noopener noreferrer">Open the Mac preparation guide</a>`:`${fixed?'':'<p class="system-matrix-note">Use a supported 64-bit system. Versions are shown below.</p>'}${distributionPicker(state,gate)}${fixed?`<a class="fixed-system-help" href="${preparationFor(state).url}" target="_blank" rel="noopener noreferrer">I need help getting it ready</a>`:''}
    ${!gate.supported()?`<div class="prerequisite-system-help">${restricted?'<p>This device requires Debian 13. Install the supported image before continuing.</p>':wsl?'<p>This Windows setup uses Ubuntu in WSL2. Prepare Ubuntu before continuing.</p>':''}${gate.family==='unknown'?`<p>Not sure? Check the system name on your OVOS device:</p>${commandBlock('system-command','cat /etc/os-release',preview)}<a class="text-button" href="${restricted||wsl?preparationFor(state).url:SYSTEMS_GUIDE}" target="_blank" rel="noopener noreferrer">${restricted||wsl?'I need help getting it ready':'Check supported systems'}${icon('arrow')}</a>`:''}</div>`:''}
    ${command?`<div class="prerequisite-command"><p>${wsl?'On Windows, run this in Ubuntu (WSL2), not PowerShell.':'Run this on your OVOS device, then wait for it to finish.'}</p>${commandBlock('prerequisite-command',command,preview)}${DISTRIBUTIONS[gate.family]?.family==='arch'?'<p class="details-note">This also updates your Arch system.</p>':''}${DISTRIBUTIONS[gate.family]?.family==='fedora'?`<details class="prerequisite-help"><summary>Need help?</summary><h3>A curl-minimal conflict?</h3><p>If DNF reports that curl-minimal is already installed and conflicts with curl, keep it and run this instead:</p>${commandBlock('dnf-conflict-command',DNF_CURL_CONFLICT_COMMAND,preview)}<a href="https://matrix.to/#/#openvoiceos:matrix.org" target="_blank" rel="noopener noreferrer">Command didn’t work? Get help</a></details>`:'<a class="prerequisite-help-link" href="https://matrix.to/#/#openvoiceos:matrix.org" target="_blank" rel="noopener noreferrer">Need help?</a>'}</div>`:''}`}
    ${!mac&&!gate.supported()&&gate.family!=='unknown'?`<a class="matrix-guide" href="${SYSTEMS_GUIDE}" target="_blank" rel="noopener noreferrer">Your version isn’t listed? Check supported systems.</a>`:''}
    <div class="prerequisite-ack"><label class="prerequisite-confirm"><span class="prerequisite-checkbox"><input type="checkbox" data-prerequisite-confirm ${gate.confirmed?'checked':''} ${!gate.supported()?'disabled':''}><span class="prerequisite-check" aria-hidden="true">${icon('check')}</span></span><span>${mac?'My Mac uses Apple Silicon and macOS 15 or later; the required tools are installed.':'The required tools are installed.'}</span></label></div>
    <button type="button" class="button prerequisite-continue" data-prerequisite-continue ${gate.canContinue(state.device)?'':'disabled'}><span>Show install command</span>${icon('arrow')}</button>
  </section>`;
}
