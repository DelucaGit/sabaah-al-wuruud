import { describe, it, expect } from 'vitest';
import { GAP_MIN, dayNumber, encouragementTimes, fillName, pickMessages } from './encouragement.js';
import { buildSchedule, encouragementId, reminderId } from './reminders.js';
import { defaultState, migrate } from './state.js';

const MIN = 60 * 1000;
const at = (h, m = 0, d = 10) => new Date(2026, 0, d, h, m);
const DAY = at(12);
// Fake prayer times inside the window: Dhuhr 12:00, Asr 15:00, Maghrib 17:00, Isha 18:30.
const prayers = (d = 10) => [at(5, 0, d), at(12, 0, d), at(15, 0, d), at(17, 0, d), at(18, 30, d)];

const minutes = (date) => date.getHours() * 60 + date.getMinutes();

const pool = (prefix, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, text: `${prefix} ${i}` }));
const MESSAGES = { general: pool('g', 35), goalDone: pool('d', 33), goalPending: pool('p', 32) };

describe('encouragementTimes', () => {
  it('returns N times for N from 1 to 5, inside 09:00-20:30, sorted, whole minutes', () => {
    for (let n = 1; n <= 5; n++) {
      const times = encouragementTimes({ day: DAY, perDay: n, avoid: prayers() });
      expect(times).toHaveLength(n);
      for (const t of times) {
        expect(minutes(t)).toBeGreaterThanOrEqual(9 * 60);
        expect(minutes(t)).toBeLessThanOrEqual(20 * 60 + 30);
        expect(t.getSeconds()).toBe(0);
      }
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    }
  });

  it(`keeps at least ${GAP_MIN} minutes from every prayer and other reminder`, () => {
    const avoid = [...prayers(), at(10, 0), at(13, 40)];
    for (let d = 1; d <= 28; d++) {
      const day = new Date(2026, 1, d, 12);
      const shifted = avoid.map((t) => new Date(2026, 1, d, t.getHours(), t.getMinutes()));
      for (let n = 1; n <= 5; n++) {
        for (const t of encouragementTimes({ day, perDay: n, avoid: shifted })) {
          for (const p of shifted) expect(Math.abs(t - p)).toBeGreaterThanOrEqual(GAP_MIN * MIN);
        }
      }
    }
  });

  it('copes with prayer times that have seconds', () => {
    const avoid = [new Date(2026, 0, 10, 12, 0, 40)];
    for (let n = 1; n <= 5; n++) {
      for (const t of encouragementTimes({ day: DAY, perDay: n, avoid })) {
        expect(Math.abs(t - avoid[0])).toBeGreaterThanOrEqual(GAP_MIN * MIN);
      }
    }
  });

  it('spreads the times over the day', () => {
    const times = encouragementTimes({ day: DAY, perDay: 3, avoid: [] });
    expect(minutes(times[0])).toBeLessThan(13 * 60);
    expect(minutes(times[2])).toBeGreaterThan(16 * 60);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(60 * MIN);
  });

  it('is deterministic per day and varies between days', () => {
    const a = encouragementTimes({ day: at(12), perDay: 3, avoid: prayers() });
    const b = encouragementTimes({ day: at(8), perDay: 3, avoid: prayers() });
    expect(b).toEqual(a);
    const daily = new Set();
    for (let d = 1; d <= 7; d++) {
      daily.add(encouragementTimes({ day: at(12, 0, d), perDay: 3, avoid: prayers(d) }).map(minutes).join());
    }
    expect(daily.size).toBeGreaterThan(1);
  });

  it('returns nothing when the whole window is blocked, defaults bad perDay to 3', () => {
    const avoid = [];
    for (let m = 8 * 60; m <= 21 * 60; m += 30) avoid.push(at(0, m));
    expect(encouragementTimes({ day: DAY, perDay: 3, avoid })).toEqual([]);
    expect(encouragementTimes({ day: DAY, perDay: 'x', avoid: [] })).toHaveLength(3);
    expect(encouragementTimes({ day: DAY, perDay: 9, avoid: [] })).toHaveLength(5);
  });

  it('uses the prayer location zone when given', () => {
    // Device zone is whatever the test runner has; check in Tokyo time.
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    for (const t of encouragementTimes({ day: DAY, perDay: 5, avoid: [], timeZone: 'Asia/Tokyo' })) {
      const s = fmt.format(t);
      expect(s >= '09:00' && s <= '20:30').toBe(true);
    }
  });
});

describe('pickMessages', () => {
  const ids = (list) => list.map((m) => m.id[0]);

  it('uses only general messages without goals', () => {
    expect(ids(pickMessages({ day: DAY, count: 3, messages: MESSAGES }))).toEqual(['g', 'g', 'g']);
  });

  it('uses goalPending for the later half while goals are open', () => {
    const goals = { hasGoals: true, anyDone: false };
    expect(ids(pickMessages({ day: DAY, count: 3, messages: MESSAGES, goals }))).toEqual(['g', 'p', 'p']);
    expect(ids(pickMessages({ day: DAY, count: 1, messages: MESSAGES, goals }))).toEqual(['p']);
    expect(ids(pickMessages({ day: DAY, count: 4, messages: MESSAGES, goals }))).toEqual(['g', 'g', 'p', 'p']);
  });

  it('uses goalDone once a goal is done today', () => {
    const goals = { hasGoals: true, anyDone: true };
    expect(ids(pickMessages({ day: DAY, count: 5, messages: MESSAGES, goals }))).toEqual(['g', 'g', 'd', 'd', 'd']);
  });

  it('is deterministic and repeats no message within six days', () => {
    const goals = { hasGoals: true, anyDone: false };
    expect(pickMessages({ day: at(9), count: 5, messages: MESSAGES, goals }))
      .toEqual(pickMessages({ day: at(20), count: 5, messages: MESSAGES, goals }));
    for (const state of [{}, goals, { hasGoals: true, anyDone: true }]) {
      for (let start = 1; start <= 20; start++) {
        const seen = [];
        for (let d = start; d < start + 6; d++) {
          seen.push(...pickMessages({ day: at(12, 0, d), count: 5, messages: MESSAGES, goals: state }).map((m) => m.id));
        }
        expect(new Set(seen).size).toBe(seen.length);
      }
    }
  });

  it('falls back to general when a goal pool is empty', () => {
    const msgs = { ...MESSAGES, goalPending: [] };
    expect(ids(pickMessages({ day: DAY, count: 2, messages: msgs, goals: { hasGoals: true } }))).toEqual(['g', 'g']);
  });

  it('dayNumber counts local days', () => {
    expect(dayNumber(at(23, 59, 11)) - dayNumber(at(0, 0, 10))).toBe(1);
  });
});

describe('fillName', () => {
  it('fills in the name', () => {
    expect(fillName('{name}, även små steg räknas.', 'Aisha')).toBe('Aisha, även små steg räknas.');
    expect(fillName('Du gör det bättre än du tror, {name}.', ' Aisha ')).toBe('Du gör det bättre än du tror, Aisha.');
  });

  it('drops the placeholder cleanly without a name', () => {
    expect(fillName('{name}, även små steg räknas.', '')).toBe('Även små steg räknas.');
    expect(fillName('Du gör det bättre än du tror, {name}.', undefined)).toBe('Du gör det bättre än du tror.');
    expect(fillName('Vad fint, {name}. Ännu ett mål i hamn.', '  ')).toBe('Vad fint. Ännu ett mål i hamn.');
    expect(fillName('Ett steg i taget räcker gott.', '')).toBe('Ett steg i taget räcker gott.');
  });
});

describe('buildSchedule with encouragement', () => {
  const getTimes = (d) => ({
    fajr: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 5),
    dhuhr: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12),
    asr: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 15),
    maghrib: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17),
    isha: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 19),
  });
  const encouragement = { messages: MESSAGES, name: 'Aisha' };
  const NOW = at(4);
  const enc = (list) => list.filter((n) => n.section === 'encouragement');

  it('is skipped without messages (core callers opt in)', () => {
    expect(enc(buildSchedule({ now: NOW, settings: defaultState().settings, daily: {}, days: 1, getTimes }))).toEqual([]);
  });

  it('adds perDay entries with distinct ids away from prayers and other reminders', () => {
    const settings = defaultState().settings;
    settings.reminders.encouragement.perDay = 5;
    const list = buildSchedule({ now: NOW, settings, daily: {}, days: 3, getTimes, encouragement, goals: { hasGoals: true } });
    const e = enc(list);
    expect(e).toHaveLength(15);
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
    expect(e[0].id).toBe(encouragementId(at(12), 0));
    expect(e[0].id).not.toBe(reminderId(at(12), 'morning'));
    expect(e[0].id).toBeLessThan(2 ** 31);
    const others = list.filter((n) => n.section !== 'encouragement').map((n) => n.at);
    for (const n of e) {
      for (const t of [...others, ...Object.values(getTimes(n.at))]) {
        expect(Math.abs(n.at - t)).toBeGreaterThanOrEqual(GAP_MIN * MIN);
      }
    }
  });

  it('switches today to goalDone messages once a goal is done, later days stay pending', () => {
    const settings = defaultState().settings;
    const list = enc(buildSchedule({
      now: NOW, settings, daily: {}, days: 2, getTimes, encouragement,
      goals: { hasGoals: true, doneToday: { hifdh: true } },
    }));
    const today = list.filter((n) => n.at.getDate() === 10).map((n) => n.body[0]);
    const tomorrow = list.filter((n) => n.at.getDate() === 11).map((n) => n.body[0]);
    expect(today).toEqual(['g', 'd', 'd']);
    expect(tomorrow).toEqual(['g', 'p', 'p']);
  });

  it("keeps today's times stable while the day goes on and drops past ones", () => {
    const settings = defaultState().settings;
    const early = enc(buildSchedule({ now: NOW, settings, daily: {}, days: 1, getTimes, encouragement }));
    const later = enc(buildSchedule({ now: new Date(early[0].at.getTime() + MIN), settings, daily: {}, days: 1, getTimes, encouragement }));
    expect(later).toEqual(early.slice(1));
  });
});

describe('encouragement settings migration', () => {
  it('defaults to on, three a day', () => {
    expect(defaultState().settings.reminders.encouragement).toEqual({ enabled: true, perDay: 3 });
    expect(migrate({ settings: { reminders: { sleep: { enabled: false } } } }).settings.reminders.encouragement)
      .toEqual({ enabled: true, perDay: 3 });
  });

  it('keeps valid values and repairs invalid ones', () => {
    const keep = migrate({ settings: { reminders: { encouragement: { enabled: false, perDay: 5 } } } });
    expect(keep.settings.reminders.encouragement).toEqual({ enabled: false, perDay: 5 });
    for (const perDay of [0, 6, 2.5, '3', null]) {
      const s = migrate({ settings: { reminders: { encouragement: { enabled: 'yes', perDay } } } });
      expect(s.settings.reminders.encouragement).toEqual({ enabled: true, perDay: 3 });
    }
  });
});
