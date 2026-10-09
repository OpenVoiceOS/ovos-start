const bindings = new WeakMap();
const TYPEAHEAD_MS = 700;

/** Normalize a visible option label for case- and accent-insensitive matching.
 * @param {string} value Visible label or typed character. @returns {string}
 */
function normalized(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

/** Bind one delegated select-only distribution picker to a stable wizard root.
 * The button retains DOM focus; .active/aria-activedescendant track the tentative
 * option, while aria-selected and dataset.value retain the committed choice.
 * Enter/Space or an option click commit. Escape, outside pointerdown, focusout,
 * and Tab cancel. Tab deliberately does NOT commit or prevent its default action:
 * onChange synchronously replaces the trigger, which would disrupt native Tab.
 * This differs from the WAI APG example's commit-on-Tab/focusout model.
 * The owner renders the selected label and refocuses its replacement trigger.
 * Rebinding first removes old listeners; no binding is needed after a render.
 * @param {HTMLElement} root Stable wizard container.
 * @param {(value: string) => void} onChange Commit callback, allowed to rerender.
 * @returns {() => void} Remove listeners and close any open popup.
 */
export function bindDistroPicker(root, onChange) {
  if (!root?.ownerDocument || typeof onChange !== 'function') {
    throw new TypeError('A wizard root and change callback are required.');
  }
  bindings.get(root)?.();
  const doc = root.ownerDocument;
  let current = null, search = '', lastTyped = -Infinity;

  /** Clear the tentative choice without changing the committed selection.
   * @returns {void}
   */
  function close() {
    if (current) {
      current.trigger.setAttribute('aria-expanded', 'false');
      current.trigger.removeAttribute('aria-activedescendant');
      current.list.hidden = true;
      current.options.forEach(option => option.classList.remove('active'));
    }
    current = null;
    search = '';
    lastTyped = -Infinity;
  }

  /** Discard nodes from a previous synchronous render. @returns {void} */
  function discardDetached() {
    if (current && (!root.contains(current.trigger) || !root.contains(current.list))) close();
  }

  /** Move visual focus and keep its active descendant visible.
   * @param {number} index Requested option index. @returns {void}
   */
  function activate(index) {
    if (!current) return;
    current.index = Math.max(0, Math.min(current.options.length - 1, index));
    current.options.forEach((option, at) => option.classList.toggle('active', at === current.index));
    const option = current.options[current.index];
    current.trigger.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
  }

  /** Move by one rendered row, measuring again after responsive layout changes.
   * Disabled items retain their grid cells but cannot become active descendants.
   * @param {number} direction One row forward (1) or backward (-1).
   * @returns {number} Enabled option index, clamped to the available choices.
   */
  function verticalIndex(direction) {
    const {items, options, index} = current;
    const first = items[0].getBoundingClientRect();
    let stride = 1;
    if (first.width > 0 && first.height > 0) {
      const nextRow = items.findIndex(item => Math.abs(item.getBoundingClientRect().top - first.top) > 1);
      stride = nextRow < 0 ? items.length : Math.max(1, nextRow);
    }
    let destination = Math.max(0, Math.min(items.length - 1, items.indexOf(options[index]) + direction * stride));
    while (destination >= 0 && destination < items.length) {
      const enabledIndex = options.indexOf(items[destination]);
      if (enabledIndex >= 0) return enabledIndex;
      destination += direction;
    }
    return index;
  }

  /** Open a valid listbox using its committed choice, or its first option.
   * @param {HTMLElement} trigger Combobox button. @returns {boolean} Popup open.
   */
  function open(trigger) {
    discardDetached();
    if (current?.trigger === trigger) return true;
    close();
    const wrapper = trigger.closest('[data-distro-picker]');
    const list = doc.getElementById(trigger.getAttribute('aria-controls'));
    if (trigger.disabled || !root.contains(trigger) || !wrapper || !list || !wrapper.contains(list)) return false;
    const items = [...list.querySelectorAll('[data-distro-option]')].filter(option => option.id);
    const options = items.filter(option => option.getAttribute('aria-disabled') !== 'true');
    if (!options.length) return false;
    options.forEach(option => option.setAttribute('aria-selected', String(option.dataset.value === trigger.dataset.value)));
    current = {trigger, wrapper, list, items, options, index: 0};
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.focus({preventScroll: true});
    activate(Math.max(0, options.findIndex(option => option.dataset.value === trigger.dataset.value)));
    return true;
  }

  /** Commit exactly once, closing before the callback can replace the DOM.
   * @param {HTMLElement} option Selected option. @returns {void}
   */
  function commit(option) {
    if (!current || !current.options.includes(option)) return;
    const {trigger, options} = current;
    const value = option.dataset.value;
    const changed = value !== trigger.dataset.value;
    trigger.dataset.value = value;
    options.forEach(item => item.setAttribute('aria-selected', String(item === option)));
    close();
    // A same-value selection needs neither a rerender nor a prerequisite reset.
    if (changed) onChange(value);
  }

  /** Match a typed prefix; repeated single characters cycle among matches.
   * @param {string} character Printable key. @param {number} time Event timestamp.
   * @returns {void}
   */
  function typeahead(character, time) {
    const key = normalized(character);
    if (!key || !current) return;
    search = time - lastTyped <= TYPEAHEAD_MS ? search + key : key;
    lastTyped = time;
    const repeated = [...search].every(letter => letter === key);
    const prefix = repeated ? key : search;
    const start = current.index + (prefix.length === 1 ? 1 : 0);
    for (let offset = 0; offset < current.options.length; offset++) {
      const index = (start + offset) % current.options.length;
      if (normalized(current.options[index].textContent).startsWith(prefix)) {
        activate(index);
        return;
      }
    }
  }

  /** Handle keys on the trigger without native button activation or page scroll.
   * @param {KeyboardEvent} event Delegated keyboard event. @returns {void}
   */
  function keydown(event) {
    discardDetached();
    const trigger = event.target.closest?.('[data-prerequisite-system]');
    if (!trigger || !trigger.closest('[data-distro-picker]') || trigger.disabled || event.isComposing) return;
    if (event.key === 'Tab') { close(); return; }
    if (event.ctrlKey || event.metaKey) return;
    const wasOpen = current?.trigger === trigger;
    if (event.key === 'Escape') {
      if (wasOpen) { event.preventDefault(); close(); }
      return;
    }
    if (event.altKey && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.repeat) return;
      if (wasOpen) commit(current.options[current.index]);
      else open(trigger);
      return;
    }
    const navigation = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageDown', 'PageUp'];
    if (navigation.includes(event.key)) {
      event.preventDefault();
      if (event.altKey && event.key === 'ArrowUp') {
        if (wasOpen) commit(current.options[current.index]);
        return;
      }
      if (!open(trigger)) return;
      search = ''; lastTyped = -Infinity;
      if (event.altKey) return;
      const destination = {
        ArrowDown: wasOpen && event.key === 'ArrowDown' ? verticalIndex(1) : current.index,
        ArrowUp: wasOpen && event.key === 'ArrowUp' ? verticalIndex(-1) : 0,
        ArrowRight: wasOpen ? current.index + 1 : current.index,
        ArrowLeft: wasOpen ? current.index - 1 : current.index,
        Home: 0, End: current.options.length - 1,
        PageDown: current.index + 10, PageUp: current.index - 10,
      };
      activate(destination[event.key]);
      return;
    }
    if ([...event.key].length === 1 && !event.altKey) {
      event.preventDefault();
      if (open(trigger)) typeahead(event.key, Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now());
    }
  }

  /** Toggle the trigger or commit a clicked option, including AT activation.
   * @param {MouseEvent} event Delegated click. @returns {void}
   */
  function click(event) {
    discardDetached();
    const option = event.target.closest?.('[data-distro-option]');
    if (option && current?.options.includes(option)) {
      event.preventDefault();
      commit(option);
      return;
    }
    const trigger = event.target.closest?.('[data-prerequisite-system]');
    if (!trigger || !trigger.closest('[data-distro-picker]') || trigger.disabled) return;
    event.preventDefault();
    if (current?.trigger === trigger) close();
    else open(trigger);
  }

  /** Keep option presses from moving DOM focus; outside presses only cancel.
   * @param {PointerEvent} event Document pointer event. @returns {void}
   */
  function pointerdown(event) {
    discardDetached();
    if (!current) return;
    if (!current.wrapper.contains(event.target)) { close(); return; }
    const option = event.target.closest?.('[data-distro-option]');
    if (option && current.options.includes(option)) event.preventDefault();
  }

  /** Leaving the widget cancels; native focus navigation remains untouched.
   * @param {FocusEvent} event Delegated focus departure. @returns {void}
   */
  function focusout(event) {
    discardDetached();
    if (current?.wrapper.contains(event.target) && !current.wrapper.contains(event.relatedTarget)) close();
  }

  root.addEventListener('keydown', keydown);
  root.addEventListener('click', click);
  root.addEventListener('focusout', focusout);
  doc.addEventListener('pointerdown', pointerdown, true);
  /** Remove this binding without affecting a newer one. @returns {void} */
  function dispose() {
    close();
    root.removeEventListener('keydown', keydown);
    root.removeEventListener('click', click);
    root.removeEventListener('focusout', focusout);
    doc.removeEventListener('pointerdown', pointerdown, true);
    if (bindings.get(root) === dispose) bindings.delete(root);
  }
  bindings.set(root, dispose);
  return dispose;
}
