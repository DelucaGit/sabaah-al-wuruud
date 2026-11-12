// Shape and integrity checks for the generated Quran data
// (scripts/build-quran-data.mjs). These do not prove the text is correct —
// that needs a human check against a mushaf — but they catch a broken or
// truncated regeneration.
import { describe, it, expect } from 'vitest';
import pages from './pages.json';
import surahs from './surahs.json';
import tafsir from './tafsir-muyassar.json';

const TOTAL_PAGES = 604;
const TOTAL_AYAHS = 6236;
const allAyahs = pages.flat();
const key = ({ s, a }) => `${s}:${a}`;
const pageOf = (s, a) => pages.findIndex((p) => p.some((x) => x.s === s && x.a === a)) + 1;
const range = (s, from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ s, a: from + i }));

describe('pages.json', () => {
  it('has 604 non-empty pages', () => {
    expect(pages).toHaveLength(TOTAL_PAGES);
    for (const page of pages) {
      expect(Array.isArray(page)).toBe(true);
      expect(page.length).toBeGreaterThan(0);
    }
  });

  it('has 6236 ayahs in total, each shaped { s, a, text } with non-empty text', () => {
    expect(allAyahs).toHaveLength(TOTAL_AYAHS);
    for (const ayah of allAyahs) {
      expect(Object.keys(ayah).sort()).toEqual(['a', 's', 'text']);
      expect(Number.isInteger(ayah.s)).toBe(true);
      expect(Number.isInteger(ayah.a)).toBe(true);
      expect(typeof ayah.text).toBe('string');
      expect(ayah.text.trim()).not.toBe('');
    }
  });

  it('puts every ayah on exactly one page, in mushaf order', () => {
    // Each ayah follows the previous one: next ayah of the same surah, or
    // ayah 1 of the next surah. With the total of 6236 this rules out gaps,
    // duplicates and reordering across page boundaries.
    expect(key(allAyahs[0])).toBe('1:1');
    for (let i = 1; i < allAyahs.length; i++) {
      const prev = allAyahs[i - 1];
      const cur = allAyahs[i];
      const ok = (cur.s === prev.s && cur.a === prev.a + 1) || (cur.s === prev.s + 1 && cur.a === 1);
      expect(ok, `${key(prev)} -> ${key(cur)}`).toBe(true);
    }
    expect(key(allAyahs.at(-1))).toBe('114:6');
    expect(new Set(allAyahs.map(key)).size).toBe(TOTAL_AYAHS);
  });

  it('page 1 is Al-Fatiha 1–7', () => {
    expect(pages[0].map(({ s, a }) => ({ s, a }))).toEqual(range(1, 1, 7));
  });

  it('page 2 starts at Al-Baqarah 1', () => {
    expect(key(pages[1][0])).toBe('2:1');
  });

  it('page 604 ends at An-Nas 6', () => {
    expect(key(pages[603].at(-1))).toBe('114:6');
  });

  it('matches well-known Madinah mushaf page landmarks', () => {
    expect(pageOf(3, 1)).toBe(50); // Al Imran
    expect(pageOf(4, 1)).toBe(77); // An-Nisa
    expect(pageOf(18, 1)).toBe(293); // Al-Kahf
    expect(pageOf(36, 1)).toBe(440); // Ya-Sin
    expect(pageOf(67, 1)).toBe(562); // Al-Mulk
    expect(pageOf(78, 1)).toBe(582); // An-Naba (start of juz 30)
    expect(pageOf(112, 1)).toBe(604); // Al-Ikhlas
  });

  it('keeps the basmala only as Al-Fatiha 1:1 (not prefixed to other first ayahs)', () => {
    const basmala = pages[0][0].text;
    for (const ayah of allAyahs) {
      if (ayah.a === 1 && ayah.s !== 1) expect(ayah.text.includes(basmala)).toBe(false);
    }
  });
});

describe('surahs.json', () => {
  it('has 114 surahs numbered 1–114 with Arabic and English names', () => {
    expect(surahs).toHaveLength(114);
    surahs.forEach((surah, i) => {
      expect(surah.number).toBe(i + 1);
      expect(surah.nameAr.trim()).not.toBe('');
      expect(surah.nameEn.trim()).not.toBe('');
    });
  });
});

describe('tafsir-muyassar.json', () => {
  it('has exactly one non-empty, HTML-free entry per ayah', () => {
    expect(Object.keys(tafsir)).toHaveLength(TOTAL_AYAHS);
    for (const ayah of allAyahs) {
      const entry = tafsir[key(ayah)];
      expect(typeof entry, key(ayah)).toBe('string');
      expect(entry.trim(), key(ayah)).not.toBe('');
      expect(entry, key(ayah)).not.toMatch(/<[a-z/][^>]*>/i);
    }
  });
});
