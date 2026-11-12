// View helpers around the core prayer module: which location to use, how to
// show a time, and today's five prayers.
import { DEFAULT_STATE } from '../core/state.js';
import { getPrayerTimes } from '../core/prayer.js';

/** The five daily prayers, in order (no sunrise). */
export const PRAYER_KEYS = Object.freeze(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);

/** English display names. Includes `sunrise` for callers that show it. */
export const PRAYER_LABELS = Object.freeze({
  fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
});

/**
 * The location to pass to the core prayer functions. The default Cairo
 * location is pinned to Cairo's time zone; any other location uses the
 * device's time zone.
 * @param {{ location: { name: string, lat: number, lng: number } }} settings  state.settings
 * @returns {{ name: string, lat: number, lng: number, timeZone?: string }}
 */
export function prayerLocation(settings) {
  const loc = settings.location;
  const def = DEFAULT_STATE.settings.location;
  const isDefaultCairo = loc.lat === def.lat && loc.lng === def.lng;
  return isDefaultCairo ? { ...loc, timeZone: 'Africa/Cairo' } : { ...loc };
}

/**
 * Formats a time like "5:04 AM" in the prayer location's time zone.
 * @param {Date} date
 * @param {{ location: object }} [settings]  state.settings; without it the
 *   device's time zone is used.
 * @returns {string}
 */
export function formatTime(date, settings) {
  const timeZone = settings ? prayerLocation(settings).timeZone : undefined;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/**
 * Today's prayer times for the location in settings.
 * @param {{ location: object }} settings  state.settings
 * @param {Date} [now]
 * @returns {{ fajr: Date, sunrise: Date, dhuhr: Date, asr: Date, maghrib: Date, isha: Date } | null}
 *   null when the times cannot be calculated (e.g. extreme latitudes).
 */
export function todayPrayerTimes(settings, now = new Date()) {
  try {
    return getPrayerTimes(now, prayerLocation(settings));
  } catch {
    return null;
  }
}
