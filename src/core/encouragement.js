// Daytime encouragement reminders (pure, deterministic). Chooses when the
// day's N gentle messages fire and which messages they carry.
//
// Times: N slots spread evenly over the free part of the daytime window
// (09:00-20:30 at the prayer location), away from prayer times and the other
// reminders, with a small jitter seeded by the date so they vary per day but
// never change for a given day.
//
// Messages: no stored history. Each pool is put in one fixed, seeded order and
// day d reads MAX_PER_DAY consecutive entries starting at d * MAX_PER_DAY.
// A pool of M messages therefore repeats no message within floor(M / 5) days
// (6+ days with the current data), whatever N and the goal state are.

import { ENCOURAGEMENT_PER_DAY as PER_DAY } from './state.js';

const MAX_PER_DAY = PER_DAY.max;

/** Daytime window in minutes of the local day at the prayer location. */
export const WINDOW = { start: 9 * 60, end: 20 * 60 + 30 };
/** No encouragement within this many minutes of a prayer or another reminder. */
export const GAP_MIN = 25;
/** Prayer times kept clear (sunrise is not a prayer). */
export const AVOID_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const SHUFFLE_SEED = 0x5eed;

/** Integer day number of the local calendar day of `date` (days since 1970-01-01). */
export function dayNumber(date) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

// mulberry32: small, fast, deterministic PRNG returning [0, 1).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, seed) {
  const out = [...list];
  const rand = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Minutes of the local day of `date` in `timeZone` (device zone when omitted).
function minutesOfDay(date, timeZone) {
  if (!timeZone) return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute') + get('second') / 60;
}

/**
 * The N encouragement times for the local day containing `day`.
 *
 * @param {object} args
 * @param {Date} args.day           Any instant on the day (local noon is best).
 * @param {number} args.perDay      1-5.
 * @param {Date[]} [args.avoid]     Prayer times and other reminders to keep GAP_MIN away from.
 * @param {string} [args.timeZone]  IANA zone of the prayer location; device zone when omitted.
 * @returns {Date[]}  Sorted, whole minutes, possibly fewer than N if the day is too full.
 */
export function encouragementTimes({ day, perDay, avoid = [], timeZone }) {
  const n = clampPerDay(perDay);
  // Instant of minute `m` of the location's day: anchored on `day`, which is
  // accurate except across a DST switch at night, outside the window.
  const anchor = day.getTime() - minutesOfDay(day, timeZone) * MS_PER_MINUTE;
  const start = anchor + WINDOW.start * MS_PER_MINUTE;
  const end = anchor + WINDOW.end * MS_PER_MINUTE;
  const gap = GAP_MIN * MS_PER_MINUTE;

  // Free segments of the window, snapped inward to whole minutes.
  const blocked = avoid
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()))
    .map((d) => [d.getTime() - gap, d.getTime() + gap])
    .sort((a, b) => a[0] - b[0]);
  const free = [];
  let cursor = start;
  for (const [from, to] of [...blocked, [end, end]]) {
    const segEnd = Math.min(from, end);
    if (segEnd > cursor) free.push([cursor, segEnd]);
    cursor = Math.max(cursor, to);
  }
  const segments = free
    .map(([a, b]) => [Math.ceil(a / MS_PER_MINUTE) * MS_PER_MINUTE, Math.floor(b / MS_PER_MINUTE) * MS_PER_MINUTE])
    .filter(([a, b]) => b >= a);
  // Each segment contributes its length plus one minute (both ends usable).
  const total = segments.reduce((sum, [a, b]) => sum + (b - a) / MS_PER_MINUTE + 1, 0);
  if (total <= 0) return [];

  const rand = rng(dayNumber(day) * 7919 + n);
  const share = total / n;
  const out = [];
  for (let k = 0; k < n; k++) {
    // Middle of slot k, moved up to 30% of a slot either way.
    const pos = Math.floor(share * (k + 0.5 + (rand() - 0.5) * 0.6));
    let left = Math.min(Math.max(pos, 0), total - 1);
    for (const [a, b] of segments) {
      const len = (b - a) / MS_PER_MINUTE + 1;
      if (left < len) {
        const at = a + left * MS_PER_MINUTE;
        if (!out.includes(at)) out.push(at);
        break;
      }
      left -= len;
    }
  }
  return out.sort((a, b) => a - b).map((ms) => new Date(ms));
}

/**
 * The day's messages, one per slot, in slot order. The later half of the
 * slots (rounded up) speak to the goal state when there are goals: goalDone
 * if any goal is done today, else goalPending. The rest are general.
 *
 * @param {object} args
 * @param {Date} args.day
 * @param {number} args.count  Number of slots.
 * @param {{general: {id: string, text: string}[], goalDone: object[], goalPending: object[]}} args.messages
 * @param {{hasGoals?: boolean, anyDone?: boolean}} [args.goals]
 * @returns {{id: string, text: string}[]}
 */
export function pickMessages({ day, count, messages, goals = {} }) {
  const d = dayNumber(day);
  const fromPool = (pool, i) => {
    const list = shuffled(pool ?? [], SHUFFLE_SEED + pool.length);
    if (!list.length) return null;
    return list[(((d * MAX_PER_DAY + i) % list.length) + list.length) % list.length];
  };
  const stateCount = goals.hasGoals ? Math.ceil(count / 2) : 0;
  const statePool = goals.anyDone ? messages.goalDone : messages.goalPending;
  const out = [];
  for (let k = 0; k < count; k++) {
    const isState = k >= count - stateCount;
    const msg = isState
      ? fromPool(statePool ?? [], k - (count - stateCount)) ?? fromPool(messages.general ?? [], k)
      : fromPool(messages.general ?? [], k);
    if (msg) out.push(msg);
  }
  return out;
}

/**
 * `text` with `{name}` filled in. Without a name the placeholder and the comma
 * that goes with it are dropped ("{name}, x" -> "X", "x, {name}." -> "x.").
 * @param {string} text
 * @param {string} [name]
 */
export function fillName(text, name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (n) return text.replaceAll('{name}', n);
  let s = text
    .replace(/^\s*\{name\}\s*,?\s*/, '')
    .replace(/\s*,\s*\{name\}/g, '')
    .replace(/\s*\{name\}\s*/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clampPerDay(v) {
  return Number.isInteger(v) ? Math.min(PER_DAY.max, Math.max(PER_DAY.min, v)) : PER_DAY.default;
}
