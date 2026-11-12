// Pure memorization rules. Aisha memorizes the Madinah mushaf (604 pages) in
// order from page 1. `progress` is `{ memorizedUpTo }`, where 0 means nothing
// memorized yet and 604 means the whole mushaf is done.
//
// `pages` has the shape of src/data/quran/pages.json: an array of 604 entries,
// where pages[0] is page 1 and each entry is `[{ s, a, text }]`.

export const TOTAL_PAGES = 604;

function current(progress) {
  return clampPage(progress?.memorizedUpTo);
}

function clampPage(n) {
  const value = Math.floor(Number(n));
  if (!Number.isFinite(value)) return 0;
  return Math.min(TOTAL_PAGES, Math.max(0, value));
}

/** The new memorizedUpTo after logging one more page, capped at 604. */
export function markNextPage(progress) {
  return Math.min(TOTAL_PAGES, current(progress) + 1);
}

/** n as a valid memorizedUpTo: an integer clamped to 0–604 (invalid input gives 0). */
export function setMemorizedUpTo(progress, n) {
  return clampPage(n);
}

/** The page to memorize next, or null when all 604 pages are done. */
export function nextPageLabel(progress) {
  const upTo = current(progress);
  return upTo >= TOTAL_PAGES ? null : upTo + 1;
}

/**
 * A uniformly random ayah `{ s, a, text, page }` from page memorizedUpTo,
 * or null when nothing is memorized yet (or that page has no ayahs).
 */
export function pickReflectionVerse(progress, pages, rng = Math.random) {
  const page = current(progress);
  if (page === 0) return null;
  const ayahs = pages?.[page - 1];
  if (!Array.isArray(ayahs) || ayahs.length === 0) return null;
  const index = Math.min(ayahs.length - 1, Math.floor(rng() * ayahs.length));
  const { s, a, text } = ayahs[index];
  return { s, a, text, page };
}
