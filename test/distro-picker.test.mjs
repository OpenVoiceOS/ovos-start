import test from 'node:test';
import assert from 'node:assert/strict';
import {bindDistroPicker} from '../dist/distro-picker.mjs';
import {ChoiceInputGuard} from '../dist/interaction.mjs';

/** Minimal tree/event model: real delegated listeners, capture order, focus and DOM replacement. */
class Node {
  /** @param {string} tag Element name. @param {object} attrs Attributes. @param {Node|null} doc Owner. */
  constructor(tag, attrs = {}, doc = null) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = doc || this;
    this.attrs = new Map(); this.dataset = {}; this.children = []; this.parentElement = null;
    this.listeners = new Map(); this.hidden = false; this.disabled = false;
    this.textContent = ''; this.focuses = []; this.scrolls = [];
    this.rect = {top: 0, left: 0, width: 240, height: 50};
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value),
      contains: value => classes.has(value),
      toggle(value, on) { if (on) classes.add(value); else classes.delete(value); },
    };
    Object.entries(attrs).forEach(([name, value]) => this.setAttribute(name, value));
  }
  /** @param {string} name Attribute. @param {string} value Value. @returns {void} */
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
    if (name === 'id') this.id = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
  }
  /** @param {string} name Attribute. @returns {string|null} */
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  /** @param {string} name Attribute. @returns {void} */
  removeAttribute(name) { this.attrs.delete(name); }
  /** @param {string} selector Attribute selector or tag. @returns {boolean} */
  matches(selector) { return selector.startsWith('[') ? this.attrs.has(selector.slice(1, -1)) : this.tagName === selector.toUpperCase(); }
  /** @param {string} selector Ancestor selector. @returns {Node|null} */
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  /** @param {Node|null} target Descendant. @returns {boolean} */
  contains(target) { for (let node = target; node; node = node.parentElement) if (node === this) return true; return false; }
  /** @param {Node} child Child. @returns {Node} */
  append(child) { child.parentElement = this; this.children.push(child); return child; }
  /** @returns {void} */
  clear() { this.children.forEach(child => { child.parentElement = null; }); this.children = []; }
  /** @param {string} selector Descendant selector. @returns {Array<Node>} */
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  /** @param {string} id Node ID. @returns {Node|null} */
  getElementById(id) {
    for (const child of this.children) { if (child.id === id) return child; const found = child.getElementById(id); if (found) return found; }
    return null;
  }
  /** @param {object} options Focus options. @returns {void} */
  focus(options) { this.ownerDocument.activeElement = this; this.focuses.push(options); }
  /** @param {object} options Scroll options. @returns {void} */
  scrollIntoView(options) { this.scrolls.push(options); }
  /** @returns {object} Current rendered option geometry. */
  getBoundingClientRect() { return this.rect; }
  /** @param {string} type Event. @param {Function} fn Handler. @param {boolean} capture Capture. @returns {void} */
  addEventListener(type, fn, capture = false) { const handlers = this.listeners.get(type) || []; handlers.push({fn, capture}); this.listeners.set(type, handlers); }
  /** @param {string} type Event. @param {Function} fn Handler. @param {boolean} capture Capture. @returns {void} */
  removeEventListener(type, fn, capture = false) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.fn !== fn || item.capture !== capture)); }
}

const LABELS = [['debian', 'Debian / Ubuntu'], ['fedora', 'Fedora'], ['arch', 'Arch Linux'], ['alma', 'AlmaLinux'], ['suse', 'openSUSE']];

/** Build a fresh picker while retaining the root, and dispatch actual registered listeners.
 * @param {object} options Harness choices. @returns {object} Harness.
 */
function harness({value = 'debian', rerender = false, guard = false, labels = LABELS, columns = 1} = {}) {
  const doc = new Node('document'), root = doc.append(new Node('main', {}, doc));
  const outside = doc.append(new Node('button', {}, doc)), changes = [];
  let picker, clock = 0;
  const inputGuard = new ChoiceInputGuard(() => clock);
  if (guard) doc.addEventListener('keydown', event => {
    const button = event.target.closest('button');
    if (button && !inputGuard.keyDown(event, button)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  /** @param {string} selected Selected ID. @returns {object} Current DOM. */
  function render(selected) {
    root.clear(); inputGuard.nextScreen();
    const wrapper = root.append(new Node('div', {'data-distro-picker': ''}, doc));
    const trigger = wrapper.append(new Node('button', {'data-prerequisite-system': '', role: 'combobox', 'aria-controls': 'distro-options', 'aria-expanded': 'false', 'data-value': selected}, doc));
    const list = wrapper.append(new Node('ul', {id: 'distro-options', role: 'listbox'}, doc)); list.hidden = true;
    const options = labels.map(([id, label], index) => {
      const node = list.append(new Node('li', {'data-distro-option': '', 'data-value': id, id: 'distro-option-' + id, role: 'option', 'aria-selected': String(id === selected)}, doc));
      node.textContent = label;
      node.rect = {top: Math.floor(index / columns) * 54, left: (index % columns) * 244, width: 240, height: 50};
      return node;
    });
    picker = {wrapper, trigger, list, options}; return picker;
  }
  render(value);
  /** @param {string} next Committed ID. @returns {void} */
  function changed(next) { changes.push(next); if (rerender) render(next).trigger.focus({preventScroll: true}); }
  const dispose = bindDistroPicker(root, changed);
  /** @param {Node} target Event origin. @param {string} type Event name. @param {object} extra Fields. @returns {object} */
  function dispatch(target, type, extra = {}) {
    clock += 100;
    const event = {target, type, key: '', timeStamp: clock, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra};
    const path = []; for (let node = target; node; node = node.parentElement) path.push(node);
    for (const capture of [true, false]) for (const node of capture ? [...path].reverse() : path) {
      for (const item of [...(node.listeners.get(type) || [])]) {
        if (item.capture === capture) item.fn(event);
        if (event.stopped) return event;
      }
    }
    return event;
  }
  return {root, doc, outside, changes, render, dispatch, dispose, changed, inputGuard,
    get picker() { return picker; },
    key: (key, extra = {}) => dispatch(picker.trigger, 'keydown', {key, ...extra}),
    click: () => dispatch(picker.trigger, 'click', {detail: 0}),
  };
}

test('a Debian-only picker waits for explicit keyboard activation before committing', () => {
  const h=harness({value:'',labels:[['debian13','Debian 13']],rerender:true});
  h.click();
  for(const key of ['ArrowDown','ArrowUp','Home','End','d'])h.key(key);
  assert.deepEqual(h.changes,[]);assert.equal(h.picker.trigger.dataset.value,'');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'),'distro-option-debian13');
  h.key('Enter');assert.deepEqual(h.changes,['debian13']);assert.equal(h.picker.trigger.dataset.value,'debian13');
});

test('opening exposes the committed active descendant while retaining trigger focus', () => {
  const h = harness({value: 'fedora'}); h.click();
  assert.equal(h.picker.list.hidden, false); assert.equal(h.doc.activeElement, h.picker.trigger);
  assert.equal(h.picker.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-fedora');
  assert.deepEqual(h.picker.options[1].scrolls.at(-1), {block: 'nearest', inline: 'nearest', behavior: 'instant'});
  h.key('ArrowDown'); assert.equal(h.picker.options[2].classList.contains('active'), true);
  assert.equal(h.picker.options[1].getAttribute('aria-selected'), 'true');
  assert.equal(h.picker.options[2].getAttribute('aria-selected'), 'false');
  assert.equal(h.picker.trigger.dataset.value, 'fedora'); assert.deepEqual(h.changes, []);
});

test('Enter and Space suppress native activation, commit once and survive owner rerender', () => {
  for (const key of ['Enter', ' ']) {
    const h = harness({rerender: true, guard: true});
    assert.equal(h.key(key).defaultPrevented, true); assert.equal(h.picker.list.hidden, false);
    const repeated = h.key(key, {repeat: true}); assert.equal(repeated.defaultPrevented, true);
    assert.equal(h.picker.list.hidden, false); assert.deepEqual(h.changes, []);
    h.key('ArrowDown'); const old = h.picker.trigger;
    assert.equal(h.key(key).defaultPrevented, true);
    assert.deepEqual(h.changes, ['fedora']); assert.notEqual(h.picker.trigger, old);
    assert.equal(h.doc.activeElement, h.picker.trigger); assert.equal(h.picker.list.hidden, true);
    assert.equal(old.getAttribute('aria-expanded'), 'false');
    h.key(key); assert.equal(h.picker.list.hidden, false);
  }
});

test('Escape, trigger toggle and outside presses cancel tentative selection', () => {
  for (const cancel of ['escape', 'toggle', 'outside']) {
    const h = harness(); h.click(); h.key('End');
    if (cancel === 'escape') assert.equal(h.key('Escape').defaultPrevented, true);
    if (cancel === 'toggle') h.click();
    if (cancel === 'outside') assert.equal(h.dispatch(h.outside, 'pointerdown').defaultPrevented, false);
    assert.equal(h.picker.list.hidden, true); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), null);
    assert.equal(h.picker.options.some(option => option.classList.contains('active')), false);
    assert.equal(h.picker.trigger.dataset.value, 'debian'); assert.deepEqual(h.changes, []);
    h.click(); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-debian');
  }
});

test('Tab and Shift+Tab close without commit, rerender, focus movement or default prevention', () => {
  for (const shiftKey of [false, true]) {
    const h = harness({rerender: true}); h.click(); h.key('End');
    const before = h.picker.trigger, focusCount = before.focuses.length;
    const event = h.key('Tab', {shiftKey});
    assert.equal(event.defaultPrevented, false); assert.deepEqual(h.changes, []);
    assert.equal(h.picker.trigger, before); assert.equal(before.focuses.length, focusCount);
    assert.equal(h.picker.list.hidden, true);
  }
});

test('focusout cancels even when focus moves to an unrelated control within the wizard', () => {
  const h = harness(); h.click(); h.key('End');
  const other = h.root.append(new Node('button', {}, h.doc));
  h.dispatch(h.picker.trigger, 'focusout', {relatedTarget: other});
  assert.equal(h.picker.list.hidden, true); assert.deepEqual(h.changes, []);
});

test('option pointer presses keep DOM focus and clicking commits the option itself', () => {
  const h = harness({rerender: true}); h.click();
  const option = h.picker.options[3];
  assert.equal(h.dispatch(option, 'pointerdown').defaultPrevented, true);
  assert.equal(h.doc.activeElement, h.picker.trigger);
  h.dispatch(option, 'click', {detail: 1});
  assert.deepEqual(h.changes, ['alma']); assert.equal(h.doc.activeElement, h.picker.trigger);
});

test('reselecting a committed value closes without resetting prerequisites via onChange', () => {
  const h = harness(); h.click(); h.key('Enter');
  assert.deepEqual(h.changes, []); assert.equal(h.picker.list.hidden, true);
});

test('Arrow keys clamp and Home/End/Page keys select visual boundaries', () => {
  const h = harness({value: 'fedora'});
  h.key('ArrowDown'); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-fedora');
  h.key('Home'); h.key('ArrowUp'); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-debian');
  h.key('PageDown'); h.key('ArrowDown'); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-suse');
  h.key('PageUp'); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-debian');
  h.key('End'); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-suse');
  assert.deepEqual(h.changes, []);
});

test('desktop arrows move one column horizontally and one rendered row vertically', () => {
  const h = harness({columns: 2}); h.click();
  for (const [key, id] of [['ArrowRight', 'fedora'], ['ArrowDown', 'alma'], ['ArrowLeft', 'arch'], ['ArrowUp', 'debian']]) {
    assert.equal(h.key(key).defaultPrevented, true);
    assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-' + id);
    assert.equal(h.doc.activeElement, h.picker.trigger);
    assert.equal(h.picker.trigger.dataset.value, 'debian');
    assert.deepEqual(h.changes, []);
  }
  h.key('ArrowDown'); h.key('Enter');
  assert.deepEqual(h.changes, ['arch']);
});

test('mobile arrows all move one option and clamp at both ends', () => {
  const h = harness({columns: 1}); h.click();
  for (const [key, id] of [['ArrowLeft', 'debian'], ['ArrowUp', 'debian'], ['ArrowRight', 'fedora'], ['ArrowDown', 'arch'], ['ArrowUp', 'fedora'], ['ArrowLeft', 'debian']]) {
    assert.equal(h.key(key).defaultPrevented, true);
    assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-' + id);
  }
  h.key('End'); h.key('ArrowRight'); h.key('ArrowDown');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-suse');
  assert.deepEqual(h.changes, []);
});

test('vertical arrows recalculate the row stride when an open picker changes layout', () => {
  const h = harness({value: 'fedora', columns: 2}); h.click(); h.key('ArrowDown');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-alma');
  h.picker.options.forEach((option, index) => { option.rect.top = index * 54; option.rect.left = 0; });
  h.key('ArrowUp');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-arch');
  h.picker.options.forEach((option, index) => { option.rect.top = Math.floor(index / 2) * 54; option.rect.left = (index % 2) * 244; });
  h.key('ArrowDown');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-suse');
  assert.equal(h.picker.trigger.dataset.value, 'fedora');
  assert.deepEqual(h.changes, []);
});

test('desktop arrows clamp incomplete final rows and preserve cancel behavior', () => {
  const h = harness({value: 'alma', columns: 2}); h.click();
  h.key('ArrowDown'); h.key('ArrowDown'); h.key('ArrowRight');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-suse');
  h.key('ArrowUp');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-arch');
  h.key('Escape'); h.click();
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-alma');
  assert.deepEqual(h.changes, []);
});

test('disabled grid cells still count toward the rendered row stride', () => {
  const h = harness({columns: 2});
  h.picker.options[1].setAttribute('aria-disabled', 'true'); h.click(); h.key('ArrowDown');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-arch');
  h.key('ArrowUp'); h.key('ArrowRight');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-arch');
  h.key('ArrowDown');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-suse');
  const blocked = harness({columns: 2});
  blocked.picker.options[2].setAttribute('aria-disabled', 'true');
  blocked.picker.options[4].setAttribute('aria-disabled', 'true'); blocked.click();
  blocked.key('ArrowDown');
  assert.equal(blocked.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-alma');
  blocked.key('ArrowDown');
  assert.equal(blocked.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-alma');
  assert.deepEqual(h.changes, []); assert.deepEqual(blocked.changes, []);
});

test('horizontal arrows open on the committed value and reset a typed prefix', () => {
  for (const key of ['ArrowLeft', 'ArrowRight']) {
    const h = harness({value: 'fedora', columns: 2}); h.key(key);
    assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-fedora');
    h.key('a'); h.key(key); h.key('f');
    assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-fedora');
    assert.deepEqual(h.changes, []);
  }
});

test('vertical arrows fall back to one option when layout cannot be measured', () => {
  const h = harness({columns: 2});
  h.picker.options.forEach(option => { option.rect = {top: 0, left: 0, width: 0, height: 0}; });
  h.click(); h.key('ArrowDown');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-fedora');
});

test('Page navigation jumps ten options rather than always jumping to the end', () => {
  const labels = Array.from({length: 25}, (_, n) => [String(n), `Distribution ${n}`]);
  const h = harness({labels, value: '3'}); h.click(); h.key('PageDown');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-13');
  h.key('PageUp'); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-3');
});

test('typeahead supports prefixes, repeated-letter cycling, timeout and accent folding', () => {
  const h = harness(); h.key('a');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-arch');
  h.key('a'); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-alma');
  h.key('a'); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-arch');
  h.key('d', {timeStamp: 2000}); h.key('e', {timeStamp: 2100});
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-debian');
  h.key('z', {timeStamp: 3000}); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-debian');
  assert.deepEqual(h.changes, []);
  const localized = harness({value: '', labels: [['a', 'Éclair Linux'], ['b', 'Other']]}); localized.key('e');
  assert.equal(localized.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-a');
});

test('shortcut and composing keys neither open nor intercept the picker', () => {
  const h = harness();
  for (const extra of [{ctrlKey: true}, {metaKey: true}, {altKey: true}, {isComposing: true}]) {
    assert.equal(h.key('f', extra).defaultPrevented, false); assert.equal(h.picker.list.hidden, true);
  }
  h.key('ArrowDown', {altKey: true}); h.key('End'); h.key('ArrowUp', {altKey: true});
  assert.deepEqual(h.changes, ['suse']); assert.equal(h.picker.list.hidden, true);
});

test('a missing committed value opens first option without claiming it is selected', () => {
  const h = harness({value: ''}); h.key('Enter');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-debian');
  assert.equal(h.picker.options.some(option => option.getAttribute('aria-selected') === 'true'), false);
  h.key('Enter'); assert.deepEqual(h.changes, ['debian']);
});

test('disabled options cannot receive tentative focus or be clicked into selection', () => {
  const h = harness(); h.picker.options[1].setAttribute('aria-disabled', 'true'); h.click(); h.key('ArrowDown');
  assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-arch');
  h.dispatch(h.picker.options[1], 'click'); assert.deepEqual(h.changes, []);
});

test('empty/disabled controls stay closed and stale render references are discarded', () => {
  const h = harness(); h.picker.trigger.disabled = true; h.click(); h.key('ArrowDown');
  assert.equal(h.picker.list.hidden, true);
  h.picker.trigger.disabled = false; h.click(); const old = h.picker;
  h.render('arch'); h.click();
  assert.equal(old.list.hidden, true); assert.equal(h.picker.trigger.getAttribute('aria-activedescendant'), 'distro-option-arch');
  const empty = harness({labels: []}); empty.click(); assert.equal(empty.picker.list.hidden, true);
});

test('rebinding/disposal removes document and root listeners and never duplicates commits', () => {
  const h = harness(); h.click(); const dispose = bindDistroPicker(h.root, h.changed);
  assert.equal(h.picker.list.hidden, true);
  for (const [node, type] of [[h.root, 'keydown'], [h.root, 'click'], [h.root, 'focusout'], [h.doc, 'pointerdown']]) {
    assert.equal(node.listeners.get(type).length, 1);
  }
  h.dispose(); // Disposing an older binding must not remove the current one.
  h.click(); h.key('End'); h.key('Enter'); assert.deepEqual(h.changes, ['suse']);
  dispose(); h.click(); assert.equal(h.picker.list.hidden, true);
  assert.equal(h.doc.listeners.get('pointerdown').length, 0);
});
