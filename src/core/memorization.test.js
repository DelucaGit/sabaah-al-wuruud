import { describe, it, expect } from 'vitest';
import {
  TOTAL_PAGES,
  markNextPage,
  setMemorizedUpTo,
  nextPageLabel,
  pickReflectionVerse,
} from './memorization.js';

// Small fixture in the shape of pages.json: pages[0] is page 1.
const pages = [
  [
    { s: 1, a: 1, text: 'p1-a' },
    { s: 1, a: 2, text: 'p1-b' },
  ],
  [
    { s: 2, a: 1, text: 'p2-a' },
    { s: 2, a: 2, text: 'p2-b' },
    { s: 2, a: 3, text: 'p2-c' },
    { s: 2, a: 4, text: 'p2-d' },
  ],
  [{ s: 2, a: 5, text: 'p3-only' }],
];

describe('markNextPage', () => {
  it('advances from nothing memorized to page 1', () => {
    expect(markNextPage({ memorizedUpTo: 0 })).toBe(1);
  });

  it('advances by one page', () => {
    expect(markNextPage({ memorizedUpTo: 41 })).toBe(42);
  });

  it('caps at 604', () => {
    expect(markNextPage({ memorizedUpTo: 603 })).toBe(604);
    expect(markNextPage({ memorizedUpTo: 604 })).toBe(604);
  });
});

describe('setMemorizedUpTo', () => {
  const progress = { memorizedUpTo: 10 };

  it('accepts values inside the range', () => {
    expect(setMemorizedUpTo(progress, 0)).toBe(0);
    expect(setMemorizedUpTo(progress, 300)).toBe(300);
    expect(setMemorizedUpTo(progress, 604)).toBe(604);
  });

  it('clamps values outside 0–604', () => {
    expect(setMemorizedUpTo(progress, -5)).toBe(0);
    expect(setMemorizedUpTo(progress, 605)).toBe(TOTAL_PAGES);
    expect(setMemorizedUpTo(progress, 10000)).toBe(604);
  });

  it('returns an integer', () => {
    expect(setMemorizedUpTo(progress, 12.7)).toBe(12);
    expect(setMemorizedUpTo(progress, '25')).toBe(25);
  });

  it('treats invalid input as 0', () => {
    expect(setMemorizedUpTo(progress, NaN)).toBe(0);
    expect(setMemorizedUpTo(progress, 'abc')).toBe(0);
  });
});

describe('nextPageLabel', () => {
  it('is page 1 when nothing is memorized', () => {
    expect(nextPageLabel({ memorizedUpTo: 0 })).toBe(1);
  });

  it('is the page after memorizedUpTo', () => {
    expect(nextPageLabel({ memorizedUpTo: 603 })).toBe(604);
  });

  it('is null when all 604 pages are done', () => {
    expect(nextPageLabel({ memorizedUpTo: 604 })).toBeNull();
  });
});

describe('pickReflectionVerse', () => {
  it('is null when nothing is memorized', () => {
    expect(pickReflectionVerse({ memorizedUpTo: 0 }, pages, () => 0.5)).toBeNull();
  });

  it('is null when the page has no ayahs', () => {
    expect(pickReflectionVerse({ memorizedUpTo: 4 }, pages, () => 0)).toBeNull();
  });

  it('picks from page memorizedUpTo with a stubbed rng', () => {
    const progress = { memorizedUpTo: 2 };
    expect(pickReflectionVerse(progress, pages, () => 0)).toEqual({
      s: 2, a: 1, text: 'p2-a', page: 2,
    });
    expect(pickReflectionVerse(progress, pages, () => 0.5)).toEqual({
      s: 2, a: 3, text: 'p2-c', page: 2,
    });
    expect(pickReflectionVerse(progress, pages, () => 0.999)).toEqual({
      s: 2, a: 4, text: 'p2-d', page: 2,
    });
  });

  it('returns the only ayah on a single-ayah page', () => {
    for (const r of [0, 0.5, 0.999]) {
      expect(pickReflectionVerse({ memorizedUpTo: 3 }, pages, () => r)).toEqual({
        s: 2, a: 5, text: 'p3-only', page: 3,
      });
    }
  });

  it('can reach every ayah on the page', () => {
    const progress = { memorizedUpTo: 2 };
    const seen = new Set(
      [0, 0.25, 0.5, 0.75].map((r) => pickReflectionVerse(progress, pages, () => r).a),
    );
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });
});
