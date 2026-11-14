import { describe, it, expect } from 'vitest';
import {
  SCENES, FALLBACK_SCENE, SCENE_TONE, isScene, sceneFor, sceneTone, sceneOverride,
} from './scene.js';

const at = (h, m = 0) => new Date(2026, 10, 14, h, m);
const times = {
  fajr: at(5), sunrise: at(6, 30), dhuhr: at(12), asr: at(15), maghrib: at(17, 30), isha: at(19),
};

describe('scene', () => {
  it('has six scenes, each with a tone', () => {
    expect(SCENES).toEqual(['fajr', 'duha', 'dhuhr', 'asr', 'maghrib', 'isha']);
    for (const scene of SCENES) expect(['dark', 'light']).toContain(SCENE_TONE[scene]);
  });

  it.each([
    [at(3), 'isha'],
    [at(5), 'fajr'],
    [at(6, 29), 'fajr'],
    [at(6, 30), 'duha'],
    [at(11, 59), 'duha'],
    [at(12), 'dhuhr'],
    [at(15, 1), 'asr'],
    [at(17, 30), 'maghrib'],
    [at(19), 'isha'],
    [at(23, 59), 'isha'],
  ])('picks the scene of the active window (%s -> %s)', (now, scene) => {
    expect(sceneFor(times, now)).toBe(scene);
  });

  it('falls back when the times are missing', () => {
    expect(sceneFor(null, at(12))).toBe(FALLBACK_SCENE);
    expect(isScene(FALLBACK_SCENE)).toBe(true);
  });

  it('night scenes are dark, day scenes are light', () => {
    expect(sceneTone('fajr')).toBe('dark');
    expect(sceneTone('maghrib')).toBe('dark');
    expect(sceneTone('isha')).toBe('dark');
    expect(sceneTone('duha')).toBe('light');
    expect(sceneTone('dhuhr')).toBe('light');
    expect(sceneTone('asr')).toBe('light');
    expect(sceneTone('nope')).toBe(sceneTone(FALLBACK_SCENE));
  });

  it('reads a debug override from the query string', () => {
    expect(sceneOverride('?scene=maghrib')).toBe('maghrib');
    expect(sceneOverride('?x=1&scene=ISHA')).toBe('isha');
    expect(sceneOverride('?scene=noon')).toBeNull();
    expect(sceneOverride('')).toBeNull();
    expect(sceneOverride()).toBeNull();
  });

  it('isScene rejects non-scenes', () => {
    expect(isScene('duha')).toBe(true);
    expect(isScene('sunrise')).toBe(false);
    expect(isScene(null)).toBe(false);
  });
});
