import { errorReportUrl } from './report-link.mjs';
import { loadLocale, applyTranslations, t, uiLocale } from './i18n.mjs';
import { markOneFace, WELCOME_TEXT, WelcomePlayback, animateEyes } from './welcome.mjs';
import { ChoiceInputGuard, focusCurrentChoice } from './interaction.mjs';
import { DEFAULTS, PRESET_SCHEMA, DEVICES, LANGUAGES, usesVirtualenvPreset, usesRaspberryPiTuning, validateState, buildYaml, compatibility, encodePreset } from './scenario.mjs';
import { suggestLanguage, browserLanguages, languageSource, localeFlag, speechEligibility, localSpeechOption, localModelGuidance } from './recommendations.mjs';
import { hardwareCardsForExperience, platformTarget, chooseExperience, applySkillDefaults, chooseHardware, chooseSpeech, chooseCapability } from './flow.mjs';
import { nextQuestion, canExploreLocal, firstCapability, afterCapability, questionChapter, progressStages, canGoBack, RECIPE_QUESTIONS } from './journey.mjs';

import { nextTrivia, readTriviaHistory, updateTriviaNote } from './facts.mjs';
import { icon, deviceIcon } from './icons.mjs';
import { LAUNCHER_URL, issueSetup, sameSetupChoices, setupStatus, buildShortCommand, buildSetupScript, readSetupSession } from './short-setup.mjs';
import { installHandoff, reviewChoices, setupSummary, revealCopyFallback, updateHandoffStep } from './handoff.mjs';
import { PrerequisiteGate, prerequisitesView } from './prerequisites.mjs';
import { bindDistroPicker } from './distro-picker.mjs';
import { preparationFor } from './preparation.mjs';
import { readDraft, writeDraft, canResumeDraft, draftRoute, normalizeRoute, ownsDraftHistory } from './draft.mjs';
import { InstallTracker, CHECK_COMMAND, INSTALLED_STATES } from './install-progress.mjs';
import { isPreviewContext, liveWizardUrl } from './preview.mjs';
import { preserveProgressInteraction } from './progress-interaction.mjs';
import { progressView, waitingView, timingView } from './post-install.mjs';


const IDEAS = {
  ready: { title: 'Just talk.', description: 'An everyday helper. Just add your voice.', x: 0, y: 0, short: 'Ready to chat', result: 'Your everyday sidekick', detail: 'Voice assistant + standard skills' },
  tinker: { title: 'Make it mine.', description: 'The voice engine. Your skills, your experiments.', x: 100, y: 0, short: 'Make it mine', result: 'Your next little experiment', detail: 'Voice engine · add your own skills' },
  hub: { title: 'Link my rooms.', description: 'One hub for your voice satellites. Pair them later.', x: 0, y: 100, short: 'Room-to-room hub', result: 'The brain of your home', detail: 'Headless server · pair satellites later' },
};
const HARDWARE = {
  pi: { title: 'Raspberry Pi', description: 'Small board. Big ambitions.', note: 'Pi 3, 4 or 5 · 64-bit Linux', image: 'pi' },
  computer: { title: 'Laptop or desktop', description: 'Give your computer something to say.', note: 'Windows, Mac or Linux · mini PCs too', x: 100, y: 0 },
  mark1: { title: 'Mycroft Mark I', description: 'The original, with a new voice.', note: '64-bit Debian 13', image: 'mark1' },
  mark2: { title: 'Mycroft Mark II', description: 'Ready for its second act.', note: '64-bit Debian 13 · Pi 4', image: 'mark2' },
  devkit: { title: 'Mycroft DevKit', description: 'Made for the “what if?” crowd.', note: '64-bit Debian 13 · Pi 4', image: 'devkit' },
  jetson: { title: 'Jetson Orin Nano', description: 'A little more under the hood.', note: '64-bit Ubuntu Linux', image: 'jetson' },
  server: { title: 'Home server', description: 'A headless hub for voice devices in other rooms.', note: 'Your own Linux server', x: 100, y: 100 },
};


const languageSuggestion = suggestLanguage(browserLanguages(navigator.languages,navigator.language), LANGUAGES);
let state = { ...DEFAULTS, locale: languageSuggestion.locale };
let confirmedState = { ...state };
let setupSession = null;
let manualCopyFor = null;
let commandCopyAttempt = 0;
let expiryTimer = null;
let step = 'welcome';
let welcomePlayback=null;
let stopWelcomeEyes=null;
let replayWelcome=null;
let welcomeHeard=false;
let welcomeEnvelope=null;
let answered = new Set();
let telemetrySelection = DEFAULTS.telemetry;
let languageChooserOpen = false;
let localeRequest=0;
let trail = [];
let editing = false;
let editSnapshot = null;
let skillsAnswered = false;
let preparedFor=null;
const prerequisiteGate=new PrerequisiteGate();
let editAnswered=[];
let editSkillsAnswered=false;
let editPreparedFor=null;
let navigationId=crypto.randomUUID();
let routes=[];
let routeCursor=-1;
let browserBaseCursor=0;
let stopMotionListener=null;
let detailsOpen = false;
let devicePane = 'cards';
let unlistedDevice = false;
let platformUnsure = false;
let triviaStorage=null;
try{triviaStorage=window.localStorage;}catch{/* Private browsing may block storage. */}
let triviaHistory=readTriviaHistory(triviaStorage);
let currentFact=null;
let transitionTimer = null;
let toastTimer;
const wizard = document.querySelector('#wizard');
const previewOnly=isPreviewContext(location,document.querySelector('meta[name="ovos-preview"]')?.content);

const choiceInput=new ChoiceInputGuard();
bindDistroPicker(wizard,value=>{
  prerequisiteGate.selectFamily(value);render();
  wizard.querySelector('[data-prerequisite-system]')?.focus({preventScroll:true});
});
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let trackingShown=false;
let progressSignature='';
const installTracker=new InstallTracker({onChange:updateInstallProgress});

/** Escape values for HTML and readonly fields. @param {unknown} value @returns {string} */
function escape(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

/** Announce copy/download outcomes without blocking the flow. @param {string} message @returns {void} */
function toast(message) {
  const target = document.querySelector('#toast');
  target.textContent = message; applyTranslations(target,state.locale); target.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { target.hidden = true; }, 5000);
}

/** Produce a complete, secret-free recipe link. @returns {string} */
function shareUrl() { if(previewOnly)return liveWizardUrl(setupSession);return setupSession?.code?`${location.origin}${location.pathname}#setup=${setupSession.code}`:location.href; }

/** Write result choices into the address bar. @param {boolean} replace @returns {void} */
function persist() {
  if(setupSession)history.replaceState(history.state,'',setupSession.code?'#setup='+setupSession.code:'#'+encodePreset(setupSession.state));
  saveJourney();
}

/** Snapshot only route metadata; answers remain the latest accepted choices. @returns {object} */
function currentRoute() {
  return {step,devicePane,unlistedDevice,editing,editSnapshot,editAnswered,editSkillsAnswered,editPreparedFor};
}

/** Save a versioned secret-free draft without changing a command's lifetime. @returns {void} */
function saveJourney() {
  if(routeCursor<0)return;
  routes[routeCursor]=draftRoute(currentRoute());
  writeDraft(triviaStorage,{version:1,id:navigationId,state,confirmedState,routes,cursor:routeCursor,answered:[...answered],skillsAnswered,preparedFor,welcomeHeard,
    issuedFragment:setupSession?.code?'#setup='+setupSession.code:setupSession?'#'+encodePreset(setupSession.state):''});
}

/** Add one real browser-history destination, sharing it with the Back button. @param {boolean} replace Current entry only. @returns {void} */
function recordRoute(replace=false) {
  if(replace&&routeCursor>=0)routes[routeCursor]=draftRoute(currentRoute());
  else {routes=routes.slice(0,routeCursor+1);routes.push(draftRoute(currentRoute()));routeCursor=routes.length-1;}
  const fragment=step==='review'&&setupSession?(setupSession.code?'#setup='+setupSession.code:'#'+encodePreset(setupSession.state)):location.hash;
  history[replace?'replaceState':'pushState']({ovosWizard:{id:navigationId,cursor:routeCursor,base:browserBaseCursor}},'',location.pathname+fragment);
  trail=routes.slice(browserBaseCursor,routeCursor);
  saveJourney();
}

/** Move between device cards and operating systems as real navigation steps. @param {string} pane Device pane. @param {boolean} unlisted Unknown-device route. @returns {void} */
function showDevicePane(pane,unlisted=false) {
  devicePane=pane;unlistedDevice=unlisted;platformUnsure=false;recordRoute();render(true);
}

/** Restore a browser Back/Forward destination while keeping accepted answers. @returns {Promise<void>} */
async function restoreRoute() {
  const marker=history.state?.ovosWizard;
  if(marker?.id!==navigationId||!routes[marker.cursor]){await restore();return;}
  cancelTransition();const request=++localeRequest;
  let route=routes[marker.cursor];
  if(!editing&&route.editing)route={...route,editSnapshot:{...state},editAnswered:[...answered],editSkillsAnswered:skillsAnswered,editPreparedFor:preparedFor};
  if(editing&&!route.editing&&editSnapshot){state={...editSnapshot};answered=new Set(editAnswered);skillsAnswered=editSkillsAnswered;preparedFor=editPreparedFor;}
  routeCursor=marker.cursor;route=normalizeRoute(route,state,!!setupSession&&sameSetupChoices(setupSession,state));
  ({step,devicePane,unlistedDevice,editing,editSnapshot,editAnswered,editSkillsAnswered,editPreparedFor}=route);
  if(!state.device&&!['welcome','language','device','guidance','purpose'].includes(step)){step='device';devicePane='cards';}
  if(step==='review'&&(!setupSession||!sameSetupChoices(setupSession,state)))step=state.device?'speech':'device';
  trail=routes.slice(browserBaseCursor,routeCursor);languageChooserOpen=false;platformUnsure=false;
  try{await loadLocale(state.locale);}catch{toast('Couldn’t load this language. Please try again.');}
  if(request!==localeRequest)return;
  telemetrySelection=state.telemetry;
  confirmedState={...state};recordRoute(true);render(true);
}


/** Render a single activatable illustration card. @param {string} key @param {object} item @param {string} kind @returns {string} */
function card(key, item, kind) {
  const selected=answered.has(kind==='experience'?'purpose':'device') && (kind==='experience'?state.experience===key:key==='computer'?['computer','mac','windows'].includes(state.device):state.device===key);
  const illustration = kind==='experience' ? `<span class="purpose-symbol" aria-hidden="true">${icon({ready:'voice',tinker:'settings',hub:'server'}[key])}</span>` : item.image ? `<img class="art hardware-drawing" src="./assets/hardware-${item.image}.png" alt="" width="240" height="200">` : `<span class="art device-art" style="--x:${item.x}%;--y:${item.y}%" aria-hidden="true"></span>`;
  return `<button class="pick-card ${selected?'selected':''}" data-pick="${kind}" data-value="${key}" aria-pressed="${selected}">${illustration}<span class="card-content"><span class="card-name">${item.title}</span><span class="card-desc">${item.description}${item.note ? `<small class="device-note">${item.note}</small>` : ''}</span><span class="card-plus" aria-hidden="true">${icon(selected?'check':'add')}</span></span></button>`;
}

/** Show the active stage, accepted stages and explicit skipped stages. @returns {void} */
function renderSteps() {
  const navigation=document.querySelector('.steps');navigation.hidden=step==='welcome';
  if(step==='welcome')return;
  const chapter=questionChapter(step);
  const reviewOnly=step==='review'&&trail.length===0&&!(detailsOpen&&!prerequisiteGate.ready(state.device));
  const stages=progressStages(step,state,answered);
  const statusText={current:'Current stage',complete:'Completed',upcoming:'Upcoming',skipped:'Not needed for a hub'};
  document.querySelector('.steps').innerHTML=`<div class="progress-actions"><button class="journey-back" data-back ${canGoBack(step,trail.length,editing,devicePane)?'':'disabled'} >${icon(reviewOnly?'settings':'back')} <span>${reviewOnly?'Edit setup':'Back'}</span></button>${editing?'<button class="text-button" data-cancel-edit>Cancel edit</button>':''}</div><span class="sr-only">Stage ${chapter} of ${stages.length}</span><ol class="chapter-track" aria-label="Setup stages">${stages.map(stage=>`<li class="${stage.status}" ${stage.status==='current'?'aria-current="step"':''}><span class="step-number" aria-hidden="true">${stage.status==='complete'?icon('check'):stage.status==='skipped'?'–':String(stage.number).padStart(2,'0')}</span><div class="step-copy"><strong>${stage.label}</strong><small class="sr-only">${stage.status==='skipped'?'Not needed for a hub':stage.detail}</small></div><span class="sr-only">${statusText[stage.status]}</span></li>`).join('')}</ol>`;
}
/** Render a single clear question and its optional supporting sentence. @param {string} title @param {string} subtitle @returns {string} */
function intro(title, subtitle = '') {
  return `<div class="intro"><h1 id="step-title" tabindex="-1">${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>`;
}
/** Create a playful answer card that advances one decision. @param {string} key @param {string} value @param {string} symbol @param {string} title @param {string} description @param {boolean} selected @param {boolean} disabled @returns {string} */
function answerCard(key, value, symbol, title, description, selected = false, disabled = false) {
  return `<button class="answer-card ${selected?'selected':''}" data-answer="${key}" data-value="${value}" aria-pressed="${selected}" ${disabled?'disabled':''}><span class="answer-symbol" aria-hidden="true">${symbol}</span><strong>${title}</strong><span class="answer-description">${description}</span><span class="answer-tick" aria-hidden="true">${icon(selected?'check':'arrow')}</span></button>`;
}
/** A short, skippable hello from the original Mark I. @returns {string} */
function welcomeView(){
  return `<div class="heritage-welcome"><p class="heritage-kicker">AN OLD FRIEND. A NEW BEGINNING.</p><h1 id="step-title" tabindex="-1">Hello, <em>again.</em></h1><div class="mark1-stage">${markOneFace()}</div><p class="mark1-caption"><span>A little nod to Mycroft Mark I.</span><span class="welcome-credit-divider" aria-hidden="true">·</span><span>Alan Pope · the original Mimic 1 voice</span></p><p class="welcome-quote" lang="en" data-no-translate>“${WELCOME_TEXT}”</p><div class="welcome-actions"><button class="button heritage-start" data-welcome-start>${icon(welcomeHeard?'arrow':'voice')}<span>${welcomeHeard?'Let’s set up OVOS':'Wake up Mark I'}</span></button><button class="welcome-replay" data-welcome-replay ${welcomeHeard?'':'hidden'} aria-label="Hear it again" title="Hear it again">${icon('refresh')}</button><button class="text-button" data-welcome-skip ${welcomeHeard?'hidden':''}>Skip intro</button></div><p class="welcome-linger" ${welcomeHeard?'':'hidden'}>Take your time. He’s happy to see you.</p><p class="sr-only" role="status" data-welcome-status></p><audio data-welcome-audio preload="none" src="./assets/mark1-welcome.mp3"></audio></div>`;
}

/** Bind this screen's local audio and LED animation; never request audio input. @returns {void} */
function mountWelcome(){
  const root=wizard.querySelector('.heritage-welcome');
  const mouth=[...root.querySelectorAll('[data-mouth-led]')];
  const eyes=[...root.querySelectorAll('[data-eye-led]')];
  const start=root.querySelector('[data-welcome-start]');
  const createPlayer=()=>new WelcomePlayback({audio:root.querySelector('audio'),envelope:welcomeEnvelope,reducedMotion:motionQuery.matches,
    onFrame:frame=>frame.forEach((lit,index)=>mouth[index].classList.toggle('lit',lit)),
    onState:status=>{
      root.classList.toggle('is-speaking',status==='playing');
      start.disabled=true;
      start.querySelector('span').textContent=t('Saying hello…',state.locale);
      root.querySelector('[data-welcome-replay]').hidden=true;
      root.querySelector('[data-welcome-skip]').hidden=false;
      root.querySelector('[data-welcome-status]').textContent=status==='playing'?'':t('Getting the hello ready.',state.locale);
    },
    onDone:reason=>{
      if(step!=='welcome')return;
      if(reason==='skip'){go('language');return;}
      welcomeHeard=true;saveJourney();root.classList.remove('is-speaking');start.disabled=false;
      start.innerHTML=`${icon('arrow')}<span>${escape(t('Let’s set up OVOS',state.locale))}</span>`;
      root.querySelector('[data-welcome-replay]').hidden=false;
      root.querySelector('[data-welcome-skip]').hidden=true;
      root.querySelector('.welcome-linger').hidden=false;
      root.querySelector('[data-welcome-status]').textContent=t('Take your time. He’s happy to see you.',state.locale);
      localize();start.focus({preventScroll:true});
      if(reason==='error')toast('Hello! Let’s get your setup ready.');
    }
  });
  welcomePlayback=createPlayer();
  replayWelcome=()=>{
    welcomePlayback.dispose();root.querySelector('audio').currentTime=0;
    welcomePlayback=createPlayer();void welcomePlayback.start();
  };
  const refreshMotion=()=>{
    stopWelcomeEyes?.();welcomePlayback?.setReducedMotion(motionQuery.matches);
    stopWelcomeEyes=animateEyes(levels=>eyes.forEach(led=>{led.style.opacity=String(levels[Number(led.dataset.eyeLed)]);}),{reducedMotion:motionQuery.matches,speaking:()=>welcomePlayback?.playing});
  };
  refreshMotion();motionQuery.addEventListener('change',refreshMotion);
  stopMotionListener=()=>motionQuery.removeEventListener('change',refreshMotion);
}

/** Confirm the suggested language, exposing alternatives only on request. @returns {string} */
function languageView() {
  const source=languageSource(state.locale,languageSuggestion,answered.has('language')&&state.locale===confirmedState.locale);
  return `<div class="intro welcome-intro"><h1 id="step-title" tabindex="-1">First, let’s say <em>hello.</em></h1></div><div class="language-simple"><div class="current-language"><span class="language-globe" aria-hidden="true"><img src="${localeFlag(state.locale)}" alt="" width="42" height="42"></span><div><span class="language-label">Wizard and assistant language</span><strong>${escape(LANGUAGES[state.locale])}</strong><small>${escape(source)}</small></div><button class="text-button" data-change-language aria-expanded="${languageChooserOpen}" aria-controls="language-chooser">${languageChooserOpen?'Close':'Change language'}</button></div>${languageChooserOpen?`<div id="language-chooser" class="language-chooser"><label for="assistant-language">Choose your language</label><select id="assistant-language" data-language-select>${Object.entries(LANGUAGES).map(([locale,label])=>`<option value="${locale}" ${state.locale===locale?'selected':''}>${escape(label)}</option>`).join('')}</select></div>`:'<div id="language-chooser" hidden></div>'}<button class="button welcome-continue" data-confirm-language><span>Continue</span>${icon('arrow')}</button></div>`;
}
/** Ask how much guidance the visitor wants, separately from language. @returns {string} */
function guidanceView() {
  return intro('What’s your <em>setup style?</em>', 'Pick what feels right. You can change it later.')+`<div class="answer-deck guidance-deck">${answerCard('expertise','guided',icon('compass'),'Show me the ropes','Recommend a setup and explain the choices.',state.expertise==='guided')}${answerCard('expertise','tinker',icon('settings'),'Let me tinker','A helpful starting point, with room to make it mine.',state.expertise==='tinker')}${answerCard('expertise','expert',icon('terminal'),'Let’s get technical','Show the advanced controls. Keep my chosen skills.',state.expertise==='expert')}</div>`;
}

/** Ask only what the assistant is for. @returns {string} */
function experienceView() {
  return intro('What’s the <em>plan?</em>', 'An everyday helper, your next experiment, or voices around the house.')+`<div class="deck" aria-label="Choose your experience">${Object.entries(IDEAS).map(([key,item])=>card(key,item,'experience')).join('')}</div>`;
}

/** Show recognizable hardware, or its one-question OS branch. @returns {string} */
function deviceView() {
  if (devicePane === 'platform') return platformView();
  return intro('Where will it <em>live?</em>', 'Choose the device where you want to install OVOS.')+`<div class="deck hardware-deck" aria-label="Choose your device">${[...new Set([...hardwareCardsForExperience(state.experience),'server'])].map(key=>card(key,HARDWARE[key],'device')).join('')}</div><button class="other-device" data-other>Something else? <span>There’s room for the unusual.</span></button>`;
}

/** Help prepare the actual target before promising an install command. @returns {string} */
function preparationView() {
  const prep=preparationFor(state);
  return intro('Ready for <em>OVOS?</em>')+`<section class="preparation-card" aria-labelledby="preparation-device-title"><div class="preparation-art">${deviceIcon(state.device)}</div><div class="preparation-copy"><h2 id="preparation-device-title">${escape(DEVICES[state.device].name)}</h2><div class="preparation-requirement">${icon('chip')}<p>${escape(prep.help)}</p></div><p class="preparation-terminal">${icon('terminal')}<span>${escape(prep.description)}</span></p><div class="preparation-actions"><button class="button" data-prepared><span>${escape(prep.action)}</span>${icon('arrow')}</button><details class="preparation-help"><summary>Need help preparing it?</summary><div><a href="${prep.url}" target="_blank" rel="noopener noreferrer">${prep.link}</a><p>Come back here when you can open its terminal.</p></div></details></div></div></section>`;
}

/** Keep provider details optional while showing meaningful privacy tradeoffs. @returns {string} */
function speechDetails() {
  return `<p class="speech-preview">These speech options are experimental.</p><details class="speech-details"><summary>Technical details &amp; installer defaults</summary><div><p><a href="https://github.com/OpenVoiceOS/ovos-installer/tree/main" target="_blank" rel="noopener noreferrer">The installer uses the latest main branch.</a></p><p>Recognition (STT) and the spoken voice (TTS) are chosen together.</p><p>${escape(speechEligibility(state).reason)}</p><p>Local providers: onnx-asr and phoonnx. Local speech uses a Python environment. Models are downloaded during installation. Performance varies by device.</p><p>Online servers are community-run and may be unavailable. Installer defaults do not guarantee offline speech.</p><button class="text-button" data-answer="speech" data-value="auto" aria-pressed="${state.speech==='auto'}">Let the installer choose</button></div></details>`;
}

/** Present speech choices only after device details, keeping an unavailable option understandable. @returns {string} */
function speechView() {
  const local=localSpeechOption(state);
  return intro('How should OVOS <em>listen and reply?</em>')+`<div class="voice-wrap"><div class="speech-grid">${answerCard('speech','public',icon('globe'),'Use online services','Your voice and reply text go to online services. Needs internet; less work for your device.',state.speech==='public')}${answerCard('speech','local',icon('chip'),'Use my device',escape(local.description),state.speech==='local'&&!local.disabled,local.disabled)}</div>${canExploreLocal(state)?'<button class="text-button check-again" data-check-specs>Change my device details</button>':''}${speechDetails()}</div>`;
}

/** Ask one recognizable hardware question, with a clear exit when the user is unsure. @returns {string} */
function capabilityView() {
  if (step === 'piModel') return intro('Which <em>Raspberry Pi</em> do you have?','Not sure? That’s okay — online speech is still an option.')+`<div class="answer-deck">${answerCard('piModel','pi5',icon('chip'),'Raspberry Pi 5','Also Pi 500 or Compute Module 5.',answered.has('piModel')&&state.piModel==='pi5')}${answerCard('piModel','older',icon('chip'),'Raspberry Pi 3 or 4','Also Pi 400. We’ll suggest online speech.',answered.has('piModel')&&state.piModel==='older')}${answerCard('piModel','unknown',icon('help'),'I’m not sure','Continue without checking the model.',answered.has('piModel')&&state.piModel==='unknown')}</div>`;
  if (step === 'memory') return intro('How much <em>RAM?</em>','Look for RAM in your device’s specifications, or choose “I’m not sure”.')+`<div class="answer-deck">${answerCard('memory','under8',icon('chip'),'Less than 8 GB','We’ll suggest online speech.',answered.has('memory')&&state.memory==='under8')}${answerCard('memory','8plus',icon('chip'),'8 GB or more','Enough to try speech on the device.',answered.has('memory')&&state.memory==='8plus')}${answerCard('memory','unknown',icon('help'),'I’m not sure','Continue with an online recommendation.',answered.has('memory')&&state.memory==='unknown')}</div>`;
  if(state.device==='mac')return intro('Which <em>Mac chip?</em>','Check “About This Mac” in the Apple menu.')+`<div class="answer-deck">${answerCard('cpu','arm64',icon('chip'),'Apple Silicon','An Apple M-series chip.',answered.has('cpu')&&state.cpu==='arm64')}${answerCard('cpu','intel-mac',icon('chip'),'Intel','Not supported by the installer.',answered.has('cpu')&&state.cpu==='intel-mac')}${answerCard('cpu','unknown',icon('help'),'I’m not sure','Check Apple menu → About This Mac before continuing.',answered.has('cpu')&&state.cpu==='unknown')}</div>`;
  return intro('Which <em>processor?</em>','Look in Settings → About or System information. Not sure? That’s fine.')+`<div class="answer-deck">${answerCard('cpu','avx2',icon('chip'),'Intel or AMD computer','Look for Intel Core or AMD Ryzen in the processor name.',answered.has('cpu')&&state.cpu==='avx2')}${answerCard('cpu','arm64',icon('chip'),'ARM-based computer','For example, a Snapdragon-powered PC.',answered.has('cpu')&&state.cpu==='arm64')}${answerCard('cpu','unknown',icon('help'),'I’m not sure','Continue with an online recommendation.',answered.has('cpu')&&state.cpu==='unknown')}</div><p class="under-deck">The installer checks your processor and may use online speech instead.</p><details class="speech-details processor-help"><summary>Processor requirements</summary><div><p>On-device speech needs ARM64 with NEON or an Intel/AMD processor with AVX2. The installer checks your exact model.</p></div></details>`;
}

/** Offer skill customization only when opened from final review. @returns {string} */
function skillsView() {
  const choice = !state.skills?'empty':state.extraSkills?'extras':'standard';
  const hub = state.experience === 'hub';
  return intro('What shall <em>we pack?</em>', 'Pick your starter skills. You can change the lineup later.')+`<div class="answer-deck">${answerCard('skills','standard',icon('widgets'),'The everyday essentials','Essential and internet skills'+(hub?'.':' plus audio skills.')+' Some need internet.',choice==='standard')}${answerCard('skills','extras',icon('sentiment_very_satisfied'),'Plus a few dad jokes','Everyday skills, media skills and dad jokes. Groaning is optional.',choice==='extras',hub&&state.method==='containers')}${answerCard('skills','empty',icon('construction'),'A blank canvas','Just the engine. The rest is your playground.',choice==='empty')}</div>${hub?'<p class="under-deck">A headless hub skips local speech and Home Assistant / AI connections. Room devices are set up separately.</p>':''}`;
}

/** Ask only whether to connect an existing Home Assistant service. @returns {string} */
function homeAssistantView() {
  return intro('Give your home <em>a voice?</em>', 'Introduce OVOS to the Home Assistant server you already run.')+`<div class="answer-deck two">${answerCard('homeassistant','yes',icon('home_assistant'),'Yes, let’s connect it','I already run Home Assistant. Ask for my server details in the device terminal.',state.homeassistant)}${answerCard('homeassistant','no',icon('schedule'),'Maybe later','My home can wait. On with the setup.',!state.homeassistant)}</div><p class="under-deck">This connects Home Assistant; it doesn’t install it. Tokens stay out of your setup link.</p>`;
}

/** Ask only which optional AI connection to use. @returns {string} */
function aiView() {
  return intro('Fancy a chat <em>with AI?</em>', 'Optional open-ended answers when skills can’t help. AI can be wrong.')+`<div class="answer-deck">${answerCard('llmMode','off',icon('widgets'),'Skills are enough','No model server or AI account needed.',state.llmMode==='off')}${answerCard('llmMode','local',icon('server'),'My model server',localModelGuidance(state),state.llmMode==='local')}${answerCard('llmMode','online',icon('cloud'),'An online provider','Prompts go to your chosen provider. Internet, an account and usage charges may apply.',state.llmMode==='online')}</div><p class="under-deck">To add AI, use an existing OpenAI-compatible service. The terminal asks for its URL, model and key. No model is installed for you.</p>`;
}

/** Edit one optional technical setting at a time. @returns {string} */
function tweakView() {
  return intro('How shall we <em>build it?</em>')+`<div class="answer-deck two">${answerCard('method','virtualenv',icon('python'),'Python environment','The guided default.',state.method==='virtualenv')}${answerCard('method','containers',icon('docker'),'Containers','For users comfortable with containers and their host setup.',state.method==='containers')}</div>`;
}
/** Ask for optional installation diagnostics before allowing installation exports. @returns {string} */
function telemetryView() {
  return `<div class="ready-wrap telemetry-step">${intro('Help improve <em>OVOS.</em>','Help us focus on the devices and systems you use.')}
    <section data-install-progress hidden aria-label="Installation progress"></section>
    <div class="install-card telemetry-panel">
      <div class="telemetry-card">
        <label class="telemetry-choice">
          <span class="telemetry-symbol" aria-hidden="true">${icon('favorite')}</span>
          <span class="telemetry-copy"><strong id="telemetry-label">Share setup statistics</strong><span id="telemetry-optional">Optional. Share device, system and installation details.</span></span>
          <span class="telemetry-control"><span data-telemetry-state aria-hidden="true">${telemetrySelection?'On':'Off'}</span><span class="telemetry-switch"><input type="checkbox" role="switch" data-telemetry-confirm aria-labelledby="telemetry-label" aria-describedby="telemetry-optional" ${telemetrySelection?'checked':''}><span class="telemetry-track" aria-hidden="true"></span></span></span>
        </label>
        <div class="telemetry-links"><a class="telemetry-dashboard" href="https://telemetry.smartgic.io/ovos-installer/dashboard/" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>View installation statistics</span>${icon('arrow')}</a><a class="telemetry-details" href="https://github.com/OpenVoiceOS/ovos-installer/blob/main/docs/telemetry.md" target="_blank" rel="noopener noreferrer">What is shared?${icon('arrow')}</a></div>
      </div>
      <button type="button" class="button telemetry-continue" data-telemetry-continue>Continue ${icon('arrow')}</button>
    </div></div>`;
}

/** Commit the visitor's toggle choice before issuing their install recipe. @returns {void} */
function confirmTelemetry() {
  if(!['telemetry','review'].includes(step))return;
  state={...state,telemetry:telemetrySelection===true};
  answered.add('telemetry');
  finish();
}

/** Ask for the target OS, never infer it from the browser used to configure. @returns {string} */
function platformView() {
  const choices = [['windows', 'Windows', 'Ubuntu on Windows, through WSL2', 'windows'], ['mac', 'macOS', 'Apple Silicon · macOS 15+', 'apple'], ['linux', 'Linux', 'Desktop, mini PC or virtual machine', 'linux'], ['unknown', 'Something else', 'Or I’m not sure yet', null]];
  return `<div class="breadcrumb"><button data-device-cards>All devices</button></div><div class="intro"><h1 id="step-title" tabindex="-1">What’s it <em>running?</em></h1><p>${unlistedDevice ? 'Every device starts somewhere. Let’s find yours.' : 'Windows, Mac or Linux. There’s a way in.'}</p></div><div class="platform-grid">${choices.map(([key, title, description, symbol]) => {
    const selected=answered.has('device') && key!=='unknown' && platformTarget(key,unlistedDevice)===state.device;
    return `<button class="platform-card ${selected?'selected':''}" data-platform="${key}" aria-pressed="${selected}"><span class="platform-symbol" aria-hidden="true">${symbol?`<img src="./assets/platform/${symbol}.svg" alt="" width="40" height="40">`:icon('help')}</span><div class="platform-copy"><strong>${title}</strong><span>${description}</span></div><span class="platform-arrow" aria-hidden="true">${icon(selected?'check':'arrow')}</span></button>`;
  }).join('')}</div>${platformUnsure?'<p id="platform-note" class="platform-note" tabindex="-1" role="status">OVOS runs on Linux or macOS. Windows uses Ubuntu in WSL2. Choose the system on your OVOS device; if it uses another OS, it will need a supported Linux installation first.</p>':''}<p class="under-deck">Choose the system on your OVOS device.</p>`;
}

/** Keep help, alternate exports and technical controls available on request. @returns {string} */
function detailsView() {
  const handoff=installHandoff(state);
  return `<details class="install-help advanced-install" ${state.expertise==='expert'?'open':''}><summary>Advanced settings${icon('expand_more')}</summary><div class="details-body"><div class="tweak-list"><button data-edit="guidance">Setup style <strong>${state.expertise==='expert'?'Advanced':state.expertise==='tinker'?'Tinker':'Guided'}</strong></button><button data-edit="method" ${usesVirtualenvPreset(state.device)||state.speech==='local'?'disabled':''}>Installation <strong>${state.method==='virtualenv'?'Python environment':'Containers'}</strong></button><button data-edit="telemetry">Installer diagnostics <strong>${state.telemetry?'Shared':'Off'}</strong></button></div><p class="details-note">${handoff.requirement} ${handoff.audio} ${handoff.integrations}</p><button class="text-button" data-edit="prepare">Help prepare my device</button><p class="details-note">Run as your normal user. Internet, git, curl and sudo are needed; installation may reboot.</p><p class="setup-code-help" data-prerequisite-required ${!prerequisiteGate.ready(state.device)?'hidden':''}>Setup code ${setupSession?.code?`<code>${escape(setupSession.code)}</code>`:'<span>Copy new command</span>'}</p><div class="alternate-exports" data-prerequisite-required ${!prerequisiteGate.ready(state.device)?'hidden':''}><button class="text-button" data-download="script" ${previewOnly||!prerequisiteGate.ready(state.device)?'disabled':''}>Download install script</button></div><div class="tertiary-actions"><button class="text-button" data-download="yaml">Download scenario.yaml</button><a class="text-button" href="${LAUNCHER_URL}" target="_blank" rel="noopener noreferrer">View installer source</a></div><p class="details-note" data-prerequisite-required ${!prerequisiteGate.ready(state.device)?'hidden':''}>The downloaded script uses the same online launcher as the copied command.</p></div></details>`;
}

/** Keep the preparation decision separate from every executable export. @returns {string} */
function prerequisitePageView() {
  return `<div class="ready-wrap preparation-required">${previewOnly?`<aside class="preview-notice" role="note"><strong>Preview only — no installation will run.</strong><a class="button button-secondary" href="${escape(liveWizardUrl(setupSession))}">Open the live wizard</a></aside>`:''}${intro('Before you install')}
    <section data-install-progress hidden aria-label="Installation progress"></section>
    <div class="install-card preparation-gate"><div class="preparation-gate-target">${deviceIcon(state.device)}<strong>${DEVICES[state.device].name}</strong></div>${prerequisitesView(state,prerequisiteGate,previewOnly)}<p class="copy-status sr-only" role="status" aria-live="polite" data-copy-status></p></div></div>`;
}

/** Require the explicit acknowledgement and Continue action before handing over a command. @returns {void} */
function continueToInstall() {
  if(step!=='review'||!prerequisiteGate.accept(state.device))return;
  if(!answered.has('telemetry')){go('telemetry');return;}
  finish();
}

/** Reopen preparation and invalidate acknowledgement before changing the target OS. @returns {void} */
function reviewPrerequisites() {
  if(step!=='review')return;
  detailsOpen=false;prerequisiteGate.confirm(false);render(true);
}

/** Render the full editable recipe without granting installer access.
 * @param {boolean} overview Render an open settings page rather than a disclosure.
 * @returns {string} Editable choices and gated advanced options.
 */
function reviewOptionsView(overview=false) {
  const choices=reviewChoices(state);
  const optional=choices.filter(choice=>(choice.target==='homeassistant'&&!state.homeassistant)||(choice.target==='llm'&&state.llmMode==='off'));
  const visible=choices.filter(choice=>choice.target!=='guidance'&&!optional.includes(choice));
  return `    <${overview?'section':'details'} class="details install-options" ${!overview&&detailsOpen?'open':''}>
      ${overview?'':`<summary><span>Your setup <small>View or edit</small></span>${icon('expand_more')}</summary>`}
      <div class="review-choices">${visible.map(choice=>`<button class="review-choice" data-edit="${choice.target}" aria-label="Edit ${choice.label}: ${escape(choice.value)}"><span class="review-choice-icon" aria-hidden="true">${icon(choice.icon)}</span><span><span class="review-choice-label">${choice.label}</span><strong>${escape(choice.value)}</strong></span></button>`).join('')}</div>
      ${optional.length?`<div class="review-additions">${optional.map(choice=>`<button data-edit="${choice.target}">${choice.target==='homeassistant'?'Add Home Assistant':'Add AI'}</button>`).join('')}</div>`:''}
      ${detailsView()}
    </${overview?'section':'details'}>`;
}

/** Expose every saved choice before preparation, without exporting an installer.
 * @returns {string} Setup editor with an explicit return to preparation.
 */
function setupEditorView() {
  return `<div class="ready-wrap setup-editor">${intro('Your setup')}${reviewOptionsView(true)}<button type="button" class="button" data-review-prerequisites>Continue</button></div>`;
}

/** Put the next action first and keep the complete editable recipe one click away. @returns {string} */
function resultView() {
  prerequisiteGate.selectDevice(state.device,state.cpu);
  if(!prerequisiteGate.ready(state.device))return detailsOpen?setupEditorView():prerequisitePageView();
  if(!answered.has('telemetry'))return telemetryView();
  return `<div class="ready-wrap">${previewOnly?`<aside class="preview-notice" role="note"><strong>Preview only — no installation will run.</strong><a class="button button-secondary" href="${escape(liveWizardUrl(setupSession))}">Open the live wizard</a></aside>`:''}${intro('Install <em>OVOS.</em>')}
    <section data-install-progress hidden aria-label="Installation progress"></section>
    <div class="install-card">
      <div class="install-target install-target-summary"><button type="button" class="setup-device" data-edit="device" aria-label="Edit Device: ${escape(DEVICES[state.device].name)}">${deviceIcon(state.device)}<span class="setup-device-copy"><strong>${DEVICES[state.device].name}</strong><span>${LANGUAGES[state.locale]}</span></span></button><button type="button" class="preparation-status" data-review-prerequisites aria-labelledby="preparation-state preparation-review-label" title="Review preparation">${icon('check')}<span id="preparation-state">Tools confirmed</span><span class="sr-only" id="preparation-review-label">Review preparation</span></button></div>
      <ul class="setup-icon-summary" role="list" aria-label="Your setup">${setupSummary(state).filter(choice=>choice.target!=='device').map(choice=>`<li><button class="setup-summary-icon" type="button" data-edit="${choice.target}" aria-label="Edit ${choice.label}: ${escape(choice.value)}"><span class="setup-feature-icon" aria-hidden="true">${icon(choice.icon)}</span><span class="setup-feature-label"><span class="setup-feature-kind">${choice.label}</span><strong>${escape(choice.value)}</strong></span></button></li>`).join('')}</ul>
      ${usesRaspberryPiTuning(state.device)?'<p class="setup-tuning-note">Raspberry Pi tuning is included.</p>':''}
      <ol class="handoff-actions" data-prerequisite-required ${!prerequisiteGate.ready(state.device)?'hidden':''}>
        <li data-handoff-step="copy" ${prerequisiteGate.ready(state.device)?'aria-current="step"':''}><span class="handoff-number" aria-hidden="true"><span>1</span>${icon('check')}</span><div class="handoff-action-body">
          <button class="button install-copy" data-install-action ${previewOnly||!prerequisiteGate.ready(state.device)?'disabled':''}>${icon('copy')}<span>Copy install command</span></button><span class="code-expiry" data-code-expiry role="status" data-prerequisite-required></span>
          <div class="command-fallback" ${manualCopyReady()?'':'hidden'}><label class="sr-only" for="install-command">Your one-line install command</label><textarea class="command" id="install-command" readonly spellcheck="false" rows="3" data-no-translate>${manualCopyReady()?escape(buildShortCommand(setupSession,undefined,launchToken())):''}</textarea></div>
        </div></li>
        <li data-handoff-step="paste"><span class="handoff-number" aria-hidden="true">2</span><div class="handoff-action-body paste-step"><strong>Paste on your device</strong><p data-paste-title>${state.device==='windows'?'Open Ubuntu in WSL2, paste and press Enter.':`Open Terminal on your ${DEVICES[state.device].name}, paste and press Enter.`}</p></div></li>
      </ol>
      <section data-install-waiting hidden aria-label="Installation progress"></section>
      <details class="install-help-short handoff-help"><summary>Installation help</summary>
        <div data-prerequisite-required ${!prerequisiteGate.ready(state.device)?'hidden':''}><p>${state.device==='windows'?'Open Ubuntu in WSL2 on your Windows PC, then paste the command. Use Ubuntu, not PowerShell.':`Open Terminal on your ${DEVICES[state.device].name}. If it has no screen, connect to it with SSH from another computer, then paste the command there.`}</p>
        <p>Press Enter and follow the installer. It checks the device before setting things up.</p><p>Run the install command as your normal user, without adding sudo.</p></div>
        <div class="handoff-share"><p>Using another computer? Open your setup link there.</p><button class="text-button" data-copy="link">${icon('link')}<span>Copy setup link</span></button><div class="link-fallback" hidden><label class="code-label" for="share-link">Your setup link</label><input id="share-link" value="${escape(shareUrl())}" readonly></div></div>
        <div data-prerequisite-required ${!prerequisiteGate.ready(state.device)?'hidden':''}><h3>After a restart</h3><p>Open Terminal on your device and run this check. It checks services and helps you test your voice.</p><label class="sr-only" for="check-command">After a restart</label><textarea id="check-command" class="command check-command" readonly spellcheck="false" rows="2" data-no-translate>sh &quot;$HOME/.config/ovos-installer/check-setup.sh&quot;</textarea></div>
        <p class="details-note progress-privacy" data-progress-privacy hidden>Installation progress and report links are shown here for 24 hours.</p>
        <a class="text-button" href="${LAUNCHER_URL}" target="_blank" rel="noopener noreferrer">View installer source</a>
      </details>
      <p class="copy-status sr-only" role="status" aria-live="polite" data-copy-status></p>
    </div>
    ${reviewOptionsView()}
  </div>`;
}

/** Show one short, sourced project fact without changing the recipe.
 * @returns {string} Secondary trivia below the active question.
 */
function projectTriviaView() {
  const fact = currentFact;
  return `<aside class="project-fact" role="note" aria-label="OVOS trivia"><span class="fact-stamp" aria-hidden="true" data-no-translate><span>OVOS</span><strong>TRIVIA</strong></span><p><span data-fact-text aria-live="polite" aria-atomic="true">${escape(fact.text)}</span> <a href="${escape(fact.source)}" title="${escape(fact.sourceLabel)}" target="_blank" rel="noopener noreferrer">Backstory</a></p><button class="fact-next" data-next-trivia aria-label="Show another OVOS fact" title="Another little discovery">${icon('refresh')}</button></aside>`;
}

/** Draw one fact without changing the question or its focus. @returns {void} */
function drawTrivia() {
  const next=nextTrivia(triviaHistory);currentFact=next.fact;triviaHistory=next.history;
  try{triviaStorage?.setItem('ovos.trivia.v1',JSON.stringify(triviaHistory));}catch{/* Keep the in-memory deck usable. */}
}

/** Render the active question and focus its visible selected choice after navigation. @param {boolean} focus @returns {void} */
function render(focus = false) {
  if(manualCopyFor!==setupSession?.code)manualCopyFor=null;
  installTracker.stop();progressSignature='';
  localeRequest+=1;
  document.querySelector('main').inert=false;document.querySelector('main').removeAttribute('aria-busy');
  cancelTransition();
  stopWelcomeEyes?.();stopWelcomeEyes=null;stopMotionListener?.();stopMotionListener=null;replayWelcome=null;
  welcomePlayback?.dispose();welcomePlayback=null;
  choiceInput.nextScreen();
  if(step!=='welcome'&&(!currentFact||focus))drawTrivia();
  const views = {welcome:welcomeView,language:languageView,guidance:guidanceView,purpose:experienceView,device:deviceView,prepare:preparationView,speech:speechView,skills:skillsView,homeassistant:homeAssistantView,llm:aiView,review:resultView,memory:capabilityView,cpu:capabilityView,piModel:capabilityView,method:tweakView,telemetry:telemetryView};
  renderSteps();
  wizard.innerHTML = `<div class="screen ${focus?'entering':''}" data-question="${step}">${views[step]()}${step==='welcome'||(step==='review'&&!prerequisiteGate.ready(state.device))?'':projectTriviaView()}</div>`;
  document.querySelector('.workbench').dataset.question=step;
  updateExpiry();
  localize();
  if(step==='review'&&setupSession?.code){
    if(installTracker.code!==setupSession.code)trackingShown=false;
    void installTracker.connect(setupSession.code).then(()=>updateInstallProgress());
  }
  if(step==='welcome')mountWelcome();
  if (focus) { focusCurrentChoice(wizard); window.scrollTo({top:0,behavior:'instant'}); }
  saveJourney();
}

/** Apply the selected locale to chrome, active question, feedback and page metadata. @returns {void} */
function localize(){
  document.documentElement.lang=uiLocale(state.locale);
  document.documentElement.dir='ltr';
  document.title=t('Your voice. Your way. · OpenVoiceOS',state.locale);
  applyTranslations(document.body,state.locale);
}

/** Stop an old card reaction when the user navigates elsewhere. @returns {void} */
function cancelTransition() { clearTimeout(transitionTimer); transitionTimer = null; }

/** Retain the actual visited questions so optional branches go back correctly. @param {string} target @returns {void} */
function go(target) {
  const changed=step!==target;
  step=target;if(target!=='device')devicePane='cards';
  if(target==='telemetry')telemetrySelection=state.telemetry;
  recordRoute(!changed);render(true);
}

/** Finish a valid recipe and preserve complete old/new shared-link behavior. @returns {void} */
function finish() {
  state = validateState({...state,channel:'alpha'}); confirmedState={...state}; editing = false; editSnapshot = null; detailsOpen = state.expertise==='expert';
  if(!sameSetupChoices(setupSession,state)){
    try{setupSession=issueSetup(state);}
    catch{setupSession={state:{...state},code:null,version:0,issuedAt:null,expiresAt:null};}
  }
  go('review');

}

/** Complete one answer, returning directly to review during targeted edits. @returns {void} */
function complete() {
  if(step==='language')languageChooserOpen=false;
  confirmedState={...state};
  answered.add(step);
  if (editing) {
    if (step === 'purpose') {
      if (!state.device) { go('device'); return; }
      if (editSnapshot?.experience==='hub'&&state.experience!=='hub') { answered.delete('speech'); go(firstCapability(state)); return; }
    }
    finish(); return;
  }
  const target = nextQuestion(step, state);
  if (target === 'review') finish(); else go(target);
}

/** Animate an answer briefly, respecting reduced motion and preventing double advancement. @param {HTMLElement} button @param {Function} action @returns {void} */
function react(button, action) {
  if (transitionTimer !== null) return;
  button.classList.add('chosen');
  transitionTimer = setTimeout(() => {
    transitionTimer=null; action();

  }, motionQuery.matches?0:180);
}
/** Accept hardware and ask only the details needed to enable on-device speech.
 * @param {string} device Selected device. @returns {void}
 */
function acceptDevice(device) {
  if(device==='server'&&state.experience!=='hub')state=chooseExperience(state,'hub',skillsAnswered);
  const next=chooseHardware(state,device);
  if(state.device!==device){for(const key of ['speech','memory','cpu','piModel','prepare'])answered.delete(key);preparedFor=null;}
  state=next;confirmedState={...state};answered.add('device');
  if(preparedFor!==device)go('prepare');
  else if(state.experience==='hub'){if(editing)finish();else go('telemetry');}
  else go(nextQuestion('prepare',state));
}

/** Apply the current card answer without accepting arbitrary secret values. @param {string} key @param {string} value @returns {void} */
function answer(key, value) {
  if (['memory','cpu','piModel'].includes(key)) {
    state=chooseCapability(state,key,value); answered.add(key);
    if (state.speech==='local'&&!speechEligibility(state).eligible) { state=chooseSpeech(state,'auto'); answered.delete('speech'); }
    const next=afterCapability(key,state);
    go(next);
    return;
  }
  if (key==='speech') {
    if (value==='local'&&localSpeechOption(state).disabled) return;
    state=chooseSpeech(state,value); complete(); return;
  }
  if (key==='expertise') {
    state={...state,expertise:value};
    complete(); return;
  }
  if (key==='skills') { state.skills=value!=='empty'; state.extraSkills=value==='extras'; skillsAnswered=true; complete(); return; }
  if (key==='homeassistant') { state.homeassistant=value==='yes'; complete(); return; }
  if (key==='llmMode') { state.llmMode=value; complete(); return; }
  if (key==='method') {
    if(usesVirtualenvPreset(state.device)||state.speech==='local')return;
    state={...state,method:value};
    if(state.experience==='hub'&&state.method==='containers')state.extraSkills=false;
    finish();
  }
}

/** Restore the question trail without rolling back the user's valid answers. @returns {void} */
function back() {
  cancelTransition();
  if(routeCursor>browserBaseCursor){history.back();return;}
  if(editing){cancelEdit();return;}
  if(step==='review'&&!prerequisiteGate.ready(state.device)){detailsOpen=!detailsOpen;render(true);return;}
  if(step==='review'){
    const panel=document.querySelector('.install-options');
    if(!panel)return;
    detailsOpen=true;panel.open=true;panel.querySelector('summary').focus();
    panel.scrollIntoView({block:'nearest',behavior:'instant'});
  }
}

/** Open one optional setting with an exact cancellation baseline. @param {string} target Setting. @returns {void} */
function editQuestion(target) {
  if(target==='channel')return;
  cancelTransition();editSnapshot={...state};editAnswered=[...answered];editSkillsAnswered=skillsAnswered;editPreparedFor=preparedFor;editing=true;devicePane='cards';go(target);
}

/** Return to the greeting without committing unfinished edits. @returns {void} */
function returnToWelcome() {
  cancelTransition();
  if(editing&&editSnapshot){
    state={...editSnapshot};answered=new Set(editAnswered);skillsAnswered=editSkillsAnswered;preparedFor=editPreparedFor;confirmedState={...state};
  }
  if(installTracker.code===setupSession?.code&&INSTALLED_STATES.includes(installTracker.session?.status)){restartWizard('welcome');return;}
  editing=false;editSnapshot=null;languageChooserOpen=false;go('welcome');
}

/** Start a separate installation journey with the previous choices available for review.
 * The old URL/record stays intact; this never copies or executes a command.
 * @param {string} target Initial language screen, or greeting from the home link. @returns {void}
 */
function restartWizard(target='language') {
  if(installTracker.code!==setupSession?.code||!INSTALLED_STATES.includes(installTracker.session?.status))return;
  if(!['language','welcome'].includes(target))return;
  if(setupStatus(setupSession).kind==='clock'){toast('Check your clock, then try again.');return;}
  let fresh;
  try{fresh=issueSetup({...setupSession.state,channel:'alpha',telemetry:DEFAULTS.telemetry});}catch{toast('Check your clock, then try again.');return;}
  if(fresh.code===setupSession.code){toast('Please wait a second, then try again.');return;}
  cancelTransition();clearTimeout(expiryTimer);expiryTimer=null;installTracker.reset();
  state={...fresh.state};confirmedState={...state};setupSession=fresh;
  prerequisiteGate.confirm(false);trackingShown=false;progressSignature='';
  answered=new Set();telemetrySelection=DEFAULTS.telemetry;preparedFor=null;skillsAnswered=true;
  editing=false;editSnapshot=null;editAnswered=[];editSkillsAnswered=false;editPreparedFor=null;
  languageChooserOpen=false;detailsOpen=false;devicePane='cards';unlistedDevice=false;platformUnsure=false;
  navigationId=crypto.randomUUID();routes=[];routeCursor=-1;browserBaseCursor=0;trail=[];step=target;
  history.pushState(null,'',location.pathname+'#setup='+fresh.code);
  recordRoute(true);render(true);
}

/** Cancel a targeted edit and recover its complete previously reviewed recipe. @returns {void} */
function cancelEdit() {
  if(editSnapshot)state={...editSnapshot};
  answered=new Set(editAnswered);skillsAnswered=editSkillsAnswered;preparedFor=editPreparedFor;confirmedState={...state};
  editing=false;editSnapshot=null;step='review';detailsOpen=true;recordRoute();render(true);
  toast('Changes cancelled. Your saved recipe is unchanged.');
}

/** Load a shared preset atomically before exposing its review controls. @returns {Promise<void>} */
async function restore() {
  cancelTransition();const request=++localeRequest;
  const main=document.querySelector('main'),notice=document.querySelector('#notice');
  main.inert=true;main.setAttribute('aria-busy','true');
  let restoredSession=null,restoredState={...DEFAULTS,locale:languageSuggestion.locale},restoredStep='welcome',message='';
  const draft=readDraft(triviaStorage),marker=history.state?.ovosWizard;
  const owns=ownsDraftHistory(draft,marker);
  const resume=canResumeDraft(draft,marker,location.hash);
  try{
    restoredSession=readSetupSession(resume?draft.issuedFragment:location.hash);
    if(resume){restoredState={...draft.state};restoredStep=draft.routes[owns?marker.cursor:draft.cursor].step;}
    else if(restoredSession){restoredState={...restoredSession.state};restoredStep='review';}
  }catch(error){
    restoredStep='language';message=/future|clock|time/i.test(error.message)?'Check your clock, then reopen this setup link.':'That link needs a fresh start. Let’s make a new recipe.';
  }
  try{await loadLocale(restoredState.locale);}catch{message='Couldn’t load this language. Please try again.';}
  if(request!==localeRequest)return;
  if(setupSession?.code!==restoredSession?.code)prerequisiteGate.confirm(false);
  setupSession=restoredSession;state=restoredState;step=restoredStep;
  notice.textContent=message;notice.hidden=!message;
  languageChooserOpen=false;detailsOpen=false;platformUnsure=false;
  if(resume){
    navigationId=draft.id;routes=draft.routes;routeCursor=owns?marker.cursor:draft.cursor;
    browserBaseCursor=owns&&Number.isInteger(marker.base)?Math.max(0,Math.min(marker.cursor,marker.base)):0;
    if(!owns){
      routes=routes.slice(0,routeCursor+1);
      for(let cursor=0;cursor<=routeCursor;cursor++)history[cursor===0?'replaceState':'pushState']({ovosWizard:{id:navigationId,cursor,base:0}},'',location.pathname+location.hash);
    }
    ({step,devicePane,unlistedDevice,editing,editSnapshot,editAnswered,editSkillsAnswered,editPreparedFor}=normalizeRoute(routes[routeCursor],state,!!setupSession&&sameSetupChoices(setupSession,state)));
    answered=new Set(draft.answered);skillsAnswered=draft.skillsAnswered;preparedFor=draft.preparedFor;welcomeHeard=draft.welcomeHeard;confirmedState={...draft.confirmedState};
  }else{
    navigationId=crypto.randomUUID();routes=[];routeCursor=-1;browserBaseCursor=0;trail=[];
    confirmedState={...state};welcomeHeard=false;skillsAnswered=!!restoredSession;preparedFor=restoredSession?state.device:null;
    answered=new Set(restoredSession?[...RECIPE_QUESTIONS,'prepare','memory','cpu','piModel']:[]);
    editing=false;editSnapshot=null;editAnswered=[];editSkillsAnswered=false;devicePane='cards';unlistedDevice=false;
  }
  telemetrySelection=state.telemetry;
  recordRoute(true);main.inert=false;main.removeAttribute('aria-busy');render();
}
/** Keep visible expiry current without rerendering choices, trivia or focus. @returns {void} */
function updateExpiry() {
  clearTimeout(expiryTimer);
  if(step!=='review')return;
  const next=wizard.querySelector('[data-prerequisite-continue]');
  if(next)next.disabled=!prerequisiteGate.canContinue(state.device);
  const ack=wizard.querySelector('.prerequisite-ack');
  if(ack)ack.classList.toggle('acknowledged',prerequisiteGate.confirmed);
  const button=wizard.querySelector('[data-install-action]');
  if(!button)return;
  const now=Math.floor(Date.now()/1000);
  const status=setupStatus(setupSession,now);
  const retryInstall=installTracker.code===setupSession?.code&&['failed','cancelled'].includes(installTracker.session?.status);
  const active=status.kind==='active'&&!retryInstall;
  button.disabled=previewOnly||!prerequisiteGate.ready(state.device)||status.kind==='clock';
  const script=wizard.querySelector('[data-download="script"]');if(script)script.disabled=button.disabled;
  for(const region of wizard.querySelectorAll('[data-prerequisite-required]'))region.hidden=!prerequisiteGate.ready(state.device);
  const hint=wizard.querySelector('[data-prerequisite-unlock]');if(hint)hint.hidden=prerequisiteGate.ready(state.device);
  button.dataset.installAction=active?'copy':'renew';
  if(!active){
    manualCopyFor=null;
    button.classList.remove('copied');button.innerHTML=`${icon('refresh')}<span>Copy new command</span>`;
    wizard.querySelector('[data-paste-title]').textContent=status.kind==='clock'?'Check your device clock':'First, copy a new command';

    wizard.querySelector('[data-copy-status]').textContent='';
  }
  else if(!button.classList.contains('copied')){
    button.innerHTML=`${icon('copy')}<span>Copy install command</span>`;
    wizard.querySelector('[data-paste-title]').textContent=state.device==='windows'?'Open Ubuntu in WSL2, paste and press Enter.':`Open Terminal on your ${DEVICES[state.device].name}, paste and press Enter.`;
  }
  wizard.querySelector('[data-code-expiry]').textContent=retryInstall?'Copy a new command to continue. Your choices are saved.':status.message;
  updateManualCopy();
  updateHandoffStep(wizard,active&&button.classList.contains('copied'),prerequisiteGate.ready(state.device));
  applyTranslations(wizard,state.locale);
  if(active){
    expiryTimer=setTimeout(updateExpiry,Math.max(1,Math.min(60000,setupSession.expiresAt*1000-Date.now())));
  }
}

/** Use only the currently bound recipe's short launch capability. @returns {string|null} */
function launchToken() {
  return installTracker.code===setupSession?.code?installTracker.session?.launchToken||null:null;
}

/** Reveal the current command only when automatic copying failed. @returns {boolean} */
function manualCopyReady() {
  return !previewOnly&&!!setupSession?.code&&manualCopyFor===setupSession.code&&
    prerequisiteGate.ready(state.device)&&!!launchToken()&&setupStatus(setupSession).kind==='active'&&
    !['failed','cancelled'].includes(installTracker.session?.status);
}

/** Keep manual copying in sync with the attempt, prerequisite gate and expiry. @returns {void} */
function updateManualCopy() {
  const visible=manualCopyReady();
  const manual=wizard.querySelector('.command-fallback');
  if(manual)manual.hidden=!visible;
  const field=wizard.querySelector('#install-command');
  if(field)field.value=visible?buildShortCommand(setupSession,Math.floor(Date.now()/1000),launchToken()):'';
}

/** Replace just the status region when a milestone changes; leave focus intact. @returns {void} */
function updateInstallProgress() {
  if(step!=='review'||installTracker.code!==setupSession?.code)return;
  const region=wizard.querySelector('[data-install-progress]');if(!region)return;
  const restoreInteraction=preserveProgressInteraction(wizard,document.querySelector('.steps'));
  const model=installTracker.snapshot();
  if(model.session&&model.session.status!=='waiting')trackingShown=true;
  const waiting=wizard.querySelector('[data-install-waiting]');
  const pending=!model.session||model.session.status==='waiting';
  region.hidden=!trackingShown||pending;
  const intro=wizard.querySelector('.ready-wrap>.intro');if(intro)intro.hidden=!region.hidden;
  if(waiting)waiting.hidden=!trackingShown||!pending;
  const started=!!model.session&&model.session.status!=='waiting';
  const stopped=['failed','cancelled'].includes(model.session?.status);
  const trivia=wizard.querySelector('.project-fact');if(trivia)trivia.hidden=stopped;
  const setup=wizard.querySelector('.install-options');if(setup)setup.hidden=started;
  const setupNav=document.querySelector('.steps');if(setupNav)setupNav.hidden=started;
  const signature=JSON.stringify([state.locale,model.session?.status,model.session?.phase,model.session?.progressRank,model.session?.attention,model.session?.installedAt,model.session?.errorUrl,model.error]);
  if(signature!==progressSignature){
    region.innerHTML=pending?'':progressView(model,state,{preview:previewOnly,prerequisitesReady:prerequisiteGate.ready(state.device)});
    if(waiting){waiting.innerHTML=pending?waitingView(model):'';applyTranslations(waiting,state.locale);}
    progressSignature=signature;applyTranslations(region,state.locale);
  }
  const timing=region.querySelector('[data-install-timing]');
  if(timing){timing.innerHTML=timingView(model);applyTranslations(timing,state.locale);}
  const installed=INSTALLED_STATES.includes(model.session?.status);
  const card=wizard.querySelector('.install-card');if(card)card.hidden=started;
  if(started){wizard.querySelector('#step-title').textContent=t(stopped?(model.session.status==='failed'?'Installation stopped':'Installation cancelled'):installed?'OVOS is installed':'Installing OVOS',state.locale);}
  updateManualCopy();
  const note=wizard.querySelector('[data-progress-privacy]');
  if(note)note.hidden=!launchToken();
  if(['failed','cancelled'].includes(model.session?.status))updateExpiry();
  restoreInteraction();
}

/** Start a separate attempt only after the installer confirms it has stopped.
 * Keeps the recipe while creating a fresh one-hour command; never runs it here.
 * @returns {Promise<void>}
 */
async function retryInstallation() {
  if(previewOnly){toast('Preview only — no installation will run.');return;}
  if(step!=='review'||installTracker.code!==setupSession?.code||!['failed','cancelled'].includes(installTracker.session?.status))return;
  const status=setupStatus(setupSession);
  if(status.kind==='clock'){toast(status.message);return;}
  if(!answered.has('telemetry')){go('telemetry');return;}
  state={...state,channel:'alpha'};
  const fresh=issueSetup(state);
  if(fresh.code===setupSession.code){toast('Please wait a second, then try again.');return;}
  setupSession=fresh;persist();render();
  if(!prerequisiteGate.ready(state.device)){
    const confirmation=wizard.querySelector('[data-prerequisite-confirm]');
    const target=confirmation?.disabled?wizard.querySelector('[data-prerequisite-system]'):confirmation;
    target?.focus({preventScroll:true});target?.scrollIntoView({block:'center',behavior:'instant'});return;
  }
  wizard.querySelector('[data-install-action]')?.focus({preventScroll:true});
  await copy('command');
}

/** Copy a safe, existing device-side check; keep a selectable fallback. @param {HTMLButtonElement} button @returns {Promise<void>} */
async function copyDeviceCheck(button) {
  if(previewOnly){toast('Preview only — no installation will run.');return;}
  try{await navigator.clipboard.writeText(CHECK_COMMAND);if(button.isConnected){button.classList.add('copied');button.innerHTML=`${icon('check')}<span>Copied</span>`;localize();}}
  catch{const field=wizard.querySelector('#post-check-command');if(field){field.closest('details').open=true;field.focus();field.select();toast('Text selected. Use your device’s Copy action.');}}
}

/** Copy an already shared report link; stale clipboard results cannot affect a new attempt.
 * @param {HTMLButtonElement} button Report action. @returns {Promise<void>}
 */
async function copyReportLink(button) {
  const block=button.closest('[data-error-report]'),link=block?.querySelector('.report-url');
  const session=installTracker.session,id=session?.id,value=errorReportUrl(link?.getAttribute('href'));
  if(!button.isConnected||!link?.isConnected||session?.status!=='failed'||value!==errorReportUrl(session.errorUrl)||!value)return;
  const current=()=>button.isConnected&&link.isConnected&&installTracker.session?.id===id&&installTracker.session?.status==='failed'&&installTracker.session?.errorUrl===value;
  try{
    await navigator.clipboard.writeText(value);
    if(!current())return;
    button.innerHTML=`${icon('check')}<span>Copied</span>`;
    block.querySelector('[data-report-copy-status]').textContent='Copied';localize();
  }catch{
    if(current()&&revealCopyFallback(link))toast('Text selected. Use your device’s Copy action.');
  }
}

/** Copy preparation only; never treat clipboard success as package installation.
 * @param {HTMLButtonElement} button Preparation action. @returns {Promise<void>}
 */
async function copyPrerequisites(button) {
  const block=button.closest('[data-command-block]'),field=block?.querySelector('code');
  if(!field?.isConnected||!button.isConnected)return;
  const value=field.textContent;
  if(previewOnly&&value!=='cat /etc/os-release'){toast('Preview only — no installation will run.');return;}
  try{
    await navigator.clipboard.writeText(value);
    if(!button.isConnected||!field.isConnected)return;
    button.classList.add('copied');button.innerHTML=`${icon('check')}<span>Copied</span>`;
    block.querySelector('[data-command-status]').textContent='Copied';localize();
  }catch{
    if(!button.isConnected||!field.isConnected)return;
    if(revealCopyFallback(field))toast('Text selected. Use your device’s Copy action.');
  }
}

/** Copy a generated artifact, opening a selectable fallback if needed. @param {string} kind @returns {Promise<void>} */
async function copy(kind) {
  if(previewOnly&&kind==='command'){toast('Preview only — no installation will run.');return;}
  if(kind==='command'&&!answered.has('telemetry')){go('telemetry');return;}
  if(kind==='command'&&!prerequisiteGate.ready(state.device)){toast('Confirm the required tools above to unlock the install command.');return;}
  const now=Math.floor(Date.now()/1000);
  if(kind==='command'&&setupStatus(setupSession,now).kind!=='active'){updateExpiry();toast('Copy a new command first. Your choices are saved.');return;}
  const artifact=setupSession;
  const attempt=kind==='command'?++commandCopyAttempt:0;
  if(kind==='command'&&!launchToken()){
    const busy=wizard.querySelector('[data-install-action]');
    if(busy){busy.disabled=true;busy.innerHTML=`${icon('copy')}<span>Copying…</span>`;localize();}
    await installTracker.connect(artifact.code);
    if(busy?.isConnected)busy.disabled=previewOnly||!prerequisiteGate.ready(state.device);
    if(setupSession!==artifact||step!=='review'||!prerequisiteGate.ready(state.device))return;
    if(setupStatus(artifact).kind!=='active'){updateExpiry();return;}
  }
  if(kind==='command'&&!launchToken()){updateExpiry();toast('Could not prepare your install command. Please try again.');return;}
  if(kind==='command'&&attempt!==commandCopyAttempt)return;
  if(kind==='command'){manualCopyFor=null;trackingShown=true;updateInstallProgress();updateManualCopy();}
  const value = kind === 'command' ? buildShortCommand(artifact,Math.floor(Date.now()/1000),launchToken()) : shareUrl();
  const target = document.querySelector(kind === 'command' ? '#install-command' : '#share-link');
  const button = document.querySelector(kind==='command'?'[data-install-action]':`[data-copy="${kind}"]`);
  try {
    await navigator.clipboard.writeText(value);
    if(kind==='command'&&attempt!==commandCopyAttempt)return;
    if(!button?.isConnected||setupSession!==artifact||(kind==='command'&&!prerequisiteGate.ready(state.device)))return;
    if(kind==='command'&&setupStatus(artifact).kind!=='active'){updateExpiry();toast('That command expired while copying. Copy a new command.');return;}
    if(kind==='command'){
      button.innerHTML=`${icon('check')}<span>Copied</span>`;
      button.classList.add('copied');
      updateHandoffStep(wizard,true);
      document.querySelector('[data-copy-status]').textContent='Command copied. Paste it in the terminal on your OVOS device, then press Enter.';
    }else toast('Setup link copied. Your choices are saved in the link.');
    localize();
  } catch {
    if(kind==='command'&&attempt!==commandCopyAttempt)return;
    if(setupSession!==artifact||(kind==='command'&&(!prerequisiteGate.ready(state.device)||setupStatus(artifact).kind!=='active'))){updateExpiry();return;}
    if(kind==='command'){
      if(step!=='review'||!target?.isConnected)return;
      manualCopyFor=artifact.code;updateManualCopy();
      if(!manualCopyReady())return;
    }
    if(revealCopyFallback(target)){
      toast('Text selected. Use your device’s Copy action.');
    }
  }
}

/** Save the same validated recipe as YAML or a runnable shell file. @param {string} kind @returns {Promise<void>} */
async function download(kind) {
  if(previewOnly&&kind!=='yaml'){toast('Preview only — no installation will run.');return;}
  if(!answered.has('telemetry')){go('telemetry');return;}
  const yaml = kind === 'yaml';
  if(!yaml&&!prerequisiteGate.ready(state.device)){toast('Confirm the required tools above to unlock the install command.');return;}
  const now=Math.floor(Date.now()/1000);
  if(!yaml&&setupStatus(setupSession,now).kind!=='active'){updateExpiry();toast('Copy a new command before downloading it.');return;}
  const artifact=setupSession;
  if(!yaml){await installTracker.connect(artifact.code);if(setupSession!==artifact||step!=='review'||!prerequisiteGate.ready(state.device))return;if(setupStatus(artifact).kind!=='active'){updateExpiry();return;}if(!launchToken()){updateExpiry();toast('Could not prepare your install command. Please try again.');return;}trackingShown=true;updateInstallProgress();}
  const blob = new Blob([yaml ? buildYaml(state) : buildSetupScript(artifact,Math.floor(Date.now()/1000),launchToken())], { type: yaml ? 'text/yaml' : 'text/x-shellscript' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = yaml ? 'scenario.yaml' : `ovos-${state.device}-setup.sh`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(yaml ? 'Scenario downloaded. The full script also sets your language.' : `Downloaded. On your device, run: sh ovos-${state.device}-setup.sh`);
}


document.addEventListener('pointerdown',event=>{
  const target=event.target.closest('button, .brand, .skip-link');if(target)choiceInput.pointerDown(event,target);
},true);
document.addEventListener('keydown',event=>{
  const target=event.target.closest('button, .brand, .skip-link');
  if(target&&!choiceInput.keyDown(event,target)){event.preventDefault();event.stopImmediatePropagation();}
},true);
document.addEventListener('keyup',event=>choiceInput.keyUp(event),true);
document.addEventListener('click', event => {
  const target=event.target.closest('button, .brand, .skip-link'); if(!target||target.disabled)return;
  if(!choiceInput.allowClick(event,target)){event.preventDefault();return;}
  if(target.hasAttribute('data-welcome-replay')){replayWelcome?.();return;}
  if(target.hasAttribute('data-progress-retry')){void installTracker.retry();return;}
  if(target.hasAttribute('data-rerun-wizard')){restartWizard();return;}
  if(target.hasAttribute('data-restart-install')){void retryInstallation();return;}
  if(target.hasAttribute('data-telemetry-continue')){confirmTelemetry();return;}
  if(target.hasAttribute('data-prerequisite-continue')){continueToInstall();return;}
  if(target.hasAttribute('data-review-prerequisites')){reviewPrerequisites();return;}
  if(target.hasAttribute('data-copy-prerequisites')){void copyPrerequisites(target);return;}
  if(target.hasAttribute('data-copy-report')){void copyReportLink(target);return;}
  if(target.hasAttribute('data-copy-check')){void copyDeviceCheck(target);return;}
  if(target.hasAttribute('data-welcome-start')){if(welcomeHeard)go('language');else void welcomePlayback?.start();return;}
  if(target.hasAttribute('data-welcome-skip')){go('language');return;}
  if(target.matches('.skip-link')){event.preventDefault();document.querySelector('#main').focus();return;}
  if(target.matches('.brand, [data-reset]')){event.preventDefault();returnToWelcome();return;}
  if(target.hasAttribute('data-back')){back();return;}
  if(target.hasAttribute('data-cancel-edit')){cancelTransition();cancelEdit();return;}
  if(target.hasAttribute('data-edit')){editQuestion(target.dataset.edit);return;}
  if(target.hasAttribute('data-next-trivia')){drawTrivia();updateTriviaNote(wizard.querySelector('.project-fact'),currentFact);applyTranslations(wizard.querySelector('.project-fact'),state.locale);return;}
  if(target.hasAttribute('data-change-language')){languageChooserOpen=!languageChooserOpen;render();wizard.querySelector(languageChooserOpen?'[data-language-select]':'[data-change-language]').focus({preventScroll:true});return;}
  if(target.hasAttribute('data-confirm-language')){react(target,()=>complete());return;}
  if(target.hasAttribute('data-prepared')){preparedFor=state.device;answered.add('prepare');if(editing&&(state.experience==='hub'||(editSnapshot?.device===state.device&&answered.has('speech'))))finish();else go(nextQuestion('prepare',state));return;}
  if(target.hasAttribute('data-answer')){react(target,()=>answer(target.dataset.answer,target.dataset.value));return;}
  if(target.hasAttribute('data-check-specs')){go(firstCapability(state));return;}
  if(target.hasAttribute('data-other')){showDevicePane('platform',true);return;}
  if(target.hasAttribute('data-device-cards')){showDevicePane('cards');return;}
  if(target.hasAttribute('data-platform')){
    const device=platformTarget(target.dataset.platform,unlistedDevice);
    if(!device){platformUnsure=true;render();wizard.querySelector('#platform-note').focus();return;}
    platformUnsure=false;react(target,()=>acceptDevice(device));return;
  }
  if(target.hasAttribute('data-pick')){
    react(target,()=>{
      if(target.dataset.pick==='experience'){
        if(state.experience!==target.dataset.value)state=chooseExperience(state,target.dataset.value,skillsAnswered);
        complete();
      }else if(target.dataset.value==='computer'){showDevicePane('platform');}
      else acceptDevice(target.dataset.value);
    });return;
  }
  if(target.hasAttribute('data-install-action')){
    if(!prerequisiteGate.ready(state.device))return;
    const status=setupStatus(setupSession);
    if(status.kind==='clock'){toast(status.message);return;}
    if(status.kind!=='active'&&target.dataset.installAction!=='renew'){updateExpiry();return;}
    if(status.kind!=='active'||target.dataset.installAction==='renew'){setupSession=issueSetup(state);persist();render();wizard.querySelector('[data-install-action]').focus({preventScroll:true});}
    void copy('command');return;
  }
  if(target.hasAttribute('data-copy'))void copy(target.dataset.copy);
  if(target.hasAttribute('data-download'))download(target.dataset.download);
});
/** Preview a language atomically without replacing or blurring the chooser. @param {string} locale @returns {Promise<void>} */
async function selectLanguage(locale) {
  if(!Object.hasOwn(LANGUAGES,locale))return;
  const request=++localeRequest;
  const confirm=wizard.querySelector('[data-confirm-language]'),panel=wizard.querySelector('.language-simple');
  if(confirm)confirm.disabled=true;panel?.setAttribute('aria-busy','true');
  try{await loadLocale(locale);}catch{
    if(request===localeRequest){
      if(confirm)confirm.disabled=false;panel?.removeAttribute('aria-busy');
      const select=wizard.querySelector('[data-language-select]');if(select)select.value=state.locale;
      toast('Couldn’t load this language. Please try again.');
    }
    return;
  }
  if(request!==localeRequest||step!=='language')return;
  state.locale=locale;
  if(state.speech==='local'&&!speechEligibility(state).eligible){state=chooseSpeech(state,'public');toast('This language uses public speech in the preview. Your recipe has been adjusted.');}
  const select=wizard.querySelector('[data-language-select]');
  if(select)select.value=locale;
  wizard.querySelector('.current-language strong').textContent=LANGUAGES[locale];
  const source=wizard.querySelector('.current-language small');if(source)source.textContent=languageSource(locale,languageSuggestion,answered.has('language')&&locale===confirmedState.locale);
  const flag=wizard.querySelector('.language-globe img');if(flag)flag.src=localeFlag(locale);
  if(confirm)confirm.disabled=false;panel?.removeAttribute('aria-busy');
  localize();saveJourney();
}

wizard.addEventListener('change',event=>{
  if(event.target.matches('[data-telemetry-confirm]')){telemetrySelection=event.target.checked;const label=wizard.querySelector('[data-telemetry-state]');if(label)label.textContent=t(telemetrySelection?'On':'Off',state.locale);return;}
  if(event.target.matches('[data-prerequisite-confirm]')){prerequisiteGate.confirm(event.target.checked);wizard.querySelector('[data-install-action]')?.classList.remove('copied');updateExpiry();return;}
  if(event.target.matches('[data-language-select]'))selectLanguage(event.target.value);
});

document.addEventListener('toggle',event=>{if(event.target.classList?.contains('install-options'))detailsOpen=event.target.open;},true);
window.addEventListener('ovos-theme-change',()=>{
  const button=document.querySelector('[data-theme-toggle]');
  if(button)applyTranslations(button,state.locale);
});
window.addEventListener('popstate',()=>{void restoreRoute();});
window.addEventListener('hashchange',()=>{if(history.state?.ovosWizard?.id!==navigationId)void restore();});
window.addEventListener('focus',updateExpiry);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateExpiry();});
restore();
fetch('./assets/mark1-welcome-envelope.json').then(response=>response.ok?response.json():null).then(envelope=>{welcomeEnvelope=envelope;if(welcomePlayback)welcomePlayback.envelope=envelope;}).catch(()=>{});
window.addEventListener('pagehide',()=>{installTracker.stop();stopWelcomeEyes?.();welcomePlayback?.dispose();});
window.addEventListener('pageshow',event=>{
  if(!event.persisted)return;
  if(step==='welcome')render();
  else if(step==='review'&&setupSession?.code){
    updateExpiry();
    void installTracker.connect(setupSession.code).then(()=>installTracker.poll());
  }
});

/** Expose the same validated recipe to optional browser agents. @returns {void} */
function registerTools() {
  if(!document.modelContext?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const tools=[
    {name:'read_ovos_setup',description:'Read the current wizard choices. Does not install anything.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({step,choices:{...state}})},
    {name:'configure_ovos_setup',description:'Configure the visible wizard and produce a recipe. Does not execute installation.',inputSchema:PRESET_SCHEMA,annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{const choices=validateState(input);await loadLocale(choices.locale);cancelTransition();state=choices;skillsAnswered=true;finish();return{choices:{...state},scenario:buildYaml(state),link:shareUrl()};}}
  ];
  for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional API. */}}
}
registerTools();
