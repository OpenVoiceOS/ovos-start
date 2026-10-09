import { errorReportUrl } from './report-link.mjs';
import { icon, deviceIcon } from './icons.mjs';
import { CHECK_COMMAND, DEMOS, guideKind, progressCopy, installationMilestones, installationStages, installationTiming } from './install-progress.mjs';
import { DEVICES } from './scenario.mjs';
import { starterExamples, nextSteps, GUIDE_LINKS } from './post-install-content.mjs';

/** Escape only dynamic recipe-derived text. @param {string} value @returns {string} */
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));


const keepOpenHint='<span class="keep-open-hint">Keep this page open to follow the installation.</span>';
const activityIndicator='<span class="activity-spinner" aria-hidden="true"></span>';

/** A visible waiting signal; animation never implies the installer has started.
 * @param {object} model Current tracker state. @returns {string} Accessible status panel.
 */
export function waitingView(model) {
  const title=model.error?progressCopy(model).title:'Waiting for your device';
  const active=!model.error&&!model.session?.attention&&model.session?.status==='waiting';
  return `<div class="install-waiting ${active?'is-waiting':''}"><span class="waiting-indicator" aria-hidden="true">${active?activityIndicator:icon(model.error?'refresh':'schedule')}</span><span role="status" aria-live="polite" aria-atomic="true"><strong class="waiting-title">${escape(title)}</strong>${!model.error&&model.session?keepOpenHint:''}</span>${model.error&&model.error!=='expired'?'<button class="text-button" data-progress-focus="refresh" data-progress-retry>Check progress again</button>':''}</div>`;
}

/** Small timing surface updated independently so polling preserves focus.
 * @param {object} model Tracker state. @param {number} now Unix seconds. @returns {string}
 */
export function timingView(model,now) {
  const timing=installationTiming(model,now);if(!timing)return '';
  return `<span class="timing-elapsed">${icon('schedule')}<span>${escape(timing.elapsedText)}</span></span>${timing.remaining?`<span class="timing-estimate"><span>Estimated time left</span><strong>${escape(timing.remaining)}</strong></span>`:''}${timing.note&&timing.note!=='Time varies by device and connection.'?`<span class="timing-note">${escape(timing.note)}</span>`:''}`;
}

/** A stopped run needs recovery, not another handoff or a guessed next step.
 * @param {object} model Confirmed terminal status. @param {object} state Recipe.
 * @param {boolean} preview Whether execution is disabled. @param {boolean} prerequisitesReady Tools acknowledged. @returns {string}
 */
function recoveryView(model,state,preview,prerequisitesReady) {
  const cancelled=model.session.status==='cancelled';
  const reportUrl=cancelled?null:errorReportUrl(model.session.errorUrl);
  const headline=cancelled?'Installation cancelled':'Installation stopped';
  const milestones=installationMilestones(model);
  const unknown=!milestones.some(step=>step.state==='stopped');
  return `<div class="install-progress install-dashboard install-recovery">
    <header class="installation-heading"><p class="progress-device">${deviceIcon(state.device)}<span>${escape(DEVICES[state.device]?.name||'OVOS')}</span></p>
      <h1 class="progress-title" tabindex="-1" data-progress-focus="heading" aria-live="polite" aria-atomic="true">${escape(preview?`Preview: ${headline}`:headline)}</h1>
    </header>
    <section class="recovery-panel" aria-label="${headline}">
      <div class="recovery-diagnosis"><span class="recovery-symbol" aria-hidden="true">${icon(cancelled?'info':reportUrl?'link':'terminal')}</span><div class="recovery-copy"><h2>${cancelled?'Installation was cancelled on your device.':reportUrl?'Installation report':'Check the error in Terminal'}</h2>${reportUrl?`<div class="recovery-report" data-error-report><a class="report-url" data-progress-focus="report-link" href="${escape(reportUrl)}" target="_blank" rel="noopener noreferrer" data-no-translate>${escape(reportUrl)}</a><button class="button button-secondary" type="button" data-progress-focus="copy-report" data-copy-report>${icon('copy')}<span>Copy link</span></button><span class="sr-only" role="status" aria-live="polite" data-report-copy-status></span></div>`:cancelled?'':'<p>This page doesn’t receive the error details.</p>'}</div><a class="button button-secondary" href="https://matrix.to/#/#openvoiceos:matrix.org" target="_blank" rel="noopener noreferrer">${icon('forum')}<span>Get help in Matrix</span></a></div>
      <div class="recovery-retry"><div class="recovery-copy"><h2>Ready to try again?</h2><p>${cancelled?'You can start again with the same choices.':'After fixing the error, copy a new command. Your choices are saved.'}</p></div><button class="button" type="button" data-progress-focus="retry-install" data-restart-install ${preview?'disabled':''}>${icon('copy')}<span>${prerequisitesReady?'Copy retry command':'Prepare to retry'}</span></button></div>
      <details class="recovery-history" data-progress-disclosure="history"><summary data-progress-focus="history-summary">Installation details</summary>${unknown?'<p class="recovery-unknown">The exact step wasn’t reported.</p>':''}
        ${milestones.length?`<ol class="recovery-checkpoints">${milestones.map((milestone,index)=>`<li class="recovery-${milestone.state}"><span class="recovery-checkpoint-icon" aria-hidden="true">${milestone.state==='unknown'?String(index+1).padStart(2,'0'):icon(milestone.state==='complete'?'check':'terminal')}</span><span>${milestone.label}</span><small>${milestone.state==='complete'?'Completed':milestone.state==='stopped'?'Last reported step':'Not confirmed'}</small></li>`).join('')}</ol>`:''}
      </details>
    </section>
  </div>`;
}

/** Recovery for an optional device check, including a selectable copy fallback.
 * @param {string} label Disclosure label. @param {boolean} hub Service-only device.
 * @returns {string} Localized device command, never executed by the browser.
 */
function checkCommandView(label,hub=false) {
  return `<details class="check-action device-check-command" data-progress-disclosure="check"><summary data-progress-focus="check-summary">${label}</summary><p>Copy the check command, paste it in Terminal and press Enter.</p><button class="button button-secondary" data-progress-focus="copy-check" data-copy-check>${icon('terminal')}<span>Copy check command</span></button><textarea id="post-check-command" data-progress-focus="check-field" aria-label="${hub?'Check OVOS services':'Check sound and microphone'}" class="command check-command" readonly rows="2" data-no-translate>${escape(CHECK_COMMAND)}</textarea></details>`;
}

/** Installed services are not proof of a successful microphone/speaker check.
 * @param {object} model Current connection status.
 * @returns {string} One clear next action that matches the terminal menu.
 */
function pendingVoiceView(model) {
  return `<section class="voice-check-panel" aria-label="Voice check pending"><div class="voice-check-heading"><span class="voice-check-symbol" aria-hidden="true">${icon('terminal')}</span><div><span class="voice-check-pending">Voice check pending</span><h2>Check your speaker and microphone</h2></div></div><p class="voice-check-instruction">Follow the checks in Terminal. At the first prompt, enter 1 and press Enter.</p>${!model.error?'<p class="voice-check-wait">Keep this page open for the check result.</p>':''}${checkCommandView('Terminal already closed?')}</section>`;
}

/** Curated examples stay optional until voice is confirmed; hubs get pairing guidance.
 * @param {object} state Confirmed recipe. @param {boolean} verified Voice check passed.
 * @returns {string} Readable examples or an appropriate skill/language starting point.
 */
function gettingStartedView(state,verified) {
  if(state.experience==='hub')return `<section class="onboarding-start"><span class="onboarding-symbol" aria-hidden="true">${icon('server')}</span><div><h2>Connect your first satellite</h2><p>Follow the pairing guide on the device that will listen to you.</p><a class="text-button" data-progress-focus="guide-satellite" href="${GUIDE_LINKS.satellite}" target="_blank" rel="noopener noreferrer">Connect a satellite</a></div></section>`;
  if(!state.skills)return '';
  const examples=starterExamples(state);
  if(!examples.length)return `<section class="onboarding-start"><span class="onboarding-symbol" aria-hidden="true">${icon('globe')}</span><div><h2>Examples for your language</h2><p>Choose a skill that supports your language and use its example phrases.</p><a class="text-button" data-progress-focus="guide-language" href="${GUIDE_LINKS.skills}" target="_blank" rel="noopener noreferrer">Find skills</a></div></section>`;
  const content=`<div class="example-intro"><span class="onboarding-symbol" aria-hidden="true">${icon('voice')}</span><div><p>Say “Hey Mycroft”, wait for the listening sound, then ask:</p><p class="details-note">Your own wake word? Use that instead.</p></div></div><div class="voice-example-grid">${examples.map(example=>`<article class="voice-example"><span class="voice-example-label">${example.label}</span><blockquote lang="${escape(state.locale)}" data-no-translate>“${escape(example.phrase)}”</blockquote>${example.kind==='weather'?'<p class="example-hint">Weather needs internet and a configured location.</p>':''}</article>`).join('')}</div><p class="details-note">Some skills need internet or extra setup.</p>`;
  return verified?`<section class="voice-examples" aria-label="Try a few things"><h2>Try a few things</h2>${content}</section>`:`<details class="voice-examples-preview" data-progress-disclosure="examples"><summary data-progress-focus="examples-summary">Things to try after the voice check</summary>${content}</details>`;
}

/** A live checklist with confirmed checkpoints and a clear remaining path.
 * @param {object} model Tracker state. @param {object} state Recipe.
 * @param {object} options Preview labeling and prerequisite acknowledgement. @returns {string} Accessible progress UI.
 */
export function progressView(model,state,{preview=false,prerequisitesReady=true}={}) {
  if(['failed','cancelled'].includes(model.session?.status))return recoveryView(model,state,preview,prerequisitesReady);
  const copy=progressCopy(model),phase=progressCopy({session:model.session}),kind=guideKind(state);
  if(kind==='hub'&&copy.installed)phase.description='Connect a voice satellite before trying spoken questions.';

  const working=['started','downloading','installing'].includes(model.session?.status);
  const active=!model.error&&!model.session?.attention&&working;
  const reconnecting=!!model.error&&model.error!=='expired'&&!['failed','cancelled','voice_ready'].includes(model.session?.status);
  const stages=installationStages(model);
  const current=installationMilestones(model).find(step=>step.state==='current');
  const detailed=working&&model.session?.phase>0?current:null;
  const headline=model.error==='expired'?copy.title:working?'Installing OVOS':copy.installed&&!copy.complete?'OVOS is installed':phase.title;
  return `<div class="install-progress install-dashboard ${copy.installed?'is-installed':''} ${reconnecting?'is-reconnecting':''}">
    <header class="installation-heading"><p class="progress-device">${deviceIcon(state.device)}<span>${escape(DEVICES[state.device]?.name||'OVOS')}</span></p>
    <div class="installation-title-row"><h1 class="progress-title" tabindex="-1" data-progress-focus="heading" aria-live="polite" aria-atomic="true">${escape(preview?`Preview: ${headline}`:headline)}</h1>${copy.installed?`<button type="button" class="button button-secondary rerun-wizard" data-rerun-wizard data-progress-focus="rerun-wizard" aria-describedby="rerun-wizard-note">${icon('refresh')}<span>Run the wizard again</span></button>`:''}</div>
    ${copy.installed?'<p class="rerun-wizard-note" id="rerun-wizard-note">Your choices are kept. Review them before installing again.</p>':''}
    ${copy.installed||working?'':`<p class="progress-description">${phase.description}</p>`}</header>
    ${copy.installed?`<div class="installation-receipt"><span class="installation-confirmed">${icon('check')}<span>Installation complete</span></span><div class="installation-timing" data-install-timing>${timingView(model)}</div></div>`:`<section class="installation-flow" aria-label="${model.error?'Last confirmed progress':'Installation progress'}">
      <ol class="installation-stages" aria-live="polite" aria-atomic="true">${stages.map((stage,index)=>`<li class="stage-${stage.state}" ${stage.state==='current'?'aria-current="step"':''}><span class="stage-symbol" aria-hidden="true">${stage.state==='complete'?icon('check'):stage.state==='current'&&active?activityIndicator:icon(stage.icon)}</span><span class="stage-label">${stage.label}</span><span class="sr-only">${stage.state==='complete'?'Completed':stage.state==='current'?(model.error?'Last confirmed progress':'In progress'):'Not reached'}</span></li>`).join('')}</ol>
      ${detailed?`<div class="installation-current" role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true">${icon(model.session.phase===3?'settings':model.session.phase===4?'check':'terminal')}</span><div><h2>${detailed.label}</h2><p>${detailed.description}</p></div></div>`:''}
      <div class="installation-meta"><div class="installation-timing" data-install-timing>${timingView(model)}</div>${reconnecting?`<span class="connection-badge is-reconnecting">${icon('refresh')}<span>Reconnecting…</span></span>`:''}</div>
    </section>`}
    ${active?`<p class="installation-instruction">${icon('terminal')}<span>Keep this page open. Follow any prompts in Terminal.</span></p>`:''}
    ${model.error&&copy.description?`<div class="connection-notice"><p>${copy.description}</p>${reconnecting?'<button class="button button-secondary progress-retry" data-progress-focus="refresh" data-progress-retry>'+icon('refresh')+'<span>Try again</span></button>':''}</div>`:model.session?.attention&&!copy.installed?`<p class="progress-description">${phase.description}</p>`:''}
    ${!copy.installed&&working?`<details class="install-help-short" data-progress-disclosure="check"><summary data-progress-focus="check-summary">After a restart</summary><p>Open Terminal on your device and run this check. It checks services and helps you test your voice.</p><button class="text-button" data-progress-focus="copy-check" data-copy-check>Copy check command</button><textarea id="post-check-command" data-progress-focus="check-field" aria-label="Check sound and microphone" class="command check-command" readonly rows="2" data-no-translate>${escape(CHECK_COMMAND)}</textarea></details>`:''}
    ${copy.installed?`<div class="post-install-guide">
      ${!copy.complete&&kind!=='hub'?pendingVoiceView(model):''}
      ${gettingStartedView(state,copy.complete)}
      <section class="post-next-steps" aria-label="Next steps"><h2>Next steps</h2><div class="next-step-grid">${nextSteps(state).map(item=>`<a class="next-step-card" href="${item.url}" target="_blank" rel="noopener noreferrer" data-next-step="${item.id}" data-progress-focus="next-${item.id}"><span class="next-step-symbol" aria-hidden="true">${icon(item.icon)}</span><div class="next-step-copy"><h3>${item.title}</h3><p>${item.description}</p><span class="next-step-action">${item.action}</span></div></a>`).join('')}</div>${state.locale!=='en-us'?'<p class="details-note">Guides may be in English.</p>':''}</section>
      ${copy.complete||kind==='hub'?checkCommandView(kind==='hub'?'Check OVOS services':'Run the check again',kind==='hub'):''}
      <section class="post-demos" aria-label="See OVOS in action"><h2>See OVOS in action</h2><div class="demo-links">${DEMOS.map((demo,index)=>`<a class="demo-link" data-progress-focus="demo-${index}" href="${demo.url}" target="_blank" rel="noopener noreferrer"><span class="demo-thumbnail" aria-hidden="true"><img src="${demo.thumbnail}" width="480" height="360" alt="" loading="lazy" decoding="async"><span class="demo-play">${icon('play')}</span></span><span class="demo-caption"><strong>${demo.title}</strong><small>${demo.meta}</small></span></a>`).join('')}</div><p class="details-note">These demos use extra integrations. Captions may be available on YouTube.</p></section>
    </div>`:''}
  </div>`;
}
