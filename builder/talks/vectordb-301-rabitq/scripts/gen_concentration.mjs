#!/usr/bin/env node
// Generate ⟨ō, o⟩ samples for each D in the spec's option list.
// Formula (spec §04): for a unit vector u ∈ R^D drawn uniformly from the sphere,
// ⟨ō, o⟩ = (1/√D) · Σ |u_i|, where ō = sign(u)/√D is the nearest hypercube vertex.
//
// Output: data/concentration.json — [{D, vals:[...]}], one entry per D.
//
// Run from talks/vectordb-301-rabitq/:
//   node scripts/gen_concentration.mjs > data/concentration.json

const D_VALUES = [2, 4, 8, 16, 64, 128, 512];
const N_SAMPLES = 2000;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  // Box-Muller — return one standard normal per call.
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const rng = mulberry32(424242);
const out = [];
for (const D of D_VALUES) {
  const vals = new Array(N_SAMPLES);
  const sqrtD = Math.sqrt(D);
  for (let n = 0; n < N_SAMPLES; n++) {
    let sumSq = 0;
    const u = new Array(D);
    for (let i = 0; i < D; i++) {
      u[i] = gaussian(rng);
      sumSq += u[i] * u[i];
    }
    const norm = Math.sqrt(sumSq);
    let sumAbs = 0;
    for (let i = 0; i < D; i++) sumAbs += Math.abs(u[i] / norm);
    vals[n] = +(sumAbs / sqrtD).toFixed(4);
  }
  out.push({ D, vals });
}

process.stdout.write(JSON.stringify(out) + "\n");
