// Shared UI kit: small helpers that return HTML strings (esc, icon, ring) and
// two overlays (openSheet, toast). Plain DOM, no framework. Importing this
// module (the router does) also loads the shared classes in kit.css.
import './kit.css';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * HTML-escapes a value so it is safe as text or inside a quoted attribute.
 * Always use it for user-entered text (name, location) and data strings.
 * @param {unknown} text  null/undefined become ''.
 * @returns {string}
 */
export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const svg = (body, attrs = '') =>
  `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${attrs}>${body}</svg>`;

const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>';

const ICONS = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  sunset: svg('<path d="M5 17a7 7 0 0 1 14 0M2 17h20M7 21h10M12 3v4M4.2 8.8l1.5 1.5M19.8 8.8l-1.5 1.5"/>'),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  bed: svg('<path d="M3 6v13M3 16h18v3M21 16v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="12" r="2"/>'),
  sparkle: svg('<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
  book: svg('<path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13"/>'),
  home: svg('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  beads: svg('<circle cx="12" cy="5" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="17" cy="16" r="2"/><circle cx="7" cy="16" r="2"/><circle cx="6" cy="9" r="2"/><path d="M12 19v3"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
  star: svg(STAR),
  'star-filled': svg(STAR, ' data-filled="true"').replace('fill="none"', 'fill="currentColor"'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  chevron: svg('<path d="M6 9l6 6 6-6"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  forward: svg('<path d="M9 5l7 7-7 7"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  list: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  pin: svg('<path d="M12 21s7-6.1 7-11a7 7 0 0 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
};

/** Every name `icon()` accepts. `sparkle` is the Istikhara icon. */
export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

/**
 * Inline line-icon SVG string. Sized 1em and coloured with currentColor, so
 * set `font-size` and `color` on the parent. Decorative (aria-hidden): give
 * icon-only buttons an aria-label.
 * @param {string} name  One of ICON_NAMES; unknown names return ''.
 * @returns {string}
 */
export function icon(name) {
  return Object.hasOwn(ICONS, name) ? ICONS[name] : '';
}

/**
 * Progress ring SVG string (track + fill, starting at 12 o'clock). To put
 * something in the middle, wrap it: `<span class="ring-wrap">${ring(...)}<b>…</b></span>`.
 * @param {number} fraction  Progress 0..1 (clamped; NaN counts as 0).
 * @param {number} [size=48]  Width and height in px.
 * @param {number} [stroke=4]  Line thickness in px.
 * @returns {string}
 */
export function ring(fraction, size = 48, stroke = 4) {
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  const n = (x) => Number(x.toFixed(3));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`
    + `<circle class="ring__track" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}"/>`
    + `<circle class="ring__fill" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}" `
    + `stroke-dasharray="${n(c)}" stroke-dashoffset="${n(c * (1 - f))}" transform="rotate(-90 ${mid} ${mid})"/>`
    + '</svg>';
}

// --- bottom sheet ------------------------------------------------------------

let closeCurrentSheet = null;

/**
 * Opens a bottom sheet over the whole app. Only one sheet is open at a time
 * (opening a new one closes the previous). Closes on backdrop tap, the close
 * button, Escape, and on navigation (the router calls closeSheet()).
 * @param {{ title: string, bodyHtml: string, onClose?: () => void }} options
 *   `title` is escaped for you. `bodyHtml` is inserted as HTML: escape any
 *   data in it with esc(). Use `<p class="sheet__arabic" lang="ar">` for
 *   Arabic body text.
 * @returns {() => void} close()  Safe to call more than once. The sheet body
 *   element is available as `close.body` for wiring listeners.
 */
export function openSheet({ title, bodyHtml, onClose } = {}) {
  closeSheet();
  const previousFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet__head">
      <h2 class="sheet__title">${esc(title)}</h2>
      <button type="button" class="icon-btn icon-btn--ghost sheet__close" aria-label="Close">${icon('close')}</button>
    </div>
    <div class="sheet__body">${bodyHtml ?? ''}</div>
  </div>`;

  let open = true;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    if (!open) return;
    open = false;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (closeCurrentSheet === close) closeCurrentSheet = null;
    if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) previousFocus.focus();
    if (typeof onClose === 'function') onClose();
  }
  close.body = backdrop.querySelector('.sheet__body');

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('.sheet__close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
  backdrop.querySelector('.sheet__close').focus();
  closeCurrentSheet = close;
  return close;
}

/** Closes the open bottom sheet, if any. */
export function closeSheet() {
  if (closeCurrentSheet) closeCurrentSheet();
}

// --- toast -------------------------------------------------------------------

let toastEl = null;
let toastTimer = null;

/**
 * Shows a short message at the bottom of the app (above the tab bar). Only
 * one toast is visible at a time: a new one replaces the old.
 * @param {string} message  Plain text (escaped for you).
 * @param {{ actionLabel?: string, onAction?: () => void, duration?: number }} [options]
 *   With `actionLabel` + `onAction` the toast gets a button (e.g. "Undo");
 *   tapping it runs onAction and dismisses the toast. `duration` is in ms
 *   (default 4000).
 * @returns {() => void} dismiss()
 */
export function toast(message, { actionLabel, onAction, duration = 4000 } = {}) {
  dismissToast();
  const el = document.createElement('div');
  el.className = 'toast-host';
  const hasAction = Boolean(actionLabel) && typeof onAction === 'function';
  el.innerHTML = `<div class="toast" role="status"><span>${esc(message)}</span>${
    hasAction ? `<button type="button" class="toast__action">${esc(actionLabel)}</button>` : ''}</div>`;
  if (hasAction) {
    el.querySelector('.toast__action').addEventListener('click', () => {
      dismissToast();
      onAction();
    });
  }
  (document.getElementById('app') ?? document.body).appendChild(el);
  toastEl = el;
  toastTimer = setTimeout(dismissToast, duration);
  return () => { if (toastEl === el) dismissToast(); };
}

function dismissToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  toastEl?.remove();
  toastEl = null;
}
