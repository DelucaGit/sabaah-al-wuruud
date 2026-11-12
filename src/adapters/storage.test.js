import { describe, it, expect, vi } from 'vitest';
import { createStore, createMemoryStorage, store, STORAGE_KEY } from './storage.js';
import { DEFAULT_STATE } from '../core/state.js';

const KEY = 'test-key';

function fakeStorage(initial) {
  return createMemoryStorage(initial === undefined ? {} : { [KEY]: initial });
}

describe('createStore', () => {
  it('starts with defaults when nothing is stored', () => {
    expect(createStore({ storage: fakeStorage(), key: KEY }).get()).toEqual(DEFAULT_STATE);
  });

  it('falls back to defaults on corrupt JSON without throwing', () => {
    const s = createStore({ storage: fakeStorage('{not json'), key: KEY });
    expect(s.get()).toEqual(DEFAULT_STATE);
  });

  it('falls back to defaults when the storage itself throws', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
    };
    const s = createStore({ storage: broken, key: KEY });
    expect(s.get()).toEqual(DEFAULT_STATE);
    expect(() => s.set((st) => { st.progress.memorizedUpTo = 1; })).not.toThrow();
    expect(s.get().progress.memorizedUpTo).toBe(1);
  });

  it('migrates stored data on load', () => {
    const stored = JSON.stringify({ version: 0, progress: { memorizedUpTo: 900 }, pins: { morning: ['m-1'] } });
    const state = createStore({ storage: fakeStorage(stored), key: KEY }).get();
    expect(state.version).toBe(1);
    expect(state.progress.memorizedUpTo).toBe(604);
    expect(state.pins.morning).toEqual(['m-1']);
  });

  it('persists after each set so a new store sees the change', () => {
    const storage = fakeStorage();
    const a = createStore({ storage, key: KEY });
    a.set((s) => { s.progress.memorizedUpTo = 7; });
    a.set((s) => { s.settings.theme = 'dark'; });

    const b = createStore({ storage, key: KEY });
    expect(b.get().progress.memorizedUpTo).toBe(7);
    expect(b.get().settings.theme).toBe('dark');
  });

  it('uses the given key', () => {
    const storage = fakeStorage();
    createStore({ storage, key: 'other' }).set((s) => { s.progress.memorizedUpTo = 3; });
    expect(storage.getItem(KEY)).toBeNull();
    expect(JSON.parse(storage.getItem('other')).progress.memorizedUpTo).toBe(3);
  });

  it('set returns the new state and does not mutate the previous one', () => {
    const s = createStore({ storage: fakeStorage(), key: KEY });
    const before = s.get();
    const after = s.set((st) => { st.pins.evening.push('e-1'); });
    expect(after).toBe(s.get());
    expect(after.pins.evening).toEqual(['e-1']);
    expect(before.pins.evening).toEqual([]);
  });

  it('notifies subscribers with the new and previous state until unsubscribed', () => {
    const s = createStore({ storage: fakeStorage(), key: KEY });
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);

    const prev = s.get();
    const next = s.set((st) => { st.progress.memorizedUpTo = 2; });
    expect(listener).toHaveBeenCalledWith(next, prev);

    unsubscribe();
    s.set((st) => { st.progress.memorizedUpTo = 3; });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('store singleton', () => {
  it('is usable without a browser localStorage', () => {
    expect(STORAGE_KEY).toBe('sabaah-al-wuruud');
    expect(store.get().version).toBe(1);
  });
});
