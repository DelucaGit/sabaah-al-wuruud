import { describe, it, expect } from 'vitest';
import { defaultState, update, migrate } from './state.js';
import {
  setHifdhTarget, setMurajaaTarget, addChecklistItem, editChecklistItem, removeChecklistItem,
  setChecklistDone, markHifdhDone, isHifdhDone, isMurajaaDone, isChecklistDone,
  suggestMurajaa, markMurajaaDone, lastRevisedOn,
} from './goals.js';

const d1 = new Date(2026, 10, 14, 9);
const d2 = new Date(2026, 10, 15, 9);
const memorized = (n) => update(defaultState(), (s) => { s.progress.memorizedUpTo = n; });

describe('migration', () => {
  it('gives old states goal defaults and never-revised pages', () => {
    const s = migrate({ version: 1, progress: { memorizedUpTo: 7 } });
    expect(s.goals.hifdhTarget).toBe(1);
    expect(s.goals.murajaaTarget).toBe(5);
    expect(s.goals.lastRevised).toEqual({});
    expect(migrate(null).goals.items).toEqual([]);
  });
  it('drops invalid goal data', () => {
    const s = migrate({ progress: { memorizedUpTo: 3 }, goals: {
      hifdhTarget: -2, murajaaTarget: 'x',
      items: [{ id: 'a', text: ' hi ' }, { id: 'a', text: 'dup' }, { id: '', text: 'x' }, { id: 'b', text: ' ' }, 5],
      lastRevised: { 1: '2026-01-01', 2: 'bad', 9: '2026-01-01' },
    } });
    expect(s.goals.hifdhTarget).toBe(1);
    expect(s.goals.murajaaTarget).toBe(5);
    expect(s.goals.items).toEqual([{ id: 'a', text: 'hi' }]);
    expect(s.goals.lastRevised).toEqual({ 1: '2026-01-01' });
  });
});

describe('targets and checklist', () => {
  it('sets targets', () => {
    let s = setHifdhTarget(defaultState(), 2, d1);
    s = setMurajaaTarget(s, 10, d1);
    expect(s.goals.hifdhTarget).toBe(2);
    expect(s.goals.murajaaTarget).toBe(10);
  });
  it('adds, edits, removes items with ids', () => {
    let { state: s, id } = addChecklistItem(defaultState(), ' Read Mulk ', d1);
    expect(s.goals.items).toEqual([{ id, text: 'Read Mulk' }]);
    s = editChecklistItem(s, id, 'Read Kahf', d1);
    expect(s.goals.items[0].text).toBe('Read Kahf');
    s = setChecklistDone(s, id, true, d1);
    expect(isChecklistDone(s, id, d1)).toBe(true);
    s = removeChecklistItem(s, id, d1);
    expect(s.goals.items).toEqual([]);
    expect(s.goals.daily.done[id]).toBeUndefined();
  });
  it('ignores blank items and unknown ids', () => {
    expect(addChecklistItem(defaultState(), '  ', d1).id).toBeNull();
    const s = setChecklistDone(defaultState(), 'nope', true, d1);
    expect(s.goals.daily.done.nope).toBeUndefined();
  });
  it('keeps ids unique', () => {
    const s = addChecklistItem(defaultState(), 'a', d1, () => 'x').state;
    const ids = ['x', 'y'];
    expect(addChecklistItem(s, 'b', d1, () => ids.shift()).id).toBe('y');
  });
});

describe('daily reset', () => {
  it('resets done flags next day but keeps items and revision dates', () => {
    let { state: s, id } = addChecklistItem(memorized(10), 'a', d1);
    s = setChecklistDone(markHifdhDone(markMurajaaDone(s, d1), d1), id, true, d1);
    expect(isHifdhDone(s, d1) && isMurajaaDone(s, d1) && isChecklistDone(s, id, d1)).toBe(true);
    expect(isHifdhDone(s, d2) || isMurajaaDone(s, d2) || isChecklistDone(s, id, d2)).toBe(false);
    expect(lastRevisedOn(s, 1)).toBe('2026-11-14');
    expect(s.goals.items).toHaveLength(1);
  });
  it('does not mutate input', () => {
    const s = defaultState();
    const copy = structuredClone(s);
    markHifdhDone(s, d1);
    expect(s).toEqual(copy);
  });
});

describe('hifdh', () => {
  it('can be done without memorizing a page', () => {
    const s = markHifdhDone(memorized(3), d1);
    expect(isHifdhDone(s, d1)).toBe(true);
    expect(s.progress.memorizedUpTo).toBe(3);
  });
});

describe('murajaa suggestion', () => {
  it('is empty when nothing is memorized', () => {
    expect(suggestMurajaa(defaultState(), d1)).toEqual([]);
  });
  it('picks never-revised pages first, lowest first', () => {
    expect(suggestMurajaa(memorized(8), d1)).toEqual([1, 2, 3, 4, 5]);
    expect(suggestMurajaa(memorized(3), d1)).toEqual([1, 2, 3]);
  });
  it('rotates through pages across days, oldest first', () => {
    const s = markMurajaaDone(memorized(8), d1);
    expect(lastRevisedOn(s, 5)).toBe('2026-11-14');
    expect(lastRevisedOn(s, 6)).toBeNull();
    expect(suggestMurajaa(s, d2)).toEqual([6, 7, 8, 1, 2]);
  });
  it('prefers older dates over newer ones', () => {
    let s = update(memorized(3), (x) => { x.goals.lastRevised = { 1: '2026-11-10', 2: '2026-11-01', 3: '2026-11-05' }; });
    s = setMurajaaTarget(s, 2, d1);
    expect(suggestMurajaa(s, d1)).toEqual([2, 3]);
  });
  it('stays stable after being marked done', () => {
    const s = markMurajaaDone(memorized(8), d1);
    expect(suggestMurajaa(s, d1)).toEqual([1, 2, 3, 4, 5]);
  });
  it('respects target changes', () => {
    expect(suggestMurajaa(setMurajaaTarget(memorized(8), 2, d1), d1)).toEqual([1, 2]);
  });
});
