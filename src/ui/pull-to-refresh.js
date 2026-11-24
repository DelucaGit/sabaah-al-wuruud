// Pull-to-refresh: touch wiring and indicator. The gesture rules are in
// ../core/pull.js.
import './pull-to-refresh.css';
import { createPull, THRESHOLD } from '../core/pull.js';
import { tap } from '../adapters/haptics.js';
import { icon } from './kit.js';

const SPIN_MS = 600; // how long the indicator stays after letting go

/**
 * @param {HTMLElement} view  The scroll container (<main class="app-view">).
 * @param {() => void} onRefresh
 * @returns {() => void} Cleanup.
 */
export function attachPullToRefresh(view, onRefresh) {
  const pull = createPull();
  const el = document.createElement('div');
  el.className = 'pull';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<span class="pull__icon">${icon('reset')}</span>`;
  view.parentElement.append(el);
  view.classList.add('has-pull');
  let armed = false;
  let spinTimer = null;

  function show(distance) {
    el.classList.toggle('pull--visible', distance > 0);
    el.style.setProperty('--pull', `${distance}px`);
    el.style.setProperty('--pull-turn', `${Math.round((distance / THRESHOLD) * -270)}deg`);
  }

  function hide() {
    armed = false;
    el.classList.remove('pull--dragging', 'pull--armed', 'pull--spinning');
    show(0);
  }

  function onStart(e) {
    if (spinTimer !== null || e.touches.length !== 1) {
      pull.cancel();
      if (spinTimer === null) hide();
      return;
    }
    const t = e.touches[0];
    pull.start(t.clientX, t.clientY, view.scrollTop <= 0);
  }

  function onMove(e) {
    const t = e.touches[0];
    const state = pull.move(t.clientX, t.clientY);
    if (!state.pulling) return;
    if (e.cancelable) e.preventDefault(); // no native scroll while pulling
    if (state.armed && !armed) tap();
    armed = state.armed;
    el.classList.add('pull--dragging');
    el.classList.toggle('pull--armed', armed);
    show(state.distance);
  }

  function onEnd() {
    if (spinTimer !== null) return;
    if (!pull.end()) {
      hide();
      return;
    }
    el.classList.remove('pull--dragging');
    el.classList.add('pull--spinning');
    show(THRESHOLD);
    spinTimer = setTimeout(() => { spinTimer = null; hide(); }, SPIN_MS);
    onRefresh();
  }

  function onCancel() {
    pull.cancel();
    if (spinTimer === null) hide();
  }

  view.addEventListener('touchstart', onStart, { passive: true });
  view.addEventListener('touchmove', onMove, { passive: false });
  view.addEventListener('touchend', onEnd);
  view.addEventListener('touchcancel', onCancel);

  return () => {
    clearTimeout(spinTimer);
    view.removeEventListener('touchstart', onStart);
    view.removeEventListener('touchmove', onMove);
    view.removeEventListener('touchend', onEnd);
    view.removeEventListener('touchcancel', onCancel);
    view.classList.remove('has-pull');
    el.remove();
  };
}
