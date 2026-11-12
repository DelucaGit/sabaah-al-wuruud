#!/usr/bin/env node
// One-off generator for the bundled Quran data (issue #7).
//
//   node scripts/build-quran-data.mjs
//
// Downloads three files from Tanzil (https://tanzil.net) into a temporary
// directory outside the repo, then writes:
//
//   src/data/quran/pages.json            604 entries; pages[N-1] is page N: [{ s, a, text }]
//   src/data/quran/surahs.json           [{ number, nameAr, nameEn }]
//   src/data/quran/tafsir-muyassar.json  { "s:a": "tafsir text" }
//
// The Quran text and tafsir are copied VERBATIM (Tanzil's licence forbids
// changing the text). The only transformations are: splitting the
// "sura|aya|text" lines, separating the basmala heading (see below), grouping ayahs by Madinah-mushaf page using Tanzil's
// page metadata, trimming surrounding whitespace and stripping HTML tags from
// the tafsir (Tanzil's ar.muyassar contains none at the time of writing).
// Output is deterministic for a given set of source files.
//
// Sources and licences: docs/credits/quran.md

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'quran');
const RAW_DIR = process.env.QURAN_RAW_DIR || join(tmpdir(), 'sabaah-quran-raw');

const TOTAL_AYAHS = 6236;
const TOTAL_PAGES = 604;
const TOTAL_SURAHS = 114;

const SOURCES = {
  // Tanzil Quran Text (Uthmani, v1.1), "sura|aya|text" format, with pause marks
  // and sajdah signs; no rub-el-hizb signs and no tatweel below superscript
  // alefs. (Tanzil treats any present option as "on", so off = omitted.)
  text: {
    file: 'quran-uthmani.txt',
    url: 'https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&quranType=uthmani&outType=txt-2&agree=true',
  },
  // Tanzil Quran metadata v1.0 (CC BY): surahs and Madinah-mushaf page starts.
  meta: {
    file: 'quran-data.xml',
    url: 'https://tanzil.net/res/text/metadata/quran-data.xml',
  },
  // At-Tafsir al-Muyassar (King Fahd Glorious Quran Printing Complex) via Tanzil.
  tafsir: {
    file: 'ar.muyassar.txt',
    url: 'https://tanzil.net/trans/?transID=ar.muyassar&type=txt-2',
  },
};

async function download({ file, url }) {
  const path = join(RAW_DIR, file);
  if (existsSync(path) && !process.argv.includes('--refresh')) {
    console.log(`using cached ${path}`);
  } else {
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(path, 'utf8');
}

/** Parse Tanzil's "sura|aya|text" format, skipping comments and blank lines. */
function parsePipeText(raw) {
  const map = new Map();
  for (const line of raw.replace(/^﻿/, '').split(/\r?\n/)) {
    if (line === '' || line.startsWith('#')) continue;
    const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line);
    if (!m) throw new Error(`unexpected line: ${line.slice(0, 80)}`);
    const key = `${Number(m[1])}:${Number(m[2])}`;
    if (map.has(key)) throw new Error(`duplicate ayah ${key}`);
    map.set(key, m[3].trim());
  }
  return map;
}

function attrs(tag) {
  const out = {};
  for (const [, k, v] of tag.matchAll(/(\w+)="([^"]*)"/g)) out[k] = v;
  return out;
}

function parseMeta(xml) {
  const suras = [...xml.matchAll(/<sura\s[^>]*\/>/g)].map((m) => attrs(m[0]));
  const pagesBlock = /<pages>([\s\S]*?)<\/pages>/.exec(xml)?.[1] ?? '';
  const pages = [...pagesBlock.matchAll(/<page\s[^>]*\/>/g)].map((m) => attrs(m[0]));
  return {
    suras: suras.map((x) => ({
      number: Number(x.index),
      ayas: Number(x.ayas),
      nameAr: x.name,
      nameEn: x.tname,
    })),
    pageStarts: pages.map((x) => ({
      page: Number(x.index),
      s: Number(x.sura),
      a: Number(x.aya),
    })),
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function assert(cond, msg) {
  if (!cond) throw new Error(`validation failed: ${msg}`);
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  const [rawText, rawMeta, rawTafsir] = await Promise.all([
    download(SOURCES.text),
    download(SOURCES.meta),
    download(SOURCES.tafsir),
  ]);

  const text = parsePipeText(rawText);
  const tafsirRaw = parsePipeText(rawTafsir);
  const { suras, pageStarts } = parseMeta(rawMeta);

  assert(text.size === TOTAL_AYAHS, `text has ${text.size} ayahs`);
  assert(tafsirRaw.size === TOTAL_AYAHS, `tafsir has ${tafsirRaw.size} entries`);
  assert(suras.length === TOTAL_SURAHS, `${suras.length} surahs`);
  assert(pageStarts.length === TOTAL_PAGES, `${pageStarts.length} pages`);
  pageStarts.forEach((p, i) => assert(p.page === i + 1, `page order at ${i}`));

  // Tanzil prefixes the first ayah of every surah except Al-Fatiha and
  // At-Tawbah with the basmala. In the Madinah mushaf (Hafs numbering) that
  // basmala is a heading above the surah, not part of ayah 1, so it is removed
  // from those 112 ayahs only. The basmala is taken from 1:1 itself and must
  // match exactly, except that Tanzil writes the first letter's marks with a
  // shadda in a couple of surahs (idgham from the previous surah's ending);
  // those are listed in the log. Al-Fatiha 1:1 and An-Naml 27:30 are untouched.
  const fatiha1 = text.get('1:1');
  const firstLetter = fatiha1[0];
  const afterMarks = fatiha1.slice(1).replace(/^\p{Mn}+/u, '');
  const basmalaRe = new RegExp(`^${firstLetter}(\\p{Mn}+)${escapeRe(afterMarks)} `, 'u');
  const fatihaMarks = basmalaRe.exec(`${fatiha1} `)[1];
  const variantBasmala = [];
  let basmalaHeadings = 0;

  // All ayahs in mushaf order, from the surah ayah counts.
  const ordered = [];
  for (const { number, ayas } of suras) {
    for (let a = 1; a <= ayas; a++) {
      const key = `${number}:${a}`;
      assert(text.has(key), `missing text for ${key}`);
      let ayahText = text.get(key);
      if (a === 1 && number !== 1 && number !== 9) {
        const m = basmalaRe.exec(ayahText);
        assert(m, `expected basmala heading on ${key}`);
        if (m[1] !== fatihaMarks) {
          assert(m[1].includes('ّ' /* shadda */),`unknown basmala variant on ${key}`);
          variantBasmala.push(key);
        }
        ayahText = ayahText.slice(m[0].length);
        basmalaHeadings++;
      } else {
        assert(!(a === 1 && number !== 1 && basmalaRe.test(ayahText)), `unexpected basmala on ${key}`);
      }
      assert(ayahText !== '', `empty text for ${key}`);
      ordered.push({ s: number, a, text: ayahText });
    }
  }
  assert(basmalaHeadings === 112, `removed ${basmalaHeadings} basmala headings`);
  console.log(`basmala headings removed: ${basmalaHeadings} (shadda variant on ${variantBasmala.join(', ') || 'none'})`);
  assert(ordered.length === TOTAL_AYAHS, `ordered ${ordered.length}`);

  // Group into pages: a page runs from its start ayah up to the next page's start.
  const indexOf = new Map(ordered.map((x, i) => [`${x.s}:${x.a}`, i]));
  const pages = pageStarts.map((p, i) => {
    const from = indexOf.get(`${p.s}:${p.a}`);
    const next = pageStarts[i + 1];
    const to = next ? indexOf.get(`${next.s}:${next.a}`) : ordered.length;
    assert(from !== undefined && to !== undefined && from < to, `page ${p.page} range`);
    return ordered.slice(from, to);
  });

  const tafsir = {};
  for (const { s, a } of ordered) {
    const key = `${s}:${a}`;
    const value = stripHtml(tafsirRaw.get(key) ?? '');
    assert(value !== '', `empty tafsir for ${key}`);
    tafsir[key] = value;
  }

  const surahs = suras.map(({ number, nameAr, nameEn }) => ({ number, nameAr, nameEn }));

  await mkdir(OUT_DIR, { recursive: true });
  // pages.json: one page per line keeps diffs and reviews readable.
  const pagesJson = `[\n${pages.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`;
  const surahsJson = `[\n${surahs.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]\n`;
  const tafsirJson = `{\n${Object.entries(tafsir)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(',\n')}\n}\n`;

  await writeFile(join(OUT_DIR, 'pages.json'), pagesJson);
  await writeFile(join(OUT_DIR, 'surahs.json'), surahsJson);
  await writeFile(join(OUT_DIR, 'tafsir-muyassar.json'), tafsirJson);
  console.log(`wrote ${pages.length} pages, ${surahs.length} surahs, ${Object.keys(tafsir).length} tafsir entries to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
