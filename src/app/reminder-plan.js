// Pure helpers for reminder sync: what to schedule, when a state change
// matters, and where a notification tap leads. No DOM, no plugins.
import { buildSchedule } from '../core/reminders.js';
import { dayKey, ensureToday } from '../core/daily.js';
import { getNightTimes, getPrayerTimes } from '../core/prayer.js';
import { isChecklistDone, isHifdhDone, isMurajaaDone } from '../core/goals.js';
import { GOAL_REMINDERS, SECTIONS, update } from '../core/state.js';
import { prayerLocation } from '../ui/prayer-view.js';
import ENCOURAGEMENT from '../data/reminders/encouragement.json';

/** How many local days ahead reminders are scheduled. */
export const DAYS_AHEAD = 7;

/**
 * Today's Quran goal status for the reminder schedule. The checklist counts as
 * done once every item is ticked; with no items there is nothing to remind.
 * @param {object} state
 * @param {Date} now
 * @returns {{doneToday: {hifdh: boolean, murajaa: boolean, checklist: boolean}, hasChecklist: boolean}}
 */
export function goalStatus(state, now) {
  const { items, hifdhTarget, murajaaTarget } = update(state, () => {}).goals;
  return {
    hasGoals: hifdhTarget > 0 || murajaaTarget > 0 || items.length > 0,
    doneToday: {
      hifdh: isHifdhDone(state, now),
      murajaa: isMurajaaDone(state, now),
      checklist: items.length > 0 && items.every((i) => isChecklistDone(state, i.id, now)),
    },
    hasChecklist: items.length > 0,
  };
}

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
    goals: goalStatus(state, now),
    encouragement: { messages: ENCOURAGEMENT, name: settings.name, timeZone: location.timeZone },
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
    GOAL_REMINDERS.map((g) => {
      const r = reminders?.[g] ?? {};
      return [r.enabled, r.mode, r.prayer, r.offsetMin, r.time];
    }),
    goalStatus(state, now),
    [location?.lat, location?.lng],
    [reminders?.encouragement?.enabled, reminders?.encouragement?.perDay],
    // The name is in the encouragement texts.
    reminders?.encouragement?.enabled ? state.settings.name : null,
  ]);
}

/**
 * Router path for a tapped notification's section, or null if unknown.
 * @param {unknown} section
 * @returns {string | null}
 */
export function tapPath(section) {
  if (section === 'lastThird' || section === 'encouragement') return '/';
  if (GOAL_REMINDERS.includes(section)) return '/quran';
  return SECTIONS.includes(section) ? `/adhkar/${section}` : null;
}
