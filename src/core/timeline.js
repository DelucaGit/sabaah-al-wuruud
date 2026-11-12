// The day as one ordered list for the Adhkar tab: the prayer times with the
// morning, evening and sleep adhkar placed where they belong, plus a "now"
// marker. Pure: callers pass `now` and the day's prayer times.
import { PRAYER_KEYS, highlightedSection } from './prayer.js';

// Each adhkar section sits right after the prayer that opens its window.
const SECTION_AFTER = { fajr: 'morning', asr: 'evening' };

/**
 * The section to bring forward right now: morning in [fajr, asr), evening in
 * [asr, isha), and the sleep adhkar for the rest of the night.
 * @returns {'morning'|'evening'|'sleep'}
 */
export function activeSection(now, times) {
  return highlightedSection(now, times) ?? 'sleep';
}

/**
 * @param {Date} now
 * @param {Record<string, Date>} times  from `getPrayerTimes`
 * @returns {Array<
 *   { type: 'prayer', key: string, time: Date, past: boolean, next: boolean } |
 *   { type: 'section', key: 'morning'|'evening'|'sleep', active: boolean } |
 *   { type: 'now' }>}
 *   Prayers in order; the now marker sits before the first prayer still to
 *   come (after Isha once the day's prayers have passed); sleep is last.
 */
export function dayTimeline(now, times) {
  const t = now.getTime();
  const active = activeSection(now, times);
  const items = [];
  let nowPlaced = false;
  for (const key of PRAYER_KEYS) {
    const past = times[key].getTime() <= t;
    const next = !past && !nowPlaced;
    if (next) {
      items.push({ type: 'now' });
      nowPlaced = true;
    }
    items.push({ type: 'prayer', key, time: times[key], past, next });
    const section = SECTION_AFTER[key];
    if (section) items.push({ type: 'section', key: section, active: active === section });
  }
  if (!nowPlaced) items.push({ type: 'now' });
  items.push({ type: 'section', key: 'sleep', active: active === 'sleep' });
  return items;
}
