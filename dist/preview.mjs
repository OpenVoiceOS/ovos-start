export const LIVE_WIZARD_ORIGIN='https://ovos-start-wizard.goldyfruit.chatgpt.site';

/** Local and explicitly simulated pages must never offer executable installs.
 * @param {{hostname:string,protocol:string}} location Browser location.
 * @param {string|null} mode Optional preview metadata. @returns {boolean}
 */
export function isPreviewContext(location,mode=null) {
  const host=String(location.hostname||'').toLowerCase();
  return mode==='simulated'||location.protocol==='file:'||host==='localhost'||host.endsWith('.localhost')||host==='[::1]'||host==='::1'||/^127(?:\.\d{1,3}){3}$/.test(host);
}

/** Carry choices to the live site without carrying a simulation capability.
 * @param {object|null} setup Issued recipe. @returns {string} Live wizard link.
 */
export function liveWizardUrl(setup) {
  return LIVE_WIZARD_ORIGIN+'/'+(setup?.code?'#setup='+encodeURIComponent(setup.code):'');
}
