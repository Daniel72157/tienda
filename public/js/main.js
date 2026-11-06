import { bindDialogs, qs } from './dom.js';
import { initCatalog } from './catalog.js';
import { initCart } from './cart.js';
import { initAuth, refreshSession } from './auth.js';
import { initCheckout } from './checkout.js';
import { initSearch } from './search.js';
import { initNewsletter } from './newsletter.js';

const THEME_KEY = 'nova-theme';

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // El almacenamiento puede estar bloqueado; el tema solo dura la sesión.
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  qs('#btn-theme').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(readStoredTheme() || (prefersDark ? 'dark' : 'light'));
  qs('#btn-theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storeTheme(next);
  });
}

function initReveal() {
  const targets = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  targets.forEach((target) => observer.observe(target));
}

async function start() {
  bindDialogs();
  initTheme();
  initReveal();
  qs('#year').textContent = String(new Date().getFullYear());

  initCart();
  initAuth();
  initCheckout();
  initSearch();
  initNewsletter();

  await refreshSession().catch(() => undefined);
  await initCatalog();
}

start();
