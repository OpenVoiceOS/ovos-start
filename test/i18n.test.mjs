import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UI_LOCALES,validateCatalog,translateMessage,loadLocale,applyTranslations} from '../dist/i18n.mjs';
import {LANGUAGES,DEFAULTS,buildYaml} from '../dist/scenario.mjs';
import {issueSetup,buildShortCommand,readSetupSession} from '../dist/short-setup.mjs';
import {PROJECT_FACTS} from '../dist/facts.mjs';
import {runInNewContext} from 'node:vm';

const read=locale=>JSON.parse(readFileSync(new URL(`../dist/locales/${locale}.json`,import.meta.url)));
test('every offered assistant language has complete, valid bundled UI messages',()=>{
  assert.deepEqual(UI_LOCALES,Object.keys(LANGUAGES));const source=read('en-us');
  for(const locale of UI_LOCALES){const catalog=validateCatalog(read(locale));assert.deepEqual(Object.keys(catalog).sort(),Object.keys(source).sort(),locale);}
});
test('catalog validation rejects lost placeholders or active markup',()=>{
  assert.throws(()=>validateCatalog({'Expires in {minutes} min.':'Expire bientôt.'}));
  assert.throws(()=>validateCatalog({'Hello':'<img src=x onerror=alert(1)>'}));
  assert.throws(()=>validateCatalog({'Hello, <em>again.</em>':'Bonjour'}));
  assert.doesNotThrow(()=>validateCatalog({'Hello, <em>again.</em>':'<em>Re</em>bonjour.'}));
});
test('whole headings can reorder emphasis; sentences and dynamic values remain intact',()=>{
  const fr={ 'Which <em>Mac chip?</em>':'Quelle <em>puce Mac ?</em>', 'Expires in {minutes} min.':'Expire dans {minutes} min.', 'Next, on your {device}':'Ensuite, sur votre {device}', 'Linux computer':'ordinateur Linux', 'Copied!':'Copié !', 'Copy again':'Copier à nouveau', 'Edit {label}: {value}':'Modifier {label} : {value}', 'Device':'Appareil'};
  assert.equal(translateMessage('Which <em>Mac chip?</em>',fr),'Quelle <em>puce Mac ?</em>');
  assert.equal(translateMessage('Expires in 60 min.',fr),'Expire dans 60 min.');
  assert.equal(translateMessage('Expires in {minutes} min.',fr,{minutes:5}),'Expire dans 5 min.');
  assert.equal(translateMessage('Next, on your Linux computer',fr),'Ensuite, sur votre ordinateur Linux');
  assert.equal(translateMessage('  Copied! Copy again  ',fr),'  Copié ! Copier à nouveau  ');
  assert.equal(translateMessage('Edit Device: Linux computer',fr),'Modifier Appareil : ordinateur Linux');
  assert.equal(translateMessage('An untranslated message.',fr),'An untranslated message.');
  const help={'Open Terminal on your {device}.':'Ouvrez Terminal sur votre {device}.','Linux computer':'ordinateur Linux','If it has no screen, connect with SSH.':'Sans écran, connectez-vous avec SSH.'};
  assert.equal(translateMessage('Open Terminal on your Linux computer. If it has no screen, connect with SSH.',help),'Ouvrez Terminal sur votre ordinateur Linux. Sans écran, connectez-vous avec SSH.');
});
test('all localized recipes preserve machine values and restore their selected locale',()=>{
  for(const locale of UI_LOCALES){
    const state={...DEFAULTS,device:'pi',locale},setup=issueSetup(state,1791360000);
    assert.equal(readSetupSession('#setup='+setup.code,1791360001).state.locale,locale);
    assert.ok(buildShortCommand(setup,1791360001,'L'.repeat(22)).includes('/s/'+'L'.repeat(22)));
    assert.match(buildYaml(state),/method: virtualenv/);assert.match(buildYaml(state),/skills: true/);
  }
});

test('complete descriptions take precedence over translated sentence fragments',()=>{
  const source='I already run Home Assistant. Ask for my server details in the device terminal.';
  const fr=read('fr-fr'),whole=fr[source];
  assert.notEqual(whole,translateMessage(source,Object.fromEntries(Object.entries(fr).filter(([key])=>key!==source))));
  assert.equal(translateMessage(`  ${source}  `,fr),`  ${whole}  `);
  const local='Runs speech on your OVOS device. Needs more memory and downloads. Your voice may still go to an online backup.';
  const ai='To add AI, use an existing OpenAI-compatible service. The terminal asks for its URL, model and key. No model is installed for you.';
  for(const locale of UI_LOCALES){
    const catalog=read(locale);
    for(const message of [source,local,ai,...PROJECT_FACTS.map(fact=>fact.text)]){
      assert.ok(Object.hasOwn(catalog,message),`${locale}: missing complete context: ${message}`);
      assert.equal(translateMessage(message,catalog),catalog[message]);
      if(locale!=='en-us')assert.notEqual(catalog[message],message,`${locale}: untranslated paragraph`);
    }
  }
});

test('target-system guidance is one translatable message, without guessing the installation device',()=>{
  const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
  const body=app.slice(app.indexOf('function platformView()'),app.indexOf('/** Keep help, alternate exports'));
  const html=runInNewContext(`${body}; platformView()`,{
    answered:new Set(),state:{device:null},unlistedDevice:false,platformUnsure:false,icon:()=>'',
  });
  const message=html.match(/<p class="under-deck">([^<]+)<\/p>/)?.[1];
  assert.equal(message,'Choose the system on your OVOS device.');
  for(const locale of UI_LOCALES){
    const catalog=read(locale);
    assert.equal(translateMessage(message,catalog),catalog[message]);
    if(locale!=='en-us')assert.notEqual(catalog[message],message,locale);
  }
  assert.ok(!html.includes('This browser looks like'));
});

test('contextual catalogs retain compatibility numbers and expiry substitutions',()=>{
  for(const locale of UI_LOCALES){
    const catalog=read(locale);
    assert.match(translateMessage('Requires at least 8 GB of RAM.',catalog),/8/);
    assert.match(translateMessage('All OVOS setups require a 64-bit operating system.',catalog),/64/);
    assert.match(translateMessage('Expires in {minutes} min.',catalog,{minutes:60}),/60/);
    const command='getconf LONG_BIT';
    assert.ok(translateMessage(`On your device, run: ${command}`,catalog).includes(command));
  }
});

/** Minimal DOM nodes exercise source retention and protected text without a browser dependency. */
function element(tag,text='',attrs={}){
  return {nodeType:1,tag,attrs,childNodes:text?[{nodeType:3,textContent:text}]:[],
    matches(selector){return selector.split(',').some(part=>part===tag||part==='[data-no-translate]'&&Object.hasOwn(attrs,'data-no-translate'));},
    hasAttribute(key){return Object.hasOwn(attrs,key);},getAttribute(key){return attrs[key];},setAttribute(key,value){attrs[key]=value;}};
}
test('switching languages retranslates original chrome and new statuses while protecting commands',async()=>{
  const originalFetch=globalThis.fetch;
  try{
    globalThis.fetch=async url=>({ok:true,json:async()=>read(url.match(/\/([a-z]+-[a-z]+)\.json/)[1])});
    await loadLocale('fr-fr');await loadLocale('de-de');
    const button=element('button','Continue',{'aria-label':'Go back'}),command=element('code','Continue'),transcript=element('p','Welcome to the Open Voice OS Installer Wizard.',{'data-no-translate':''});
    const field=element('textarea','Continue',{'data-no-translate':'','aria-label':'Check sound and microphone'});
    const root=element('main');root.childNodes=[button,command,transcript,field];
    applyTranslations(root,'fr-fr');assert.equal(button.childNodes[0].textContent,read('fr-fr').Continue);assert.equal(button.attrs['aria-label'],read('fr-fr')['Go back']);
    assert.equal(field.attrs['aria-label'],read('fr-fr')['Check sound and microphone']);assert.equal(field.childNodes[0].textContent,'Continue');
    applyTranslations(root,'de-de');assert.equal(button.childNodes[0].textContent,read('de-de').Continue);
    button.childNodes[0].textContent='Copy install command';applyTranslations(root,'fr-fr');assert.equal(button.childNodes[0].textContent,read('fr-fr')['Copy install command']);
    applyTranslations(root,'en-us');assert.equal(button.childNodes[0].textContent,'Copy install command');
    assert.equal(command.childNodes[0].textContent,'Continue');assert.equal(transcript.childNodes[0].textContent,'Welcome to the Open Voice OS Installer Wizard.');
  }finally{globalThis.fetch=originalFetch;}
});
test('failed language loads can retry, without duplicate concurrent downloads',async()=>{
  const originalFetch=globalThis.fetch;let calls=0;
  try{
    globalThis.fetch=async()=>{calls++;return {ok:false};};await assert.rejects(loadLocale('nl-nl'));
    globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>read('nl-nl')};};
    await Promise.all([loadLocale('nl-nl'),loadLocale('nl-nl')]);assert.equal(calls,2);
  }finally{globalThis.fetch=originalFetch;}
});

test('compact device instructions beat broader placeholder templates in every locale',()=>{
 const key='Open Terminal on your {device}, paste and press Enter.';
 for(const locale of UI_LOCALES){
  const catalog=read(locale),device='Raspberry Pi';
  const translated=translateMessage(key.replace('{device}',device),catalog);
  assert.equal(translated,catalog[key].replace('{device}',translateMessage(device,catalog)),locale);
  assert.ok(!translated.includes('{device}'));
  for(const message of ['Install <em>OVOS.</em>','Installation help','Open Ubuntu in WSL2, paste and press Enter.'])assert.equal(translateMessage(message,catalog),catalog[message]);
 }
});

test('every locale explains why to keep the installation page open',()=>{
 const hint='Keep this page open to follow the installation.';
 for(const locale of UI_LOCALES){const catalog=read(locale);assert.equal(translateMessage(hint,catalog),catalog[hint]);if(locale!=='en-us')assert.notEqual(catalog[hint],hint,locale);}
});

test('prerequisite option labels translate explicitly without changing OS values or language names',async()=>{
 const originalFetch=globalThis.fetch;
 try{
  globalThis.fetch=async url=>({ok:true,json:async()=>read(url.match(/\/([a-z]+-[a-z]+)\.json/)[1])});await loadLocale('fr-fr');
  const unknown=element('option','Other / I’m not sure',{value:'unknown','data-translate-option':''});
  const prompt=element('option','Choose your Linux system',{value:'','data-translate-option':''});
  const literal=element('option','Continue',{value:'literal'});
  const root=element('select');root.childNodes=[prompt,unknown,literal];applyTranslations(root,'fr-fr');
  assert.equal(unknown.childNodes[0].textContent,read('fr-fr')['Other / I’m not sure']);assert.equal(unknown.attrs.value,'unknown');
  assert.equal(prompt.childNodes[0].textContent,read('fr-fr')['Choose your Linux system']);assert.equal(prompt.attrs.value,'');
  assert.equal(literal.childNodes[0].textContent,'Continue');applyTranslations(root,'en-us');assert.equal(unknown.childNodes[0].textContent,'Other / I’m not sure');
 }finally{globalThis.fetch=originalFetch;}
});


test('Mac support and explicit acknowledgement are translated consistently in every locale',()=>{
 const messages=['Apple Silicon · macOS 15+','Apple Silicon and macOS 15 or later are required.',
  'Open Terminal without Rosetta.','This Mac is not supported. Choose an Apple Silicon Mac with macOS 15 or later.',
  'My Mac uses Apple Silicon and macOS 15 or later; the required tools are installed.',
  'Not supported by the installer.','Check Apple menu → About This Mac before continuing.','The installer uses the latest main branch.'];
 for(const locale of UI_LOCALES){
  const catalog=read(locale);
  for(const key of messages){
   assert.ok(Object.hasOwn(catalog,key),`${locale}: ${key}`);
   assert.equal(translateMessage(key,catalog),catalog[key]);
   if(key.includes('macOS 15'))assert.ok(catalog[key].includes('15'),locale);
  }
 }
});
