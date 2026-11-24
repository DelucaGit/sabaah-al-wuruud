// Pure pull-to-refresh gesture logic (no DOM). The touch wiring is in
// src/ui/pull-to-refresh.js. Distances are in px.

/** Movement before the gesture decides between pull, scroll and swipe. */
export const SLOP = 6;
/** Indicator travel (after resistance) at which letting go refreshes. */
export const THRESHOLD = 64;
/** The indicator never travels further than this. */
export const MAX_PULL = 96;
const RESISTANCE = 0.5;

/** How far the indicator travels for a finger that moved `dy` down. */
export function pullDistance(dy) {
  return Math.min(MAX_PULL, Math.max(0, dy) * RESISTANCE);
}

/**
 * One finger's gesture. A pull must begin at the top of the page and head
 * mainly downward; once it turned out to be a scroll or a sideways swipe it
 * stays that until the finger lifts.
 */
export function createPull() {
  let phase = 'idle'; // idle | deciding | pulling
  let x0 = 0;
  let y0 = 0;
  let distance = 0;

  const cancel = () => {
    phase = 'idle';
    distance = 0;
  };

  return {
    start(x, y, atTop) {
      cancel();
      if (!atTop) return;
      phase = 'deciding';
      x0 = x;
      y0 = y;
    },
    /** @returns {{ pulling: boolean, distance: number, armed: boolean }} */
    move(x, y) {
      if (phase === 'deciding') {
        const dx = Math.abs(x - x0);
        const dy = y - y0;
        if (Math.max(dx, Math.abs(dy)) >= SLOP) {
          if (dy > dx) phase = 'pulling';
          else cancel();
        }
      }
      if (phase === 'pulling') distance = pullDistance(y - y0);
      return { pulling: phase === 'pulling', distance, armed: distance >= THRESHOLD };
    },
    /** Finger lifted: true when the page should refresh. */
    end() {
      const refresh = phase === 'pulling' && distance >= THRESHOLD;
      cancel();
      return refresh;
    },
    cancel,
  };
}
