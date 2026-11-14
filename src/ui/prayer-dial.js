// The Today prayer dial: a full 24-hour SVG ring with a dot per prayer time,
// the current window drawn as a dark arc, a "now" marker, and the next prayer
// with its countdown in the centre. The middle of the night and the start of
// its last third are two star markers on the same ring, each with its name
// and clock time written next to it (issue #154). Pure HTML builders (no DOM); the styles
// are in prayer-dial.css. Geometry and the angle convention (0 = local
// midnight at the top, clockwise) come from src/core/dial.js.
import { dialGeometry, DOT_KEYS, NIGHT_KEYS, WINDOW_START } from '../core/dial.js';
import { esc } from './kit.js';
import { PRAYER_LABELS, formatTime } from './prayer-view.js';

/** Dot labels on the ring. */
export const DOT_LABELS = Object.freeze({
  fajr: 'Fajr', sunrise: 'Shurooq', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
});

/** Names of the two night events, as written at their markers. */
export const NIGHT_LABELS = Object.freeze({ middle: 'Middle of the night', lastThird: 'Last third' });

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
const TOP = 4; // the viewBox runs from y = TOP (room for the night labels above the ring) ...
const BOTTOM = 280; // ... to y = BOTTOM (just under the lowest label)
const CX = W / 2;
const CY = H / 2;
const R = 104; // ring radius
const LABEL_R = R + 15; // label anchor radius
const LABEL_GAP = 13; // minimum vertical distance between two stacked labels
const NIGHT_LABEL_R = R + 25; // anchor radius of the two-line night labels (centre of the block)
const NIGHT_LINE = 12.5; // line height of a night label
const NIGHT_GAP = 14; // minimum horizontal distance between the two night labels' anchors
const RING_HALF = 4.5; // half the ring's stroke width (prayer-dial.css)
const EDGE = 3; // labels stay this far inside the viewBox
// Rough text widths (user units per character) for collision checks only.
const CHAR_W = 6.4; // 12px prayer labels
const NIGHT_NAME_W = 5.2; // 11.5px night label, name line
const NIGHT_TIME_W = 6; // 11.5px night label, time line (bold digits)

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

/** Horizontal extent [x1, x2] of a text of `width` anchored at `x`. */
function span(x, anchor, width) {
  if (anchor === 'start') return [x, x + width];
  if (anchor === 'end') return [x - width, x];
  return [x - width / 2, x + width / 2];
}

/** Bounding box of a laid-out label (estimated width; for collision checks). */
export function labelBox(label) {
  const [x1, x2] = span(label.x, label.anchor, label.width);
  return { x1, x2, y1: label.y - label.height / 2, y2: label.y + label.height / 2 };
}

const overlaps = (a, b, pad = 2) => a.x1 < b.x2 + pad && b.x1 < a.x2 + pad
  && a.y1 < b.y2 + pad && b.y1 < a.y2 + pad;

/**
 * Layout of every label on the ring: the six prayer labels (as labelLayout)
 * plus, when `night` is given, the two-line night labels (name, then time).
 *
 * The night events sit near the top of the ring, between Isha and Fajr, where
 * the labels are most crowded. Their labels go OUTSIDE the ring, further out
 * than the prayer labels, and lean away from each other: the middle of the
 * night reads to the left of its marker, the last third to the right (they
 * are in clock order, so the two blocks can never cross). A prayer label that
 * would touch a night label is then moved down/up along its side, clear of it.
 *
 * @param {Record<string, number>} dots  angle per prayer dot
 * @param {{middle: number, lastThird: number} | null} [night]  angles (nightAngles)
 * @param {{middle?: string, lastThird?: string}} [timeText]  formatted times, for the widths
 * @returns {Array<{key: string, x: number, y: number, anchor: string, width: number, height: number, night?: boolean}>}
 *   x / y: anchor point; y is the vertical centre of the label (of both lines for a night label).
 */
export function ringLabels(dots, night = null, timeText = {}) {
  const prayers = labelLayout(dots).map((l) => ({
    ...l, width: DOT_LABELS[l.key].length * CHAR_W, height: LABEL_GAP - 1,
  }));
  if (!night) return prayers;

  const blocks = NIGHT_KEYS.map((key) => {
    const s = Math.sin(rad(night[key]));
    const [x, y] = point(night[key], NIGHT_LABEL_R);
    // Lean apart at the top; follow the side further round the ring.
    const anchor = key === 'middle' ? (s > 0.5 ? 'start' : 'end') : (s < -0.5 ? 'end' : 'start');
    const width = Math.max(NIGHT_LABELS[key].length * NIGHT_NAME_W, (timeText[key] ?? '00:00 AM').length * NIGHT_TIME_W);
    return { key, x, y, anchor, width, height: 2 * NIGHT_LINE, night: true };
  });
  const [mid, last] = blocks;
  if (mid.anchor === 'end' && last.anchor === 'start' && last.x - mid.x < NIGHT_GAP) {
    const push = (NIGHT_GAP - (last.x - mid.x)) / 2;
    mid.x = n(mid.x - push);
    last.x = n(last.x + push);
  } else if (mid.anchor === last.anchor && Math.abs(last.y - mid.y) < 2 * NIGHT_LINE + 2) {
    // Both on the same side: stack them, the one nearer the top first.
    const [a, b] = mid.y <= last.y ? [mid, last] : [last, mid];
    const push = (2 * NIGHT_LINE + 2 - (b.y - a.y)) / 2;
    a.y = n(a.y - push);
    b.y = n(b.y + push);
  }
  for (const b of blocks) {
    // Keep the whole block inside the viewBox.
    const [x1, x2] = span(b.x, b.anchor, b.width);
    if (x1 < EDGE) b.x = n(b.x + EDGE - x1);
    if (x2 > W - EDGE) b.x = n(b.x - (x2 - (W - EDGE)));
    // A block that reaches over the top of the ring is lifted clear of it.
    const [l, r] = span(b.x, b.anchor, b.width);
    const dx = l <= CX && r >= CX ? 0 : Math.min(Math.abs(l - CX), Math.abs(r - CX));
    if (b.y < CY && dx < R) {
      const ringTop = CY - Math.sqrt(R * R - dx * dx) - RING_HALF;
      b.y = n(Math.min(b.y, ringTop - 2 - NIGHT_LINE));
    }
    b.y = n(Math.max(b.y, TOP + EDGE + NIGHT_LINE));
  }

  // Night labels stay put; prayer labels step aside (vertically), then keep
  // their distance from each other again.
  for (let pass = 0; pass < 6; pass += 1) {
    let moved = false;
    for (const p of prayers) {
      for (const b of blocks) {
        const pb = labelBox(p);
        const bb = labelBox(b);
        if (!overlaps(pb, bb)) continue;
        const down = p.y >= b.y;
        p.y = n(down ? bb.y2 + 2 + p.height / 2 + 0.1 : bb.y1 - 2 - p.height / 2 - 0.1);
        p.moved = down ? 1 : -1;
        moved = true;
      }
    }
    for (const p of prayers) {
      if (!p.moved) continue;
      for (const q of prayers) {
        if (q === p || q.anchor !== p.anchor || !overlaps(labelBox(p), labelBox(q), 0)) continue;
        if (Math.abs(q.y - p.y) >= LABEL_GAP) continue;
        q.y = n(p.y + p.moved * LABEL_GAP);
        q.moved = p.moved;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const p of prayers) delete p.moved;
  return [...prayers, ...blocks];
}

/** Four-pointed star (the night markers) centred on (x, y), tip radius r. */
export function starPath(x, y, r) {
  const k = n(r * 0.22); // how far the waist stays from the centre
  const p = (dx, dy) => `${n(x + dx)} ${n(y + dy)}`;
  return `M${p(0, -r)}Q${p(k, -k)} ${p(r, 0)}Q${p(k, k)} ${p(0, r)}Q${p(-k, k)} ${p(-r, 0)}Q${p(-k, -k)} ${p(0, -r)}Z`;
}

/**
 * Text alternative for the ring: the current window, the next prayer and,
 * when `night` is given, the two night times.
 * @param {string} current  window key from dialGeometry
 * @param {{name: string, time: Date}} next  from nextPrayer
 * @param {{middle: Date, lastThirdStart: Date}} [night]
 */
export function dialSummary(current, next, now, settings, night) {
  const base = `Current time: ${WINDOW_TEXT[current]}. Next prayer: ${PRAYER_LABELS[next.name]} `
    + `${countdown(next.time, now)}, at ${formatTime(next.time, settings)}.`;
  if (!night) return base;
  return `${base} Middle of the night: ${formatTime(night.middle, settings)}. `
    + `Last third of the night, the best time for tahajjud and dua, from ${formatTime(night.lastThirdStart, settings)}.`;
}

/**
 * The dial card.
 * @param {object} times  today's prayer times (getPrayerTimes)
 * @param {{name: string, time: Date}} next  the next prayer (nextPrayer)
 * @param {Date} now
 * @param {object} settings  state.settings
 * @param {{timeZone?: string, nextFajr?: Date, night?: {middle: Date, lastThirdStart: Date}}} [opts]
 *   passed to dialGeometry. `night` (getCurrentNight) adds the two night
 *   markers; without it (or when it cannot be computed) the ring has none.
 * @returns {string} HTML
 */
export function dialHtml(times, next, now, settings, opts = {}) {
  const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime());
  const night = opts.night && valid(opts.night.middle) && valid(opts.night.lastThirdStart) ? opts.night : null;
  const geo = dialGeometry(times, now, { ...opts, night: night ?? undefined });
  const nightTime = night ? {
    middle: formatTime(night.middle, settings),
    lastThird: formatTime(night.lastThirdStart, settings),
  } : {};
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

  const nightDots = night ? NIGHT_KEYS.map((key) => {
    const [x, y] = point(geo.night[key], R);
    const best = key === 'lastThird';
    const title = best ? 'Last third of the night: the best time for tahajjud and dua' : 'Middle of the night';
    return `<path class="today-dial__night${best ? ' today-dial__night--best' : ''}" data-night="${key}" d="${starPath(x, y, best ? 8.5 : 7)}"><title>${title}</title></path>`;
  }).join('') : '';

  const labels = ringLabels(geo.dots, geo.night, nightTime).map(({ key, x, y, anchor, night: isNight }) => {
    if (isNight) {
      const best = key === 'lastThird';
      return `<text class="today-dial__label today-dial__label--night${best ? ' today-dial__label--best' : ''}" data-night-label="${key}" text-anchor="${anchor}" dominant-baseline="central">`
        + `<tspan x="${x}" y="${n(y - NIGHT_LINE / 2)}">${NIGHT_LABELS[key]}</tspan>`
        + `<tspan class="today-dial__night-time" x="${x}" y="${n(y + NIGHT_LINE / 2)}">${esc(nightTime[key])}</tspan></text>`;
    }
    const cls = ['today-dial__label'];
    if (key === 'sunrise') cls.push('today-dial__label--subtle');
    if (key === startDot) cls.push('today-dial__label--current');
    return `<text class="${cls.join(' ')}" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central">${DOT_LABELS[key]}</text>`;
  }).join('');

  const [nowX, nowY] = point(geo.nowAngle, R);

  return `<section class="card today-dial" data-window="${geo.current}" aria-label="Prayer dial">
    <div class="today-dial__ring">
      <svg viewBox="0 ${TOP} ${W} ${BOTTOM - TOP}" role="img" aria-label="${esc(dialSummary(geo.current, next, now, settings, night ?? undefined))}">
        <circle class="today-dial__track" cx="${CX}" cy="${CY}" r="${R}"/>
        <path class="today-dial__active" d="${arcPath(active.start, active.end)}"/>
        ${dots}
        ${nightDots}
        ${labels}
        <circle class="today-dial__now" cx="${nowX}" cy="${nowY}" r="7"/>
      </svg>
      <div class="today-dial__center" style="top:${n((2 * (CY - TOP) / (BOTTOM - TOP) - 1) * 100)}%">
        <span class="section-label">Next prayer</span>
        <strong>${PRAYER_LABELS[next.name]}</strong>
        <span class="today-dial__count"><b>${countdown(next.time, now)}</b></span>
        <span class="today-dial__at">${esc(formatTime(next.time, settings))}</span>
      </div>
    </div>
  </section>`;
}
