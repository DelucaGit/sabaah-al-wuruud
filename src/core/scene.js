// Time-of-day scene behind the prayer dial (pure, no DOM).
//
// There is one scene per dial window (see WINDOW_KEYS in ./dial.js), so the
// scene name IS the window key: 'fajr' | 'duha' | 'dhuhr' | 'asr' | 'maghrib'
// | 'isha'.
import { WINDOW_KEYS, currentWindow } from './dial.js';

/** The six scene names, in day order. */
export const SCENES = WINDOW_KEYS;

/** Scene shown when the prayer times cannot be calculated. */
export const FALLBACK_SCENE = 'dhuhr';

/**
 * Whether a scene is dark (light text on top) or light (dark text on top).
 * The same in the light and the dark app theme.
 */
export const SCENE_TONE = Object.freeze({
  fajr: 'dark', duha: 'light', dhuhr: 'light', asr: 'light', maghrib: 'dark', isha: 'dark',
});

/** @param {unknown} name @returns {boolean} */
export function isScene(name) {
  return typeof name === 'string' && SCENES.includes(name);
}

/**
 * The scene for an instant: the active dial window, or the fallback when the
 * times are missing.
 * @param {object|null} times  getPrayerTimes(now, location), or null
 * @param {Date} now
 * @returns {'fajr'|'duha'|'dhuhr'|'asr'|'maghrib'|'isha'}
 */
export function sceneFor(times, now) {
  return times ? currentWindow(times, now) : FALLBACK_SCENE;
}

/**
 * @param {string} scene
 * @returns {'dark'|'light'}
 */
export function sceneTone(scene) {
  return SCENE_TONE[scene] ?? SCENE_TONE[FALLBACK_SCENE];
}

/**
 * Debug override from the page's query string: "?scene=maghrib" forces that
 * scene. Returns null when absent or not a scene name.
 * @param {string} [search]  location.search
 * @returns {string|null}
 */
export function sceneOverride(search = '') {
  const name = new URLSearchParams(search).get('scene')?.toLowerCase();
  return isScene(name) ? name : null;
}
