// Tiny hash router with a bottom tab bar. Routes:
//   #/                     -> today        (tab: Today)
//   #/adhkar               -> adhkar-home  (tab: Adhkar)
//   #/quran                -> quran        (tab: Qur'an)
//   #/settings             -> settings     (tab: Me)
//   #/adhkar/:section      -> reader (morning | evening | sleep), no tab bar
//   #/istikhara            -> istikhara, no tab bar
// Anything else goes to #/.
//
// Screen contract: each screen module exports `render(viewEl, params)`. It
// fills `viewEl` (already emptied) and may return a cleanup function, which
// is called before the next screen renders.
import { icon, closeSheet } from './ui/kit.js';
import { SECTION_KEYS } from './ui/sections.js';
import * as today from './ui/today.js';
import * as adhkarHome from './ui/adhkar-home.js';
import * as quran from './ui/quran.js';
import * as adhkarSection from './ui/adhkar-section.js';
import * as istikhara from './ui/istikhara.js';
import * as settings from './ui/settings.js';

/** The four tabs, in order. `key` matches the `tab` field of resolve(). */
export const TABS = Object.freeze([
  { key: 'today', path: '/', icon: 'home', label: 'Today' },
  { key: 'adhkar', path: '/adhkar', icon: 'beads', label: 'Adhkar' },
  { key: 'quran', path: '/quran', icon: 'book', label: "Qur'an" },
  { key: 'me', path: '/settings', icon: 'user', label: 'Me' },
]);

const HOME = { name: 'today', screen: today, params: {}, tab: 'today' };

/**
 * Maps a location hash to a route.
 * @param {string} hash  e.g. '#/adhkar/morning'
 * @returns {{ name: string, screen: { render: Function }, params: object, tab: string|null }}
 *   `tab` is the active tab key, or null when the tab bar is hidden.
 *   Unknown hashes resolve to the today route.
 */
export function resolve(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 1) {
    if (parts[0] === 'adhkar') return { name: 'adhkar-home', screen: adhkarHome, params: {}, tab: 'adhkar' };
    if (parts[0] === 'quran') return { name: 'quran', screen: quran, params: {}, tab: 'quran' };
    if (parts[0] === 'settings') return { name: 'settings', screen: settings, params: {}, tab: 'me' };
    if (parts[0] === 'istikhara') return { name: 'istikhara', screen: istikhara, params: {}, tab: null };
  }
  if (parts.length === 2 && parts[0] === 'adhkar' && SECTION_KEYS.includes(parts[1])) {
    return { name: 'reader', screen: adhkarSection, params: { section: parts[1] }, tab: null };
  }
  return { ...HOME };
}

/**
 * Goes to a path such as '/adhkar/morning'. Re-renders when already there.
 * @param {string} path  With or without the leading '#'.
 */
export function navigate(path) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

/** Hash of the screen shown before the current one, '' at app start. */
let previousHash = '';
let currentHash = '';

/**
 * Leaves a full-screen screen (reader, Istikhara) for `path`. Pops the history
 * entry when we came from `path`, otherwise replaces the current one, so the
 * system back button never returns to the screen that was just closed.
 * @param {string} path  With or without the leading '#'.
 */
export function goBack(path) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (previousHash === target) history.back();
  else location.replace(target);
}

/**
 * Builds the app frame inside `rootEl` (`<main class="app-view">` plus
 * `<nav class="tabbar">`) and renders the screen for the current hash, now
 * and on every hash change.
 * @param {HTMLElement} rootEl  The #app element.
 */
export function start(rootEl) {
  rootEl.innerHTML = '';
  const view = document.createElement('main');
  view.className = 'app-view';
  const tabbar = document.createElement('nav');
  tabbar.className = 'tabbar';
  tabbar.setAttribute('aria-label', 'Main');
  tabbar.innerHTML = TABS.map((t) =>
    `<a class="tab" href="#${t.path}" data-tab="${t.key}"><span class="tab__icon">${icon(t.icon)}</span>${t.label}</a>`).join('');
  rootEl.append(view, tabbar);

  let cleanup = null;
  const render = () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    closeSheet();
    if (location.hash !== currentHash) {
      previousHash = currentHash;
      currentHash = location.hash;
    }
    const route = resolve(location.hash);
    tabbar.hidden = route.tab === null;
    rootEl.classList.toggle('has-tabbar', route.tab !== null);
    for (const link of tabbar.children) {
      if (link.dataset.tab === route.tab) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    view.innerHTML = '';
    cleanup = route.screen.render(view, route.params) || null;
    view.scrollTop = 0;
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', render);
  render();
}
