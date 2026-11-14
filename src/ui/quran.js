// Qur'an tab: memorization progress (pages of the 604-page Madinah mushaf)
// and one button to register the next memorized page, with Undo. Below it,
// the "Today's goals" card (quran-goals.js).

import './quran.css';
import { store } from '../adapters/storage.js';
import { TOTAL_PAGES, markNextPage, nextPageLabel, setMemorizedUpTo } from '../core/memorization.js';
import { icon, toast } from './kit.js';
import { goalsHtml, wireGoals } from './quran-goals.js';

/** Registers the next page as memorized, with an Undo toast. */
function memorizeNextPage() {
  const before = store.get().progress?.memorizedUpTo ?? 0;
  const after = markNextPage(store.get().progress);
  if (after === before) return;
  store.set((s) => {
    s.progress.memorizedUpTo = after;
  });
  toast(`Page ${after} memorized`, {
    actionLabel: 'Undo',
    onAction: () => {
      store.set((s) => {
        s.progress.memorizedUpTo = before;
      });
    },
  });
}

/**
 * Runs right after Hifdh is ticked for today (not on untick): offers to mark
 * the next page as memorized. Ignoring the toast leaves everything as it is;
 * no offer once all 604 pages are memorized.
 */
function afterHifdhTicked() {
  const next = nextPageLabel(store.get().progress);
  if (next === null) return;
  toast(`Mark page ${next} as memorized?`, {
    actionLabel: 'Mark',
    onAction: memorizeNextPage,
    duration: 8000,
  });
}

function cardHtml(progress) {
  // setMemorizedUpTo clamps whatever is stored to a valid 0-604 integer.
  const upTo = setMemorizedUpTo(progress, progress?.memorizedUpTo);
  const next = nextPageLabel(progress);
  const percent = (upTo / TOTAL_PAGES) * 100;

  const count = `
    <p class="quran-count"><b class="quran-count__num">${upTo}</b> <span class="muted">of ${TOTAL_PAGES} pages</span></p>
    <div class="quran-bar" role="progressbar" aria-label="Pages memorized"
      aria-valuemin="0" aria-valuemax="${TOTAL_PAGES}" aria-valuenow="${upTo}">
      <i style="width:${percent}%"></i>
    </div>`;

  if (next === null) {
    return `<section class="card quran-card quran-card--done">
      <p class="quran-mashallah font-adhkar" dir="rtl" lang="ar">ما شاء الله تبارك الله</p>
      <p class="quran-done">Masha'Allah, you completed the Qur'an</p>
      ${count}
    </section>`;
  }

  return `<section class="card quran-card">
    <p class="section-label">Memorization</p>
    ${count}
    <button type="button" class="btn btn-primary btn-wide quran-btn" data-quran-next>
      ${icon('check')} I memorized page ${next}
    </button>
  </section>`;
}

/**
 * @param {HTMLElement} view  The emptied <main class="app-view">.
 * @returns {() => void} Cleanup: stops listening to the store.
 */
export function render(view) {
  view.innerHTML = '<div class="screen"><h1 class="screen-title">Qur\'an</h1><div class="quran-slot"></div><div class="quran-goals-slot"></div></div>';
  const slot = view.querySelector('.quran-slot');
  const goalsSlot = view.querySelector('.quran-goals-slot');

  const paint = (state) => {
    slot.innerHTML = cardHtml(state.progress);
    goalsSlot.innerHTML = goalsHtml(state, new Date());
  };

  wireGoals(goalsSlot, { onHifdhTicked: afterHifdhTicked });
  // Coming back to the app on a new day shows fresh, unticked goals.
  const onVisible = () => { if (!document.hidden) paint(store.get()); };
  document.addEventListener('visibilitychange', onVisible);

  slot.addEventListener('click', (event) => {
    if (!event.target.closest('[data-quran-next]')) return;
    memorizeNextPage();
  });

  paint(store.get());
  const unsubscribe = store.subscribe(paint);
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisible);
  };
}
