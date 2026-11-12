// Pure logic for the adhkar lists: starred (pinned) ordering and the 100× counter.
// Dhikr shape (see the adhkar data): { id, arabic, repeat, virtue?, source? }.

/** The only repeat count that gets a tap counter. */
export const COUNTER_REPEAT = 100;

/**
 * Split a section into pinned and unpinned adhkar.
 * Both groups keep the original book order; pinned IDs not in the list are ignored.
 * @param {Array<{id: string}>} list adhkar in book order
 * @param {string[]} pinnedIds
 * @returns {{ pinned: Array, rest: Array }}
 */
export function orderAdhkar(list, pinnedIds) {
  const pinnedSet = new Set(pinnedIds ?? []);
  const pinned = [];
  const rest = [];
  for (const dhikr of list) {
    (pinnedSet.has(dhikr.id) ? pinned : rest).push(dhikr);
  }
  return { pinned, rest };
}

/**
 * Pin the id if it is not pinned, otherwise unpin it. Never mutates the input.
 * @param {string[]} pinnedIds
 * @param {string} id
 * @returns {string[]}
 */
export function togglePin(pinnedIds, id) {
  const current = pinnedIds ?? [];
  return current.includes(id)
    ? current.filter((pinnedId) => pinnedId !== id)
    : [...current, id];
}

/** True only for adhkar recited exactly 100 times. */
export function hasCounter(dhikr) {
  return dhikr?.repeat === COUNTER_REPEAT;
}

/**
 * One tap on the counter. Never goes past the target; `reachedTarget` is true
 * only on the tap that lands exactly on the target.
 * @param {number} value
 * @param {number} target
 * @returns {{ value: number, reachedTarget: boolean }}
 */
export function increment(value, target) {
  if (value >= target) return { value: target, reachedTarget: false };
  const next = value + 1;
  return { value: next, reachedTarget: next === target };
}

/** The counter's starting value. */
export function reset() {
  return 0;
}

/**
 * How many taps mark a dhikr as read today: 100 for the counter adhkar, 1 for
 * everything else (those she counts on her fingers and ticks off once).
 */
export function readTarget(dhikr) {
  return hasCounter(dhikr) ? COUNTER_REPEAT : 1;
}

/** True when today's count for the dhikr has reached its read target. */
export function isRead(dhikr, counters) {
  return (counters?.[dhikr.id] ?? 0) >= readTarget(dhikr);
}

/**
 * How much of a section has been read today.
 * @param {Array<{id: string, repeat: number}>} list
 * @param {Record<string, number>} counters today's counts by dhikr id
 * @returns {{ read: number, total: number, fraction: number, all: boolean }}
 */
export function sectionProgress(list, counters) {
  const total = list.length;
  const read = list.filter((dhikr) => isRead(dhikr, counters)).length;
  return { read, total, fraction: total ? read / total : 0, all: total > 0 && read === total };
}
