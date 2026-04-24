(function () {
  const root = document.documentElement;
  const PREFS = {
    theme: { key: 'theme', attr: 'data-theme', default: 'light' },
    font:  { key: 'font',  attr: 'data-font',  default: 'vt323' },
  };

  function apply(kind, value) {
    const p = PREFS[kind];
    root.setAttribute(p.attr, value);
    try { localStorage.setItem(p.key, value); } catch (e) {}
    document.querySelectorAll('.seg[data-control="' + kind + '"] button').forEach(b => {
      b.classList.toggle('active', b.dataset.value === value);
    });
  }

  function current(kind) {
    const p = PREFS[kind];
    return root.getAttribute(p.attr) || p.default;
  }

  document.addEventListener('DOMContentLoaded', () => {
    Object.keys(PREFS).forEach(kind => {
      const value = current(kind);
      document.querySelectorAll('.seg[data-control="' + kind + '"] button').forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
        b.addEventListener('click', () => apply(kind, b.dataset.value));
      });
    });
  });
})();
