```deck
- agenda: true
```

{.title .no-chrome}

<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Milvus <br><span class="hero-text smashing">Deep Dive</span>

## Recall, latency, cost — and now, where your data lives

```authors
- name: Simon Hearne
  position: solutions architect
  company: zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```

---

{.small-title}

# Three levers and a new axis

Most teams treat a vector DB as a black box that returns nearest neighbours. By the end of this you'll know which knobs actually move **latency**, **recall** and **cost** — and which ones are folklore.

<blockquote class="blue fragment"><span class="label">Thesis</span><p>Every decision in Milvus is a trade between <span class="hit-text">recall, latency and cost</span> — and 3.0 adds a fourth axis: <span class="hit-text">where your data physically lives</span>.</p></blockquote>

<blockquote class="fragment bottom"><span class="label">Hold this</span><p>Three levers, one new axis — for the next 40 minutes.</p></blockquote>

<!-- SPEAKER NOTE: 3.0 is a beta line. Version-pin every claim against the release page on the day you present. -->

---

{.section}

# Architecture & core concepts

---

# Not the 2.x you deployed

The storage engine and the write path both changed underneath you. <span class="release-badge">New in v3.0</span>

```dot
rankdir=TB
access [label="Access layer\n(stateless proxies)"]
coord [label="Coordinator\n(single, consolidated)", fillcolor="#175fff", fontcolor="white"]
stream [label="Streaming node"]
query [label="Query node"]
data [label="Data node\n(+ index build)"]
storage [label="Object storage (S3)\nStorage V3", shape=cylinder, fillcolor="#e6f0ff", fontcolor="#061982"]
access -> coord
coord -> stream
coord -> query
coord -> data
stream -> storage
query -> storage
data -> storage
```

<blockquote class="fragment bottom"><span class="label">Shape of it</span><p>One coordinator now, not five. Compute on top, <span class="hit-text">truth on object storage</span> underneath.</p></blockquote>

---

# The write path, rebuilt

The streaming node and the **Woodpecker** write-ahead log are the default — no external Kafka or Pulsar to run. <span class="release-badge">Default in v3.0</span>

```dot
client [label="Client write"]
proxy [label="Proxy"]
stream [label="Streaming node"]
wal [label="Woodpecker WAL", fillcolor="#175fff", fontcolor="white"]
obj [label="Object storage", shape=cylinder, fillcolor="#e6f0ff", fontcolor="#061982"]
query [label="Query node\n(reads)"]
client -> proxy -> stream -> wal -> obj
obj -> query
```

<blockquote class="blue fragment"><span class="label">What changed</span><p>The WAL writes straight to object storage. <span class="hit-text">No message-queue cluster</span> to provision, scale, or page you at 3am.</p></blockquote>

---

# Storage V3: truth on object storage

<span class="release-badge">New in v3.0</span>

- **Immutable manifest snapshots** — each dataset version is a self-describing manifest on S3.
- **Delta logs** — entity-level deletes without rewriting the data files.
- **Metadata decoupled from the query path** — a collection scales to more segments without query degradation.

```dot
rankdir=TB
m1 [label="Manifest v1", fillcolor="#175fff", fontcolor="white"]
m2 [label="Manifest v2", fillcolor="#175fff", fontcolor="white"]
seg [label="Segment files\n(columnar, immutable)", shape=box]
delta [label="Delta log\n(deletes)", shape=note, fillcolor="#fbe6ff", fontcolor="#061982"]
m1 -> seg
m2 -> seg
m2 -> delta
```

---

# The words you'll hear next

<style>
  .glossary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.4vw 2.4vw; margin: 3vh 0; }
  .glossary .term { font-weight: 700; color: var(--zilliz-navy); font-size: 1.05em; }
  .glossary .def { opacity: 0.8; }
</style>

<div class="glossary">
  <div><span class="term">Collection</span> — <span class="def">a table: one schema, many entities.</span></div>
  <div><span class="term">Partition</span> — <span class="def">a named slice of a collection you can target.</span></div>
  <div><span class="term">Segment</span> — <span class="def">the immutable unit of storage and indexing.</span></div>
  <div><span class="term">Channel</span> — <span class="def">the logical stream a write flows through.</span></div>
</div>

<blockquote class="bottom"><span class="label">Takeaway</span><p>Compute is stateless and disposable; <span class="hit-text">truth lives on object storage</span>. That one fact explains deployment, HA, and scaling.</p></blockquote>

---

{.section}

# Deployment

---

{.small-title}

# Pick the mode in 90 seconds

```dot
need [label="What do you need?", fillcolor="#175fff", fontcolor="white"]
standalone [label="Standalone\n(single process)\ndev / PoC / small prod"]
dist [label="Distributed\n(Operator / Helm on K8s)\nscale + HA"]
cloud [label="Zilliz Cloud\n(managed)\nGlobal Cluster, Lakebase"]
need -> standalone [label="learn"]
need -> dist [label="run it yourself"]
need -> cloud [label="forget about ops"]
```

| Mode | Data scale | QPS | HA | Ops appetite |
| ---- | ---------- | --- | -- | ------------ |
| Standalone | small | low | none | minimal |
| Distributed | large | high | self-built | high |
| Managed | any | any | built-in | none |

<p><span class="release-badge cloud">Zilliz Cloud</span> Global Cluster and Lakebase are managed-only.</p>

---

# Sometimes, don't ingest at all

<span class="release-badge">New in v3.0</span>

**External Collection** queries lake tables *zero-copy* — no ingestion, no second copy of the data.

Supported formats: **Parquet · Lance · Iceberg · Vortex** (and raw S3).

<blockquote class="blue fragment"><span class="label">Reframe</span><p>"Deployment" now includes <span class="hit-text">what you don't ingest</span> — query the lake table in place.</p></blockquote>

<blockquote class="fragment bottom"><span class="label">Takeaway</span><p>Standalone to learn, Operator to run, managed to forget — and in 3.0, sometimes the answer is <span class="hit-text">don't copy the data in at all</span>.</p></blockquote>

---

{.section}

# Schema & query optimisation

---

{.small-title}

# Your schema is a performance decision

…disguised as a data-modelling decision.

| Choice | Why it matters |
| ------ | -------------- |
| **Primary key** | int64 vs VARCHAR — affects dedupe and delete cost. |
| **VARCHAR `max_length`** | sizes the *write-path buffer*, not steady-state query cost. |
| **Typed scalar vs dynamic / JSON** | typed fields index and filter faster than JSON paths. |
| **Entity-level TTL** <span class="release-badge">New in v3.0</span> | per-row expiry via a timestamp field — no manual cleanup. |

---

# The cheapest optimisation is the field you didn't return

The dominant query-side lever is **output-field / payload width** — not the index. Returning fat fields is usually what makes `query()` slow.

<blockquote class="blue fragment"><span class="label">From a recent benchmark</span><p>Fat <span class="hit-text">array output fields</span>, not the inverted index, were the bottleneck. The index found the rows fast; serialising the payload was the cost.</p></blockquote>

<blockquote class="fragment bottom"><span class="label">Takeaway</span><p>Model for the query you'll actually run. The cheapest optimisation is the <span class="hit-text">field you didn't return</span>.</p></blockquote>

---

{.section}

# Filtering

---

{.small-title .filter-demo}

<style>
  .slide.filter-demo .vega-chart svg { width: 1080px; max-width: 100%; height: auto; }
</style>

# Filtered search fights the graph

The filter and the ANN search pull against each other — the harder you filter, the more of the graph you destroy.

```vega
- spec: ../../visualisations/filter-graph.json
  renderer: svg
  actions: false
  signal-stage: [0, 1, 2]
```

---

{.small-title}

# Narrow results, or narrow work

<div class="three-col cards" style="align-items: stretch; margin: 1.5vh 0;">
<div class="fragment">

**Filter expression**

Boolean expression language + **templating** for faster parsing of complex expressions. Narrows the *result set*.

</div>
<div class="fragment">

**Partition key**

Routes matching entities together at write time. Narrows the *work* — the query touches fewer segments.

</div>
<div class="fragment">

**Scalar indexes**

`INVERTED` for arrays / exact-match, JSON path / flat indexes for nested fields. Back the filter so it isn't a scan.

</div>
</div>

<blockquote class="blue fragment bottom"><span class="label">Takeaway</span><p>A filter narrows <span class="hit-text">results</span>; a partition key narrows <span class="hit-text">work</span>. Reach for the second when the filter is predictable.</p></blockquote>

---

{.section}

# Index selection

---

{.chart-animate .small-title}

# There is no best index

Only the best index for your **recall target**, your **memory budget**, and your **QPS**.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [0,1]
  actions: false
```

---

{.small-title .no-vega-bindings}

# Four families, one question each

<style>
  .idx-thumbs .vega-chart svg { width: 100%; height: auto; max-height: 34vh; }
  .idx-thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.2vw; align-items: start; }
</style>

<div class="idx-thumbs">

```vega
- spec: ../../visualisations/hnsw.json
  renderer: svg
  signal-step: 4
  actions: false
- spec: ../../visualisations/ivf-voronoi.json
  renderer: svg
  signal-stage: 4
  actions: false
- spec: ../../visualisations/diskann-vamana.json
  renderer: svg
  signal-stage: 5
  actions: false
```

</div>

<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1.2vw; margin-top:0.3em; opacity:0.85;">
  <p style="text-align:center; margin:0"><strong>HNSW</strong><br><span style="color:var(--zilliz-blue); font-weight:700">in-memory, low latency?</span></p>
  <p style="text-align:center; margin:0"><strong>IVF</strong><br><span style="color:var(--zilliz-blue); font-weight:700">tunable memory?</span></p>
  <p style="text-align:center; margin:0"><strong>DiskANN</strong><br><span style="color:var(--zilliz-blue); font-weight:700">won't fit in RAM?</span></p>
</div>

<p style="text-align:center; opacity:0.8;">…and <strong>GPU CAGRA</strong> when you need build throughput and very high QPS.</p>

---

{.small-title}

# Choose by the constraint that hurts most

| Index | Recall | Latency | Memory | Build | Wins when |
| ----- | ------ | ------- | ------ | ----- | --------- |
| **HNSW** | high | very low | high | medium | in-memory, latency-critical |
| **IVF** | tunable | low | tunable | fast | you want to dial memory vs recall |
| **DiskANN** | high | medium | low (RAM) | slow | the index won't fit in RAM |
| **GPU CAGRA** | high | low | high | very fast | build throughput + high QPS |

<blockquote class="bottom"><span class="label">Takeaway</span><p>Choose the index by the constraint that hurts most — <span class="hit-text">memory, latency, or build time</span>. The other two follow.</p></blockquote>

---

{.section}

# Quantisation

---

{.small-title}

# Fit a billion vectors in the RAM you can afford

A compression-vs-recall spectrum: **SQ8 → PQ → binary → RaBitQ** <span class="release-badge">v2.6+</span>. The only question that matters is how much recall it costs you.

```vega
- spec: ../../visualisations/compression-recall.json
  renderer: svg
  signal-stage: [0,1]
  actions: false
```

---

# Compress aggressively, rerank honestly

The universal pattern: **quantise for the coarse pass, refine on full-precision vectors**.

1. **Coarse pass** — scan the compressed codes, over-fetch a wide candidate set.
2. **Refine pass** — re-rank that shortlist against retained full-precision vectors.

<blockquote class="blue fragment"><span class="label">Milvus built-in</span><p>Set <code>refine: true</code> at build, tune <code>refine_k</code> at query. Recall lost in quantisation is <span class="hit-text">bought back at search time</span> — if you budget for it.</p></blockquote>

---

{.section}

# Backups, HA & DR

---

{.small-title}

# Three failures, three defences

Most teams build one and assume they're covered.

```dot
rankdir=TB
nodeaz [label="Node / AZ failure"]
cluster [label="Cluster-wide loss"]
corrupt [label="Corruption / bad write"]
replica [label="Multi-replica\n(zero downtime)", fillcolor="#175fff", fontcolor="white"]
cdc [label="CDC standby cluster", fillcolor="#175fff", fontcolor="white"]
backup [label="Periodic backup\n(independent copy)", fillcolor="#175fff", fontcolor="white"]
snap [label="Snapshot\n(point-in-time undo)", fillcolor="#c84cff", fontcolor="white"]
nodeaz -> replica
cluster -> cdc
corrupt -> backup
corrupt -> snap
```

<p style="text-align:center;"><span class="release-badge">v2.6.6+</span> CDC standby &nbsp;·&nbsp; <span class="release-badge">New in v3.0</span> Snapshots</p>

<!-- SPEAKER NOTE: CDC standby DR is documented at Milvus 2.6.6+. Confirm the 3.0 equivalent before presenting it as current; the managed equivalent is Zilliz Cloud Global Cluster. -->

---

# Snapshots: the undo button

<span class="release-badge">New in v3.0</span>

Point-in-time images of a collection, restored by **copying segment files** — claimed **10–100× faster** than backup/restore.

<blockquote class="blue fragment"><span class="label">Distinct from backups</span><p>A snapshot is a lightweight short-term <span class="hit-text">reference</span> for fast rollback. A backup is an independent long-term <span class="hit-text">copy</span>. You want both.</p></blockquote>

<blockquote class="fragment bottom"><span class="label">Takeaway</span><p>Replica, CDC, backup — and now snapshots for the "undo" button. <span class="hit-text">Match the layer to the failure mode</span>, don't pick one and hope.</p></blockquote>

---

{.section}

# Benchmarking & testing

---

{.small-title}

# Most benchmarks measure the network

…not the database. Here's a methodology that survives scrutiny:

- **Warm up**, then take **N repetitions** — report **p50 / p95**, never the mean.
- **Subtract a no-op baseline** to remove the RPC / network floor.
- **Sweep** result-set size × output-field width — that's where the surprises hide.
- Measure **recall against ground truth** (brute force), not assumed.
- **Change one variable at a time** — index level, payload, or filter selectivity.

<blockquote class="fragment bottom"><span class="label">Takeaway</span><p>Measure <span class="hit-text">p95</span>, subtract the floor, change one thing at a time. A benchmark you can't reproduce is an anecdote.</p></blockquote>

---

{.small-title}

# Bring real numbers

<style>
  .nb-placeholder {
    border: 2px dashed var(--zilliz-blue-20);
    border-radius: 12px;
    background: var(--zilliz-blue-10);
    color: var(--zilliz-navy);
    padding: 8vh 2vw;
    text-align: center;
    font-family: var(--zilliz-font-mono);
    margin: 3vh 0;
  }
</style>

<div class="nb-placeholder">
  📓 Drop your benchmark-notebook screenshot here<br>
  <small>save it into this deck folder and swap in the &lt;img&gt; below</small>
</div>

<!-- When you have the screenshot, save it as talks/milvus-deep-dive/benchmark.png and replace the placeholder div with:
<img src="benchmark.png" alt="benchmark notebook" style="max-height:62vh;"> -->

---

{.small-title}

# One decision per section

<style>
  .recap { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.2vh 2.4vw; margin: 3vh 0; font-size: 0.95em; }
  .recap .k { font-weight: 700; color: var(--zilliz-blue); }
</style>

<div class="recap">
  <div><span class="k">Deploy</span> — Standalone → Operator → managed; or don't ingest at all.</div>
  <div><span class="k">Schema</span> — model for the query; don't return fat fields.</div>
  <div><span class="k">Filter</span> — partition key narrows work, not just results.</div>
  <div><span class="k">Index</span> — choose by the constraint that hurts most.</div>
  <div><span class="k">Quantise</span> — compress aggressively, rerank honestly.</div>
  <div><span class="k">Protect</span> — replica, CDC, backup, snapshot — one per failure.</div>
  <div><span class="k">Measure</span> — p95, minus the floor, one variable at a time.</div>
  <div><span class="k">Locality</span> — in 3.0, where the data lives is a knob too.</div>
</div>

<blockquote class="bottom"><span class="label">The point</span><p>Milvus gives you the knobs. Whether you turn them by <span class="hit-text">guesswork or by measurement</span> is the only thing that separates a demo from production.</p></blockquote>

---

{.title .no-chrome}

<img loading="lazy" class="logo" src="../../../img/zilliz-light.svg" alt="">

# Thank you!

## simon @ zilliz.com

```authors
- name: Simon Hearne
  position: solutions architect
  company: zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```
