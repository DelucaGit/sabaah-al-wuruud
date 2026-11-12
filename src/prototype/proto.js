// PROTOTYPE — throwaway. See prototype.html for the question being answered.
// Three structurally different takes on the whole app, same features:
//   A  Focus    — one thing at a time: a "for now" hero, adhkar as a tap-through pager
//   B  My day   — the day as one timeline, adhkar as a check-off list
//   C  Tabs     — bottom tab bar, prayer dial + rings, adhkar as full-height cards
// Uses the real data and core logic; state is in memory only (reload = reset).
import '../styles/fonts.css';
import './proto.css';
import morning from '../data/adhkar/morning.json';
import evening from '../data/adhkar/evening.json';
import sleep from '../data/adhkar/sleep.json';
import istikhara from '../data/adhkar/istikhara.json';
import { getPrayerTimes, nextPrayer, highlightedSection, PRAYER_KEYS } from '../core/prayer.js';
import { orderAdhkar, togglePin } from '../core/adhkar.js';
import { pickReflectionVerse, TOTAL_PAGES } from '../core/memorization.js';

const VARIANTS = { A: 'Focus', B: 'My day', C: 'Tabs' };
const CAIRO = { name: 'Cairo', lat: 30.0444, lng: 31.2357 };

const SEC = {
  morning: { title: 'Morning Adhkar', short: 'Morning', icon: 'sun', when: 'After Fajr', data: morning },
  evening: { title: 'Evening Adhkar', short: 'Evening', icon: 'sunset', when: 'After Asr', data: evening },
  sleep: { title: 'Before Sleep', short: 'Sleep', icon: 'moon', when: 'At bedtime', data: sleep },
};
const SECTIONS = Object.keys(SEC);
const PRAYER_LABELS = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

const S = {
  variant: VARIANTS[new URLSearchParams(location.search).get('variant')] ? new URLSearchParams(location.search).get('variant') : 'A',
  sim: null, // null = live clock | 'morning' | 'evening' | 'night'
  route: { name: 'home' },
  tab: 'today',
  // personal
  name: 'Aisha', accent: 'lavender', theme: 'system', arScale: 1,
  location: { ...CAIRO },
  reminders: {
    morning: { enabled: true, offsetMin: 60 },
    evening: { enabled: true, offsetMin: 60 },
    sleep: { enabled: true, time: '22:00' },
  },
  memorizedUpTo: 12, // seeded so the reflection has something to show
  pins: { morning: [], evening: [], sleep: [] },
  counts: {}, done: {}, pos: {}, open: {},
  timesOpen: false, tafsirOpen: false, sheet: null, anim: false,
  verse: null, verseFor: null, quran: null,
};

// ---------- tiny helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const tabbar = $('#tabbar');
const sheetEl = $('#sheet');
const toastEl = $('#toast');
const switcher = $('#switcher');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };

const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICONS = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  sunset: svg('<path d="M5 17a7 7 0 0 1 14 0M2 17h20M7 21h10M12 3v4M4.2 8.8l1.5 1.5M19.8 8.8l-1.5 1.5"/>'),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  sparkle: svg('<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
  book: svg('<path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13"/>'),
  home: svg('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>'),
  beads: svg('<circle cx="12" cy="5" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="17" cy="16" r="2"/><circle cx="7" cy="16" r="2"/><circle cx="6" cy="9" r="2"/><path d="M12 19v3"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  fwd: svg('<path d="M9 5l7 7-7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  list: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  star: svg('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/>'),
  chevron: svg('<path d="M6 9l6 6 6-6"/>'),
  pin: svg('<path d="M12 21s7-6.1 7-11a7 7 0 0 0-14 0c0 4.900 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>'),
};
const ic = (name, extra = '') => `<span class="ic ${extra}">${ICONS[name]}</span>`;

function ring(pct, size, stroke) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<svg class="r" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, pct))}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

// ---------- time & prayer ----------
function loc() {
  const l = S.location;
  return l.lat === CAIRO.lat && l.lng === CAIRO.lng ? { ...l, timeZone: 'Africa/Cairo' } : { ...l };
}
function now() {
  const real = new Date();
  if (!S.sim) return real;
  const t = getPrayerTimes(real, loc());
  const at = { morning: t.fajr.getTime() + 60 * 60e3, evening: t.asr.getTime() + 30 * 60e3, night: t.isha.getTime() + 2 * 3600e3 };
  return new Date(at[S.sim]);
}
function prayers() {
  const n = now();
  const l = loc();
  const times = getPrayerTimes(n, l);
  return { n, times, next: nextPrayer(n, l), current: highlightedSection(n, times) ?? 'sleep' };
}
const fmtTime = (d) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: loc().timeZone }).format(d);
function until(d) {
  const m = Math.max(0, Math.round((d - now()) / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m} min`;
}
function dateHtml(n) {
  const greg = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: loc().timeZone }).format(n);
  let hijri = '';
  try {
    hijri = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: loc().timeZone }).format(n);
  } catch { /* calendar not available */ }
  return `<div class="date"><b>${greg}</b>${hijri}</div>`;
}
function fmtSleepTime() {
  const [h, m] = S.reminders.sleep.time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// ---------- adhkar state ----------
const ordered = (sec) => {
  const { pinned, rest } = orderAdhkar(SEC[sec].data, S.pins[sec]);
  return [...pinned, ...rest];
};
const countOf = (d) => S.counts[d.id] ?? 0;
// Spec (#1): a tap counter only on the 100× adhkar; the rest she counts on her fingers, one tap = read.
const need = (d) => (d.repeat === 100 ? 100 : 1);
const isComplete = (d) => countOf(d) >= need(d);
function prog(sec) {
  const list = SEC[sec].data;
  const done = list.filter(isComplete).length;
  return { done, total: list.length, pct: done / list.length, all: done === list.length };
}
const secDone = (sec) => S.done[sec] === true;
function statusLine(sec) {
  const p = prog(sec);
  if (secDone(sec)) return 'Completed today';
  if (p.done) return `${p.done} of ${p.total} read`;
  return `${p.total} adhkar`;
}
function openSection(sec) {
  if (secDone(sec) && prog(sec).all) SEC[sec].data.forEach((d) => { delete S.counts[d.id]; }); // read again
  const list = ordered(sec);
  const first = list.findIndex((d) => !isComplete(d));
  S.pos[sec] = Math.max(0, first);
  S.open[sec] = list[Math.max(0, first)].id;
  S.route = { name: 'reader', sec };
  S.anim = true;
}

// ---------- shared blocks ----------
function topbar(n) {
  return `<div class="topbar">${dateHtml(n)}
    <button class="avatar" data-act="go" data-to="settings" aria-label="Settings">${esc(S.name.trim()[0] ?? '♡')}</button></div>`;
}

function prayerStrip(p) {
  const list = PRAYER_KEYS.map((k) => `<li class="${k === p.next.name ? 'next' : ''}">${PRAYER_LABELS[k]}<b>${fmtTime(p.times[k]).replace(/ (AM|PM)/, '')}</b></li>`).join('');
  return `<div>
    <button class="strip" data-act="toggle-times" aria-expanded="${S.timesOpen}">
      ${ic('pin')}<span class="grow"><b>${PRAYER_LABELS[p.next.name]}</b> in ${until(p.next.time)}
      <span class="muted small"> · ${fmtTime(p.next.time)}</span></span>
      <span class="muted small">${esc(S.location.name)}</span>${ic('chevron')}
    </button>
    ${S.timesOpen ? `<ul class="times">${list}</ul>` : ''}
  </div>`;
}

function loadVerse() {
  if (S.memorizedUpTo === 0 || S.verseFor === S.memorizedUpTo) return;
  S.verseFor = S.memorizedUpTo;
  S.quran ??= Promise.all([
    import('../data/quran/pages.json'), import('../data/quran/surahs.json'), import('../data/quran/tafsir-muyassar.json'),
  ]).then(([pages, surahs, tafsir]) => ({ pages: pages.default, surahs: surahs.default, tafsir: tafsir.default }));
  S.quran.then(({ pages, surahs, tafsir }) => {
    const v = pickReflectionVerse({ memorizedUpTo: S.memorizedUpTo }, pages);
    if (!v) { S.verse = null; return render(true); }
    const surah = surahs.find((x) => x.number === v.s);
    S.verse = { ...v, surah: surah ? surah.nameAr : v.s, tafsir: tafsir[`${v.s}:${v.a}`] ?? '' };
    render(true);
  });
}

function reflectionCard(alwaysTafsir = false) {
  loadVerse();
  if (S.memorizedUpTo === 0) {
    return `<section class="card"><p class="k">Today's reflection</p>
      <p class="muted" style="margin-top:8px">Tell me which page you have memorized up to, and a verse from it will be waiting here each day.</p>
      <button class="linkish" data-act="go" data-to="settings">Set my page ${ic('arrow')}</button></section>`;
  }
  const v = S.verse;
  if (!v) return `<section class="card"><p class="k">Today's reflection</p><p class="muted" style="margin-top:8px">…</p></section>`;
  return `<section class="card"><p class="k">Today's reflection · page ${v.page}</p>
    <p class="quran" lang="ar" style="margin-top:6px">${esc(v.text)}</p>
    <p class="verse-ref">سورة ${esc(v.surah)} · آية ${v.a.toLocaleString('ar-EG')}</p>
    ${alwaysTafsir ? `<p class="tafsir-k">التفسير الميسر</p><p class="tafsir ar" style="border:0;margin-top:0;padding-top:0" lang="ar">${esc(v.tafsir)}</p>`
    : `${S.tafsirOpen ? `<p class="tafsir ar" lang="ar">${esc(v.tafsir)}</p>` : ''}
    <div style="text-align:center"><button class="linkish" data-act="toggle-tafsir">${S.tafsirOpen ? 'Hide tafsir' : 'Read the tafsir'}</button></div>`}
  </section>`;
}

function memoCard() {
  const upTo = S.memorizedUpTo;
  if (upTo >= TOTAL_PAGES) {
    return `<section class="card" style="text-align:center"><p class="k">Memorization</p><p class="ar" style="text-align:center;color:var(--p)">ما شاء الله تبارك الله</p></section>`;
  }
  return `<section class="card"><p class="k">Memorization</p>
    <div class="memo-row" style="margin-top:10px">
      <div class="grow"><span class="memo-num">${upTo}</span> <span class="muted">of ${TOTAL_PAGES} pages</span>
        <div class="bar" style="margin-top:10px"><i style="width:${(upTo / TOTAL_PAGES) * 100}%"></i></div></div>
    </div>
    <button class="btn soft wide" style="margin-top:14px" data-act="memo">${ic('check')} I memorized page ${upTo + 1}</button>
  </section>`;
}

const dhikrChips = (d) => `<div class="chips">
  ${d.virtue ? `<button class="chip" data-act="sheet" data-kind="virtue" data-id="${d.id}">Virtue</button>` : ''}
  ${d.source ? `<button class="chip" data-act="sheet" data-kind="source" data-id="${d.id}">Source</button>` : ''}
</div>`;
const starBtn = (sec, d) => {
  const on = S.pins[sec].includes(d.id);
  return `<button class="star" data-act="star" data-id="${d.id}" aria-pressed="${on}" aria-label="${on ? 'Remove from favourites' : 'Add to favourites'}">${ic('star', on ? 'fill' : '')}</button>`;
};
const resetBtn = (d) => (need(d) > 1 && countOf(d) > 0
  ? `<button class="star" style="color:var(--muted)" data-act="reset" data-id="${d.id}" aria-label="Reset counter">${ic('reset')}</button>` : '');
function tapBtn(d, size) {
  const c = countOf(d);
  const complete = c >= need(d);
  const inner = complete ? `<b>${ic('check')}</b>`
    : need(d) === 1 ? '<span><b style="font-size:1.05rem">Next</b></span>'
      : `<span><b>${c}</b><small>of ${d.repeat}</small></span>`;
  return `<button class="tap ${complete ? 'complete' : ''}" data-act="count" data-id="${d.id}"
    aria-label="${complete ? 'Read' : need(d) === 1 ? 'Read, next' : `Count, ${c} of ${d.repeat}`}">${complete ? '' : ring(c / need(d), size, 5)}${inner}</button>`;
}
function finishHtml(sec) {
  return `<div class="finish">
    <div class="orb">${ic(SEC[sec].icon)}</div>
    <p class="big">تَقَبَّلَ اللهُ</p>
    <p><strong>${SEC[sec].title} complete</strong><br><span class="muted">May Allah accept from you, ${esc(S.name)}.</span></p>
    <button class="btn" data-act="go" data-to="home">Back home</button>
  </div>`;
}

// ---------- A · Focus ----------
function homeA() {
  const p = prayers();
  const cur = p.current;
  const pr = prog(cur);
  const done = secDone(cur);
  const tiles = [...SECTIONS.filter((s) => s !== cur).map((s) => `
    <button class="tile" data-act="open" data-sec="${s}">${ic(SEC[s].icon)}
      <span>${SEC[s].short}<small>${secDone(s) ? 'Done' : prog(s).done ? `${prog(s).done}/${prog(s).total}` : SEC[s].when}</small></span>
      ${secDone(s) ? `<span class="tick">${ic('check')}</span>` : ''}</button>`),
  `<button class="tile" data-act="go" data-to="istikhara">${ic('sparkle')}<span>Istikhara<small>Du'a</small></span></button>`].join('');
  return `<div class="pg">
    ${topbar(p.n)}
    <h1 class="hello"><span>Assalamu alaikum,</span>${esc(S.name)} 🤍</h1>
    <button class="hero" data-act="open" data-sec="${cur}">
      <span class="hero-ic">${ic(done ? 'check' : SEC[cur].icon)}</span>
      <span class="hero-k">${done ? 'Completed today' : 'For now'}</span>
      <span class="hero-t">${SEC[cur].title}</span>
      <span class="hero-s">${done ? 'Beautifully done.' : pr.done ? `${pr.done} of ${pr.total} read — pick up where you left off` : `${pr.total} adhkar, one at a time`}</span>
      ${!done && pr.done ? `<span class="hero-bar"><i style="width:${pr.pct * 100}%"></i></span>` : ''}
      <span class="hero-cta">${done ? 'Read again' : pr.done ? 'Continue' : 'Begin'} ${ic('arrow')}</span>
    </button>
    ${prayerStrip(p)}
    <div class="tiles">${tiles}</div>
    ${reflectionCard()}
    ${memoCard()}
  </div>`;
}

function readerA(sec) {
  const list = ordered(sec);
  const i = S.pos[sec] ?? 0;
  const head = (sub) => `<header class="rd-top">
      <button class="icon-btn ghost" data-act="go" data-to="home" aria-label="Close">${ic('close')}</button>
      <div class="rd-title">${SEC[sec].title}<small>${sub}</small></div>
      <button class="icon-btn ghost" data-act="overview" aria-label="All adhkar">${ic('list')}</button>
    </header>`;
  if (i >= list.length) {
    const left = list.length - prog(sec).done;
    return `<div class="fill">${head(left ? 'The end' : 'Complete')}${left ? `<div class="finish">
      <p class="muted">${left} not read yet</p>
      <button class="btn" data-act="finish">${ic('check')} Mark as done</button>
      <button class="linkish" data-act="jump" data-i="${list.findIndex((d) => !isComplete(d))}">Go to the first unread</button></div>` : finishHtml(sec)}</div>`;
  }
  const d = list[i];
  const anim = S.anim ? 'anim' : '';
  S.anim = false;
  return `<div class="fill">
    ${head(`${i + 1} of ${list.length}`)}
    <div class="bar rd-bar"><i style="width:${(prog(sec).done / list.length) * 100}%"></i></div>
    <div class="slide ${anim}" data-scroll data-act="count" data-id="${d.id}">
      <div class="slide-head"><span class="rep">${d.repeat === 1 ? 'Once' : `×${d.repeat}`}</span><span>${resetBtn(d)}${starBtn(sec, d)}</span></div>
      <p class="ar slide-text ${d.arabic.length < 110 ? 'short' : ''}" lang="ar">${esc(d.arabic)}</p>
      ${dhikrChips(d)}
      ${i === 0 && !countOf(d) ? '<p class="hint">Tap anywhere when you have read it · swipe to move</p>' : ''}
    </div>
    <footer class="rd-foot">
      <button class="icon-btn" data-act="prev" aria-label="Previous" ${i === 0 ? 'style="visibility:hidden"' : ''}>${ic('back')}</button>
      ${tapBtn(d, 92)}
      <button class="icon-btn" data-act="next" aria-label="Next">${ic('fwd')}</button>
    </footer>
  </div>`;
}

// ---------- B · My day ----------
function timeline(p) {
  const t = p.n.getTime();
  const secCard = (s, when) => {
    const pr = prog(s);
    const active = p.current === s && !secDone(s);
    return `<button class="tl-s ${active ? 'active' : ''}" data-act="open" data-sec="${s}">
      <span class="ringwrap">${ring(secDone(s) ? 1 : pr.pct, 46, 4)}<b>${ic(secDone(s) ? 'check' : SEC[s].icon)}</b></span>
      <span class="grow"><strong>${SEC[s].title}</strong><span class="muted small">${when} · ${statusLine(s)}</span></span>
      ${ic('fwd')}</button>`;
  };
  const after = { fajr: secCard('morning', 'After Fajr'), asr: secCard('evening', 'After Asr') };
  let nowPlaced = false;
  const nowMark = '<div class="tl-now">Now</div>';
  let rows = '';
  for (const k of PRAYER_KEYS) {
    const past = p.times[k].getTime() <= t;
    if (!past && !nowPlaced) { rows += nowMark; nowPlaced = true; }
    rows += `<div class="tl-p ${past ? 'past' : ''} ${!past && k === p.next.name ? 'next' : ''}"><span>${PRAYER_LABELS[k]}</span><span>${fmtTime(p.times[k])}</span></div>`;
    if (after[k]) {
      // the adhkar belonging to a prayer that has passed sit right under the Now marker
      if (past && !nowPlaced && p.times[PRAYER_KEYS[PRAYER_KEYS.indexOf(k) + (k === 'fajr' ? 3 : 2)]].getTime() > t) { rows += nowMark; nowPlaced = true; }
      rows += after[k];
    }
  }
  if (!nowPlaced) rows += nowMark;
  rows += secCard('sleep', fmtSleepTime());
  return `<div class="tl">${rows}</div>`;
}

function homeB() {
  const p = prayers();
  return `<div class="pg">
    ${topbar(p.n)}
    <h1 class="hello" style="font-size:1.9rem"><span>Assalamu alaikum, ${esc(S.name)} 🤍</span>Your day</h1>
    ${timeline(p)}
    <p class="muted small" style="text-align:center;margin-top:-6px">${ic('pin')} Prayer times for ${esc(S.location.name)}</p>
    <button class="bigrow" data-act="go" data-to="istikhara"><span class="badge">${ic('sparkle')}</span>
      <span class="grow"><strong>Istikhara</strong><span class="muted small">When you need guidance</span></span>${ic('fwd')}</button>
    ${reflectionCard()}
    ${memoCard()}
  </div>`;
}

function readerB(sec) {
  const list = ordered(sec);
  const pr = prog(sec);
  const openId = S.open[sec];
  const rows = list.map((d, i) => {
    const open = d.id === openId;
    const done = isComplete(d);
    const c = countOf(d);
    return `<article class="row ${done ? 'done' : ''} ${open ? 'open' : ''}" data-row="${d.id}">
      <button class="row-head" data-act="toggle-row" data-id="${d.id}" aria-expanded="${open}">
        <span class="circle">${done ? ic('check') : d.repeat > 1 ? `×${d.repeat}` : i + 1}</span>
        ${open ? `<span class="row-label">${d.repeat === 1 ? 'Read once' : `Repeat ${d.repeat} times`}</span>` : `<span class="preview ar" lang="ar">${esc(d.arabic)}</span>`}
      </button>
      ${open ? `<div class="row-body">
        <p class="ar" lang="ar">${esc(d.arabic)}</p>
        ${dhikrChips(d)}
        <div class="row-actions">
          ${starBtn(sec, d)}
          ${need(d) > 1 && c > 0 ? `<button class="icon-btn" data-act="reset" data-id="${d.id}" aria-label="Reset counter">${ic('reset')}</button>` : ''}
          <button class="btn ${done ? 'soft' : ''}" data-act="count" data-id="${d.id}">${done ? `${ic('check')} Read` : need(d) === 1 ? `${ic('check')} I've read it` : `Tap to count · ${c} / ${d.repeat}`}</button>
        </div></div>` : ''}
    </article>`;
  }).join('');
  return `<div class="fill" style="position:relative">
    <header class="rd-top">
      <button class="icon-btn ghost" data-act="go" data-to="home" aria-label="Back">${ic('back')}</button>
      <div class="rd-title">${SEC[sec].title}<small>${pr.done} of ${pr.total} read</small></div>
      <span style="width:42px"></span>
    </header>
    <div class="bar rd-bar"><i style="width:${pr.pct * 100}%"></i></div>
    <div class="rows" data-scroll style="flex:1;min-height:0;overflow-y:auto">${rows}</div>
    <div class="sticky-foot"><button class="btn wide ${pr.all ? '' : 'soft'}" data-act="finish">${ic('check')} ${secDone(sec) ? 'Done today' : pr.all ? 'All read — finish' : 'Mark as done'}</button></div>
  </div>`;
}

// ---------- C · Tabs ----------
function dial(p) {
  const a = p.times.fajr.getTime();
  const b = p.times.isha.getTime();
  const frac = (x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const pt = (f, r = 120) => [150 - r * Math.cos(Math.PI * f), 150 - r * Math.sin(Math.PI * f)];
  const f = frac(p.n.getTime());
  const [sx, sy] = pt(f);
  const dots = PRAYER_KEYS.map((k) => { const [x, y] = pt(frac(p.times[k].getTime())); return `<circle cx="${x}" cy="${y}" r="3.500" fill="var(--bg)" stroke="var(--p2)" stroke-width="2"/>`; }).join('');
  return `<div class="dial">
    <svg viewBox="0 0 300 168" aria-hidden="true">
      <path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="var(--soft)" stroke-width="8" stroke-linecap="round"/>
      <path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="var(--p)" stroke-width="8" stroke-linecap="round" pathLength="1" stroke-dasharray="${f} 1"/>
      ${dots}
      <circle cx="${sx}" cy="${sy}" r="11" fill="var(--surface)" stroke="var(--p)" stroke-width="4"/>
    </svg>
    <div class="dial-c"><span class="k">Next prayer</span><strong>${PRAYER_LABELS[p.next.name]}</strong>
      <span class="muted">in <b>${until(p.next.time)}</b> · ${fmtTime(p.next.time)}</span></div>
  </div>`;
}

function homeC() {
  const p = prayers();
  if (S.tab === 'adhkar') {
    return `<div class="pg"><h1 class="h1">Adhkar</h1>
      <p class="k">Your day</p>
      ${timeline(p)}
      <p class="k" style="margin-top:6px">Anytime</p>
      <button class="bigrow" data-act="go" data-to="istikhara"><span class="badge">${ic('sparkle')}</span>
        <span class="grow"><strong>Istikhara</strong><span class="muted small">When you need guidance</span></span>${ic('fwd')}</button></div>`;
  }
  if (S.tab === 'quran') return `<div class="pg"><h1 class="h1">Qur'an</h1>${memoCard()}</div>`;
  if (S.tab === 'me') return settings(false);
  return `<div class="pg">
    <div class="topbar">${dateHtml(p.n)}<span class="muted small">${ic('pin')} ${esc(S.location.name)}</span></div>
    <h1 class="hello" style="font-size:1.9rem"><span>Assalamu alaikum,</span>${esc(S.name)} 🤍</h1>
    ${dial(p)}
    <ul class="times" style="margin:0;grid-template-columns:repeat(5,1fr)" aria-label="Today's prayer times">${PRAYER_KEYS.filter((k) => k !== 'sunrise').map((k) => `<li class="${k === p.next.name ? 'next' : ''}">${PRAYER_LABELS[k]}<b>${fmtTime(p.times[k]).replace(/ (AM|PM)/, '')}</b></li>`).join('')}</ul>
    ${reflectionCard(true)}
  </div>`;
}

function tabsHtml() {
  const tabs = [['today', 'home', 'Today'], ['adhkar', 'beads', 'Adhkar'], ['quran', 'book', "Qur'an"], ['me', 'user', 'Me']];
  return tabs.map(([k, i, l]) => `<button class="tab" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ic(i)}${l}</button>`).join('');
}

function readerC(sec) {
  const list = ordered(sec);
  const pr = prog(sec);
  const cards = list.map((d, i) => `<section class="snap-card ${isComplete(d) ? 'done' : ''}" data-row="${d.id}"><div class="snap-in">
      <div class="slide-head"><span class="rep">${i + 1} / ${list.length} · ${d.repeat === 1 ? 'Once' : `×${d.repeat}`}</span><span>${resetBtn(d)}${starBtn(sec, d)}</span></div>
      <p class="ar slide-text ${d.arabic.length < 110 ? 'short' : ''}" lang="ar">${esc(d.arabic)}</p>
      <div class="snap-foot">${dhikrChips(d)}${tapBtn(d, 78)}</div>
    </div></section>`).join('');
  return `<div class="fill">
    <header class="rd-top">
      <button class="icon-btn ghost" data-act="go" data-to="home" aria-label="Back">${ic('back')}</button>
      <div class="rd-title">${SEC[sec].title}<small>${pr.done} of ${pr.total} read</small></div>
      <button class="icon-btn ghost" data-act="finish" aria-label="Mark as done">${ic('check')}</button>
    </header>
    <div class="bar rd-bar"><i style="width:${pr.pct * 100}%"></i></div>
    <div class="snap" data-scroll>${cards}<section class="snap-card"><div class="snap-in" style="background:none;box-shadow:none">
      ${pr.all ? finishHtml(sec) : `<div class="finish"><p class="muted">${pr.total - pr.done} left to read</p><button class="btn soft" data-act="finish">Mark as done anyway</button></div>`}</div></section></div>
  </div>`;
}

// ---------- Istikhara (shared) ----------
function istikharaScreen() {
  const parts = esc(istikhara.arabic).split(esc(istikhara.highlight));
  const text = parts.join(`<mark>${esc(istikhara.highlight)}</mark>`);
  return `<div class="pg isti">
    <div class="topbar"><button class="icon-btn" data-act="go" data-to="home" aria-label="Back">${ic('back')}</button>
      <button class="chip" data-act="sheet" data-kind="isti-source">Source</button></div>
    <h1 class="h1">Istikhara<br><span class="muted small" style="font-family:Carlito,system-ui,sans-serif">Asking Allah to choose what is best</span></h1>
    <div class="note"><i></i>Where it is highlighted, name your matter.</div>
    <article class="card"><p class="ar" lang="ar">${text}</p></article>
  </div>`;
}

// ---------- Settings (shared) ----------
function settings(withBack = true) {
  const r = S.reminders;
  const sw = (key) => `<button class="switch" role="switch" aria-checked="${r[key].enabled}" data-act="rem" data-key="${key}" aria-label="${SEC[key].short} reminder"></button>`;
  const offset = (key, prayer) => `<div class="set ${r[key].enabled ? '' : 'off'}">
      <span class="grow">${SEC[key].short}<small>After ${prayer}</small></span>
      <span class="stepper"><button data-act="offset" data-key="${key}" data-d="-15" aria-label="Earlier">−</button><span>${r[key].offsetMin} min</span><button data-act="offset" data-key="${key}" data-d="15" aria-label="Later">+</button></span>
      ${sw(key)}</div>`;
  const seg = (name, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="set" data-k="${name}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
  const sw3 = [['lavender', '#9B6FD0'], ['lilac', '#B865BA'], ['wisteria', '#7468CC']];
  return `<div class="pg">
    <div class="topbar">${withBack ? `<button class="icon-btn" data-act="go" data-to="home" aria-label="Back">${ic('back')}</button>` : ''}
      <h1 class="h1" style="flex:1;${withBack ? 'text-align:center;margin-right:42px' : ''}">${withBack ? 'Settings' : 'Made for you'}</h1></div>

    <p class="k">Made for you</p>
    <div class="group">
      <label class="set"><span class="grow">Your name</span><input class="field" data-set="name" value="${esc(S.name)}" maxlength="20" autocomplete="off"></label>
      <div class="set"><span class="grow">Colour<small>${S.accent[0].toUpperCase() + S.accent.slice(1)}</small></span>
        <span class="swatches">${sw3.map(([v, c]) => `<button class="swatch" style="background:${c}" data-act="set" data-k="accent" data-v="${v}" aria-pressed="${S.accent === v}" aria-label="${v}"></button>`).join('')}</span></div>
      <div class="set col"><span>Appearance</span>${seg('theme', S.theme, [['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']])}</div>
      <div class="set col"><span>Arabic text size</span>
        <p class="ar sample" lang="ar">سُبْحَانَ اللهِ وَبِحَمْدِهِ</p>
        <input type="range" min="0.85" max="1.45" step="0.05" value="${S.arScale}" data-set="arScale" aria-label="Arabic text size"></div>
    </div>

    <p class="k">Reminders</p>
    <div class="group">
      ${offset('morning', 'Fajr')}
      ${offset('evening', 'Asr')}
      <div class="set ${r.sleep.enabled ? '' : 'off'}"><span class="grow">Before Sleep<small>Every night</small></span>
        <input class="field" type="time" style="width:auto" data-set="sleepTime" value="${r.sleep.time}" aria-label="Sleep reminder time">${sw('sleep')}</div>
    </div>

    <p class="k">Qur'an</p>
    <div class="group">
      <div class="set"><span class="grow">Memorized up to page<small>0 = not started · ${TOTAL_PAGES} = the whole mushaf</small></span>
        <span class="stepper"><button data-act="page" data-d="-1" aria-label="One page less">−</button>
          <input class="field" style="width:62px;text-align:center;background:none;padding:6px 0" inputmode="numeric" data-set="page" value="${S.memorizedUpTo}" aria-label="Page">
          <button data-act="page" data-d="1" aria-label="One page more">+</button></span></div>
    </div>

    <p class="k">Prayer times</p>
    <div class="group">
      <label class="set"><span class="grow">City</span><input class="field" data-set="city" value="${esc(S.location.name)}" autocomplete="off"></label>
      <label class="set"><span class="grow">Latitude</span><input class="field" inputmode="decimal" data-set="lat" value="${S.location.lat}"></label>
      <label class="set"><span class="grow">Longitude</span><input class="field" inputmode="decimal" data-set="lng" value="${S.location.lng}"></label>
      <div class="set"><span class="grow muted small">Egyptian General Authority of Survey</span><button class="linkish" data-act="reset-loc">Reset to Cairo</button></div>
    </div>

    <p class="about"><strong>Sabaah al-Wuruud</strong><br>Adhkar from Hisn al-Muslim · Quran text from Tanzil · At-Tafsir al-Muyassar</p>
  </div>`;
}

// ---------- sheet / toast ----------
function sheetHtml() {
  const s = S.sheet;
  return `<div class="backdrop" data-act="close-sheet"><div class="sheet" role="dialog" aria-label="${esc(s.title)}">
    <h2>${esc(s.title)}</h2>${s.html}</div></div>`;
}
let toastTimer = null;
function toast(msg, undo) {
  toastEl.innerHTML = `<div class="toast"><span>${esc(msg)}</span>${undo ? '<button data-undo>Undo</button>' : ''}</div>`;
  if (undo) $('[data-undo]', toastEl).onclick = () => { undo(); toastEl.innerHTML = ''; render(true); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.innerHTML = ''; }, 4000);
}

// ---------- render ----------
function screen() {
  const { name, sec } = S.route;
  if (name === 'reader') return { A: readerA, B: readerB, C: readerC }[S.variant](sec);
  if (name === 'istikhara') return istikharaScreen();
  if (name === 'settings') return settings(true);
  return { A: homeA, B: homeB, C: homeC }[S.variant]();
}

function applyLook() {
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = S.accent;
  root.style.setProperty('--ar', S.arScale);
}

function render(keep = false) {
  applyLook();
  const scroller = () => $('[data-scroll]', view) ?? view;
  const top = keep ? scroller().scrollTop : 0;
  view.innerHTML = screen();
  scroller().scrollTop = top;
  if (!keep) view.scrollTop = 0;
  const showTabs = S.variant === 'C' && S.route.name === 'home';
  tabbar.hidden = !showTabs;
  tabbar.innerHTML = showTabs ? tabsHtml() : '';
  sheetEl.innerHTML = S.sheet ? sheetHtml() : '';
  renderSwitcher();
}

// ---------- actions ----------
function afterComplete(sec, d) {
  if (S.route.name !== 'reader' || S.route.sec !== sec) return;
  const list = ordered(sec);
  if (prog(sec).all) S.done[sec] = true;
  if (S.variant === 'A') {
    if (list[S.pos[sec]]?.id !== d.id) return;
    S.pos[sec] += 1; S.anim = true;
    return render();
  }
  const i = list.findIndex((x) => x.id === d.id);
  const next = list.slice(i + 1).find((x) => !isComplete(x)) ?? list.find((x) => !isComplete(x));
  if (S.variant === 'B') {
    S.open[sec] = next?.id ?? null;
    render(true);
    if (next) $(`[data-row="${next.id}"]`, view)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  render(true);
  const target = next ? $(`[data-row="${next.id}"]`, view) : view.querySelector('.snap-card:last-child');
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const ACT = {
  go(d) { S.route = { name: d.to }; render(); },
  open(d) { openSection(d.sec); render(); },
  tab(d) { S.tab = d.tab; render(); },
  'toggle-times'() { S.timesOpen = !S.timesOpen; render(true); },
  'toggle-tafsir'() { S.tafsirOpen = !S.tafsirOpen; render(true); },
  memo() {
    const before = S.memorizedUpTo;
    S.memorizedUpTo = Math.min(TOTAL_PAGES, before + 1);
    S.tafsirOpen = false;
    render(true);
    toast(`Page ${S.memorizedUpTo} memorized — ما شاء الله`, () => { S.memorizedUpTo = before; });
  },
  count(d) {
    const sec = S.route.sec;
    const dhikr = SEC[sec].data.find((x) => x.id === d.id);
    const c = countOf(dhikr);
    if (c >= need(dhikr)) { if (S.variant === 'A') afterComplete(sec, dhikr); return; }
    S.counts[dhikr.id] = c + 1;
    const complete = c + 1 >= need(dhikr);
    buzz(complete ? [18, 40, 18] : 8);
    render(true);
    if (complete) setTimeout(() => afterComplete(sec, dhikr), need(dhikr) === 1 ? 260 : 520);
  },
  reset(d) { delete S.counts[d.id]; render(true); },
  prev() { const sec = S.route.sec; S.pos[sec] = Math.max(0, S.pos[sec] - 1); S.anim = true; render(); },
  next() { const sec = S.route.sec; S.pos[sec] = Math.min(ordered(sec).length, S.pos[sec] + 1); S.anim = true; if (prog(sec).all) S.done[sec] = true; render(); },
  jump(d) { S.pos[S.route.sec] = Number(d.i); S.sheet = null; S.anim = true; render(); },
  star(d) {
    const sec = S.route.sec;
    const cur = ordered(sec)[S.pos[sec]];
    S.pins[sec] = togglePin(S.pins[sec], d.id);
    if (S.variant === 'A' && cur) S.pos[sec] = ordered(sec).findIndex((x) => x.id === cur.id); // stay on this dhikr
    render(true);
    toast(S.pins[sec].includes(d.id) ? 'Added to your favourites — shown first' : 'Removed from favourites');
  },
  'toggle-row'(d) { const sec = S.route.sec; S.open[sec] = S.open[sec] === d.id ? null : d.id; render(true); },
  finish() {
    const sec = S.route.sec;
    S.done[sec] = true;
    S.route = { name: 'home' };
    render();
    toast(`${SEC[sec].title} done for today`);
  },
  sheet(d) {
    if (d.kind === 'isti-source') S.sheet = { title: 'Source', html: `<p class="body" lang="ar">${esc(istikhara.source)}</p>` };
    else {
      const dhikr = SEC[S.route.sec].data.find((x) => x.id === d.id);
      S.sheet = { title: d.kind === 'virtue' ? 'Virtue' : 'Source', html: `<p class="body" lang="ar">${esc(dhikr[d.kind])}</p>` };
    }
    render(true);
  },
  overview() {
    const sec = S.route.sec;
    const list = ordered(sec);
    S.sheet = {
      title: SEC[sec].title,
      html: list.map((d, i) => `<button class="ov ${i === S.pos[sec] ? 'cur' : ''} ${isComplete(d) ? 'row done' : ''}" style="background:none" data-act="jump" data-i="${i}">
        <span class="circle">${isComplete(d) ? ic('check') : i + 1}</span><span class="preview ar" lang="ar">${esc(d.arabic)}</span>
        ${S.pins[sec].includes(d.id) ? `<span style="color:var(--p)">${ic('star', 'fill')}</span>` : ''}</button>`).join(''),
    };
    render(true);
  },
  'close-sheet'(d, el, e) { if (e.target === el) { S.sheet = null; render(true); } },
  set(d) { S[d.k] = d.v; render(true); },
  rem(d) { S.reminders[d.key].enabled = !S.reminders[d.key].enabled; render(true); },
  offset(d) { const r = S.reminders[d.key]; r.offsetMin = Math.min(720, Math.max(0, r.offsetMin + Number(d.d))); render(true); },
  page(d) { S.memorizedUpTo = Math.min(TOTAL_PAGES, Math.max(0, S.memorizedUpTo + Number(d.d))); render(true); },
  'reset-loc'() { S.location = { ...CAIRO }; render(true); toast('Location reset to Cairo'); },
};

document.querySelector('.phone').addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  ACT[el.dataset.act]?.(el.dataset, el, e);
});

const SETTERS = {
  name: (v) => { if (v.trim()) S.name = v.trim(); },
  city: (v) => { if (v.trim()) S.location.name = v.trim(); },
  lat: (v) => { const n = Number(v); if (v.trim() && Number.isFinite(n) && Math.abs(n) <= 90) S.location.lat = n; else toast('Latitude must be between -90 and 90'); },
  lng: (v) => { const n = Number(v); if (v.trim() && Number.isFinite(n) && Math.abs(n) <= 180) S.location.lng = n; else toast('Longitude must be between -180 and 180'); },
  sleepTime: (v) => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) S.reminders.sleep.time = v; },
  page: (v) => { const n = Math.floor(Number(v)); if (v.trim() && Number.isFinite(n)) S.memorizedUpTo = Math.min(TOTAL_PAGES, Math.max(0, n)); },
};
view.addEventListener('change', (e) => {
  const key = e.target.dataset.set;
  if (!key || key === 'arScale') return;
  SETTERS[key](e.target.value);
  render(true);
});
view.addEventListener('input', (e) => {
  if (e.target.dataset.set !== 'arScale') return;
  S.arScale = Number(e.target.value);
  document.documentElement.style.setProperty('--ar', S.arScale); // live, no re-render while dragging
});

// swipe between adhkar in the Focus pager
let touch = null;
view.addEventListener('touchstart', (e) => { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
view.addEventListener('touchend', (e) => {
  if (!touch || S.variant !== 'A' || S.route.name !== 'reader') return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? ACT.next : ACT.prev)();
}, { passive: true });

// ---------- prototype switcher (not part of the design) ----------
function renderSwitcher() {
  const sims = [[null, 'Live'], ['morning', 'Morning'], ['evening', 'Evening'], ['night', 'Night']];
  switcher.innerHTML = `<button data-v="-1" aria-label="Previous variant">←</button>
    <span class="lbl">${S.variant} · ${VARIANTS[S.variant]}</span>
    <button data-v="1" aria-label="Next variant">→</button><span class="sep"></span>
    ${sims.map(([k, l]) => `<button data-sim="${k ?? ''}" class="${S.sim === k ? 'on' : ''}">${l}</button>`).join('')}`;
}
function cycle(step) {
  const keys = Object.keys(VARIANTS);
  S.variant = keys[(keys.indexOf(S.variant) + step + keys.length) % keys.length];
  const url = new URL(location.href);
  url.searchParams.set('variant', S.variant);
  history.replaceState(null, '', url);
  S.sheet = null;
  if (S.route.name === 'reader') { const { sec } = S.route; openSection(sec); }
  render();
}
switcher.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.v) return cycle(Number(b.dataset.v));
  S.sim = b.dataset.sim || null;
  render(true);
});
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, [contenteditable]')) return;
  if (e.key === 'ArrowLeft') cycle(-1);
  if (e.key === 'ArrowRight') cycle(1);
});

render();
setInterval(() => { if (S.route.name === 'home' && !S.sheet) render(true); }, 30_000);
