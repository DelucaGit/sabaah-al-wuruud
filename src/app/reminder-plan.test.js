import { describe, expect, it } from 'vitest';
import { defaultState } from '../core/state.js';
import { markDone, setCounter } from '../core/daily.js';
import { DAYS_AHEAD, planReminders, scheduleKey, tapPath } from './reminder-plan.js';

// Fake prayer times: Fajr 05:00 and Asr 15:00 device-local on the given day.
const getTimes = (date) => ({
  fajr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 5),
  asr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 15),
});

const NOW = new Date(2026, 0, 10, 4, 0); // before every reminder of the day

describe('planReminders', () => {
  it('schedules three reminders a day for DAYS_AHEAD days', () => {
    const list = planReminders(defaultState(), NOW, { getTimes });
    expect(list).toHaveLength(DAYS_AHEAD * 3);
    expect(list.slice(0, 3).map((n) => [n.section, n.at.getHours()])).toEqual([
      ['morning', 6], ['evening', 16], ['sleep', 22],
    ]);
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
  });

  it('passes the prayer location to getTimes', () => {
    const seen = [];
    planReminders(defaultState(), NOW, { days: 1, getTimes: (d, loc) => (seen.push(loc), getTimes(d)) });
    expect(seen[0]).toMatchObject({ lat: 30.0444, lng: 31.2357, timeZone: 'Africa/Cairo' });
  });

  it("drops today's reminder for a section that is done, keeps later days", () => {
    const state = defaultState();
    state.daily = markDone(state.daily, 'morning', NOW);
    const list = planReminders(state, NOW, { getTimes });
    const mornings = list.filter((n) => n.section === 'morning');
    expect(mornings).toHaveLength(DAYS_AHEAD - 1);
    expect(mornings[0].at.getDate()).toBe(11);
  });

  it('ignores done flags from an earlier day', () => {
    const state = defaultState();
    state.daily = markDone(state.daily, 'morning', new Date(2026, 0, 9, 8));
    expect(planReminders(state, NOW, { getTimes })).toHaveLength(DAYS_AHEAD * 3);
  });

  it('follows the offset and the enabled switch', () => {
    const state = defaultState();
    state.settings.reminders.morning.offsetMin = 30;
    state.settings.reminders.evening.enabled = false;
    const list = planReminders(state, NOW, { days: 1, getTimes });
    expect(list.map((n) => n.section)).toEqual(['morning', 'sleep']);
    expect([list[0].at.getHours(), list[0].at.getMinutes()]).toEqual([5, 30]);
  });

  it('keeps the sleep reminder when prayer times cannot be calculated', () => {
    const list = planReminders(defaultState(), NOW, {
      days: 2,
      getTimes: () => { throw new Error('no times'); },
    });
    expect(list.map((n) => n.section)).toEqual(['sleep', 'sleep']);
  });

  it('works with the real prayer calculation', () => {
    const list = planReminders(defaultState(), NOW);
    expect(list.length).toBeGreaterThanOrEqual(DAYS_AHEAD * 3 - 3);
    expect(list.every((n) => n.at > NOW)).toBe(true);
  });
});

describe('scheduleKey', () => {
  it('is stable for counter taps, pins and appearance', () => {
    const a = defaultState();
    const b = defaultState();
    b.daily = setCounter(b.daily, 'some-dhikr', 57, NOW);
    b.pins.morning = ['x'];
    b.settings.theme = 'dark';
    b.settings.name = 'A';
    expect(scheduleKey(b, NOW)).toBe(scheduleKey(a, NOW));
  });

  it('changes when a section is marked done', () => {
    const a = defaultState();
    const b = defaultState();
    b.daily = markDone(b.daily, 'evening', NOW);
    expect(scheduleKey(b, NOW)).not.toBe(scheduleKey(a, NOW));
  });

  it('changes with reminder settings and location', () => {
    const base = scheduleKey(defaultState(), NOW);
    const edits = [
      (s) => { s.settings.reminders.morning.offsetMin = 45; },
      (s) => { s.settings.reminders.evening.prayer = 'maghrib'; },
      (s) => { s.settings.reminders.sleep.time = '23:00'; },
      (s) => { s.settings.reminders.sleep.enabled = false; },
      (s) => { s.settings.location = { name: 'Stockholm', lat: 59.33, lng: 18.07 }; },
    ];
    for (const edit of edits) {
      const s = defaultState();
      edit(s);
      expect(scheduleKey(s, NOW)).not.toBe(base);
    }
  });

  it('changes when the local day changes', () => {
    const s = defaultState();
    expect(scheduleKey(s, new Date(2026, 0, 11, 4))).not.toBe(scheduleKey(s, NOW));
  });
});

describe('tapPath', () => {
  it('maps a section to its reader route', () => {
    expect(tapPath('morning')).toBe('/adhkar/morning');
    expect(tapPath('evening')).toBe('/adhkar/evening');
    expect(tapPath('sleep')).toBe('/adhkar/sleep');
  });

  it('returns null for anything else', () => {
    expect(tapPath(null)).toBeNull();
    expect(tapPath('settings')).toBeNull();
    expect(tapPath(undefined)).toBeNull();
  });
});
