// The Today prayer dial: a full 24-hour SVG ring with a dot per prayer time,
// the current window drawn as a dark arc, a "now" marker, and the next prayer
// with its countdown in the centre. Pure HTML builders (no DOM); the styles
// are in prayer-dial.css. Geometry and the angle convention (0 = local
// midnight at the top, clockwise) come from src/core/dial.js.
import { dialGeometry, DOT_KEYS, WINDOW_START } from '../core/dial.js';
import { esc } from './kit.js';
import { PRAYER_LABELS, formatTime } from './prayer-view.js';

/** Dot labels on the ring. */
export const DOT_LABELS = Object.freeze({
  fajr: 'Fajr', sunrise: 'Shurooq', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
});

/** Spoken description of each window. */
const WINDOW_TEXT = Object.freeze({
  fajr: 'Fajr, until Shurooq',
  duha: 'Duha, from Shurooq until Dhuhr',
  dhuhr: 'Dhuhr, until Asr',
  asr: 'Asr, until Maghrib',
  maghrib: 'Maghrib, until Isha',
  isha: 'Isha, until Fajr',
});

// SVG layout (user units). The viewBox is wider than tall so the side labels fit.
const W = 340;
const H = 300;
const TRIM = 20; // empty band cropped from the top and bottom of the viewBox
const CX = W / 2;
const CY = H / 2;
const R = 104; // ring radius
const LABEL_R = R + 15; // label anchor radius
const LABEL_GAP = 13; // minimum vertical distance between two stacked labels

const n = (x) => Number(x.toFixed(2));
const rad = (deg) => (deg * Math.PI) / 180;
const point = (deg, r) => [n(CX + r * Math.sin(rad(deg))), n(CY - r * Math.cos(rad(deg)))];

/** "in 1 h 12 min" / "in 12 min" / "now". */
export function countdown(target, now) {
  const minutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
  if (minutes === 0) return 'now';
  const h = Math.floor(minutes / 60);
  return h ? `in ${h} h ${minutes % 60} min` : `in ${minutes} min`;
}

/** SVG path of the ring arc from `start` to `end` degrees (start < end, sweep < 360). */
export function arcPath(start, end) {
  const [x1, y1] = point(start, R);
  const [x2, y2] = point(end, R);
  return `M${x1} ${y1} A${R} ${R} 0 ${end - start > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/**
 * Where each dot's label goes: outside the ring, anchored away from it, and
 * pushed apart vertically when two neighbours on the same side would collide.
 * @param {Record<string, number>} dots  angle per dot key
 * @returns {Array<{key: string, x: number, y: number, anchor: 'start'|'middle'|'end'}>}
 */
export function labelLayout(dots) {
  const labels = DOT_KEYS.map((key) => {
    const s = Math.sin(rad(dots[key]));
    const [x, y] = point(dots[key], LABEL_R);
    const anchor = s > 0.25 ? 'start' : s < -0.25 ? 'end' : 'middle';
    return { key, x, y, anchor };
  });
  for (const anchor of ['start', 'end', 'middle']) {
    const group = labels.filter((l) => l.anchor === anchor).sort((a, b) => a.y - b.y);
    // Top and bottom labels only collide when they are on the same half.
    for (let pass = 0; pass < 4; pass += 1) {
      for (let i = 1; i < group.length; i += 1) {
        const a = group[i - 1];
        const b = group[i];
        const gap = b.y - a.y;
        if (gap >= LABEL_GAP) continue;
        if (anchor === 'middle' && Math.abs(a.x - b.x) > 60) continue;
        const push = (LABEL_GAP - gap) / 2;
        a.y = n(a.y - push);
        b.y = n(b.y + push);
      }
    }
  }
  return labels;
}

/**
 * Text alternative for the ring: the current window and the next prayer.
 * @param {string} current  window key from dialGeometry
 * @param {{name: string, time: Date}} next  from nextPrayer
 */
export function dialSummary(current, next, now, settings) {
  return `Current time: ${WINDOW_TEXT[current]}. Next prayer: ${PRAYER_LABELS[next.name]} `
    + `${countdown(next.time, now)}, at ${formatTime(next.time, settings)}.`;
}

/**
 * The dial card.
 * @param {object} times  today's prayer times (getPrayerTimes)
 * @param {{name: string, time: Date}} next  the next prayer (nextPrayer)
 * @param {Date} now
 * @param {object} settings  state.settings
 * @param {{timeZone?: string, nextFajr?: Date}} [opts]  passed to dialGeometry
 * @returns {string} HTML
 */
export function dialHtml(times, next, now, settings, opts = {}) {
  const geo = dialGeometry(times, now, opts);
  const active = geo.arcs.find((a) => a.key === geo.current);
  const startDot = WINDOW_START[geo.current];
  const endDot = WINDOW_START[geo.next.key];

  const dots = DOT_KEYS.map((key) => {
    const [x, y] = point(geo.dots[key], R);
    const cls = ['today-dial__dot'];
    if (key === 'sunrise') cls.push('today-dial__dot--subtle');
    if (key === startDot) cls.push('today-dial__dot--current');
    else if (key === endDot) cls.push('today-dial__dot--edge');
    const r = key === startDot ? 6 : key === 'sunrise' ? 3.5 : 4.5;
    return `<circle class="${cls.join(' ')}" data-dot="${key}" cx="${x}" cy="${y}" r="${r}"/>`;
  }).join('');

  const labels = labelLayout(geo.dots).map(({ key, x, y, anchor }) => {
    const cls = ['today-dial__label'];
    if (key === 'sunrise') cls.push('today-dial__label--subtle');
    if (key === startDot) cls.push('today-dial__label--current');
    return `<text class="${cls.join(' ')}" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central">${DOT_LABELS[key]}</text>`;
  }).join('');

  const [nowX, nowY] = point(geo.nowAngle, R);

  return `<section class="card today-dial" data-window="${geo.current}" aria-label="Prayer dial">
    <div class="today-dial__ring">
      <svg viewBox="0 ${TRIM} ${W} ${H - 2 * TRIM}" role="img" aria-label="${esc(dialSummary(geo.current, next, now, settings))}">
        <circle class="today-dial__track" cx="${CX}" cy="${CY}" r="${R}"/>
        <path class="today-dial__active" d="${arcPath(active.start, active.end)}"/>
        ${dots}
        ${labels}
        <circle class="today-dial__now" cx="${nowX}" cy="${nowY}" r="7"/>
      </svg>
      <div class="today-dial__center">
        <span class="section-label">Next prayer</span>
        <strong>${PRAYER_LABELS[next.name]}</strong>
        <span class="today-dial__count"><b>${countdown(next.time, now)}</b></span>
        <span class="today-dial__at">${esc(formatTime(next.time, settings))}</span>
      </div>
    </div>
  </section>`;
}
