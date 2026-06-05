# Vector Databases 201 deck design

A follow-on talk to [`talks/vectordb-101/`](../../../talks/vectordb-101/), aimed at engineers who built a 101-style toy and now need to ship a vector DB to production. Lives at `talks/vectordb-201/`. Author: Simon Hearne (matches 101).

## Why

The 101 deck closes with a "What's next" slide promising a 201 talk on production systems: HNSW vs IVF vs DiskANN, hybrid search and reranking, sharding/replication/multi-tenancy, observability. This deck delivers that promise.

It re-uses the existing build pipeline (markdown → HTML, Vega + dot frontmatter, brand chrome). No code changes to [bin/build.js](../../../bin/build.js) are expected; this is a content project.

## Scope decisions

- **Audience: mixed.** Developer-friendly framing throughout, with one or two parameter-deep slides per section for platform/infra engineers in the room. Same voice as 101 — concrete numbers, decision tables, no hand-waving.
- **Length: ~45 slides, ~40 min.** Conference slot, 1 slide/min. Easy to drop 3–5 in dress rehearsal if needed.
- **Voice: concept-first, Milvus-second.** Each section opens with the algorithm/architecture (vendor-neutral), then closes with a `pymilvus` snippet or Milvus config slide that grounds the concept. Mirrors the 101 pattern.
- **Visual budget: ~3 Vega interactives + ~5 dot diagrams.** Roughly the 101 ratio.

## Section structure

### Title + intro (3 slides)

1. **Title** — `Vector Databases 201 / Production-grade systems`. `{.title .no-chrome}`. Same author block as 101.
2. **Recap of 101's promise** — the four bullets from the 101 outro, framed as "you're here because…". One slide.
3. **What you'll leave with** — section promises + the four decision tables this deck delivers.

### Section 1 — Indexes that don't fall over (~12 slides)

Section divider (`{.section}`), then:

1. **The ANN tradeoff space** — five axes: recall, latency, memory, build-time, insert-cost. No single index wins all five.
2. **HNSW intuition** — multi-layer graph, log-style traversal. *dot diagram* of layered graph.
3. **HNSW knobs** — `M`, `efConstruction`, `efSearch`. What each one buys you and what it costs.
4. **HNSW sweet spot** — high QPS, RAM-rich, low-update workloads. The 101's default recommendation.
5. **IVF intuition** — partition into `nlist` cells, probe `nprobe` of them. *vega: 2D Voronoi with query point and probed cells highlighted.*
6. **IVF knobs** — `nlist`, `nprobe`, the `IVF_FLAT`/`IVF_PQ`/`IVF_SQ` family.
7. **IVF sweet spot** — bigger-than-RAM (with PQ), batch ingest, lower QPS.
8. **DiskANN intuition** — Vamana graph on SSD + PQ residuals in RAM. *dot diagram* of the two-tier layout.
9. **DiskANN economics** — when disk wins on $/vector at billion-scale.
10. **Interactive: recall vs latency curves** — *vega* showing parametric curves for HNSW (sweep `efSearch`), IVF (sweep `nprobe`), DiskANN (sweep `L_search`). Toggle the dataset size to see how each scales.
11. **Decision table** — the punchline slide. Five-column table: index × recall ceiling × latency floor × memory cost × best-for workload.
12. **Milvus: same data, three index configs** — `pymilvus` `create_index()` calls side-by-side.

### Section 2 — Hybrid search & reranking (~10 slides)

Section divider, then:

1. **Where dense alone fails** — rare terms, IDs, exact phrases, recency. Concrete query examples (e.g. `"ERROR: ECONNRESET in pod-7f4b"` — semantic search of stack traces is hopeless).
2. **BM25 in 60 seconds** — sparse-vector framing. Term frequency, inverse document frequency, length normalization. Tied to the 101 keyword-search-wall slide.
3. **Two paths, one result list** — *dot pipeline*: query → (BM25 retriever || dense retriever) → fusion → reranker → top-k.
4. **Score fusion** — RRF vs weighted sum vs convex combination. RRF wins because it dodges score normalization entirely.
5. **Interactive: same query, four columns** — *vega* showing one query and a list of candidate documents with BM25 score, dense score, RRF rank, post-rerank rank. Lets the audience see why each stage matters.
6. **Rerankers: cross-encoder vs bi-encoder** — why cross is better and ~10× slower.
7. **The reranker cost slide** — concrete latency numbers (e.g. ColBERT-style 50ms, full cross-encoder 200ms). When reranking pays for itself.
8. **Two-stage architecture** — top-100 dense → top-10 cross-encoder. *dot diagram*.
9. **Milvus: hybrid search API + reranker hookup** — `pymilvus` `hybrid_search()` snippet.
10. **Hybrid pitfalls** — score normalization across heterogeneous retrievers, BM25 corpus drift on streaming ingest, the temptation to over-rerank.

### Section 3 — Distribution & isolation (~11 slides)

Section divider, then:

1. **The unit of scale** — collection → shard → segment → index. Each layer exists for a reason.
2. **Query path through the cluster** — *dot diagram* showing client → coordinator → shards (with replicas) → result merge.
3. **Sharding strategies** — hash on PK (default, even distribution) vs custom routing on a partition-key (data locality, tenant pinning). When each wins.
4. **Replication** — read replicas, write path. Consistency levels: Strong / Bounded / Session / Eventually. Latency implications of each.
5. **The replica-count math** — `replicas ≥ ceil(target_QPS / per_replica_QPS)` plus headroom for failure domains. Concrete worked example.
6. **Multi-tenancy taxonomy** — collection-per-tenant vs partition-key vs RBAC-only. Comparison *table*: isolation strength × blast radius × ops cost × tenant count ceiling.
7. **Noisy neighbour** — query, ingest, and index-build interfere differently. Real symptoms (p99 spikes during builds, ingest lag during query bursts).
8. **Resource groups** — Milvus's primitive for pinning workloads to nodes. When you reach for it.
9. **Failure modes** — Coordinator split-brain, segment compaction stalls, what these look like in metrics.
10. **Milvus: shard / replica / partition-key config** — `pymilvus` snippet with `num_shards`, `num_replicas`, `partition_key_field`.
11. **Picking the topology** — decision flow, reading like a flowchart but rendered as a *dot* diagram or a tight table.

### Section 4 — Observability & alerting (~10 slides)

Section divider, then:

1. **Four golden signals, vector-DB edition** — latency, errors, traffic, saturation. What each means in this context.
2. **The fifth signal: recall regression** — the silent killer. Latency stays flat, results quietly get worse, business metrics rot.
3. **Measuring recall in prod** — frozen ground-truth set, periodic replay, sliding-window comparison. The tradeoff between sample size and coverage.
4. **p99 latency** — what's normal, what's an alert. Compare to the index's published latency floor from Section 1.
5. **Index build queue depth & ingest lag** — the leading indicator of "something's about to break".
6. **Memory pressure & cache evictions** — segment cache hit rate is the canary for IVF/DiskANN-on-disk setups.
7. **Tail behaviour** — p99.9 is where multi-tenancy lies to you. Why averages and even p99 hide noisy-neighbour pain.
8. **Alert pyramid** — page / ticket / log. Which metrics belong on which tier.
9. **Synthetic dashboard mock** — *dot or static SVG* showing a realistic monitoring layout with the metrics above.
10. **"If you only set up three alerts"** — the punchline. Recall regression, p99 latency, ingest lag.

### Outro (3 slides)

1. **What's next: 301** — cost engineering teaser. Mirror 101's outro structure (callbacks to quantization, tiered storage, GPU economics).
2. **Resources** — Milvus docs, Zilliz Learn, source. Same format as 101 closing resources slide.
3. **Hero closer** — `{.hero .no-chrome}`, mirrors 101's `Meaning is a coordinate.` Working line: `Production isn't an index. It's a system.` Open to a better one.

**Total: ~53 slides** including the four section dividers (3 intro + 13 + 11 + 12 + 11 + 3 outro). Section dividers are short and read fast in the room — actual presentation budget is closer to 45–50 minutes. If dress rehearsal runs long, the easiest cuts are the parameter-deep slides (1.3, 1.6) and the failure-modes slide (3.9).

## Interactive specs

The three Vega interactives need their own JSON specs alongside `slides.md`:

- **`ivf-voronoi.json`** — 2D Voronoi diagram. ~200 random points, `nlist=16` cells (Lloyd's iterations or pre-computed offline), a draggable query point, highlights the `nprobe` nearest cells. Slider for `nprobe`. Uses brand colors (matches 101's `knn-2d.json` style).
- **`recall-latency.json`** — parametric line chart, three curves (HNSW, IVF, DiskANN) on the same axes (recall × latency). Each curve's points come from sweeping the index's main quality knob. Dropdown for dataset size (1M / 10M / 100M). Numbers are illustrative, not benchmark-quality — clearly labelled as such on-slide.
- **`hybrid-fusion.json`** — table-as-chart: 10 candidate docs × 4 score columns (BM25, dense, RRF rank, reranked rank). Cell color encodes rank. Dropdown to switch query (3 pre-canned queries showing different failure modes of dense-only).

These specs follow the same conventions as 101's three Vega specs: brand-themed colors, `renderer: svg`, `actions: false`. Built specs are stored in the talk directory and referenced from `slides.md` via the existing `vega` frontmatter.

## Dot diagram inventory

Five dot diagrams, all using the existing brand defaults from `DOT_DEFAULTS`:

1. **HNSW layered graph** (Section 1) — three layers, sparser-on-top, with a search path.
2. **DiskANN two-tier** (Section 1) — RAM box (PQ codes) + SSD box (Vamana graph), arrows showing query flow.
3. **Hybrid retrieval pipeline** (Section 2) — two parallel retrievers → fusion → reranker.
4. **Two-stage retrieval** (Section 2) — top-100 dense → top-10 cross-encoder.
5. **Cluster query path** (Section 3) — client → coordinator → shards × replicas → merge → result.

Plus optionally a sixth for the topology decision flow (Section 3 slide 11) or the dashboard mock (Section 4 slide 9), if a dot rendering reads better than a table or static SVG.

## File layout

```
talks/vectordb-201/
  slides.md
  ivf-voronoi.json
  recall-latency.json
  hybrid-fusion.json
  dist/                 # build output, gitignored
```

No new images expected. The author photo is loaded from the same GitHub avatar URL as 101.

## Out of scope

- **No code changes to the build pipeline.** All content authored within the existing markdown + frontmatter format.
- **No 301-level material.** Quantization, tiered storage, GPU economics, cost math are explicitly deferred.
- **No live demos against a running Milvus instance.** All examples are static code blocks.
- **No benchmark numbers from real hardware.** The recall-latency curves are pedagogical; if real numbers are needed later, they'll come from a separate measurement effort.
- **No new layout classes or build features.** If a slide needs a new chrome variant, the design is wrong — adjust the slide, not the build.

## Open questions

- Hero closer line — `Production isn't an index. It's a system.` is the working draft. Better suggestions welcome before final write.
- Whether the topology decision flow (Section 3 slide 11) should be a dot diagram or a comparison table. Decide during implementation based on which reads cleaner at slide scale.
