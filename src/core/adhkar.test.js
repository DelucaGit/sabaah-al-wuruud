import { describe, it, expect } from 'vitest';
import { orderAdhkar, togglePin, hasCounter, increment, reset, readTarget, isRead, sectionProgress } from './adhkar.js';

// Fixtures in the same shape as src/data/adhkar/*.json: { id, arabic, repeat, virtue?, source? }
const morning = [
  { id: 'morning-01', arabic: 'أَعُوذُ بِاللَّهِ', repeat: 1, source: 'مصدر' },
  { id: 'morning-02', arabic: 'سُورَةُ الْإِخْلَاصِ', repeat: 3 },
  { id: 'morning-03', arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ', repeat: 1, virtue: 'فضل' },
  { id: 'morning-04', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', repeat: 100 },
  { id: 'morning-05', arabic: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي', repeat: 3 },
];
const ids = (list) => list.map((d) => d.id);

describe('orderAdhkar', () => {
  it('puts pinned adhkar first and keeps book order in both groups', () => {
    const { pinned, rest } = orderAdhkar(morning, ['morning-04', 'morning-02']);
    expect(ids(pinned)).toEqual(['morning-02', 'morning-04']);
    expect(ids(rest)).toEqual(['morning-01', 'morning-03', 'morning-05']);
  });

  it('returns everything in rest when nothing is pinned', () => {
    const { pinned, rest } = orderAdhkar(morning, []);
    expect(pinned).toEqual([]);
    expect(ids(rest)).toEqual(ids(morning));
  });

  it('ignores unknown pinned IDs', () => {
    const { pinned, rest } = orderAdhkar(morning, ['evening-01', 'morning-03', 'nope']);
    expect(ids(pinned)).toEqual(['morning-03']);
    expect(rest).toHaveLength(4);
  });

  it('returns the original dhikr objects and does not mutate the input', () => {
    const copy = structuredClone(morning);
    const { pinned } = orderAdhkar(morning, ['morning-01']);
    expect(pinned[0]).toBe(morning[0]);
    expect(morning).toEqual(copy);
  });
});

describe('togglePin', () => {
  it('adds an id that is not pinned', () => {
    expect(togglePin(['morning-01'], 'morning-03')).toEqual(['morning-01', 'morning-03']);
  });

  it('removes an id that is pinned', () => {
    expect(togglePin(['morning-01', 'morning-03'], 'morning-01')).toEqual(['morning-03']);
  });

  it('returns a new array and leaves the input untouched', () => {
    const input = ['morning-01'];
    const result = togglePin(input, 'morning-02');
    expect(result).not.toBe(input);
    expect(input).toEqual(['morning-01']);
    const removed = togglePin(input, 'morning-01');
    expect(removed).not.toBe(input);
    expect(input).toEqual(['morning-01']);
  });

  it('round-trips back to the original list', () => {
    expect(togglePin(togglePin(['a'], 'b'), 'b')).toEqual(['a']);
  });
});

describe('hasCounter', () => {
  it('is true only when repeat is exactly 100', () => {
    expect(hasCounter(morning[3])).toBe(true);
    for (const repeat of [1, 3, 4, 7, 10, 99, 101]) {
      expect(hasCounter({ id: 'x', arabic: '', repeat })).toBe(false);
    }
  });
});

describe('increment', () => {
  it('adds one per tap', () => {
    expect(increment(0, 100)).toEqual({ value: 1, reachedTarget: false });
    expect(increment(41, 100)).toEqual({ value: 42, reachedTarget: false });
  });

  it('reports reachedTarget only on the tap that hits the target', () => {
    expect(increment(99, 100)).toEqual({ value: 100, reachedTarget: true });
  });

  it('never goes past the target and does not report it again', () => {
    expect(increment(100, 100)).toEqual({ value: 100, reachedTarget: false });
    expect(increment(150, 100)).toEqual({ value: 100, reachedTarget: false });
  });

  it('fires reachedTarget exactly once when counting from 0 to the target and beyond', () => {
    let value = reset();
    let hits = 0;
    for (let i = 0; i < 120; i++) {
      const result = increment(value, 100);
      value = result.value;
      if (result.reachedTarget) hits++;
    }
    expect(value).toBe(100);
    expect(hits).toBe(1);
  });
});

describe('reset', () => {
  it('returns 0', () => {
    expect(reset()).toBe(0);
  });
});

describe('read progress', () => {
  const list = [
    { id: 'a', repeat: 1 },
    { id: 'b', repeat: 3 },
    { id: 'c', repeat: 100 },
  ];

  it('needs 100 taps for the counter adhkar and 1 for the rest', () => {
    expect(list.map(readTarget)).toEqual([1, 1, 100]);
  });

  it('treats a dhikr as read once its count reaches the target', () => {
    expect(isRead(list[1], {})).toBe(false);
    expect(isRead(list[1], { b: 1 })).toBe(true);
    expect(isRead(list[2], { c: 99 })).toBe(false);
    expect(isRead(list[2], { c: 100 })).toBe(true);
    expect(isRead(list[0], undefined)).toBe(false);
  });

  it('summarises a section', () => {
    expect(sectionProgress(list, {})).toEqual({ read: 0, total: 3, fraction: 0, all: false });
    expect(sectionProgress(list, { a: 1, c: 40 })).toEqual({ read: 1, total: 3, fraction: 1 / 3, all: false });
    expect(sectionProgress(list, { a: 1, b: 1, c: 100 })).toEqual({ read: 3, total: 3, fraction: 1, all: true });
  });

  it('is never complete for an empty section', () => {
    expect(sectionProgress([], {})).toEqual({ read: 0, total: 0, fraction: 0, all: false });
  });
});
