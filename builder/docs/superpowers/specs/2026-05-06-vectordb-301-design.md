# Vector Databases 301 deck design

A follow-on talk to [`talks/vectordb-201/`](../../../talks/vectordb-201/), aimed at engineers who have shipped a 201-style vector DB to production and now have to defend its bill. Lives at `talks/vectordb-301/`. Author: Simon Hearne (matches 101/201). Closes the trilogy.

## Why

Both 101 and 201 close with explicit "what's next" pointers to a 301 talk on cost engineering — quantization, tiered storage, GPU economics, and the math of *"vector DB is 40% of my AI bill."* 201 also reframed the axis: same shape, same voice, **`$/recall` instead of `latency/recall`**. This deck delivers on that promise.

It re-uses the existing build pipeline (markdown → HTML, Vega + dot frontmatter, brand chrome). No code changes to [bin/build.js](../../../bin/build.js) are expected; this is a content project.

## Scope decisions

- **Audience: mixed.** Developer-friendly framing throughout, with one or two parameter-deep slides per section for platform/infra engineers in the room. Same voice as 101/201 — concrete numbers, decision tables, no hand-waving.
- **Length: ~43 slides, ~38–40 min.** Conference slot, ~1 slide/min. Easy to drop 3–5 in dress rehearsal if needed.
- **Voice: concept-first, Milvus-second.** Each section opens with the algorithm/architecture (vendor-neutral), then closes with a `pymilvus` snippet or Milvus config slide that grounds the concept. Mirrors the 101/201 pattern.
- **Visual budget: 4 Vega interactives + 4 dot diagrams.** One more Vega than 201 — the extra slot is the rotation visualiser in Section 1, where the concept earns it.
- **Numbers policy.** Conceptual curves stay illustrative (same caveat as 201's recall-latency). The cost calculator and GPU break-even chart use **real public pricing** (AWS instance prices, Zilliz Cloud tiers) pinned to a single `// constants — as of 2026-05` block at the top of each JSON spec. On-slide dated disclaimer. Updating the deck a quarter from now = editing one block per spec.
- **Thesis: `The bill is the third axis.`** First axis was meaning (101). Second was production (201). Third is cost.

## Section structure

### Title + intro (3 slides)

1. **Title** — `Vector Databases 301 / Cost engineering at scale`. `{.title .no-chrome}`. Same author block as 101/201 (GitHub avatar URL).
2. **You're here because 201 clicked** — the four bullets from 201's outro framed as "you've shipped, now the bill arrived". Mirrors 201's "you're here because 101 clicked".
3. **What you'll leave with** — four decision tools: a quantization choice, a tiering policy, a GPU break-even point, a cost calculator.

### Section 1 — Quantization (~12 slides)

Section divider (`{.section}`), then:

1. **Why every vector DB ends up here** — `100M × 768 × 4 = 307 GB` raw. RAM is the cost ceiling. Quantization is how you push the ceiling down.
2. **PQ intuition** — chop a vector into chunks, quantize each chunk against its own learned codebook. Concept-first, no Hilbert spaces.
3. **PQ knobs** — `m` (sub-vectors), `nbits` (bits per code). Compression ratio = `(d × 32) / (m × nbits)`. What each knob costs in recall.
4. **SQ — the cheap middle ground** — fp16 / int8. 2× / 4× compression, near-lossless recall. Often the right first move before reaching for PQ.
5. **Binary + Hamming** — 32× compression, the recall cliff. Why it's mostly used as a candidate-generation stage, not standalone.
6. **Why quantization wastes bytes** *(rotation tricks, slide 1 of 2)* — PQ assumes each chunk carries equal information. Real embeddings have lopsided variance. Plain-English metaphor: *darts on a board, 90% along one diagonal — most grid cells empty, bits wasted.* Static **before** figure: 2D cloud aligned diagonally + PQ-style grid → empty cells highlighted.
7. **Rotate first, quantize second** *(rotation tricks, slide 2 of 2)* — pre-multiply every vector by a learned rotation matrix `R`. Done once, offline. At query time it's a single matrix multiply. **OPQ** = PQ + rotation. **RaBitQ** = binary quantization + rotation, with a recall guarantee vanilla binary lacks. Punchline: OPQ typically buys back **5–15% recall** at the same compression ratio. *Vega interactive:* rotation visualiser (`rotation-visualizer.json`).
8. **Two-stage rerank with full-precision residuals** — quantized search to top-N candidates, exact rescore on the candidates. The pattern that keeps recall intact at 1/8 the RAM. Most production systems run this even when they don't call it that.
9. *Vega interactive:* recall-vs-compression curves (`compression-recall.json`) — FP32 / SQ8 / PQ / Binary on the same dataset; embedding-dim dropdown.
10. **Decision table** — technique × compression × recall cost × build cost × best-for workload. Five-column punchline.
11. **Milvus: same data, three quantization configs** — `pymilvus` snippet showing FP32, SQ8, and OPQ-PQ side-by-side. Three lines change.
12. **Pitfalls** — re-quantizing on each model swap, codebook drift on streaming ingest, recall measured on training data only.

### Section 2 — Tiered storage (~10 slides)

Section divider, then:

1. **The storage hierarchy** — RAM (~$5/GB/mo) → NVMe (~$0.10/GB/mo) → object store (~$0.02/GB/mo). Per-byte costs are the whole game. *dot diagram:* the three tiers with $/GB ratios overlaid.
2. **Hot tier: HNSW or IVF in RAM** — the 201 default. Best latency, worst $/GB. When the working set fits.
3. **Warm tier: DiskANN on NVMe** — recap from 201, now with the cost story attached. PQ summary in RAM, graph on disk. ~10× cheaper per byte than hot.
4. **Cold tier: segments on object store** — S3/GCS-backed segments, fetched on first query. Latency hit (hundreds of ms), $/GB drop (~250× vs RAM).
5. **Access patterns drive placement** — Zipfian query distributions: most vectors are cold, a small hot fraction carries most QPS. The lever is *fraction*, not raw size.
6. **Query path across tiers** — *dot diagram:* cache hit / promotion / cold pull, with the latency cost annotated on each path.
7. **Time-based tiering** — recency-driven offload (logs, events, chat history). When age is a reliable cold-signal and when it isn't.
8. **Mmap as the sleeper option** — let the OS handle hot/warm via memory-mapped files. When it works (read-mostly, predictable working sets), when it lies (cold-page tail latency masquerading as healthy averages).
9. **Pitfalls** — tail-latency from cold pulls, over-eager eviction during ingest spikes, tiering interacting badly with replication (each replica fetches independently from object store).
10. **Milvus: segment-level cache and mmap** — `pymilvus` snippet with cache config + `mmap.enabled`. Two knobs that swing $/recall by 5×.

### Section 3 — GPU economics (~6 slides)

Section divider, then:

1. **Where GPUs win, where they lose** — single framing slide. Win: index build (10–50× CPU on HNSW/IVF/CAGRA builds), high-QPS batch search at large `k`. Lose: low-QPS workloads (idle GPU is a tax), tiny indexes, latency-sensitive single-query paths.
2. **CAGRA in one slide** — Milvus's GPU graph index. Name + one-sentence intuition (GPU-native graph traversal). No mechanics deep-dive — those who care can read the paper.
3. **The break-even concept** — at what QPS does a GPU instance beat a CPU fleet on $/query? Sets up the chart on the next slide.
4. *Vega interactive:* GPU break-even (`gpu-breakeven.json`) — sweep QPS on x-axis, plot $/query for CPU fleet vs GPU node, crossover highlighted. Toggle index type (HNSW vs CAGRA). Real public pricing in constants block.
5. **Decision table** — workload shape × GPU $/hr × CPU baseline → pick. Three rows: high-QPS-search / heavy-build / steady-state.
6. **Milvus: CAGRA + GPU resource group** — `pymilvus` snippet building a CAGRA index and pinning it to a GPU resource group.

### Section 4 — The cost calculator (~10 slides)

Section divider, then:

1. **Vector DB is 40% of your AI bill** — where the money actually goes (RAM > replicas > GPU > storage > network). *dot diagram* (or static figure if it reads better) showing the breakdown.
2. **The cost formula** — `monthly_cost ≈ (vectors × bytes_per_vector × replicas × $RAM/GB) + (QPS / per_node_QPS × $node/hr × 730) + …` Plain enough to be sketched on a whiteboard.
3. **Knob 1: compression** — same dataset, three quantization configs from Section 1, three concrete cost numbers. The largest single lever.
4. **Knob 2: tiering** — the hot fraction is the lever. Worked example: 10% hot ≈ 5× cost cut at acceptable p99.
5. **Knob 3: replicas** — the QPS / failure-domain math from 201, now in dollars. The hidden cost of "just add a replica."
6. **Knob 4: managed vs self-hosted** — operational cost is real and rarely on the spreadsheet. Honest comparison framed around what you actually get with managed:
   - **Cardinal** — Zilliz Cloud's proprietary search engine. Typically 2–10× QPS over OSS Milvus on identical hardware. Changes the `per_node_QPS` denominator in the cost formula, which cascades through the whole bill.
   - **AUTOINDEX** — auto-tuned index selection and parameter setting. Eliminates the index-tuning labour line that self-hosted operators usually forget to price in (an SRE-week per quarter is real money).
   - Net effect: managed list price per node is higher, but `$/query` is often *lower* once Cardinal's QPS advantage and AUTOINDEX's labour savings are honestly accounted for. Drafted as analysis, not pitch — slide explicitly shows the math both ways.
7. *Vega interactive:* **the cost calculator** (`cost-calculator.json`). Detailed below in the "Interactive specs" section.
8. **`$/recall`: the Pareto frontier** — same chart shape as 201's recall-latency curve, but the axis is cost. Three quantization configs, three points on the frontier. The visual that makes the trilogy click.
9. **Pitfalls** — egress fees, cross-AZ replication traffic, idle dev clusters, the trap of optimizing `$/vector` instead of `$/query`.
10. **If you only do three things** — the punchline: quantize aggressively, tier by access pattern, right-size replicas to actual QPS not peak fear.

### Outro (3 slides)

1. **Where to next** — pointer back to Milvus tuning docs and Zilliz Cloud sizing tools. No 401 — this is the trilogy ender.
2. **Resources** — Milvus docs, Zilliz Learn, OPQ paper (Ge et al. 2013), RaBitQ paper (Gao & Long 2024), CAGRA paper, source link. Same format as 101/201 closing.
3. **Hero closer** — `{.hero .no-chrome}`. Line: **`The bill is the third axis.`** Mirrors 101's *"Meaning is a coordinate."* and 201's *"Production isn't an index. It's a system."*

**Total: ~43 slides** including the four section dividers (3 intro + 12 + 10 + 6 + 10 + 3 outro). Section dividers read fast in the room — actual presentation budget is closer to 38–40 minutes. If dress rehearsal runs long, the easiest cuts are the parameter-deep slides (1.3 PQ knobs, 2.7 mmap), 1.12 pitfalls, or the rotation-visualiser slide if the audience is keeping pace without it.

## Interactive specs

The four Vega interactives need their own JSON specs alongside `slides.md`. All follow the same conventions as 101/201 specs: brand-themed colors, `renderer: svg`, `actions: false`. Built specs are stored in the talk directory and referenced from `slides.md` via the existing `vega` frontmatter.

- **`compression-recall.json`** — recall (y) vs compression ratio (x), four series: FP32 (anchor), SQ8, PQ, Binary. Dropdown for embedding dim (384 / 768 / 1536) re-shapes the curves. Numbers are illustrative; on-slide footnote says so.
- **`rotation-visualizer.json`** — 2D rotation tutorial. ~300 points sampled from a tilted Gaussian (correlated 2D cloud). Fixed PQ-style quantization grid overlaid. User drags a rotation slider 0°→90°; the cloud rotates relative to the grid. Live counter: "cells used / cells total". Highlight optimal angle when reached. Brand colours; same visual language as 201's `ivf-voronoi.json`.
- **`gpu-breakeven.json`** — sweep QPS on x-axis (log scale, 10 → 100K), plot two curves on y-axis: $/query for a CPU fleet (auto-scaled to meet QPS at fixed p99) and $/query for a single GPU node. Crossover marked with a vertical line and the QPS at which GPU starts paying off. Index-type toggle (HNSW / CAGRA) shifts both curves. **Pricing constants live in a single `// constants — as of 2026-05` block at the top of the spec** — AWS r6i / g6 prices, fixed per-node QPS assumptions. Updating quarterly = editing one block.
- **`cost-calculator.json`** — the centerpiece. Inputs (sliders/dropdowns):
  - Dataset size (1M / 10M / 100M / 1B)
  - Vector dimensionality (384 / 768 / 1536)
  - Quantization (FP32 / SQ8 / PQ / Binary+rerank)
  - Hot fraction (0–100%, drives RAM vs SSD split)
  - Replicas (1–6)
  - Target QPS (100 / 1K / 10K)
  - Deployment (self-hosted on AWS / Zilliz Cloud)

  Deployment toggle isn't a flat price markup. When `Zilliz Cloud` is selected the model:
  - Multiplies `per_node_QPS` by a Cardinal factor (default 3×, range tunable in the constants block) — fewer nodes needed for the same QPS target.
  - Sets the index-tuning labour line to zero (AUTOINDEX absorbs it); self-hosted carries an SRE-quarterly line item.
  - Applies Zilliz Cloud's published per-CU pricing instead of raw AWS instance prices.

  Outputs:
  - Headline `$X / month`
  - Stacked bar: RAM / SSD / compute / network / **ops-labour** (non-zero on self-hosted, zero on Zilliz Cloud thanks to AUTOINDEX) / **managed-overhead** (zero on self-hosted, non-zero on Zilliz Cloud — the per-CU markup). The two trade off visibly when the toggle flips.
  - Derived figures: `$/query`, `$/million-vectors-stored`
  - "Biggest lever" callout — the input whose marginal change most reduces the headline cost given the current settings

  Same `// constants — as of 2026-05` pricing block at top of the spec.

## Dot diagram inventory

Four dot diagrams, all using the existing brand defaults from `DOT_DEFAULTS`:

1. **Storage hierarchy** (Section 2 opener) — RAM / NVMe / object store with `$/GB` ratios overlaid.
2. **Query path across tiers** (Section 2) — cache hit / promotion / cold pull, latency cost on each path.
3. **Cost breakdown** (Section 4 opener) — where each $ of the bill goes (RAM > replicas > GPU > storage > network). May render better as a static SVG sankey; decide during implementation, fall back to a dot bar-stack if SVG is fiddly.
4. *(reserved)* — one slot for whichever of slides 1.6 or 4.1 needs a dot rendering vs. a static figure. Final count may be 3 if both render better statically.

The 201 ratio was 5 dots. 301 trims one — Section 3's slimmed shape doesn't earn a topology diagram, and the cost story is more naturally a single hero figure than a multi-step pipeline.

## Static figures (non-Vega, non-dot)

Two static figures are referenced inline in Section 1's rotation slides:

- **Slide 1.6 "before"** — 2D cloud aligned diagonally + PQ-style grid, empty cells highlighted.
- **Slide 1.7 "after"** — same cloud rotated to align with the grid, most cells now occupied.

Author hand-drawn or rendered from a tiny script in the talk directory. Stored as `before.svg` / `after.svg` alongside the JSON specs. These are pedagogical setup for the rotation visualiser interactive — they show the static end-states, the visualiser shows the journey between them.

## File layout

```
talks/vectordb-301/
  slides.md
  compression-recall.json
  rotation-visualizer.json
  gpu-breakeven.json
  cost-calculator.json
  before.svg              # rotation slide 1.6
  after.svg               # rotation slide 1.7
  dist/                   # build output, gitignored
```

No new images expected beyond the two static SVGs. Author photo loads from the same GitHub avatar URL as 101/201.

## Out of scope

- **No code changes to the build pipeline.** All content authored within the existing markdown + frontmatter format.
- **No 401-level material.** This is the trilogy ender. No follow-on teaser slide.
- **No live demos against a running Milvus instance.** All examples are static code blocks.
- **No real-hardware benchmarks.** Conceptual curves are illustrative; calculator and GPU break-even use dated public pricing with a single-block constants policy.
- **No new layout classes or build features.** If a slide needs a new chrome variant, the design is wrong — adjust the slide, not the build.
- **No phase-2 backlog.** The rotation visualiser is in scope, not deferred. The deck ships with all four Vega interactives or it doesn't ship.

## Open questions

- Whether the cost-breakdown slide (4.1) reads better as a dot diagram or a static SVG sankey. Decide during implementation based on which actually renders cleanly at slide scale.
- Whether the static `before.svg` / `after.svg` for the rotation slides should be hand-drawn (faster, less polished) or generated by a tiny script committed alongside (slower, reproducible). Default: script, for the same reproducibility reasons the Vega specs follow.
