import { icon } from './icons.mjs';

/** Explain a possible password prompt without implying the browser detected one.
 * @param {string} device Device target; Windows uses its Ubuntu account.
 * @returns {string} Shared, non-live guidance for the handoff and installation.
 */
export function sudoPasswordNotice(device) {
  return `<aside class="sudo-notice" role="note">${icon('terminal')}<div><strong>Terminal may ask for your password</strong><p>${device==='windows'?'Type the password you set for Ubuntu, then press Enter.':'Type the password you use to sign in to your device, then press Enter.'}</p><p>You may not see any characters as you type. This is normal.</p></div></aside>`;
}
