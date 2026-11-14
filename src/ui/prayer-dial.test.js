import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../core/state.js';
import { getPrayerTimes, nextPrayer, getNightTimes } from '../core/prayer.js';
import { prayerLocation } from './prayer-view.js';
import { arcPath, labelLayout, dialHtml, countdown } from './prayer-dial.js';

const settings = DEFAULT_STATE.settings; // Cairo
const loc = prayerLocation(settings);

function htmlAt(iso) {
  const now = new Date(iso);
  const times = getPrayerTimes(now, loc);
  return dialHtml(times, nextPrayer(now, loc), now, settings, {
    timeZone: loc.timeZone, nextFajr: getNightTimes(now, loc).fajr,
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

  it('draws six dots, six labels and the Duha window mid-morning', () => {
    const html = htmlAt('2026-11-14T08:00:00Z'); // 10:00 in Cairo
    expect(html.match(/today-dial__dot[ "]/g)).toHaveLength(6);
    expect(html.match(/<text /g)).toHaveLength(6);
    expect(html).toContain('data-window="duha"');
    expect(html).toContain('Shurooq');
    expect(html).toMatch(/role="img" aria-label="Current time: Duha, from Shurooq until Dhuhr\. Next prayer: Dhuhr in /);
  });

  it('shows the Isha window across midnight, before Fajr', () => {
    const html = htmlAt('2026-11-14T00:30:00Z'); // 02:30 in Cairo
    expect(html).toContain('data-window="isha"');
    expect(html).toMatch(/Current time: Isha, until Fajr\. Next prayer: Fajr in /);
    expect(html).toMatch(/data-dot="isha"/);
  });
});
