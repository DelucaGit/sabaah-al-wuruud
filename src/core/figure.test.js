import { describe, it, expect } from 'vitest';
import { WALK_MS, SIT_MS, ENTRANCE_MS, figurePhase, catchUpTime } from './figure.js';

describe('figure entrance', () => {
  it('lasts as long as the walk plus the sit', () => {
    expect(ENTRANCE_MS).toBe(WALK_MS + SIT_MS);
  });

  it('waits until first shown, enters once, then stays seated', () => {
    expect(figurePhase(null, 5_000)).toBe('waiting');
    expect(figurePhase(1_000, 1_000)).toBe('entering');
    expect(figurePhase(1_000, 1_000 + ENTRANCE_MS - 1)).toBe('entering');
    expect(figurePhase(1_000, 1_000 + ENTRANCE_MS)).toBe('seated');
    // A repaint 30 s later (or any later scene change) never replays the walk.
    expect(figurePhase(1_000, 31_000)).toBe('seated');
  });

  it('is seated at once with reduced motion', () => {
    expect(figurePhase(null, 0, true)).toBe('seated');
    expect(figurePhase(1_000, 1_200, true)).toBe('seated');
  });

  it('moves a restarted animation forward, and leaves a running one alone', () => {
    expect(catchUpTime(0, 2_000)).toBe(2_000); // restarted by a repaint
    expect(catchUpTime(1_960, 2_000)).toBeNull(); // still in step
    expect(catchUpTime(2_100, 2_000)).toBeNull(); // never rewinds
    expect(catchUpTime(null, 2_000)).toBeNull(); // not started yet
  });
});
