import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {starterExamples,nextSteps,GUIDE_LINKS} from '../dist/post-install-content.mjs';
import {STARTER_EXAMPLES} from '../dist/starter-examples.mjs';
import {progressView} from '../dist/post-install.mjs';
import {DEFAULTS} from '../dist/scenario.mjs';
import {UI_LOCALES,translateMessage} from '../dist/i18n.mjs';
const state={...DEFAULTS,device:'mark2',homeassistant:true,llmMode:'online'};
const model=status=>({session:{status,attention:false}});

test('starter phrases have pinned skill provenance and no unsupported-language fallback',()=>{
 assert.deepEqual(Object.keys(STARTER_EXAMPLES).sort(),[...UI_LOCALES].sort());
 for(const locale of UI_LOCALES){
  const phrases=starterExamples({...state,locale});
  assert.equal(phrases.length,['hi-in','kab-dz'].includes(locale)?0:locale==='eu-es'?3:4,locale);
  assert.equal(new Set(phrases.map(item=>item.kind)).size,phrases.length);
  for(const item of phrases){
   assert.match(item.source,/^https:\/\/github\.com\/OpenVoiceOS\/ovos-skill-(date-time|alerts|weather)\/blob\/[a-f0-9]{40}\/locale\//);
   assert.ok(item.phrase.length>5);assert.doesNotMatch(item.phrase,/[{}<>]/);assert.ok(Object.isFrozen(item));
  }
 }
 assert.deepEqual(starterExamples({...state,locale:'unknown'}),[]);
 assert.deepEqual(starterExamples({...state,skills:false}),[]);
 assert.deepEqual(starterExamples({...state,experience:'hub'}),[]);
});

test('next steps follow selected integrations and hub mode suppresses local voice integrations',()=>{
 assert.equal(GUIDE_LINKS.skills,'https://andlo.github.io/ovos-klondike-mercantile/');
 assert.deepEqual(nextSteps({...state,homeassistant:false,llmMode:'off'}).map(item=>item.id),['skills','help']);
 assert.deepEqual(nextSteps(state).map(item=>item.id),['skills','homeassistant','ai','help']);
 for(const llmMode of ['local','online'])assert.equal(nextSteps({...state,llmMode}).filter(item=>item.id==='ai').length,1);
 const hub=nextSteps({...state,experience:'hub'});assert.deepEqual(hub.map(item=>item.id),['skills','help']);
 const empty=nextSteps({...state,skills:false})[0];assert.equal(empty.title,'Add your first skill');assert.doesNotMatch(empty.description,/before|cannot|must/);
 for(const item of nextSteps(state))assert.ok(Object.values(GUIDE_LINKS).includes(item.url));
});

test('completion shows phrases as readable content and preserves language-specific utterances',()=>{
 for(const locale of UI_LOCALES){
  const recipe={...state,locale},html=progressView(model('voice_ready'),recipe);
  for(const item of starterExamples(recipe))assert.ok(html.includes(`lang="${locale}" data-no-translate>“${item.phrase.replace(/'/g,'&#39;')}”</blockquote>`));
  assert.match(html,/Next steps/);assert.match(html,/data-next-step="homeassistant"/);assert.match(html,/data-next-step="ai"/);
  for(const item of nextSteps(recipe))assert.ok(html.includes(`data-progress-focus="next-${item.id}"`));
  assert.match(html,/data-progress-focus="demo-0"/);assert.match(html,/demo-thumbnail/);assert.equal((html.match(/id="post-check-command"/g)||[]).length,1);
  assert.doesNotMatch(html,/voice-examples-preview|Voice check pending/);
 }
});

test('pending checks expose optional future examples while failures expose no onboarding',()=>{
 for(const status of ['installed','services_ready']){
  const html=progressView(model(status),state);assert.match(html,/Voice check pending/);
  const summary=html.match(/<details class="voice-examples-preview"[^>]*><summary[^>]*>([\s\S]*?)<\/summary>/)?.[1];
  assert.ok(summary,'examples use a native disclosure');
  assert.match(summary,/Try asking/);
  assert.match(summary,/After your voice check/);
  assert.match(summary,/class="examples-show">Show examples/);
  assert.match(summary,/class="examples-hide">Hide examples/);
  assert.match(summary,/class="examples-disclosure-action"/);
  assert.doesNotMatch(summary,/<button|<a\b|aria-expanded=/,'one native control owns expansion');
  assert.doesNotMatch(html,/<details class="voice-examples-preview"[^>]* open/);
  assert.doesNotMatch(html,/Your voice check passed/);assert.match(html,/Next steps/);
 }
 for(const status of ['started','downloading','installing','failed','cancelled']){
  const html=progressView(model(status),state);assert.doesNotMatch(html,/voice-example-grid|data-next-step|post-demos/);
 }
});

test('hub guide uses a verified pairing URL and never asks the server to listen',()=>{
 const html=progressView(model('installed'),{...state,experience:'hub'});
 assert.ok(html.includes(GUIDE_LINKS.satellite));assert.match(html,/Connect your first satellite/);
 assert.doesNotMatch(html,/HiveMind-community-docs|Say “Hey Mycroft”|Voice check pending|voice-example-grid|data-next-step="ai"/);
 assert.match(html,/data-progress-focus="guide-satellite"/);assert.match(html,/Check OVOS services/);
});

test('onboarding chrome is translated in every catalog while source phrases stay separate',()=>{
 const keys=['Try asking','After your voice check','Say “Hey Mycroft”','Wait for the listening sound, then ask.','More to try','Show examples','Hide examples','Time','Date','Timer','Weather','Next steps','Examples for your language','Weather needs internet and a configured location.'];
 for(const locale of UI_LOCALES){
  const catalog=JSON.parse(readFileSync(new URL(`../dist/locales/${locale}.json`,import.meta.url),'utf8'));
  for(const key of keys){assert.ok(catalog[key],`${locale}: ${key}`);assert.equal(translateMessage(key,catalog),catalog[key]);}
  for(const card of nextSteps(state))for(const key of [card.title,card.description,card.action])assert.ok(catalog[key],`${locale}: ${key}`);
 }
});

test('spoken examples are a noninteractive list with decorative icons and one relevant requirement',()=>{
 for(const locale of UI_LOCALES){
  const recipe={...state,locale},examples=starterExamples(recipe),html=progressView(model('voice_ready'),recipe);
  if(!examples.length){assert.doesNotMatch(html,/voice-example-grid/);continue;}
  const list=html.match(/<ul class="voice-example-grid" role="list">([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(list,locale);
  assert.equal((list.match(/<li class="voice-example">/g)||[]).length,examples.length-1);
  assert.equal((list.match(/class="voice-example-symbol" aria-hidden="true"/g)||[]).length,examples.length-1);
  assert.doesNotMatch(list,/<button|<a\b|tabindex=|undefined/,'phrases are spoken examples, not clickable controls');
  assert.equal((list.match(/Weather needs internet and a configured location\./g)||[]).length,examples.some(item=>item.kind==='weather')?1:0);
  assert.doesNotMatch(html,/Some skills need internet or extra setup\./);
  assert.match(html,/Say “Hey Mycroft”/);
  assert.match(html,/Wait for the listening sound, then ask\./);
  assert.match(html,/Your own wake word\? Use that instead\./);
 }
});


test('the first question leads and each reviewed phrase appears exactly once',()=>{
 for(const locale of UI_LOCALES)for(const status of ['installed','services_ready','voice_ready']){
  const recipe={...state,locale},html=progressView(model(status),recipe),examples=starterExamples(recipe);
  if(!examples.length){assert.doesNotMatch(html,/first-question|more-questions/);continue;}
  const featured=html.match(/<div class="voice-example-featured">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(featured,`${locale}/${status}: one featured question`);
  assert.ok(featured.includes(examples[0].phrase.replace(/'/g,'&#39;')));
  for(const example of examples){
   const phrase=example.phrase.replace(/'/g,'&#39;');
   assert.equal(html.split(`data-no-translate>“${phrase}”</blockquote>`).length-1,1,`${locale}: each phrase appears once`);
  }
  const start=html.indexOf('class="first-question"'),end=html.indexOf('class="more-questions"');
  const intro=html.slice(start,end);
  assert.ok(intro.indexOf('Say “Hey Mycroft”')<intro.indexOf('Wait for the listening sound, then ask.'));
  assert.ok(intro.indexOf('Wait for the listening sound, then ask.')<intro.indexOf('class="voice-example-featured"'));
  assert.ok(intro.indexOf('class="voice-example-featured"')<intro.indexOf('Your own wake word? Use that instead.'));
  assert.doesNotMatch(intro,/conversation-number|<button|<a\b|tabindex=|role="button"|<audio|autoplay/);
  assert.match(html,/<h3>More to try<\/h3>/);
 }
});
