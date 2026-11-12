// Adhkar tab: "Your day" as a vertical timeline (prayer times with the
// morning, evening and sleep adhkar placed where they belong, plus a "now"
// marker) and an "Anytime" row for Salat al-Istikhara.
import './adhkar-home.css';
import { store } from '../adapters/storage.js';
import { dayTimeline } from '../core/timeline.js';
import { sectionProgress } from '../core/adhkar.js';
import { ensureToday } from '../core/daily.js';
import { esc, icon, ring } from './kit.js';
import { SECTIONS, SECTION_KEYS, sectionPath } from './sections.js';
import { PRAYER_LABELS, formatTime, todayPrayerTimes } from './prayer-view.js';

const MINUTE_MS = 60_000;

/**
 * One section card: icon in a progress ring, title, when-text and status.
 * @param {'morning'|'evening'|'sleep'} key
 * @param {{ done: Record<string, boolean>, counters: Record<string, number> }} today
 * @param {boolean} active  Lifted (gradient + "Now" pill).
 */
function sectionCard(key, today, active) {
  const section = SECTIONS[key];
  const progress = sectionProgress(section.adhkar, today.counters);
  const done = today.done[key] === true || progress.all;
  const status = done ? 'Completed today' : `${progress.read} of ${progress.total} read`;
  return `<a class="ah-card${active ? ' ah-card--active' : ''}${done ? ' ah-card--done' : ''}" href="#${esc(sectionPath(key))}">
    <span class="ring-wrap">${ring(done ? 1 : progress.fraction, 46, 4)}<b>${icon(done ? 'check' : section.icon)}</b></span>
    <span class="ah-card__text">
      <strong>${esc(section.title)}${active ? ' <span class="ah-pill">Now</span>' : ''}</strong>
      <span class="ah-card__sub">${esc(section.when)} · ${esc(status)}</span>
    </span>
    <span class="ah-card__go">${icon('forward')}</span>
  </a>`;
}

function prayerRow(item, settings) {
  const cls = item.past ? ' ah-prayer--past' : item.next ? ' ah-prayer--next' : '';
  return `<div class="ah-prayer${cls}"><span>${esc(PRAYER_LABELS[item.key])}</span><span>${esc(formatTime(item.time, settings))}</span></div>`;
}

function dayHtml(state, now) {
  const today = ensureToday(state.daily, now);
  const times = todayPrayerTimes(state.settings, now);
  if (!times) {
    // No prayer times: just the three sections in order, none highlighted.
    return `<div class="ah-list">${SECTION_KEYS.map((key) => sectionCard(key, today, false)).join('')}</div>`;
  }
  const rows = dayTimeline(now, times).map((item) => {
    if (item.type === 'now') return '<div class="ah-now">Now</div>';
    if (item.type === 'prayer') return prayerRow(item, state.settings);
    return sectionCard(item.key, today, item.active);
  });
  return `<div class="ah-timeline">${rows.join('')}</div>`;
}

/**
 * @param {HTMLElement} view  The emptied <main class="app-view">.
 * @returns {() => void} Cleanup: stops the store subscription and the timer.
 */
export function render(view) {
  const draw = () => {
    view.innerHTML = `<div class="screen ah">
      <h1 class="screen-title">Adhkar</h1>
      <p class="section-label">Your day</p>
      ${dayHtml(store.get(), new Date())}
      <p class="section-label ah-anytime">Anytime</p>
      <a class="ah-card" href="#/istikhara">
        <span class="ah-badge">${icon('sparkle')}</span>
        <span class="ah-card__text">
          <strong>Salat al-Istikhara</strong>
          <span class="ah-card__sub">When you need guidance</span>
        </span>
        <span class="ah-card__go">${icon('forward')}</span>
      </a>
    </div>`;
  };
  draw();
  const unsubscribe = store.subscribe(draw);
  const timer = setInterval(draw, MINUTE_MS);
  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}
