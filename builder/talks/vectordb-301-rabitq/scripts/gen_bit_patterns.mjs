#!/usr/bin/env node
// Generate 10 deterministic bit patterns of length 1536 for the bit_string spec.
// Output: data/bit_patterns.json — array of {seed, bits} where bits is a "01..." string.
//
// Run from talks/vectordb-301-rabitq/:
//   node scripts/gen_bit_patterns.mjs > data/bit_patterns.json

const D_MAX = 1536;
const N_SEEDS = 10;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const out = [];
for (let seed = 0; seed < N_SEEDS; seed++) {
  const rng = mulberry32(seed * 1009 + 7);
  let bits = "";
  for (let i = 0; i < D_MAX; i++) bits += rng() < 0.5 ? "0" : "1";
  out.push({ seed, bits });
}

process.stdout.write(JSON.stringify(out, null, 0) + "\n");
