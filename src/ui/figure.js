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

// viewBox 48 x 52, the ground is y = 52. ONE body in both poses (#150): the
// same head, headscarf and long garment. Standing is the drawing as it is;
// sitting down moves the same parts (figure.css): the head and scarf lower
// unchanged, the garment folds down and its hem spreads out on the ground.
const FIGURE_SVG = `<svg class="figure" viewBox="0 0 48 52" focusable="false" aria-hidden="true">
  <g class="figure__walker">
    <g class="figure__breath">
      <g class="figure__step"><g transform="translate(24 52) scale(1.12) translate(-24 -52)">
        <path class="figure__foot figure__foot--a" d="M23 49.6h4.4c1.3 0 2.2.9 2.2 2.4H23Z"/>
        <path class="figure__foot figure__foot--b" d="M23 49.6h4.4c1.3 0 2.2.9 2.2 2.4H23Z"/>
        <g class="figure__lower">
          <path class="figure__robe figure__skirt" d="M18 24C17.4 34 15.6 44 13.4 50.6C13.1 51.5 13.7 52 14.5 52H33.5C34.3 52 34.9 51.5 34.6 50.6C32.4 44 30.6 34 30 24Z"/>
        </g>
        <g class="figure__pool">
          <path class="figure__robe figure__hem" d="M10.4 47.4C8.2 48 6 49.5 4.8 51.2C4.5 51.7 4.8 52 5.3 52H12.4Z"/>
          <path class="figure__robe" d="M24 40.6C18.6 40.6 13 43.2 9.8 46.5C7.8 48.5 6.8 50 7.2 51C7.4 51.7 8.2 52 9.2 52H38.8C39.8 52 40.6 51.7 40.8 51C41.2 50 40.2 48.5 38.2 46.5C35 43.2 29.4 40.6 24 40.6Z"/>
        </g>
        <g class="figure__upper">
          <path class="figure__veil figure__tail" d="M16.2 25.4C14.8 26.6 13.6 28.4 13 30.6C15 30.4 17 29.6 18.6 28.2Z"/>
          <path class="figure__veil" d="M19.4 14C19.4 16.8 18.6 18.4 17.4 19.8C15.8 21.7 15.2 25 15.6 30.4C18.6 32 29.4 32 32.4 30.4C32.8 25 32.2 21.7 30.6 19.8C29.4 18.4 28.6 16.8 28.6 14Z"/>
          <ellipse class="figure__veil figure__head" cx="24" cy="14.6" rx="4.8" ry="5"/>
        </g>
      </g></g>
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
