/** Accept only a bounded, direct link from the installer's paste service.
 * @param {unknown} value Untrusted report URL. @returns {string|null}
 */
export function errorReportUrl(value) {
  return typeof value==='string'&&value===value.trim()&&/^https:\/\/paste\.uoi\.io\/[A-Za-z0-9_-]{1,128}\/?$/.test(value)?value:null;
}
