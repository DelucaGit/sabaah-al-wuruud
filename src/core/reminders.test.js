import { describe, it, expect } from 'vitest';
import { buildSchedule } from './reminders.js';
import { markDone } from './daily.js';
import { defaultState } from './state.js';

// Fixture prayer times: Fajr 04:30, Asr 15:00 (device-local) every day.
const getTimes = (date) => ({
  fajr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 4, 30),
  asr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 15, 0),
});

const settings = () => structuredClone(defaultState().settings);

// 2026-03-10 at 01:00 local: before every reminder of the day.
const earlyNow = new Date(2026, 2, 10, 1, 0);

const build = (overrides = {}) =>
  buildSchedule({ now: earlyNow, settings: settings(), daily: null, getTimes, ...overrides });

const local = (y, m, d, h, min) => new Date(y, m - 1, d, h, min).getTime();

describe('buildSchedule', () => {
  it('returns 7 days x 3 reminders, sorted by time', () => {
    const s = build();
    expect(s).toHaveLength(21);
    const ats = s.map((r) => r.at.getTime());
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    expect(s.slice(0, 3).map((r) => r.section)).toEqual(['morning', 'evening', 'sleep']);
  });

  it('applies offsets: Fajr+60, Asr+60, sleep at 22:00 local', () => {
    const [morning, evening, sleep] = build();
    expect(morning.at.getTime()).toBe(local(2026, 3, 10, 5, 30));
    expect(evening.at.getTime()).toBe(local(2026, 3, 10, 16, 0));
    expect(sleep.at.getTime()).toBe(local(2026, 3, 10, 22, 0));
  });

  it('honours custom offsets and sleep time', () => {
    const st = settings();
    st.reminders.morning.offsetMin = 15;
    st.reminders.evening.offsetMin = 0;
    st.reminders.sleep.time = '21:45';
    const [morning, evening, sleep] = build({ settings: st });
    expect(morning.at.getTime()).toBe(local(2026, 3, 10, 4, 45));
    expect(evening.at.getTime()).toBe(local(2026, 3, 10, 15, 0));
    expect(sleep.at.getTime()).toBe(local(2026, 3, 10, 21, 45));
  });

  it('uses the exact texts', () => {
    for (const r of build()) {
      expect(r.title).toBe('Nuh');
      expect(r.body).toBe(
        r.section === 'sleep' ? 'Shawshat qurban. Glöm inte adhkaar' : 'Har du läst dina adhkaar?',
      );
    }
  });

  it('gives stable ids yyyymmdd*10 + section index', () => {
    const s = build();
    expect(s.slice(0, 3).map((r) => r.id)).toEqual([202603101, 202603102, 202603103]);
    expect(s.at(-1).id).toBe(202603163);
    expect(new Set(s.map((r) => r.id)).size).toBe(21);
    expect(build().map((r) => r.id)).toEqual(s.map((r) => r.id));
  });

  it('ids roll over months correctly', () => {
    const s = build({ now: new Date(2026, 0, 30, 1, 0) });
    expect(s.map((r) => r.id)).toContain(202602053);
  });

  it("done today removes only today's entry for that section", () => {
    const daily = markDone(null, 'morning', earlyNow);
    const s = build({ daily });
    expect(s).toHaveLength(20);
    expect(s.find((r) => r.id === 202603101)).toBeUndefined();
    expect(s.find((r) => r.id === 202603111)).toBeDefined();
    expect(s.find((r) => r.id === 202603102)).toBeDefined();
  });

  it("done state from another day does not remove today's entries", () => {
    const daily = markDone(null, 'morning', new Date(2026, 2, 9, 8, 0));
    expect(build({ daily })).toHaveLength(21);
  });

  it('leaves out disabled reminders', () => {
    const st = settings();
    st.reminders.evening.enabled = false;
    const s = build({ settings: st });
    expect(s).toHaveLength(14);
    expect(s.some((r) => r.section === 'evening')).toBe(false);
  });

  it('leaves out times at or before now', () => {
    const s = build({ now: new Date(2026, 2, 10, 16, 0) }); // exactly Asr+60
    expect(s).toHaveLength(19);
    expect(s[0].id).toBe(202603103);
    expect(s.every((r) => r.at.getTime() > local(2026, 3, 10, 16, 0))).toBe(true);
  });

  it('respects a custom number of days', () => {
    expect(build({ days: 2 })).toHaveLength(6);
  });
});
