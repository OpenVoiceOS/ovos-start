import { encodeRecipeCode, decodeRecipeCode, decodeRecipeEnvelope, RECIPE_TTL_SECONDS, MAX_RECIPE_TIMESTAMP } from './recipe-code.mjs';
import { validateState, decodePreset } from './scenario.mjs';

/** Public launcher validates the code's one-hour start deadline on the target. */
export const LAUNCHER_URL = 'https://raw.githubusercontent.com/goldyfruit/ovos-start-launcher/aa528a5e0ce50ccc43c26e1964067a0e0464f272/v2.sh';
export const INSTALL_LINK_ORIGIN = 'https://ovos-install-status.goldyfruit.chatgpt.site';

/** Issue one immutable command artifact shared by display, copy, links and downloads.
 * @param {object} state Recipe choices. @param {number} now Unix seconds.
 * @returns {object} Timestamped, non-secret setup artifact.
 */
export function issueSetup(state, now = Math.floor(Date.now()/1000)) {
  const choices=validateState(state);
  const code=encodeRecipeCode(choices,{issuedAt:now});
  return Object.freeze({code,version:2,issuedAt:now,expiresAt:now+RECIPE_TTL_SECONDS,state:Object.freeze({...choices})});
}

/** Compare confirmed choices without issuing a new command or moving its deadline.
 * @param {object|null} setup Issued artifact. @param {object} state Recipe choices.
 * @returns {boolean} Whether every validated choice is unchanged.
 */
export function sameSetupChoices(setup,state) {
  if(!setup)return false;
  const choices=validateState(state);
  return Object.keys(choices).every(key=>setup.state[key]===choices[key]);
}

/** Derive expiry without altering the issued code. @param {object|null} setup
 * @param {number} now Unix seconds. @returns {{kind:string,message:string}} Status.
 */
export function setupStatus(setup,now=Math.floor(Date.now()/1000)) {
  if(!Number.isSafeInteger(now)||now<=0||now>MAX_RECIPE_TIMESTAMP)return {kind:'clock',message:'Check your clock, then try again.'};
  if(!setup||setup.issuedAt===null)return {kind:'legacy',message:'Copy a new command to continue. Your choices are saved.'};
  if(now<setup.issuedAt)return {kind:'clock',message:'Check your clock, then reopen this setup.'};
  if(now>=setup.expiresAt)return {kind:'expired',message:'This command expired. Your choices are saved.'};
  return {kind:'active',message:`Expires in ${Math.ceil((setup.expiresAt-now)/60)} min.`};
}

/** Validate an executable artifact and its required launch capability.
 * @param {object} setup Issued artifact. @param {number} now Unix seconds.
 * @param {string} launchToken Bound relay capability. @returns {void}
 */
function validateLaunch(setup,now,launchToken) {
  if(!setup?.code)throw new RangeError('Copy a new command from OVOS Start.');
  validateState(decodeRecipeCode(setup.code,{now}));
  if(typeof launchToken!=='string'||launchToken.length!==22||!/^[A-Za-z0-9_-]{22}$/.test(launchToken))throw new TypeError('Could not prepare your install command. Please try again.');
}

/** Build the one supported command from a valid recipe and relay capability.
 * @param {object} setup Issued artifact. @param {number} now Unix seconds.
 * @param {string} launchToken Bound relay capability. @returns {string} Short command.
 */
export function buildShortCommand(setup,now=Math.floor(Date.now()/1000),launchToken) {
  validateLaunch(setup,now,launchToken);
  return `curl -qfsS -m120 ${INSTALL_LINK_ORIGIN}/s/${launchToken} | sh`;
}

/** Download completely, then run; private bootstrap files are removed on exit.
 * @param {object} setup Issued artifact. @param {number} now Unix seconds.
 * @param {string} launchToken Bound relay capability. @returns {string} POSIX script.
 */
export function buildSetupScript(setup,now=Math.floor(Date.now()/1000),launchToken) {
  validateLaunch(setup,now,launchToken);
  return `#!/bin/sh
set -eu
set +x
umask 077
ovos_tmp=$(mktemp -d "\${TMPDIR:-/tmp}/ovos-start.XXXXXX")
trap 'rm -rf -- "$ovos_tmp"' 0
trap 'exit 130' INT
trap 'exit 143' TERM
if ! curl -qfsS --proto '=https' --connect-timeout 15 -m 120 '${INSTALL_LINK_ORIGIN}/s/${launchToken}' -o "$ovos_tmp/start.sh"; then
  printf '%s\\n' 'Could not get the installer. Check your connection or return to the wizard and copy a new command.' >&2
  exit 1
fi
if [ ! -s "$ovos_tmp/start.sh" ] || ! sh -n "$ovos_tmp/start.sh" 2>/dev/null; then
  printf '%s\\n' 'The installer download was incomplete. Return to the wizard and copy a new command.' >&2
  exit 1
fi
sh "$ovos_tmp/start.sh"
`;
}

/** Recover saved choices and their original deadline, including expired/legacy links.
 * @param {string} fragment URL hash. @param {number} now Unix seconds.
 * @returns {object|null} Artifact; legacy links need explicit new issuance.
 */
export function readSetupSession(fragment,now=Math.floor(Date.now()/1000)) {
  const raw=fragment.replace(/^#/,'');
  if(raw.startsWith('setup=')){
    const code=raw.slice(6).toUpperCase();
    const decoded=decodeRecipeEnvelope(code,{now,allowLegacy:true,allowExpired:true});
    return Object.freeze({...decoded,code,state:Object.freeze(validateState(decoded.state))});
  }
  const state=decodePreset(fragment);
  return state?Object.freeze({state:Object.freeze(validateState(state)),code:null,version:0,issuedAt:null,expiresAt:null}):null;
}
