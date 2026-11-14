// Prayer dial geometry (pure, no DOM).
//
// The dial is a full 24-hour ring. ANGLE CONVENTION: degrees, 0 = local
// midnight at the TOP of the ring, increasing CLOCKWISE; 06:00 = 90 (right),
// 12:00 = 180 (bottom), 18:00 = 270 (left). For SVG (y grows downwards) a
// point at angle a on radius r around (cx, cy) is
//   x = cx + r * sin(a), y = cy - r * cos(a)   (a in radians).
//
// "Local" means the prayer location's time zone (`timeZone`, an IANA name as
// in prayerLocation().timeZone); without one, the device's time zone is used,
// exactly like formatTime in src/ui/prayer-view.js.
//
// `times` is the object returned by getPrayerTimes (fajr, sunrise, dhuhr, asr,
// maghrib, isha as Dates) for the location's current day.

const MS_PER_MIN = 60 * 1000;
const MIN_PER_DAY = 24 * 60;

/** The six windows in ring order, and the prayer time each one starts at. */
export const WINDOW_KEYS = Object.freeze(['fajr', 'duha', 'dhuhr', 'asr', 'maghrib', 'isha']);
export const WINDOW_START = Object.freeze({
  fajr: 'fajr', duha: 'sunrise', dhuhr: 'dhuhr', asr: 'asr', maghrib: 'maghrib', isha: 'isha',
});
/** The six dots on the ring (keys of `times`). */
export const DOT_KEYS = Object.freeze(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']);

/**
 * Minutes since local midnight (0 <= m < 1440, fractional) of an instant.
 * @param {Date} date
 * @param {string} [timeZone]  IANA zone; device zone when omitted.
 * @returns {number}
 */
export function minutesOfDay(date, timeZone) {
  const secs = date.getSeconds() + date.getMilliseconds() / 1000;
  if (!timeZone) return date.getHours() * 60 + date.getMinutes() + secs / 60;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', hour: 'numeric', minute: 'numeric',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  // Seconds are the same in every zone with whole-minute offsets.
  return (get('hour') % 24) * 60 + get('minute') + secs / 60;
}

/**
 * Ring angle (0 <= a < 360) of minutes since local midnight.
 * @param {number} minutes
 * @returns {number}
 */
export function angleForMinutes(minutes) {
  const m = ((minutes % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return (m / MIN_PER_DAY) * 360;
}

/**
 * Ring angle of an instant at its true local clock position.
 * @param {Date} date
 * @param {string} [timeZone]
 * @returns {number}
 */
export function angleOf(date, timeZone) {
  return angleForMinutes(minutesOfDay(date, timeZone));
}

/**
 * Angles of the six dots.
 * @param {{fajr: Date, sunrise: Date, dhuhr: Date, asr: Date, maghrib: Date, isha: Date}} times
 * @param {string} [timeZone]
 * @returns {{fajr: number, sunrise: number, dhuhr: number, asr: number, maghrib: number, isha: number}}
 */
export function dotAngles(times, timeZone) {
  const out = {};
  for (const key of DOT_KEYS) out[key] = angleOf(times[key], timeZone);
  return out;
}

/** The two night events on the ring, in clock order. */
export const NIGHT_KEYS = Object.freeze(['middle', 'lastThird']);

/**
 * Angles of the two night events: the middle of the night and the start of
 * its last third, each at its true local clock position like every other
 * dot. The middle can fall on either side of the top (just before or just
 * after local midnight); the angle simply follows the clock.
 * WHICH night is the caller's choice: the dial shows the night currently
 * relevant (getCurrentNight in prayer.js: before today's Fajr the night that
 * started yesterday, otherwise tonight's).
 * @param {{middle: Date, lastThirdStart: Date}} night  getNightTimes / getCurrentNight
 * @param {string} [timeZone]
 * @returns {{middle: number, lastThird: number}}
 */
export function nightAngles(night, timeZone) {
  return {
    middle: angleOf(night.middle, timeZone),
    lastThird: angleOf(night.lastThirdStart, timeZone),
  };
}

/**
 * Arc of each window, in ring order. `start` is in [0, 360); `end` is the
 * next window's start angle, with 360 added when the arc crosses the top
 * (midnight), so always start < end and end - start is the arc's sweep.
 * Together the six arcs cover the whole ring exactly once.
 * @returns {Array<{key: string, start: number, end: number}>}
 */
export function windowArcs(times, timeZone) {
  const dots = dotAngles(times, timeZone);
  return WINDOW_KEYS.map((key, i) => {
    const start = dots[WINDOW_START[key]];
    let end = dots[WINDOW_START[WINDOW_KEYS[(i + 1) % WINDOW_KEYS.length]]];
    if (end <= start) end += 360;
    return { key, start, end };
  });
}

/**
 * The active window at `now`. Before today's Fajr it is (yesterday's) Isha
 * window; from Isha onwards it is Isha until the next Fajr. Exactly one
 * window is active at any instant; a window includes its start instant.
 * @param {{fajr: Date, sunrise: Date, dhuhr: Date, asr: Date, maghrib: Date, isha: Date}} times
 * @param {Date} now
 * @returns {'fajr'|'duha'|'dhuhr'|'asr'|'maghrib'|'isha'}
 */
export function currentWindow(times, now) {
  const t = now.getTime();
  let active = 'isha';
  for (const key of WINDOW_KEYS) {
    if (t >= times[WINDOW_START[key]].getTime()) active = key;
  }
  return active;
}

/**
 * When the window after the active one starts. From Isha onwards that is
 * `nextFajr` (tomorrow's Fajr; defaults to today's Fajr + 24h).
 * @param {object} times
 * @param {Date} now
 * @param {Date} [nextFajr]
 * @returns {{key: string, time: Date}}  key of the next window and its start.
 */
export function nextWindowStart(times, now, nextFajr) {
  const t = now.getTime();
  if (t < times.fajr.getTime()) return { key: 'fajr', time: times.fajr };
  const i = WINDOW_KEYS.indexOf(currentWindow(times, now));
  if (i === WINDOW_KEYS.length - 1) {
    return { key: 'fajr', time: nextFajr ?? new Date(times.fajr.getTime() + MIN_PER_DAY * MS_PER_MIN) };
  }
  const key = WINDOW_KEYS[i + 1];
  return { key, time: times[WINDOW_START[key]] };
}

/**
 * Milliseconds left until the next window starts (> 0).
 * @param {object} times
 * @param {Date} now
 * @param {Date} [nextFajr]
 * @returns {number}
 */
export function timeLeftInWindow(times, now, nextFajr) {
  return nextWindowStart(times, now, nextFajr).time.getTime() - now.getTime();
}

/**
 * Everything the dial needs in one call.
 * @param {object} times  getPrayerTimes(now, location)
 * @param {Date} now
 * @param {{timeZone?: string, nextFajr?: Date, night?: {middle: Date, lastThirdStart: Date}}} [opts]
 *   `night`: the night whose two events go on the ring (see nightAngles).
 * @returns {{dots: object, arcs: Array<{key: string, start: number, end: number}>,
 *   nowAngle: number, current: string, next: {key: string, time: Date}, msLeft: number,
 *   night: {middle: number, lastThird: number} | null}}
 */
export function dialGeometry(times, now, { timeZone, nextFajr, night } = {}) {
  const next = nextWindowStart(times, now, nextFajr);
  return {
    dots: dotAngles(times, timeZone),
    arcs: windowArcs(times, timeZone),
    nowAngle: angleOf(now, timeZone),
    current: currentWindow(times, now),
    next,
    msLeft: next.time.getTime() - now.getTime(),
    night: night ? nightAngles(night, timeZone) : null,
  };
}
