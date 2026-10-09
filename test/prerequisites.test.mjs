import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PrerequisiteGate,PACKAGE_SYSTEMS,DNF_CURL_CONFLICT_COMMAND,prerequisitesView,commandBlock} from '../dist/prerequisites.mjs';
import {UI_LOCALES} from '../dist/i18n.mjs';
import {DISTRIBUTIONS,distributionsFor} from '../dist/distributions.mjs';

test('all general Linux choices and version labels match the upstream tested matrix',()=>{
 const snapshot=JSON.parse(readFileSync(new URL('./fixtures/supported-systems.json',import.meta.url),'utf8'));
 const upstream=[...snapshot.content.matchAll(/^\| ([^|]+) \| `([^`]+)` \|$/gm)].map(([,name,version])=>({name:name.trim().replace('\\_','_'),version}));
 const names={'Arch':'Arch Linux','Debian GNU/Linux':'Debian','KDE Neon':'KDE neon'};
 const expected=upstream.filter(row=>!['Raspbian','WSL2'].includes(row.name));
 assert.equal(Object.keys(DISTRIBUTIONS).length,expected.length);
 for(const row of expected){
  const option=Object.values(DISTRIBUTIONS).find(item=>item.label===(names[row.name]||row.name));
  assert.ok(option,row.name);
  assert.equal(option.version,row.version==='rolling'?'Rolling release':row.version.replace('>= ','')+'+',row.name);
 }
 assert.equal(Object.hasOwn(DISTRIBUTIONS,'suse'),false,'an ambiguous edition must not unlock installation');
 assert.equal(distributionsFor('windows')['ubuntu-wsl'].version,'20.04+');
});

test('Mark I preparation offers only the requested Debian 13 release',()=>{
 const gate=new PrerequisiteGate();gate.selectDevice('mark1');
 for(const id of [...Object.keys(DISTRIBUTIONS),'debian11','ubuntu-wsl']){
  gate.selectFamily(id);gate.confirm(true);assert.equal(gate.accept('mark1'),false,id);
 }
 gate.selectFamily('debian13');gate.confirm(true);assert.equal(gate.accept('mark1'),true);
 assert.equal(gate.command(),PACKAGE_SYSTEMS.debian.command);
 const html=prerequisitesView({device:'mark1'},gate);
 assert.match(html,/data-no-translate>Debian 13</);assert.doesNotMatch(html,/Debian 11|11\+/);assert.doesNotMatch(html,/distro-option-fedora/);
});

test('matrix guidance and the stronger acknowledgement are translated everywhere',()=>{
 const keys=['Use a supported 64-bit system. Versions are shown below.','Rolling release','I’m using a supported system, and the required tools are installed.','This device needs Debian 11 or newer (64-bit).','Your version isn’t listed? Check supported systems.'];
 for(const locale of UI_LOCALES){const messages=JSON.parse(readFileSync(new URL(`../dist/locales/${locale}.json`,import.meta.url),'utf8'));for(const key of keys)assert.ok(messages[key],`${locale}: ${key}`);}
});

test('command blocks protect literal shell syntax and keep the copy action outside selectable code',()=>{
 const html=commandBlock('example','printf "<ready>" && cat /etc/os-release');
 assert.ok(html.includes('<pre><code id="example" class="language-shell" tabindex="0" data-no-translate>printf "&lt;ready&gt;" &amp;&amp; cat /etc/os-release</code></pre>'));
 assert.ok(html.includes('aria-label="Copy command"'));assert.ok(html.includes('aria-describedby="example"'));
 assert.ok(html.indexOf('data-copy-prerequisites')>html.indexOf('</pre>'));
 assert.ok(html.includes('role="status" aria-live="polite"'));
 for(const locale of UI_LOCALES){const messages=JSON.parse(readFileSync(new URL('../dist/locales/'+locale+'.json',import.meta.url),'utf8'));for(const key of ['Copy','Copy command'])assert.ok(messages[key],locale+': '+key);}
});

test('all preparation and identification commands share compact blocks without a repeated package list',()=>{
 const gate=new PrerequisiteGate();gate.selectDevice('computer');gate.selectFamily('debian');
 let html=prerequisitesView({device:'computer'},gate);
 assert.ok(html.includes(commandBlock('prerequisite-command',gate.command())));
 assert.doesNotMatch(html,/textarea|Required: curl|Copy preparation command/);
 assert.ok(html.includes('Run this on your OVOS device, then wait for it to finish.'));
 gate.selectFamily('unknown');html=prerequisitesView({device:'computer'},gate,true);
 assert.ok(html.includes(commandBlock('system-command','cat /etc/os-release',true)));
 assert.equal(gate.ready('computer'),false);
 assert.ok(!commandBlock('system-command','cat /etc/os-release',true).includes('disabled'));
 for(const command of ['sudo apt install curl','xcode-select --install','brew install bash',DNF_CURL_CONFLICT_COMMAND])assert.ok(commandBlock('example',command,true).includes('disabled'));
 html=prerequisitesView({device:'mac'},new PrerequisiteGate());
 for(const [id,command] of [['xcode-command','xcode-select --install'],['brew-command','brew install bash']])assert.ok(html.includes(commandBlock(id,command)));
 gate.selectFamily('fedora');html=prerequisitesView({device:'computer'},gate);
 assert.ok(html.includes(commandBlock('dnf-conflict-command',DNF_CURL_CONFLICT_COMMAND)));
});

test('OS selection, acknowledgement and explicit acceptance are independent requirements',()=>{
 const gate=new PrerequisiteGate();gate.selectDevice('pi');
 assert.equal(gate.family,'');gate.confirm(true);assert.equal(gate.accept('pi'),false);
 gate.selectFamily('fedora');assert.equal(gate.accept('pi'),false);
 gate.confirm(true);assert.equal(gate.canContinue('pi'),true);assert.equal(gate.ready('pi'),false);
 assert.equal(gate.accept('pi'),true);assert.equal(gate.ready('pi'),true);assert.equal(gate.ready('computer'),false);
 gate.selectDevice('pi');assert.equal(gate.ready('pi'),true);
 gate.selectFamily('arch');assert.equal(gate.ready('pi'),false);assert.equal(gate.confirmed,false);
 gate.confirm(true);gate.accept('pi');gate.selectDevice('computer');assert.equal(gate.family,'');assert.equal(gate.ready('computer'),false);
 assert.equal(new PrerequisiteGate().ready('pi'),false);
});

test('general Linux requires OS selection and unsupported selections cannot unlock commands',()=>{
 for(const device of ['pi','jetson','computer','server','other']){
  const gate=new PrerequisiteGate();gate.selectDevice(device);assert.equal(gate.family,'',device);assert.equal(gate.command(),'');
  for(const family of ['unknown','bad; command','mac']){gate.selectFamily(family);gate.confirm(true);assert.equal(gate.accept(device),false);assert.equal(gate.command(),'');}
  const html=prerequisitesView({device},gate);assert.doesNotMatch(html,/sudo (?:apt|dnf|pacman|zypper)/);assert.match(html,/data-prerequisite-continue disabled/);
 }
 const gate=new PrerequisiteGate();gate.selectDevice('computer');gate.selectFamily('unknown');
 assert.match(prerequisitesView({device:'computer'},gate),/cat \/etc\/os-release/);
 assert.match(prerequisitesView({device:'computer'},gate),/Check supported systems/);
});

test('every supported Linux family uses its own package command on generic Linux and Pi',()=>{
 for(const device of ['pi','jetson','computer','server','other'])for(const [family,item] of Object.entries(DISTRIBUTIONS)){
  const gate=new PrerequisiteGate();gate.selectDevice(device);gate.selectFamily(family);gate.confirm(true);assert.equal(gate.accept(device),true);
  assert.equal(gate.command(),PACKAGE_SYSTEMS[item.family].command);assert.ok(prerequisitesView({device},gate).includes(PACKAGE_SYSTEMS[item.family].command.replaceAll('&','&amp;')));
 }
 assert.match(PACKAGE_SYSTEMS.debian.label,/Linux Mint/);
 assert.equal(PACKAGE_SYSTEMS.debian.command,'sudo apt update && sudo apt install curl git sudo bash');
 assert.equal(PACKAGE_SYSTEMS.fedora.command,"sudo dnf install curl git sudo bash");
 assert.match(PACKAGE_SYSTEMS.arch.command,/pacman -Syu --needed/);
 assert.equal(PACKAGE_SYSTEMS.suse.command,'sudo zypper refresh && sudo zypper install curl git sudo bash');
 const gate=new PrerequisiteGate();gate.selectDevice('computer');gate.selectFamily('arch');
 assert.match(prerequisitesView({device:'computer'},gate),/This also updates your Arch system/);
});

test('DNF uses plain packages and keeps the installed-curl conflict recovery inside help only',()=>{
 const gate=new PrerequisiteGate();gate.selectDevice('computer');
 for(const [id,item] of Object.entries(DISTRIBUTIONS)){
  gate.selectFamily(id);const html=prerequisitesView({device:'computer'},gate);
  if(item.family==='fedora'){
   assert.equal(gate.command(),'sudo dnf install curl git sudo bash');
   assert.ok(html.includes('<details class="prerequisite-help"><summary>Need help?</summary><h3>A curl-minimal conflict?</h3>'));
   assert.ok(html.includes(DNF_CURL_CONFLICT_COMMAND));
   assert.ok(html.includes('already installed and conflicts with curl'));
   for(const forbidden of ['(curl or curl-minimal)','/usr/bin/curl','--allowerasing'])assert.ok(!html.includes(forbidden));
  }else assert.ok(!html.includes('A curl-minimal conflict'));
 }
 for(const locale of UI_LOCALES){const messages=JSON.parse(readFileSync(new URL('../dist/locales/'+locale+'.json',import.meta.url),'utf8'));for(const key of ['A curl-minimal conflict?','If DNF reports that curl-minimal is already installed and conflicts with curl, keep it and run this instead:'])assert.ok(messages[key],locale+': '+key);}
});

test('fixed-system presets show preparation immediately but require checkbox and Continue',()=>{
 for(const device of ['mark1','mark2','devkit','windows']){
  const gate=new PrerequisiteGate(),state={device};
  let html=prerequisitesView(state,gate);
  assert.equal(gate.family,device==='windows'?'ubuntu-wsl':'debian13');
  assert.equal(gate.command(),PACKAGE_SYSTEMS.debian.command);
  assert.equal(gate.confirmed,false);assert.equal(gate.ready(device),false);assert.equal(gate.accept(device),false);
  assert.match(html,/class="distro-fixed"/);assert.match(html,device==='windows'?/Ubuntu \(WSL2\)/:/Debian 13/);
  assert.match(html,new RegExp(`assets/distributions/${device==='windows'?'ubuntu':'debian'}\\.svg`));
  assert.doesNotMatch(html,/role="combobox"|role="listbox"|Choose the system|Choose your Linux|Other \/ I’m not sure|system-matrix-note/);
  assert.match(html,/I need help getting it ready/);
  assert.doesNotMatch(html,/data-prerequisite-confirm\s+disabled/);
  assert.match(html,/data-prerequisite-continue disabled/);
  gate.confirm(true);assert.equal(gate.ready(device),false);assert.equal(gate.accept(device),true);
  html=prerequisitesView(state,gate);assert.equal(gate.ready(device),true);assert.match(html,/data-prerequisite-confirm checked/);
  gate.confirm(false);assert.equal(gate.ready(device),false);
 }
});

test('fixed systems reset acknowledgement across devices and recover invalid selections without acceptance',()=>{
 const gate=new PrerequisiteGate();
 for(const device of ['mark1','mark2','devkit','windows','computer','mark1']){
  gate.selectDevice(device);assert.equal(gate.confirmed,false);assert.equal(gate.accepted,false);assert.equal(gate.ready(device),false);
  if(device==='computer'){assert.equal(gate.family,'');gate.selectFamily('debian');}
  gate.confirm(true);assert.equal(gate.accept(device),true);
 }
 for(const family of ['debian','fedora','arch','suse','unknown','bad; command']){
  gate.selectFamily(family);assert.equal(gate.family,'');assert.equal(gate.confirmed,false);assert.equal(gate.ready('mark1'),false);
  gate.confirm(true);assert.equal(gate.accept('mark1'),false);
  prerequisitesView({device:'mark1'},gate);assert.equal(gate.family,'debian13');assert.equal(gate.confirmed,false);assert.equal(gate.ready('mark1'),false);
 }
});

test('each named distribution resolves to its own family and changing the distro clears acceptance',()=>{
 const gate=new PrerequisiteGate();gate.selectDevice('computer');
 for(const [id,item] of Object.entries(DISTRIBUTIONS)){
  gate.selectFamily(id);assert.equal(gate.confirmed,false);assert.equal(gate.ready('computer'),false);
  assert.equal(gate.command(),PACKAGE_SYSTEMS[item.family].command,id);
  gate.confirm(true);assert.equal(gate.accept('computer'),true);
 }
 gate.selectFamily('unknown');assert.equal(gate.command(),'');assert.equal(gate.ready('computer'),false);
});

test('dropdown logos stay decorative and local while actual OS names label each option',()=>{
 const gate=new PrerequisiteGate();gate.selectDevice('computer');
 const html=prerequisitesView({device:'computer'},gate);
 assert.match(html,/role="combobox" aria-haspopup="listbox" aria-expanded="false"/);
 assert.match(html,/id="distro-options"[^>]+role="listbox"[^>]+hidden/);
 assert.equal((html.match(/data-distro-option /g)||[]).length,19);
 for(const [id,item] of Object.entries(DISTRIBUTIONS)){
  assert.ok(html.includes(`id="distro-option-${id}"`));assert.ok(html.includes(`data-no-translate>${item.label}</span>`));
  const path=`../dist/assets/distributions/${item.logo}.${item.format||'svg'}`;
  const bytes=readFileSync(new URL(path,import.meta.url));assert.ok(bytes.length>100);
  if(!item.format){const svg=bytes.toString();assert.match(svg,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(svg,/<(?:path|circle|rect|polygon|g)\b/);assert.doesNotMatch(svg,/<script|foreignObject|<!ENTITY|&ns_|\bon\w+=|href="https?:/);}
 }
 assert.doesNotMatch(html,/<img[^>]+alt="[^"]/);
 for(const device of ['mark1','mark2','devkit','windows']){
  const scoped=new PrerequisiteGate(),view=prerequisitesView({device},scoped);
  assert.equal((view.match(/data-distro-option /g)||[]).length,0);
  assert.doesNotMatch(view,/distro-option-fedora|distro-option-arch/);
 }
});

test('general Linux retains Other with identification help',()=>{
 for(const device of ['computer','pi','jetson','server','other']){
  const gate=new PrerequisiteGate();gate.selectDevice(device);gate.selectFamily('unknown');
  const html=prerequisitesView({device},gate);
  assert.equal(gate.family,'unknown');assert.match(html,/distro-option-unknown/);
  assert.match(html,/cat \/etc\/os-release/);assert.equal(gate.ready(device),false);
 }
});

test('Mac has its own tools and the gate is visible with an accessible checkbox',()=>{
 const gate=new PrerequisiteGate();const html=prerequisitesView({device:'mac'},gate);
 assert.match(html,/xcode-select --install/);assert.match(html,/brew install bash/);assert.match(html,/Homebrew/);assert.doesNotMatch(html,/sudo apt|Linux system|<select/);
 assert.match(html,/<label class="prerequisite-confirm">/);assert.match(html,/data-prerequisite-continue disabled/);
 gate.confirm(true);assert.equal(gate.ready('mac'),false);assert.equal(gate.accept('mac'),true);
 gate.confirm(false);assert.equal(gate.ready('mac'),false);
});

test('preparation has one short native acknowledgement and only relevant help',()=>{
 const gate=new PrerequisiteGate();gate.selectDevice('computer');
 let html=prerequisitesView({device:'computer'},gate);
 assert.match(html,/data-prerequisite-confirm\s+disabled/);
 gate.selectFamily('debian');html=prerequisitesView({device:'computer'},gate);
 assert.equal((html.match(/type="checkbox"/g)||[]).length,1);
 assert.match(html,/<label class="prerequisite-confirm"><span class="prerequisite-checkbox"><input type="checkbox" data-prerequisite-confirm\s*><span class="prerequisite-check" aria-hidden="true">/);
 assert.match(html,/<span>The required tools are installed\.<\/span><\/label>/);
 assert.match(html,/<a class="prerequisite-help-link" href="https:\/\/matrix\.to\/#\/#openvoiceos:matrix\.org"/);
 assert.doesNotMatch(html,/<details class="prerequisite-help">/);
 assert.doesNotMatch(html,/immutable|administrator|prerequisite-unlock|matrix-guide|Select your system, install the tools/);
 gate.confirm(true);html=prerequisitesView({device:'computer'},gate);
 assert.match(html,/data-prerequisite-confirm checked/);assert.equal(gate.ready('computer'),false);
 gate.selectFamily('unknown');html=prerequisitesView({device:'computer'},gate);
 assert.match(html,/data-prerequisite-confirm\s+disabled/);assert.match(html,/cat \/etc\/os-release/);
 for(const locale of UI_LOCALES){const messages=JSON.parse(readFileSync(new URL(`../dist/locales/${locale}.json`,import.meta.url),'utf8'));for(const key of ['Need help?','Command didn’t work? Get help','The required tools are installed.','Tools confirmed'])assert.ok(messages[key],`${locale}: ${key}`);}
});

test('breathing halo is limited to actionable unchecked controls with an accessible motion fallback',()=>{
 const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
 const selector='.prerequisite-confirm input:not(:checked):not(:disabled)+.prerequisite-check::before';
 const rule=css.slice(css.indexOf(selector),css.indexOf('}',css.indexOf(selector))+1);
 assert.match(rule,/animation:acknowledge-breathe 2\.8s ease-in-out infinite/);
 assert.match(rule,/background:color-mix\(in srgb,var\(--ack-pending\)/);
 assert.doesNotMatch(rule,/var\(--accent\)/);
 assert.ok(css.includes(`@media(prefers-reduced-motion:reduce){${selector}{animation:none;transform:none;opacity:.35}}`));
 assert.match(css,/input:focus-visible\+\.prerequisite-check\{outline:2px solid/);
 assert.match(css,/@media\(forced-colors:active\).*input\{opacity:1;position:static;accent-color:auto\}/);
});

test('all locales contain contextual instructions for the mandatory preparation page',()=>{
 const keys=['Before you install','Required tools','Choose the system installed on your OVOS device.','Other / I’m not sure','This device requires Debian 13. Install the supported image before continuing.','This Windows setup uses Ubuntu in WSL2. Prepare Ubuntu before continuing.','Check supported systems','This also updates your Arch system.','I’ve installed the required tools on this device.','Show install command','Review preparation','Select your system, install the tools, then confirm below.','Ask your device administrator to install these tools and enable sudo for your account.'];
 for(const locale of UI_LOCALES){const catalog=JSON.parse(readFileSync(new URL(`../dist/locales/${locale}.json`,import.meta.url),'utf8'));for(const key of keys)assert.ok(catalog[key],`${locale}: ${key}`);}
});


test('Mac acknowledgement includes the supported hardware and OS, and known Intel choices cannot unlock installation',()=>{
 const gate=new PrerequisiteGate();
 let html=prerequisitesView({device:'mac',cpu:'arm64'},gate);
 assert.match(html,/Apple Silicon and macOS 15 or later are required/);
 assert.match(html,/Open Terminal without Rosetta/);
 assert.match(html,/My Mac uses Apple Silicon and macOS 15 or later; the required tools are installed/);
 gate.confirm(true);assert.equal(gate.accept('mac'),true);
 for(const cpu of ['intel-mac','avx2']){
  html=prerequisitesView({device:'mac',cpu},gate);
  assert.match(html,/This Mac is not supported/);
  assert.doesNotMatch(html,/brew install bash|xcode-select --install/);
  assert.match(html,/data-prerequisite-confirm\s+disabled/);
  gate.confirm(true);assert.equal(gate.accept('mac'),false,cpu);
  assert.equal(gate.ready('mac'),false,cpu);
 }
 html=prerequisitesView({device:'mac',cpu:'arm64'},gate);
 assert.equal(gate.confirmed,false,'changing a Mac processor requires a fresh acknowledgement');
 assert.doesNotMatch(html,/data-prerequisite-confirm\s+disabled/);
 gate.confirm(true);assert.equal(gate.accept('mac'),true);
 gate.selectDevice('mac','arm64');assert.equal(gate.ready('mac'),true,'same known hardware retains acknowledgement');
 html=prerequisitesView({device:'mac',cpu:'unknown'},gate);
 assert.equal(gate.confirmed,false,'unknown processor still requires the explicit supported-Mac acknowledgement');
 assert.equal(gate.ready('mac'),false);assert.doesNotMatch(html,/This Mac is not supported/);
 assert.match(html,/My Mac uses Apple Silicon and macOS 15 or later/);
 gate.confirm(true);assert.equal(gate.accept('mac'),true);
});
