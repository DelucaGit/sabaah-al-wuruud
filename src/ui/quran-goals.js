// Qur'an tab, "Today's goals" card: Hifdh and Murajaa (daily targets in
// pages) plus her own checklist items. Everything can be ticked and unticked;
// the ticks reset with the day. No streaks, no counts of missed days.

import './quran-goals.css';
import { store } from '../adapters/storage.js';
import { tap } from '../adapters/haptics.js';
import {
  HIFDH, MURAJAA,
  setHifdhTarget, setMurajaaTarget,
  addChecklistItem, editChecklistItem, removeChecklistItem, setChecklistDone,
  markHifdhDone, unmarkHifdhDone, isHifdhDone,
  markMurajaaDone, unmarkMurajaaDone, isMurajaaDone,
  isChecklistDone, suggestMurajaa,
} from '../core/goals.js';
import { esc, icon, openSheet, toast } from './kit.js';

const MIN_TARGET = 1;
const MAX_TARGET = 50;
const MAX_ITEM_TEXT = 100;

const pagesLabel = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`;

/** [1,2,3,7] -> "pages 1–3, 7"; [4] -> "page 4". */
export function formatPages(pages) {
  const sorted = [...pages].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i += 1) {
    let j = i;
    while (sorted[j + 1] === sorted[j] + 1) j += 1;
    parts.push(j > i ? `${sorted[i]}–${sorted[j]}` : `${sorted[i]}`);
    i = j;
  }
  return `${sorted.length === 1 ? 'page' : 'pages'} ${parts.join(', ')}`;
}

function rowHtml({ key, title, sub, done, chip, editLabel }) {
  return `<li class="goal${done ? ' is-done' : ''}">
    <button type="button" class="goal__tick" role="checkbox" aria-checked="${done}"
      aria-label="${esc(title)}" data-goal-tick="${esc(key)}">${icon('check')}</button>
    <button type="button" class="goal__body" data-goal-edit="${esc(key)}" aria-label="${esc(editLabel)}">
      <span class="goal__text">
        <span class="goal__title">${esc(title)}</span>
        ${sub ? `<span class="goal__sub">${esc(sub)}</span>` : ''}
      </span>
      <span class="goal__chip">${esc(chip)}</span>
    </button>
  </li>`;
}

function murajaaSub(state, now, done) {
  const pages = suggestMurajaa(state, now);
  if (!pages.length) {
    return done ? 'Revised today' : 'Your memorized pages will show up here to revise';
  }
  const list = formatPages(pages);
  return done ? `Revised ${list} today` : `Today: ${list}`;
}

/** HTML for the goals card. `now` decides which day's ticks are shown. */
export function goalsHtml(state, now) {
  const g = state.goals;
  const hifdhDone = isHifdhDone(state, now);
  const murajaaDone = isMurajaaDone(state, now);
  const itemDone = g.items.map((it) => isChecklistDone(state, it.id, now));
  const doneCount = [hifdhDone, murajaaDone, ...itemDone].filter(Boolean).length;
  const total = 2 + g.items.length;

  const note = doneCount === total
    ? 'Alhamdulillah, today’s goals are complete.'
    : doneCount > 0
      ? 'Beautifully done. Carry on at your own pace.'
      : 'A little, done regularly, is beloved to Allah.';

  const rows = [
    rowHtml({
      key: HIFDH,
      title: 'Hifdh',
      sub: hifdhDone ? 'Done today, masha’Allah' : 'New memorization',
      done: hifdhDone,
      chip: pagesLabel(g.hifdhTarget),
      editLabel: `Change Hifdh target, now ${pagesLabel(g.hifdhTarget)} a day`,
    }),
    rowHtml({
      key: MURAJAA,
      title: 'Murajaa',
      sub: murajaaSub(state, now, murajaaDone),
      done: murajaaDone,
      chip: pagesLabel(g.murajaaTarget),
      editLabel: `Change Murajaa target, now ${pagesLabel(g.murajaaTarget)} a day`,
    }),
    ...g.items.map((it, i) => rowHtml({
      key: `item:${it.id}`,
      title: it.text,
      sub: '',
      done: itemDone[i],
      chip: 'Edit',
      editLabel: `Edit ${it.text}`,
    })),
  ].join('');

  return `<section class="card goals-card" aria-label="Today's goals">
    <p class="section-label">Today's goals</p>
    <ul class="goals-list">${rows}</ul>
    <button type="button" class="btn btn-ghost btn-wide goals-add" data-goal-add>${icon('plus')} Add your own</button>
    <p class="goals-note" aria-live="polite">${esc(note)}</p>
  </section>`;
}

// --- sheets ------------------------------------------------------------------

function openTargetSheet(kind) {
  const isHifdh = kind === HIFDH;
  const read = () => (isHifdh ? store.get().goals.hifdhTarget : store.get().goals.murajaaTarget);
  const close = openSheet({
    title: isHifdh ? 'Hifdh target' : 'Murajaa target',
    bodyHtml: `<p class="goals-sheet__hint">${isHifdh
      ? 'How many new pages feels right for a day?'
      : 'How many pages would you like to revise each day?'} You can change it whenever you like.</p>
      <div class="goals-stepper">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Fewer pages">${icon('minus')}</button>
        <p class="goals-stepper__value" aria-live="polite"><b></b><span></span></p>
        <button type="button" class="icon-btn" data-step="1" aria-label="More pages">${icon('plus')}</button>
      </div>
      <button type="button" class="btn btn-primary btn-wide" data-sheet-done>Done</button>`,
  });
  const body = close.body;
  const show = () => {
    const n = read();
    body.querySelector('.goals-stepper__value b').textContent = String(n);
    body.querySelector('.goals-stepper__value span').textContent = `${n === 1 ? 'page' : 'pages'} a day`;
    body.querySelector('[data-step="-1"]').disabled = n <= MIN_TARGET;
    body.querySelector('[data-step="1"]').disabled = n >= MAX_TARGET;
  };
  body.addEventListener('click', (event) => {
    if (event.target.closest('[data-sheet-done]')) return close();
    const step = event.target.closest('[data-step]');
    if (!step) return undefined;
    const n = Math.min(MAX_TARGET, Math.max(MIN_TARGET, read() + Number(step.dataset.step)));
    const now = new Date();
    store.set((s) => (isHifdh ? setHifdhTarget(s, n, now) : setMurajaaTarget(s, n, now)));
    show();
    return undefined;
  });
  show();
}

function openItemSheet(id) {
  const item = id ? store.get().goals.items.find((i) => i.id === id) : null;
  if (id && !item) return;
  const close = openSheet({
    title: item ? 'Edit goal' : 'Add your own goal',
    bodyHtml: `<form class="goals-form" novalidate>
      <input class="goals-field" type="text" maxlength="${MAX_ITEM_TEXT}" autocomplete="off"
        aria-label="Goal" placeholder="e.g. Read Surah Al-Mulk" value="${esc(item?.text)}">
      <button type="submit" class="btn btn-primary btn-wide">${item ? 'Save' : 'Add'}</button>
      ${item ? '<button type="button" class="btn btn-ghost btn-wide" data-item-remove>Remove this goal</button>' : ''}
    </form>`,
  });
  const form = close.body.querySelector('form');
  const input = form.querySelector('input');
  input.focus();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    const now = new Date();
    store.set((s) => (item ? editChecklistItem(s, item.id, text, now) : addChecklistItem(s, text, now).state));
    close();
  });

  form.querySelector('[data-item-remove]')?.addEventListener('click', () => {
    const before = store.get().goals;
    store.set((s) => removeChecklistItem(s, item.id, new Date()));
    close();
    toast('Goal removed', {
      actionLabel: 'Undo',
      onAction: () => store.set((s) => { s.goals = before; }),
    });
  });
}

// --- wiring ------------------------------------------------------------------

/**
 * Wires taps inside `slot` (which holds goalsHtml output; the caller repaints
 * it on store changes).
 * @param {HTMLElement} slot
 * @param {{ onHifdhTicked?: () => void }} [hooks]  `onHifdhTicked` runs right
 *   after Hifdh goes from not done to done.
 */
export function wireGoals(slot, { onHifdhTicked } = {}) {
  slot.addEventListener('click', (event) => {
    if (event.target.closest('[data-goal-add]')) return openItemSheet(null);

    const edit = event.target.closest('[data-goal-edit]')?.dataset.goalEdit;
    if (edit) {
      return edit === HIFDH || edit === MURAJAA ? openTargetSheet(edit) : openItemSheet(edit.slice('item:'.length));
    }

    const key = event.target.closest('[data-goal-tick]')?.dataset.goalTick;
    if (!key) return undefined;
    const now = new Date();
    const state = store.get();
    tap();
    if (key === HIFDH) {
      const done = isHifdhDone(state, now);
      store.set((s) => (done ? unmarkHifdhDone(s, now) : markHifdhDone(s, now)));
      if (!done) onHifdhTicked?.();
    } else if (key === MURAJAA) {
      store.set((s) => (isMurajaaDone(state, now) ? unmarkMurajaaDone(s, now) : markMurajaaDone(s, now)));
    } else {
      const id = key.slice('item:'.length);
      store.set((s) => setChecklistDone(s, id, !isChecklistDone(state, id, now), now));
    }
    // The card was repainted: put focus back on the same tick.
    [...slot.querySelectorAll('[data-goal-tick]')].find((b) => b.dataset.goalTick === key)?.focus();
    return undefined;
  });
}
