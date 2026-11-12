// Daily state: done sections and 100x counters that start fresh every day.
// "Today" is defined by local midnight on the device. All functions are pure:
// they never read the clock (callers pass `now`) and never mutate their input.
//
// Shape of `daily`: { dayKey: 'YYYY-MM-DD', done: { [section]: true }, counters: { [dhikrId]: number } }

const pad2 = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for `now` in device-local time. */
export function dayKey(now) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * Returns `daily` unchanged (same reference) if it belongs to today,
 * otherwise a fresh `{ dayKey, done: {}, counters: {} }` for today.
 */
export function ensureToday(daily, now) {
  const key = dayKey(now);
  if (daily && daily.dayKey === key) return daily;
  return { dayKey: key, done: {}, counters: {} };
}

/** Returns a new daily state with `section` marked done today. */
export function markDone(daily, section, now) {
  const today = ensureToday(daily, now);
  return { ...today, done: { ...today.done, [section]: true } };
}

/** True only if `section` was marked done today. */
export function isDone(daily, section, now) {
  return ensureToday(daily, now).done[section] === true;
}

/** Returns a new daily state with the counter for `dhikrId` set to `value` today. */
export function setCounter(daily, dhikrId, value, now) {
  const today = ensureToday(daily, now);
  return { ...today, counters: { ...today.counters, [dhikrId]: value } };
}

/** Today's counter value for `dhikrId`; 0 if missing or from another day. */
export function getCounter(daily, dhikrId, now) {
  return ensureToday(daily, now).counters[dhikrId] ?? 0;
}
