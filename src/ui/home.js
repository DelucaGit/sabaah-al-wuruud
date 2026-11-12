// Home screen: greeting, today's prayer times, section buttons, a reflection
// verse from the last memorized page, and memorization progress.
import './home.css';
import { store } from '../adapters/storage.js';
import { DEFAULT_STATE } from '../core/state.js';
import { ensureToday, isDone } from '../core/daily.js';
import { getPrayerTimes, nextPrayer, highlightedSection, PRAYER_KEYS } from '../core/prayer.js';
import { pickReflectionVerse, markNextPage, nextPageLabel } from '../core/memorization.js';
import { navigate } from '../router.js';

const PRAYER_LABELS = {
  fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
};

const SECTIONS = [
  { key: 'morning', icon: '☀️', label: 'Morning Adhkar', path: '/adhkar/morning' },
  { key: 'evening', icon: '🌙', label: 'Evening Adhkar', path: '/adhkar/evening' },
  { key: 'sleep', icon: '😴', label: 'Before Sleep', path: '/adhkar/sleep' },
  { key: 'istikhara', icon: '🤲', label: 'Istikhara', path: '/istikhara' },
];

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
// memorized page changes), so it does not jump around while navigating.
let reflection = null; // { upTo, verse }
function reflectionFor(progress, pages) {
  if (!reflection || reflection.upTo !== progress.memorizedUpTo) {
    reflection = { upTo: progress.memorizedUpTo, verse: pickReflectionVerse(progress, pages) };
  }
  return reflection.verse;
}

// --- helpers -----------------------------------------------------------------

function prayerLocation(settings) {
  const loc = settings.location;
  const def = DEFAULT_STATE.settings.location;
  const isDefaultCairo = loc.lat === def.lat && loc.lng === def.lng;
  return isDefaultCairo ? { ...loc, timeZone: 'Africa/Cairo' } : { ...loc };
}

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

const arabicNumber = (n) => n.toLocaleString('ar-EG');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// --- render ------------------------------------------------------------------

export function render(rootEl) {
  const page = el('div', 'home');
  rootEl.appendChild(page);
  let alive = true;

  const greeting = el('h1', 'home__greeting', 'Assalamu alaikum, Aisha 🤍');
  const prayers = el('section', 'home__card home__prayers');
  const sections = el('nav', 'home__sections');
  sections.setAttribute('aria-label', 'Sections');
  const reflectionCard = el('section', 'home__card home__reflection');
  const memo = el('section', 'home__card home__memo');
  const settingsLink = el('a', 'home__settings', '⚙️ Settings');
  settingsLink.href = '#/settings';
  page.append(greeting, prayers, sections, reflectionCard, memo, settingsLink);

  function paintPrayersAndSections(state, now) {
    const location = prayerLocation(state.settings);
    let times = null;
    let next = null;
    try {
      times = getPrayerTimes(now, location);
      next = nextPrayer(now, location);
    } catch {
      // Extreme latitudes can make times undefined; show the sections anyway.
    }

    prayers.replaceChildren();
    if (times && next) {
      const nextLine = el('p', 'home__next');
      nextLine.append(
        el('span', 'home__next-label', 'Next: '),
        el('strong', null, `${PRAYER_LABELS[next.name]} ${formatTime(next.time, location.timeZone)}`),
      );
      const grid = el('ul', 'home__times');
      for (const key of PRAYER_KEYS) {
        const li = el('li', 'home__time');
        if (key === next.name && times[key].getTime() === next.time.getTime()) {
          li.classList.add('home__time--next');
        }
        li.append(
          el('span', 'home__time-name', PRAYER_LABELS[key]),
          el('span', 'home__time-value', formatTime(times[key], location.timeZone)),
        );
        grid.append(li);
      }
      const place = el('p', 'home__place', `Prayer times · ${state.settings.location.name}`);
      prayers.append(place, nextLine, grid);
    } else {
      prayers.append(el('p', 'home__place', 'Prayer times are unavailable for this location.'));
    }

    const highlighted = times ? highlightedSection(now, times) : null;
    const daily = ensureToday(state.daily, now);
    sections.replaceChildren();
    for (const s of SECTIONS) {
      const btn = el('button', 'home__section');
      btn.type = 'button';
      const done = s.key !== 'istikhara' && isDone(daily, s.key, now);
      if (s.key === highlighted) btn.classList.add('home__section--now');
      if (done) btn.classList.add('home__section--done');
      btn.append(
        el('span', 'home__section-icon', s.icon),
        el('span', 'home__section-label', s.label),
      );
      if (s.key === highlighted) btn.append(el('span', 'home__badge', 'Now'));
      if (done) {
        const check = el('span', 'home__check', '✔');
        check.setAttribute('aria-label', 'done today');
        btn.append(check);
      }
      btn.addEventListener('click', () => navigate(s.path));
      sections.append(btn);
    }
  }

  function paintReflection(state) {
    reflectionCard.replaceChildren(el('h2', 'home__heading', "Today's Reflection"));
    if (state.progress.memorizedUpTo === 0) {
      const p = el('p', 'home__muted', 'Set the page you have memorized up to, and a verse from it will appear here each day. ');
      const link = el('a', 'home__link', 'Open Settings');
      link.href = '#/settings';
      p.append(link);
      reflectionCard.append(p);
      return;
    }
    const body = el('div', 'home__reflection-body');
    body.append(el('p', 'home__muted', 'Loading…'));
    reflectionCard.append(body);
    loadQuran().then(({ pages, surahs, tafsir }) => {
      if (!alive) return;
      const verse = reflectionFor(state.progress, pages);
      body.replaceChildren();
      if (!verse) {
        body.append(el('p', 'home__muted', 'No verse found for this page.'));
        return;
      }
      const surah = surahs.find((x) => x.number === verse.s);
      const ref = el('p', 'home__ref font-adhkar',
        `سورة ${surah ? surah.nameAr : verse.s} · آية ${arabicNumber(verse.a)}`);
      ref.dir = 'rtl';
      const ayah = el('p', 'home__ayah font-quran', verse.text);
      ayah.dir = 'rtl';
      ayah.lang = 'ar';
      const tafsirTitle = el('h3', 'home__tafsir-title font-adhkar', 'التفسير الميسر');
      tafsirTitle.dir = 'rtl';
      const tafsirText = el('p', 'home__tafsir font-adhkar', tafsir[`${verse.s}:${verse.a}`] ?? '');
      tafsirText.dir = 'rtl';
      tafsirText.lang = 'ar';
      body.append(ref, ayah, tafsirTitle, tafsirText);
    }).catch(() => {
      if (alive) body.replaceChildren(el('p', 'home__muted', 'Could not load the Quran text.'));
    });
  }

  function paintMemo(state) {
    const { memorizedUpTo } = state.progress;
    memo.replaceChildren(el('h2', 'home__heading', 'Memorization'));
    memo.append(el('p', 'home__memo-line',
      memorizedUpTo === 0 ? 'No pages memorized yet' : `Memorized up to page ${memorizedUpTo}`));
    const next = nextPageLabel(state.progress);
    if (next === null) {
      const done = el('p', 'home__mashallah font-adhkar', 'ما شاء الله تبارك الله');
      done.dir = 'rtl';
      memo.append(done);
      return;
    }
    const btn = el('button', 'home__memo-btn', `✔ I memorized page ${next}`);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      store.set((s) => {
        s.progress.memorizedUpTo = markNextPage(s.progress);
      });
    });
    memo.append(btn);
  }

  function paintAll() {
    const state = store.get();
    paintPrayersAndSections(state, new Date());
    paintReflection(state);
    paintMemo(state);
  }

  paintAll();
  const unsubscribe = store.subscribe(() => alive && paintAll());
  // Keep "Next" and the highlighted section current while the screen is open.
  const timer = setInterval(() => paintPrayersAndSections(store.get(), new Date()), 30_000);

  return () => {
    alive = false;
    unsubscribe();
    clearInterval(timer);
  };
}
