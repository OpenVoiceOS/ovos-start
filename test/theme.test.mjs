import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../dist/theme.js',import.meta.url),'utf8');
const key='ovos.theme.v1';
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');

/** Calculate WCAG relative luminance for a six-digit opaque color.
 * @param {string} hex Hex color. @returns {number} Relative luminance.
 */
function luminance(hex){
  const rgb=hex.slice(1).match(/../g).map(channel=>parseInt(channel,16)/255)
    .map(channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}

test('subtle light colors retain readable body, accent and confirmation text',()=>{
  const blocks=[...css.matchAll(/:root\s*\{([^}]+)\}/g),...css.matchAll(/:root\[data-theme="light"\]\s*\{([^}]+)\}/g)];
  const tokens=Object.fromEntries(blocks.flatMap(block=>[...block[1].matchAll(/(--[\w-]+):\s*(#[\da-f]{6})(?=;|$)/gi)].map(match=>[match[1],match[2]])));
  const pairs=[...['--paper','--card','--soft'].flatMap(bg=>['--ink','--muted','--accent'].map(fg=>[fg,bg])),['--card','--accent'],['--success-ink','--success-soft'],['--install-done','--card'],['--back-ink','--back-bg']];
  for(const [fg,bg] of pairs){
    assert.ok(tokens[fg]&&tokens[bg],`Missing palette tokens ${fg}/${bg}`);
    const values=[luminance(tokens[fg]),luminance(tokens[bg])].sort((a,b)=>b-a);
    assert.ok((values[0]+0.05)/(values[1]+0.05)>=4.5,`${fg} on ${bg} must reach 4.5:1`);
  }
  const base=browser();assert.equal(base.meta.content,tokens['--paper']);
});

test('requirement highlights have readable text and a distinct icon in each appearance',()=>{
  const base=[...css.matchAll(/:root\s*\{([^}]+)\}/g)];
  const automatic=[...css.matchAll(/:root:not\(\[data-theme\]\)\s*\{([^}]+)\}/g)];
  for(const theme of ['light','dark','automatic-dark']){
    const overrides=theme==='automatic-dark'?automatic:[...css.matchAll(new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`,'g'))];
    const tokens=Object.fromEntries([...base,...overrides].flatMap(block=>[...block[1].matchAll(/(--[\w-]+):\s*(#[\da-f]{6})(?=;|$)/gi)].map(match=>[match[1],match[2]])));
    assert.notEqual(tokens['--requirement-bg'],tokens['--card']);
    for(const [foreground,minimum] of [['--requirement-ink',4.5],['--requirement-accent',3]]){
      assert.ok(tokens[foreground]&&tokens['--requirement-bg'],`${theme}: missing requirement colors`);
      const values=[luminance(tokens[foreground]),luminance(tokens['--requirement-bg'])].sort((a,b)=>b-a);
      assert.ok((values[0]+0.05)/(values[1]+0.05)>=minimum,`${theme}: ${foreground} must reach ${minimum}:1`);
    }
  }
});

test('copy confirmation keeps readable neutral text and a contrasting check in both themes',()=>{
  const base=[...css.matchAll(/:root\s*\{([^}]+)\}/g)];
  for(const theme of ['light','dark']){
    const blocks=[...base,...css.matchAll(new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`,'g'))];
    const tokens=Object.fromEntries(blocks.flatMap(block=>[...block[1].matchAll(/(--[\w-]+):\s*(#[\da-f]{6})(?=;|$)/gi)].map(match=>[match[1],match[2]])));
    for(const foreground of ['--ink','--install-done','--ack-pending'])for(const surface of ['--paper','--soft']){
      const values=[luminance(tokens[foreground]),luminance(tokens[surface])].sort((a,b)=>b-a);
      assert.ok((values[0]+0.05)/(values[1]+0.05)>=4.5,`${theme}: ${foreground} on ${surface}`);
    }
  }
  assert.doesNotMatch(css,/\.prerequisite-panel\s+\.copied\s*\{/,'legacy success styling must not recolor the whole button');
  assert.match(css,/\.command-copy\.copied\s+\.ui-icon\s*\{color:var\(--install-done\)/);
});

/** Execute the real early theme script with browser boundaries mocked.
 * @param {object} options Stored preference, system appearance and storage failures.
 * @returns {object} Observable DOM and event controls.
 */
function browser({saved=null,dark=false,blockedRead=false,blockedWrite=false}={}){
  const values=new Map([['unrelated','preserved']]);if(saved!==null)values.set(key,saved);
  const events=new Map(),domEvents=new Map(),clicks=new Map(),attrs=new Map(),announcements=[];
  const root={dataset:{}},meta={content:''};
  const button={hidden:true,setAttribute:(name,value)=>attrs.set(name,value),addEventListener:(name,fn)=>clicks.set(name,fn)};
  const storage={getItem:name=>values.get(name)??null,setItem(name,value){if(blockedWrite)throw Error('Blocked');values.set(name,value);}};
  const system={matches:dark,addEventListener(name,fn){this.listener=fn;}};
  const window={matchMedia:()=>system,addEventListener:(name,fn)=>events.set(name,fn),dispatchEvent(event){announcements.push({type:event.type,label:attrs.get('aria-label')});}};
  Object.defineProperty(window,'localStorage',{get(){if(blockedRead)throw Error('Blocked');return storage;}});
  const document={readyState:'loading',documentElement:root,querySelector:selector=>selector.startsWith('meta')?meta:button,addEventListener:(name,fn)=>domEvents.set(name,fn)};
  vm.runInNewContext(source,{window,document,Event});
  return {root,meta,button,attrs,values,announcements,storage,
    mount:()=>domEvents.get('DOMContentLoaded')(),click:()=>clicks.get('click')(),
    systemChange(value){system.matches=value;system.listener();},
    storageChange(name,newValue,storageArea=storage){events.get('storage')({key:name,newValue,storageArea});}};
}

test('system appearance is applied before the header mounts and remains live without a preference',()=>{
  const b=browser({dark:true});assert.equal(b.root.dataset.theme,'dark');assert.equal(b.meta.content,'#10151c');
  assert.equal(b.button.hidden,true);b.mount();assert.equal(b.button.hidden,false);
  assert.equal(b.attrs.get('aria-label'),'Switch to light mode');
  b.systemChange(false);assert.equal(b.root.dataset.theme,'light');assert.equal(b.meta.content,'#f5f4f0');
  assert.equal(b.attrs.get('title'),'Switch to dark mode');assert.equal(b.values.has(key),false);
});

test('a saved preference overrides the system and survives a reload',()=>{
  const b=browser({saved:'light',dark:true});b.mount();b.systemChange(true);assert.equal(b.root.dataset.theme,'light');
  b.click();assert.equal(b.values.get(key),'dark');assert.equal(b.values.get('unrelated'),'preserved');
  const reloaded=browser({saved:b.values.get(key),dark:false});assert.equal(reloaded.root.dataset.theme,'dark');
  b.click();assert.equal(b.values.get(key),'light');assert.equal(b.attrs.get('aria-label'),'Switch to dark mode');
  assert.equal(b.announcements.at(-1).label,'Switch to dark mode');
});

test('invalid stored values use the system instead of becoming theme selectors',()=>{
  const b=browser({saved:'unexpected',dark:true});b.mount();assert.equal(b.root.dataset.theme,'dark');
  b.systemChange(false);assert.equal(b.root.dataset.theme,'light');
});

test('blocked storage access still allows immediate appearance changes',()=>{
  const b=browser({blockedRead:true,dark:false});b.mount();b.click();assert.equal(b.root.dataset.theme,'dark');
  b.systemChange(false);assert.equal(b.root.dataset.theme,'dark');
  b.click();assert.equal(b.root.dataset.theme,'light');
});

test('a failed save keeps the in-memory choice and accurate next-action label',()=>{
  const b=browser({blockedWrite:true,dark:true});b.mount();b.click();b.systemChange(true);
  assert.equal(b.root.dataset.theme,'light');assert.equal(b.attrs.get('aria-label'),'Switch to dark mode');
  assert.equal(b.values.has(key),false);
});

test('cross-tab updates synchronize appearance; clearing the preference resumes system tracking',()=>{
  const b=browser({saved:'light',dark:true});b.mount();
  b.storageChange('unrelated','dark');assert.equal(b.root.dataset.theme,'light');
  b.storageChange(key,'dark',{});assert.equal(b.root.dataset.theme,'light');
  b.storageChange(key,'dark');assert.equal(b.root.dataset.theme,'dark');
  b.storageChange(key,null);b.systemChange(false);assert.equal(b.root.dataset.theme,'light');
  b.storageChange(key,'dark');b.storageChange(null,null);assert.equal(b.root.dataset.theme,'light');
});
