// Metadata for the five adhkar sections, shared by Today, Adhkar home and
// the reader. `adhkar` is the full list for the section in book order.
import morning from '../data/adhkar/morning.json';
import evening from '../data/adhkar/evening.json';
import sleep from '../data/adhkar/sleep.json';
import home from '../data/adhkar/home.json';
import travel from '../data/adhkar/travel.json';

/**
 * @typedef {object} Section
 * @property {'morning'|'evening'|'sleep'|'home'|'travel'} key  Also the key in state.pins / state.daily.done.
 * @property {string} title  Full name, e.g. "Morning Adhkar".
 * @property {string} short  One word, e.g. "Morning".
 * @property {string} icon   Name for kit.js icon().
 * @property {string} when   When it is read, e.g. "After Fajr".
 * @property {object[]} adhkar  The section's adhkar (see src/data/adhkar/*.json).
 */

/** @type {Readonly<Record<'morning'|'evening'|'sleep'|'home'|'travel', Section>>} */
export const SECTIONS = Object.freeze({
  morning: { key: 'morning', title: 'Morning Adhkar', short: 'Morning', icon: 'sun', when: 'After Fajr', adhkar: morning },
  evening: { key: 'evening', title: 'Evening Adhkar', short: 'Evening', icon: 'sunset', when: 'After Asr', adhkar: evening },
  sleep: { key: 'sleep', title: 'Before Sleep', short: 'Sleep', icon: 'moon', when: 'At bedtime', adhkar: sleep },
  home: { key: 'home', title: 'Home', short: 'Home', icon: 'home', when: 'Leaving and entering', adhkar: home },
  travel: { key: 'travel', title: 'Travel', short: 'Travel', icon: 'pin', when: 'On a journey', adhkar: travel },
});

/** Section keys in display order. */
export const SECTION_KEYS = Object.freeze(['morning', 'evening', 'sleep', 'home', 'travel']);

/**
 * Router path of a section's reader, for navigate() (prefix '#' for an href).
 * @param {'morning'|'evening'|'sleep'|'home'|'travel'} key
 * @returns {string} e.g. '/adhkar/morning'
 */
export function sectionPath(key) {
  return `/adhkar/${key}`;
}
