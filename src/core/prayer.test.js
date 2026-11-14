import { afterEach, describe, expect, it } from 'vitest';
import { getLastThirdOfNight, getMiddleOfNight, getNightTimes, getPrayerTimes, highlightedSection, nextPrayer } from './prayer.js';

const CAIRO = { name: 'Cairo', lat: 30.0444, lng: 31.2357 };
const CAIRO_TZ = { ...CAIRO, timeZone: 'Africa/Cairo' };

// Wall-clock "YYYY-MM-DD HH:MM" in Cairo for an instant (DST handled by Intl).
function cairoClock(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function minutesOf(clock) {
  const [h, m] = clock.slice(11).split(':').map(Number);
  return h * 60 + m;
}

// Reference timetable: AlAdhan prayer-times service, method 5 "Egyptian General
// Authority of Survey" (Fajr 19.5°, Isha 17.5°), city=Cairo, country=Egypt,
// local Cairo time. Fetched 2026-11-12 from
//   https://api.aladhan.com/v1/timingsByCity/15-07-2026?city=Cairo&country=Egypt&method=5
//   https://api.aladhan.com/v1/timingsByCity/15-01-2026?city=Cairo&country=Egypt&method=5
// 15 July 2026 falls in Egyptian summer time (UTC+3), 15 January in UTC+2.
const REFERENCE = [
  { label: 'summer', date: '2026-07-15', fajr: '04:21', asr: '16:38', isha: '21:29' },
  { label: 'winter', date: '2026-01-15', fajr: '05:21', asr: '14:57', isha: '18:39' },
];

describe('getPrayerTimes', () => {
  for (const ref of REFERENCE) {
    describe(`Cairo ${ref.label} (${ref.date})`, () => {
      // Midday in Cairo on the reference day.
      const midday = new Date(`${ref.date}T10:00:00Z`);

      for (const location of [CAIRO, CAIRO_TZ]) {
        const times = getPrayerTimes(midday, location);
        const tzLabel = location.timeZone ? 'with timeZone' : 'without timeZone';

        for (const key of ['fajr', 'asr', 'isha']) {
          it(`${key} matches the published timetable within 2 minutes (${tzLabel})`, () => {
            const clock = cairoClock(times[key]);
            expect(clock.slice(0, 10)).toBe(ref.date);
            const diff = minutesOf(clock) - minutesOf(`${ref.date} ${ref[key]}`);
            expect(Math.abs(diff)).toBeLessThanOrEqual(2);
          });
        }
      }

      it('returns all six times as Dates in chronological order', () => {
        const t = getPrayerTimes(midday, CAIRO);
        const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
        for (const key of order) expect(t[key]).toBeInstanceOf(Date);
        for (let i = 1; i < order.length; i++) {
          expect(t[order[i]].getTime()).toBeGreaterThan(t[order[i - 1]].getTime());
        }
      });
    });
  }

  describe('independent of the machine time zone', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    for (const tz of ['Europe/Stockholm', 'America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
      it(`gives the same instants when the machine is in ${tz}`, () => {
        const midday = new Date('2026-07-15T10:00:00Z');
        process.env.TZ = 'Africa/Cairo';
        const reference = getPrayerTimes(midday, CAIRO_TZ);
        process.env.TZ = tz;
        expect(getPrayerTimes(midday, CAIRO_TZ)).toEqual(reference);
        expect(getPrayerTimes(midday, CAIRO)).toEqual(reference);
      });
    }
  });

  it('uses the Cairo calendar day, even when another zone is on a different date', () => {
    // 23:30 UTC on 14 July is 02:30 on 15 July in Cairo.
    const lateUtc = new Date('2026-07-14T23:30:00Z');
    const times = getPrayerTimes(lateUtc, CAIRO_TZ);
    expect(cairoClock(times.fajr).slice(0, 10)).toBe('2026-07-15');
  });
});

describe('highlightedSection', () => {
  const times = getPrayerTimes(new Date('2026-01-15T10:00:00Z'), CAIRO);
  const at = (date, deltaMs) => new Date(date.getTime() + deltaMs);

  it('is null just before Fajr', () => {
    expect(highlightedSection(at(times.fajr, -1), times)).toBeNull();
  });
  it('is morning exactly at Fajr', () => {
    expect(highlightedSection(times.fajr, times)).toBe('morning');
  });
  it('is morning just before Asr', () => {
    expect(highlightedSection(at(times.asr, -1), times)).toBe('morning');
  });
  it('is evening exactly at Asr', () => {
    expect(highlightedSection(times.asr, times)).toBe('evening');
  });
  it('is evening just before Isha', () => {
    expect(highlightedSection(at(times.isha, -1), times)).toBe('evening');
  });
  it('is null exactly at Isha and later', () => {
    expect(highlightedSection(times.isha, times)).toBeNull();
    expect(highlightedSection(at(times.isha, 60 * 60 * 1000), times)).toBeNull();
  });
});

describe('nextPrayer', () => {
  for (const location of [CAIRO, CAIRO_TZ]) {
    const tzLabel = location.timeZone ? 'with timeZone' : 'without timeZone';
    const today = getPrayerTimes(new Date('2026-07-15T10:00:00Z'), location);
    const tomorrow = getPrayerTimes(new Date('2026-07-16T10:00:00Z'), location);

    it(`returns tomorrow's Fajr right after Isha (${tzLabel})`, () => {
      const now = new Date(today.isha.getTime() + 1000);
      expect(nextPrayer(now, location)).toEqual({ name: 'fajr', time: tomorrow.fajr });
    });

    it(`returns tomorrow's Fajr shortly after Cairo midnight (${tzLabel})`, () => {
      // 00:30 on 16 July in Cairo (UTC+3).
      const now = new Date('2026-07-15T21:30:00Z');
      expect(nextPrayer(now, location)).toEqual({ name: 'fajr', time: tomorrow.fajr });
    });

    it(`returns Isha just before Isha (${tzLabel})`, () => {
      const now = new Date(today.isha.getTime() - 1000);
      expect(nextPrayer(now, location)).toEqual({ name: 'isha', time: today.isha });
    });

    it(`skips sunrise: after Fajr the next prayer is Dhuhr (${tzLabel})`, () => {
      const now = new Date(today.fajr.getTime() + 1000);
      expect(nextPrayer(now, location)).toEqual({ name: 'dhuhr', time: today.dhuhr });
    });

    it(`at exactly Asr the next prayer is Maghrib (${tzLabel})`, () => {
      expect(nextPrayer(today.asr, location)).toEqual({ name: 'maghrib', time: today.maghrib });
    });
  }
});

describe('night times', () => {
  const check = (iso) => {
    const d = new Date(iso);
    const n = getNightTimes(d, CAIRO_TZ);
    const tomorrow = getPrayerTimes(new Date(d.getTime() + 24 * 3600 * 1000), CAIRO_TZ);
    expect(n.maghrib.getTime()).toBe(getPrayerTimes(d, CAIRO_TZ).maghrib.getTime());
    expect(n.fajr.getTime()).toBe(tomorrow.fajr.getTime());
    expect(n.lengthMs).toBeGreaterThan(8 * 3600 * 1000);
    expect(n.lengthMs).toBeLessThan(15 * 3600 * 1000);
    expect(Math.abs(n.middle.getTime() - n.maghrib.getTime() - n.lengthMs / 2)).toBeLessThan(2);
    expect(Math.abs(n.fajr.getTime() - n.lastThirdStart.getTime() - n.lengthMs / 3)).toBeLessThan(2);
    expect(n.middle.getTime()).toBeLessThan(n.lastThirdStart.getTime());
    expect(getMiddleOfNight(d, CAIRO_TZ).getTime()).toBe(n.middle.getTime());
    expect(getLastThirdOfNight(d, CAIRO_TZ).getTime()).toBe(n.lastThirdStart.getTime());
    return n;
  };

  it('normal day: winter night is 8-15h, middle shortly after midnight Cairo', () => {
    const n = check('2026-01-15T10:00:00Z');
    expect(cairoClock(n.maghrib).slice(0, 10)).toBe('2026-01-15');
    expect(cairoClock(n.fajr).slice(0, 10)).toBe('2026-01-16');
    const mid = minutesOf(cairoClock(n.middle));
    expect(mid).toBeGreaterThan(22 * 60);
    expect(mid).toBeLessThan(24 * 60);
  });

  it('rolls over a month end (31 Jan -> 1 Feb)', () => {
    const n = check('2026-01-31T10:00:00Z');
    expect(cairoClock(n.maghrib).slice(0, 10)).toBe('2026-01-31');
    expect(cairoClock(n.fajr).slice(0, 10)).toBe('2026-02-01');
  });

  it('rolls over a year end (31 Dec -> 1 Jan)', () => {
    const n = check('2026-12-31T10:00:00Z');
    expect(cairoClock(n.fajr).slice(0, 10)).toBe('2027-01-01');
  });
});
