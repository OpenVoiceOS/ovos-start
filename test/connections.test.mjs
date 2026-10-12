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

test('Home Assistant shows inclusion rather than claiming an already working connection', () => {
  const html = connectionsView({ ...DEFAULTS, device: 'mark2', homeassistant: true });
  assert.match(html, /class="connection-included">[\s\S]*?<span>Included<\/span>/);
  assert.match(html, /Use your existing Home Assistant server\. The installer asks for its details in Terminal\./);
  assert.match(button(html, 'data-connection="homeassistant"', 'no').attributes, /aria-label="Remove Home Assistant"/);
  assert.doesNotMatch(html, /aria-label="Add Home Assistant"|>Connected<|>Installed<|>Verified</);
  const removed = connectionsView({ ...DEFAULTS, device: 'mark2', homeassistant: false });
  assert.doesNotMatch(removed, /connection-included|Use your existing Home Assistant server|Remove Home Assistant/);
  assert.match(button(removed, 'data-connection="homeassistant"', 'yes').content, /<span>Add<\/span>/);
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

test('connection controls never ask for, render or embed server credentials', () => {
  const privateValues = ['https://private.example.test', 'secret-token-sentinel', 'private-user-sentinel'];
  const recipe = {
    ...DEFAULTS, device: 'computer', homeassistant: true, llmMode: 'online',
    serverUrl: privateValues[0], apiKey: privateValues[1], username: privateValues[2],
  };
  for (const expanded of [false, true]) {
    const html = connectionsView(recipe, expanded);
    assert.doesNotMatch(html, /<(?:form|input|textarea|select)\b|contenteditable=/i);
    for (const value of privateValues) assert.ok(!html.includes(value));
    const values = [...html.matchAll(/data-value="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(values, ['no', 'local', 'online', 'off']);
    for (const [, attributes] of html.matchAll(/<button\b([^>]*)>/g)) assert.match(attributes, /type="button"/);
  }
});

test('every connection label, explanation and accessible action has a translation in every language', () => {
  const labels = new Set();
  for (const homeassistant of [false, true]) for (const llmMode of ['off', 'local', 'online']) {
    for (const expanded of [false, true]) {
      for (const text of messages(connectionsView({ ...DEFAULTS, device: 'mark2', homeassistant, llmMode }, expanded))) labels.add(text);
    }
  }
  assert.ok(labels.has('Optional connections'));
  assert.ok(labels.has('Remove AI conversations'));
  assert.ok(labels.has('Change AI connection'));
  assert.ok(labels.has('Use your existing Home Assistant server. The installer asks for its details in Terminal.'));
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
