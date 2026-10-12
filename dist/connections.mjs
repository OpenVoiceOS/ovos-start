import { icon } from './icons.mjs';
import { localModelGuidance } from './recommendations.mjs';

/** Show optional connections before export, without an extra wizard step.
 * @param {object} state Validated recipe. @param {boolean} aiOpen AI choices are expanded.
 * @returns {string} Accessible inline connection controls; empty for headless hubs.
 */
export function connectionsView(state, aiOpen = false) {
  if (state.experience === 'hub') return '';
  const ai = state.llmMode !== 'off';
  return `<section class="setup-connections" aria-labelledby="connections-title">
    <div class="connections-heading"><h2 id="connections-title">Optional connections</h2></div>
    <div class="connection-row ${state.homeassistant?'is-included':''}">
      <span class="connection-icon" aria-hidden="true">${icon('home_assistant')}</span>
      <div class="connection-copy"><h3>Home Assistant</h3><p>Control your smart home by voice.</p>${state.homeassistant?`<span class="connection-included">${icon('check')}<span>Included</span></span>`:''}</div>
      <button type="button" class="connection-action" data-connection="homeassistant" data-value="${state.homeassistant?'no':'yes'}" aria-label="${state.homeassistant?'Remove':'Add'} Home Assistant">${state.homeassistant?'':icon('add')}<span>${state.homeassistant?'Remove':'Add'}</span></button>
      ${state.homeassistant?'<p class="connection-detail">Use your existing Home Assistant server. The installer asks for its details in Terminal.</p>':''}
    </div>
    <div class="connection-row ${ai?'is-included':''}">
      <span class="connection-icon" aria-hidden="true">${icon('spark')}</span>
      <div class="connection-copy"><h3>AI conversations</h3><p>Ask open-ended questions.</p>${ai?`<span class="connection-included">${icon('check')}<span>${state.llmMode==='local'?'My model server':'Online provider'}</span></span>`:''}</div>
      <button type="button" class="connection-action" data-connections-ai aria-expanded="${aiOpen}" aria-controls="connection-ai-options" aria-label="${aiOpen?'Cancel':ai?'Change AI connection':'Add AI conversations'}">${icon(aiOpen?'expand_more':ai?'settings':'add')}<span>${aiOpen?'Cancel':ai?'Change':'Add'}</span></button>
      <div id="connection-ai-options" class="connection-options" ${aiOpen?'':'hidden'}>
        <fieldset><legend>Choose an AI connection</legend><div class="connection-providers">
          <button type="button" data-connection="llmMode" data-value="local" aria-pressed="${state.llmMode==='local'}">${icon('server')}<span>My model server</span>${icon('check')}</button>
          <button type="button" data-connection="llmMode" data-value="online" aria-pressed="${state.llmMode==='online'}">${icon('cloud')}<span>An online provider</span>${icon('check')}</button>
        </div></fieldset>
        <p>Connect an existing OpenAI-compatible service. The installer asks for its details in Terminal.</p>
        <p>No model is installed.</p>
        ${ai?`<button type="button" class="connection-remove" data-connection="llmMode" data-value="off"><span>Remove AI conversations</span></button>`:''}
      </div>
      ${state.llmMode==='online'?'<p class="connection-detail">Your provider receives your prompts and may charge for use.</p>':''}
      ${state.llmMode==='local'?`<p class="connection-detail">${localModelGuidance(state)}</p>`:''}
    </div>
  </section>`;
}
