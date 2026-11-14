import { describe, it, expect } from 'vitest';
import { esc, icon, ring, ICON_NAMES } from './kit.js';
import { TABS } from '../router.js';
import { SECTIONS, SECTION_KEYS, sectionPath } from './sections.js';

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });
  it('leaves plain and Arabic text alone', () => {
    expect(esc('Aisha سبحان الله')).toBe('Aisha سبحان الله');
  });
  it('turns null and undefined into an empty string and stringifies numbers', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(7)).toBe('7');
  });
});

describe('icon', () => {
  it('has every icon the spec asks for', () => {
    for (const name of ['sun', 'sunset', 'moon', 'bed', 'book', 'user', 'star', 'star-filled',
      'check', 'chevron', 'back', 'reset', 'plus', 'minus', 'sparkle']) {
      expect(ICON_NAMES).toContain(name);
    }
  });
  it('returns a decorative inline svg', () => {
    for (const name of ICON_NAMES) {
      expect(icon(name)).toMatch(/^<svg class="icon"[^>]*aria-hidden="true"[^>]*>.+<\/svg>$/);
    }
  });
  it('fills only the filled star', () => {
    expect(icon('star-filled')).toContain('fill="currentColor"');
    expect(icon('star')).toContain('fill="none"');
  });
  it('returns an empty string for unknown names', () => {
    expect(icon('nope')).toBe('');
    expect(icon('toString')).toBe('');
  });
  it('covers the tab bar and section icons', () => {
    for (const t of TABS) expect(ICON_NAMES).toContain(t.icon);
    for (const key of SECTION_KEYS) expect(ICON_NAMES).toContain(SECTIONS[key].icon);
  });
});

describe('ring', () => {
  const offset = (html) => Number(html.match(/stroke-dashoffset="([^"]+)"/)[1]);
  const length = (html) => Number(html.match(/stroke-dasharray="([^"]+)"/)[1]);

  it('draws an svg of the given size', () => {
    expect(ring(0.5, 46, 4)).toContain('width="46" height="46" viewBox="0 0 46 46"');
    expect(ring(0.5, 46, 4)).toContain('r="21"');
  });
  it('is empty at 0, half at 0.5 and full at 1', () => {
    const c = length(ring(0, 46, 4));
    expect(c).toBeCloseTo(2 * Math.PI * 21, 2);
    expect(offset(ring(0, 46, 4))).toBeCloseTo(c, 2);
    expect(offset(ring(0.5, 46, 4))).toBeCloseTo(c / 2, 2);
    expect(offset(ring(1, 46, 4))).toBe(0);
  });
  it('clamps out-of-range and invalid fractions', () => {
    expect(offset(ring(3, 46, 4))).toBe(0);
    expect(offset(ring(-1, 46, 4))).toBe(length(ring(-1, 46, 4)));
    expect(offset(ring(NaN, 46, 4))).toBe(length(ring(NaN, 46, 4)));
  });
});

describe('sections', () => {
  it('describes the five sections with their adhkar', () => {
    expect(SECTION_KEYS).toEqual(['morning', 'evening', 'sleep', 'home', 'travel']);
    for (const key of SECTION_KEYS) {
      const s = SECTIONS[key];
      expect(s.key).toBe(key);
      for (const field of ['title', 'short', 'icon', 'when']) expect(s[field]).toBeTruthy();
      expect(s.adhkar.length).toBeGreaterThan(0);
    }
  });
  it('builds the reader path', () => {
    expect(sectionPath('morning')).toBe('/adhkar/morning');
  });
});
