#!/usr/bin/env node
// Generate quantised fingerprint PNGs from a faces.json file — illustrative
// companions to make_fingerprints.js, for the quantisation section of the deck.
//
// Two variants are written:
//   fingerprints-pq/      Product quantisation — the 512-D vector is split into
//                         8 chunks; a small codebook (k-means, K=8) is learned
//                         per chunk and each chunk is replaced by its codebook
//                         index, drawn as one colour swatch. 512 floats → 8 IDs.
//   fingerprints-rabitq/  RaBitQ — 1 bit per dimension: each cell is black or
//                         white by the sign of (value − per-dimension mean).
//
// Full-precision and scalar-quantised (int8, ~visually identical) fingerprints
// are the existing fingerprints/ set — no need to regenerate those.
//
// Usage: node make_quant_fingerprints.js [--input faces.json] [--block 5]
//                                        [--property vector] [--chunks 8] [--codes 8]

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = { input: 'faces.json', property: 'vector', block: 5, chunks: 8, codes: 8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--input') opts.input = next();
    else if (a === '--property') opts.property = next();
    else if (a === '--block') opts.block = parseInt(next(), 10);
    else if (a === '--chunks') opts.chunks = parseInt(next(), 10);
    else if (a === '--codes') opts.codes = parseInt(next(), 10);
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

// Per-dimension mean across all vectors (used as the RaBitQ binarisation pivot).
function computeMean(vectors) {
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) sum[i] += v[i];
  return sum.map(s => s / vectors.length);
}

// Tiny deterministic k-means. Returns the cluster index assigned to each point.
function kmeans(points, K, iters = 30) {
  const d = points[0].length;
  const centroids = [];
  for (let k = 0; k < K; k++) centroids.push(points[Math.floor(k * points.length / K)].slice());
  const assign = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    for (let p = 0; p < points.length; p++) {
      let best = 0, bestD = Infinity;
      for (let k = 0; k < K; k++) {
        let dist = 0;
        for (let i = 0; i < d; i++) { const dv = points[p][i] - centroids[k][i]; dist += dv * dv; }
        if (dist < bestD) { bestD = dist; best = k; }
      }
      assign[p] = best;
    }
    const sums = Array.from({ length: K }, () => new Array(d).fill(0));
    const counts = new Array(K).fill(0);
    for (let p = 0; p < points.length; p++) {
      counts[assign[p]]++;
      for (let i = 0; i < d; i++) sums[assign[p]][i] += points[p][i];
    }
    for (let k = 0; k < K; k++) {
      if (counts[k] > 0) for (let i = 0; i < d; i++) centroids[k][i] = sums[k][i] / counts[k];
    }
  }
  // Rank codebook entries by their mean magnitude so the palette is stable.
  const order = centroids
    .map((c, k) => ({ k, m: c.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => a.m - b.m)
    .reduce((map, e, rank) => (map.set(e.k, rank), map), new Map());
  return assign.map(k => order.get(k));
}

// For each face, the codebook index of each of its `chunks` sub-vectors.
function productQuantise(vectors, chunks, K) {
  const dim = vectors[0].length;
  const chunkLen = dim / chunks;
  const codes = vectors.map(() => new Array(chunks));
  for (let s = 0; s < chunks; s++) {
    const sub = vectors.map(v => v.slice(s * chunkLen, (s + 1) * chunkLen));
    const assign = kmeans(sub, Math.min(K, vectors.length));
    for (let f = 0; f < vectors.length; f++) codes[f][s] = assign[f];
  }
  return codes;
}

function chunkPng(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter byte: None
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunkPng('IHDR', ihdr),
    chunkPng('IDAT', deflateSync(raw)),
    chunkPng('IEND', Buffer.alloc(0)),
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

function blit(pixels, width, cx, cy, blockSize, [r, g, b]) {
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

// PQ fingerprint: `chunks` vertical strips, each filled with the colour of its
// codebook index — a categorical palette of `K` swatches.
function renderPq(codes, blockSize, chunks, K) {
  const { cols, rows } = gridFor(512);
  const stripCols = cols / chunks;
  const width = cols * blockSize;
  const height = rows * blockSize;
  const pixels = Buffer.alloc(width * height * 4);
  const palette = [];
  for (let k = 0; k < K; k++) palette.push(hslToRgb((k / K) * 280, 0.85, 0.55));
  for (let s = 0; s < chunks; s++) {
    const rgb = palette[codes[s] % K];
    for (let cy = 0; cy < rows; cy++) {
      for (let dx = 0; dx < stripCols; dx++) blit(pixels, width, s * stripCols + dx, cy, blockSize, rgb);
    }
  }
  return encodePng(width, height, pixels);
}

// RaBitQ fingerprint: 1 bit per dimension — white if value ≥ that dimension's
// mean, else black. The pattern still reads as a recognisable per-face print.
function renderRabitq(vector, blockSize, mean) {
  const { cols, rows } = gridFor(vector.length);
  const width = cols * blockSize;
  const height = rows * blockSize;
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < vector.length; i++) {
    const rgb = vector[i] >= mean[i] ? [255, 255, 255] : [17, 17, 17];
    blit(pixels, width, i % cols, Math.floor(i / cols), blockSize, rgb);
  }
  return encodePng(width, height, pixels);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const entries = JSON.parse(readFileSync(resolve(HERE, opts.input), 'utf8'));
  if (!Array.isArray(entries)) throw new Error('input JSON must be an array');

  const renderable = entries.filter(e => Array.isArray(e[opts.property]) && e.filename);
  const vectors = renderable.map(e => e[opts.property]);
  const mean = computeMean(vectors);
  const pqCodes = productQuantise(vectors, opts.chunks, opts.codes);

  const pqDir = resolve(HERE, 'fingerprints-pq');
  const rabitqDir = resolve(HERE, 'fingerprints-rabitq');
  mkdirSync(pqDir, { recursive: true });
  mkdirSync(rabitqDir, { recursive: true });

  renderable.forEach((entry, f) => {
    const base = parse(entry.filename).name;
    writeFileSync(join(pqDir, `${base}.png`), renderPq(pqCodes[f], opts.block, opts.chunks, opts.codes));
    writeFileSync(join(rabitqDir, `${base}.png`), renderRabitq(entry[opts.property], opts.block, mean));
  });
  console.log(`wrote ${renderable.length} PQ + ${renderable.length} RaBitQ fingerprint(s)`);
}

main();
