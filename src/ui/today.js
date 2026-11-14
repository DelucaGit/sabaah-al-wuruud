// Today screen: date (Gregorian + Hijri), greeting, a prayer dial with the
// next prayer and a countdown, all five prayer times, and a reflection verse
// with its tafsir from the last memorized page.
import './today.css';
import { store } from '../adapters/storage.js';
import { nextPrayer, getNightTimes } from '../core/prayer.js';
import { pickReflectionVerse } from '../core/memorization.js';
import { navigate } from '../router.js';
import { esc, icon } from './kit.js';
import {
  PRAYER_KEYS, PRAYER_LABELS, prayerLocation, formatTime, todayPrayerTimes,
} from './prayer-view.js';

const REFRESH_MS = 30_000;

// --- Quran data (lazy, separate chunk) ---------------------------------------

let quranPromise = null;
function loadQuran() {
  quranPromise ??= Promise.all([
    import('../data/quran/pages.json'),
    import('../data/quran/surahs.json'),
    import('../data/quran/tafsir-muyassar.json'),
  ]).then(([pages, surahs, tafsir]) => ({
    pages: pages.default,
    surahs: surahs.default,
    tafsir: tafsir.default,
  }));
  quranPromise.catch(() => { quranPromise = null; });
  return quranPromise;
}

// The reflection verse is picked once per app open (and again only when the
// memorized page changes), so it stays the same while moving between tabs.
let reflection = null; // { upTo, verse }
function reflectionFor(progress, pages) {
  if (!reflection || reflection.upTo !== progress.memorizedUpTo) {
    reflection = { upTo: progress.memorizedUpTo, verse: pickReflectionVerse(progress, pages) };
  }
  return reflection.verse;
}

// --- pure HTML builders ------------------------------------------------------

/** "Thursday, November 12" plus the Hijri date, in the prayer location's zone. */
function dateHtml(now, settings) {
  const { timeZone } = prayerLocation(settings);
  const zone = timeZone ? { timeZone } : {};
  const greg = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', ...zone,
  }).format(now);
  let hijri = '';
  try {
    hijri = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric', ...zone,
    }).format(now);
  } catch {
    // Islamic calendar not available in this browser: show the weekday only.
  }
  return `<b>${esc(greg)}</b>${hijri ? `<span>${esc(hijri)}</span>` : ''}`;
}

/** "in 1 h 12 min" / "in 12 min" / "now". */
function countdown(target, now) {
  const minutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
  if (minutes === 0) return 'now';
  const h = Math.floor(minutes / 60);
  return h ? `in ${h} h ${minutes % 60} min` : `in ${minutes} min`;
}

/** The current next prayer, or null when it cannot be computed. */
function findNext(settings, now) {
  try {
    return nextPrayer(now, prayerLocation(settings));
  } catch {
    return null;
  }
}

/** Semicircle from Fajr (left) to Isha (right) with a dot for now. */
function dialHtml(times, next, now, settings) {
  const start = times.fajr.getTime();
  const end = times.isha.getTime();
  const frac = (ms) => (end > start ? Math.min(1, Math.max(0, (ms - start) / (end - start))) : 0);
  const n = (x) => Number(x.toFixed(2));
  const point = (f) => [n(150 - 120 * Math.cos(Math.PI * f)), n(150 - 120 * Math.sin(Math.PI * f))];
  const f = frac(now.getTime());
  const [nowX, nowY] = point(f);
  const marks = PRAYER_KEYS.map((key) => {
    const [x, y] = point(frac(times[key].getTime()));
    const isNext = key === next.name;
    return `<circle class="today-dial__mark${isNext ? ' today-dial__mark--next' : ''}" cx="${x}" cy="${y}" r="${isNext ? 5.5 : 3.5}"/>`;
  }).join('');
  const arc = 'M30 150 A120 120 0 0 1 270 150';
  return `<section class="card today-dial" aria-label="Next prayer">
    <svg viewBox="0 0 300 168" aria-hidden="true">
      <path class="today-dial__track" d="${arc}"/>
      <path class="today-dial__fill" d="${arc}" pathLength="1" stroke-dasharray="${n(f)} 1"/>
      ${marks}
      <circle class="today-dial__now" cx="${nowX}" cy="${nowY}" r="11"/>
    </svg>
    <div class="today-dial__center">
      <span class="section-label">Next prayer</span>
      <strong>${PRAYER_LABELS[next.name]}</strong>
      <span class="muted"><b>${countdown(next.time, now)}</b> · ${esc(formatTime(next.time, settings))}</span>
    </div>
  </section>`;
}

/** All five times in five columns, the next one highlighted. */
function timesRowHtml(times, next, settings) {
  const items = PRAYER_KEYS.map((key) => {
    const isNext = key === next.name;
    const time = formatTime(times[key], settings).replace(/\s?(AM|PM)$/i, '');
    return `<li class="today-times__item${isNext ? ' today-times__item--next' : ''}"${isNext ? ' aria-current="true"' : ''}>${PRAYER_LABELS[key]}<b>${esc(time)}</b></li>`;
  }).join('');
  return `<ul class="today-times" aria-label="Today's prayer times">${items}</ul>`;
}

/** Middle of the night and the last third, with a tahajjud hint. */
function nightRowsHtml(now, settings) {
  let night;
  try {
    night = getNightTimes(now, prayerLocation(settings));
  } catch {
    return '';
  }
  if (!night || Number.isNaN(night.middle.getTime())) return '';
  return `<ul class="today-night" aria-label="The night">
    <li class="today-night__row"><span>Middle of the night</span><b>${esc(formatTime(night.middle, settings))}</b></li>
    <li class="today-night__row today-night__row--best"><span>Last third<small>Best time for tahajjud and dua</small></span><b>${esc(formatTime(night.lastThirdStart, settings))}</b></li>
  </ul>`;
}

function prayersHtml(settings, now) {
  const times = todayPrayerTimes(settings, now);
  const next = times ? findNext(settings, now) : null;
  if (!times || !next) {
    return `<section class="card today-note">
      <p class="muted">Prayer times are not available for this location.</p>
      <a class="today-link" href="#/settings">Change location in Me ${icon('arrow')}</a>
    </section>`;
  }
  return dialHtml(times, next, now, settings) + timesRowHtml(times, next, settings) + nightRowsHtml(now, settings);
}

const REFLECTION_LABEL = "Today's reflection";

function reflectionShell(label, bodyHtml) {
  return `<p class="section-label">${esc(label)}</p>${bodyHtml}`;
}

function verseHtml(verse, surahs, tafsir) {
  if (!verse) return reflectionShell(REFLECTION_LABEL, '<p class="muted today-reflect__note">No verse found for this page.</p>');
  const surah = surahs.find((x) => x.number === verse.s);
  const tafsirText = tafsir[`${verse.s}:${verse.a}`] ?? '';
  return reflectionShell(`${REFLECTION_LABEL} · page ${verse.page}`, `
    <p class="today-reflect__ayah font-quran" lang="ar" dir="rtl">${esc(verse.text)}</p>
    <p class="today-reflect__ref" lang="ar" dir="rtl">سورة ${esc(surah ? surah.nameAr : verse.s)} · آية ${esc(verse.a.toLocaleString('ar-EG'))}</p>
    <h2 class="today-reflect__tafsir-title" lang="ar" dir="rtl">التفسير الميسر</h2>
    <p class="today-reflect__tafsir font-adhkar" lang="ar" dir="rtl">${esc(tafsirText)}</p>`);
}

// --- render ------------------------------------------------------------------

/**
 * @param {HTMLElement} view  The emptied <main class="app-view">.
 * @returns {() => void} Cleanup: stops the timer and the store subscription.
 */
export function render(view) {
  view.innerHTML = `<div class="screen today">
    <p class="today-date"></p>
    <h1 class="today-hello"></h1>
    <div class="today-prayers"></div>
    <section class="card today-reflect" aria-label="${REFLECTION_LABEL}"></section>
  </div>`;
  const dateEl = view.querySelector('.today-date');
  const helloEl = view.querySelector('.today-hello');
  const prayersEl = view.querySelector('.today-prayers');
  const reflectEl = view.querySelector('.today-reflect');
  let alive = true;
  let shownUpTo = null; // memorizedUpTo the reflection card was painted for

  function paintTop(state) {
    const now = new Date();
    dateEl.innerHTML = dateHtml(now, state.settings);
    helloEl.innerHTML = `<span>Assalamu alaikum,</span>${esc(state.settings.name)} 🤍`;
    prayersEl.innerHTML = prayersHtml(state.settings, now);
  }

  function paintReflection(state) {
    const upTo = state.progress.memorizedUpTo;
    if (upTo === shownUpTo) return;
    shownUpTo = upTo;
    if (upTo === 0) {
      reflectEl.innerHTML = reflectionShell(REFLECTION_LABEL, `
        <p class="muted today-reflect__note">Once you mark a page as memorized, a verse from it will be waiting for you here.</p>
        <button type="button" class="btn btn-primary today-reflect__cta">Go to Qur'an ${icon('arrow')}</button>`);
      reflectEl.querySelector('.today-reflect__cta').addEventListener('click', () => navigate('/quran'));
      return;
    }
    // Skip the placeholder when the verse is already cached (tab switches).
    if (!reflection || reflection.upTo !== upTo) {
      reflectEl.innerHTML = reflectionShell(REFLECTION_LABEL, '<p class="muted today-reflect__note">Loading…</p>');
    }
    loadQuran().then(({ pages, surahs, tafsir }) => {
      if (!alive || shownUpTo !== upTo) return;
      reflectEl.innerHTML = verseHtml(reflectionFor(state.progress, pages), surahs, tafsir);
    }).catch(() => {
      if (!alive || shownUpTo !== upTo) return;
      shownUpTo = null; // try again on the next repaint
      reflectEl.innerHTML = reflectionShell(REFLECTION_LABEL, '<p class="muted today-reflect__note">Could not load the Qur\'an text.</p>');
    });
  }

  function paintAll() {
    const state = store.get();
    paintTop(state);
    paintReflection(state);
  }

  paintAll();
  const unsubscribe = store.subscribe(() => { if (alive) paintAll(); });
  // Keep the dial, the countdown and the highlighted prayer current.
  const timer = setInterval(() => paintTop(store.get()), REFRESH_MS);

  return () => {
    alive = false;
    unsubscribe();
    clearInterval(timer);
  };
}
