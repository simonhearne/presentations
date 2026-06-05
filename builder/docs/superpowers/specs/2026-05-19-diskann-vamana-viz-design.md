# DiskANN/Vamana graph-build visualisation

A Vega spec for the "DiskANN: when RAM runs out" slide in `talks/vector-search-visualised/slides.md`. Step-driven, 7 stages, single panel. Tells two stories in sequence: how the Vamana graph is built (stages 0–3b), and why the resulting shape is SSD-friendly (stages 4–5).

## Architecture

One Vega spec at `visualisations/diskann-vamana.json`, driven by the existing signal-stage stepper in `script/vega.js`. Slide invocation:

```yaml
- spec: ../../visualisations/diskann-vamana.json
  renderer: svg
  signal-stage: [0,1,2,3,4,5,6]
  actions: false
```

No changes to `bin/build.js`, `script/vega.js`, or the deck runtime.

**Deterministic data, baked in.** All point coordinates, random-init edges, the demo insert's greedy-search visit path, the candidate set, the α=1 and α=1.2 pruning outcomes, the final graph's edges, and the query hop path are precomputed and stored as fixed `data.values` arrays. No `random()` calls in the spec — same precedent as `hnsw.json`. This is an *illustration* of Vamana, not a simulation.

Generation: a throwaway Node script run during implementation produces the bulk data (60 seeded point coords, random-init edges, final-graph edges with bounded degree + a few long-range shortcuts) and its output is pasted into the spec. The script is not checked in; the JSON is the source of truth.

## Data tables

- **`points`** — 60 entries: `{id, x, y, isMedoid}`. One node flagged as medoid (entry point). Coords on a 0–10 grid, seeded layout with mild clustering so the graph has visible structure.
- **`edges_all`** — every edge that appears in any stage, tagged with:
  - `stage_first` (earliest stage at which to draw it)
  - `stage_last` (last stage; `99` for "to the end")
  - `kind` — one of `random_init | search_visit | candidate | pruned | kept_locality | kept_alpha | final | query_path`
  - `a`, `b` (node IDs)
  - Transformed via two `lookup`s against `points` to attach endpoint coords (same pattern as `hnsw.json`), then filtered against the `stage` signal.
- **`inserted_node`** — `{id}` of the node being inserted during stages 2/3a/3b.
- **`query`** — `{x, y}` for stage 5.
- **`narration`** — array of 7 strings indexed by the `stage` signal (HNSW pattern).

## Signals

- `stage` (range, 0–6, step 1) — driven by `signal-stage` from the slide frontmatter; arrow keys step through stages.
- Derived: `narration[stage]`, plus filter expressions used by `edges_all` and node-state formulas. The inserted node is sourced from the `inserted_node` data table rather than a signal.

## Stage content

| Stage | Drawn | Narration |
|---|---|---|
| 0 | 60 points (gray), medoid as a purple star. No edges. | "60 vectors. Pick a medoid as the entry point." |
| 1 | Random initial graph: R≈3 outgoing edges per node, faint gray. | "Start from a random graph. Each node has ≤R edges." |
| 2 | One node ("inserted_now") highlighted with thick stroke. Greedy-search visit path from medoid drawn in blue with arrowed direction; visited nodes filled; candidate set ringed in purple. Random-init edges faded. | "Greedy search from the medoid collects candidates near the new node." |
| 3a | Candidate set frozen. Only the α=1-kept edges drawn solid; pruned candidate edges shown ghosted. | "RobustPrune α=1: keep an edge only if no kept neighbour is already closer." |
| 3b | Same as 3a plus one resurrected long-range edge in purple, callout arrow. | "α=1.2 spares a long-range shortcut. Diversity → fewer hops at query time." |
| 4 | Final graph: all `final`-kind edges drawn. Bounded degree visible; a handful of long-range edges stand out in purple. | "Final graph: ≤R edges per node, with shortcut edges woven in." |
| 5 | Query (diamond, off-medoid). Hop path from medoid → nearest point highlighted in blue with numbered hop labels. Stat card: "4 hops · 4 SSD page reads". | "At query time, few hops → few SSD reads. Billions of vectors, RAM-sized footprint." |

## Visual style

- 1200×520 canvas, transparent background (matches `ivf-voronoi.json`).
- Palette: `#0a2540` (text/active node), `#1f6feb` (active edge/visit path), `#c84cff` (medoid + α-kept shortcut), `#6b7280` (idle node), `#9aa4b2` (random-init edges), `#e5e7eb` (faded/pruned).
- Annotation card top-left, white rounded rect, bold title + thin subtitle. ivf-voronoi pattern.
- Edges = `rule` marks filtered by stage range. Nodes = `symbol`. Medoid = larger star. Inserted-now node = thick stroke, brand purple.
- The demo-insert node and the stage-5 query point are positioned so the visible hop path is 3–4 hops — enough to be interesting, few enough to be readable.

## Files

- New: `visualisations/diskann-vamana.json`.
- Edit: `talks/vector-search-visualised/slides.md` around line 415; replace the `<!-- VIS: ... -->` comment with the `vega` fence above.

## Testing

No unit tests (data spec). Manual verification:

1. `npm run build talks/vector-search-visualised` — builds without errors.
2. `npm test` — existing build/bundle tests still pass (chart-free decks must continue to skip the vega-embed CDN injection).
3. Open `dist/index.html` to the DiskANN slide; arrow-key through stages 0→6 and back. Confirm narration updates, edges appear/disappear at the right stages, and step-driven advance is consumed (next slide doesn't trigger until stage 6).

## Out of scope

- Live simulation / parameter sliders. Stage-stepped only.
- Two-pass Vamana (α=1 then α=1.2 over the full dataset). The α contrast is illustrated on one insert at stages 3a/3b; the final graph at stage 4 is presented as a fait accompli.
- A separate diagram for SSD page layout. The "SSD reads" claim is a stat-card annotation on stage 5, not its own visualisation.
