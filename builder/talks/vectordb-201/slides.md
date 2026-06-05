{.title .no-chrome}
<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Vector Databases 201
## Production-grade systems

```authors
- name: Simon Hearne
  position: Solutions Architect
  company: Zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```

---

# You're here because 101 clicked

The first deck got you to *meaning is a coordinate*. That's the toy.

Production is the rest of the iceberg:

- Picking an index that survives your QPS and your RAM budget
- Hybrid search when dense alone misses the obvious
- Sharding, replication, and keeping tenants out of each other's hair
- Knowing when something is silently breaking — before the business does

---

# What you'll leave with

Four decision tables and the mental model behind each:

1. **Index choice** — HNSW vs IVF vs DiskANN, on five axes
2. **Hybrid pipeline** — when each stage is worth its latency
3. **Topology** — sharding, replicas, multi-tenancy patterns
4. **Alerts** — the three you actually need

Concept-first, with `pymilvus` for the concrete shape.

---

{.section}
# Indexes that don't fall over

---

# The ANN tradeoff space

No index wins on every axis. You're picking which to lose:

| Axis | What it costs you |
|---|---|
| **Recall** | how often the true top-k makes it back |
| **Query latency** | p99 in ms |
| **Memory** | bytes per vector resident in RAM |
| **Build time** | seconds to absorb a million new vectors |
| **Insert cost** | latency hit for live writes vs batch rebuilds |

Three families dominate: HNSW, IVF, and DiskANN. They lose on different axes.

---

# HNSW — graphs all the way down

A multi-layer proximity graph. Sparse at the top, dense at the bottom. Search starts at a top-layer entry point, greedily descends, and converges in `O(log n)`-ish hops.

```vega
- spec: ../../visualisations/hnsw.json
  renderer: svg
  actions: false
```

<p class="small">The graph itself is the index. The index lives in RAM.</p>

---

# HNSW knobs

| Param | What it does | Bigger means |
|---|---|---|
| **`M`** | edges per node | better recall, more RAM, slower build |
| **`efConstruction`** | candidate-list width during build | better graph quality, slower build |
| **`efSearch`** | candidate-list width per query | better recall, slower query |

Build-time knobs (`M`, `efConstruction`) are baked in. Query-time knob (`efSearch`) is a dial you can twist per request.

Reasonable starting point: `M=16`, `efConstruction=200`, `efSearch=64`. Move from there.

---

# HNSW sweet spot

Reach for HNSW when:

- Recall must be ≥ 0.95
- p99 latency budget is tight (sub-20ms)
- Working set fits in RAM (figure 2–3× raw vector bytes)
- Inserts are batched, not write-heavy
- QPS is the dominant cost

This is the 101's "default recommendation" index. It's the default for a reason.

---

# IVF — partition first, search second

Cluster all vectors into `nlist` Voronoi cells (k-means, offline). At query time, find the `nprobe` cells closest to the query and search only those.

```vega
- spec: ../../visualisations/ivf-voronoi.json
  renderer: svg
  actions: false
```

<p class="small">Click anywhere to drop a query. Slide `nprobe` to widen the search. More cells probed → higher recall, higher latency.</p>

---

# IVF knobs

| Param | What it does | Bigger means |
|---|---|---|
| **`nlist`** | number of cells (set at build) | finer partitions, slower build, more centroids in RAM |
| **`nprobe`** | cells searched per query | higher recall, slower query |
| **PQ codes** | optional per-vector compression | smaller index, lower recall |

Rule of thumb: `nlist ≈ √n`. So a 10M-vector collection wants ~3000 cells.

`IVF_FLAT` keeps full vectors. `IVF_PQ` quantizes them. `IVF_SQ` is the cheap middle ground.

---

# IVF sweet spot

Reach for IVF when:

- Dataset is bigger than RAM (`IVF_PQ` lets you fit 100M vectors in 10s of GB)
- Ingest is batchy — full rebuilds are tolerable
- Recall budget is relaxed (0.85–0.95)
- QPS is moderate

The classic "we have lots of vectors and not lots of RAM" choice.

---

# DiskANN — index on SSD, recall in RAM

A Vamana graph that lives on disk. PQ-compressed vectors stay in RAM as a small "summary" index. Query traverses the graph on disk; the in-RAM PQ codes do the heavy filtering before the I/O.

```dot
rankdir=LR
subgraph cluster_ram {
  label="RAM"
  style=dashed
  color="#1f6feb"
  P [label="PQ codes\n(per-vector summary)"]
}
subgraph cluster_ssd {
  label="SSD"
  style=dashed
  color="#9aa4b2"
  V [label="Vamana graph\n+ full vectors" shape=cylinder]
}
Q [label="Query"]
R [label="Top-k"]
Q -> P
P -> V [label="candidate IDs"]
V -> R
```

The trick: SSD is 100× cheaper per byte than RAM. DiskANN uses that without giving up the latency you'd lose to a naive "store on disk" index.

---

# DiskANN economics

The cost story at scale:

- 100M × 768d × 4 bytes = **307 GB** raw vectors
- HNSW in RAM: ~600 GB resident (graph overhead). On AWS r6i, that's ~$4/hr per instance, plus replicas.
- DiskANN: ~15–30 GB RAM (PQ codes) + 300 GB SSD. Comparable QPS, fraction of the cost.

p99 takes a hit — typically 30–80 ms vs HNSW's 5–20 ms. If your latency budget allows, the cost delta is hard to argue with.

---

# Recall vs latency — pick a Pareto point

Sweep each index's main quality knob. Same data, three curves. Switch dataset size to see how each scales.

```vega
- spec: ../../visualisations/recall-latency.json
  renderer: svg
  actions: false
```

<p class="small">Numbers are illustrative shapes, not benchmarks. The point is the *shape* of each curve — HNSW's wall on the left, DiskANN's flatter slope at the top, IVF's tunability.</p>

---

# Picking an index

| Index | Recall ceiling | Latency floor | Memory | Best for |
|---|---|---|---|---|
| **HNSW** | 0.99+ | 1–10 ms | 2–3× raw | high QPS, RAM-rich, batch ingest |
| **IVF_PQ** | 0.95 | 5–30 ms | 0.1–0.3× raw | huge dataset, tight RAM, batch ingest |
| **DiskANN** | 0.98 | 30–80 ms | 0.1× raw + SSD | billion-scale, cost-sensitive |

If you can fit the working set in RAM and need sub-10ms — HNSW. If not — DiskANN before IVF_PQ unless you're already operating IVF.

---

# Same data, three index configs

```python
from pymilvus import MilvusClient

client = MilvusClient(uri="./milvus.db")

def make_params(index_type, params):
    p = client.prepare_index_params()
    p.add_index(field_name="vector", index_type=index_type,
                metric_type="COSINE", params=params)
    return p

# Three configs side-by-side — pick one. One index per field at a time.

# HNSW — RAM-resident, high recall, low latency
client.create_index(collection_name="docs", index_params=make_params(
    "HNSW", {"M": 16, "efConstruction": 200}))

# IVF_PQ — compressed, lower memory
client.create_index(collection_name="docs", index_params=make_params(
    "IVF_PQ", {"nlist": 1024, "m": 16, "nbits": 8}))

# DiskANN — graph on SSD
client.create_index(collection_name="docs", index_params=make_params(
    "DISKANN", {"search_list": 100}))
```

Three lines change. The rest is the same collection, the same data, the same queries.

---

{.section}
# Hybrid search & reranking

---

# Where dense alone fails

Dense embeddings encode *meaning*. They are remarkably bad at:

- **Rare terms** — `K8s 1.29 CSI driver`, `RFC 9421`
- **IDs and codes** — `INV-204871`, `pod-7f4b`
- **Exact phrases** — `"the quick brown fox"` as a literal quote
- **Recency** — yesterday's outage doesn't have a meaning yet

Try semantic search on `ERROR: ECONNRESET in pod-7f4b`. It returns generic "connection error" docs and ignores the pod name — the most diagnostic token in the query.

---

# BM25 in 60 seconds

Score a document for a query by combining:

- **Term frequency** — does this doc contain the query terms, and how often
- **Inverse document frequency** — rare terms are worth more
- **Length normalization** — long docs aren't penalized for being long

Decades-old, well-understood, blindingly fast. Sparse vectors: each dimension is a term, most values are zero.

BM25 is a vector search too. It just lives in a different geometry.

---

# Two paths, one result list

```dot
rankdir=LR
Q [label="Query"]
B [label="BM25\nretriever"]
D [label="Dense\nretriever"]
F [label="Score fusion\n(RRF)"]
R [label="Reranker\n(cross-encoder)"]
T [label="Top-k"]
Q -> B
Q -> D
B -> F
D -> F
F -> R -> T
```

Run both. Fuse. Rerank. The whole pipeline is ~50–250 ms depending on the reranker.

---

# Score fusion, three ways

| Method | Formula | When |
|---|---|---|
| **RRF** | `1/(k+rank)` summed across retrievers | the default — no normalization needed |
| **Weighted sum** | `α·s_dense + (1-α)·s_bm25` | when scores are pre-calibrated |
| **Convex combination** | per-query learned `α` | research-grade, rarely worth it |

RRF wins because it sidesteps score normalization entirely — different retrievers produce scores on different scales, and trying to reconcile them is a swamp. Use ranks, not scores.

`k=60` is the canonical RRF constant. Don't tune it.

---

# Same query, four columns

Pick a query. See where each retriever ranks the same five candidate docs.

```vega
- spec: ../../visualisations/hybrid-fusion.json
  renderer: svg
  actions: false
```

Notice the `INV-204871` query: BM25 nails the invoice, dense buries it. The fused column is what your user actually sees.

---

# Rerankers — cross > bi, slowly

Bi-encoders embed the query and the doc independently, then dot-product. That's what your dense retriever already does — fast, cheap, decent.

Cross-encoders feed `(query, doc)` *together* through the model and produce a relevance score. Much better signal — at the cost of one model call per candidate.

| | Bi-encoder | Cross-encoder |
|---|---|---|
| Latency | ~1ms / doc | ~10–20ms / doc |
| Quality | good | great |
| Use as | first-stage retriever | second-stage reranker |

You can't cross-encode a million docs per query. You can cross-encode the top 50 from a hybrid retrieval. That's the whole game.

---

# When reranking pays for itself

Concrete latency cost on a CPU reranker:

- ColBERT-style (lightweight): ~50ms for top-100
- Full cross-encoder (e.g., MiniLM): ~150–250ms for top-100
- LLM-as-reranker (e.g., GPT-4-class): ~500–2000ms

Worth it when:

- The top-1 result quality drives your business metric (search, support routing)
- You can budget the latency

Skip it when:

- Top-k > 20 and the LLM downstream will rerank anyway (RAG)
- p99 must be sub-100ms end-to-end

---

# Two-stage retrieval

```dot
rankdir=LR
Q [label="Query"]
H [label="Hybrid retriever\n(BM25 + dense + RRF)"]
T100 [label="Top-100"]
X [label="Cross-encoder\nreranker"]
T10 [label="Top-10"]
Q -> H -> T100 -> X -> T10
```

100 candidates is the sweet spot. Big enough to contain the right answer almost always; small enough that a 200ms reranker pass is tolerable.

---

# Milvus hybrid + reranker

```python
from pymilvus import MilvusClient, AnnSearchRequest, RRFRanker
# embed() and bm25_sparse() are your app-side encoders

dense_req  = AnnSearchRequest(data=[embed(q)], anns_field="vector",
                              param={"nprobe": 16}, limit=100)
sparse_req = AnnSearchRequest(data=[bm25_sparse(q)], anns_field="sparse",
                              param={}, limit=100)

results = client.hybrid_search(
    collection_name="docs",
    reqs=[dense_req, sparse_req],
    ranker=RRFRanker(k=60),
    limit=10,
)
```

Cross-encoder reranking happens after, in your application. Milvus returns the top-k fused; you call your reranker on the candidates and resort.

---

# Hybrid pitfalls

- **Score normalization is a tarpit** — if you must do weighted sum, use rank-percentiles, not raw scores. RRF avoids the problem entirely.
- **BM25 corpus drift** — IDF depends on the whole corpus. Streaming ingest changes it under your feet. Recompute periodically.
- **Reranking too aggressively** — running a cross-encoder on top-1000 is wasteful. Top-50 to top-100 is the band.
- **Forgetting to re-evaluate** — your hybrid weights and reranker model both go stale. Treat them as code.

---

{.section}
# Distribution & isolation

---

# The unit of scale

```text
collection
  └── shard       (horizontal partition, fixed at create time)
       └── segment   (immutable file, ~1 GB, the index lives here)
            └── index   (HNSW/IVF/DiskANN over the segment's vectors)
```

Each level has a job:

- **Collection** — schema and access boundary
- **Shard** — parallelism unit; queries fan out, results merge
- **Segment** — the unit of compaction, replication, and cache
- **Index** — the unit of recall/latency tuning

Tuning happens at every level. Most operators only think about the top one.

---

# The query path

```dot
rankdir=LR
C [label="Client"]
P [label="Proxy /\nCoordinator"]
S1 [label="Shard 1\nreplicas R1, R2"]
S2 [label="Shard 2\nreplicas R1, R2"]
S3 [label="Shard 3\nreplicas R1, R2"]
M [label="Merge\n+ top-k"]
R [label="Result"]
C -> P
P -> S1
P -> S2
P -> S3
S1 -> M
S2 -> M
S3 -> M
M -> R
```

<p class="small">Fan-out, fan-in. Latency is `max(per-shard) + merge`. One slow replica anywhere on the path stretches the whole query.</p>

---

# Sharding strategies

| Strategy | Where vectors land | Wins for |
|---|---|---|
| **Hash on PK** | uniform random | balanced load, no skew, default |
| **Custom partition key** | grouped by `tenant_id` / `region` | data locality, tenant pinning, GDPR boundaries |

Hash sharding is the right default. Reach for partition keys when you have:

- A multi-tenant pattern where most queries scope to one tenant
- A regulatory boundary that must keep data physically separated
- A predictable hot tenant you want isolated from cold ones

Number of shards is fixed at collection creation. Pick conservatively — easier to add replicas than to reshard.

---

# Replication

A replica is a full copy of every segment on a different node. Reads round-robin across replicas. Writes hit all of them (eventually).

| Consistency | Read sees writes from… | Latency hit |
|---|---|---|
| **Strong** | committed before the read | high — wait for sync |
| **Bounded** | within a staleness window (e.g., 5s) | medium |
| **Session** | the same session's prior writes | low |
| **Eventually** | whenever they propagate | none |

`Bounded` is the production default for vector workloads — you almost never need strict read-your-writes for a search query, and the latency win is real.

---

# How many replicas?

Two constraints, both must hold:

```text
replicas ≥ ceil(target_QPS / per_replica_QPS)
replicas ≥ failure_domain_count + 1
```

Worked example. Target: 5000 QPS, p99 budget 50ms. A single HNSW shard does ~1500 QPS at that latency. Three AZs.

- QPS constraint: `ceil(5000/1500) = 4`
- Failure constraint: `3 + 1 = 4`
- Verdict: **4 replicas** per shard.

Now multiply by shards. This is how vector DB bills get scary.

---

# Multi-tenancy — three patterns

| Pattern | Isolation | Blast radius | Ops cost | Tenant ceiling |
|---|---|---|---|---|
| **Collection per tenant** | strongest | one tenant | high (N collections) | ~thousands |
| **Partition key** | medium | shared shards, isolated by key | low | millions |
| **RBAC only** | weakest | shared everything | lowest | unlimited |

Pick the strongest isolation you can afford. Most production systems land on **partition key** — it gives data locality and predictable routing without the operational burden of N collections.

Collection-per-tenant is right when tenants have different schemas, very different data sizes, or hard regulatory boundaries.

---

# Noisy neighbour — three flavours

- **Query interference** — a tenant's query burst spikes p99 across all tenants on the shard
- **Ingest interference** — a tenant's bulk load saturates the write path
- **Index-build interference** — a compaction or rebuild eats CPU during peak query traffic

The metrics look the same: latency goes up, error rate creeps up, no obvious cause. The fix is different for each. Isolation primitives target different parts of this — partition keys for data, resource groups for compute.

---

# Resource groups

Milvus's primitive for pinning workloads to nodes. A resource group is a labelled subset of query nodes; collections (or partition keys) can be assigned to it.

Use cases:

- Pin a hot tenant to dedicated query nodes
- Separate production from canary traffic on the same cluster
- Reserve nodes for index builds so they don't steal query compute

Default group catches everything unassigned. Keep it sized for the long tail.

---

# Failure modes worth watching

- **Coordinator instability** — leader election storms; symptom is brief read unavailability across the whole cluster
- **Segment compaction stalls** — disk fills with un-compacted segments; symptom is slowly growing query latency
- **Index-build queue overflow** — new vectors arrive faster than the builder can absorb; symptom is recall slowly drifting downward as inserts stay un-indexed
- **Replica drift** — one replica's segment cache is cold; symptom is bimodal latency

The pattern: failure modes hide in metrics, not exceptions. Section 4 is about catching them.

---

# Milvus topology config

```python
from pymilvus import MilvusClient, DataType

schema = MilvusClient.create_schema(auto_id=True, partition_key_field="tenant_id")
schema.add_field("id",        DataType.INT64,        is_primary=True)
schema.add_field("tenant_id", DataType.VARCHAR, max_length=64)
schema.add_field("vector",    DataType.FLOAT_VECTOR, dim=768)
schema.add_field("text",      DataType.VARCHAR, max_length=8192)

client.create_collection(
    collection_name="docs",
    schema=schema,
    num_shards=4,
    num_partitions=64,    # partition-key buckets
)

client.load_collection("docs", replica_number=4, resource_groups=["prod"])
```

Four lines of topology config that took us six slides to motivate.

---

# Picking your topology

| If your data… | Pick this shape |
|---|---|
| < 10M vectors, single tenant | 1 shard, 2 replicas, hash routing |
| < 100M, single tenant, high QPS | 2–4 shards, 3+ replicas, hash routing |
| Multi-tenant, < 1000 tenants | partition-key on `tenant_id`, 2–4 shards, 3 replicas |
| Multi-tenant, hot tenant exists | partition-key + resource group for the hot tenant |
| > 1B vectors | shard count grows; consider DiskANN to control cost |

Reshard later is painful. Add replicas later is cheap. When in doubt, start fewer shards and more replicas.

---

{.section}
# Observability & alerting

---

# Four golden signals, vector-DB edition

| Signal | What you measure |
|---|---|
| **Latency** | p50/p99/p99.9 of `search` and `insert`, by collection |
| **Errors** | non-2xx rate, timeout rate |
| **Traffic** | QPS in, vectors/sec ingested |
| **Saturation** | CPU, memory, GPU, segment cache hit rate, index-build queue depth |

These will catch most outages. They will not catch the worst one.

---

# The fifth signal — recall regression

Latency stays flat. Error rate stays flat. Saturation looks fine. Result *quality* quietly degrades.

Causes:

- A new embedding model deployed on one side of the index/query split
- Index params silently re-tuned
- Streaming ingest with stale IDF in the BM25 path
- A bug in a chunking pipeline, weeks ago

You will not notice this from the four golden signals. You will notice when the business metric drops six weeks later.

---

# Measuring recall in prod

Build a frozen ground-truth set: 1000–10,000 (query, expected-top-k) pairs that you trust.

- **Replay** the query set against the live index every hour / day
- **Compare** observed top-k against expected top-k → recall@10
- **Alert** on any regression beyond a threshold (e.g., -2% week-over-week)

Tradeoff: bigger query set → better signal, more replay cost. 1000 pairs replayed hourly is cheap and almost always enough.

The ground-truth set itself is what you're really protecting. Treat it like code: version it, review changes.

---

# p99 latency — what's normal

Per-index baselines, give or take:

| Index | Healthy p99 | Alert threshold (2× baseline) |
|---|---|---|
| HNSW (in-RAM) | 5–20 ms | 40 ms |
| IVF_PQ | 10–40 ms | 80 ms |
| DiskANN | 30–80 ms | 160 ms |

*These are end-to-end p99s — network, fan-out, and result merge included. The index-internal floors from slide 15 are lower.*

Set the alert threshold to 2× the rolling 7-day baseline, not an absolute number — your baseline drifts as the dataset grows. Page on sustained breach (5+ minutes), not a single spike.

---

# Ingest lag and build queue

The two leading indicators of "something's about to break":

- **Ingest lag** — vectors written → vectors searchable. Should be seconds. If it grows, the index builder is falling behind.
- **Build queue depth** — segments waiting to be indexed. A growing queue means recall is silently dropping (un-indexed vectors are flat-scanned, slowly).

Alert when either trends up over 10+ minutes. By the time latency moves, you're already late.

---

# Memory pressure and cache evictions

For DiskANN and IVF_PQ-on-disk, the segment cache is doing the work. Watch:

- **Cache hit rate** — should be 95%+. Drops mean queries are hitting cold disk.
- **Eviction rate** — frequent evictions mean working set > cache size; you're paying SSD latency on the path.
- **Page-fault rate** — for memory-mapped indexes, a leading indicator of cache thrash.

For HNSW, watch RSS vs. configured limit. HNSW has no cache to thrash — it OOMs.

---

# p99.9 — where the lies live

p99 looks fine. Most users are fine. But your top 0.1% of queries — the slow ones — are exactly the ones that break SLAs and the ones that hurt the noisiest tenant most.

p99.9 catches:

- Cold-cache queries on DiskANN
- Queries that fan out to a slow replica
- Index-build interference during peak hours
- Tenant-skew in a partition-key setup

Multi-tenancy fairness lives at p99.9, not p99. If you only watch p99, you will believe your shared cluster is fine until a customer escalates.

---

# Alert pyramid

| Tier | Latency to ack | Examples |
|---|---|---|
| **Page** | 5 min | error rate > 1%, p99 sustained 2× baseline, recall regression > 5% |
| **Ticket** | 1 day | ingest lag growing, cache hit rate dropping, p99.9 drifting |
| **Log/dashboard** | review weekly | per-tenant fairness, build-queue depth, segment count |

If everything pages, nothing pages. Demote ruthlessly — most signals belong on the dashboard, not in your phone.

---

# A monitoring layout that works

```dot
rankdir=TB
node [shape=box, style="rounded,filled", fontsize=11]

subgraph cluster_top {
  label="Top of dashboard"
  color="#1f6feb"
  style=dashed
  L [label="p99 latency\n(per collection, last 24h)"]
  E [label="error rate\n(per endpoint, last 24h)"]
  R [label="recall@10\n(replay job, last 7d)"]
}

subgraph cluster_mid {
  label="Middle"
  color="#9aa4b2"
  style=dashed
  Q [label="QPS in\nvs. capacity"]
  I [label="ingest lag\n+ build queue depth"]
  C [label="cache hit rate\n+ evictions"]
}

subgraph cluster_bottom {
  label="Bottom (drill-down)"
  color="#9aa4b2"
  style=dashed
  T [label="per-tenant\np99.9"]
  S [label="per-shard\nlatency"]
  N [label="node-level\nCPU / mem / GPU"]
}

L -> Q [style=invis]
Q -> T [style=invis]
```

Top row pages. Middle row tickets. Bottom row tells you where to look when something does page.

---

# If you only set up three alerts

1. **`recall@10` regression** — the silent killer
2. **`p99 search latency`** sustained > 2× rolling baseline
3. **`ingest lag`** trending up over 10+ minutes

Everything else is debugging. These three catch the production failures that actually matter.

---

# What's next

If this clicked, the **301 talk** covers cost engineering end-to-end:

- Quantization — PQ, SQ, binary, when each pays off
- Tiered storage — hot in RAM, warm on SSD, cold in object store
- GPU economics — when GPU indexes beat CPU, when they don't
- The math of "vector DB is 40% of my AI bill"

Same shape, same voice, different axis: $/recall instead of latency/recall.

---

{.center}

# Resources

- **Milvus docs** — milvus.io/docs
- **Zilliz Learn** — zilliz.com/learn
- **DiskANN paper** — Subramanya et al., NeurIPS 2019
- **HNSW paper** — Malkov & Yashunin, 2018
- **This deck** — github.com/simonhearne/presentations

---

{.hero .no-chrome}

# Production isn't an index. It's a system.
