// The faceless figure on the Today scene: a small lavender silhouette seen
// from behind (long garment, headscarf). She walks in from the left edge of
// the card once per opening of Today, sits down on the hill and watches the
// sky. Drawing and motion are in figure.css; this file owns the "once" part.
//
// Usage (today.js):
//   const figure = createFigure(scene.figureSpot);
//   figure.sync();      // after every scene.sync(): starts / keeps the entrance
//   figure.destroy();
//
// The walk-in is tied to a class that JS removes when the entrance is over, so
// nothing can replay it: not a 30 s repaint, not a scene change. While it is
// still running, a repaint in a WebView without moveBefore() re-inserts the
// scene layer and restarts CSS animations; sync() then moves them forward to
// where the entrance really is.
import './figure.css';
import { ENTRANCE_MS, figurePhase, catchUpTime } from '../core/figure.js';

// viewBox 48 x 52, the ground is y = 52. Two poses, one on top of the other.
const FIGURE_SVG = `<svg class="figure" viewBox="0 0 48 52" focusable="false" aria-hidden="true">
  <g class="figure__walker">
    <g class="figure__stand">
      <g class="figure__step"><g transform="translate(24 52) scale(1.12) translate(-24 -52)">
        <path class="figure__foot figure__foot--a" d="M23 49.6h4.4c1.3 0 2.2.9 2.2 2.4H23Z"/>
        <path class="figure__foot figure__foot--b" d="M23 49.6h4.4c1.3 0 2.2.9 2.2 2.4H23Z"/>
        <path class="figure__robe figure__skirt" d="M18 24C17.4 34 15.6 44 13.4 50.6C13.1 51.5 13.7 52 14.5 52H33.5C34.3 52 34.9 51.5 34.6 50.6C32.4 44 30.6 34 30 24Z"/>
        <path class="figure__veil" d="M24 9.6C27 9.6 28.8 11.8 28.8 14.6C28.8 16.8 29.4 18.4 30.6 19.8C32.2 21.7 32.8 25 32.4 30.4C29.4 32 18.6 32 15.6 30.4C15.2 25 15.8 21.7 17.4 19.8C18.6 18.4 19.2 16.8 19.2 14.6C19.2 11.8 21 9.6 24 9.6Z"/>
      </g></g>
    </g>
  </g>
  <g class="figure__seat">
    <g class="figure__breath">
      <path class="figure__robe figure__hem" d="M9.5 47.4C7 48 4.6 49.4 3.2 51.2C2.9 51.7 3.2 52 3.7 52H12Z"/>
      <path class="figure__robe" d="M15 37C14.2 40.6 12.4 43 9.8 45C7.6 46.6 6.6 48.6 6.8 50.2C7 51.4 8 52 9.4 52H38.6C40 52 41 51.4 41.2 50.2C41.4 48.6 40.4 46.6 38.2 45C35.6 43 33.8 40.6 33 37Z"/>
      <path class="figure__veil figure__tail" d="M16.4 40C14.4 41.4 12.6 43.4 11.4 46C13.8 45.6 16.4 44.6 18.6 43Z"/>
      <path class="figure__veil" d="M19.6 29.4C18.4 31.2 15.6 32.4 15 35.6C14.6 37.8 14.6 40 14.8 42C18 44.6 30 44.6 33.2 42C33.4 40 33.4 37.8 33 35.6C32.4 32.4 29.6 31.2 28.4 29.4Z"/>
      <ellipse class="figure__veil figure__head" cx="24" cy="26" rx="5.1" ry="5.5"/>
    </g>
  </g>
</svg>`;

function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * @param {HTMLElement} spot  scene.figureSpot (see scene.js)
 * @returns {{ el: SVGElement, sync: () => void, destroy: () => void }}
 */
export function createFigure(spot) {
  spot.innerHTML = FIGURE_SVG;
  const el = spot.firstElementChild;
  const reduced = prefersReducedMotion();
  let startedAt = null; // when the figure was first on screen
  let timer = null;

  function seat() {
    clearTimeout(timer);
    timer = null;
    el.classList.remove('figure--entering');
    el.classList.add('figure--seated');
  }

  if (reduced) seat();

  return {
    el,
    sync() {
      if (!el.isConnected || el.classList.contains('figure--seated')) return;
      const now = Date.now();
      if (figurePhase(startedAt, now, reduced) === 'waiting') {
        startedAt = now;
        el.classList.add('figure--entering');
        timer = setTimeout(seat, ENTRANCE_MS);
        return;
      }
      if (figurePhase(startedAt, now, reduced) === 'seated' || typeof el.getAnimations !== 'function') {
        seat();
        return;
      }
      // Still entering: put any animation a repaint restarted back in step.
      const elapsed = now - startedAt;
      for (const animation of el.getAnimations({ subtree: true })) {
        const time = catchUpTime(animation.currentTime ?? 0, elapsed);
        if (time !== null) animation.currentTime = time;
      }
    },
    destroy() {
      clearTimeout(timer);
      el.remove();
    },
  };
}
