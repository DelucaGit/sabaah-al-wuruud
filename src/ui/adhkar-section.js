// Adhkar reader (#/adhkar/:section): one dhikr per full-height snap card,
// starred adhkar first, then book order. A normal dhikr is ticked off with
// "Next"; a 100× dhikr counts taps anywhere on its card. Reading everything
// marks the section done. Daily state (counters, done) is saved through the
// store and starts fresh each day.
import './adhkar.css';
import { store } from '../adapters/storage.js';
import { ensureToday, markDone, isDone, setCounter, getCounter } from '../core/daily.js';
import {
  orderAdhkar, togglePin, increment, reset, hasCounter, readTarget, sectionProgress, COUNTER_REPEAT,
} from '../core/adhkar.js';
import * as haptics from '../adapters/haptics.js';
import { navigate, goBack } from '../router.js';
import { esc, icon, ring, openSheet } from './kit.js';
import { SECTIONS } from './sections.js';

const HOME = '/adhkar';
const RING_SIZE = 78;
const RING_STROKE = 5;
const RING_C = 2 * Math.PI * ((RING_SIZE - RING_STROKE) / 2);
/** Pause on a finished 100× counter before moving on, so the check is seen. */
const ADVANCE_DELAY = 450;

/**
 * @param {HTMLElement} viewEl  The router's view element (already emptied).
 * @param {{ section?: string }} params
 * @returns {(() => void) | undefined} cleanup
 */
export function render(viewEl, { section } = {}) {
  const meta = SECTIONS[section];
  if (!meta) {
    navigate(HOME);
    return undefined;
  }

  // The order is fixed while the screen is open: a newly starred dhikr moves
  // to the front the next time the section opens, not under her thumb.
  const { pinned, rest } = orderAdhkar(meta.adhkar, store.get().pins[section]);
  const list = [...pinned, ...rest];
  const byId = new Map(list.map((d) => [d.id, d]));
  let advanceTimer = null;

  const page = document.createElement('div');
  page.className = 'reader font-ui';
  page.innerHTML = `
    <header class="reader-top">
      <div class="topbar">
        <button type="button" class="icon-btn icon-btn--ghost" data-act="back" aria-label="Back">${icon('back')}</button>
        <h1 class="topbar__title reader-title">${esc(meta.title)}<small class="reader-progress" aria-live="polite"></small></h1>
        <span class="reader-top__spacer" aria-hidden="true"></span>
      </div>
      <div class="reader-bar"><i></i></div>
    </header>
    <div class="reader-snap">
      ${list.map(cardHtml).join('')}
      <section class="reader-card reader-card--end" data-end></section>
    </div>`;
  viewEl.appendChild(page);

  const snap = page.querySelector('.reader-snap');
  const progressEl = page.querySelector('.reader-progress');
  const barEl = page.querySelector('.reader-bar i');
  const endEl = page.querySelector('[data-end]');

  updateProgress();
  const firstUnread = list.find((d) => !read(d));
  if (firstUnread) scrollToCard(cardEl(firstUnread.id), 'auto');

  page.addEventListener('click', onClick);
  return () => {
    clearTimeout(advanceTimer);
    page.removeEventListener('click', onClick);
  };

  // ----- rendering -----

  function cardHtml(dhikr, i) {
    const count = countOf(dhikr);
    const starred = store.get().pins[section]?.includes(dhikr.id) ?? false;
    const counter = hasCounter(dhikr);
    return `
      <section class="reader-card${counter ? ' reader-card--counter' : ''}" data-id="${esc(dhikr.id)}">
        <div class="reader-card__in">
          <div class="reader-card__head">
            <span class="reader-pill">${i + 1} / ${list.length}${dhikr.repeat > 1 ? ` · ×${esc(dhikr.repeat)}` : ''}</span>
            <span class="reader-card__actions">
              ${counter ? `<button type="button" class="reader-round reader-reset" data-act="reset" aria-label="Reset counter"${count > 0 ? '' : ' hidden'}>${icon('reset')}</button>` : ''}
              ${starHtml(starred)}
            </span>
          </div>
          <div class="reader-text">
            <p class="font-adhkar${dhikr.arabic.length < 110 ? ' reader-text--short' : ''}" lang="ar" dir="rtl">${esc(dhikr.arabic)}</p>
          </div>
          <div class="reader-foot">
            <div class="chips reader-chips">
              ${dhikr.virtue ? '<button type="button" class="chip" data-act="sheet" data-kind="virtue">Virtue</button>' : ''}
              ${dhikr.source ? '<button type="button" class="chip" data-act="sheet" data-kind="source">Source</button>' : ''}
            </div>
            ${tapHtml(dhikr, count)}
          </div>
        </div>
      </section>`;
  }

  function starHtml(starred) {
    return `<button type="button" class="reader-round reader-star" data-act="star" aria-pressed="${starred}"`
      + ` aria-label="${starred ? 'Remove star' : 'Star this dhikr'}">${icon(starred ? 'star-filled' : 'star')}</button>`;
  }

  /** The round button: "Next", a count inside a ring (100× only), or a check once read. */
  function tapHtml(dhikr, count) {
    if (count >= readTarget(dhikr)) {
      return `<button type="button" class="reader-tap reader-tap--done" data-act="tap" aria-label="Read. Go to next">${icon('check')}</button>`;
    }
    if (!hasCounter(dhikr)) {
      return '<button type="button" class="reader-tap reader-tap--next" data-act="tap" aria-label="Mark as read and go to next">Next</button>';
    }
    return `<button type="button" class="reader-tap ring-wrap" data-act="tap" aria-label="Count, ${count} of ${COUNTER_REPEAT}">`
      + `${ring(count / COUNTER_REPEAT, RING_SIZE, RING_STROKE)}<b><span class="reader-tap__n">${count}</span><small>of ${COUNTER_REPEAT}</small></b></button>`;
  }

  /** Redraws only the parts of one card that depend on its count. */
  function updateCard(dhikr, count) {
    const card = cardEl(dhikr.id);
    const tap = card.querySelector('.reader-tap');
    const numberEl = tap.querySelector('.reader-tap__n');
    if (numberEl && count < readTarget(dhikr)) {
      // Still counting: move the ring and the number without replacing them.
      numberEl.textContent = String(count);
      tap.querySelector('.ring__fill').setAttribute('stroke-dashoffset', (RING_C * (1 - count / COUNTER_REPEAT)).toFixed(3));
      tap.setAttribute('aria-label', `Count, ${count} of ${COUNTER_REPEAT}`);
    } else {
      tap.outerHTML = tapHtml(dhikr, count);
    }
    const resetBtn = card.querySelector('.reader-reset');
    if (resetBtn) resetBtn.hidden = count === 0;
  }

  /** Top bar, final card, and the automatic "done" once everything is read. */
  function updateProgress() {
    const daily = ensureDaily();
    const p = sectionProgress(list, daily.counters);
    progressEl.textContent = `${p.read} / ${p.total}`;
    barEl.style.width = `${p.fraction * 100}%`;
    if (p.all && !isDone(daily, section, new Date())) {
      store.set((s) => { s.daily = markDone(s.daily, section, new Date()); });
    }
    const state = p.all ? 'all' : String(p.total - p.read);
    if (endEl.dataset.state === state) return;
    endEl.dataset.state = state;
    endEl.innerHTML = p.all
      ? `<div class="reader-finish">
          <div class="reader-finish__orb">${icon(meta.icon)}</div>
          <p class="reader-finish__big">Masha'Allah</p>
          <p><strong>${esc(meta.title)} complete</strong><br><span class="muted">May Allah accept it from you.</span></p>
          <button type="button" class="btn btn-primary" data-act="finish">Finish</button>
        </div>`
      : `<div class="reader-finish">
          <p class="muted">${p.total - p.read} left to read</p>
          <button type="button" class="btn btn-ghost" data-act="done-anyway">Mark as done anyway</button>
        </div>`;
  }

  // ----- behaviour -----

  function onClick(e) {
    const control = e.target.closest('[data-act]');
    const card = e.target.closest('.reader-card[data-id]');
    const dhikr = card ? byId.get(card.dataset.id) : null;
    const act = control?.dataset.act;

    if (act === 'back' || act === 'finish') return goBack(HOME);
    if (act === 'done-anyway') {
      store.set((s) => { s.daily = markDone(s.daily, section, new Date()); });
      return goBack(HOME);
    }
    if (!dhikr) return undefined;
    if (act === 'star') return toggleStar(dhikr, control);
    if (act === 'sheet') return showSheet(dhikr, control.dataset.kind);
    if (act === 'reset') return setCount(dhikr, reset());
    // A 100× card counts wherever it is tapped; other cards only on the button.
    if (act === 'tap' || hasCounter(dhikr)) return tapDhikr(dhikr, act === 'tap');
    return undefined;
  }

  function tapDhikr(dhikr, onButton) {
    const current = countOf(dhikr);
    const { value, reachedTarget } = increment(current, readTarget(dhikr));
    if (value === current) { // already read: the check button just moves on
      if (onButton) advanceFrom(dhikr);
      return;
    }
    setCount(dhikr, value);
    if (!hasCounter(dhikr)) {
      advanceFrom(dhikr);
      return;
    }
    if (reachedTarget) {
      haptics.success();
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(() => advanceFrom(dhikr), ADVANCE_DELAY);
    } else {
      haptics.tap();
    }
  }

  function setCount(dhikr, value) {
    updateCard(dhikr, value); // update the screen before anything else
    store.set((s) => { s.daily = setCounter(s.daily, dhikr.id, value, new Date()); });
    updateProgress();
  }

  /** Scrolls to the next unread dhikr (wrapping round), or the final card. */
  function advanceFrom(dhikr) {
    const i = list.indexOf(dhikr);
    const next = list.slice(i + 1).find((d) => !read(d)) ?? list.find((d) => !read(d));
    scrollToCard(next ? cardEl(next.id) : endEl, reducedMotion() ? 'auto' : 'smooth');
  }

  function toggleStar(dhikr, button) {
    const pins = store.set((s) => { s.pins[section] = togglePin(s.pins[section], dhikr.id); }).pins[section];
    button.outerHTML = starHtml(pins.includes(dhikr.id));
  }

  function showSheet(dhikr, kind) {
    const text = dhikr[kind];
    if (!text) return;
    openSheet({
      title: kind === 'virtue' ? 'Virtue' : 'Source',
      bodyHtml: `<p class="sheet__arabic" lang="ar" dir="rtl">${esc(text)}</p>`,
    });
  }

  // ----- helpers -----

  function countOf(dhikr) {
    return getCounter(ensureDaily(), dhikr.id, new Date());
  }

  function read(dhikr) {
    return countOf(dhikr) >= readTarget(dhikr);
  }

  function cardEl(id) {
    return [...snap.children].find((el) => el.dataset.id === id);
  }

  function scrollToCard(card, behavior) {
    if (!card) return;
    snap.scrollTo({ top: card.offsetTop, behavior });
  }
}

/** Rolls `daily` over to today if needed and returns it. */
function ensureDaily() {
  const { daily } = store.get();
  const today = ensureToday(daily, new Date());
  if (today === daily) return daily;
  return store.set((s) => { s.daily = today; }).daily;
}

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
