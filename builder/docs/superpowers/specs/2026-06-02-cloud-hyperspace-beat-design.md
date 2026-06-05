# cloud.js — hyperspace final beat

**Date:** 2026-06-02
**Module:** `talks/vector-search-visualised/cloud.js`
**Slide:** "Let's build a face-finder model" (`.dark .small-title`)

## Goal

Deliver on the module's "cloud" name. Keep the existing four pedagogical beats
exactly, and append one final beat where the 16 face-finder photos give way to
thousands of dots tumbling through a high-dimensional projection — the visual
"useful lie" the following slide ("Now imagine hundreds of dimensions") names.

## Beats

| Beat | State |
|------|-------|
| 0 | 16 faces in a 4×4 grid (unchanged) |
| 1 | faces slide onto the **age** axis, 1D (unchanged) |
| 2 | + **gender** axis, 2D (unchanged) |
| 3 | + **skin-tone** axis, 3D, camera orbit (unchanged) |
| 4 | **NEW** — faces, spheres and axes fade out; ~6,000 dots bloom and tumble through an 8-D projection; camera eases back |

`advance` walks 0→4, `retreat` walks back. Beats 0–3 are byte-for-byte the
current behaviour; only the `MAX_STAGE` bound and the `t ∈ [3,4]` handling are new.

## The cloud

- **Points:** ~6,000, one `THREE.Points`, built once at init.
- **Data:** each point lives in **D = 8** dimensions, sampled from a mixture of a
  handful (≈6) of Gaussian clusters so the cloud has structure — clumps that read
  as semantic neighbourhoods rather than uniform noise. Cluster index drives
  per-point colour from the brand palette.
- **Material:** small `ShaderMaterial`, soft round dots, size-attenuated by
  distance, additive blending for glow. Colours are brand hex literals (same
  precedent as `DOT_DEFAULTS` / vega `BRAND`). Overall opacity driven by the
  stage-4 weight `w = clamp(t - 3, 0, 1)`.
- **Projection / tumble:** maintain three orthonormal basis vectors `u, v, w` in
  D-space (start `e0, e1, e2`). Each frame apply small Givens rotations across
  cycling axis-pairs, with periodic Gram–Schmidt re-orthonormalisation to fight
  drift. Project every point onto the basis → `xyz`. Cost is ~N·D·3 mults/frame
  (~150k), trivial. The tumble only advances while `w > 0`.

## Cross-fade (t ∈ [3,4])

- Face materials and sphere material become `transparent: true`; their opacity and
  the axis-line opacity scale by `(1 - w)`.
- The cloud points scale opacity by `w`; the tumble rate ramps with `w`.
- Camera dollies from the beat-3 orbit radius out to a wider radius by `w` so the
  whole cloud is in frame.

## Contract / constraints

- `init({ canvas })` → `{ advance, retreat, dispose }` unchanged.
- `FACES` data unchanged (its `age`/`gender`/`skinTone` scalars still drive beats
  1–3; they may also seed hero-point positions in the cloud).
- `dispose` additionally frees the new geometry and material.
- Resize handling unchanged.

## Out of scope

- No change to beats 0–3 visuals or timing.
- No new external assets; no slide-markup change.

## Verification

- `npm run build talks/vector-search-visualised` then bundle; build stays clean.
- Playwright screenshots of each beat (0→4) confirming the existing beats are
  visually unchanged and beat 4 shows the tumbling cloud with faces gone.
