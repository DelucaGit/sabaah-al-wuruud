import { describe, it, expect } from 'vitest';
import { getPrayerTimes } from './prayer.js';
import { activeSection, dayTimeline } from './timeline.js';

const CAIRO = { name: 'Cairo', lat: 30.0444, lng: 31.2357 };
const times = getPrayerTimes(new Date('2026-01-15T10:00:00Z'), CAIRO);
const at = (date, deltaMs) => new Date(date.getTime() + deltaMs);
const MIN = 60 * 1000;

// Compact view of a timeline: prayers by key, sections in brackets (* = active), NOW.
const shape = (items) => items.map((item) => {
  if (item.type === 'now') return 'NOW';
  if (item.type === 'section') return `[${item.key}${item.active ? '*' : ''}]`;
  return item.key;
});

describe('activeSection', () => {
  it('is morning from Fajr until Asr', () => {
    expect(activeSection(times.fajr, times)).toBe('morning');
    expect(activeSection(at(times.asr, -1), times)).toBe('morning');
  });
  it('is evening from Asr until Isha', () => {
    expect(activeSection(times.asr, times)).toBe('evening');
    expect(activeSection(at(times.isha, -1), times)).toBe('evening');
  });
  it('is sleep from Isha through the night until Fajr', () => {
    expect(activeSection(times.isha, times)).toBe('sleep');
    expect(activeSection(at(times.fajr, -1), times)).toBe('sleep');
  });
});

describe('dayTimeline', () => {
  it('puts the adhkar after their prayer and marks now mid-morning', () => {
    expect(shape(dayTimeline(at(times.sunrise, 30 * MIN), times))).toEqual([
      'fajr', '[morning*]', 'sunrise', 'NOW', 'dhuhr', 'asr', '[evening]', 'maghrib', 'isha', '[sleep]',
    ]);
  });

  it('marks now right after Asr with the evening adhkar active', () => {
    expect(shape(dayTimeline(at(times.asr, 30 * MIN), times))).toEqual([
      'fajr', '[morning]', 'sunrise', 'dhuhr', 'asr', '[evening*]', 'NOW', 'maghrib', 'isha', '[sleep]',
    ]);
  });

  it('marks now after Isha with the sleep adhkar active', () => {
    expect(shape(dayTimeline(at(times.isha, 60 * MIN), times))).toEqual([
      'fajr', '[morning]', 'sunrise', 'dhuhr', 'asr', '[evening]', 'maghrib', 'isha', 'NOW', '[sleep*]',
    ]);
  });

  it('marks now at the top before Fajr, still on the sleep adhkar', () => {
    expect(shape(dayTimeline(at(times.fajr, -60 * MIN), times))).toEqual([
      'NOW', 'fajr', '[morning]', 'sunrise', 'dhuhr', 'asr', '[evening]', 'maghrib', 'isha', '[sleep*]',
    ]);
  });

  it('flags past prayers and exactly one next prayer', () => {
    const prayers = dayTimeline(at(times.dhuhr, 10 * MIN), times).filter((i) => i.type === 'prayer');
    expect(prayers.filter((p) => p.past).map((p) => p.key)).toEqual(['fajr', 'sunrise', 'dhuhr']);
    expect(prayers.filter((p) => p.next).map((p) => p.key)).toEqual(['asr']);
    expect(prayers.find((p) => p.key === 'asr').time).toBe(times.asr);
  });

  it('has no next prayer once the day is over', () => {
    const prayers = dayTimeline(at(times.isha, MIN), times).filter((i) => i.type === 'prayer');
    expect(prayers.some((p) => p.next)).toBe(false);
  });
});
