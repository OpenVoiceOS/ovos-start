import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mark1Eye} from '../dist/mark1-eye.mjs';

const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');

test('the Mark I indicator contains one complete twelve-LED eye without external assets or progress semantics',()=>{
  const markup=mark1Eye();
  assert.match(markup,/aria-hidden="true" focusable="false"/);
  assert.match(markup,/viewBox="0 0 56 56"/);
  assert.equal((markup.match(/class="mark1-eye-ring"/g)||[]).length,1);
  assert.equal((markup.match(/class="mark1-led"/g)||[]).length,12);
  for(const ring of markup.matchAll(/<g class="mark1-leds">([\s\S]*?)<\/g>/g)){
    assert.equal((ring[1].match(/class="mark1-led"/g)||[]).length,12);
    const positions=[...ring[1].matchAll(/cx="([^"]+)" cy="([^"]+)"/g)];
    assert.equal(new Set(positions.map(match=>match[1]+','+match[2])).size,12);
    for(const [,x,y] of positions)assert.ok(Math.abs(Math.hypot(Number(x),Number(y))-18)<.001);
  }
  assert.doesNotMatch(markup,/<text|<image|<script|href=|https?:|role="progressbar"|aria-value|NaN|undefined/);
});

test('static and compact eye modes retain exactly one ring',()=>{
  assert.match(mark1Eye(),/mark1-eye--animated/);
  assert.doesNotMatch(mark1Eye({animated:false}),/mark1-eye--animated/);
  assert.match(mark1Eye({compact:true}),/mark1-eye--compact/);
  const staticCompact=mark1Eye({animated:false,compact:true});
  assert.match(staticCompact,/mark1-eye--compact/);
  assert.equal((staticCompact.match(/class="mark1-eye-ring"/g)||[]).length,1);
  assert.doesNotMatch(staticCompact,/mark1-eye--animated|<animate|style=/);
});

test('LED animation changes only brightness and respects reduced motion and forced colors',()=>{
  const keyframes=css.match(/@keyframes mark1-led-chase\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(keyframes);
  assert.match(keyframes,/opacity:/);
  assert.doesNotMatch(keyframes,/transform:|rotate\(/);
  assert.match(css,/\.mark1-eye--animated \.mark1-led\{animation:mark1-led-chase/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.mark1-eye--animated \.mark1-led\{animation:none;opacity:1\}\}/);
  assert.match(css,/@media\(forced-colors:active\)\{[\s\S]*?\.mark1-eye--animated \.mark1-led\{animation:none;opacity:1\}/);
  assert.match(css,/(?:^|\n)svg\.mark1-eye\{/);
  assert.doesNotMatch(css,/(?:^|\n)\.mark1-eye\{/);
  assert.match(css,/\.mark1-eye--compact\{width:40px;height:40px\}/);
  assert.match(css,/\.mark1-eye-face\{fill:var\(--paper\)/);
  assert.match(css,/\.mark1-eye \.mark1-led\{fill:Highlight;opacity:1\}/);
});
