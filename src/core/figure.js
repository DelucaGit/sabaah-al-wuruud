// Timing of the figure's one-time entrance on Today (pure, no DOM).
//
// The figure walks in, sits down and then stays seated. The entrance belongs
// to one opening of the Today tab: it is measured against the moment the
// figure first appeared, so a repaint that restarts CSS animations can be put
// back where the entrance really is (see src/ui/figure.js).

/** Walking in from the left edge of the card. Matches figure.css. */
export const WALK_MS = 3400;
/** Standing still for a beat, then sitting down. Matches figure.css. */
export const SIT_MS = 1300;
/** The whole entrance. */
export const ENTRANCE_MS = WALK_MS + SIT_MS;

/**
 * Where the figure is in its entrance.
 * @param {number|null} startedAt  ms timestamp of the first time it was shown, or null
 * @param {number} now  ms timestamp
 * @param {boolean} [reducedMotion]  true: never walk, seated at once
 * @returns {'waiting'|'entering'|'seated'}
 */
export function figurePhase(startedAt, now, reducedMotion = false) {
  if (reducedMotion) return 'seated';
  if (startedAt == null) return 'waiting';
  return now - startedAt < ENTRANCE_MS ? 'entering' : 'seated';
}

/**
 * An entrance animation that restarted (its clock is well behind the real
 * entrance) must jump forward. Returns the time to set, or null to leave it.
 * @param {number|null} currentTime  the animation's own clock, ms
 * @param {number} elapsed  ms since the entrance really started
 * @param {number} [tolerance]  ms of drift that is fine
 * @returns {number|null}
 */
export function catchUpTime(currentTime, elapsed, tolerance = 150) {
  if (typeof currentTime !== 'number' || !Number.isFinite(elapsed)) return null;
  return elapsed - currentTime > tolerance ? elapsed : null;
}
