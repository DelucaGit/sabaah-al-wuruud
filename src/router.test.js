import { describe, it, expect } from 'vitest';
import { resolve, TABS } from './router.js';

describe('resolve', () => {
  it.each([
    ['#/', 'today', 'today', {}],
    ['', 'today', 'today', {}],
    ['#/adhkar', 'adhkar-home', 'adhkar', {}],
    ['#/quran', 'quran', 'quran', {}],
    ['#/settings', 'settings', 'me', {}],
    ['#/adhkar/morning', 'reader', null, { section: 'morning' }],
    ['#/adhkar/evening', 'reader', null, { section: 'evening' }],
    ['#/adhkar/sleep', 'reader', null, { section: 'sleep' }],
    ['#/adhkar/home', 'reader', null, { section: 'home' }],
    ['#/adhkar/travel', 'reader', null, { section: 'travel' }],
    ['#/istikhara', 'istikhara', null, {}],
  ])('%s -> %s', (hash, name, tab, params) => {
    const route = resolve(hash);
    expect(route.name).toBe(name);
    expect(route.tab).toBe(tab);
    expect(route.params).toEqual(params);
    expect(typeof route.screen.render).toBe('function');
  });

  it.each(['#/nope', '#/adhkar/unknown', '#/adhkar/morning/extra', '#/istikhara/x', '#/settings/x', undefined])(
    'sends unknown route %s to today', (hash) => {
      const route = resolve(hash);
      expect(route.name).toBe('today');
      expect(route.tab).toBe('today');
    });

  it('gives every route its own screen module', () => {
    const hashes = ['#/', '#/adhkar', '#/quran', '#/settings', '#/adhkar/morning', '#/istikhara'];
    expect(new Set(hashes.map((h) => resolve(h).screen)).size).toBe(6);
  });

  it('every tab path resolves to that tab', () => {
    for (const t of TABS) expect(resolve(`#${t.path}`).tab).toBe(t.key);
  });
});
