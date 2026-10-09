/** Local UI catalogs. Recipe values, shell commands and language names are never translated. */
export const UI_LOCALES=Object.freeze(['en-us','fr-fr','de-de','es-es','it-it','nl-nl','pt-pt','ca-es','eu-es','gl-es','hi-in','kab-dz']);
const catalogs=new Map([['en-us',{}]]),pending=new Map(),originals=new WeakMap();
const placeholders=value=>[...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort().join(',');
const escapePattern=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** Validate catalog structure and substitution tokens before it reaches the UI.
 * @param {object} catalog Bundled dictionary. @returns {object} Validated catalog.
 */
export function validateCatalog(catalog){
  if(!catalog||typeof catalog!=='object'||Array.isArray(catalog))throw new TypeError('Invalid locale catalog.');
  for(const [source,value] of Object.entries(catalog)){
    if(typeof value!=='string'||!value.trim()||placeholders(source)!==placeholders(value))throw new TypeError('Invalid locale message.');
    const tags=value.match(/<[^>]*>/g)||[];
    if(tags.some(tag=>!['<em>','</em>'].includes(tag))||tags.join('')!==(source.match(/<[^>]*>/g)||[]).join(''))throw new TypeError('Invalid locale markup.');
  }
  return catalog;
}

/** Load only the chosen bundled language; retain it for Back and edit cancellation.
 * @param {string} locale Selected recipe locale. @returns {Promise<void>}
 */
export async function loadLocale(locale){
  if(!UI_LOCALES.includes(locale)||catalogs.has(locale))return;
  if(!pending.has(locale))pending.set(locale,fetch(`./locales/${locale}.json?v=0.55.1`).then(response=>{
    if(!response.ok)throw new Error('Language unavailable.');return response.json();
  }).then(value=>{catalogs.set(locale,validateCatalog(value));}).finally(()=>pending.delete(locale)));
  await pending.get(locale);
}

/** Translate an entire message or sentence sequence, with safe named substitutions.
 * @param {string} message English source. @param {object} catalog Dictionary.
 * @param {object} values Named values. @returns {string} Plain translated text.
 */
export function translateMessage(message,catalog={},values={}){
  const substitute=text=>text.replace(/\{(\w+)\}/g,(token,key)=>Object.hasOwn(values,key)?String(values[key]):token);
  const exact=source=>{
    if(Object.hasOwn(catalog,source))return substitute(catalog[source]);
    // Prefer a complete instruction over a broader template such as "on {device}."
    const specificity=key=>key.replace(/\{\w+\}/g,'').length;
    for(const key of Object.keys(catalog).filter(key=>key.includes('{')).sort((a,b)=>specificity(b)-specificity(a))){
      const names=[];let at=0,pattern='';
      for(const match of key.matchAll(/\{(\w+)\}/g)){pattern+=escapePattern(key.slice(at,match.index))+'(.+?)';names.push(match[1]);at=match.index+match[0].length;}
      const matched=source.match(new RegExp('^'+pattern+escapePattern(key.slice(at))+'$'));
      if(matched)return catalog[key].replace(/\{(\w+)\}/g,(token,name)=>{
        const value=matched[names.indexOf(name)+1];return name==='command'?value:translateMessage(value,catalog);
      });
    }
    return null;
  };
  const text=String(message),trimmed=text.trim();
  // Exact multi-sentence messages are allowed; a placeholder must not swallow
  // following sentences (for example a device name followed by SSH guidance).
  if(Object.hasOwn(catalog,trimmed))return text.replace(trimmed,substitute(catalog[trimmed]));
  return text.split(/((?<=[.!?])\s+)/).map(part=>{
    const clean=part.trim();if(!clean)return part;
    const translated=exact(clean);return translated===null?substitute(part):part.replace(clean,translated);
  }).join('');
}

/** Translate a message using a previously loaded locale. @param {string} message @param {string} locale @param {object} values @returns {string} */
export function t(message,locale,values={}){return translateMessage(message,catalogs.get(locale)||{},values);}

/** Report the actual UI language if its resource could not be loaded. @param {string} locale @returns {string} */
export function uiLocale(locale){return catalogs.has(locale)?locale:'en-us';}

/** Retain English source on persistent nodes while recognizing new dynamic content.
 * @param {object} node DOM node. @param {string} field Property key.
 * @param {string} value Current content. @param {Function} translate Translator.
 * @returns {string} Translated content.
 */
function retained(node,field,value,translate){
  const fields=originals.get(node)||new Map(),previous=fields.get(field);
  const source=previous&&value===previous.last?previous.source:value;
  const last=translate(source);fields.set(field,{source,last});originals.set(node,fields);return last;
}

/** Translate visible text and accessible labels without touching controls or executable data.
 * @param {Element} root DOM subtree. @param {string} locale Loaded locale. @returns {void}
 */
export function applyTranslations(root,locale){
  const translate=value=>t(value,locale);
  const walk=node=>{
    if(node.nodeType===3){node.textContent=retained(node,'text',node.textContent,translate);return;}
    if(node.nodeType!==1||node.matches('script,style,svg,code,pre,audio'))return;
    if(node.matches('option')&&!node.hasAttribute('data-translate-option'))return;
    for(const name of ['aria-label','title','placeholder'])if(node.hasAttribute(name))node.setAttribute(name,retained(node,name,node.getAttribute(name),translate));
    // Keep shell text and control values byte-for-byte while translating their labels.
    if(node.matches('textarea,input,[data-no-translate]'))return;
    if(node.matches('h1')&&!node.querySelector(':scope > :not(em)')){
      const markup=retained(node,'heading',node.innerHTML,translate);
      // The only supported heading markup is emphasis. All other characters are text.
      node.innerHTML=markup.split(/(<\/?em>)/g).map(part=>/^<\/?em>$/.test(part)?part:part.replace(/&(?!(?:amp|lt|gt|quot|#39);)|[<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]))).join('');
      return;
    }
    [...node.childNodes].forEach(walk);
  };
  walk(root);
}
