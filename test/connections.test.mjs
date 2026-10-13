import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectionsView } from '../dist/connections.mjs';
import { DEFAULTS, DEVICES, allowedExperiences, selectDevice } from '../dist/scenario.mjs';
import { UI_LOCALES, translateMessage } from '../dist/i18n.mjs';

/** Find a rendered button by its machine-facing action attributes. */
function button(html, attribute, value) {
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  const selected = buttons.filter(([, attributes]) => attributes.includes(attribute)
    && (value === undefined || attributes.includes(`data-value="${value}"`)));
  assert.equal(selected.length, 1, `exactly one button for ${attribute}/${value ?? ''}`);
  return { attributes: selected[0][1], content: selected[0][2] };
}

/** Collect reader-facing text and accessible names while ignoring decorative SVG markup. */
function messages(html) {
  const withoutIcons = html.replace(/<svg\b[\s\S]*?<\/svg>/g, '');
  return [
    ...[...withoutIcons.matchAll(/>([^<]+)</g)].map(match => match[1].trim()).filter(Boolean),
    ...[...withoutIcons.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(match => match[1]),
  ];
}

test('every supported voice device exposes both optional connections without another step', () => {
  for (const device of Object.keys(DEVICES)) {
    for (const experience of allowedExperiences(device).filter(value => value !== 'hub')) {
      const recipe = { ...selectDevice(DEFAULTS, device), experience };
      const html = connectionsView(recipe);
      assert.match(html, /<section[^>]*aria-labelledby="connections-title"/);
      assert.match(html, /<h2 id="connections-title">Optional connections<\/h2>/);
      assert.match(html, /<h3>Home Assistant<\/h3>/);
      assert.match(html, /<h3>AI conversations<\/h3>/);
      assert.match(button(html, 'data-connection="homeassistant"', 'yes').attributes, /aria-label="Add Home Assistant"/);
      assert.match(button(html, 'data-connections-ai').attributes, /aria-label="Add AI conversations"/);
      assert.doesNotMatch(html, /connection-included|connection-remove|data-value="no"/);
      assert.deepEqual(recipe, { ...selectDevice(DEFAULTS, device), experience }, 'rendering does not choose integrations');
    }
  }
});

test('headless hubs never advertise voice integrations, even with stale saved choices', () => {
  for (const device of Object.keys(DEVICES)) {
    if (!allowedExperiences(device).includes('hub')) continue;
    for (const homeassistant of [false, true]) for (const llmMode of ['off', 'local', 'online']) {
      for (const expanded of [false, true]) {
        assert.equal(connectionsView({ ...DEFAULTS, device, experience: 'hub', homeassistant, llmMode }, expanded), '');
      }
    }
  }
});

test('adding Home Assistant opens an honest, accessible form before installation', () => {
  const html = connectionsView({ ...DEFAULTS, device: 'mark2', homeassistant: true });
  assert.match(html, /class="connection-pending">[\s\S]*?<span>Add your connection details<\/span>/);
  assert.match(html, /<form[^>]*data-ha-form[^>]*autocomplete="off"[^>]*aria-label="Home Assistant connection"/);
  assert.match(html, /Already using Home Assistant\? Connect it here\./);
  assert.match(button(html, 'data-connection="homeassistant"', 'no').attributes, /aria-label="Remove Home Assistant"/);
  assert.doesNotMatch(html, /Ready to connect|>Connected<|>Installed<|>Verified<|class="connection-included"/);
  for (const [id, label, type] of [['ha-url', 'Home Assistant address', 'url'], ['ha-token', 'Long-lived access token', 'password']]) {
    assert.ok(html.includes(`<label for="${id}">${label}</label>`));
    const input = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0];
    assert.ok(input?.includes(`type="${type}"`));
    assert.match(input, /\brequired\b/);
    assert.ok(input.includes(`aria-describedby="${id}-help ha-error"`));
    assert.ok(html.includes(`id="${id}-help"`), 'input help has a matching accessible description');
  }
  assert.match(html, /This lets OVOS use Home Assistant\. It is not your login password\./);
  assert.match(button(html, 'data-ha-show').attributes, /aria-controls="ha-token" aria-pressed="false"/);
  assert.match(button(html, 'data-ha-show').content, /^Show$/);
  assert.match(html, /<details class="ha-token-help"><summary>Where do I find my token\?/);
  assert.match(html, /href="https:\/\/my\.home-assistant\.io\/redirect\/profile\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /<p id="ha-error"[^>]*role="alert"[^>]*hidden/);
  assert.match(button(html, 'type="submit"').content, /^Save connection$/);
  const removed = connectionsView({ ...DEFAULTS, device: 'mark2', homeassistant: false }, false, { ready: true });
  assert.doesNotMatch(removed, /data-ha-form|connection-pending|connection-included|Remove Home Assistant|data-ha-edit/);
  assert.match(button(removed, 'data-connection="homeassistant"', 'yes').content, /<span>Add<\/span>/);
});

test('saved Home Assistant details stay compact and can be edited without claiming connection success', () => {
  const recipe = { ...DEFAULTS, device: 'mark2', homeassistant: true };
  const saved = connectionsView(recipe, false, { ready: true });
  assert.match(saved, /class="connection-included">[\s\S]*?<span>Ready to connect<\/span>/);
  assert.match(saved, /Details saved for this installation\. Your device will connect during setup\./);
  assert.match(button(saved, 'data-ha-edit').content, /^Change details$/);
  assert.doesNotMatch(saved, /<form|<input|data-ha-show|data-ha-form|>Connected<|>Verified</);
  const editing = connectionsView(recipe, false, { ready: true, editing: true });
  assert.match(editing, /data-ha-form/);
  assert.match(editing, /Add your connection details/);
  assert.doesNotMatch(editing, /Ready to connect|data-ha-edit|Details saved for this installation/);
});

test('saving Home Assistant details prevents duplicate submissions and exposes an error region', () => {
  const recipe = { ...DEFAULTS, device: 'computer', homeassistant: true };
  const saving = connectionsView(recipe, false, { saving: true });
  for (const [, input] of saving.matchAll(/<input\b([^>]*)>/g)) assert.match(input, /\bdisabled\b/);
  for (const control of [button(saving, 'data-connection="homeassistant"', 'no'), button(saving, 'data-ha-show'), button(saving, 'type="submit"')]) {
    assert.match(control.attributes, /\bdisabled\b/);
  }
  assert.equal(button(saving, 'type="submit"').content, 'Saving…');
  const failed = connectionsView(recipe, false, { error: 'A secret must never become HTML' });
  const region = failed.match(/<p id="ha-error"[^>]*>/)?.[0];
  assert.match(region, /role="alert"/);
  assert.doesNotMatch(region, /\bhidden\b/);
  assert.doesNotMatch(failed, /A secret must never become HTML/);
  assert.doesNotMatch(button(failed, 'type="submit"').attributes, /\bdisabled\b/);
  assert.equal(button(failed, 'type="submit"').content, 'Save connection');
});

test('AI disclosure identifies its panel and accurately announces expansion and provider selection', () => {
  for (const llmMode of ['off', 'local', 'online']) for (const expanded of [false, true]) {
    const recipe = Object.freeze({ ...DEFAULTS, device: 'pi', llmMode });
    const html = connectionsView(recipe, expanded);
    const action = button(html, 'data-connections-ai');
    const panel = html.match(/<div\b[^>]*id="connection-ai-options"[^>]*>/)?.[0];
    assert.ok(panel);
    assert.ok(action.attributes.includes(`aria-expanded="${expanded}"`));
    assert.match(action.attributes, /aria-controls="connection-ai-options"/);
    assert.equal(/\bhidden\b/.test(panel), !expanded, 'collapsed choices leave the keyboard and accessibility tree');
    assert.ok(action.attributes.includes(`aria-label="${expanded ? 'Cancel' : llmMode === 'off' ? 'Add AI conversations' : 'Change AI connection'}"`));
    assert.match(html, /<fieldset><legend>Choose an AI connection<\/legend>/);
    for (const provider of ['local', 'online']) {
      const option = button(html, 'data-connection="llmMode"', provider);
      assert.ok(option.attributes.includes(`aria-pressed="${llmMode === provider}"`));
      assert.match(option.attributes, /type="button"/);
    }
    assert.equal(recipe.llmMode, llmMode, 'opening choices never changes the selected provider');
  }
});

test('selected AI names the service, keeps removal available and explains setup and online costs', () => {
  for (const llmMode of ['off', 'local', 'online']) {
    const html = connectionsView({ ...DEFAULTS, device: 'computer', llmMode }, true);
    assert.match(html, /Connect an existing OpenAI-compatible service\. The installer asks for its details in Terminal\./);
    assert.match(html, /<p>No model is installed\.<\/p>/);
    if (llmMode === 'off') {
      assert.doesNotMatch(html, /connection-included|connection-remove|data-value="off"/);
    } else {
      const label = llmMode === 'local' ? 'My model server' : 'Online provider';
      assert.ok(html.includes(`<span>${label}</span></span>`), 'the included state names the chosen provider');
      assert.match(button(html, 'data-connection="llmMode"', 'off').content, /Remove AI conversations/);
    }
    assert.equal(html.includes('Your provider receives your prompts and may charge for use.'), llmMode === 'online');
    assert.doesNotMatch(html, />Connected<|>Model installed<|>Verified</);
  }
});

test('secret values never become renderer HTML or appear in the saved summary', () => {
  const privateValues = ['https://private.example.test', 'secret-token-sentinel', 'private-user-sentinel'];
  const recipe = {
    ...DEFAULTS, device: 'computer', homeassistant: true, llmMode: 'online',
    serverUrl: privateValues[0], apiKey: privateValues[1], username: privateValues[2],
    token: privateValues[1], url: privateValues[0],
  };
  for (const expanded of [false, true]) for (const ready of [false, true]) for (const editing of [false, true]) {
    const html = connectionsView(recipe, expanded, {
      ready, editing, url: privateValues[0], token: privateValues[1], error: privateValues[2],
    });
    for (const value of privateValues) assert.ok(!html.includes(value));
    for (const [input] of html.matchAll(/<input\b[^>]*>/g)) assert.doesNotMatch(input, /\bvalue=/, 'draft values are assigned as DOM properties, not interpolated markup');
    assert.doesNotMatch(html, /<(?:textarea|select)\b|contenteditable=/i);
    const values = [...html.matchAll(/data-value="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(values, ['no', 'local', 'online', 'off']);
    for (const [, attributes] of html.matchAll(/<button\b([^>]*)>/g)) assert.match(attributes, /type="(?:button|submit)"/);
    if (!ready || editing) {
      assert.match(html, /Your token is sent securely to your device through a temporary encrypted handoff\. It is never added to shared setup links\./);
      assert.match(html, /Saved on your device during installation\./);
      assert.doesNotMatch(html, /end.to.end|already connected/i);
    }
  }
});

test('every connection label, explanation and accessible action has a translation in every language', () => {
  const labels = new Set();
  for (const homeassistant of [false, true]) for (const llmMode of ['off', 'local', 'online']) {
    for (const expanded of [false, true]) for (const display of [{}, { saving: true }, { ready: true }, { ready: true, editing: true }]) {
      for (const text of messages(connectionsView({ ...DEFAULTS, device: 'mark2', homeassistant, llmMode }, expanded, display))) labels.add(text);
    }
  }
  assert.ok(labels.has('Optional connections'));
  assert.ok(labels.has('Remove AI conversations'));
  assert.ok(labels.has('Change AI connection'));
  assert.ok(labels.has('Home Assistant connection'));
  assert.ok(labels.has('Ready to connect'));
  assert.ok(labels.has('Saving…'));
  const app = readFileSync(new URL('../dist/app.mjs', import.meta.url), 'utf8');
  for (const message of [
    'Hide',
    'Enter your Home Assistant address, starting with http:// or https://.',
    'Paste the long-lived access token from your Home Assistant profile.',
    'Could not save your connection. Please try again before copying the command.',
    'I already run Home Assistant. Add its address and token before installing.',
  ]) {
    assert.ok(app.includes(`'${message}'`), 'dynamic validation and edit-path messages match the current app');
    labels.add(message);
  }
  for (const locale of UI_LOCALES) {
    const catalog = JSON.parse(readFileSync(new URL(`../dist/locales/${locale}.json`, import.meta.url), 'utf8'));
    for (const label of labels) {
      if (label === 'Home Assistant') {
        assert.equal(translateMessage(label, catalog), label, 'product names remain recognizable');
        continue;
      }
      assert.ok(Object.hasOwn(catalog, label), `${locale}: missing ${label}`);
      assert.equal(translateMessage(label, catalog), catalog[label], `${locale}: complete text is translated together`);
      if (locale !== 'en-us') assert.notEqual(catalog[label], label, `${locale}: untranslated ${label}`);
    }
  }
});
