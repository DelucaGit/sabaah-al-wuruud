import { describe, it, expect } from 'vitest';
import { dayKey, ensureToday, markDone, isDone, setCounter, getCounter } from './daily.js';

// Local-time dates (month is 0-based in the Date constructor).
const morning = new Date(2026, 10, 12, 6, 30);
const lateEvening = new Date(2026, 10, 12, 23, 59, 59);
const afterMidnight = new Date(2026, 10, 13, 0, 0, 1);

describe('dayKey', () => {
  it('formats the local date as YYYY-MM-DD with zero padding', () => {
    expect(dayKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });

  it('uses local midnight as the boundary', () => {
    expect(dayKey(new Date(2026, 10, 12, 0, 0, 0))).toBe('2026-11-12');
    expect(dayKey(lateEvening)).toBe('2026-11-12');
    expect(dayKey(afterMidnight)).toBe('2026-11-13');
  });
});

describe('ensureToday', () => {
  it('returns the same object when the day has not changed', () => {
    const daily = { dayKey: '2026-11-12', done: { morning: true }, counters: { a: 3 } };
    expect(ensureToday(daily, lateEvening)).toBe(daily);
  });

  it('returns a fresh state after midnight', () => {
    const daily = { dayKey: '2026-11-12', done: { morning: true }, counters: { a: 3 } };
    expect(ensureToday(daily, afterMidnight)).toEqual({
      dayKey: '2026-11-13',
      done: {},
      counters: {},
    });
  });

  it('creates a fresh state from nothing', () => {
    expect(ensureToday(undefined, morning)).toEqual({ dayKey: '2026-11-12', done: {}, counters: {} });
  });
});

describe('done sections', () => {
  it('stays done for the rest of the same day', () => {
    const daily = markDone(ensureToday(undefined, morning), 'morning', morning);
    expect(isDone(daily, 'morning', lateEvening)).toBe(true);
    expect(isDone(daily, 'evening', lateEvening)).toBe(false);
  });

  it("is not done for yesterday's mark", () => {
    const daily = markDone(undefined, 'morning', morning);
    expect(isDone(daily, 'morning', afterMidnight)).toBe(false);
  });

  it('drops yesterday\'s marks when marking a section today', () => {
    const yesterday = markDone(undefined, 'morning', morning);
    const today = markDone(yesterday, 'evening', afterMidnight);
    expect(isDone(today, 'evening', afterMidnight)).toBe(true);
    expect(isDone(today, 'morning', afterMidnight)).toBe(false);
  });

  it('does not mutate the input', () => {
    const daily = ensureToday(undefined, morning);
    markDone(daily, 'morning', morning);
    expect(daily.done).toEqual({});
  });
});

describe('counters', () => {
  it('is 0 when missing', () => {
    expect(getCounter(undefined, 'x', morning)).toBe(0);
    expect(getCounter(ensureToday(undefined, morning), 'x', morning)).toBe(0);
  });

  it('keeps the value for the rest of the same day', () => {
    let daily = setCounter(undefined, 'x', 42, morning);
    daily = setCounter(daily, 'y', 7, morning);
    expect(getCounter(daily, 'x', lateEvening)).toBe(42);
    expect(getCounter(daily, 'y', lateEvening)).toBe(7);
  });

  it("is 0 for yesterday's value", () => {
    const daily = setCounter(undefined, 'x', 42, morning);
    expect(getCounter(daily, 'x', afterMidnight)).toBe(0);
  });

  it("drops yesterday's counters when setting one today", () => {
    const yesterday = setCounter(undefined, 'x', 42, morning);
    const today = setCounter(yesterday, 'y', 1, afterMidnight);
    expect(getCounter(today, 'y', afterMidnight)).toBe(1);
    expect(getCounter(today, 'x', afterMidnight)).toBe(0);
  });

  it('can be reset to 0', () => {
    const daily = setCounter(setCounter(undefined, 'x', 42, morning), 'x', 0, morning);
    expect(getCounter(daily, 'x', morning)).toBe(0);
  });

  it('does not mutate the input', () => {
    const daily = ensureToday(undefined, morning);
    setCounter(daily, 'x', 5, morning);
    expect(daily.counters).toEqual({});
  });
});
