/** Apply the saved appearance before styles paint, without touching wizard choices. */
(() => {
  const key = 'ovos.theme.v1';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let storage = null;
  let preference = null;
  let button = null;

  /** Accept only known appearance values. @param {unknown} value @returns {string|null} */
  function valid(value) { return value === 'light' || value === 'dark' ? value : null; }
  try {
    storage = window.localStorage;
    preference = valid(storage.getItem(key));
  } catch { /* Appearance still works when storage is blocked. */ }

  /** Apply appearance and describe the toggle's next action. @returns {void} */
  function apply() {
    const theme = preference || (system.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === 'dark' ? '#10151c' : '#f5f4f0';
    if (button) {
      const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      window.dispatchEvent(new Event('ovos-theme-change'));
    }
  }

  /** Change appearance immediately; persistence is best effort. @returns {void} */
  function toggle() {
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { storage?.setItem(key, preference); } catch { /* Keep the current in-memory choice. */ }
    apply();
  }

  /** Bind the header after it exists. @returns {void} */
  function mount() {
    button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    button.hidden = false;
    button.addEventListener('click', toggle);
    apply();
  }

  system.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    if (event.storageArea && event.storageArea !== storage) return;
    preference = valid(event.key === null ? null : event.newValue);
    apply();
  });
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
