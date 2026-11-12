// localStorage-backed store for the app state. Corrupt or missing data never
// throws: it falls back to the defaults via `migrate`.
import { migrate, update } from '../core/state.js';

export const STORAGE_KEY = 'sabaah-al-wuruud';

/**
 * @param {{ storage?: Pick<Storage, 'getItem' | 'setItem'>, key?: string }} [options]
 *   `storage` defaults to `window.localStorage`, or an in-memory store when
 *   that is unavailable (tests, SSR, blocked storage).
 */
export function createStore({ storage = defaultStorage(), key = STORAGE_KEY } = {}) {
  let state = migrate(read(storage, key));
  const listeners = new Set();

  return {
    get() {
      return state;
    },
    set(patchFn) {
      const prev = state;
      state = update(state, patchFn);
      write(storage, key, state);
      listeners.forEach((listener) => listener(state, prev));
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function read(storage, key) {
  try {
    const json = storage.getItem(key);
    return json == null ? null : JSON.parse(json);
  } catch {
    return null;
  }
}

function write(storage, key, state) {
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage blocked: keep the in-memory state.
  }
}

export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

function defaultStorage() {
  try {
    const ls = globalThis.window?.localStorage;
    if (ls && typeof ls.getItem === 'function') return ls;
  } catch {
    // Accessing localStorage can throw when storage is disabled.
  }
  return createMemoryStorage();
}

/** App-wide singleton for the UI. */
export const store = createStore();
