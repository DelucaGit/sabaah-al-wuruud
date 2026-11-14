import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import data from './encouragement.json';
import { SOURCE, GROUPS, buildJson } from '../../../scripts/build-encouragement.mjs';

const all = GROUPS.flatMap((g) => data[g] ?? []);

describe('encouragement messages', () => {
  it('has exactly the three groups, each non-empty', () => {
    expect(Object.keys(data).sort()).toEqual([...GROUPS].sort());
    for (const g of GROUPS) {
      expect(Array.isArray(data[g])).toBe(true);
      expect(data[g].length).toBeGreaterThan(0);
    }
  });

  it('every item has an id and non-empty text', () => {
    for (const m of all) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(m.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('ids are unique across all groups', () => {
    const ids = all.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains no Arabic script', () => {
    const arabic = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
    for (const m of all) expect(m.text, m.id).not.toMatch(arabic);
  });

  it('contains no words for verse or hadith', () => {
    const banned = /\b(vers|verser|versen|verserna|verse|verses|ayah?|ayat|aya|sura|surah|hadith|hadither|hadeeth|hadis)\b/i;
    for (const m of all) expect(m.text, m.id).not.toMatch(banned);
  });

  it('{name} is the only brace pattern', () => {
    for (const m of all) {
      const stripped = m.text.replaceAll('{name}', '');
      expect(stripped, m.id).not.toMatch(/[{}]/);
    }
  });

  it('uses {name} in some but not all messages', () => {
    const withName = all.filter((m) => m.text.includes('{name}')).length;
    expect(withName).toBeGreaterThan(0);
    expect(withName).toBeLessThan(all.length);
  });

  it('JSON is up to date with docs/encouragement-messages.md', () => {
    const md = readFileSync(SOURCE, 'utf8');
    expect(JSON.parse(buildJson(md))).toEqual(data);
  });
});
