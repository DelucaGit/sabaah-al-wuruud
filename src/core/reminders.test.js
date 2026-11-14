import { describe, it, expect } from 'vitest';
import { buildSchedule } from './reminders.js';
import { markDone } from './daily.js';
import { GOAL_REMINDERS, defaultState } from './state.js';

// Fixture prayer times: Fajr 04:30, Asr 15:00, Isha 19:30 (device-local) every day.
const getTimes = (date) => ({
  fajr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 4, 30),
  asr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 15, 0),
  isha: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 19, 30),
});

// The adhkar tests below run with the Quran goal reminders off; those have
// their own block at the end.
const settings = () => {
  const s = structuredClone(defaultState().settings);
  for (const g of GOAL_REMINDERS) s.reminders[g].enabled = false;
  return s;
};

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

describe('buildSchedule: Quran goal reminders', () => {
  // Only the goal reminders on, with a checklist that has items.
  const goalSettings = () => {
    const s = structuredClone(defaultState().settings);
    for (const k of ['morning', 'evening', 'sleep']) s.reminders[k].enabled = false;
    return s;
  };
  const buildGoals = (overrides = {}) =>
    build({ settings: goalSettings(), goals: { hasChecklist: true }, ...overrides });

  it('defaults to 30 min after Fajr, Asr and Isha', () => {
    const s = buildGoals({ days: 1 });
    expect(s.map((r) => [r.section, r.at.getTime()])).toEqual([
      ['hifdh', local(2026, 3, 10, 5, 0)],
      ['murajaa', local(2026, 3, 10, 15, 30)],
      ['checklist', local(2026, 3, 10, 20, 0)],
    ]);
  });

  it('prayer mode follows the chosen prayer and offset', () => {
    const st = goalSettings();
    st.reminders.murajaa = { ...st.reminders.murajaa, prayer: 'isha', offsetMin: 90 };
    const s = buildGoals({ settings: st, days: 1 });
    expect(s.find((r) => r.section === 'murajaa').at.getTime()).toBe(local(2026, 3, 10, 21, 0));
  });

  it('time mode uses the fixed local time and ignores prayer times', () => {
    const st = goalSettings();
    st.reminders.hifdh = { ...st.reminders.hifdh, mode: 'time', time: '07:15' };
    const s = buildGoals({ settings: st, days: 2, getTimes: () => ({}) });
    expect(s.map((r) => [r.section, r.at.getTime()])).toEqual([
      ['hifdh', local(2026, 3, 10, 7, 15)],
      ['hifdh', local(2026, 3, 11, 7, 15)],
    ]);
  });

  it('each one has its own on/off switch', () => {
    const st = goalSettings();
    st.reminders.murajaa.enabled = false;
    expect(buildGoals({ settings: st, days: 1 }).map((r) => r.section)).toEqual(['hifdh', 'checklist']);
  });

  it("skips today's entry for a goal already done today, keeps later days", () => {
    const s = buildGoals({ goals: { hasChecklist: true, doneToday: { hifdh: true, checklist: true } } });
    const today = s.filter((r) => r.at.getDate() === 10).map((r) => r.section);
    expect(today).toEqual(['murajaa']);
    expect(s.filter((r) => r.section === 'hifdh')).toHaveLength(6);
    expect(s.filter((r) => r.section === 'checklist')).toHaveLength(6);
  });

  it('has no checklist reminder while the checklist is empty', () => {
    const s = buildGoals({ goals: {}, days: 1 });
    expect(s.map((r) => r.section)).toEqual(['hifdh', 'murajaa']);
  });

  it('uses gentle titles, distinct ids and stays sorted with the adhkar reminders', () => {
    const s = build({ settings: structuredClone(defaultState().settings), goals: { hasChecklist: true } });
    expect(s).toHaveLength(7 * 6);
    const ats = s.map((r) => r.at.getTime());
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    expect(new Set(s.map((r) => r.id)).size).toBe(s.length);
    expect(s.filter((r) => r.at.getDate() === 10 && r.section === 'checklist')[0].id).toBe(202603107);
    const goal = s.filter((r) => GOAL_REMINDERS.includes(r.section));
    for (const r of goal) {
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
    }
  });
});
