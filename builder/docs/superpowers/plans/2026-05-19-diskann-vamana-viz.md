# DiskANN/Vamana graph-build visualisation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 7-stage step-driven Vega visualisation showing the Vamana graph being built from scratch, then queried — for the "DiskANN: when RAM runs out" slide in `talks/vector-search-visualised`.

**Architecture:** Single Vega spec at `visualisations/diskann-vamana.json`, driven by the existing `signal-stage` stepper in `script/vega.js`. All data (points, edges, paths, narration) is precomputed and baked into the spec as fixed `data.values` arrays. No deck-runtime changes.

**Tech Stack:** Vega 5, marked, Node test runner. Generator scripts use plain Node ESM (`mulberry32` PRNG for determinism).

**Spec:** `docs/superpowers/specs/2026-05-19-diskann-vamana-viz-design.md`

---

## File Structure

- **Create:** `visualisations/diskann-vamana.json` — the Vega spec. Sole source of truth for visualisation data. Built up incrementally across tasks.
- **Modify:** `talks/vector-search-visualised/slides.md` — replace the `<!-- VIS: ... -->` comment around line 415 with a `vega` fence pointing at the new spec. Wired up in Task 1 so each subsequent task can be visually verified end-to-end.
- **Scratch (not committed):** `/tmp/diskann-gen.mjs` — throwaway generator for point coords + random-init edges + final-graph edges. Run once, paste output into the spec. Deleted at end of Task 6.

**Verification is visual, not automated.** This is a data spec, not code. Each task ends with `npm run build talks/vector-search-visualised`, opening `dist/index.html`, and stepping through to the target stage with ArrowRight. The repo's existing `npm test` must still pass (no regressions in build/bundle behaviour).

**Constants used across tasks:**
- `R = 3` — bounded degree for random init and final graph
- `N = 60` — total nodes
- Grid: 0–10 on both axes
- Medoid: node id `M` at approximately `(5.0, 5.0)`
- Demo-insert node: chosen at execution time, placed near a corner so greedy search takes 3–4 hops
- Query (stage 5): coords picked so the medoid → nearest hop path is 3–4 edges

**Brand palette (use these literal hex values):**
- `#0a2540` — navy, used for active node fill and text
- `#1f6feb` — blue, used for greedy-search visit path
- `#c84cff` — purple, used for medoid + α-kept shortcut
- `#6b7280` — gray, idle node fill
- `#9aa4b2` — light gray, random-init edges
- `#e5e7eb` — very light gray, pruned/faded edges

---

## Task 1: Scaffold spec, generate point cloud, wire up slide (stage 0)

**Files:**
- Create: `/tmp/diskann-gen.mjs`
- Create: `visualisations/diskann-vamana.json`
- Modify: `talks/vector-search-visualised/slides.md` (~line 415)

- [ ] **Step 1: Write the generator script**

Create `/tmp/diskann-gen.mjs`:

```javascript
// Throwaway: generates the static data for diskann-vamana.json.
// Run with: node /tmp/diskann-gen.mjs

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260519);
const N = 60;
const R = 3;
const GRID = 10;

// Points: blue-noise-ish placement via rejection sampling, with a fixed medoid.
const points = [{ id: 'M', x: 5.0, y: 5.0, isMedoid: true }];
const MIN_DIST = 0.7;
while (points.length < N) {
  const x = +(rand() * GRID).toFixed(2);
  const y = +(rand() * GRID).toFixed(2);
  const ok = points.every(p => Math.hypot(p.x - x, p.y - y) >= MIN_DIST);
  if (ok) points.push({ id: 'n' + (points.length - 1), x, y, isMedoid: false });
}

console.log('POINTS:');
console.log(JSON.stringify(points, null, 2));

// Random initial graph: R outgoing edges per node, no self-loops, no duplicates.
const randomInit = [];
for (const a of points) {
  const others = points.filter(p => p.id !== a.id);
  const picks = new Set();
  while (picks.size < R) picks.add(others[Math.floor(rand() * others.length)].id);
  for (const b of picks) randomInit.push({ a: a.id, b, kind: 'random_init', stage_first: 1, stage_last: 2 });
}
console.log('RANDOM_INIT (' + randomInit.length + ' edges):');
console.log(JSON.stringify(randomInit, null, 2));

// Final-graph edges: still R per node, but biased so that ~10% of edges are long-range.
// Strategy per node: pick the (R-1) nearest, plus one "shortcut" to a distant node.
function dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }
const finalEdges = [];
for (const a of points) {
  const others = points.filter(p => p.id !== a.id).map(p => ({ p, d: dist(a, p) }));
  others.sort((x, y) => x.d - y.d);
  const near = others.slice(0, R - 1).map(o => o.p.id);
  const far = others[others.length - 1 - Math.floor(rand() * 5)].p.id;
  for (const b of near) finalEdges.push({ a: a.id, b, kind: 'final', stage_first: 4, stage_last: 99 });
  finalEdges.push({ a: a.id, b: far, kind: 'final_shortcut', stage_first: 4, stage_last: 99 });
}
console.log('FINAL (' + finalEdges.length + ' edges):');
console.log(JSON.stringify(finalEdges, null, 2));
```

- [ ] **Step 2: Run the generator and capture output**

Run: `node /tmp/diskann-gen.mjs > /tmp/diskann-gen.out`
Expected: file contains three JSON arrays (POINTS, RANDOM_INIT, FINAL). Keep the file — Tasks 2 and 6 reference it.

- [ ] **Step 3: Create the Vega spec skeleton with points only**

Create `visualisations/diskann-vamana.json`. Paste the `POINTS` array from `/tmp/diskann-gen.out` into the `points` data block:

```json
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "description": "DiskANN/Vamana graph-build walkthrough — 7 stages from empty point cloud to queried graph.",
  "width": 1200,
  "height": 520,
  "padding": 0,
  "background": "transparent",
  "config": {
    "view": { "stroke": "transparent" },
    "font": "Inter, system-ui, sans-serif"
  },
  "signals": [
    { "name": "stage", "value": 0, "bind": { "input": "range", "min": 0, "max": 6, "step": 1, "name": "stage " } },
    { "name": "narration", "update": "['60 vectors. Pick a medoid as the entry point.', '', '', '', '', '', ''][stage]" }
  ],
  "data": [
    {
      "name": "points",
      "values": [ /* paste the POINTS array here */ ]
    }
  ],
  "scales": [
    { "name": "xscale", "type": "linear", "domain": [0, 10], "range": "width" },
    { "name": "yscale", "type": "linear", "domain": [0, 10], "range": "height" }
  ],
  "marks": [
    {
      "type": "symbol",
      "from": { "data": "points" },
      "encode": {
        "enter": {
          "shape": { "value": "circle" },
          "stroke": { "value": "#ffffff" },
          "strokeWidth": { "value": 1 }
        },
        "update": {
          "x": { "scale": "xscale", "field": "x" },
          "y": { "scale": "yscale", "field": "y" },
          "size": [
            { "test": "datum.isMedoid", "value": 360 },
            { "value": 90 }
          ],
          "shape": [
            { "test": "datum.isMedoid", "value": "diamond" },
            { "value": "circle" }
          ],
          "fill": [
            { "test": "datum.isMedoid", "value": "#c84cff" },
            { "value": "#6b7280" }
          ]
        }
      }
    },
    {
      "type": "rect",
      "encode": {
        "enter": {
          "fill": { "value": "#ffffff" },
          "fillOpacity": { "value": 0.94 },
          "stroke": { "value": "#d1d5db" },
          "strokeWidth": { "value": 1 },
          "cornerRadius": { "value": 8 },
          "x": { "value": 14 },
          "y": { "value": 14 },
          "width": { "value": 720 },
          "height": { "value": 44 }
        }
      }
    },
    {
      "type": "text",
      "encode": {
        "enter": {
          "fontSize": { "value": 14 },
          "fontWeight": { "value": "bold" },
          "fill": { "value": "#0a2540" },
          "align": { "value": "left" },
          "baseline": { "value": "top" },
          "x": { "value": 26 },
          "y": { "value": 28 }
        },
        "update": {
          "text": { "signal": "narration" }
        }
      }
    }
  ]
}
```

- [ ] **Step 4: Wire the spec into the slide**

Open `talks/vector-search-visualised/slides.md`. The slide currently looks like:

```
# DiskANN: when RAM runs out

Same graph idea, engineered to live on SSD. ...

<!-- VIS: Vega chart building the Vamana graph from scratch to a final state, ... -->
```

Two edits:

1. Add `{.no-vega-bindings}` as a new line immediately *above* the `# DiskANN: when RAM runs out` heading. This suppresses Vega's auto-generated stage-signal range slider — the `signal-stage` stepper drives the signal via arrow keys instead. Same pattern as the HNSW slide at line 386.

2. Replace the `<!-- VIS: ... -->` comment with:

````
```vega
- spec: ../../visualisations/diskann-vamana.json
  renderer: svg
  signal-stage: [0,1,2,3,4,5,6]
  actions: false
```
````

- [ ] **Step 5: Build the deck and visually verify stage 0**

Run: `npm run build talks/vector-search-visualised`
Expected: build succeeds with no errors. `dist/index.html` exists.

Open `dist/index.html` in a browser, navigate to the "DiskANN: when RAM runs out" slide. Expected:
- 60 gray circles scattered across the slide
- One purple diamond near the centre (the medoid)
- A white card top-left reading "60 vectors. Pick a medoid as the entry point."

Press ArrowRight inside the slide — the stage signal should advance, narration should empty (placeholders for now). Press ArrowLeft 6 times — should walk back to stage 0.

- [ ] **Step 6: Run existing tests**

Run: `npm test`
Expected: all existing tests pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add visualisations/diskann-vamana.json talks/vector-search-visualised/slides.md
git commit -m "$(cat <<'EOF'
feat(viz): scaffold DiskANN/Vamana spec, render stage 0

60 deterministic points + medoid, wired into the vector-search-visualised
deck. Subsequent stages added in follow-up commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add random-init edges (stage 1)

**Files:**
- Modify: `visualisations/diskann-vamana.json`

- [ ] **Step 1: Add the edges_all data table**

In `visualisations/diskann-vamana.json`, after the `points` entry in the `data` array, add a new entry. Paste the `RANDOM_INIT` array from `/tmp/diskann-gen.out` as `edges_all.values`:

```json
{
  "name": "edges_all",
  "values": [ /* paste the RANDOM_INIT array here */ ],
  "transform": [
    {
      "type": "lookup",
      "from": "points",
      "key": "id",
      "fields": ["a"],
      "as": ["nodeA"]
    },
    {
      "type": "lookup",
      "from": "points",
      "key": "id",
      "fields": ["b"],
      "as": ["nodeB"]
    },
    { "type": "formula", "as": "x1", "expr": "datum.nodeA.x" },
    { "type": "formula", "as": "y1", "expr": "datum.nodeA.y" },
    { "type": "formula", "as": "x2", "expr": "datum.nodeB.x" },
    { "type": "formula", "as": "y2", "expr": "datum.nodeB.y" },
    {
      "type": "filter",
      "expr": "stage >= datum.stage_first && stage <= datum.stage_last"
    }
  ]
}
```

- [ ] **Step 2: Add the edge rule mark**

In the `marks` array, *before* the `symbol` mark (so edges render behind nodes), insert:

```json
{
  "type": "rule",
  "from": { "data": "edges_all" },
  "encode": {
    "update": {
      "x": { "scale": "xscale", "field": "x1" },
      "y": { "scale": "yscale", "field": "y1" },
      "x2": { "scale": "xscale", "field": "x2" },
      "y2": { "scale": "yscale", "field": "y2" },
      "stroke": [
        { "test": "datum.kind === 'random_init'", "value": "#9aa4b2" }
      ],
      "strokeOpacity": [
        { "test": "datum.kind === 'random_init'", "value": 0.45 }
      ],
      "strokeWidth": { "value": 1 }
    }
  }
}
```

- [ ] **Step 3: Update narration for stage 1**

Replace the `narration` signal's `update` expression with:

```
"['60 vectors. Pick a medoid as the entry point.', 'Start from a random graph. Each node has ≤3 edges.', '', '', '', '', ''][stage]"
```

(Note: `≤` is the `≤` character; safe inside a JSON string.)

- [ ] **Step 4: Build and verify**

Run: `npm run build talks/vector-search-visualised`
Open `dist/index.html` to the DiskANN slide.

- Stage 0: still 60 nodes + medoid, no edges, narration about picking medoid.
- ArrowRight to stage 1: ~180 thin gray edges crisscrossing the canvas, narration reads "Start from a random graph. Each node has ≤3 edges."
- ArrowRight to stage 2: edges should *stay* visible (we'll fade them properly in Task 3, but for now they persist per `stage_last: 2`).
- ArrowRight to stage 3: edges disappear (stage > stage_last).

- [ ] **Step 5: Commit**

```bash
git add visualisations/diskann-vamana.json
git commit -m "$(cat <<'EOF'
feat(viz): add random-init edges to DiskANN viz (stage 1)

180 directed edges, R=3 per node, drawn faintly in brand gray.
Filtered by stage via stage_first / stage_last on the edges_all table.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Stage 2 — demo insert and greedy search

**Files:**
- Modify: `visualisations/diskann-vamana.json`

**Authoring decisions for this task:**
- Pick `inserted_node` id at execution time. Open the spec, look at the points: pick a node whose coordinates put it near a corner (e.g. `x < 2 && y < 2` or `x > 8 && y > 8`). Record its id.
- The greedy search path is the *sequence of current nodes* the algorithm visits as it walks from medoid towards the inserted node. Pick 3–4 intermediate nodes that lie roughly between medoid and inserted_node, in order of decreasing distance to inserted_node.
- The candidate set is the union of visit-path nodes' neighbours in the random-init graph that ended up closer than what was already seen. For this illustration, pick ~6 nodes near `inserted_node` from the points data.

- [ ] **Step 1: Add `inserted_node` data table**

In the `data` array of `visualisations/diskann-vamana.json`, after `edges_all`, add (replace `nXX` with the chosen node id):

```json
{
  "name": "inserted_node",
  "values": [ { "id": "nXX" } ]
}
```

- [ ] **Step 2: Add the greedy search visit edges**

Append entries to `edges_all.values` (the JSON array — you'll need to find the `[` and `]` and add inside). Replace ids with the chosen visit path `M → v1 → v2 → v3 → inserted_node`:

```json
{ "a": "M",  "b": "v1", "kind": "visit", "stage_first": 2, "stage_last": 2 },
{ "a": "v1", "b": "v2", "kind": "visit", "stage_first": 2, "stage_last": 2 },
{ "a": "v2", "b": "v3", "kind": "visit", "stage_first": 2, "stage_last": 2 },
{ "a": "v3", "b": "nXX", "kind": "visit", "stage_first": 2, "stage_last": 2 }
```

- [ ] **Step 3: Add the candidate set as a data table**

After `inserted_node`, add (replace `c1`...`c6` with ~6 chosen ids near `inserted_node`, including the visit-path nodes):

```json
{
  "name": "candidates",
  "values": [
    { "id": "c1" }, { "id": "c2" }, { "id": "c3" },
    { "id": "c4" }, { "id": "c5" }, { "id": "c6" }
  ],
  "transform": [
    {
      "type": "lookup",
      "from": "points",
      "key": "id",
      "fields": ["id"],
      "as": ["point"]
    },
    { "type": "formula", "as": "x", "expr": "datum.point.x" },
    { "type": "formula", "as": "y", "expr": "datum.point.y" }
  ]
}
```

- [ ] **Step 4: Style visit edges in the rule mark**

Update the `stroke` and `strokeOpacity` arrays in the rule mark to handle the `visit` kind:

```json
"stroke": [
  { "test": "datum.kind === 'random_init'", "value": "#9aa4b2" },
  { "test": "datum.kind === 'visit'", "value": "#1f6feb" }
],
"strokeOpacity": [
  { "test": "datum.kind === 'random_init' && stage === 2", "value": 0.15 },
  { "test": "datum.kind === 'random_init'", "value": 0.45 },
  { "test": "datum.kind === 'visit'", "value": 1.0 }
],
"strokeWidth": [
  { "test": "datum.kind === 'visit'", "value": 2.5 },
  { "value": 1 }
]
```

Note: at stage 2, random-init edges fade to opacity 0.15 so the visit path stands out.

- [ ] **Step 5: Add a candidate-ring mark and an inserted-node highlight**

After the `symbol` mark for `points`, add two more marks:

```json
{
  "type": "symbol",
  "from": { "data": "candidates" },
  "encode": {
    "enter": {
      "shape": { "value": "circle" },
      "size": { "value": 240 },
      "fill": { "value": "transparent" },
      "stroke": { "value": "#c84cff" },
      "strokeWidth": { "value": 2 }
    },
    "update": {
      "x": { "scale": "xscale", "field": "x" },
      "y": { "scale": "yscale", "field": "y" },
      "opacity": { "signal": "stage >= 2 && stage <= 3 ? 1 : 0" }
    }
  }
},
{
  "type": "symbol",
  "from": { "data": "inserted_node" },
  "encode": {
    "enter": {
      "shape": { "value": "circle" },
      "size": { "value": 200 }
    },
    "update": {
      "x": { "signal": "scale('xscale', data('points')[indexof(pluck(data('points'), 'id'), datum.id)].x)" },
      "y": { "signal": "scale('yscale', data('points')[indexof(pluck(data('points'), 'id'), datum.id)].y)" },
      "fill": { "value": "#0a2540" },
      "stroke": { "value": "#c84cff" },
      "strokeWidth": { "value": 3 },
      "opacity": { "signal": "stage >= 2 ? 1 : 0" }
    }
  }
}
```

- [ ] **Step 6: Update narration for stage 2**

Update the `narration` signal:

```
"['60 vectors. Pick a medoid as the entry point.', 'Start from a random graph. Each node has ≤3 edges.', 'Greedy search from the medoid collects candidates near the new node.', '', '', '', ''][stage]"
```

- [ ] **Step 7: Build and verify**

Run: `npm run build talks/vector-search-visualised`. Open the slide and step to stage 2. Expected:
- Random-init edges fade to barely visible.
- A blue 4-edge path runs from the medoid out to the inserted node.
- ~6 nodes are ringed in purple (the candidate set).
- The inserted node has a thick purple stroke and a dark navy fill.
- Narration: "Greedy search from the medoid collects candidates near the new node."

- [ ] **Step 8: Commit**

```bash
git add visualisations/diskann-vamana.json
git commit -m "$(cat <<'EOF'
feat(viz): stage 2 of DiskANN viz — greedy search visit path

Hand-curated insert node, 4-edge visit path from medoid, ringed
candidate set. Random-init edges fade behind so the search path
reads clearly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Stage 3a — RobustPrune α=1

**Files:**
- Modify: `visualisations/diskann-vamana.json`

**Authoring decisions:**
- From the 6 candidates, pick 2–3 as the α=1 kept set: the ones closest to `inserted_node` among the kept (mimicking the RobustPrune rule "keep an edge only if no kept neighbour is already closer to the target").
- Pick the rest as pruned candidates (visualised as ghosted edges back to `inserted_node`).

- [ ] **Step 1: Add α=1 kept edges and pruned candidate edges to `edges_all`**

Append to `edges_all.values` (replace `k1`/`k2`/`k3` with chosen kept candidate ids, `p1`/`p2`/`p3` with chosen pruned candidate ids):

```json
{ "a": "nXX", "b": "k1", "kind": "kept_locality", "stage_first": 3, "stage_last": 3 },
{ "a": "nXX", "b": "k2", "kind": "kept_locality", "stage_first": 3, "stage_last": 3 },
{ "a": "nXX", "b": "k3", "kind": "kept_locality", "stage_first": 3, "stage_last": 3 },
{ "a": "nXX", "b": "p1", "kind": "pruned", "stage_first": 3, "stage_last": 3 },
{ "a": "nXX", "b": "p2", "kind": "pruned", "stage_first": 3, "stage_last": 3 },
{ "a": "nXX", "b": "p3", "kind": "pruned", "stage_first": 3, "stage_last": 3 }
```

(Replace `nXX` with the same inserted-node id used in Task 3.)

- [ ] **Step 2: Extend the rule mark to style these kinds**

Update the rule mark's encoding arrays:

```json
"stroke": [
  { "test": "datum.kind === 'random_init'", "value": "#9aa4b2" },
  { "test": "datum.kind === 'visit'", "value": "#1f6feb" },
  { "test": "datum.kind === 'kept_locality'", "value": "#0a2540" },
  { "test": "datum.kind === 'pruned'", "value": "#e5e7eb" }
],
"strokeOpacity": [
  { "test": "datum.kind === 'random_init' && stage === 2", "value": 0.15 },
  { "test": "datum.kind === 'random_init'", "value": 0.45 },
  { "test": "datum.kind === 'visit'", "value": 1.0 },
  { "test": "datum.kind === 'kept_locality'", "value": 1.0 },
  { "test": "datum.kind === 'pruned'", "value": 0.6 }
],
"strokeWidth": [
  { "test": "datum.kind === 'visit'", "value": 2.5 },
  { "test": "datum.kind === 'kept_locality'", "value": 2.0 },
  { "test": "datum.kind === 'pruned'", "value": 1.0 },
  { "value": 1 }
],
"strokeDash": [
  { "test": "datum.kind === 'pruned'", "value": [3, 3] },
  { "value": [] }
]
```

- [ ] **Step 3: Update narration for stage 3**

Update the `narration` signal:

```
"['60 vectors. Pick a medoid as the entry point.', 'Start from a random graph. Each node has ≤3 edges.', 'Greedy search from the medoid collects candidates near the new node.', 'RobustPrune α=1: keep an edge only if no kept neighbour is already closer.', '', '', ''][stage]"
```

(`α` is `α`.)

- [ ] **Step 4: Build and verify**

Run: `npm run build talks/vector-search-visualised`. Step to stage 3. Expected:
- Blue visit path gone.
- 2–3 solid navy edges from the inserted node to the kept-locality candidates.
- 3 dashed faint edges from the inserted node to the pruned candidates.
- Candidates ring is still visible (purple, from Task 3 — the ring mark's opacity condition includes stage 3).
- Narration: "RobustPrune α=1: keep an edge only if no kept neighbour is already closer."

- [ ] **Step 5: Commit**

```bash
git add visualisations/diskann-vamana.json
git commit -m "$(cat <<'EOF'
feat(viz): stage 3 of DiskANN viz — RobustPrune α=1

Solid edges to locally-nearest kept candidates, dashed ghosts to
pruned ones. The classic NSG-style locality result, used as the
contrast for Vamana's α>1 in the next stage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Stage 3b (using stage 4) — split α contrast

**Note on stage numbering.** The spec described "3a" and "3b" conceptually, but the `signal-stage` array uses integer indices. To split the α contrast, we shift everything: stages become 0, 1, 2, 3 (α=1), 4 (α=1.2), 5 (final), 6 (query). Update `signal-stage` to `[0,1,2,3,4,5,6]` (already correct — it's 7 ints). Internally the stages map cleanly. Final-graph edges currently set to `stage_first: 4` must shift to `stage_first: 5`, and the query stage at 5 must shift to 6.

**Files:**
- Modify: `visualisations/diskann-vamana.json`

**Authoring decisions:**
- Pick one node `s1` from the *pruned* candidates that lies the furthest from `inserted_node` — this is the "long-range" edge that α>1 spares.
- The α=1.2 result is: same kept set as stage 3 (α=1), plus `s1`.

- [ ] **Step 1: Shift existing stage 4+ entries**

In `edges_all.values`, find any entries with `stage_first: 4` (from earlier tasks — there shouldn't be any yet; Task 6 will add them, so this is precautionary). None should exist at this point.

In `inserted_node` and `candidates` data table opacity rules — these aren't stage-bound by `stage_first` but by signal expressions. Update the candidates-ring mark's `opacity` expression to extend the range:

```json
"opacity": { "signal": "stage >= 2 && stage <= 4 ? 1 : 0" }
```

(The ring stays visible through stages 2, 3, and 4 — the candidates are still the relevant set for the α contrast.)

- [ ] **Step 2: Promote one pruned edge to `kept_alpha`**

Modify the entry for `s1` in `edges_all.values` (the one you marked `kind: 'pruned'` in Task 4 step 1) so it has TWO records:

```json
{ "a": "nXX", "b": "s1", "kind": "pruned", "stage_first": 3, "stage_last": 3 },
{ "a": "nXX", "b": "s1", "kind": "kept_alpha", "stage_first": 4, "stage_last": 4 }
```

Also add stage-4 duplicates for the other kept edges so the α=1.2 view shows the full kept set:

```json
{ "a": "nXX", "b": "k1", "kind": "kept_locality", "stage_first": 4, "stage_last": 4 },
{ "a": "nXX", "b": "k2", "kind": "kept_locality", "stage_first": 4, "stage_last": 4 },
{ "a": "nXX", "b": "k3", "kind": "kept_locality", "stage_first": 4, "stage_last": 4 }
```

Alternatively (cleaner), change the existing `kept_locality` entries' `stage_last` to `4` rather than duplicating. Use that approach: open the three kept-locality entries from Task 4 step 1 and change `"stage_last": 3` to `"stage_last": 4`.

- [ ] **Step 3: Style the `kept_alpha` kind**

Extend the rule mark's encoding arrays:

```json
"stroke": [
  { "test": "datum.kind === 'random_init'", "value": "#9aa4b2" },
  { "test": "datum.kind === 'visit'", "value": "#1f6feb" },
  { "test": "datum.kind === 'kept_locality'", "value": "#0a2540" },
  { "test": "datum.kind === 'kept_alpha'", "value": "#c84cff" },
  { "test": "datum.kind === 'pruned'", "value": "#e5e7eb" }
],
"strokeOpacity": [
  { "test": "datum.kind === 'random_init' && stage === 2", "value": 0.15 },
  { "test": "datum.kind === 'random_init'", "value": 0.45 },
  { "test": "datum.kind === 'visit'", "value": 1.0 },
  { "test": "datum.kind === 'kept_locality'", "value": 1.0 },
  { "test": "datum.kind === 'kept_alpha'", "value": 1.0 },
  { "test": "datum.kind === 'pruned'", "value": 0.6 }
],
"strokeWidth": [
  { "test": "datum.kind === 'visit'", "value": 2.5 },
  { "test": "datum.kind === 'kept_locality'", "value": 2.0 },
  { "test": "datum.kind === 'kept_alpha'", "value": 2.5 },
  { "test": "datum.kind === 'pruned'", "value": 1.0 },
  { "value": 1 }
],
"strokeDash": [
  { "test": "datum.kind === 'pruned'", "value": [3, 3] },
  { "value": [] }
]
```

- [ ] **Step 4: Update narration for stage 4**

Update the `narration` signal:

```
"['60 vectors. Pick a medoid as the entry point.', 'Start from a random graph. Each node has ≤3 edges.', 'Greedy search from the medoid collects candidates near the new node.', 'RobustPrune α=1: keep an edge only if no kept neighbour is already closer.', 'RobustPrune α=1.2: spare a long-range shortcut. Diversity → fewer hops at query time.', '', ''][stage]"
```

(`→` is `→`.)

- [ ] **Step 5: Build and verify**

Run: `npm run build talks/vector-search-visualised`. Step through stages 3 → 4. Expected:
- Stage 3: as in Task 4 (3 navy kept edges, 3 dashed pruned edges).
- Stage 4 (α=1.2): the same 3 navy edges remain, the 3 pruned dashes disappear, and a single thick **purple** edge appears connecting `inserted_node` to `s1` (the long-range one).
- Candidates ring still visible.
- Narration: "RobustPrune α=1.2: spare a long-range shortcut. Diversity → fewer hops at query time."

- [ ] **Step 6: Commit**

```bash
git add visualisations/diskann-vamana.json
git commit -m "$(cat <<'EOF'
feat(viz): stage 4 of DiskANN viz — α=1.2 keeps a shortcut

Same locally-nearest edges as α=1, plus one resurrected long-range
edge in brand purple. Lands the Vamana-specific punchline: α>1
trades a small recall hit for shorter hop counts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Stage 5 — final built graph

**Files:**
- Modify: `visualisations/diskann-vamana.json`

- [ ] **Step 1: Update `stage_first` on the FINAL edges in the generator output**

Open `/tmp/diskann-gen.out`. The FINAL section currently has `stage_first: 4` (set by the Task 1 generator). Replace `"stage_first": 4` with `"stage_first": 5` throughout the FINAL block (search-and-replace within that array only). Save the edited array somewhere accessible.

Alternative: re-run the generator after editing the script to set `stage_first: 5` for final edges. Either is fine.

- [ ] **Step 2: Append FINAL edges to `edges_all.values`**

Paste the (updated) FINAL array into `edges_all.values` in `visualisations/diskann-vamana.json`. ~240 entries.

- [ ] **Step 3: Hide the per-insert artefacts at stage 5**

The candidates ring, inserted-node highlight, and visit/kept/pruned/alpha edges shouldn't appear at stage 5.

- The kept/pruned/alpha edges already have `stage_last: 3` or `stage_last: 4`, so they vanish naturally.
- The visit edges already have `stage_last: 2`.
- Update the candidates-ring mark's opacity expression to drop at stage 5:
  - (Already done in Task 5 step 1: `"stage >= 2 && stage <= 4"` covers it.)
- Update the inserted-node highlight's opacity to drop at stage 5:
  ```json
  "opacity": { "signal": "stage >= 2 && stage <= 4 ? 1 : 0" }
  ```

- [ ] **Step 4: Style `final` and `final_shortcut` edge kinds**

Extend the rule mark's encoding arrays:

```json
"stroke": [
  { "test": "datum.kind === 'random_init'", "value": "#9aa4b2" },
  { "test": "datum.kind === 'visit'", "value": "#1f6feb" },
  { "test": "datum.kind === 'kept_locality'", "value": "#0a2540" },
  { "test": "datum.kind === 'kept_alpha'", "value": "#c84cff" },
  { "test": "datum.kind === 'pruned'", "value": "#e5e7eb" },
  { "test": "datum.kind === 'final'", "value": "#0a2540" },
  { "test": "datum.kind === 'final_shortcut'", "value": "#c84cff" }
],
"strokeOpacity": [
  { "test": "datum.kind === 'random_init' && stage === 2", "value": 0.15 },
  { "test": "datum.kind === 'random_init'", "value": 0.45 },
  { "test": "datum.kind === 'visit'", "value": 1.0 },
  { "test": "datum.kind === 'kept_locality'", "value": 1.0 },
  { "test": "datum.kind === 'kept_alpha'", "value": 1.0 },
  { "test": "datum.kind === 'pruned'", "value": 0.6 },
  { "test": "datum.kind === 'final'", "value": 0.65 },
  { "test": "datum.kind === 'final_shortcut'", "value": 0.85 }
],
"strokeWidth": [
  { "test": "datum.kind === 'visit'", "value": 2.5 },
  { "test": "datum.kind === 'kept_locality'", "value": 2.0 },
  { "test": "datum.kind === 'kept_alpha'", "value": 2.5 },
  { "test": "datum.kind === 'pruned'", "value": 1.0 },
  { "test": "datum.kind === 'final'", "value": 1.0 },
  { "test": "datum.kind === 'final_shortcut'", "value": 1.5 },
  { "value": 1 }
],
"strokeDash": [
  { "test": "datum.kind === 'pruned'", "value": [3, 3] },
  { "value": [] }
]
```

- [ ] **Step 5: Update narration for stage 5**

Update the `narration` signal:

```
"['60 vectors. Pick a medoid as the entry point.', 'Start from a random graph. Each node has ≤3 edges.', 'Greedy search from the medoid collects candidates near the new node.', 'RobustPrune α=1: keep an edge only if no kept neighbour is already closer.', 'RobustPrune α=1.2: spare a long-range shortcut. Diversity → fewer hops at query time.', 'Final graph: ≤3 edges per node, with shortcut edges woven in.', ''][stage]"
```

- [ ] **Step 6: Build and verify**

Run: `npm run build talks/vector-search-visualised`. Step to stage 5. Expected:
- All per-insert artefacts gone.
- The full final graph drawn: ~240 directed edges. Most are short navy lines connecting near neighbours; ~60 are thicker purple lines making long-range jumps.
- Medoid still visible as the purple diamond.
- Narration: "Final graph: ≤3 edges per node, with shortcut edges woven in."

- [ ] **Step 7: Delete the scratch generator**

```bash
rm /tmp/diskann-gen.mjs /tmp/diskann-gen.out
```

- [ ] **Step 8: Commit**

```bash
git add visualisations/diskann-vamana.json
git commit -m "$(cat <<'EOF'
feat(viz): stage 5 of DiskANN viz — final built graph

R=3 per node, with one long-range shortcut per node drawn in
brand purple. The visual punchline for "bounded degree, navigable
from one entry point."

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Stage 6 — query traversal + stat card

**Files:**
- Modify: `visualisations/diskann-vamana.json`

**Authoring decisions:**
- Pick query coords `(qx, qy)` off-medoid. The closest few nodes will be the "target neighbours."
- Hand-pick a hop path of 3–4 edges from the medoid through final-graph edges to the nearest neighbour. The path nodes must be adjacent in the final graph (look up the chosen `s1, s2, s3` in the final/final_shortcut edge list).

- [ ] **Step 1: Add `query` data table**

In the `data` array, after the existing entries, add:

```json
{
  "name": "query",
  "values": [ { "x": 8.2, "y": 2.5 } ]
}
```

Pick coords that feel "off-medoid" and have a clear nearest-neighbour. Adjust based on the actual point cloud.

- [ ] **Step 2: Add query-path edges to `edges_all`**

Append (replace `s1`...`s4` with chosen path):

```json
{ "a": "M",  "b": "s1", "kind": "query_path", "stage_first": 6, "stage_last": 6 },
{ "a": "s1", "b": "s2", "kind": "query_path", "stage_first": 6, "stage_last": 6 },
{ "a": "s2", "b": "s3", "kind": "query_path", "stage_first": 6, "stage_last": 6 },
{ "a": "s3", "b": "s4", "kind": "query_path", "stage_first": 6, "stage_last": 6 }
```

Where `s4` is the nearest node to the query.

- [ ] **Step 3: Style `query_path` in the rule mark**

Extend the encoding arrays one more time:

```json
"stroke": [
  /* existing tests */
  { "test": "datum.kind === 'query_path'", "value": "#1f6feb" }
],
"strokeOpacity": [
  /* existing tests */
  { "test": "datum.kind === 'query_path'", "value": 1.0 }
],
"strokeWidth": [
  /* existing tests */
  { "test": "datum.kind === 'query_path'", "value": 3.0 }
],
```

Add the `query_path` lines before the catch-all `{ "value": ... }` defaults in each array.

- [ ] **Step 4: Add query-point mark**

After the candidate-ring mark, add:

```json
{
  "type": "symbol",
  "from": { "data": "query" },
  "encode": {
    "enter": {
      "shape": { "value": "diamond" },
      "size": { "value": 280 },
      "fill": { "value": "#c84cff" },
      "stroke": { "value": "#ffffff" },
      "strokeWidth": { "value": 2 }
    },
    "update": {
      "x": { "scale": "xscale", "field": "x" },
      "y": { "scale": "yscale", "field": "y" },
      "opacity": { "signal": "stage === 6 ? 1 : 0" }
    }
  }
}
```

- [ ] **Step 5: Add stat card overlay**

After the existing narration text mark (the one at the top-left), add a second card in the top-right summarising the hop count:

```json
{
  "type": "rect",
  "encode": {
    "enter": {
      "fill": { "value": "#ffffff" },
      "fillOpacity": { "value": 0.94 },
      "stroke": { "value": "#d1d5db" },
      "strokeWidth": { "value": 1 },
      "cornerRadius": { "value": 8 },
      "x": { "signal": "width - 254" },
      "y": { "value": 14 },
      "width": { "value": 240 },
      "height": { "value": 44 }
    },
    "update": {
      "opacity": { "signal": "stage === 6 ? 1 : 0" }
    }
  }
},
{
  "type": "text",
  "encode": {
    "enter": {
      "fontSize": { "value": 14 },
      "fontWeight": { "value": "bold" },
      "fill": { "value": "#0a2540" },
      "align": { "value": "left" },
      "baseline": { "value": "top" },
      "x": { "signal": "width - 242" },
      "y": { "value": 28 },
      "text": { "value": "4 hops  ·  4 SSD page reads" }
    },
    "update": {
      "opacity": { "signal": "stage === 6 ? 1 : 0" }
    }
  }
}
```

(Update `4 hops` to match the actual path length you picked — e.g. `3 hops · 3 SSD page reads` if your path has 3 edges.)

- [ ] **Step 6: Update narration for stage 6**

Update the `narration` signal:

```
"['60 vectors. Pick a medoid as the entry point.', 'Start from a random graph. Each node has ≤3 edges.', 'Greedy search from the medoid collects candidates near the new node.', 'RobustPrune α=1: keep an edge only if no kept neighbour is already closer.', 'RobustPrune α=1.2: spare a long-range shortcut. Diversity → fewer hops at query time.', 'Final graph: ≤3 edges per node, with shortcut edges woven in.', 'At query time, few hops → few SSD reads. Billions of vectors, RAM-sized footprint.'][stage]"
```

- [ ] **Step 7: Build and verify**

Run: `npm run build talks/vector-search-visualised`. Step to stage 6. Expected:
- A purple diamond appears at the query location.
- A thick blue path runs from the medoid through 3–4 intermediate nodes to the closest node to the query.
- The final-graph edges remain visible behind the path.
- A stat card in the top-right reads "4 hops · 4 SSD page reads" (or your actual count).
- Narration: "At query time, few hops → few SSD reads. Billions of vectors, RAM-sized footprint."
- ArrowRight at stage 6 should advance to the next slide (signal-stage stepper consumes keys only while there are remaining stages).

- [ ] **Step 8: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 9: Walk through every stage end-to-end**

Reload `dist/index.html`. Step from stage 0 to stage 6 with ArrowRight, then back from stage 6 to stage 0 with ArrowLeft. Confirm:
- Every stage's narration matches the table in the spec.
- No edges leak between stages (e.g. visit edges only at stage 2).
- The chart looks clean at every stage — no overlapping artefacts.

- [ ] **Step 10: Commit**

```bash
git add visualisations/diskann-vamana.json
git commit -m "$(cat <<'EOF'
feat(viz): stage 6 of DiskANN viz — query traversal

Off-medoid query point, blue hop path through the final graph,
stat-card overlay tying hop count to SSD page reads. Completes
the 7-stage DiskANN walkthrough.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: README update

**Files:**
- Modify: `README.md`

The user's auto-memory records that README updates are required after user-facing changes. Check whether the existing README enumerates the talks or example visualisations; if it does, add a line referencing the DiskANN viz.

- [ ] **Step 1: Read the README and find the right section**

Run: `grep -n -i "vector-search-visualised\|diskann\|visualisation" README.md`

If the README mentions specific decks or visualisations, append a line about the DiskANN/Vamana stage-driven viz in the appropriate section. If not, no edit needed for this task — confirm with the user before skipping.

- [ ] **Step 2: Build, test, commit (only if README changed)**

```bash
npm test
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): mention DiskANN/Vamana stage-driven visualisation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** All 7 stages from the spec mapped to tasks 1–7. Stage numbering shifted from "3a/3b" conceptual labels in the spec to integer stages 3 and 4 in the implementation (split during Task 5). Final and query stages now sit at 5 and 6. Narration array and `signal-stage: [0,1,2,3,4,5,6]` reflect this.
- **Visual style:** Brand palette baked in. Annotation card pattern from ivf-voronoi reused.
- **Deterministic data:** Mulberry32 PRNG with seed `20260519` ensures the generator produces stable output. Throwaway script lives in `/tmp` and is deleted at end of Task 6.
- **No automated tests added:** The spec is a JSON data file; the existing `npm test` build/bundle tests cover the surrounding pipeline. Verification per task is manual visual inspection — the spec is explicit about this trade-off.
- **README:** Task 8 is conditional on the README actually enumerating visualisations; flagged for the user.

