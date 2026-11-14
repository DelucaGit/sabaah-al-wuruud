// Builds src/data/reminders/encouragement.json from docs/encouragement-messages.md.
// The markdown is the source of truth: edit it, then run
//   node scripts/build-encouragement.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE = resolve(root, 'docs/encouragement-messages.md');
export const TARGET = resolve(root, 'src/data/reminders/encouragement.json');
export const GROUPS = ['general', 'goalDone', 'goalPending'];

// Parses `## group` headings and top-level `- [id] text` lines.
// Indented lines (the English review translations) and other text are ignored.
export function parseEncouragementMarkdown(markdown) {
  const out = Object.fromEntries(GROUPS.map((g) => [g, []]));
  let group = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(\S+)\s*$/);
    if (heading) {
      group = GROUPS.includes(heading[1]) ? heading[1] : null;
      continue;
    }
    const item = line.match(/^- \[([A-Za-z0-9_-]+)\]\s+(.+?)\s*$/);
    if (item && group) out[group].push({ id: item[1], text: item[2] });
  }
  return out;
}

export function buildJson(markdown) {
  return JSON.stringify(parseEncouragementMarkdown(markdown), null, 2) + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = buildJson(readFileSync(SOURCE, 'utf8'));
  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, json);
  const data = JSON.parse(json);
  console.log(GROUPS.map((g) => `${g}: ${data[g].length}`).join(', '));
}
