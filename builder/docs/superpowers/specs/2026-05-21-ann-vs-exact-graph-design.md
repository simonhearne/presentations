# ANN vs exact search — comparison graph

**Date:** 2026-05-21
**Deck:** `talks/vector-search-visualised`
**Slide:** "The big idea" (currently a `<!-- VIS: ... -->` placeholder, ~line 370 of `slides.md`)

## Goal

Show, on a single slide, why approximate nearest neighbour (ANN) search is worth
a tiny recall hit: as the dataset grows, exact search cost grows linearly while
ANN cost grows logarithmically. The gap between the two — visualised directly —
is the "orders-of-magnitude speedup" the slide's body text promises.

## Visualisation

A new Vega spec at `visualisations/ann-vs-exact.json`, rendered on the slide via
a ` ```vega ` block.

### Axes

- **Log–log.** Both axes log scale so every curve stays legible from 100 to
  1 billion vectors.
- **X** — vector count `N`, domain `[1e2, 1e9]`, decade ticks formatted `~s`
  (`100`, `1k`, … `1B`).
- **Y** — comparisons required per query, log scale, decade ticks formatted `~s`.

### Curves

| Series | Model | Colour | Shape on log–log |
|--------|-------|--------|------------------|
| Exact  | `comparisons = N` | blue `#1f6feb` | straight diagonal, slope 1 |
| ANN    | `comparisons ≈ 60·log₁₀(N)` | amber `#f59e0b` | near-flat, gently rising |

The ANN model yields ~180 comparisons at `N=1e3`, ~360 at `1e6`, ~540 at `1e9`.

**Honesty note** (rendered as small-print footnote, following the precedent of
`gpu-breakeven.json`): the ANN curve is an *illustrative* O(log N) model — a real
HNSW search visits a few hundred nodes largely independent of `N`. Exact search
is genuinely O(N). The point is the shape contrast, not precise node counts.

### Data generation

Generate the exponent `e` over `[2, 9]` in steps of `0.25` (a Vega `sequence`),
then derive `n = 10^e`, `exact = 10^e`, `ann = 60·e`. This makes the ANN curve
smooth and the exact curve exact. Fold into `{method, comparisons}` long form for
a single colour-keyed line mark, or keep two explicit line marks — implementer's
choice, whichever is cleaner in raw Vega.

### Stepped reveal

Three stages, driven by a `stage` signal and the deck's
`signal-stage: [0,1,2]` frontmatter (same mechanism as the IVF/HNSW slides):

0. **Exact only** — blue diagonal + its label. "Compare against all of them."
1. **ANN appears** — amber curve drops in along the floor.
2. **Gap callout** — a dashed vertical bracket at `N = 1e9` spanning the two curve
   endpoints, labelled **"≈ 6 orders of magnitude fewer comparisons"**
   (`1e9 / ~540 ≈ 1.85e6 ≈ 10^6.27`). Wording deliberately echoes the slide
   body's "orders-of-magnitude speedup."

Per-mark opacity is gated on `stage` (`opacity` expression per mark/series).

## Implementation approach

Raw **Vega v5** (like `hnsw.json`, `diskann-vamana.json`, `trade-off-triangle.json`),
not Vega-Lite. The stepped reveal needs per-mark opacity gated on a signal;
explicit Vega signals express this far more directly than Vega-Lite params.

Brand styling matches existing specs: `background: transparent`,
`config.view.stroke: transparent`, Inter font, axis colours `#bbb`,
footnote text `#94a3b8`.

## Slide change

In `talks/vector-search-visualised/slides.md`, on the "The big idea" slide,
replace:

```
<!-- VIS: A "search space" shape; an ANN query touches only a small region instead of all of it. -->
```

with:

````
```vega
- spec: ../../visualisations/ann-vs-exact.json
  renderer: svg
  signal-stage: [0,1,2]
  actions: false
```
````

## Scope / non-goals

- **Two curves only** — exact vs a single generic ANN line. IVF (√N) and HNSW
  (log N) are *not* split out here; the per-index detail belongs to the IVF/HNSW
  slides that follow.
- No interactivity beyond the stepped reveal (no hover, no bindings).
- No new build-pipeline code — this reuses the existing `vega` frontmatter and
  `signal-stage` stepping verbatim.

## Verification

- `npm run build talks/vector-search-visualised` succeeds.
- The "big idea" slide renders the chart; ArrowRight steps through stages 0→1→2,
  then advances to the next slide.
- Exact curve is a straight diagonal; ANN curve is near-flat; the stage-2 bracket
  and label appear at the right edge.
