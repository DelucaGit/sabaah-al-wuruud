import { describe, it, expect } from 'vitest';
import {
  WINDOW_KEYS, minutesOfDay, angleForMinutes, angleOf, dotAngles, windowArcs,
  currentWindow, nextWindowStart, timeLeftInWindow, dialGeometry,
} from './dial.js';
import { getPrayerTimes } from './prayer.js';

const TZ = 'Africa/Cairo'; // UTC+2 in January (no DST)
// Cairo wall-clock time on 2026-01-15 (day offset allowed) as a Date.
const cairo = (h, m, s = 0, day = 15) => new Date(Date.UTC(2026, 0, day, h - 2, m, s));
const MIN = 60 * 1000;

const times = {
  fajr: cairo(5, 15),
  sunrise: cairo(6, 45),
  dhuhr: cairo(12, 5),
  asr: cairo(15, 0),
  maghrib: cairo(17, 20),
  isha: cairo(18, 40),
};

describe('angle convention', () => {
  it('puts midnight at 0 (top) and runs clockwise through the day', () => {
    expect(angleForMinutes(0)).toBe(0);
    expect(angleForMinutes(6 * 60)).toBe(90);
    expect(angleForMinutes(12 * 60)).toBe(180);
    expect(angleForMinutes(18 * 60)).toBe(270);
    expect(angleForMinutes(24 * 60)).toBe(0);
    expect(angleForMinutes(-60)).toBe(345);
  });

  it('reads the clock in the location time zone', () => {
    expect(minutesOfDay(cairo(0, 0), TZ)).toBe(0);
    expect(minutesOfDay(cairo(13, 30, 30), TZ)).toBe(13 * 60 + 30.5);
    expect(angleOf(cairo(12, 0), TZ)).toBe(180);
    expect(angleOf(cairo(12, 0), 'UTC')).toBe(150);
  });

  it('just before and after midnight sits either side of the top', () => {
    expect(angleOf(cairo(23, 59), TZ)).toBeCloseTo(359.75);
    expect(angleOf(cairo(0, 1, 0, 16), TZ)).toBeCloseTo(0.25);
  });

  it('places every dot at its true clock position', () => {
    const d = dotAngles(times, TZ);
    expect(d.fajr).toBeCloseTo((5.25 / 24) * 360);
    expect(d.sunrise).toBeCloseTo((6.75 / 24) * 360);
    expect(d.dhuhr).toBeCloseTo(((12 + 5 / 60) / 24) * 360);
    expect(d.asr).toBe(225);
    expect(d.maghrib).toBeCloseTo(((17 + 1 / 3) / 24) * 360);
    expect(d.isha).toBe(280);
  });
});

describe('windowArcs', () => {
  it('covers the ring once, Isha wrapping past 360 to Fajr', () => {
    const arcs = windowArcs(times, TZ);
    expect(arcs.map((a) => a.key)).toEqual(WINDOW_KEYS);
    for (let i = 0; i < arcs.length - 1; i++) expect(arcs[i].end).toBeCloseTo(arcs[i + 1].start);
    const isha = arcs[5];
    expect(isha.start).toBe(280);
    expect(isha.end).toBeCloseTo(360 + arcs[0].start);
    const sweep = arcs.reduce((sum, a) => sum + (a.end - a.start), 0);
    expect(sweep).toBeCloseTo(360);
  });

  it('handles an Isha after midnight (Isha arc starts past the top)', () => {
    const late = { ...times, isha: cairo(0, 30, 0, 16) };
    const arcs = windowArcs(late, TZ);
    expect(arcs[4].start).toBeLessThan(arcs[4].end);
    expect(arcs[4].end).toBeCloseTo(360 + 7.5);
    expect(arcs[5].start).toBeCloseTo(7.5);
    expect(arcs[5].end).toBeCloseTo(arcs[0].start);
  });
});

describe('currentWindow', () => {
  const cases = [
    ['fajr', 'fajr'], ['sunrise', 'duha'], ['dhuhr', 'dhuhr'],
    ['asr', 'asr'], ['maghrib', 'maghrib'], ['isha', 'isha'],
  ];
  for (const [start, key] of cases) {
    it(`switches to ${key} exactly at ${start}`, () => {
      const at = times[start];
      expect(currentWindow(times, at)).toBe(key);
      const before = currentWindow(times, new Date(at.getTime() - 1));
      expect(before).toBe(WINDOW_KEYS[(WINDOW_KEYS.indexOf(key) + 5) % 6]);
    });
  }

  it('is Isha just before and after midnight and before Fajr', () => {
    expect(currentWindow(times, cairo(23, 59))).toBe('isha');
    expect(currentWindow(times, cairo(0, 0))).toBe('isha');
    expect(currentWindow(times, cairo(0, 1))).toBe('isha');
    expect(currentWindow(times, cairo(4, 0))).toBe('isha');
  });

  it('is exactly one window for every minute of the day', () => {
    for (let m = 0; m < 24 * 60; m++) {
      expect(WINDOW_KEYS).toContain(currentWindow(times, new Date(cairo(0, 0).getTime() + m * MIN)));
    }
  });
});

describe('time left', () => {
  it('counts down to the next window start', () => {
    expect(nextWindowStart(times, cairo(7, 0))).toEqual({ key: 'dhuhr', time: times.dhuhr });
    expect(timeLeftInWindow(times, cairo(12, 0))).toBe(5 * MIN);
  });

  it('before Fajr counts down to today\'s Fajr', () => {
    expect(nextWindowStart(times, cairo(3, 0))).toEqual({ key: 'fajr', time: times.fajr });
    expect(timeLeftInWindow(times, cairo(5, 0))).toBe(15 * MIN);
  });

  it('after Isha counts down across midnight to the next Fajr', () => {
    const nextFajr = cairo(5, 16, 0, 16);
    expect(nextWindowStart(times, cairo(23, 0), nextFajr)).toEqual({ key: 'fajr', time: nextFajr });
    expect(timeLeftInWindow(times, cairo(23, 0), nextFajr)).toBe((6 * 60 + 16) * MIN);
    // Without nextFajr, today's Fajr + 24h.
    expect(timeLeftInWindow(times, cairo(23, 0))).toBe((6 * 60 + 15) * MIN);
  });
});

describe('dialGeometry', () => {
  it('bundles dots, arcs, now marker, window and countdown', () => {
    const g = dialGeometry(times, cairo(15, 30), { timeZone: TZ });
    expect(g.current).toBe('asr');
    expect(g.nowAngle).toBeCloseTo(232.5);
    expect(g.next.key).toBe('maghrib');
    expect(g.msLeft).toBe(110 * MIN);
    expect(g.arcs).toHaveLength(6);
    expect(g.dots.isha).toBe(280);
  });

  it('works with real prayer times for Cairo', () => {
    const now = cairo(13, 0);
    const real = getPrayerTimes(now, { lat: 30.0444, lng: 31.2357, timeZone: TZ });
    const g = dialGeometry(real, now, { timeZone: TZ });
    expect(g.current).toBe('dhuhr');
    expect(g.dots.fajr).toBeGreaterThan(60);
    expect(g.dots.fajr).toBeLessThan(90);
    expect(g.dots.dhuhr).toBeGreaterThan(170);
    expect(g.dots.dhuhr).toBeLessThan(190);
  });
});
