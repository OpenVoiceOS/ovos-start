/** Validate connection data without contacting the user's private network.
 * @param {object} value Home Assistant address and long-lived token.
 * @returns {{url:string,token:string}} Normalized, secret connection data.
 */
export function normalizeHomeAssistant(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='token,url')throw new TypeError('connection');
  if(typeof value.url!=='string'||value.url.length>2048||/[\x00-\x20\x7f\\]/.test(value.url)||!/^https?:\/\//i.test(value.url))throw new TypeError('url');
  let url;try{url=new URL(value.url);}catch{throw new TypeError('url');}
  if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password||url.search||url.hash||/[?#]/.test(value.url))throw new TypeError('url');
  if(url.href.length>2048)throw new TypeError('url');
  if(typeof value.token!=='string'||!/^[A-Za-z0-9._~-]{20,2048}$/.test(value.token))throw new TypeError('token');
  return {url:url.href.replace(/\/$/,''),token:value.token};
}

/** Hold unfinished secrets only in memory, separately from saved wizard choices. */
export class HomeAssistantDraft {
  /** @returns {void} */
  constructor(){this.clear();}
  /** Forget secret input and invalidate in-flight work. @returns {void} */
  clear(){this.url='';this.token='';this.editing=false;this.error='';this.saving=false;this.version=(this.version||0)+1;}
  /** Start an edit without redisplaying a saved token. @returns {void} */
  edit(){this.editing=true;this.token='';this.error='';this.version++;}
  /** Retain literal typed data only in this page's memory.
   * @param {string} field Input name. @param {string} value Input value. @returns {void}
   */
  input(field,value){if(!['url','token'].includes(field)||this.saving)return;this[field]=value;this.editing=true;this.error='';this.version++;}
  /** Collapse saved input; retain memory only until page exit or device claim. @returns {void} */
  saved(){this.editing=false;this.error='';}
  /** Validate without emitting any input in error messages. @returns {object} */
  value(){return normalizeHomeAssistant({url:this.url.trim(),token:this.token.trim()});}
}
