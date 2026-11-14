import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../core/state.js';
import { getPrayerTimes, nextPrayer, getNightTimes, getCurrentNight } from '../core/prayer.js';
import { dotAngles, nightAngles } from '../core/dial.js';
import { prayerLocation } from './prayer-view.js';
import {
  arcPath, labelLayout, ringLabels, labelBox, dialHtml, countdown,
} from './prayer-dial.js';

const settings = DEFAULT_STATE.settings; // Cairo
const loc = prayerLocation(settings);

function htmlAt(iso) {
  const now = new Date(iso);
  const times = getPrayerTimes(now, loc);
  return dialHtml(times, nextPrayer(now, loc), now, settings, {
    timeZone: loc.timeZone, nextFajr: getNightTimes(now, loc).fajr, night: getCurrentNight(now, loc),
  });
}

describe('prayer dial', () => {
  it('formats the countdown', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    expect(countdown(new Date('2026-11-14T11:12:00Z'), now)).toBe('in 1 h 12 min');
    expect(countdown(new Date('2026-11-14T10:12:00Z'), now)).toBe('in 12 min');
    expect(countdown(now, now)).toBe('now');
  });

  it('uses the large-arc flag only for sweeps over half the ring', () => {
    expect(arcPath(90, 180)).toMatch(/ 0 0 1 /);
    expect(arcPath(285, 435)).toMatch(/ 0 0 1 /);
    expect(arcPath(200, 430)).toMatch(/ 0 1 1 /);
  });

  it('keeps stacked labels apart', () => {
    // Fajr and Shurooq almost on top of each other on the right side.
    const labels = labelLayout({ fajr: 88, sunrise: 92, dhuhr: 180, asr: 225, maghrib: 265, isha: 268 });
    const y = Object.fromEntries(labels.map((l) => [l.key, l.y]));
    expect(Math.abs(y.sunrise - y.fajr)).toBeGreaterThanOrEqual(12.9);
    expect(Math.abs(y.isha - y.maghrib)).toBeGreaterThanOrEqual(12.9);
  });

  it('draws six dots, their labels and the Duha window mid-morning', () => {
    const html = htmlAt('2026-11-14T08:00:00Z'); // 10:00 in Cairo
    expect(html.match(/today-dial__dot[ "]/g)).toHaveLength(6);
    expect(html.match(/<text /g)).toHaveLength(8); // six prayers + two night labels
    expect(html).toContain('data-window="duha"');
    expect(html).toContain('Shurooq');
    expect(html).toMatch(/role="img" aria-label="Current time: Duha, from Shurooq until Dhuhr\. Next prayer: Dhuhr in /);
  });

  it('marks the middle of the night and the last third on the ring, name then time', () => {
    const html = htmlAt('2026-11-14T08:00:00Z'); // 10:00 in Cairo: tonight's night
    expect(html.match(/class="today-dial__night[ "]/g)).toHaveLength(2);
    expect(html).toMatch(/data-night="middle"/);
    expect(html).toMatch(/today-dial__night--best" data-night="lastThird"/);
    expect(html).toMatch(/data-night-label="middle"[^>]*><tspan[^>]*>Middle of the night<\/tspan><tspan[^>]*>10:54\sPM<\/tspan>/);
    expect(html).toMatch(/data-night-label="lastThird"[^>]*><tspan[^>]*>Last third<\/tspan><tspan[^>]*>12:53\sAM<\/tspan>/);
    expect(html).toMatch(/aria-label="[^"]*Middle of the night: 10:54\sPM\. Last third of the night, the best time for tahajjud and dua, from 12:53\sAM\."/);
  });

  it('before Fajr shows the night we are in (it began yesterday)', () => {
    const before = htmlAt('2026-11-14T00:30:00Z'); // 02:30 in Cairo, before Fajr
    const eve = htmlAt('2026-11-13T19:00:00Z'); // 21:00 the evening before: same night
    const pick = (html) => html.match(/<text class="today-dial__label today-dial__label--night.*?<\/text>/g).join('');
    expect(pick(before)).toBe(pick(eve));
  });

  it('has no night markers when the night is unknown', () => {
    const now = new Date('2026-11-14T08:00:00Z');
    const html = dialHtml(getPrayerTimes(now, loc), nextPrayer(now, loc), now, settings, { timeZone: loc.timeZone });
    expect(html).not.toContain('today-dial__night');
    expect(html.match(/<text /g)).toHaveLength(6);
    expect(html).not.toContain('tahajjud');
  });

  it('keeps every label clear of the night labels, all year, in several places', () => {
    const places = [
      loc,
      { lat: 21.42, lng: 39.83, timeZone: 'Asia/Riyadh' },
      { lat: 51.5, lng: -0.12, timeZone: 'Europe/London' },
      { lat: 40.4, lng: -3.7, timeZone: 'Europe/Madrid' },
      { lat: -6.2, lng: 106.8, timeZone: 'Asia/Jakarta' },
    ];
    const hit = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
    for (const place of places) {
      for (let d = 0; d < 365; d += 5) {
        const now = new Date(Date.UTC(2026, 0, 1 + d, 12));
        const times = getPrayerTimes(now, place);
        if (Object.values(times).some((t) => Number.isNaN(t.getTime()))) continue;
        const labels = ringLabels(
          dotAngles(times, place.timeZone), nightAngles(getCurrentNight(now, place), place.timeZone),
        );
        expect(labels).toHaveLength(8);
        const [mid, last] = labels.filter((l) => l.night).map(labelBox);
        for (const box of [mid, last]) {
          expect(box.x1).toBeGreaterThanOrEqual(0);
          expect(box.x2).toBeLessThanOrEqual(340);
          expect(box.y1).toBeGreaterThanOrEqual(4);
        }
        expect(hit(mid, last)).toBe(false);
        for (const p of labels.filter((l) => !l.night).map(labelBox)) {
          expect(hit(p, mid)).toBe(false);
          expect(hit(p, last)).toBe(false);
        }
      }
    }
  });

  it('moves a prayer label out of the way of a night label', () => {
    // Isha right under where the middle-of-the-night label is written.
    const dots = { fajr: 70, sunrise: 92, dhuhr: 180, asr: 225, maghrib: 265, isha: 328 };
    const labels = ringLabels(dots, { middle: 345, lastThird: 12 });
    const box = Object.fromEntries(labels.map((l) => [l.key, labelBox(l)]));
    expect(box.isha.y1).toBeGreaterThanOrEqual(box.middle.y2);
    expect(box.middle.x2).toBeLessThan(box.lastThird.x1);
  });

  it('shows the Isha window across midnight, before Fajr', () => {
    const html = htmlAt('2026-11-14T00:30:00Z'); // 02:30 in Cairo
    expect(html).toContain('data-window="isha"');
    expect(html).toMatch(/Current time: Isha, until Fajr\. Next prayer: Fajr in /);
    expect(html).toMatch(/data-dot="isha"/);
  });
});
