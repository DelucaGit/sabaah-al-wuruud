// Adhkar tab: six simple large buttons (Morning, Evening, Before Sleep, Home,
// Travel, Istikhara). Reader sections show a progress ring; the one finished
// today shows a check.
import './adhkar-home.css';
import { store } from '../adapters/storage.js';
import { sectionProgress } from '../core/adhkar.js';
import { ensureToday } from '../core/daily.js';
import { esc, icon, ring } from './kit.js';
import { SECTIONS, SECTION_KEYS, sectionPath } from './sections.js';

function sectionButton(key, today) {
  const section = SECTIONS[key];
  const progress = sectionProgress(section.adhkar, today.counters);
  const done = today.done[key] === true || progress.all;
  return `<a class="ah-card${done ? ' ah-card--done' : ''}" href="#${esc(sectionPath(key))}">
    <span class="ring-wrap">${ring(done ? 1 : progress.fraction, 46, 4)}<b>${icon(done ? 'check' : section.icon)}</b></span>
    <span class="ah-card__title">${esc(section.title)}</span>
    <span class="ah-card__go">${icon('forward')}</span>
  </a>`;
}

/**
 * @param {HTMLElement} view  The emptied <main class="app-view">.
 * @returns {() => void} Cleanup: stops the store subscription.
 */
export function render(view) {
  const draw = () => {
    const today = ensureToday(store.get().daily, new Date());
    view.innerHTML = `<div class="screen ah">
      <h1 class="screen-title">Adhkar</h1>
      <div class="ah-list">
        ${SECTION_KEYS.map((key) => sectionButton(key, today)).join('')}
        <a class="ah-card" href="#/istikhara">
          <span class="ah-badge">${icon('sparkle')}</span>
          <span class="ah-card__title">Salat al-Istikhara</span>
          <span class="ah-card__go">${icon('forward')}</span>
        </a>
      </div>
    </div>`;
  };
  draw();
  return store.subscribe(draw);
}
