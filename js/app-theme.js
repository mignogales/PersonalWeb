// Apps share the public site's preference without importing its page effects.
(() => {
  const key = 'miguel-site-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try { saved = localStorage.getItem(key); } catch { /* Storage is optional. */ }
  const apply = theme => {
    root.dataset.theme = theme;
    document.querySelectorAll('[data-app-theme-toggle]').forEach(button => {
      button.textContent = theme === 'dark' ? 'LIGHT ☀' : 'DARK ☾';
      button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0e17' : '#dff5ff');
    window.dispatchEvent(new Event('app-theme-change'));
  };
  apply(saved === 'dark' || saved === 'light' ? saved : system.matches ? 'dark' : 'light');
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('nav');
    bar.className = 'app-theme-bar';
    bar.setAttribute('aria-label', 'Website and appearance');
    const home = document.createElement('a');
    home.href = '/#running-projects';
    home.textContent = '← MN / APPS';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.appThemeToggle = '';
    button.addEventListener('click', () => {
      saved = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, saved); } catch { /* Keep the in-tab choice. */ }
      apply(saved);
    });
    bar.append(home, button);
    document.body.prepend(bar);
    apply(root.dataset.theme);
  });
  system.addEventListener('change', () => {
    if (saved !== 'light' && saved !== 'dark') apply(system.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    saved = event.newValue;
    apply(saved === 'dark' || saved === 'light' ? saved : system.matches ? 'dark' : 'light');
  });
})();
