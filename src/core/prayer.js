// Prayer times (pure). Uses the `adhan` package with the Egyptian General
// Authority of Survey method and the Shafi madhab for Asr.
//
// All returned times are absolute instants (`Date`). Callers format them in
// whatever time zone they want to display.
//
// `location` is `{ lat, lng, name?, timeZone? }`. The calendar day used for a
// given instant is the day *at the location*: in `location.timeZone` (an IANA
// name such as 'Africa/Cairo') when given, otherwise in local mean solar time
// derived from the longitude. Either way the result does not depend on the
// machine's own time zone.

import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

// Prayers that `nextPrayer` can return (sunrise is not a prayer).
const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const MS_PER_HOUR = 60 * 60 * 1000;

function params() {
  const p = CalculationMethod.Egyptian();
  p.madhab = Madhab.Shafi;
  return p;
}

// Calendar day `{ year, month (0-11), day }` at the location for an instant.
function dayAtLocation(instant, location) {
  if (location.timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: location.timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(instant);
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return { year: get('year'), month: get('month') - 1, day: get('day') };
  }
  const solar = new Date(instant.getTime() + (location.lng / 15) * MS_PER_HOUR);
  return { year: solar.getUTCFullYear(), month: solar.getUTCMonth(), day: solar.getUTCDate() };
}

// adhan reads the calendar day from the Date's *machine-local* components, so
// build a local Date carrying the wanted day (offset by `addDays`).
function timesForDay({ year, month, day }, location, addDays = 0) {
  const adhanDate = new Date(year, month, day + addDays);
  const pt = new PrayerTimes(new Coordinates(location.lat, location.lng), adhanDate, params());
  const out = {};
  for (const key of PRAYER_KEYS) out[key] = pt[key];
  return out;
}

/**
 * Prayer times for the calendar day (at `location`) that contains `date`.
 * @returns {{fajr: Date, sunrise: Date, dhuhr: Date, asr: Date, maghrib: Date, isha: Date}}
 */
export function getPrayerTimes(date, location) {
  return timesForDay(dayAtLocation(date, location), location);
}

/**
 * The first prayer strictly after `now`. After Isha this is tomorrow's Fajr.
 * @returns {{name: 'fajr'|'dhuhr'|'asr'|'maghrib'|'isha', time: Date}}
 */
export function nextPrayer(now, location) {
  const day = dayAtLocation(now, location);
  // Look at yesterday..tomorrow so that a day boundary that differs slightly
  // from the civil one can never skip or repeat a prayer.
  for (const offset of [-1, 0, 1, 2]) {
    const times = timesForDay(day, location, offset);
    for (const name of PRAYERS) {
      if (times[name].getTime() > now.getTime()) return { name, time: times[name] };
    }
  }
  throw new Error('nextPrayer: no prayer found within two days');
}

/**
 * Which adhkar section to highlight: 'morning' in [fajr, asr), 'evening' in
 * [asr, isha), otherwise null.
 */
export function highlightedSection(now, times) {
  const t = now.getTime();
  if (t >= times.fajr.getTime() && t < times.asr.getTime()) return 'morning';
  if (t >= times.asr.getTime() && t < times.isha.getTime()) return 'evening';
  return null;
}

/**
 * The night that follows the day (at `location`) containing `date`: from that
 * day's Maghrib to the next day's Fajr (same Egyptian method), with its
 * midpoint and the start of its last third.
 * @returns {{maghrib: Date, fajr: Date, lengthMs: number, middle: Date, lastThirdStart: Date}}
 */
export function getNightTimes(date, location) {
  const day = dayAtLocation(date, location);
  const maghrib = timesForDay(day, location).maghrib;
  const fajr = timesForDay(day, location, 1).fajr;
  const lengthMs = fajr.getTime() - maghrib.getTime();
  return {
    maghrib,
    fajr,
    lengthMs,
    middle: new Date(maghrib.getTime() + lengthMs / 2),
    lastThirdStart: new Date(fajr.getTime() - lengthMs / 3),
  };
}

/** Middle of the night (Date) after the day containing `date`. */
export function getMiddleOfNight(date, location) {
  return getNightTimes(date, location).middle;
}

/** Start of the last third of the night (Date) after the day containing `date`. */
export function getLastThirdOfNight(date, location) {
  return getNightTimes(date, location).lastThirdStart;
}
