```deck
- agenda: false
```

{.title .no-chrome .automata}

<style>
  .q-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.7vw; margin: 1.6vh 0; }
  .q-grid img { width: 100%; aspect-ratio: 2 / 1; object-fit: contain; border-radius: 5px; image-rendering: pixelated; }
  .source-ref { font-family: var(--zilliz-font-mono, monospace); font-size: 0.55em; opacity: 0.5; margin-top: 1.5vh; }
  .source-ref a { color: inherit; }
</style>

<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Vector Search <br><span class="hero-text smashing">Visualised</span>

## From Zero to Hero in Vector Search

## Oct 7 · 2026 · Milvus Meetup, Paris

```authors
- name: Simon Hearne
  position: solutions architect
  company: zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```

---

{.small-title}

# Why vector search exists...

<br><br>

<div class="search-demo">
  <div class="header fragment">
    <div>
      <div class="query">comfortable red trainers</div>
    </div>
  </div>

  <br>

  <div class="body">

  <div class="section fragment">
    <div class="section-title">
      <span>Keyword search</span>
      <span class="tag">matches <em>intent</em>?</span>
    </div>
    <ol class="results">
      <li class="result is-hit"><span class="rank">01</span><span class="title"><span class="hit-text">Comfortable Red Trainers</span> <span class="year">exact phrase</span></span><span class="pill hit">Match</span></li>
      <li class="result"><span class="rank">03</span><span class="title"><span class="hit-text">Comfortable Red</span> Sweater <span class="year">wrong product</span></span><span class="pill miss">Wrong</span></li>
      <li class="result"><span class="rank">04</span><span class="title"><span class="hit-text">Comfortable</span> Pillow <span class="year">one word matched</span></span><span class="pill miss">Wrong</span></li>
      <li class="result"><span class="rank">02</span><span class="title">Personal <span class="hit-text">Trainers</span> Course <span class="year">same word, wrong sense</span></span><span class="pill miss">Wrong</span></li>
      <li class="result"><span class="rank">05</span><span class="title"><span class="hit-text">Red</span> Wine Glasses <span class="year">one word matched</span></span><span class="pill miss">Wrong</span></li>
    </ol>
    <p class="below-note">Shares <strong>words</strong> with the query - but not <strong>meaning</strong>.</p>
  </div>

  <div class="section fragment">
    <div class="section-title">
      <span>Vector search</span>
      <span class="tag">matches <em>intent</em>?</span>
    </div>
    <ol class="results">
      <li class="result is-hit"><span class="rank">01</span><span class="title"><span class="hit-text">Comfortable Red Trainers</span></span><span class="pill hit">Match</span></li>
      <li class="result is-hit"><span class="rank">02</span><span class="title">Cosy Crimson Sneakers</span><span class="pill hit">Match</span></li>
      <li class="result is-hit"><span class="rank">03</span><span class="title">Snug Burgundy Running Shoes</span><span class="pill hit">Match</span></li>
      <li class="result is-hit"><span class="rank">04</span><span class="title">Soft Scarlet Sneakers</span><span class="pill hit">Match</span></li>
      <li class="result is-hit"><span class="rank">05</span><span class="title">Cushioned Cherry-Red Trainers</span><span class="pill hit">Match</span></li>
    </ol>
    <p class="below-note">Few shared words. Same <strong>meaning</strong>.</p>
  </div>

  </div>
</div>
<br><br>

<blockquote class="fragment bottom"><span class="label">Takeaway</span><p>Traditional search matches <span class="hit-text">tokens</span>. Vector search matches <span class="hit-text">meaning</span>.</p></blockquote>

---

# Models turn 'stuff' into numbers

Each model turns its input into an array of numbers - the embedding's position in high-dimensional space. Anywhere from a few hundred to a few thousand Float32 values.

<img src="../../../img/image_embedding.svg" alt="diagram of image embedding model" loading="lazy" style="height:66%;"/>
<!-- 
Where do we put them? {.fragment .align-right .bold .blue} -->

<!-- TALK TRACK

Think of the model as a lightning fast librarian, give them a picture and they'll know exactly what position in the library it should be sent to.

But better than a library, the model is deterministic - if you give it exactly the same picture it will end up in exactly the same place.

Then when you ask for a picture like that, the librarian knows exactly where to look to find it.

So what does our library look like?

-->

---

{.section}

# Picturing meaning

---

{.dark .small-title}

# Let's build a face-finder model

```three
- module: ./cloud.js
```

---

# What "similar" means

How do you measure similarity in multi-dimensional space?

```vega
- spec: ../../visualisations/knn-2d.json
  signal-stage: [0]
  renderer: svg
  actions: false
```

---

{.section}

# <span class="hero-text">Exact</span> Search

---

{.small-title}

# The naïve approach

Compare the query to every entity in the database. Exact, simple, **O(N)**.

```vega
- spec: ../../visualisations/knn-2d-flat.json
  renderer: svg
  actions: false
  signal-stage: [0, 1, 2]
  animate-signal: scanIdx
  animate-to-data: ranked
  animate-step-ms: 60
  animate-trigger: scanning
  animate-trigger-value: true
  fit: contain
```

---

{.small-title}

# Why flat search doesn't scale

16 faces, fine. A billion vectors? Not so much. Latency grows linearly and ~all of the comparisons are waste.

```vega
- spec: ../../visualisations/ann-vs-exact.json
  renderer: svg
  signal-stage: [0, 1]
  actions: false
  fit: contain
```

---

{.chart-animate .small-title}

# The trade-off triangle

Every technique trades **speed**, **accuracy** & **cost**.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [0,1]
  actions: false
  fit: contain
```

---

{.section}

# <span class="hero-text">Approximate</span> <br>nearest neighbour

---

{.small-title}

# Recall & Precision: how we measure <span class="hero-text">accuracy</span>

<div class="search-demo">
  <div class="header fragment">
    <div>
      <div class="query">movie with a robot from the future</div>
    </div>
    <div class="eyebrow">k = 10</div>
  </div>

  <div class="body">

  <div class="section fragment">
    <div class="section-title">
      <span>Ranked results · vector search</span>
      <span>4 of 10 · 6 relevant total</span>
    </div>
    <ol class="results">
      <li class="result is-hit"><span class="rank">01</span><span class="title">The Terminator <span class="year">1984</span></span><span class="pill hit">Relevant</span></li>
      <li class="result is-hit"><span class="rank">02</span><span class="title">Terminator 2: Judgment Day <span class="year">1991</span></span><span class="pill hit">Relevant</span></li>
      <li class="result is-hit"><span class="rank">03</span><span class="title">Terminator 3: Rise of the Machines <span class="year">2003</span></span><span class="pill hit">Relevant</span></li>
      <li class="result"><span class="rank">04</span><span class="title">I, Robot <span class="year">2004</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result"><span class="rank">05</span><span class="title">The Matrix <span class="year">1999</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result"><span class="rank">06</span><span class="title">Westworld <span class="year">1973</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result is-hit"><span class="rank">07</span><span class="title">Terminator Salvation <span class="year">2009</span></span><span class="pill hit">Relevant</span></li>
      <li class="result"><span class="rank">08</span><span class="title">Blade Runner <span class="year">1982</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result"><span class="rank">09</span><span class="title">Ex Machina <span class="year">2014</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result"><span class="rank">10</span><span class="title">Looper <span class="year">2012</span></span><span class="pill miss">Not relevant</span></li>
      <div class="cutoff">
        <span class="cutoff-label">k = 10 cutoff</span>
        <span class="cutoff-line"></span>
      </div>
      <li class="result below is-hit"><span class="rank">14</span><span class="title">Terminator Genisys <span class="year">2015</span></span><span class="pill hit">Relevant</span></li>
      <li class="result below is-hit"><span class="rank">27</span><span class="title">Terminator: Dark Fate <span class="year">2019</span></span><span class="pill hit">Relevant</span></li>
    </ol>
  </div>

  <div class="formulas">
    <div class="formula-card fragment">
      <div class="formula-name">Recall@k</div>
      <p class="formula-q">Of all the good stuff, how much did we <em>find</em>?</p>
      <div class="equation">
        <div class="fraction"><div class="num hit-num">relevant in top k</div><div class="bar"></div><div class="den">total relevant</div></div>
        <span class="equals">=</span>
        <div class="fraction"><div class="num hit-num">4</div><div class="bar"></div><div class="den">6</div></div>
        <span class="equals">=</span>
        <span class="result-num">66.7%</span>
      </div>
    </div>
    <div class="formula-card fragment">
      <div class="formula-name">Precision@k</div>
      <p class="formula-q">Of what we <em>returned</em>, how much was good?</p>
      <div class="equation">
        <div class="fraction"><div class="num hit-num">relevant in top k</div><div class="bar"></div><div class="den">k</div></div>
        <span class="equals">=</span>
        <div class="fraction"><div class="num hit-num">4</div><div class="bar"></div><div class="den">10</div></div>
        <span class="equals">=</span>
        <span class="result-num">40%</span>
      </div>
    </div>
    <blockquote class="small fragment">
      <span class="label">Production notes</span>
      <p>Recall@k can be calculated against brute force / <span class="hit-text">exact</span> match results</p>
    </blockquote>
    <blockquote class="small blue fragment" style="margin-top: 0">
      <span class="label">Thought</span>
      <p>What would happen if we <span class="hit-text">filtered by release year?</span></p>
    </blockquote>
  </div>

  </div>
</div>

---

{.no-chrome .dark .no-title .center}

# The big idea

<style>
  .big-idea { display: flex; align-items: center; justify-content: center; gap: 3vw; margin: 10vh 0; font-size: 32px; }
  .big-idea .bi-cell { display: flex; flex-direction: column; align-items: center; }
  .big-idea .bi-num { font-size: 3.4em; font-weight: 800; line-height: 1; }
  .big-idea .bi-lab { font-family: var(--zilliz-font-mono, monospace); font-size: 0.85em; opacity: 0.65; margin-top: 0.6em; }
  .big-idea .give .bi-num { color: #94a3b8; }
  .big-idea .get .bi-num { color: var(--zilliz-blue, #175fff); }
  .big-idea .bi-arrow { font-size: 2.6em; opacity: 0.4; }
  .big-idea-foot { text-align: center; font-size: 1.3em; }
</style>

<div class="big-idea">
  <div class="bi-cell give"><span class="bi-num">&lt;10%</span><span class="bi-lab">recall you give up</span></div>
  <div class="bi-arrow">→</div>
  <div class="bi-cell get"><span class="bi-num">&gt;100×</span><span class="bi-lab">faster, cheaper search</span></div>
</div>

---

# IVF: partition the space

IVF clusters the vectors into _nlist_ cells. At query time, only search within the nearest _nprobe_ cells.

```vega
- spec: ../../visualisations/ivf-voronoi.json
  renderer: svg
  actions: false
  signal-stage: [2, 4, 6]
```

---

# HNSW: navigate a graph

**Hierarchical Navigable Small World.** Multi-layer graph: top layers have long-range highways, lower layers have local connections. Start at the top, walk greedily closer, drop down a layer, repeat.

```vega
- spec: ../../visualisations/hnsw.json
  renderer: svg
  signal-step: [0,1,2,3,4,5,6,7,8]
  actions: false
```

---

{.no-vega-bindings}

# DiskANN: when RAM runs out

Graph index, engineered for SSD. Minimises random reads, index billions of vectors on ~GBs of RAM.

<!--
TALK TRACK (~65s, one ArrowRight per stage - 8 advances, then the deck moves on)
The viz walks through how DiskANN BUILDS its graph (Vamana), then queries it.
Stages 2-4 zoom in on inserting one representative node to show the per-node rule;
stage 5 is the finished graph after every node has been through that same procedure.

Stage 0 - Entry point.
  On screen: 60 dots, one purple diamond.
  "DiskANN builds a navigable graph called Vamana. We pick the medoid -
   the most central vector - as the fixed entry point every search starts from."

Stage 1 - Random graph. [→]
  On screen: faint grey edges, at most three per node.
  "We don't start clever. Every node gets a few random edges. A bad map,
   but a connected one - the build's whole job is to rewire it into something
   worth following."

Stage 2 - Greedy search. [→]
  On screen: one node lit up, a blue path from the medoid, purple candidate rings.
  "To add a node, we greedily walk the graph from the medoid towards it,
   collecting everything we pass. Those become its candidate neighbours."

Stage 3 - RobustPrune, α=1. [→]
  On screen: three solid edges kept, three dashed edges dropped.
  "Then we prune. Keep the nearest candidate; drop any candidate that's
   closer to one we've already kept than it is to the node itself. That kills
   redundant edges all pointing the same way."

Stage 4 - RobustPrune, α=1.2. [→]
  On screen: one long purple edge survives.
  "Run it again, but relax the rule by a factor α, about 1.2. That spares one
   long-range edge the strict pass would have cut. Diversity over pure
   proximity - that's what keeps the graph shallow."

Stage 5 - Built graph. [→]
  On screen: the full graph, short local edges only.
  "Repeat for every vector and you get this: clean, mostly-local hops. Easy
   to follow - but crossing the space takes many hops, and on DiskANN every
   hop is a disk read."

Stage 6 - Shortcuts. [→]
  On screen: purple long-range edges woven through.
  "Those spared α-edges are the long-range shortcuts, threaded through the
   whole graph. They let a search jump across the space in a few steps instead
   of crawling neighbour to neighbour."

Stage 7 - Query lands. [→]
  On screen: purple query diamond appears in the cloud, no path yet.
  "Now a query arrives. Here's the DiskANN bargain: the full vectors and the
   graph itself live on SSD - RAM holds only a tiny compressed PQ summary.
   So the only thing that costs us at query time is reading nodes off disk."

Stage 8 - Graph traversal. [→]
  On screen: thick blue path medoid→query, badge "DiskANN: 4 SSD reads /
  Flat scan: 60 SSD reads".
  "We start at the medoid and hop greedily toward the query. Every hop reads
   one node from disk - four hops, four SSD reads. A flat scan would have to
   pull all sixty vectors off disk to be sure. That gap is the whole point:
   billions of vectors on disk, answered in a handful of random reads."
-->

```vega
- spec: ../../visualisations/diskann-vamana.json
  renderer: svg
  signal-stage: [0,1,2,3,4,5,6,7,8]
  actions: false
```

---

# ANN Benefits

```vega
- spec: ../../visualisations/ann-vs-exact.json
  renderer: svg
  signal-stage: [1, 2, 3]
  actions: false
  fit: contain
```

---

{.chart-animate .small-title}

# Where ANN lands

Approximate nearest-neighbour algorithms all trade perfection for reduced latency and cost.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [1,2]
  actions: false
  fit: contain
```

---

{.small-title}

# Sounds... complex?

`HNSW`, `IVF`, `DiskANN`, `nlist`, `nprobe`, `M`, `ef`, `search_list`. Can't the machine work it out?

<div class="two-col cards" style="align-items: stretch; margin: 1.5em 0;">
<div class="fragment">

**You tune** · open-source Milvus / other VectorDB

- Pick the index family yourself - IVF, HNSW, DiskANN, GPU…
- Set build knobs: `nlist`, `M` / `efConstruction` etc.
- Set search knobs per query: `nprobe`, `ef` - and re-tune as data shifts
- Choose quantisation & memory mode by hand

</div>
<div class="fragment">

**AUTOINDEX decides** · managed

- You set the **metric** and performance characteristics
- Index type, build params & quantisation tuned automatically
- One query-time `level` dial (1 - 10)
- Re-optimises per segment as the data moves

</div>
</div>

<blockquote class="fragment bottom"><span class="label">Trade-off</span><p>Full control and full responsibility, or <span class="hit-text">one dial</span> and trust the engine.</p></blockquote>

---

# The size problem

No matter what algorithm you use, embeddings are big. In RAM or on disk, size matters.

<svg class="size-diagram" viewBox="0 0 1400 400" role="img" aria-label="Four-step build of the embedding footprint: one chunk becomes a 3072-dimension vector, every dimension is a four-byte float32 so one vector costs 12.3 kilobytes, one hundred million chunks make 1.23 terabytes, and holding that costs about six thousand one hundred dollars a month in RAM or one hundred and eighty four dollars a month on premium SSD">
<defs>
<marker id="sz-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
<pattern id="sz-cells" width="28" height="66" patternUnits="userSpaceOnUse" patternTransform="translate(0 100)"><rect class="cell" x="4" y="8" width="20" height="50" rx="3"/></pattern>
<pattern id="sz-block" width="28" height="21" patternUnits="userSpaceOnUse" patternTransform="translate(0 46)"><rect class="cell" x="4" y="4" width="20" height="13" rx="2"/></pattern>
</defs>
<g class="rail"><path d="M224 366 H1060"/></g>
<g class="stage stage-1 fragment" data-fragment-index="1">
<path class="edge" d="M172 133 H218"/>
<text class="elabel muted" x="448" y="40" text-anchor="middle">text-embedding-3-large</text>
<text class="nlabel" x="448" y="84" text-anchor="middle">3072 dimensions</text>
<rect class="node strip" x="224" y="100" width="448" height="66" rx="6"/>
<rect class="tag" x="300" y="344" width="200" height="44" rx="22"/><text class="tlabel" x="400" y="374" text-anchor="middle">3072 numbers</text>
</g>
<g class="stage stage-2 fragment" data-fragment-index="2">
<rect class="cell-focus" x="564" y="100" width="20" height="66" rx="3"/>
<path class="cone" d="M564 166 L470 196 H620 L584 166 Z"/>
<rect class="node cell-zoom" x="470" y="196" width="150" height="60" rx="8"/>
<g class="bytes"><rect x="479" y="207" width="30" height="38" rx="3"/><rect x="513" y="207" width="30" height="38" rx="3"/><rect x="547" y="207" width="30" height="38" rx="3"/><rect x="581" y="207" width="30" height="38" rx="3"/></g>
<text class="elabel" x="545" y="284" text-anchor="middle">float32 = 4 bytes</text>
<rect class="tag" x="545" y="344" width="150" height="44" rx="22"/><text class="tlabel" x="620" y="374" text-anchor="middle">12.3 KB</text>
</g>
<g class="stage stage-3 fragment" data-fragment-index="3">
<path class="edge" d="M678 133 H774"/>
<text class="elabel" x="726" y="112" text-anchor="middle">× 100M</text>
<rect class="node block" x="780" y="46" width="280" height="210" rx="8"/>
<text class="nlabel" x="920" y="284" text-anchor="middle">100M chunks</text>
<rect class="tag" x="845" y="344" width="150" height="44" rx="22"/><text class="tlabel" x="920" y="374" text-anchor="middle">1.23 TB</text>
</g>
<g class="stage stage-4 fragment" data-fragment-index="4">
<path class="edge plain" d="M1066 151 H1096"/>
<path class="edge" d="M1096 151 V98 H1124"/>
<path class="edge" d="M1096 151 V216 H1124"/>
<rect class="node node-cost" x="1130" y="46" width="260" height="104" rx="16"/>
<text class="cost-num" x="1260" y="102" text-anchor="middle">$6,100</text>
<text class="nsub nsub-source" x="1260" y="134" text-anchor="middle">RAM, per month</text>
<rect class="node node-cost-alt" x="1130" y="164" width="260" height="104" rx="16"/>
<text class="cost-num cost-num-alt" x="1260" y="220" text-anchor="middle">$184</text>
<text class="nsub nsub-tight" x="1260" y="252" text-anchor="middle">premium SSD, per month</text>
<text class="nsub muted" x="1260" y="300" text-anchor="middle">raw vectors only,</text>
<text class="nsub muted" x="1260" y="324" text-anchor="middle">before index overhead</text>
</g>
<g class="nodes">
<rect class="node" x="10" y="95" width="150" height="76" rx="38"/><text class="nlabel" x="85" y="142" text-anchor="middle">1 chunk</text>
<text class="elabel muted" x="216" y="374" text-anchor="end">footprint</text>
</g>
</svg>

<p class="closing-line fragment" data-fragment-index="4">100M chunks and you are holding <strong>1.23 TB</strong> before a single query runs.</p>

<!-- src: visualisations/cost-calculator.json:constants_note (RAM $5/GB/mo, as of 2026-05) -->
<!-- src: deck assumption, premium SSD $0.15/GB-month; cost-calculator.json carries NVMe at $0.10/GB/mo for a different workload -->

<!-- notes
Four beats, one per click.

Stage 1. One chunk of text goes through the embedding model and comes back as
3072 numbers. That is text-embedding-3-large, nothing unusual.

Stage 2. Zoom into a single dimension. It is a float32, four bytes. So one
vector is 3072 times 4, 12.3 kilobytes. Still nothing.

Stage 3. Multiply by a hundred million chunks, which is a medium enterprise
corpus, not a hyperscaler. 1.23 terabytes.

Stage 4. Two prices for the same 1.23 terabytes. At five dollars per
gigabyte-month, RAM is about six thousand one hundred dollars a month. The
same bytes on premium SSD at fifteen cents per gigabyte-month are a hundred
and eighty four dollars. That is the thirty-three times gap, and it is why
DiskANN earned its slide earlier: the algorithm exists to buy that gap.

Say the caveat out loud either way: this is the raw vectors only. The index
sits on top of it. The HNSW graph or the IVF lists are extra.

Both numbers are what the whole next section attacks. Quantisation shrinks
the terabytes, so it shrinks whichever of the two you are paying.
-->

---

{.section}

# <span class="hero-text">Quantisation</span>: <br>smaller numbers

---

{.small-title}

# Scalar quantisation

Round `float32 → int8`: **4x smaller embeddings**, a small recall hit, almost no work.

```vega
- spec: ../../visualisations/scalar-steps.json
  signal-stage: [3]
  renderer: svg
  actions: false
  fit: contain
```

---
{.small-title}

# RaBitQ: one bit per dimension

Rotate the space to reduce error, then keep just the **sign** of each dimension - one bit.

```vega
- spec: ../../visualisations/rabitq-steps.json
  signal-stage: [0,1,2,3]
  renderer: svg
  actions: false
  fit: contain
```

<!-- src: rag-cost-curve/data/ws2/curves_1m.csv (1024-D) - rabitq best recall_at_10 0.74109, footprint_compression_vs_ivf_flat 13.98; rabitq_refine_sq8_k1 first >=0.95 at 0.95457, 27.81 qps, footprint 3.19x; flat_fp32 27.83 qps -->

<!-- notes
The recent breakthrough. Rotate the space, keep the sign of each dimension,
one bit. The bit-vector preserves angles with a provable error bound, and a
cheap correction term sharpens the estimate. Milvus ships it as the RaBitQ
index: up to 32x smaller payload, about 14x once the index is resident.

Numbers if asked, Milvus 2.6 at 1M x 1024-D: 1-bit alone is 14x smaller
resident with recall 0.74. An SQ8 refine pass recovers recall to 0.95, but the
footprint saving falls to about 3x, at roughly the throughput of flat. The
Refine slide later picks this up at 10M.
-->
---

{.small-title}

# Product quantisation

Scalar quantisation shrinks every number, **PQ** shrinks the whole vector.

```vega
- spec: ../../visualisations/pq-steps.json
  signal-stage: [0,1,2,3]
  renderer: svg
  actions: false
  fit: contain
```

<!-- notes
Split the vector into m chunks, k-means each chunk's space into a small
codebook, replace each chunk with the ID of its nearest centroid, then search
by computing approximate distances straight from the codebooks.

Warning worth saying: PQ leans on a static codebook. Learned once, it degrades
quietly under model drift.
-->
---

{.small-title .no-vega-bindings}

# What it costs you (in theory)

Every lost bit risks recall, but the curve is surprisingly forgiving.

```vega
- spec: ../../visualisations/compression-recall.json
  renderer: svg
  signal-stage: [1]
  actions: false
  fit: contain
```

<!-- src: compression-recall.json:source_1 (illustrative, authored at 768-D; the Embedding dim control scales residual error for PQ/PRQ/RaBitQ only, direction not measurement) -->

---

{.chart-animate .small-title}

# Quantisation shifts everything cheaper

Each algorithm can use quantisation to trade accuracy for significantly reduced latency and cost.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [2,3]
  actions: false
  fit: contain
```

---

{.section}

# <span class="hero-text">Dimensionality Reduction</span>: <br>fewer numbers

<!-- Quantisation shrinks each number. **Dimensionality reduction** removes numbers outright - fewer dimensions, full precision. -->

---

# PCA: rotate, drop the quiet axes

PCA finds the _directions_ of greatest variance and keeps the top _k_. Fewer dimensions, full precision.

<div class="two-col" style="grid-template-columns: 1.6fr 1fr; align-items: center;">
<div>

```vega
- spec: ../../visualisations/pca-projection.json
  renderer: svg
  signal-stage: [0, 1, 2, 3]
  actions: false
```

</div>
<div>

<blockquote class="blue"><span class="label">Benefit</span><p>Keep <span class="hit-text">one number instead of two</span> and 94% of the variance - linear, fast, deterministic.</p></blockquote>

<blockquote class=""><span class="label">Drawback</span><p>Maximises for <em>variance, not meaning</em>: structure on a low-variance axis is discarded, and it must be refit when the data shifts.</p></blockquote>

</div>
</div>
<!--
<aside class="speaker-notes">
PCA is relatively rare in production workloads, AlloyDB is one solution that supports it natively.
PCA will reduce precision, especially at low k values.
</aside>
-->

---

{.quant-steps}

# MRL: one vector, many lengths

The dimensions are ordered by importance, so a prefix is a complete vector.

```vega
- spec: ../../visualisations/mrl-steps.json
  signal-stage: [1,2,3]
  renderer: svg
  actions: false
  fit: contain
```

---

{.chart-animate}

# vs a model not trained for it

MRL tunes the model so the **dimensions are ordered by importance**. OpenAI's `text-embedding-3-large` is 3072-D native, but you can ask for any prefix down to 256-D via the `dimensions` parameter.

<br>

<div class="two-col" style="grid-template-columns: 1.6fr 1fr; align-items: center;">
<div>

```vega
- spec: ../../visualisations/mrl-truncation.json
  renderer: svg
  signal-prefix: [256]
  actions: false
  fit: contain
```

</div>
<div>

<blockquote class="blue small"><span class="label">Benefit</span><p>One model, <span class="hit-text">pick the length per query</span> - short prefix to shortlist fast, full vector to re-rank. Degrades gracefully.</p></blockquote>

<blockquote class="small"><span class="label">Drawback</span><p>Only works if the model was <em>trained</em> this way - an ordinary embedding survives a light trim, then falls off a cliff once you cut hard (the berry line).</p></blockquote>

</div>
</div>

---

{.chart-animate .small-title}

# Fewer dimensions, small accuracy hit

Dimensionality reduction nudges any index toward fast and cheap.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [3,4]
  actions: false
  fit: contain
```

---

# Refine: scan cheap, rescore precise

Build time compression and dimensionality reduction both trade _accuracy to buy speed and scale_. **Refinement** wins accuracy back at query time.

<div class="two-col refine">
<div>
<svg class="refine-diagram" viewBox="0 0 1180 480" role="img" aria-label="Refinement funnel: a coarse pass scans nprobe of the 10 million 1-bit RaBitQ codes and reaches recall@10 of 0.778; an SQ8 refine pass rescores refine_k times limit candidates and reaches 0.986; widening nprobe from 256 to 1024 reaches 0.992; a re-ranker sits off the recall rail and only reorders the top-k">
<defs>
<marker id="rf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
<pattern id="rf-codes" width="25" height="24" patternUnits="userSpaceOnUse"><rect class="code" x="4" y="4" width="17" height="15" rx="3"/></pattern>
<pattern id="rf-exact" width="25" height="24" patternUnits="userSpaceOnUse"><rect class="code code-exact" x="3" y="3" width="19" height="17" rx="3"/></pattern>
</defs>
<g class="rail"><path d="M200 440 H880"/></g>
<g class="stage stage-1 fragment" data-fragment-index="1">
<path class="edge" d="M142 190 H182"/>
<path class="funnel" d="M370 55 L490 138 V242 L370 325 Z"/>
<rect class="node band" x="490" y="138" width="150" height="104" rx="12"/>
<text class="elabel" x="430" y="196" text-anchor="middle">nprobe</text>
<text class="elabel" x="565" y="282" text-anchor="middle">refine_k &times; limit</text>
<text class="nsub" x="565" y="310" text-anchor="middle">20 rows at refine_k=2</text>
<rect class="tag" x="515" y="418" width="100" height="44" rx="22"/><text class="tlabel" x="565" y="448" text-anchor="middle">0.778</text>
</g>
<g class="stage stage-2 fragment" data-fragment-index="2">
<rect class="node node-source" x="410" y="8" width="310" height="74" rx="16"/>
<text class="nlabel nlabel-source" x="565" y="40" text-anchor="middle">SQ8 vectors</text>
<text class="nsub nsub-source" x="565" y="66" text-anchor="middle">kept alongside the codes</text>
<path class="edge dashed" d="M565 86 V132"/>
<rect class="node band band-exact" x="490" y="138" width="150" height="104" rx="12"/>
<text class="elabel" x="584" y="118" text-anchor="start">rescore, don't re-search</text>
<path class="funnel" d="M640 138 L770 168 V212 L640 242 Z"/>
<rect class="node band band-exact" x="770" y="163" width="110" height="54" rx="12"/>
<text class="elabel" x="705" y="196" text-anchor="middle">cut to k</text>
<text class="nlabel" x="825" y="251" text-anchor="middle">top-k</text>
<rect class="tag" x="775" y="418" width="100" height="44" rx="22"/><text class="tlabel" x="825" y="448" text-anchor="middle">0.986</text>
</g>
<g class="stage stage-3 fragment" data-fragment-index="3">
<path class="edge dashed" d="M870 330 H404"/>
<text class="elabel" x="595" y="368" text-anchor="middle">widen nprobe, 256 &rarr; 1024</text>
<rect class="tag" x="775" y="348" width="100" height="44" rx="22"/><text class="tlabel" x="825" y="378" text-anchor="middle">0.992</text>
</g>
<g class="stage stage-4 fragment" data-fragment-index="4">
<path class="edge dashed" d="M888 190 H938"/>
<rect class="node node-off" x="946" y="150" width="180" height="80" rx="12"/>
<text class="nlabel" x="1036" y="196" text-anchor="middle">re-ranker</text>
<text class="nsub" x="1036" y="258" text-anchor="middle">reorders the top-k</text>
<text class="elabel muted" x="1036" y="292" text-anchor="middle">off this rail</text>
</g>
<g class="nodes">
<rect class="node" x="4" y="155" width="130" height="70" rx="35"/><text class="nlabel" x="69" y="199" text-anchor="middle">Query</text>
<rect class="node band" x="190" y="55" width="180" height="270" rx="12"/>
<text class="nlabel" x="280" y="362" text-anchor="middle">10M vectors</text>
<text class="nsub" x="280" y="390" text-anchor="middle">1-bit RaBitQ codes</text>
<text class="elabel muted" x="186" y="448" text-anchor="end">recall@10</text>
</g>
</svg>
</div>
<div>
<ol class="refine-list">
<li class="fragment" data-fragment-index="1"><strong>Coarse pass</strong> - scan <code>nprobe</code> of the lists using the 1-bit RaBitQ codes. Cheap, and on its own it stops at <strong>0.778</strong>.</li>
<li class="fragment" data-fragment-index="2"><strong>Refine pass</strong> - Milvus keeps SQ8 copies beside the codes and <em>rescores</em> <code>refine_k &times; limit</code> candidates with them. Same candidates, better distances: <strong>0.986</strong>.</li>
<li class="fragment" data-fragment-index="3"><strong>The last point</strong> comes from the coarse pass, not the refine. <code>nprobe</code> 256 to 1024 buys <strong>0.992</strong>, at a quarter of the throughput.</li>
<li class="fragment" data-fragment-index="4"><strong>Re-ranking is a different axis.</strong> A cross-encoder reorders the k you already retrieved. Better ordering, identical recall.</li>
</ol>
</div>
</div>

<!-- src: data/ws2/curves_10m.csv:arm,sweep_value,recall_at_10,qps — rabitq@nprobe256 0.77763/2.72, rabitq_refine_sq8_k2@nprobe256 0.98562/3.44, rabitq_refine_sq8_k2@nprobe1024 0.99200/0.88 -->

<!-- notes
The three numbers are one arm, rabitq_refine_sq8_k2, at 10M, walked along its
own nprobe sweep. Bare RaBitQ at the same nprobe=256 is 0.778: that is the gap
the refine pass exists to close, and it matches the k-anchor backup table.
0.986 is the same nprobe with refine on. 0.992 needs nprobe=1024 and costs
three quarters of the QPS, 3.44 down to 0.88.

refine_k is a multiplier on the search limit, not a candidate count: the docs
say the refine pass picks the neighbours from a refine_k times larger pool. At
limit 10 and k=2 that is twenty rows rescored, not a thousand.

If asked about re-ranking: Milvus rerankers score query-document text pairs
after retrieval. They cannot raise recall@10, because the ten are already
chosen. They move relevance, which the last section comes back to.
-->

---

{.chart-animate .small-title}

# Refinement pulls the other way

PCA and Matryoshka trade accuracy for speed and cost. Refinement spends a little of both to buy **accuracy** back - the same triangle, travelled in reverse.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [4,5]
  actions: false
  fit: contain
```

---

{.section}

# Is the index <span class="hero-text">worth it</span>?

<!-- notes
Bridge from compression. Everything so far made the index smaller: the box
priced in the next few slides holds 384 dimensions in SQ8, exactly the kind of
index the last section built. Now the question the room is actually asking in
2026: agents can grep, so when is an index worth paying for at all?

Two workloads, both from the RAG cost curve study: code search and agentic
(conversation) memory. Everything is open source and reproducible.
-->

---

{.small-title}

# Where the cost comes from

Four ways for an agent to answer the same question, the search itself is not expensive.

<svg class="cost-anatomy" viewBox="0 0 1400 378" role="img" aria-label="One pipeline, four ways to feed it. A question goes into a model and the model returns an answer. Four stations sit below the model. Parametric has no retrieval at all and pays only for the answer it writes. Agentic loops three to four times through a grep, read and glob tool, each turn cheap on its own but re-sending the whole transcript. Indexed takes one or two fat payloads of chunks from a vector search, and carries a navy band across the foot of its own box marking the charge it incurs per day whether or not anything is asked. Stuffed sends the whole corpus through a prompt cache once, in full, and reads from it cheaply after that. Every per-query charge is marked with a purple coin; the one per-day charge is the navy band inside the index's box.">
<defs>
<marker id="ca-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="18" markerHeight="18" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
<marker id="ca-arrow-fat" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="26" markerHeight="28" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
<marker id="ca-arrow-huge" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="30" markerHeight="32" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
<linearGradient id="ca-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#175fff"/><stop offset="50%" stop-color="#7f47ff"/><stop offset="100%" stop-color="#c84cff"/></linearGradient>
</defs>

<g class="nodes">
<rect class="node" x="20" y="32" width="190" height="68" rx="34"/><text class="nlabel" x="115" y="74" text-anchor="middle">question</text>
<path class="edge" d="M210 66 H494"/>
<rect class="node node-model" x="500" y="10" width="400" height="112" rx="10"/>
<text class="mlabel" x="700" y="58" text-anchor="middle">MODEL</text>
<text class="nsub nsub-source" x="700" y="94" text-anchor="middle">input + output tokens</text>
<path class="edge" d="M900 66 H1184"/>
<rect class="node" x="1190" y="32" width="190" height="68" rx="34"/><text class="nlabel" x="1285" y="74" text-anchor="middle">answer</text>
</g>

<g class="stage stage-1 fragment" data-fragment-index="1">
<rect class="node node-none" x="40" y="230" width="300" height="72" rx="10"/>
<text class="nlabel nlabel-none" x="190" y="274" text-anchor="middle">no retrieval</text>
<circle class="coin" cx="1045" cy="66" r="18"/><text class="coin-mark" x="1045" y="74" text-anchor="middle">$</text>
<text class="elabel" x="1045" y="106" text-anchor="middle">per query</text>
<rect class="tag tag-ghost" x="95" y="336" width="190" height="38" rx="19"/><text class="tlabel tlabel-ghost" x="190" y="362" text-anchor="middle">parametric</text>
</g>

<g class="stage stage-2 fragment" data-fragment-index="2">
<path class="edge call" d="M560 122 V206 H470 V224"/>
<path class="edge flow flow-thin" d="M590 230 V182 H620 V126"/>
<text class="elabel" x="470" y="188" text-anchor="middle">&times; 3 to 4 turns</text>
<rect class="node" x="380" y="230" width="300" height="72" rx="10"/>
<text class="nlabel" x="530" y="274" text-anchor="middle">grep / read / glob</text>
<circle class="coin" cx="590" cy="210" r="18"/><text class="coin-mark" x="590" y="218" text-anchor="middle">$</text>
<text class="elabel" x="616" y="216" text-anchor="start">per query</text>
<rect class="tag tag-navy" x="435" y="336" width="190" height="38" rx="19"/><text class="tlabel tlabel-navy" x="530" y="362" text-anchor="middle">agentic</text>
</g>

<g class="stage stage-3 fragment" data-fragment-index="3">
<path class="edge call" d="M790 122 V206 H810 V224"/>
<path class="edge flow flow-fat" d="M930 230 V196 H830 V152"/>
<text class="elabel" x="760" y="188" text-anchor="end">&times; 1 to 2</text>
<rect class="node" x="720" y="230" width="300" height="88" rx="10"/>
<text class="nlabel" x="870" y="260" text-anchor="middle">vector search</text>
<text class="nsub muted" x="870" y="285" text-anchor="middle">embed once, negligible</text>
<path class="plinth" d="M721.25 292 H1018.75 V308 A8.75 8.75 0 0 1 1010 316.75 H730 A8.75 8.75 0 0 1 721.25 308 Z"/>
<text class="plabel" x="870" y="310" text-anchor="middle">$ per day, query or not</text>
<rect class="node node-edge" x="720" y="230" width="300" height="88" rx="10"/>
<circle class="coin" cx="930" cy="210" r="18"/><text class="coin-mark" x="930" y="218" text-anchor="middle">$</text>
<text class="elabel" x="956" y="216" text-anchor="start">per query</text>
<rect class="tag tag-gradient" x="775" y="336" width="190" height="38" rx="19"/><text class="tlabel tlabel-gradient" x="870" y="362" text-anchor="middle">indexed</text>
</g>

<g class="stage stage-4 fragment" data-fragment-index="4">
<path class="edge flow flow-huge plain" d="M1210 230 V172 H1170"/>
<path class="edge flow flow-huge" d="M990 172 H880 V156"/>
<rect class="node node-cache" x="990" y="146" width="170" height="52" rx="10"/>
<text class="nsub" x="1075" y="179" text-anchor="middle">prompt cache</text>
<text class="elabel" x="1236" y="178" text-anchor="start">&times; 1</text>
<rect class="node" x="1060" y="230" width="300" height="72" rx="10"/>
<text class="nlabel" x="1210" y="274" text-anchor="middle">the whole corpus</text>
<circle class="coin" cx="1210" cy="210" r="18"/><text class="coin-mark" x="1210" y="218" text-anchor="middle">$</text>
<text class="elabel" x="1236" y="216" text-anchor="start">per query</text>
<rect class="tag tag-berry" x="1115" y="336" width="190" height="38" rx="19"/><text class="tlabel tlabel-berry" x="1210" y="362" text-anchor="middle">stuffed</text>
</g>
</svg>

<div class="cost-notes">
<p class="fragment" data-fragment-index="1">No search, no payload. You pay for the answer, and nothing else.</p>
<p class="fragment" data-fragment-index="2">Small results each time. But the whole transcript goes back every turn.</p>
<p class="fragment" data-fragment-index="3">One fat payload of chunks, and a box that bills daily whether you ask or not.</p>
<p class="fragment" data-fragment-index="4">The corpus is written to cache once, in full. Reads after that are cheap.</p>
</div>

<p class="closing-line is-emphatic fragment" data-fragment-index="5">Only the index has a fixed cost, everything else is per query or per embedding. The same logic applies for code search and agentic memory.</p>

<!-- notes
One click per arm. Nothing on this slide is a measured value; it is the
anatomy the next three slides fill in.

Parametric is the control: no repository access, you pay for the answer only.
Cheapest, and wrong most often.

Agentic is a loop: grep, read, glob, three or four turns. Each tool result is
small, but the entire transcript goes back into the model every turn. Turns
are the bill, not bytes off disk.

Indexed inverts that: one or two turns with a fatter payload of chunks. The
navy band is the point. The index also charges you for existing, a box every
day whether anyone asks it anything. It is the only per-day charge here.

Stuffed is the honest extreme: whole corpus in the prompt, let the cache do
the work. Reads are cheap but the write scales with the corpus.

Land the closing line: one fixed cost, everything else per query. So the
question is always how many queries a day repay the box.
-->

---

# Training data matters

A blind model answered 25 of 40 questions on fastapi, and
0 on a repository published after training cutoff.
<!-- src: data/ws6c/summary.csv:judge_accuracy arm=parametric, corpus=fastapi 0.625, corpus=agentic_hil 0.000 -->

```vega
- spec: ../rag-cost-curve/charts/accuracy-by-arm.vl.json
  actions: false
  renderer: svg
  signal-stage: [0, 1, 2, 3]
  fit: contain
```

<!-- notes
0.625 with zero access to the repository is the contamination floor: the
model already knows a lot about a famous open source project from
pretraining. The right-hand panel is the same pipeline on a repository
published after the training cutoff, and the floor is 0.000.

This is the "when" for code search. If the model already knows the code, grep
plus memory gets it most of the way and the index has little to add. If it
has never seen the code, retrieval is doing all the work.

Setup if asked: 40 questions per repo, Sonnet agent, Opus judge blind to the
arm, claude-context search_code over a Milvus index for the indexed arm.
-->

---

{.chart-animate .small-title}

# Cost per correct answer

*Total agent spend over the whole run, divided by the answers the judge marked correct*

<div class="chart-band">

```vega
- spec: ../rag-cost-curve/charts/cost-per-correct.vl.json
  actions: false
  renderer: svg
  fit: contain
  signal-stage: [0, 1]
  fragment-index: 0
```

</div>

<div class="card-grid cols-2 mechanism-cards fragment">
<div class="card">
<p><strong>Code it knows</strong></p>
<p>Every retrieval arm lands within <strong>~15%</strong> of the others.<!-- src: data/cost_per_correct.csv:corpus=fastapi agentic=0.0557, indexed_topk3=0.0598, indexed=0.0666 --></p>
</div>
<div class="card">
<p><strong>Code it has never seen</strong></p>
<p>The index is <strong>~40%</strong> cheaper per correct answer.<!-- src: data/cost_per_correct.csv:corpus=agentic_hil indexed=0.0930, agentic=0.1541 --></p>
</div>
</div>

<!-- notes
This one is not an estimate. Every question ran in every arm, I have the
invoice, and I divided it by the answers the judge marked correct. It is a
census, so there is no interval to argue about.

Stage one, fastapi, code the model knows: every retrieval arm within about
15% of the others. Nobody should pick an architecture off this.

Stage two, agentic-hil, code it has never seen: the ranking inverts. Indexed
goes from dearest to cheapest, 0.093 against grep's 0.154 per correct answer,
and more accurate, 39 of 40 against 36.

Caveats to have ready, do not volunteer them all:
- Judge cost is excluded, it is the measuring instrument, not anyone's bill.
- Break-even on unseen code lands at tens of queries a day, but the paired
  test does not clear at any size, so do NOT say "the index wins". Say "cheaper
  per correct answer", which is what the census shows.
- Prose goes the other way (about 6.9x dearer per correct answer than grep).
  It is in the rag-cost-curve backup slides.
-->

---

# Break-even on agentic memory

*Replaying a conversation history every query, against searching it with an index on a dedicated box*

```vega
- spec: ../rag-cost-curve/charts/cost-curve.vg.json
  actions: false
  renderer: svg
  signal-stage: 3
```

<!-- src: data/ws5/break_even.csv:workload=memory,footprint=pca_uc_384_sq8,hit_rate_basis=measured -->
<!-- src: data/ws5/break_even.csv:break_even_qpd workload=memory live_arm=replay index_arm=memsearch regime=claude infra_mode=dedicated hit_rate_basis=measured 333.76/14.84/10.42 at S/M/L -->

<!-- notes
Second workload: agent memory. A synthetic conversation history in markdown
at 98k, 392k and 1.2M tokens, with facts planted in it. Say "synthetic" out
loud. The live arm replays the whole transcript into context on every query,
prompt-cached; the index arm is memsearch over Milvus, hybrid dense plus BM25.

The line is break-even in queries per day on one r8g.large, 16 GiB, $86.07 a
month. 334 a day at 98k tokens, then 15 and 10. A 22x fall for a 4x corpus.
A short history asked a few times a day should not be indexed. Past a few
hundred thousand tokens, the index pays almost immediately.

The shaded band is the range I pre-registered before measuring, tens to
hundreds a day; all three points land inside it.

If pushed on the cache: steelmanned, at 99% hit rate the line reads 232, 35,
13. Still hundreds at the small end.
-->

---

{.floor-rungs}

# The floor can go to zero

*Same index, same corpus, the same measured token costs. Only the thing underneath it changes*

<div class="card-grid cols-3">
<div class="card"><p><span class="pill gradient">a box of your own</span></p><p>A dedicated r8g.large at <strong>$86.07 a month</strong> to hold the index. Break-even lands at <strong>10 - 334</strong> queries per day.<!-- src: data/ws5/break_even.csv:infra_mode=dedicated infra_month=86.06751; break_even_qpd 333.76/14.84/10.42 at S/M/L --></p></div>
<div class="card"><p><span class="pill navy">a box you already run</span></p><p>Milvus Lite on your laptop or spare space on an existing box. Same index, same prices, break-even on the first query.<!-- src: data/ws5/sensitivity.csv:max_spread_ratio=68944.94 knob=infra_mode workload=memory. The workload filter is load-bearing since WS9: the same knob reads 7421.06 on code_unseen --></p></div>
<div class="card is-win"><p><span class="pill ghost">no box at all</span></p><p>Serverless, metered per query with no floor to amortise. Every corpus combined fits into the <strong>Zilliz free-forever</strong> tier.<!-- src: data/ws5/serverless.csv:ws8_issues.billed_gb_upper=0.246826 pct_of_free_storage=4.9365 usd_per_query_max=0.00006; data/ws5/break_even.csv:c_index_query 0.0114765 to 0.0665983 --></p></div>
</div>

<p><span class="stamp-sub">Rates read off <a href="https://zilliz.com/pricing#calculator">zilliz.com/pricing#calculator</a> on 2026-09-15: $4 per million vCU, a 1536-dim FP16 write costing 0.75 vCU and a read on a 1M-vector collection 15 vCU. Reads grow with collection size, so 15 is an upper bound here. Free tier 5 GB storage plus 2.5M vCU a month, up to 5 collections.<!-- src: data/ws5/serverless.csv:kind=rate,model,free --></span></p>

<!-- notes
Every break-even so far assumed a dedicated box at $86 a month, and that box
is the whole numerator. Change what sits underneath and the floor moves.

A box you already run, Milvus Lite on a laptop or spare room on an existing
cluster: same index, break-even on the first query. No box at all: serverless,
metered per query, and every corpus in the study combined fits in the Zilliz
free tier.

So the real answer to "is the index worth it" is: for unseen code and long
agent memory, yes, and the fixed cost is a deployment choice, not a law.
Then turn: once you do index, here is how it quietly fails.
-->

---

{.section}

# Filters are tricky

---

{.small-title .filter-demo}

# Filtering quietly wrecks your recall

<br>

<div class="search-demo">
  <div class="header">
    <div>
      <div class="query">movie with a robot from the future, released after 2000, with Arnie</div>
    </div>
  </div>
</div>

<br>

```vega
- spec: ../../visualisations/filter-graph.json
  renderer: svg
  actions: false
  signal-stage: [0, 1, 2]
  fit: contain
```

<blockquote class="blue fragment bottom"><span class="label">The catch</span><p>The harder you filter, the more of the graph you destroy. So there's no single fix - <span class="hit-text">the right technique depends on how much survives the filter</span>.</p></blockquote>

---

{.small-title}

# Three ways out, by selectivity

<br>

<p style="text-align: center">How much of your data survives the filter decides the strategy.<br><strong>High</strong> selectivity (few pass) &nbsp;→&nbsp; <strong>Medium</strong> &nbsp;→&nbsp; <strong>Low</strong> selectivity (most pass)</p>

<br>

<div class="three-col cards" style="align-items: stretch; margin: 1vh 0;">
<div class="fragment">

**High** · brute force

The filter leaves only a handful of candidates. Skip the graph entirely and compute exact distances over the survivors - cheap because the set is tiny, and **100% recall**.

</div>
<div class="fragment">

**Medium** · filter-aware graph

Bake the filter labels into graph construction - the **_alpha_** pruning parameter keeps matching nodes reachable. You traverse only valid nodes without fragmenting the index.

</div>
<div class="fragment">

**Low** · post-filter

Almost everything passes, so search the full graph and drop the few non-matches afterward. Over-fetch a little to backfill your _k_.

</div>
</div>

<br>

<blockquote class="blue fragment bottom"><span class="label">What modern engines do</span><p>Zilliz watches selectivity per query and <span class="hit-text">picks the strategy automatically</span> - optimising for recall and latency in all scenarios.</p></blockquote>

---

{.section}

# When retrieval <span class="hero-text">quietly fails</span>

---

# The <span class="hero-text">EXPLAIN</span> you don't get

<br>

<div class="two-col cards" style="align-items: stretch; margin-top: 1vh;">
<div class="fragment">

**SQL / Lucene** · fails _loudly_

- `EXPLAIN` hands you the plan - which index, which scan, what it cost
- No match? You get **zero rows** - an unmistakable signal
- You get errors, stack traces, log lines

</div>
<div class="fragment">

**Vector search** · fails _silently_

- You get the _k_ rows you asked for - always
- Each carries a rank & score. **Nothing else**
- No plan, no "why", no "were these any good?"

</div>
</div>

<blockquote class="fragment bottom"><span class="label">The gap</span><p>SQL fails <span class="hit-text">loudly</span>. Vector search fails <span class="hit-text">silently</span> - so we build the instrumentation back ourselves.</p></blockquote>

---

# Measure what you can't see

You can't eyeball recall. You need a number - and you need it on every deploy.

Build a **golden set**: freeze a sample of real queries, compute their _true_ neighbours once with exact brute-force - the O(N) scan from the start of this talk. That's your ground truth. Then score the production index against it - `recall@k`, continuously.

```dot
golden [label="Golden\nquery set"]
exact [label="Exact\nbrute-force\nO(N), once"]
truth [label="Ground-truth\ntop-k"]
prod [label="Production\nindex (ANN)"]
recall [label="recall@k", fillcolor="#175fff", fontcolor="white"]
golden -> exact -> truth
golden -> prod [label="every deploy"]
truth -> recall [label="overlap"]
prod -> recall
```

---

# Spend recall on purpose

Every lever in this talk spends recall, buys it back, or checks the balance.

<svg class="levers-diagram" viewBox="0 0 1400 412" role="img" aria-label="The levers from this talk as a loop: pick the index, shrink the vectors, buy recall back at query time, match the filter strategy to selectivity, then measure recall@k against a golden set on every deploy and feed the result back into the index choice">
<defs>
<marker id="lv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
</defs>
<g class="rail"><path d="M10 360 H1390"/></g>
<text class="elabel muted" x="10" y="404">recall</text>
<g class="stage stage-1 fragment" data-fragment-index="1">
<rect class="node" x="10" y="110" width="236" height="120" rx="16"/>
<text class="nlabel" x="128" y="162" text-anchor="middle">Pick the index</text>
<text class="nsub" x="128" y="198" text-anchor="middle">HNSW · IVF · DiskANN</text>
<text class="elabel muted" x="128" y="272" text-anchor="middle">or let AUTOINDEX</text>
<rect class="tag" x="53" y="338" width="150" height="44" rx="22"/><text class="tlabel" x="128" y="368" text-anchor="middle">spend</text>
</g>
<g class="stage stage-2 fragment" data-fragment-index="2">
<path class="edge" d="M250 170 H292"/>
<rect class="node" x="296" y="110" width="236" height="120" rx="16"/>
<text class="nlabel" x="414" y="162" text-anchor="middle">Shrink it</text>
<text class="nsub" x="414" y="198" text-anchor="middle">SQ · PQ · RaBitQ</text>
<text class="elabel muted" x="414" y="272" text-anchor="middle">and MRL: fewer dims</text>
<rect class="tag" x="339" y="338" width="150" height="44" rx="22"/><text class="tlabel" x="414" y="368" text-anchor="middle">spend</text>
</g>
<g class="stage stage-3 fragment" data-fragment-index="3">
<path class="edge" d="M536 170 H578"/>
<rect class="node" x="582" y="110" width="236" height="120" rx="16"/>
<text class="nlabel" x="700" y="162" text-anchor="middle">Buy it back</text>
<text class="nsub" x="700" y="198" text-anchor="middle">refine · oversample</text>
<text class="elabel muted" x="700" y="272" text-anchor="middle">at query time</text>
<rect class="tag" x="625" y="338" width="150" height="44" rx="22"/><text class="tlabel" x="700" y="368" text-anchor="middle">buy back</text>
</g>
<g class="stage stage-4 fragment" data-fragment-index="4">
<path class="edge" d="M822 170 H864"/>
<rect class="node" x="868" y="110" width="236" height="120" rx="16"/>
<text class="nlabel" x="986" y="162" text-anchor="middle">Filter wisely</text>
<text class="nsub" x="986" y="198" text-anchor="middle">match selectivity</text>
<text class="elabel muted" x="986" y="272" text-anchor="middle">or recall collapses</text>
<rect class="tag" x="911" y="338" width="150" height="44" rx="22"/><text class="tlabel" x="986" y="368" text-anchor="middle">protect</text>
</g>
<g class="stage stage-5 fragment" data-fragment-index="5">
<path class="edge" d="M1108 170 H1150"/>
<rect class="node node-measure" x="1154" y="110" width="236" height="120" rx="16"/>
<text class="nlabel nlabel-measure" x="1272" y="162" text-anchor="middle">Measure</text>
<text class="nsub nsub-measure" x="1272" y="198" text-anchor="middle">recall@k, every deploy</text>
<text class="elabel muted" x="1272" y="272" text-anchor="middle">on a golden set</text>
<rect class="tag" x="1197" y="338" width="150" height="44" rx="22"/><text class="tlabel" x="1272" y="368" text-anchor="middle">audit</text>
</g>
<g class="stage stage-6 fragment" data-fragment-index="6">
<path class="edge dashed" d="M1272 104 V56 H128 V102"/>
<text class="elabel" x="700" y="42" text-anchor="middle">re-tune as data and models drift</text>
</g>
</svg>

<p class="closing-line fragment" data-fragment-index="6">Trade <strong>&lt;10% recall</strong> for <strong>&gt;100× speed</strong>, but only if you measure which 10% you gave up.</p>

<!-- notes
Six clicks, one per lever, then the loop.

1. Pick the index. HNSW, IVF, DiskANN when RAM runs out, or let AUTOINDEX
   turn the knobs. This is where you first spend recall for speed.
2. Shrink it. SQ, PQ, RaBitQ, and MRL or PCA for fewer dimensions. Spend
   more recall to fit the budget.
3. Buy it back. Refine with the SQ8 copies, oversample. Query-time levers,
   tuned per use case.
4. Filter wisely. Match the strategy to selectivity, or a filter quietly
   wrecks the recall you just paid for.
5. Measure. The golden set from the previous slide, recall@k on every deploy.
   Version the index alongside the model that built it.
6. The loop. Data shifts, models change, so the measurement feeds the next
   index choice. Land the big idea again: under 10% recall for over 100x,
   but only if you know what you gave up.

If asked what to monitor in production beyond recall@k: score spread and
filter hit-rate before the agent consumes results. Dual-write and A/B at the
index level during migrations. Budget for re-embedding from day one.
-->

---

{.title .no-chrome .no-footer}
<img loading="lazy" class="logo" src="../../../img/zilliz-light.svg" alt="">

# Thank you!

## simon @ zilliz.com

```authors
- name: Simon Hearne
  position: solutions architect
  company: zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```
