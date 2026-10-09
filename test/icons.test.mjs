import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { icon, deviceIcon } from '../dist/icons.mjs';
import { DEVICES } from '../dist/scenario.mjs';

test('Material and brand icons preserve their coordinate systems and decorative semantics',()=>{
  for(const name of ['light_mode','dark_mode','forum','add','check','arrow','refresh','restart_alt','help','widgets','construction','schedule']){
    assert.match(icon(name),/viewBox="0 -960 960 960"/);
    assert.match(icon(name),/aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(icon(name),/undefined|<text|https?:/);
  }
  for(const name of ['home_assistant','python','docker','auto_awesome']){
    assert.match(icon(name),/viewBox="0 0 24 24"/);
    assert.match(icon(name),/<path /);
  }
});

test('untrusted icon names cannot inject markup or access inherited properties',()=>{
  for(const name of ['__proto__','constructor','<script>','unknown']){
    assert.throws(()=>icon(name),RangeError);
  }
});

test('example icons remain decorative local SVGs with consistent bounds',()=>{
  for(const name of ['calendar','timer']){
    const markup=icon(name);
    assert.match(markup,/viewBox="0 0 24 24"/);
    assert.match(markup,/aria-hidden="true" focusable="false"/);
    assert.match(markup,/stroke="currentColor"/);
    assert.doesNotMatch(markup,/<script|<text|https?:|undefined/);
  }
});

test('every setup device has bundled decorative artwork without accepting arbitrary asset paths',()=>{
  for(const device of Object.keys(DEVICES)){
    const markup=deviceIcon(device);
    assert.match(markup,/aria-hidden="true"/);
    const image=markup.match(/src="\.\/([^\"]+)"/);
    if(image){
      assert.ok(existsSync(new URL('../dist/'+image[1],import.meta.url)));
      assert.match(markup,/alt=""/);
      assert.equal(image[1],`assets/hardware-${device}.png`);
    }else if(['computer','mac','windows','server'].includes(device)){
      assert.match(markup,/device-symbol-sprite/);
      assert.equal(markup.includes('device-symbol-server'),device==='server');
      assert.ok(existsSync(new URL('../dist/assets/devices.png',import.meta.url)));
    }else assert.match(markup,/<svg /);
  }
  for(const device of ['__proto__','constructor','../../secret','<script>']){
    assert.doesNotMatch(deviceIcon(device),/src=|<script>|undefined/);
    assert.match(deviceIcon(device),/<svg /);
  }
});
