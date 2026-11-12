import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE, defaultState, migrate, update } from './state.js';

describe('DEFAULT_STATE', () => {
  it('has the documented defaults', () => {
    expect(DEFAULT_STATE).toEqual({
      version: 1,
      settings: {
        theme: 'system',
        location: { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
        method: 'Egyptian',
        reminders: {
          morning: { enabled: true, prayer: 'fajr', offsetMin: 60 },
          evening: { enabled: true, prayer: 'asr', offsetMin: 60 },
          sleep: { enabled: true, time: '22:00' },
        },
      },
      progress: { memorizedUpTo: 0 },
      pins: { morning: [], evening: [], sleep: [] },
      daily: { dayKey: null, done: {}, counters: {} },
    });
  });

  it('cannot be mutated by accident', () => {
    expect(() => {
      DEFAULT_STATE.progress.memorizedUpTo = 5;
    }).toThrow();
    const copy = defaultState();
    copy.progress.memorizedUpTo = 5;
    expect(DEFAULT_STATE.progress.memorizedUpTo).toBe(0);
  });
});

describe('migrate', () => {
  it.each([null, undefined, 'garbage', 42, [], true])('returns defaults for %j', (raw) => {
    expect(migrate(raw)).toEqual(DEFAULT_STATE);
  });

  it('fills missing parts of a partial object with defaults', () => {
    const state = migrate({ settings: { theme: 'dark' }, progress: { memorizedUpTo: 12 } });
    expect(state.settings.theme).toBe('dark');
    expect(state.settings.location).toEqual(DEFAULT_STATE.settings.location);
    expect(state.settings.reminders).toEqual(DEFAULT_STATE.settings.reminders);
    expect(state.progress.memorizedUpTo).toBe(12);
    expect(state.pins).toEqual(DEFAULT_STATE.pins);
    expect(state.daily).toEqual(DEFAULT_STATE.daily);
  });

  it('merges nested objects field by field', () => {
    const state = migrate({
      settings: { reminders: { morning: { offsetMin: 30 }, sleep: { enabled: false } } },
    });
    expect(state.settings.reminders.morning).toEqual({ enabled: true, prayer: 'fajr', offsetMin: 30 });
    expect(state.settings.reminders.sleep).toEqual({ enabled: false, time: '22:00' });
  });

  it.each([
    [700, 604],
    [605, 604],
    [-3, 0],
    [12.7, 12],
    [Infinity, 604],
    [NaN, 0],
    ['50', 0],
  ])('clamps memorizedUpTo %j to %j', (input, expected) => {
    expect(migrate({ progress: { memorizedUpTo: input } }).progress.memorizedUpTo).toBe(expected);
  });

  it('falls back to defaults for invalid settings values', () => {
    const state = migrate({
      settings: {
        theme: 'neon',
        location: { name: '', lat: 200, lng: 'east' },
        method: 'Made-up',
        reminders: {
          morning: { enabled: 'yes', prayer: 'brunch', offsetMin: 1.5 },
          evening: 'nope',
          sleep: { time: '25:00' },
        },
      },
    });
    expect(state.settings).toEqual(DEFAULT_STATE.settings);
  });

  it('keeps valid non-default settings', () => {
    const settings = {
      theme: 'light',
      location: { name: 'Alexandria', lat: 31.2, lng: 29.9 },
      method: 'MuslimWorldLeague',
      reminders: {
        morning: { enabled: false, prayer: 'sunrise', offsetMin: -15 },
        evening: { enabled: true, prayer: 'maghrib', offsetMin: 0 },
        sleep: { enabled: true, time: '23:30' },
      },
    };
    expect(migrate({ settings }).settings).toEqual(settings);
  });

  it('drops unknown keys at every level', () => {
    const state = migrate({
      junk: 1,
      settings: { theme: 'dark', extra: true, location: { name: 'X', lat: 1, lng: 2, alt: 3 } },
      progress: { memorizedUpTo: 3, streak: 9 },
      pins: { morning: [], other: ['a'] },
    });
    expect(state).not.toHaveProperty('junk');
    expect(state.settings).not.toHaveProperty('extra');
    expect(state.settings.location).toEqual({ name: 'X', lat: 1, lng: 2 });
    expect(state.progress).toEqual({ memorizedUpTo: 3 });
    expect(Object.keys(state.pins)).toEqual(['morning', 'evening', 'sleep']);
  });

  it('preserves the pins and progress of an older state', () => {
    const old = {
      version: 0,
      progress: { memorizedUpTo: 42 },
      pins: { morning: ['m-3', 'm-1'], evening: ['e-7'], sleep: [] },
    };
    const state = migrate(old);
    expect(state.version).toBe(1);
    expect(state.progress.memorizedUpTo).toBe(42);
    expect(state.pins).toEqual({ morning: ['m-3', 'm-1'], evening: ['e-7'], sleep: [] });
  });

  it('cleans pin lists of non-strings and duplicates', () => {
    const state = migrate({ pins: { morning: ['a', 1, null, 'a', '', 'b'], evening: 'x' } });
    expect(state.pins.morning).toEqual(['a', 'b']);
    expect(state.pins.evening).toEqual([]);
  });

  it('keeps valid daily data and drops invalid entries', () => {
    const state = migrate({
      daily: {
        dayKey: '2026-11-12',
        done: { morning: true, evening: 'yes' },
        counters: { 'm-12': 37, 'm-13': -1, 'm-14': 2.5 },
      },
    });
    expect(state.daily).toEqual({
      dayKey: '2026-11-12',
      done: { morning: true },
      counters: { 'm-12': 37 },
    });
  });

  it('is idempotent and never returns the defaults object itself', () => {
    const once = migrate({ progress: { memorizedUpTo: 10 } });
    expect(migrate(once)).toEqual(once);
    expect(migrate(null)).not.toBe(DEFAULT_STATE);
    expect(migrate(null).pins.morning).not.toBe(DEFAULT_STATE.pins.morning);
  });
});

describe('update', () => {
  it('applies a mutating patch without touching the input', () => {
    const before = migrate(null);
    const after = update(before, (s) => {
      s.progress.memorizedUpTo = 5;
      s.pins.morning.push('m-1');
    });
    expect(after.progress.memorizedUpTo).toBe(5);
    expect(after.pins.morning).toEqual(['m-1']);
    expect(before.progress.memorizedUpTo).toBe(0);
    expect(before.pins.morning).toEqual([]);
  });

  it('accepts a patch that returns a new state', () => {
    const after = update(migrate(null), (s) => ({ ...s, settings: { ...s.settings, theme: 'dark' } }));
    expect(after.settings.theme).toBe('dark');
  });

  it('keeps the result valid', () => {
    const after = update(migrate(null), (s) => {
      s.progress.memorizedUpTo = 9999;
      s.settings.theme = 'neon';
    });
    expect(after.progress.memorizedUpTo).toBe(604);
    expect(after.settings.theme).toBe('system');
  });
});
