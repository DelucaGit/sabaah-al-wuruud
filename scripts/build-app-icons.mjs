// Builds the app icon and splash artwork from Aisha's own logo (issue #126).
//
//   node scripts/build-app-icons.mjs         -> writes assets/*.png (+ docs/logo-final-check.png)
//   npx capacitor-assets generate --android  -> writes android/app/src/main/res/**
//
// (or simply `npm run assets`, which does both.)
// Source of truth: assets/logo-source/aisha-logo-flat.webp (artwork on a flat off-white background).
// The rounded variant in that folder is reference only; Android masks launcher icons itself.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => join(root, ...p);

// capacitor-assets insets the 1024px foreground by 16.7% in the 108dp adaptive canvas, so the png is the
// central 72dp. The safe zone is 66dp, i.e. 61% of 108dp = 91% of this png; 0.88 leaves a margin.
const SAFE = 0.88;
const DARK = '#1A1423'; // --color-bg in dark theme

// ---- 1. Read the flat source and cut the artwork out of its background -------------------------
const { data, info } = await sharp(out('assets/logo-source/aisha-logo-flat.webp'))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

// Background colour = median of the four corner patches (a single flat colour for the adaptive icon).
const patch = [];
for (const [x0, y0] of [[0, 0], [W - 20, 0], [0, H - 20], [W - 20, H - 20]])
  for (let y = y0; y < y0 + 20; y++) for (let x = x0; x < x0 + 20; x++) patch.push((y * W + x) * 3);
const med = (c) => patch.map((i) => data[i + c]).sort((a, b) => a - b)[patch.length >> 1];
const BG = [med(0), med(1), med(2)];
const BG_HEX = '#' + BG.map((v) => v.toString(16).padStart(2, '0')).join('');
console.log('background', BG_HEX);

const dist = (i) => Math.max(Math.abs(data[i] - BG[0]), Math.abs(data[i + 1] - BG[1]), Math.abs(data[i + 2] - BG[2]));

// Flood-fill from the border over "background-like" pixels (the faint gradient and the soft shadow
// under the base count as background). Interior highlights the fill cannot reach stay opaque.
const T = 12;
const outside = new Uint8Array(W * H);
const stack = [];
const push = (x, y) => {
  const p = y * W + x;
  if (!outside[p] && dist(p * 3) < T) {
    outside[p] = 1;
    stack.push(p);
  }
};
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % W;
  const y = (p / W) | 0;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

// Soft edge: within a few pixels of the outside, un-mix the background colour (alpha from colour
// distance, colour = (pixel - bg*(1-a)) / a) so no off-white halo remains. Everything else is opaque.
const BAND = 4;
const near = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    if (!outside[y * W + x]) continue;
    for (let dy = -BAND; dy <= BAND; dy++)
      for (let dx = -BAND; dx <= BAND; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1;
      }
  }
const rgba = Buffer.alloc(W * H * 4);
for (let p = 0; p < W * H; p++) {
  const i = p * 3;
  let a = 255;
  let c = [data[i], data[i + 1], data[i + 2]];
  if (outside[p]) a = 0;
  else if (near[p]) {
    // alpha from the channel that differs most from the background
    let al = 0;
    for (let k = 0; k < 3; k++) {
      const room = BG[k] > 127 ? BG[k] : 255 - BG[k];
      al = Math.max(al, Math.abs(data[i + k] - BG[k]) / Math.max(room, 1));
    }
    al = Math.min(1, Math.max(0.0, (al - 0.04) / 0.5)); // ramp, ignores faint noise
    if (al < 1) {
      a = Math.round(al * 255);
      c = c.map((v, k) => (al > 0 ? Math.max(0, Math.min(255, Math.round((v - BG[k] * (1 - al)) / al))) : v));
    }
  }
  rgba[p * 4] = c[0]; rgba[p * 4 + 1] = c[1]; rgba[p * 4 + 2] = c[2]; rgba[p * 4 + 3] = a;
}

// Trim to the artwork's bounding box.
const art = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
  .png()
  .toBuffer();
const artMeta = await sharp(art).metadata();
console.log('artwork', artMeta.width, 'x', artMeta.height);

// ---- 2. Compose outputs -------------------------------------------------------------------------
const fit = async (canvas, frac) => {
  const s = Math.min((canvas * frac) / artMeta.width, (canvas * frac) / artMeta.height);
  return sharp(art).resize(Math.round(artMeta.width * s), Math.round(artMeta.height * s)).png().toBuffer();
};
const onCanvas = (canvas, layer, background) =>
  sharp({ create: { width: canvas, height: canvas, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: layer, gravity: 'centre' }])
    .png();
const bgObj = { r: BG[0], g: BG[1], b: BG[2], alpha: 1 };
mkdirSync(out('assets'), { recursive: true });
mkdirSync(out('docs'), { recursive: true });

// Adaptive icon foreground: transparent, artwork inside the central 61%.
await onCanvas(1024, await fit(1024, SAFE)).toFile(out('assets/icon-foreground.png'));
// Adaptive icon background: one flat colour.
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: bgObj } }).png().toFile(out('assets/icon-background.png'));
// Full icon (legacy square/round launchers, store listing): same artwork on the same flat colour,
// a little larger than the adaptive one since no mask crops it.
await onCanvas(1024, await fit(1024, 0.8), bgObj).toFile(out('assets/icon-only.png'));
// Splash light: off-white, logo modest in size.
await onCanvas(2732, await fit(2732, 0.3), bgObj).toFile(out('assets/splash.png'));
// Splash dark: deep lavender background; logo sits on a soft off-white rounded tile so it stays visible.
const tile = 1000;
const tileSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}"><rect width="${tile}" height="${tile}" rx="230" fill="${BG_HEX}"/></svg>`,
);
const tileWithLogo = await sharp(tileSvg).composite([{ input: await fit(tile, 0.76), gravity: 'centre' }]).png().toBuffer();
await onCanvas(2732, tileWithLogo, DARK).toFile(out('assets/splash-dark.png'));

// Drop the old rose SVG sources; the PNGs above are now the only inputs capacitor-assets reads.
for (const f of readdirSync(out('assets')).filter((f) => f.endsWith('.svg'))) rmSync(out('assets', f));
console.log('wrote assets/*.png');

// ---- 3. Verification sheet ----------------------------------------------------------------------
const fg = await sharp(out('assets/icon-foreground.png')).toBuffer();
const flat = await sharp(out('assets/icon-background.png')).composite([{ input: fg }]).png().toBuffer();
const cell = 300;
const mask = (kind) => {
  const r = kind === 'circle' ? cell / 2 : cell * 0.3; // squircle approximated by a large rounded rect
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}"><rect width="${cell}" height="${cell}" rx="${r}" fill="#fff"/></svg>`);
};
// The png is already the visible 72dp (see SAFE), so masks apply to it directly.
const visible = await sharp(flat).resize(cell, cell).png().toBuffer();
const masked = (kind) => sharp(visible).composite([{ input: mask(kind), blend: 'dest-in' }]).png().toBuffer();
const small = await sharp(await masked('circle')).resize(48, 48).png().toBuffer();
const lavFg = await sharp({ create: { width: cell, height: cell, channels: 4, background: '#8556BF' } })
  .composite([{ input: await sharp(fg).resize(cell, cell).toBuffer() }]).png().toBuffer();
const darkFg = await sharp({ create: { width: cell, height: cell, channels: 4, background: '#111111' } })
  .composite([{ input: await sharp(fg).resize(cell, cell).toBuffer() }]).png().toBuffer();
const sp = (f) => sharp(out('assets', f)).resize(200, 400, { fit: 'cover' }).png().toBuffer();
const items = [
  [await masked('circle'), 10, 10], [await masked('squircle'), 320, 10], [small, 630, 10],
  [lavFg, 10, 320], [darkFg, 320, 320],
  [await sp('splash.png'), 630, 130], [await sp('splash-dark.png'), 840, 130],
];
await sharp({ create: { width: 1060, height: 640, channels: 4, background: '#cccccc' } })
  .composite(items.map(([input, left, top]) => ({ input, left, top })))
  .png()
  .toFile(out('docs/logo-final-check.png'));
console.log('wrote docs/logo-final-check.png');
