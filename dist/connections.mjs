import { icon } from './icons.mjs';
import { localModelGuidance } from './recommendations.mjs';

/** Show optional connections before export, without an extra wizard step.
 * @param {object} state Validated recipe. @param {boolean} aiOpen AI choices are expanded.
 * @param {object} homeAssistant Non-secret connection display state.
 * @returns {string} Accessible inline connection controls; empty for headless hubs.
 */
export function connectionsView(state, aiOpen = false, homeAssistant = {}) {
  if (state.experience === 'hub') return '';
  const ai = state.llmMode !== 'off';
  const haReady = homeAssistant.ready && !homeAssistant.editing;
  const haForm = state.homeassistant && !haReady;
  return `<section class="setup-connections" aria-labelledby="connections-title">
    <div class="connections-heading"><h2 id="connections-title">Optional connections</h2></div>
    <div class="connection-row ${state.homeassistant?'is-included':''}">
      <span class="connection-icon" aria-hidden="true">${icon('home_assistant')}</span>
      <div class="connection-copy"><h3>Home Assistant</h3><p>Control your smart home by voice.</p>${state.homeassistant?`<span class="${haReady?'connection-included':'connection-pending'}">${icon(haReady?'check':'settings')}<span>${haReady?'Ready to connect':'Add your connection details'}</span></span>`:''}</div>
      <button type="button" class="connection-action" data-connection="homeassistant" data-value="${state.homeassistant?'no':'yes'}" ${homeAssistant.saving?'disabled':''} aria-label="${state.homeassistant?'Remove':'Add'} Home Assistant">${state.homeassistant?'':icon('add')}<span>${state.homeassistant?'Remove':'Add'}</span></button>
      ${haReady&&state.homeassistant?`<div class="connection-detail ha-saved"><p>Details saved for this installation. Your device will connect during setup.</p><button type="button" class="text-button" data-ha-edit>Change details</button></div>`:''}
      ${haForm?`<form class="ha-form" data-ha-form novalidate autocomplete="off" aria-label="Home Assistant connection">
        <p class="ha-intro">Already using Home Assistant? Connect it here.</p>
        <div class="ha-field"><label for="ha-url">Home Assistant address</label><input id="ha-url" name="ha-url" type="url" inputmode="url" placeholder="http://homeassistant.local:8123" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="2048" required aria-describedby="ha-url-help ha-error" ${homeAssistant.saving?'disabled':''}><p id="ha-url-help">Use the address you open to see your Home Assistant dashboard.</p></div>
        <div class="ha-field"><label for="ha-token">Long-lived access token</label><div class="ha-token-input"><input id="ha-token" name="ha-token" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" maxlength="2048" required aria-describedby="ha-token-help ha-error" ${homeAssistant.saving?'disabled':''}><button type="button" data-ha-show aria-controls="ha-token" aria-pressed="false" ${homeAssistant.saving?'disabled':''}>Show</button></div><p id="ha-token-help">This lets OVOS use Home Assistant. It is not your login password.</p></div>
        <details class="ha-token-help"><summary>Where do I find my token?${icon('expand_more')}</summary><ol><li>Open your Home Assistant profile, then Security.</li><li>Under Long-lived access tokens, create a token named OVOS.</li><li>Copy the token and paste it above.</li></ol><a href="https://my.home-assistant.io/redirect/profile/" target="_blank" rel="noopener noreferrer">Open my Home Assistant profile ${icon('arrow_forward')}</a></details>
        <p class="ha-privacy">Your token is sent securely to your device through a temporary encrypted handoff. It is never added to shared setup links.</p>
        <p id="ha-error" class="ha-error" role="alert" ${homeAssistant.error?'':'hidden'}></p>
        <div class="ha-form-footer"><span>Saved on your device during installation.</span><button type="submit" class="button button-secondary" ${homeAssistant.saving?'disabled':''}>${homeAssistant.saving?'Saving…':'Save connection'}</button></div>
      </form>`:''}
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
