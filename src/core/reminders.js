// Reminder schedule (pure). Turns settings, prayer times and today's done
// state into the exact list of notifications to schedule.
//
// Days are device-local calendar days, starting with the day containing `now`.
// The sleep reminder's `time` ('HH:MM') is device-local wall-clock time.
// Prayer times come from the injected `getTimes(date)`; in production that is
// `(date) => getPrayerTimes(date, settings.location)` from ./prayer.js.

import { isDone } from './daily.js';

const MS_PER_MINUTE = 60 * 1000;

const TITLE = 'Nuh';
const PRAYER_BODY = 'Har du läst dina adhkaar?';
const LAST_THIRD_TITLE = 'Sista tredjedelen';
const LAST_THIRD_BODY = 'Natten är stilla. En lugn stund för tahajjud och dua.';
const SLEEP_BODY = 'Shawshat qurban. Glöm inte adhkaar';

// Quran goal reminders: gentle nudges, never guilt.
const GOAL_TEXT = {
  hifdh: { title: 'Hifdh', body: 'En stund med dagens sida, när det passar dig.' },
  murajaa: { title: 'Muraja\'a', body: 'Dags för en lugn repetition av sidorna du bär med dig.' },
  checklist: { title: 'Dagens lista', body: 'Några små steg kvar på din lista i dag, i din egen takt.' },
};
const GOAL_KEYS = Object.keys(GOAL_TEXT);

// Suffix of the deterministic id: yyyymmdd * 10 + SECTION_INDEX[section].
const SECTION_INDEX = { morning: 1, evening: 2, sleep: 3, lastThird: 4, hifdh: 5, murajaa: 6, checklist: 7 };

// Prayer used when a prayer reminder's settings lack one.
const DEFAULT_PRAYER = { morning: 'fajr', evening: 'asr', hifdh: 'fajr', murajaa: 'asr', checklist: 'isha' };

/** Deterministic notification id for `section` on the local day of `date`. */
export function reminderId(date, section) {
  const yyyymmdd = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return yyyymmdd * 10 + SECTION_INDEX[section];
}

// Instant for 'HH:MM' on the local day of `day`, or null if malformed.
function atLocalTime(day, time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? ''));
  if (!m) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(m[1]), Number(m[2]));
}

/**
 * Builds the reminder schedule for `days` local days starting today.
 * Leaves out disabled reminders, times `<= now`, and today's entries for
 * sections already done today. Sorted by `at`.
 *
 * @param {object} args
 * @param {Date} args.now
 * @param {object} args.settings  App settings (uses `settings.reminders`).
 * @param {object} args.daily     Daily state (see ./daily.js).
 * @param {number} [args.days=7]
 * @param {(date: Date) => Record<string, Date>} args.getTimes  Prayer times for the day containing `date`.
 * @param {(date: Date) => {lastThirdStart: Date}} [args.getNight]  Night times after the day containing `date`; needed for the optional last-third reminder.
 * @param {{doneToday?: {hifdh?: boolean, murajaa?: boolean, checklist?: boolean}, hasChecklist?: boolean}} [args.goals]
 *   Quran goals: which are already done today (their today entry is skipped)
 *   and whether the checklist has any items (no items, no checklist reminder).
 * @returns {{id: number, at: Date, title: string, body: string, section: string}[]}
 */
export function buildSchedule({ now, settings, daily, days = 7, getTimes, getNight, goals = {} }) {
  const reminders = settings?.reminders ?? {};
  const nowMs = now.getTime();
  const out = [];

  for (let i = 0; i < days; i++) {
    // Local noon keeps the date unambiguous around DST switches.
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    const isToday = i === 0;
    let times = null;

    // Optional, off by default: the night that starts on this day's Maghrib.
    if (reminders.lastThird?.enabled === true && getNight) {
      const at = getNight(day)?.lastThirdStart;
      if (at && at.getTime() > nowMs) {
        out.push({ id: reminderId(day, 'lastThird'), at, title: LAST_THIRD_TITLE, body: LAST_THIRD_BODY, section: 'lastThird' });
      }
    }

    for (const section of ['morning', 'evening', 'sleep']) {
      const cfg = reminders[section];
      if (!cfg?.enabled) continue;
      if (isToday && isDone(daily, section, now)) continue;

      let at;
      if (section === 'sleep') {
        at = atLocalTime(day, cfg.time);
      } else {
        times ??= getTimes(day);
        const prayerAt = times[cfg.prayer ?? DEFAULT_PRAYER[section]];
        at = prayerAt ? new Date(prayerAt.getTime() + (cfg.offsetMin ?? 0) * MS_PER_MINUTE) : null;
      }
      if (!at || at.getTime() <= nowMs) continue;

      out.push({
        id: reminderId(day, section),
        at,
        title: TITLE,
        body: section === 'sleep' ? SLEEP_BODY : PRAYER_BODY,
        section,
      });
    }

    for (const goal of GOAL_KEYS) {
      const cfg = reminders[goal];
      if (!cfg?.enabled) continue;
      if (goal === 'checklist' && goals.hasChecklist !== true) continue;
      if (isToday && goals.doneToday?.[goal] === true) continue;

      let at;
      if (cfg.mode === 'time') {
        at = atLocalTime(day, cfg.time);
      } else {
        times ??= getTimes(day);
        const prayerAt = times[cfg.prayer ?? DEFAULT_PRAYER[goal]];
        at = prayerAt ? new Date(prayerAt.getTime() + (cfg.offsetMin ?? 0) * MS_PER_MINUTE) : null;
      }
      if (!at || at.getTime() <= nowMs) continue;

      out.push({ id: reminderId(day, goal), at, ...GOAL_TEXT[goal], section: goal });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}
