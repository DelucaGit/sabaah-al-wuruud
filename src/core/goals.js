// Quran goals: Hifdh and Murajaa daily targets (pages), an editable checklist,
// per-day done flags (reset by the day key) and a last-revised date per
// memorized page. Pure functions over the whole app state: they never read the
// clock (callers pass `now`) and never mutate their input. No streaks.
//
// state.goals = {
//   hifdhTarget, murajaaTarget,            // pages per day
//   items: [{ id, text }],                 // checklist
//   lastRevised: { [page]: 'YYYY-MM-DD' }, // missing = never revised
//   daily: { dayKey, done: { hifdh, murajaa, [itemId] }, murajaaPages: [] },
// }

import { dayKey } from './daily.js';
import { update } from './state.js';

export const HIFDH = 'hifdh';
export const MURAJAA = 'murajaa';

function todayGoals(state, now) {
  const g = update(state, () => {}).goals;
  const key = dayKey(now);
  return g.daily.dayKey === key ? g : { ...g, daily: { dayKey: key, done: {}, murajaaPages: [] } };
}

function withGoals(state, now, fn) {
  return update(state, (s) => {
    s.goals = fn(todayGoals(s, now));
  });
}

export function setHifdhTarget(state, pages, now) {
  return withGoals(state, now, (g) => ({ ...g, hifdhTarget: pages }));
}

export function setMurajaaTarget(state, pages, now) {
  return withGoals(state, now, (g) => ({ ...g, murajaaTarget: pages }));
}

/** Adds a checklist item; returns `{ state, id }` (id null and state unchanged if text is blank). */
export function addChecklistItem(state, text, now, makeId = defaultId) {
  const t = String(text ?? '').trim();
  if (!t) return { state: update(state, () => {}), id: null };
  const existing = todayGoals(state, now).items;
  let id = makeId();
  while (existing.some((i) => i.id === id)) id = makeId();
  return { state: withGoals(state, now, (g) => ({ ...g, items: [...g.items, { id, text: t }] })), id };
}

export function editChecklistItem(state, id, text, now) {
  return withGoals(state, now, (g) => ({
    ...g,
    items: g.items.map((i) => (i.id === id ? { ...i, text } : i)),
  }));
}

export function removeChecklistItem(state, id, now) {
  return withGoals(state, now, (g) => {
    const { [id]: _gone, ...done } = g.daily.done;
    return { ...g, items: g.items.filter((i) => i.id !== id), daily: { ...g.daily, done } };
  });
}

export function setChecklistDone(state, id, done, now) {
  return withGoals(state, now, (g) =>
    g.items.some((i) => i.id === id)
      ? { ...g, daily: { ...g.daily, done: { ...g.daily.done, [id]: !!done } } }
      : g,
  );
}

/** Hifdh done today; independent of "memorize a page". */
export function markHifdhDone(state, now) {
  return withGoals(state, now, (g) => ({ ...g, daily: { ...g.daily, done: { ...g.daily.done, [HIFDH]: true } } }));
}

export function isHifdhDone(state, now) {
  return todayGoals(state, now).daily.done[HIFDH] === true;
}

export function isMurajaaDone(state, now) {
  return todayGoals(state, now).daily.done[MURAJAA] === true;
}

export function isChecklistDone(state, id, now) {
  return todayGoals(state, now).daily.done[id] === true;
}

/**
 * Today's Murajaa pages: the `murajaaTarget` memorized pages (1..memorizedUpTo)
 * revised longest ago, never-revised first, ties by lowest page. Once Murajaa
 * is done today, the pages that were recorded are returned unchanged.
 */
export function suggestMurajaa(state, now) {
  const g = todayGoals(state, now);
  if (g.daily.done[MURAJAA] === true && g.daily.murajaaPages.length) return [...g.daily.murajaaPages];
  const upTo = update(state, () => {}).progress.memorizedUpTo;
  const pages = Array.from({ length: upTo }, (_, i) => i + 1);
  const date = (p) => g.lastRevised[p] ?? '';
  pages.sort((a, b) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : a - b));
  return pages.slice(0, g.murajaaTarget);
}

/** Marks Murajaa done and records today as last-revised for the suggested pages. */
export function markMurajaaDone(state, now) {
  const pages = suggestMurajaa(state, now);
  const key = dayKey(now);
  return withGoals(state, now, (g) => {
    const lastRevised = { ...g.lastRevised };
    pages.forEach((p) => { lastRevised[p] = key; });
    return { ...g, lastRevised, daily: { ...g.daily, done: { ...g.daily.done, [MURAJAA]: true }, murajaaPages: pages } };
  });
}

/** Last-revised 'YYYY-MM-DD' for a page, or null if never revised. */
export function lastRevisedOn(state, page) {
  return update(state, () => {}).goals.lastRevised[page] ?? null;
}

function defaultId() {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
