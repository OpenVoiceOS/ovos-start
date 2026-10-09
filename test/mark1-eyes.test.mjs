import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mark1Eyes} from '../dist/mark1-eyes.mjs';

const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');

test('Mark I eyes contain two complete twelve-LED rings without external assets or progress semantics',()=>{
  const markup=mark1Eyes();
  assert.match(markup,/aria-hidden="true" focusable="false"/);
  assert.match(markup,/viewBox="0 0 104 44"/);
  assert.equal((markup.match(/class="mark1-eye"/g)||[]).length,2);
  assert.equal((markup.match(/class="mark1-led"/g)||[]).length,24);
  for(const ring of markup.matchAll(/<g class="mark1-leds">([\s\S]*?)<\/g>/g)){
    assert.equal((ring[1].match(/class="mark1-led"/g)||[]).length,12);
    assert.equal(new Set([...ring[1].matchAll(/d="([^"]+)"/g)].map(match=>match[1])).size,12);
  }
  assert.doesNotMatch(markup,/<text|<image|<script|href=|https?:|role="progressbar"|aria-value|NaN|undefined/);
});

test('static and compact eyes have explicit independent render modes',()=>{
  assert.match(mark1Eyes(),/mark1-eyes--animated/);
  assert.doesNotMatch(mark1Eyes({animated:false}),/mark1-eyes--animated/);
  assert.match(mark1Eyes({compact:true}),/mark1-eyes--compact/);
  const staticCompact=mark1Eyes({animated:false,compact:true});
  assert.match(staticCompact,/mark1-eyes--compact/);
  assert.doesNotMatch(staticCompact,/mark1-eyes--animated|<animate|style=/);
});

test('LED animation changes only brightness and respects reduced motion and forced colors',()=>{
  const keyframes=css.match(/@keyframes mark1-led-chase\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(keyframes);
  assert.match(keyframes,/opacity:/);
  assert.doesNotMatch(keyframes,/transform:|rotate\(/);
  assert.match(css,/\.mark1-eyes--animated \.mark1-led\{animation:mark1-led-chase/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.mark1-eyes--animated \.mark1-led\{animation:none;opacity:1\}\}/);
  assert.match(css,/@media\(forced-colors:active\)\{[\s\S]*?\.mark1-eyes--animated \.mark1-led\{animation:none;opacity:1\}/);
  assert.match(css,/\.mark1-eyes--compact\{width:72px;height:32px\}/);
});
