import { describe, it, expect } from 'vitest';
import { createPull, pullDistance, MAX_PULL, THRESHOLD } from './pull.js';

const FAR = THRESHOLD * 2 + 2; // finger travel that arms the refresh

describe('pull to refresh', () => {
  it('refreshes after a long enough pull from the top', () => {
    const p = createPull();
    p.start(100, 100, true);
    expect(p.move(100, 100 + FAR)).toMatchObject({ pulling: true, armed: true });
    expect(p.end()).toBe(true);
  });

  it('does not refresh after a short pull', () => {
    const p = createPull();
    p.start(100, 100, true);
    expect(p.move(100, 140)).toMatchObject({ pulling: true, armed: false });
    expect(p.end()).toBe(false);
  });

  it('does nothing when the page is scrolled down', () => {
    const p = createPull();
    p.start(100, 100, false);
    expect(p.move(100, 100 + FAR).pulling).toBe(false);
    expect(p.end()).toBe(false);
  });

  it('ignores movement below the slop', () => {
    const p = createPull();
    p.start(100, 100, true);
    expect(p.move(102, 103).pulling).toBe(false);
  });

  it('stays a swipe after moving sideways first', () => {
    const p = createPull();
    p.start(100, 100, true);
    expect(p.move(130, 110).pulling).toBe(false);
    expect(p.move(130, 100 + FAR).pulling).toBe(false);
    expect(p.end()).toBe(false);
  });

  it('stays a scroll after moving up first', () => {
    const p = createPull();
    p.start(100, 300, true);
    p.move(100, 280);
    expect(p.move(100, 300 + FAR).pulling).toBe(false);
  });

  it('can be taken back by moving up again before letting go', () => {
    const p = createPull();
    p.start(100, 100, true);
    p.move(100, 100 + FAR);
    expect(p.move(100, 90)).toEqual({ pulling: true, distance: 0, armed: false });
    expect(p.end()).toBe(false);
  });

  it('does not refresh when cancelled, and starts clean afterwards', () => {
    const p = createPull();
    p.start(100, 100, true);
    p.move(100, 100 + FAR);
    p.cancel();
    expect(p.end()).toBe(false);
    p.start(100, 100, true);
    expect(p.end()).toBe(false);
  });

  it('limits the travel', () => {
    expect(pullDistance(-50)).toBe(0);
    expect(pullDistance(5000)).toBe(MAX_PULL);
  });
});
