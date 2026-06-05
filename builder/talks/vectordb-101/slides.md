{.title .no-chrome}
<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Vector Databases 101
## From keywords to meaning

```authors
- name: Simon Hearne
  position: Solutions Architect
  company: Zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```

---

# The keyword search wall

Two queries. Same intent. Zero overlap.

| Query        | Inverted index match |
|--------------|----------------------|
| `car`        | docs containing "car" |
| `automobile` | docs containing "automobile" |

A keyword index has no idea these mean the same thing. Synonym lists patch a few cases. They don't scale to *meaning*.

---

# What if we could search by meaning?

Not "which documents contain these characters?"

But "which documents are *about the same thing* as my query?"

The trick: turn meaning into **numbers** — then meaning becomes geometry.

---

# Where vectors come from

```text
"automobile"  ──►  [embedding model]  ──►  [0.12, -0.85, 0.43, ... 768 numbers]
"car"         ──►  [embedding model]  ──►  [0.14, -0.81, 0.40, ... 768 numbers]
```

Same model, similar meaning → similar vector. That's it. That's the whole idea.

The model is pre-trained. You feed it text, get back a fixed-length list of floats — usually 256, 768, or 1536 of them.

---

# Real applications

- **RAG** — pull the right chunks of your docs into an LLM prompt
- **Recommendations** — "users who liked X also liked..." over taste vectors
- **Image search** — embed pixels, search by visual similarity
- **Fraud detection** — flag transactions that vector-cluster with known fraud
- **Agent memory** — let an agent recall what it did three sessions ago

Every one of these reduces to the same primitive: *find the nearest vectors*.

---

# Embedding playground

Pick a word. See its five nearest neighbours.

```vega
- spec: ./embedding-playground.json
  renderer: svg
  actions: false
```

Words from the same category cluster together. The model learned this from text alone — nobody told it "cat" and "dog" are both animals.

---

{.section}
# How similarity search works

---

# From words to coordinates

A vector is a list of numbers. A list of numbers is a point in space.

- 2 numbers → a point on a page
- 3 numbers → a point in a room
- 768 numbers → a point in 768-dimensional space

You can't picture 768 dimensions. The math doesn't care. *Distance* is still distance.

---

# Distance equals dissimilarity

Two points close together → similar meaning.

Two points far apart → different meaning.

The embedding model spends all its training compute making sure this property holds: things that mean the same end up near each other in vector space.

---

# The three distance metrics

| Metric | What it measures | Use when |
|---|---|---|
| **Cosine** | angle between vectors | text embeddings (the default) |
| **Euclidean (L2)** | straight-line distance | image embeddings, geometry |
| **Inner product** | dot product, magnitude matters | recommender scores, ranking |

Pick one and stick with it — your index has to be built for the metric you query with.

---

# K-nearest neighbours, in plain English

> For every vector in the database, compute its distance to the query.
> Sort the list. Return the top *k*.

That's it. That's the algorithm.

It's also the slowest possible way to do this.

---

# Why naive KNN doesn't scale

100M vectors × 768 dims × 4 bytes/float = **307 GB**.

Every query touches every byte. At memory-bandwidth limits, that's seconds per query — on hardware that can serve a thousand HTTP requests in the same time.

Linear search dies somewhere around 100K–1M vectors. After that, you need an index.

---

# Enter the index

Approximate Nearest Neighbour (ANN) indexes — HNSW, IVF, ScaNN — trade a tiny bit of recall (~1%) for **100×–1000× speedup**.

The idea: pre-organize the vector space so a query only has to look at a small, well-chosen subset.

You give up "guaranteed top-5". You get sub-100ms queries over a billion vectors. Worth it.

---

# KNN in 2D

Click anywhere to drop a query point. Slide *k*. Toggle the metric.

```vega
- spec: ./knn-2d.json
  renderer: svg
  actions: false
```

Cosine cares about *direction* from the origin. Euclidean cares about *position*. Same data, different neighbours.

---

{.section}
# What a vector database actually does

---

# The four jobs

A vector database does exactly four things:

1. **Store** vectors (and the metadata next to them)
2. **Build indexes** over those vectors
3. **Search** the index, fast, on demand
4. **Filter** by metadata while it searches

Everything else — replication, sharding, GPU acceleration, hybrid search — is in service of doing these four well.

---

# Why not just use Postgres?

You can. `pgvector` adds a `vector` column type and a few index methods.

It's fine for **<1M vectors with relaxed latency**. Past that:

- No native distributed indexes — you shard by hand
- Index build times grow super-linearly
- No tuning hooks for ANN parameters at scale
- Backpressure under heavy ingest

Postgres is great. It's just not built for the workload.

---

# A 30-second tour of Milvus

```dot
A [label="Client SDK"]
I [label="Ingest\nbuffer + WAL"]
S [label="Segments" shape=cylinder]
B [label="Index Builder\nHNSW · IVF · DiskANN"]
Q [label="Query Coordinator"]
R [label="Top-k results"]
A -> I -> S
S -> B -> S
A -> Q -> S
Q -> R
```

Three independently scaled tiers — ingest, index, query — sharing one segment store.

---

# What an insert looks like

```python
from pymilvus import MilvusClient

client = MilvusClient(uri="./milvus.db")
client.create_collection(collection_name="docs", dimension=768)
client.insert(collection_name="docs", data=[
    {"id": 1, "vector": embed("the quick brown fox"), "text": "..."},
])
```

That's it. Five lines, including the import.

---

# What a search looks like

```python
results = client.search(
    collection_name="docs",
    data=[embed("a fast tan-coloured canine")],
    limit=3,
    output_fields=["text"],
)
```

`results[0]` is your top-3 by similarity, with the original text attached. The whole API surface is roughly a dozen methods.

---

# Hybrid search — the teaser

Sometimes you want **both**: keyword precision *and* semantic recall.

- BM25 finds documents with the exact words you typed
- ANN finds documents that *mean* what you typed
- Hybrid search runs both and reranks

It's the default in production. Covered properly in the **201 talk**.

---

# When NOT to use a vector database

- **<10K vectors** — `numpy.argsort` over a matrix is faster
- **Exact-match queries** — that's what B-trees are for
- **Transactional workloads** — you want ACID, not approximate
- **One-off batch jobs** — load into memory, run, throw it away

Reach for a vector DB when you have **scale × latency × always-on**. Otherwise, simpler is faster.

---

# Build your first search

Pick a query. Watch the cosine similarity scores against ten pre-embedded documents.

```vega
- spec: ./search-similarity.json
  renderer: svg
  actions: false
```

The top three are highlighted. This is the entire RAG retrieval step, in one chart.

---

{.section}
# The big picture

---

# The RAG architecture

```dot
Q [label="User query"]
E [label="Embed"]
S [label="Search vector DB"]
K [label="Top-k chunks"]
P [label="Prompt assembly"]
L [label="LLM" fillcolor="#fbe6ff" color="#c84cff"]
A [label="Answer"]
Q -> E -> S -> K -> P -> L -> A
Q -> P
```

Embed-and-search is the cheap, fast part. The LLM call is the expensive part. The vector DB controls **what the LLM sees**.

---

# Why RAG matters even with 1M-token windows

- **Cost scales linearly with tokens.** A 1M-token prompt is ~1000× a 1K-token prompt.
- **Attention degrades.** Models lose track of what's in the middle of long contexts ("lost in the middle").
- **Latency follows tokens.** Time-to-first-token grows with prompt length.

RAG keeps the prompt small *and* relevant. Big context windows make RAG **better**, not obsolete.

---

# Common gotchas

- **Garbage embeddings = garbage search.** Pick your embedding model deliberately — the off-the-shelf default is rarely best for your domain.
- **Same model at index time and query time.** Mixing models means mixing geometries.
- **Chunking matters as much as embedding.** Split your docs wrong and the right chunk never makes it to top-k.
- **Re-embed when you change models.** There's no "migrate the vectors" — you start over.

---

# The cost surprise

Vector DBs can be **40–50% of your AI app bill** at scale.

Most of that is RAM (indexes want to be in memory) and replicas (you want HA). It's possible to cut this by 5–10× with disk-based indexes, quantization, and tiered storage — but only if you architect for it from day one.

The **301 talk** covers cost engineering end-to-end.

---

# Ecosystem map

| Tool | Sweet spot |
|---|---|
| **Milvus** | Open-source, distributed, billion-scale, GPU-accelerated |
| **Zilliz Cloud** | Managed Milvus |
| **Pinecone** | Managed-only, simple API, smaller-scale |
| **Weaviate** | Built-in modules (transformers, RAG), good DX |
| **Qdrant** | Single-binary, Rust, great filtering |
| **pgvector** | "I already have Postgres" |

All five do ANN. Differences are operations, scale, and developer experience.

---

# What's next

If this clicked, the **201 talk** goes deep on production systems:

- HNSW vs IVF vs DiskANN — and when to pick each
- Hybrid search and reranking
- Sharding, replication, multi-tenant isolation
- Observability and what to alert on

Then **301** covers cost engineering: quantization, tiered storage, GPU economics.

---

{.center}
# Resources

- **Milvus quickstart** — milvus.io/docs
- **Zilliz Learn** — zilliz.com/learn
- **Source** — github.com/milvus-io/milvus
- **This deck** — github.com/simonhearne/presentations

---

{.hero .no-chrome}
# Meaning is a coordinate.
