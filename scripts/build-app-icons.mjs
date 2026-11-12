// Builds the app icon / splash artwork (white rose on lavender) for issue #18.
//
//   node scripts/build-app-icons.mjs      -> writes assets/*.svg + assets/*.png and public/favicon.svg
//   npx capacitor-assets generate --android  -> writes android/app/src/main/res/**
//
// (or simply `npm run assets`, which does both.)
// The rose below is the single hand-drawn source; every other file is derived from it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => join(root, ...p);

const LINE = '#8556BF'; // petal outlines, sits between the two gradient stops
const DARK = '#1A1423';

// Rose seen from above, centred on 0,0, about 270 units in radius.
// Three rings of overlapping round petals and a small spiral heart.
const ring = (count, dist, r, startDeg, fill) =>
  Array.from({ length: count }, (_, i) => {
    const a = ((startDeg + (360 / count) * i) * Math.PI) / 180;
    const x = (Math.cos(a) * dist).toFixed(1);
    const y = (Math.sin(a) * dist).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  }).join('');

const ROSE = `
  <g stroke="${LINE}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round">
    ${ring(5, 148, 122, -90, '#FFFFFF')}
    ${ring(5, 84, 100, -54, '#F6EFFC')}
    ${ring(3, 34, 72, -90, '#FFFFFF')}
    <path fill="none" d="M 6 -34 C -22 -40 -40 -18 -32 6 C -24 30 6 36 24 20 C 38 6 34 -14 18 -18 C 4 -22 -10 -10 -4 4"/>
  </g>`;

const GRADIENT = `
  <defs>
    <linearGradient id="lav" gradientUnits="objectBoundingBox" x1="0.29" y1="0" x2="0.71" y2="1">
      <stop offset="0" stop-color="#A682DA"/>
      <stop offset="1" stop-color="#7446AD"/>
    </linearGradient>
  </defs>`;

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}\n</svg>\n`;
const rose = (size, scale) =>
  `<g transform="translate(${size / 2} ${size / 2}) scale(${scale})">${ROSE}</g>`;
const lavender = (size, rx = 0) =>
  `${GRADIENT}<rect width="${size}" height="${size}" rx="${rx}" fill="url(#lav)"/>`;

const files = {
  // Full icon (legacy launchers, store listing).
  'assets/icon-only.svg': [1024, svg(1024, lavender(1024) + rose(1024, 1.25))],
  // Adaptive icon: the launcher only guarantees the centre 66% (r = 338 of 1024); the rose stays within r = 325.
  'assets/icon-foreground.svg': [1024, svg(1024, rose(1024, 1.2))],
  'assets/icon-background.svg': [1024, svg(1024, lavender(1024))],
  'assets/splash.svg': [2732, svg(2732, lavender(2732) + rose(2732, 1.2))],
  'assets/splash-dark.svg': [
    2732,
    svg(2732, `<rect width="2732" height="2732" fill="${DARK}"/>` + rose(2732, 1.2)),
  ],
};

mkdirSync(out('assets'), { recursive: true });
mkdirSync(out('public'), { recursive: true });
for (const [file, [size, source]] of Object.entries(files)) {
  writeFileSync(out(file), source);
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(out(file.replace('.svg', '.png')));
  console.log('wrote', file, '+ png');
}

// Web favicon: rounded lavender tile, rose a little larger.
writeFileSync(out('public/favicon.svg'), svg(1024, lavender(1024, 220) + rose(1024, 1.35)));
console.log('wrote public/favicon.svg');
