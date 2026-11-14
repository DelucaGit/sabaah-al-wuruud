// Pure helpers for reminder sync: what to schedule, when a state change
// matters, and where a notification tap leads. No DOM, no plugins.
import { buildSchedule } from '../core/reminders.js';
import { dayKey, ensureToday } from '../core/daily.js';
import { getNightTimes, getPrayerTimes } from '../core/prayer.js';
import { SECTIONS } from '../core/state.js';
import { prayerLocation } from '../ui/prayer-view.js';

/** How many local days ahead reminders are scheduled. */
export const DAYS_AHEAD = 7;

/**
 * The notifications to schedule for `state` at `now`.
 * Days whose prayer times cannot be calculated (extreme latitudes) only lose
 * their prayer-based reminders; the sleep reminder is still scheduled.
 * @param {object} state  App state (see ../core/state.js).
 * @param {Date} now
 * @param {{ days?: number, getTimes?: (date: Date, location: object) => object, getNight?: (date: Date, location: object) => object }} [options]
 * @returns {{id: number, at: Date, title: string, body: string, section: string}[]}
 */
export function planReminders(state, now, { days = DAYS_AHEAD, getTimes = getPrayerTimes, getNight = getNightTimes } = {}) {
  const settings = state.settings;
  const location = prayerLocation(settings);
  return buildSchedule({
    now,
    settings,
    daily: ensureToday(state.daily, now),
    days,
    getTimes: (date) => {
      try {
        return getTimes(date, location) ?? {};
      } catch {
        return {};
      }
    },
    getNight: (date) => {
      try {
        return getNight(date, location) ?? {};
      } catch {
        return {};
      }
    },
  });
}

/**
 * A string that changes exactly when the schedule may change: the reminder
 * settings, the location, today's done sections or the local day. Counter
 * taps, pins, theme and so on leave it untouched.
 * @param {object} state
 * @param {Date} now
 * @returns {string}
 */
export function scheduleKey(state, now) {
  const { reminders, location } = state.settings;
  const today = ensureToday(state.daily, now);
  return JSON.stringify([
    dayKey(now),
    SECTIONS.map((s) => today.done[s] === true),
    SECTIONS.map((s) => {
      const r = reminders?.[s] ?? {};
      return [r.enabled, r.prayer, r.offsetMin, r.time];
    }),
    reminders?.lastThird?.enabled === true,
    [location?.lat, location?.lng],
  ]);
}

/**
 * Router path for a tapped notification's section, or null if unknown.
 * @param {unknown} section
 * @returns {string | null}
 */
export function tapPath(section) {
  if (section === 'lastThird') return '/';
  return SECTIONS.includes(section) ? `/adhkar/${section}` : null;
}
