(function () {
  const KEY = 'theme';
  const root = document.documentElement;

  function set(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    document.querySelectorAll('.theme-toggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const current = root.getAttribute('data-theme') || 'light';
    document.querySelectorAll('.theme-toggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === current);
      b.addEventListener('click', () => set(b.dataset.theme));
    });
  });
})();
