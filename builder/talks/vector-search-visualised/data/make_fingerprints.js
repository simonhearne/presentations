#!/usr/bin/env node
// Generate fingerprint PNGs from a faces.json file.
// For each entry, take an array property (default `vector`) and render a
// near-square grid of coloured blocks, one block per dimension. Each block's
// hue is computed as (value + 1) * 120 (clamped to 0–240), with HSL S=100% L=50%.
//
// Usage:
//   node make_fingerprints.js [--input faces.json] [--out fingerprints]
//                             [--property vector] [--block 5] [--raw]
//
// By default each dimension's hue is normalized against the min/max of that
// dimension across the whole dataset, so colours span the full 0–240 hue range
// and dimensions are directly comparable across images. Pass --raw to instead
// use the naive (value + 1) * 120 mapping.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = {
    input: 'faces.json',
    out: 'fingerprints',
    property: 'vector',
    block: 5,
    normalize: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--input') opts.input = next();
    else if (a === '--out') opts.out = next();
    else if (a === '--property') opts.property = next();
    else if (a === '--block') opts.block = parseInt(next(), 10);
    else if (a === '--raw') opts.normalize = false;
    else throw new Error(`unknown arg: ${a}`);
  }
  return opts;
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rawHue(v) {
  return Math.max(0, Math.min(240, (v + 1) * 120));
}

function normalizedHue(v, lo, hi) {
  if (hi === lo) return 120;
  return ((v - lo) / (hi - lo)) * 240;
}

// Per-dimension min/max across all vectors. Returns { lo: number[], hi: number[] }.
function computeBounds(vectors) {
  const dim = vectors[0].length;
  const lo = new Array(dim).fill(Infinity);
  const hi = new Array(dim).fill(-Infinity);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      if (v[i] < lo[i]) lo[i] = v[i];
      if (v[i] > hi[i]) hi[i] = v[i];
    }
  }
  return { lo, hi };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Build a PNG (RGBA, 8-bit) from a Uint8Array of width*height*4 bytes.
function encodePng(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter byte: None
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Most-square factor pair (cols ≤ rows) for n. For 512 → {cols: 32, rows: 16}.
function gridFor(n) {
  let best = { cols: n, rows: 1 };
  for (let r = 2; r * r <= n; r++) {
    if (n % r === 0) best = { cols: n / r, rows: r };
  }
  return best;
}

function renderFingerprint(vector, blockSize, bounds) {
  const { cols, rows } = gridFor(vector.length);
  const width = cols * blockSize;
  const height = rows * blockSize;
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < vector.length; i++) {
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    const hue = bounds
      ? normalizedHue(vector[i], bounds.lo[i], bounds.hi[i])
      : rawHue(vector[i]);
    const [r, g, b] = hslToRgb(hue, 1, 0.5);
    for (let dy = 0; dy < blockSize; dy++) {
      const y = cy * blockSize + dy;
      let off = (y * width + cx * blockSize) * 4;
      for (let dx = 0; dx < blockSize; dx++) {
        pixels[off++] = r;
        pixels[off++] = g;
        pixels[off++] = b;
        pixels[off++] = 255;
      }
    }
  }
  return encodePng(width, height, pixels);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const inputPath = resolve(HERE, opts.input);
  const outDir = resolve(HERE, opts.out);
  mkdirSync(outDir, { recursive: true });

  const entries = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('input JSON must be an array');

  const renderable = entries.filter(e => Array.isArray(e[opts.property]) && e.filename);
  const skipped = entries.length - renderable.length;
  if (skipped > 0) console.warn(`skipping ${skipped} entr${skipped === 1 ? 'y' : 'ies'} without ${opts.property} or filename`);

  const bounds = opts.normalize ? computeBounds(renderable.map(e => e[opts.property])) : null;

  for (const entry of renderable) {
    const png = renderFingerprint(entry[opts.property], opts.block, bounds);
    const base = parse(entry.filename).name;
    writeFileSync(join(outDir, `${base}.png`), png);
  }
  console.log(`wrote ${renderable.length} fingerprint(s) to ${outDir}${bounds ? ' (per-dim normalized)' : ' (raw)'}`);
}

main();
