// Tiny hash router. Routes:
//   #/                     -> home
//   #/adhkar/:section      -> morning | evening | sleep
//   #/istikhara            -> istikhara
//   #/settings             -> settings
import * as home from './ui/home.js';
import * as adhkarSection from './ui/adhkar-section.js';
import * as istikhara from './ui/istikhara.js';
import * as settings from './ui/settings.js';

const SECTIONS = ['morning', 'evening', 'sleep'];

export function resolve(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { screen: home, params: {} };
  if (parts[0] === 'adhkar' && SECTIONS.includes(parts[1])) {
    return { screen: adhkarSection, params: { section: parts[1] } };
  }
  if (parts[0] === 'istikhara' && parts.length === 1) return { screen: istikhara, params: {} };
  if (parts[0] === 'settings' && parts.length === 1) return { screen: settings, params: {} };
  return { screen: home, params: {} };
}

export function navigate(path) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

export function start(rootEl) {
  let cleanup = null;
  const render = () => {
    if (typeof cleanup === 'function') cleanup();
    rootEl.innerHTML = '';
    const { screen, params } = resolve(location.hash);
    cleanup = screen.render(rootEl, params) || null;
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', render);
  render();
}
