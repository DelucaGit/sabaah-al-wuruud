#!/usr/bin/env node
// Builds src/data/adhkar/{morning,evening,sleep,istikhara}.json from Hisn al-Muslim.
//
//   node scripts/build-adhkar-data.mjs [cacheDir]
//
// Sources (see docs/credits/adhkar.md):
//   A. hisnmuslim.com JSON API (Arabic, with tashkeel): the dhikr text, book order, repeat.
//      Chapters: 26 = Istikhara, 27 = morning & evening, 28 = sleep.
//   B. HisnElmoslem_App database (muslimpack, GPL-3.0 app): فضل (virtue) and التخريج (source),
//      separate morning/evening lists, and a second opinion on repeat counts and wording.
//
// Text always comes from A. Where A only says "and in the evening say: …" without tashkeel,
// the evening wording is produced by the explicit word substitutions in EVENING below and then
// checked, letter by letter (tashkeel ignored), against B's evening text. The script fails if
// any check fails. Every place where the sources disagree is printed in the report at the end.
// Needs Node >= 22.5 (node:sqlite) and network access on first run.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'data', 'adhkar');
const CACHE = process.argv[2] ?? join(tmpdir(), 'sabaah-adhkar-sources');

const HISN_API = (chapter) => `http://www.hisnmuslim.com/api/ar/${chapter}.json`;
const MUSLIMPACK_DB =
  'https://raw.githubusercontent.com/muslimpack/HisnElmoslem_App/HEAD/hisnelmoslem/assets/db/hisn_elmoslem.db';

const report = new Set();
const note = (msg) => report.add(msg);

// ---------------------------------------------------------------- download

async function cached(name, url) {
  const file = join(CACHE, name);
  try {
    await access(file);
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

async function hisnChapter(chapter) {
  const raw = await readFile(await cached(`hisn-${chapter}.json`, HISN_API(chapter)), 'utf8');
  const json = JSON.parse(raw.replace(/^﻿/, ''));
  const list = Object.values(json)[0];
  return new Map(list.map((d) => [d.ID, d]));
}

// ---------------------------------------------------------------- text helpers

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

/** Letters only: drops tashkeel, tatweel, punctuation, quote marks and spaces, unifies alif/ya forms. */
function skeleton(text) {
  return text
    .replace(/ﷺ/g, 'صلى الله عليه وسلم')
    .replace(TASHKEEL, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^ء-ي]/g, '');
}

function tidy(text) {
  return text
    .normalize('NFC') // canonical order of stacked harakat (e.g. shadda + fatha)
    .replace(/ـ/g, '') // tatweel
    .replace(/\s+([ً-ْ])/g, '$1') // stray space before a haraka
    .replace(/\s+([،,.:؛])/g, '$1')
    .replace(/([،:])(?=\S)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The dhikr itself from a hisnmuslim.com entry: drop (( )), [evening notes] and trailing count notes. */
function hisnText(entry) {
  let t = entry.ARABIC_TEXT.trim();
  if (t.startsWith('((')) {
    t = t.slice(2, t.lastIndexOf('))'));
  } else {
    t = t.replace(/\s*\([^()]*\)\.?\s*$/, ''); // e.g. "(ثلاثَ مرَّاتٍ)."
  }
  t = t.replace(/\.\s*$/, '');
  return tidy(t);
}

function cleanFootnote(text) {
  if (!text) return undefined;
  const t = tidy(text.replace(/^\s*1\s+/, ''));
  return t || undefined;
}

// ---------------------------------------------------------------- mapping

// Book order (source A). `mp` = matching content id(s) in source B: [morning, evening].
// null = not said at that time (per the book's "إذا أصبح" / "إذا أمسى").
const MORNING_EVENING = [
  { hisn: 75, mp: [93, 117] }, // آية الكرسي
  { hisn: 76, mp: [94, 118] }, // المعوذات
  { hisn: 77, mp: [95, 119] },
  { hisn: 78, mp: [96, 120] },
  { hisn: 79, mp: [97, 121] }, // سيد الاستغفار
  { hisn: 80, mp: [98, 122] },
  { hisn: 81, mp: [99, 123] },
  { hisn: 82, mp: [100, 124] },
  { hisn: 83, mp: [101, 125] }, // حسبي الله
  { hisn: 84, mp: [102, 126] },
  { hisn: 85, mp: [103, 127] },
  { hisn: 86, mp: [104, 128] },
  { hisn: 87, mp: [105, 129] },
  { hisn: 88, mp: [106, 130] },
  { hisn: 89, mp: [107, 131] },
  { hisn: 90, mp: [108, 132] },
  { hisn: 91, mp: [109, 133] }, // سبحان الله وبحمده 100
  { hisn: 92, mp: [110, 134] }, // لا إله إلا الله … 10
  { hisn: 93, mp: [111, null] }, // لا إله إلا الله … 100 إذا أصبح
  { hisn: 94, mp: [112, null] }, // إذا أصبح
  { hisn: 95, mp: [113, null] }, // إذا أصبح
  { hisn: 96, mp: [114, 342] }, // أستغفر الله وأتوب إليه 100
  { hisn: 97, mp: [null, 135] }, // إذا أمسى
  { hisn: 98, mp: [115, 136] },
];

// Morning wording -> evening wording, as instructed by the book ("وإذا أمسى قال: …").
const EVENING = {
  77: [
    ['أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ', 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ'],
    ['خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيرَ مَا بَعْدَهُ', 'خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا'],
    ['شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ', 'شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا'],
  ],
  78: [
    [
      'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
      'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
    ],
  ],
  80: [['أَصْبَحْتُ', 'أَمْسَيْتُ']],
  81: [['مَا أَصْبَحَ بِي', 'مَا أَمْسَى بِي']],
  89: [
    ['أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ', 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ'],
    [
      'خَيْرَ هَذَا الْيَوْمِ: فَتْحَهُ، وَنَصْرَهُ، وَنورَهُ، وَبَرَكَتَهُ، وَهُدَاهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهِ وَشَرِّ مَا بَعْدَهُ',
      'خَيْرَ هَذِهِ اللَّيْلَةِ: فَتْحَهَا، وَنَصْرَهَا، وَنُورَهَا، وَبَرَكَتَهَا، وَهُدَاهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهَا وَشَرِّ مَا بَعْدَهَا',
    ],
  ],
  90: [['أَصْبَحْنا', 'أَمْسَيْنَا']],
};

// Repeat counts where A's REPEAT field contradicts the book's own count note (and B).
const REPEAT_OVERRIDE = {
  83: 7, // A: REPEAT 1, but A's own text says (سَبْعَ مَرّاتٍ); B: 7
  104: 3, // sleep: A: 1; B: 3; rn0x/hisn_almuslim_json: "(ثلاث مرات)"
};

// Tashkeel corrections where A and B disagree and B follows the grammar (object => fatha).
const TASHKEEL_FIX = {
  80: [['وَمَلاَئِكَتِكَ', 'وَمَلاَئِكَتَكَ']], // A: مَلاَئِكَتِكَ, B: مَلاَئِكَتَكَ (منصوب، معطوف على حَمَلَةَ)
};

// Sleep: A ids in book order -> B content id(s).
const SLEEP = [
  { hisn: 99, mp: 137 },
  { hisn: 100, mp: 138 },
  { hisn: 101, mp: 139 },
  { hisn: 102, mp: 140 },
  { hisn: 103, mp: 141 },
  { hisn: 104, mp: 142 },
  { hisn: 105, mp: 143 },
  { hisn: 106, mp: 144 }, // B splits the tasbih into 144/330/331 (33/33/34); A keeps one dhikr
  { hisn: 107, mp: 145 },
  { hisn: 108, mp: 146 },
  { hisn: 109, mp: 147 },
  { hisn: 110, mp: 148 }, // B splits into Sajda (148) and Mulk (332)
  { hisn: 111, mp: 149 },
];

// Footnotes in B that are context (how/when), not a virtue, or whose takhreej is tangled with it.
const VIRTUE_OVERRIDE = {
  140: null, // "إذا قام أحدكم من فراشه …" – context of the hadith
  142: null, // "كان إذا أراد أن يرقد …" – context of the hadith
};
const SOURCE_OVERRIDE = {
  140: 'البخاري مع الفتح، 11/ 126، برقم 6320، ومسلم، 4/ 2084، برقم 2714',
  142: 'أبو داود بلفظه، 4/ 311، برقم 5045، والترمذي، برقم 3398، وانظر: صحيح الترمذي، 3/ 143، وصحيح أبي داود، 3/ 240',
  149: 'البخاري مع الفتح، 11/ 113، برقم 6313، ومسلم، 4/ 2081، برقم 2710',
};

// ---------------------------------------------------------------- build

function footnotes(mp, row) {
  let virtue = cleanFootnote(row.fadl);
  if (row.id in VIRTUE_OVERRIDE) virtue = VIRTUE_OVERRIDE[row.id] ?? undefined;
  let source;
  if (row.id in SOURCE_OVERRIDE) {
    source = SOURCE_OVERRIDE[row.id];
  } else {
    source = cleanFootnote(String(row.source ?? '').split('\n')[0]);
    const fadl = cleanFootnote(row.fadl);
    if (source && fadl && source.includes(fadl)) {
      source = source.replace(fadl, '');
    }
    // Punctuation left behind by the source's own formatting or by removing the virtue.
    source = source && tidy(
      source
        .replace(/^[\s.،,]+/, '')
        .replace(/،(\s*،)+/g, '،')
        .replace(/،\s*\./g, '.')
        .replace(/\.\s*\./g, '.'),
    );
  }
  return { virtue, source };
}

function compareWording(label, ours, theirs) {
  if (theirs.startsWith('QuranText[')) return; // B stores Quran as a reference, nothing to compare
  if (skeleton(ours) !== skeleton(theirs)) {
    note(`WORDING ${label}\n    A: ${ours}\n    B: ${theirs}`);
  } else if (ours.replace(/[^ء-ْ]/g, '') !== tidy(theirs).replace(/ﷺ/g, 'صلى الله عليه وسلم').replace(/[^ء-ْ]/g, '')) {
    note(`TASHKEEL ${label}\n    A: ${ours}\n    B: ${tidy(theirs)}`);
  }
}

function dhikr(id, arabic, repeat, { virtue, source }) {
  const d = { id, arabic, repeat };
  if (virtue) d.virtue = virtue;
  if (source) d.source = source;
  return d;
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const [istikharaCh, morningEveningCh, sleepCh] = await Promise.all([26, 27, 28].map(hisnChapter));
  const db = new DatabaseSync(await cached('hisn_elmoslem.db', MUSLIMPACK_DB), { readOnly: true });
  const row = (id) => {
    const r = db.prepare('SELECT * FROM contents WHERE id = ?').get(id);
    if (!r) throw new Error(`source B: content ${id} missing`);
    return r;
  };

  const repeatFor = (hisnId, entry, mpRow) => {
    const repeat = REPEAT_OVERRIDE[hisnId] ?? entry.REPEAT;
    if (REPEAT_OVERRIDE[hisnId]) note(`REPEAT hisn ${hisnId}: A says ${entry.REPEAT}, using ${repeat} (B: ${mpRow.count})`);
    else if (mpRow.count !== repeat && hisnId !== 106) note(`REPEAT hisn ${hisnId}: A ${repeat}, B ${mpRow.count} – kept A`);
    return repeat;
  };

  // Morning & evening
  const morning = [];
  const evening = [];
  for (const { hisn, mp } of MORNING_EVENING) {
    const entry = morningEveningCh.get(hisn);
    if (!entry) throw new Error(`source A: dhikr ${hisn} missing`);
    let text = hisnText(entry);
    for (const [from, to] of TASHKEEL_FIX[hisn] ?? []) {
      if (!text.includes(from.normalize('NFC'))) throw new Error(`hisn ${hisn}: "${from}" not found`);
      text = text.replace(from.normalize('NFC'), to.normalize('NFC'));
      note(`TASHKEEL FIX hisn ${hisn}: ${from} -> ${to} (follows B)`);
    }
    const [mpMorning, mpEvening] = mp;

    if (mpMorning) {
      const r = row(mpMorning);
      compareWording(`morning (hisn ${hisn} / B ${mpMorning})`, text, r.content);
      morning.push(
        dhikr(`morning-${String(morning.length + 1).padStart(2, '0')}`, text, repeatFor(hisn, entry, r), footnotes(mpMorning, r)),
      );
    }
    if (mpEvening) {
      const r = row(mpEvening);
      let eveningText = text;
      for (const [rawFrom, rawTo] of EVENING[hisn] ?? []) {
        const [from, to] = [rawFrom.normalize('NFC'), rawTo.normalize('NFC')];
        if (!eveningText.includes(from)) throw new Error(`hisn ${hisn}: "${from}" not found`);
        eveningText = eveningText.replace(from, to);
      }
      if (!r.content.startsWith('QuranText[') && skeleton(eveningText) !== skeleton(r.content)) {
        throw new Error(`hisn ${hisn}: evening wording does not match source B\n  ours: ${eveningText}\n  B:    ${r.content}`);
      }
      if (EVENING[hisn]) note(`EVENING hisn ${hisn}: derived from the morning text; letters match B ${mpEvening}`);
      else compareWording(`evening (hisn ${hisn} / B ${mpEvening})`, eveningText, r.content);
      evening.push(
        dhikr(`evening-${String(evening.length + 1).padStart(2, '0')}`, eveningText, repeatFor(hisn, entry, r), footnotes(mpEvening, r)),
      );
    }
  }

  // Sleep
  const sleep = SLEEP.map(({ hisn, mp }, i) => {
    const entry = sleepCh.get(hisn);
    if (!entry) throw new Error(`source A: dhikr ${hisn} missing`);
    const text = hisnText(entry);
    const r = row(mp);
    if (![106, 110, 99].includes(hisn)) compareWording(`sleep (hisn ${hisn} / B ${mp})`, text, r.content);
    return dhikr(`sleep-${String(i + 1).padStart(2, '0')}`, text, repeatFor(hisn, entry, r), footnotes(mp, r));
  });

  // Istikhara: the du'a only, from «اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ» to «ثُمَّ أَرْضِنِي بِهِ».
  const HIGHLIGHT = 'هَذَا الْأَمْرَ'.normalize('NFC');
  const full = istikharaCh.get(74).ARABIC_TEXT.normalize('NFC');
  const start = full.indexOf('اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ'.normalize('NFC'));
  const endMark = 'ثُمَّ أَرْضِنِي بِهِ'.normalize('NFC');
  const end = full.indexOf(endMark) + endMark.length;
  if (start < 0 || end < endMark.length) throw new Error('istikhara: start/end not found');
  let istikharaText = tidy(full.slice(start, end));
  // A (and B) spell the first «هذا الأمر» with partial tashkeel (هَذَا الأمْرَ); unify with the second.
  const firstSpelling = 'هَذَا الأمْرَ'.normalize('NFC');
  if (istikharaText.includes(firstSpelling)) {
    istikharaText = istikharaText.replace(firstSpelling, HIGHLIGHT);
    note('ISTIKHARA: first «هَذَا الأمْرَ» normalised to «هَذَا الْأَمْرَ» (same word, full tashkeel)');
  }
  const mpIstikhara = row(324).content;
  if (!skeleton(mpIstikhara).includes(skeleton(istikharaText))) {
    throw new Error('istikhara: text does not match source B');
  }
  const istikhara = {
    arabic: istikharaText,
    highlight: HIGHLIGHT,
    source: tidy(row(324).source),
  };

  const write = (name, data) => writeFile(join(OUT, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
  await Promise.all([
    write('morning.json', morning),
    write('evening.json', evening),
    write('sleep.json', sleep),
    write('istikhara.json', istikhara),
  ]);

  console.log(`morning: ${morning.length}, evening: ${evening.length}, sleep: ${sleep.length}, istikhara: 1`);
  console.log(`\nReport (${report.size}):`);
  for (const line of report) console.log(`- ${line}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
