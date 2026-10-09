import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {progressView} from '../dist/post-install.mjs';
import {DEFAULTS} from '../dist/scenario.mjs';

const source=readFileSync(new URL('../dist/theme.js',import.meta.url),'utf8');
const key='ovos.theme.v1';
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');

/** Resolve the opaque palette for a manual or system appearance.
 * @param {string} theme Appearance to inspect. @returns {object} CSS color tokens.
 */
function palette(theme){
  const base=[...css.matchAll(/:root\s*\{([^}]+)\}/g)];
  const overrides=theme==='automatic-dark'
    ?[...css.matchAll(/:root:not\(\[data-theme\]\)\s*\{([^}]+)\}/g)]
    :[...css.matchAll(new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`,'g'))];
  return Object.fromEntries([...base,...overrides].flatMap(block=>
    [...block[1].matchAll(/(--[\w-]+):\s*(#[\da-f]{6}|#[\da-f]{3})(?=;|$)/gi)]
      .map(match=>[match[1],match[2]])));
}

/** Convert an opaque hex color to its sRGB channels.
 * @param {string} hex Three- or six-digit hex color. @returns {number[]} RGB channels.
 */
function rgb(hex){
  const full=hex.length===4?hex.slice(1).split('').map(channel=>channel.repeat(2)).join(''):hex.slice(1);
  return full.match(/../g).map(channel=>parseInt(channel,16));
}

/** Calculate WCAG relative luminance, including unrounded CSS color mixtures.
 * @param {string|number[]} color Hex color or sRGB channels. @returns {number} Relative luminance.
 */
function luminance(color){
  const channels=(typeof color==='string'?rgb(color):color).map(channel=>channel/255)
    .map(channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4);
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}

/** Assert readable text or distinguishable icons against their actual surface.
 * @param {string|number[]} foreground Foreground color. @param {string|number[]} background Background color.
 * @param {number} minimum Required contrast. @param {string} label Failure context. @returns {void}
 */
function assertContrast(foreground,background,minimum,label){
  const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
  const ratio=(values[0]+0.05)/(values[1]+0.05);
  assert.ok(ratio>=minimum,`${label}: ${ratio.toFixed(2)}:1 must reach ${minimum}:1`);
}

/** Calculate the sRGB tint declared by a current component rule.
 * @param {string} selector Component selector. @param {string} tone Actual status color.
 * @param {object} tokens Appearance palette. @param {string} variable Status color variable.
 * @returns {number[]} Mixed RGB channels.
 */
function tintedSurface(selector,tone,tokens,variable='--audio-tone'){
  const rule=css.match(new RegExp(`${selector.replaceAll('.','\\.')}\\{([^}]+)\\}`));
  assert.ok(rule,`Missing component ${selector}`);
  const mixture=rule[1].match(new RegExp(`background:color-mix\\(in srgb,var\\(${variable}\\) ([\\d.]+)%,var\\(--card\\)\\)`));
  assert.ok(mixture,`Missing sRGB surface for ${selector}`);
  const fraction=Number(mixture[1])/100,foreground=rgb(tone),background=rgb(tokens['--card']);
  return foreground.map((channel,index)=>channel*fraction+background[index]*(1-fraction));
}

test('subtle light colors retain readable body, accent and confirmation text',()=>{
  const tokens=palette('light');
  const pairs=[...['--paper','--card','--soft'].flatMap(bg=>['--ink','--muted','--accent'].map(fg=>[fg,bg])),['--card','--accent'],['--success-ink','--success-soft'],['--install-done','--card'],['--back-ink','--back-bg']];
  for(const [fg,bg] of pairs){
    assert.ok(tokens[fg]&&tokens[bg],`Missing palette tokens ${fg}/${bg}`);
    assertContrast(tokens[fg],tokens[bg],4.5,`${fg} on ${bg}`);
  }
  const base=browser();assert.equal(base.meta.content,tokens['--paper']);
});

test('requirement highlights have readable text and a distinct icon in each appearance',()=>{
  for(const theme of ['light','dark','automatic-dark']){
    const tokens=palette(theme);
    assert.notEqual(tokens['--requirement-bg'],tokens['--card']);
    for(const [foreground,minimum] of [['--requirement-ink',4.5],['--requirement-accent',3]]){
      assert.ok(tokens[foreground]&&tokens['--requirement-bg'],`${theme}: missing requirement colors`);
      assertContrast(tokens[foreground],tokens['--requirement-bg'],minimum,`${theme}: ${foreground}`);
    }
  }
});

test('copy confirmation keeps readable neutral text and a contrasting check in both themes',()=>{
  for(const theme of ['light','dark']){
    const tokens=palette(theme);
    for(const foreground of ['--ink','--install-done','--ack-pending'])for(const surface of ['--paper','--soft']){
      assertContrast(tokens[foreground],tokens[surface],4.5,`${theme}: ${foreground} on ${surface}`);
    }
  }
  assert.doesNotMatch(css,/\.prerequisite-panel\s+\.copied\s*\{/,'legacy success styling must not recolor the whole button');
  assert.match(css,/\.command-copy\.copied\s+\.ui-icon\s*\{color:var\(--install-done\)/);
});

for(const theme of ['light','dark','automatic-dark']){
  test(`installation heading, task, checkpoint, timing and trivia remain readable in ${theme}`,()=>{
    const tokens=palette(theme);
    for(const surface of ['--paper','--card','--soft']){
      for(const foreground of ['--ink','--muted','--accent','--install-done']){
        assert.ok(tokens[foreground]&&tokens[surface],`${theme}: missing ${foreground}/${surface}`);
        assertContrast(tokens[foreground],tokens[surface],4.5,`${theme}: ${foreground} on ${surface}`);
      }
    }
    assertContrast(tokens['--muted'],tokens['--requirement-bg'],4.5,`${theme}: attention instructions`);
  });

  test(`audio results retain readable labels and distinguishable icons in ${theme}`,()=>{
    const tokens=palette(theme);
    for(const status of ['pass','fail','check']){
      const tone=tokens[`--audio-${status}`],surface=tintedSurface('.audio-result',tone,tokens);
      assertContrast(tokens['--ink'],surface,4.5,`${theme}: ${status} heading`);
      assertContrast(tokens['--muted'],surface,4.5,`${theme}: ${status} description`);
      assertContrast(tone,tintedSurface('.audio-result-symbol',tone,tokens),3,`${theme}: ${status} icon`);
      if(status==='check'){
        assertContrast(tone,tintedSurface('.audio-result-status',tone,tokens),4.5,`${theme}: checking badge`);
      }else{
        assertContrast(tokens['--audio-status-ink'],tone,4.5,`${theme}: ${status} badge`);
      }
    }
  });

  test(`completed and current checklist rows retain readable states and receipts in ${theme}`,()=>{
    const tokens=palette(theme),done=tokens['--install-done'];
    assertContrast(done,tokens['--card'],4.5,`${theme}: completed checkpoint label`);
    assertContrast(done,tintedSurface('.stage-complete .stage-symbol',done,tokens,'--install-done'),3,`${theme}: completed check icon`);
    assertContrast(tokens['--ink'],tokens['--soft'],4.5,`${theme}: current checkpoint label`);
    assertContrast(tokens['--accent'],tokens['--soft'],4.5,`${theme}: current checkpoint status`);
    for(const surface of ['--card','--soft']){
      assertContrast(tokens['--muted'],tokens[surface],4.5,`${theme}: receipt description on ${surface}`);
      assertContrast(done,tokens[surface],3,`${theme}: confirmed receipt check on ${surface}`);
    }
    assertContrast(tokens['--accent'],tokens['--card'],3,`${theme}: current checkpoint icon`);
  });
}

test('working checklist statuses stay accessible without hiding the current or unknown step',()=>{
  const state={...DEFAULTS,device:'mark2'};
  const html=progressView({session:{status:'installing',phase:3,progressRank:3,completedSteps:['packages_installed','audio_configured','components_installed']}},state);
  const statuses=[...html.matchAll(/<span class="stage-status([^"]*)"([^>]*)>([^<]+)<\/span>/g)];
  assert.equal(statuses.length,5);
  assert.deepEqual(statuses.map(match=>match[3]),['Completed','Completed','Completed','In progress','Not started']);
  assert.deepEqual(statuses.map(match=>match[1].trim()==='sr-only'),[true,true,true,false,true]);
  assert.equal((html.match(/class="stage-complete"/g)||[]).length,3,'green checkpoints remain visible while later steps run');
  assert.equal((html.match(/data-completed-step=/g)||[]).length,3,'confirmed receipts remain available during installation');
  for(const status of statuses)assert.doesNotMatch(status[2],/\bhidden\b|aria-hidden/,'visually compact statuses must remain in the accessibility tree');
  const srOnly=css.match(/\.sr-only\{([^}]+)\}/)?.[1];
  assert.ok(srOnly);
  assert.doesNotMatch(srOnly,/display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden/);
  const coarse=progressView({session:{status:'installing',phase:0,progressRank:3}},state);
  assert.equal((coarse.match(/<span class="stage-status">Not confirmed<\/span>/g)||[]).length,4,'unknown progress must remain visibly explicit');
  const offline=progressView({session:{status:'installing',phase:2,progressRank:3},error:'unavailable'},state);
  assert.match(offline,/<span class="stage-status">Last reported step<\/span>/);
  for(const status of ['installed','services_ready','voice_ready']){
    const finished=progressView({session:{status,audioStatus:'passed',microphoneStatus:'passed'}},state);
    assert.doesNotMatch(finished,/class="installation-stages"|data-install-step=|class="installation-receipt"/,'finished setup no longer exposes the installation checklist');
  }
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
