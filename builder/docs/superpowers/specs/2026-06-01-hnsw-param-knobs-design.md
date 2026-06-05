# HNSW parameter knobs — design

**Date:** 2026-06-01
**Deck:** `talks/vector-search-visualised`
**Files:** `visualisations/hnsw.json`, `talks/vector-search-visualised/slides.md`

## Goal

Add bound slider controls to the HNSW search visualisation for the three
parameters the *next* slide explains — `M`, `efConstruction`, `ef` — so the
presenter can twist the knobs live while the walkthrough is on screen. The
couplings are **lightweight visual hints**, not a genuine re-simulation of HNSW.

## Placement & coexistence with stepping

The viz lives only on the **"HNSW: navigate a graph"** slide. The sliders render
beneath the chart on that slide.

- The existing `step` signal loses its `bind` so it no longer renders a slider.
  Stepping is still driven by arrow keys via the `signal-step: [0..8]`
  frontmatter — unchanged.
- Three new bound signals (`M`, `efConstruction`, `ef`), each `bind.input:
  "range"`, are the only bindings that render.
- `.no-vega-bindings` is removed from the slide so the new sliders show. Because
  `step` no longer binds, nothing unwanted leaks in.

Ranges / defaults (matching the next slide's "start here" table):

| Signal           | min | max | step | default |
| ---------------- | --- | --- | ---- | ------- |
| `M`              | 4   | 48  | 1    | 16      |
| `efConstruction` | 16  | 400 | 1    | 200     |
| `ef`             | 8   | 128 | 1    | 64      |

## Visual couplings

- **`M` → edge density.** Each layer-0 edge carries an `mRank`. The edge `rule`
  mark shows an edge when `mRank <= M` OR the edge is part of the active search
  path (`isPath`), so the walkthrough never breaks regardless of M. Low M → sparse
  skeleton; high M → dense mesh.
- **`ef` → candidate frontier.** On the active layer, nodes are ranked by
  distance to the query; the nearest `round(ef/16)` get a faint highlight ring
  (ef=64 → ~4, ef=128 → ~8). This sits on top of the existing
  current/visited/candidate colouring without replacing it. Communicates
  "candidate-list width."
- **`efConstruction` → value only.** Renders as a slider for completeness (it is
  a build-time knob) with no visual effect, matching the "set at build" framing.

## Scope / non-goals

- No build-pipeline changes — `bind` and removing `.no-vega-bindings` use
  existing machinery.
- `efConstruction` deliberately drives nothing visually; a search-time
  walkthrough has no honest build-time animation.
- The hardcoded graph, step-states, and narration are untouched apart from the
  additive `mRank` tagging and the new ring mark.
