import { errorReportUrl } from './report-link.mjs';
import { icon, deviceIcon } from './icons.mjs';
import { CHECK_COMMAND, DEMOS, guideKind, progressCopy, installationMilestones, installationStages, installationTiming, installationUpdate, audioChecks } from './install-progress.mjs';
import { mark1Eye } from './mark1-eye.mjs';
import { sudoPasswordNotice } from './terminal-notice.mjs';
import { DEVICES } from './scenario.mjs';
import { starterExamples, nextSteps, GUIDE_LINKS } from './post-install-content.mjs';

/** Escape only dynamic recipe-derived text. @param {string} value @returns {string} */
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));


const keepOpenHint='<span class="keep-open-hint">Keep this page open to follow the installation.</span>';

/** A visible waiting signal; animation never implies the installer has started.
 * @param {object} model Current tracker state. @returns {string} Accessible status panel.
 */
export function waitingView(model) {
  const title=model.error?progressCopy(model).title:'Waiting for your device';
  const active=!model.error&&!model.session?.attention&&model.session?.status==='waiting';
  return `<div class="install-waiting ${active?'is-waiting':''}"><span class="waiting-indicator" aria-hidden="true">${active?mark1Eye({compact:true}):icon(model.error?'refresh':'schedule')}</span><span role="status" aria-live="polite" aria-atomic="true"><strong class="waiting-title">${escape(title)}</strong>${!model.error&&model.session?keepOpenHint:''}</span>${model.error&&model.error!=='expired'?'<button class="text-button" data-progress-focus="refresh" data-progress-retry>Check progress again</button>':''}</div>`;
}

/** Small timing surface updated independently so polling preserves focus.
 * @param {object} model Tracker state. @param {number} now Unix seconds. @returns {string}
 */
export function timingView(model,now) {
  const timing=installationTiming(model,now),update=installationUpdate(model,now);
  return `${timing?`<span class="timing-elapsed">${icon('schedule')}<span>${escape(timing.elapsedText)}</span></span>${timing.remaining?`<span class="timing-estimate"><span>Estimated time left</span><strong>${escape(timing.remaining)}</strong></span>`:''}${timing.note&&timing.note!=='Time varies by device and connection.'?`<span class="timing-note">${escape(timing.note)}</span>`:''}`:''}${update?`<span class="timing-update">${escape(update.text)}</span>${update.note?`<span class="timing-hint">${escape(update.note)}</span>`:''}`:''}`;
}

/** Keep the complete path visible; attach only explicitly reported task receipts.
 * @param {object} model Confirmed tracker state. @returns {string} Non-live checklist.
 */
function installationChecklistView(model) {
  const steps=installationStages(model);
  if(!steps.length)return '';
  return `<ol class="installation-stages" role="list" aria-label="Installation progress">${steps.map((stage,index)=>{
    const status=stage.state==='complete'?'Completed':stage.state==='current'?(model.error||model.session?.attention?'Last reported step':'In progress'):stage.state==='stopped'?'Last reported step':stage.state==='unknown'?'Not confirmed':'Not started';
    return `<li class="stage-${stage.state}" data-install-step="${stage.id}" ${stage.state==='current'?'aria-current="step"':''}><span class="stage-symbol" aria-hidden="true">${stage.state==='complete'?icon('check'):['current','stopped'].includes(stage.state)?icon(stage.icon):index+1}</span><div class="stage-copy"><div class="stage-heading"><span class="stage-label">${stage.label}</span><span class="stage-status${['complete','upcoming'].includes(stage.state)?' sr-only':''}">${status}</span></div>${stage.receipts.length?`<ul class="stage-receipts" role="list" aria-label="Completed">${stage.receipts.map(receipt=>`<li data-completed-step="${receipt.id}">${icon('check')}<span>${receipt.label}</span></li>`).join('')}</ul>`:''}</div></li>`;
  }).join('')}</ol>`;
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
      <h1 class="progress-title" tabindex="-1" data-progress-focus="heading" aria-live="polite" aria-atomic="true">${escape(preview?`Preview: ${headline}`:headline).replace(/\bOVOS\b/g,'<em>OVOS</em>')}</h1>
    </header>
    <section class="recovery-panel" aria-label="${headline}">
      <div class="recovery-diagnosis"><span class="recovery-symbol" aria-hidden="true">${icon(cancelled?'info':reportUrl?'link':'terminal')}</span><div class="recovery-copy"><h2>${cancelled?'Installation was cancelled on your device.':reportUrl?'Installation report':'Check the error in Terminal'}</h2>${reportUrl?`<div class="recovery-report" data-error-report><a class="report-url" data-progress-focus="report-link" href="${escape(reportUrl)}" target="_blank" rel="noopener noreferrer" data-no-translate>${escape(reportUrl)}</a><button class="button button-secondary" type="button" data-progress-focus="copy-report" data-copy-report>${icon('copy')}<span>Copy link</span></button><span class="sr-only" role="status" aria-live="polite" data-report-copy-status></span></div>`:cancelled?'':'<p>This page doesn’t receive the error details.</p>'}</div><a class="button button-secondary" href="https://matrix.to/#/#openvoiceos:matrix.org" target="_blank" rel="noopener noreferrer">${icon('forum')}<span>Get help in Matrix</span></a></div>
      <div class="recovery-retry"><div class="recovery-copy"><h2>Ready to try again?</h2><p>${cancelled?'You can start again with the same choices.':'After fixing the error, copy a new command. Your choices are saved.'}</p></div><button class="button" type="button" data-progress-focus="retry-install" data-restart-install ${preview?'disabled':''}>${icon('copy')}<span>${prerequisitesReady?'Copy retry command':'Prepare to retry'}</span></button></div>
      <section class="recovery-history" aria-label="Installation details"><h2>Installation details</h2>${unknown?'<p class="recovery-unknown">The exact step wasn’t reported.</p>':''}${installationChecklistView(model)}</section>
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

/** A small local celebration, decorative and silent.
 * @returns {string} Confetti and a confirmed check in theme colors.
 */
function celebrationArt() {
  return `<svg class="celebration-art" viewBox="0 0 144 128" aria-hidden="true" focusable="false"><circle class="celebration-halo" cx="72" cy="66" r="42"/><circle class="celebration-medal" cx="72" cy="66" r="31"/><path class="celebration-checkmark" d="m57 66 10 10 21-23"/><g class="celebration-blue"><path d="m25 17 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><rect x="113" y="49" width="6" height="15" rx="3" transform="rotate(25 116 56)"/><circle cx="43" cy="110" r="3"/></g><g class="celebration-pink"><rect x="101" y="17" width="6" height="14" rx="3" transform="rotate(-28 104 24)"/><path d="m117 92 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></g><g class="celebration-gold"><circle cx="69" cy="12" r="4"/><rect x="14" y="73" width="6" height="13" rx="3" transform="rotate(-20 17 79)"/><circle cx="94" cy="115" r="3"/></g></svg>`;
}

/** Installed services are not proof of a successful microphone/speaker check.
 * @param {object} model Current connection status.
 * @returns {string} One clear next action that matches the terminal menu.
 */
function audioChecksView(model) {
  if(progressCopy(model).complete)return '';
  const checks=audioChecks(model),started=checks.some(check=>check.status!=='pending');
  return `<section class="voice-check-panel" aria-label="Voice check pending"><div class="voice-check-heading"><span class="voice-check-symbol" aria-hidden="true">${icon('terminal')}</span><div><span class="voice-check-pending">Final audio checks</span><h2>Check your speaker and microphone</h2></div></div>
    <p class="voice-check-instruction">${started?'Answer the questions in Terminal. Results appear here.':'Follow the checks in Terminal. At the first prompt, enter 1 and press Enter.'}</p>
    <ul class="audio-check-results" role="list" aria-live="polite" aria-atomic="true">${checks.map(check=>`<li class="audio-result audio-result--${check.status}" data-audio-result="${check.id}"><span class="audio-result-symbol" aria-hidden="true">${icon(check.icon)}</span><div class="audio-result-copy"><div class="audio-result-heading"><h3>${escape(check.label)}</h3><span class="audio-result-status">${icon(check.status==='passed'?'check':check.status==='failed'?'info':'schedule')}<span>${check.statusLabel}</span></span></div><p>${check.description}</p></div></li>`).join('')}</ul>
    ${!model.error?'<p class="voice-check-wait">Keep this page open for the check result.</p>':''}${checkCommandView(model.session?.attention?'Run the check again':'Terminal already closed?')}</section>`;
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
  const symbols={time:'schedule',date:'calendar',timer:'timer',weather:'cloud'};
  const content=`<div class="example-intro"><p class="example-wake-word">Say “Hey Mycroft”</p><p>Wait for the listening sound, then ask.</p><p class="details-note">Your own wake word? Use that instead.</p></div><ul class="voice-example-grid" role="list">${examples.map(example=>`<li class="voice-example"><span class="voice-example-symbol" aria-hidden="true">${icon(symbols[example.kind])}</span><div><span class="voice-example-label">${example.label}</span><blockquote lang="${escape(state.locale)}" data-no-translate>“${escape(example.phrase)}”</blockquote>${example.kind==='weather'?'<p class="example-hint">Weather needs internet and a configured location.</p>':''}</div></li>`).join('')}</ul>`;
  const heading=`<span class="onboarding-symbol" aria-hidden="true">${icon('voice')}</span><span class="examples-disclosure-title"><span class="examples-title">Try asking</span>${verified?'':'<span class="examples-subtitle">After your voice check</span>'}</span>`;
  return verified?`<section class="voice-examples" aria-label="Try asking"><h2 class="examples-heading">${heading}</h2><div class="examples-disclosure-content">${content}</div></section>`:`<details class="voice-examples-preview" data-progress-disclosure="examples"><summary data-progress-focus="examples-summary">${heading}<span class="examples-disclosure-action"><span class="examples-show">Show examples</span><span class="examples-hide">Hide examples</span>${icon('expand_more')}</span></summary><div class="examples-disclosure-content">${content}</div></details>`;
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
  // The launcher reports installing only after its initial sudo command succeeds.
  const showPasswordNotice=['started','downloading'].includes(model.session?.status)&&!model.session?.attention&&model.error!=='expired';
  const reconnecting=!!model.error&&model.error!=='expired'&&!['failed','cancelled'].includes(model.session?.status);
  const checklist=copy.installed?'':installationChecklistView(model);
  const current=installationMilestones(model).find(step=>step.state==='current');
  const detailed=working&&model.session?.phase>0?current:null;
  const attention=!model.error&&model.session?.attention;
  const task=attention?phase:detailed?{title:detailed.label,description:detailed.description}:phase;
  const celebrate=copy.complete&&kind!=='hub';
  const headline=celebrate?'OVOS is ready!':model.error==='expired'?copy.title:working?'Installing OVOS':copy.installed?'OVOS is installed':phase.title;
  const heading=`<h1 class="progress-title" tabindex="-1" data-progress-focus="heading" aria-live="polite" aria-atomic="true">${escape(preview?`Preview: ${headline}`:headline).replace(/\bOVOS\b/g,'<em>OVOS</em>')}</h1>`;
  return `<div class="install-progress install-dashboard ${copy.installed?'is-installed':''} ${active?'is-working':''} ${reconnecting?'is-reconnecting':''}">
    <header class="installation-heading"><p class="progress-device">${deviceIcon(state.device)}<span>${escape(DEVICES[state.device]?.name||'OVOS')}</span></p>
    ${celebrate?`<div class="installation-success">${celebrationArt()}<div class="celebration-copy"><p class="celebration-kicker">You did it!</p>${heading}<p class="celebration-description">Your device can hear you and talk back. Say hello!</p></div></div>`:`<div class="installation-title-row">${heading}</div>`}
    ${copy.installed||working?'':`<p class="progress-description">${phase.description}</p>`}</header>
    ${showPasswordNotice?sudoPasswordNotice(state.device):''}
    ${copy.installed?'':`<section class="installation-flow" aria-label="${model.error?'Last confirmed progress':'Installation progress'}">
      ${working?`<div class="installation-current${attention?' installation-current--attention':''}" role="status" aria-live="polite" aria-atomic="true">${mark1Eye({animated:active})}<div><h2>${task.title}</h2><p>${task.description}</p></div>${mark1Eye({animated:active})}</div>`:''}
      ${checklist}
      <div class="installation-meta"><div class="installation-timing" data-install-timing>${timingView(model)}</div>${reconnecting?`<span class="connection-badge is-reconnecting">${icon('refresh')}<span>Reconnecting…</span></span>`:''}</div>
    </section>`}
    ${active?`<p class="installation-instruction">${icon('terminal')}<span>Keep this page open. Follow any prompts in Terminal.${kind!=='hub'?'<span class="audio-check-reminder">At the end, answer the speaker and microphone questions in Terminal.</span>':''}</span></p>`:''}
    ${model.error&&copy.description?`<div class="connection-notice"><p>${copy.description}</p>${reconnecting?'<button class="button button-secondary progress-retry" data-progress-focus="refresh" data-progress-retry>'+icon('refresh')+'<span>Try again</span></button>':''}</div>`:model.session?.attention&&!copy.installed&&!working?`<p class="progress-description">${phase.description}</p>`:''}
    ${!copy.installed&&working?`<details class="install-help-short" data-progress-disclosure="check"><summary data-progress-focus="check-summary">After a restart</summary><p>Open Terminal on your device and run this check. It checks services and helps you test your voice.</p><button class="text-button" data-progress-focus="copy-check" data-copy-check>Copy check command</button><textarea id="post-check-command" data-progress-focus="check-field" aria-label="Check sound and microphone" class="command check-command" readonly rows="2" data-no-translate>${escape(CHECK_COMMAND)}</textarea></details>`:''}
    ${copy.installed?`<div class="post-install-guide">
      ${kind!=='hub'&&!celebrate?audioChecksView(model):''}
      ${gettingStartedView(state,copy.complete)}
      <section class="post-next-steps" aria-label="Next steps"><h2>Next steps</h2><div class="next-step-grid">${nextSteps(state).map(item=>`<a class="next-step-card" href="${item.url}" target="_blank" rel="noopener noreferrer" data-next-step="${item.id}" data-progress-focus="next-${item.id}"><span class="next-step-symbol" aria-hidden="true">${icon(item.icon)}</span><div class="next-step-copy"><h3>${item.title}</h3><p>${item.description}</p><span class="next-step-action">${item.action}</span></div></a>`).join('')}</div>${state.locale!=='en-us'?'<p class="details-note">Guides may be in English.</p>':''}</section>
      ${copy.complete||kind==='hub'?checkCommandView(kind==='hub'?'Check OVOS services':'Run the check again',kind==='hub'):''}
      <section class="post-demos" aria-label="See OVOS in action"><h2>See OVOS in action</h2><div class="demo-links">${DEMOS.map((demo,index)=>`<a class="demo-link" data-progress-focus="demo-${index}" href="${demo.url}" target="_blank" rel="noopener noreferrer"><span class="demo-thumbnail" aria-hidden="true"><img src="${demo.thumbnail}" width="480" height="360" alt="" loading="lazy" decoding="async"><span class="demo-play">${icon('play')}</span></span><span class="demo-caption"><strong>${demo.title}</strong><small>${demo.meta}</small></span></a>`).join('')}</div><p class="details-note">These demos use extra integrations. Captions may be available on YouTube.</p></section>
      <div class="rerun-footer"><button type="button" class="text-button rerun-wizard" data-rerun-wizard data-progress-focus="rerun-wizard" aria-describedby="rerun-wizard-note">${icon('refresh')}<span>Run the wizard again</span></button><p class="rerun-wizard-note" id="rerun-wizard-note">Your choices are kept. Review them before installing again.</p></div>
    </div>`:''}
  </div>`;
}
