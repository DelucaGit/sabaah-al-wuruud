// Qur'an tab: memorization progress (pages of the 604-page Madinah mushaf)
// and one button to register the next memorized page, with Undo.

import './quran.css';
import { store } from '../adapters/storage.js';
import { TOTAL_PAGES, markNextPage, nextPageLabel, setMemorizedUpTo } from '../core/memorization.js';
import { icon, toast } from './kit.js';

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
  view.innerHTML = '<div class="screen"><h1 class="screen-title">Qur\'an</h1><div class="quran-slot"></div></div>';
  const slot = view.querySelector('.quran-slot');

  const paint = (state) => {
    slot.innerHTML = cardHtml(state.progress);
  };

  slot.addEventListener('click', (event) => {
    if (!event.target.closest('[data-quran-next]')) return;
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
  });

  paint(store.get());
  return store.subscribe(paint);
}
