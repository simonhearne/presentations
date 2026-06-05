#!/usr/bin/env node
// Generate empirical RaBitQ estimator errors and a synthetic PQ baseline across D.
// Output: data/error_scaling.json — { rabitq:[{D,err}], pq:[{D,err}], bound:[{D,err}] }
//
// RaBitQ simulation (per spec §05):
//   - sample o, q ~ uniform on the unit D-sphere
//   - ō = sign(o) / √D  (the rotated frame is implicit because o is already uniform)
//   - estimate = ⟨ō, q⟩ / ⟨ō, o⟩
//   - error = |estimate − o·q|
//
// PQ baseline is synthetic — RaBitQ's 1/√D scaling is the headline; PQ's flat-in-D
// behavior is the contrast. A real PQ implementation would show the same qualitative
// trend with different constants. See README.
//
// Run from talks/vectordb-301-rabitq/:
//   node scripts/gen_error_scaling.mjs > data/error_scaling.json

const D_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const N_PAIRS = 100;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function unitVector(D, rng) {
  const v = new Array(D);
  let s = 0;
  for (let i = 0; i < D; i++) {
    v[i] = gaussian(rng);
    s += v[i] * v[i];
  }
  const n = Math.sqrt(s);
  for (let i = 0; i < D; i++) v[i] /= n;
  return v;
}

const rng = mulberry32(13371337);

const rabitq = [];
const pq = [];

for (const D of D_VALUES) {
  const sqrtD = Math.sqrt(D);
  for (let n = 0; n < N_PAIRS; n++) {
    const o = unitVector(D, rng);
    const q = unitVector(D, rng);
    let oq = 0;
    let oBar_q = 0;
    let oBar_o = 0;
    for (let i = 0; i < D; i++) {
      const oi = o[i];
      const qi = q[i];
      const sgn = oi >= 0 ? 1 : -1;
      const oBari = sgn / sqrtD;
      oq += oi * qi;
      oBar_q += oBari * qi;
      oBar_o += oBari * oi;
    }
    const est = oBar_q / oBar_o;
    rabitq.push({ D, err: +Math.abs(est - oq).toFixed(4) });
  }
  // Synthetic PQ baseline — flat in D with mild noise. Anchors the contrast.
  for (let n = 0; n < N_PAIRS; n++) {
    const noise = (rng() - 0.5) * 0.06;
    pq.push({ D, err: +(0.15 + noise).toFixed(4) });
  }
}

// Calibrate the theoretical c/√D bound to pass through the 90th percentile of
// RaBitQ errors at D=64 (the eye is drawn to the upper edge of the scatter).
const errsAt64 = rabitq.filter(r => r.D === 64).map(r => r.err).sort((a, b) => a - b);
const p90 = errsAt64[Math.floor(errsAt64.length * 0.9)];
const c = p90 * Math.sqrt(64);

const D_DENSE = [];
for (let d = 2; d <= 2048; d *= Math.SQRT2) D_DENSE.push(Math.round(d));
const bound = [...new Set(D_DENSE)].map(D => ({ D, err: +(c / Math.sqrt(D)).toFixed(4) }));

process.stdout.write(JSON.stringify({ rabitq, pq, bound, c: +c.toFixed(3) }) + "\n");
