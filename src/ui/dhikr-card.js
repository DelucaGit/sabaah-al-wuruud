// One dhikr card: Arabic text, ×N label, star toggle, collapsible Virtue/Source,
// and, for 100× adhkar, a tap counter with a progress ring and a reset button.
// The card only renders and reports events; the section screen owns the state.
import { hasCounter, COUNTER_REPEAT } from '../core/adhkar.js';

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

/**
 * @param {{ id: string, arabic: string, repeat: number, virtue?: string, source?: string }} dhikr
 * @param {{ pinned: boolean, count: number,
 *           onTogglePin: () => void, onTap: () => void, onReset: () => void }} opts
 * @returns {{ el: HTMLElement, setCount: (n: number) => void }}
 */
export function createDhikrCard(dhikr, { pinned, count = 0, onTogglePin, onTap, onReset }) {
  const counter = hasCounter(dhikr);
  const card = document.createElement('article');
  card.className = 'dhikr' + (counter ? ' dhikr--counter' : '') + (pinned ? ' dhikr--pinned' : '');
  card.dataset.id = dhikr.id;

  const head = el('div', 'dhikr__head');
  const repeat = el('span', 'dhikr__repeat', `×${dhikr.repeat}`);
  const star = el('button', 'dhikr__star', pinned ? '★' : '☆');
  star.type = 'button';
  star.setAttribute('aria-pressed', String(pinned));
  star.setAttribute('aria-label', pinned ? 'Unstar' : 'Star');
  star.addEventListener('click', (e) => {
    e.stopPropagation();
    onTogglePin();
  });
  head.append(repeat, star);

  const text = el('p', 'dhikr__text font-adhkar', dhikr.arabic);
  text.dir = 'rtl';
  text.lang = 'ar';
  card.append(head, text);

  for (const [key, label] of [['virtue', 'Virtue'], ['source', 'Source']]) {
    if (!dhikr[key]) continue;
    const details = el('details', 'dhikr__more');
    details.append(el('summary', 'dhikr__summary', label));
    const body = el('p', 'dhikr__more-text', dhikr[key]);
    body.dir = 'rtl';
    body.lang = 'ar';
    details.append(body);
    card.append(details);
  }

  if (!counter) return { el: card, setCount: () => {} };

  const target = COUNTER_REPEAT;
  const row = el('div', 'dhikr__counter');
  const ring = el('div', 'dhikr__ring');
  ring.innerHTML = `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle class="dhikr__ring-track" cx="32" cy="32" r="${RING_R}" />
      <circle class="dhikr__ring-fill" cx="32" cy="32" r="${RING_R}"
        stroke-dasharray="${RING_C}" transform="rotate(-90 32 32)" />
    </svg>`;
  const fill = ring.querySelector('.dhikr__ring-fill');
  const label = el('span', 'dhikr__count');
  label.setAttribute('aria-live', 'polite');
  const hint = el('span', 'dhikr__hint', 'Tap the card to count');
  const resetBtn = el('button', 'dhikr__reset', '↺');
  resetBtn.type = 'button';
  resetBtn.setAttribute('aria-label', 'Reset counter');
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onReset();
  });
  const info = el('div', 'dhikr__counter-info');
  info.append(label, hint);
  row.append(ring, info, resetBtn);
  card.append(row);

  const setCount = (n) => {
    label.textContent = `${n} / ${target}`;
    fill.style.strokeDashoffset = String(RING_C * (1 - Math.min(n, target) / target));
    card.classList.toggle('dhikr--complete', n >= target);
  };
  setCount(count);

  // The whole card counts, except its own controls (star, reset, Virtue/Source).
  card.addEventListener('click', (e) => {
    if (e.target.closest('button, details')) return;
    onTap();
  });

  return { el: card, setCount };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
