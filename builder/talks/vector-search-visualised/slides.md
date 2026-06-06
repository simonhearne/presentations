```deck
- agenda: false
```

{.title .no-chrome .automata}

<style>
  .q-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.7vw; margin: 1.6vh 0; }
  .q-grid img { width: 100%; aspect-ratio: 2 / 1; object-fit: contain; border-radius: 5px; image-rendering: pixelated; }
  .slide.quant-steps .vega-chart svg { width: 1050px; max-width: 100%; height: auto; }
  .slide.filter-demo .vega-chart svg { width: 1080px; max-width: 100%; height: auto; }
  .source-ref { font-family: var(--zilliz-font-mono, monospace); font-size: 0.55em; opacity: 0.5; margin-top: 1.5vh; }
  .source-ref a { color: inherit; }
</style>

<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Vector Search <br><span class="hero-text smashing">Visualised</span>

## A crash course in vector search

```authors
- name: Simon Hearne
  position: solutions architect
  company: zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```

<!-- ---

{.three-bg .dark .no-chrome .no-footer .center .big-text}

```three
- module: ../../visualisations/connectome.js
  id: connectome
```

<style>
.text-vignette {
  padding: 5em;
  background: radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 68%);
}
</style>

<div class="text-vignette">
<p class="fragment">You recognise a friend's face across a crowded room {.fragment .dark-bg-lift}</p>
<p class="fragment">~86B neurons, ~100T connections, ~2.7PB storage {.fragment .dark-bg-lift}</p>
<p class="fragment">We struggle to achieve that <em>one task</em> with computers. {.fragment .dark-bg-lift}</p>
</div> -->

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
    <p class="below-note">Zero shared words. Same <strong>meaning</strong>.</p>
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

{.dark .small-title .auto-reveal delay=900}

# What can we do with them?

<!-- Every modern model learns the same trick - text, images, audio, even molecules. Once meaning becomes geometry, the same idea unlocks: -->

<div class="usecase-grid">
  <div class="usecase-tile fragment"><span class="icon">📚</span><p class="label">RAG</p><p class="tagline">Ground LLMs in your own documents</p></div>
  <div class="usecase-tile fragment"><span class="icon">🧠</span><p class="label">Agent memory</p><p class="tagline">Recall the right past conversation</p></div>
  <div class="usecase-tile fragment"><span class="icon">⚖️</span><p class="label">Legal analysis</p><p class="tagline">Surface relevant case law</p></div>
  <div class="usecase-tile fragment"><span class="icon">🛡️</span><p class="label">Fraud detection</p><p class="tagline">Spot the needle in a stack of needles</p></div>
  <div class="usecase-tile fragment"><span class="icon">🎵</span><p class="label">Song matching</p><p class="tagline">Identify a tune from a whistle</p></div>
  <div class="usecase-tile fragment"><span class="icon">🛍️</span><p class="label">Visual search</p><p class="tagline">Find products that look like this photo</p></div>
  <div class="usecase-tile fragment"><span class="icon">🚗</span><p class="label">Autonomous driving</p><p class="tagline">Detect erratic lane changes</p></div>
  <div class="usecase-tile fragment"><span class="icon">🧬</span><p class="label">Molecular discovery</p><p class="tagline">Find molecules with similar shape</p></div>
  <div class="usecase-tile fragment"><span class="icon">🔬</span><p class="label">Cancer screening</p><p class="tagline">Match diagnostic images to known cases</p></div>
</div>

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
  signal-stage: [0,1,2,3]
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
```

---

{.small-title}

# Why flat search doesn't scale

16 faces, fine. A billion vectors? Not so much. Latency grows linearly and ~all of the comparisons are waste.

```vega
- spec: ../../visualisations/ann-vs-exact.json
  renderer: svg
  signal-stage: [0]
  actions: false
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
    <blockquote class="small blue fragment">
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
  <div class="bi-cell give"><span class="bi-num">~1%</span><span class="bi-lab">recall you give up</span></div>
  <div class="bi-arrow">→</div>
  <div class="bi-cell get"><span class="bi-num">100-1000×</span><span class="bi-lab">faster, cheaper search</span></div>
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

# IVF: tuning the knobs

| Param    | What it does                          | Bigger means                                     | When it's set | Good default |
| -------- | ------------------------------------- | ------------------------------------------------ | ------------- | ------------ |
| `nlist`  | number of Voronoi cells, set at build | finer cells, slower build, more centroids in RAM | Build   | √N           |
| `nprobe` | cells searched per query              | higher recall, slower query                      | Query         | 8 - 16       |

<br>

<blockquote class=""><span class="label">Recall too low</span><p>Raise <code>nprobe</code> first. If it plateaus, <code>nlist</code> is too high for your data: rebuild with fewer cells.</p></blockquote>

<blockquote class=""><span class="label">Too slow</span><p>Lower <code>nprobe</code>. Switch <code>IVF_FLAT</code> → <code>IVF_SQ</code> / <code>IVF_PQ</code> to shrink each cell scan.</p></blockquote>

<blockquote class=""><span class="label">Memory / build cost</span><p>Lower <code>nlist</code>, or use <code>IVF_PQ</code> to compress the vectors inside each cell.</p></blockquote>

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

# HNSW: tuning the knobs

| Param            | What it does                         | Bigger means                          | When it's set | Good default |
| ---------------- | ------------------------------------ | ------------------------------------- | ------------- | ------------ |
| `M`              | edges per node                       | better recall, more RAM, slower build | Build   | 16           |
| `efConstruction` | candidate-list width during build    | better graph quality, slower build    | Build   | 200          |
| `ef`             | candidate-list width per query (≥ k) | higher recall, slower query           | Query         | 64           |

<br>

<blockquote class=""><span class="label">Recall too low</span><p>Raise <code>ef</code> first (no rebuild needed). Still short? Increase <code>M</code> and <code>efConstruction</code>, then rebuild.</p></blockquote>

<blockquote class=""><span class="label">Too slow</span><p>Lower <code>ef</code>. A higher <code>M</code> lets a lower <code>ef</code> hit the same recall at the cost of higher RAM footprint.</p></blockquote>

<blockquote class=""><span class="label">Memory</span><p>Lower <code>M</code>, or 2 - 32x savings with quantisation.</p></blockquote>

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

{.small-title}

# DiskANN: tuning the knobs

| Param              | What it does                   | Bigger means                                | When it's set | Good default |
| ------------------ | ------------------------------ | ------------------------------------------- | ------------- | ------------ |
| `max_degree`       | graph out-degree (R)           | better recall, larger index, slower build   | Build   | 56           |
| `search_list_size` | build-time beam width (L)      | better graph quality, slower build          | Build   | 100          |
| `search_list`      | candidate list per query (≥ k) | higher recall, more SSD reads, slower query | Query         | 100          |

<br>

<blockquote class=""><span class="label">Recall too low</span><p>Raise <code>search_list</code> first. If it plateaus, rebuild with a higher <code>max_degree</code>.</p></blockquote>

<blockquote class=""><span class="label">Too slow / spiky p99</span><p>Lower <code>search_list</code>. SSD random-read IOPS is the bottleneck - make sure you're on NVMe!</p></blockquote>

---

# ANN Benefits

```vega
- spec: ../../visualisations/ann-vs-exact.json
  renderer: svg
  signal-stage: [0,1,2]
  actions: false
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
```

---

{.small-title}

# Sounds... complex?

`HNSW`, `IVF`, `DiskANN`, `nlist`, `nprobe`, `M`, `ef`, `search_list`. Can't the machine work it out?

<div class="two-col cards" style="align-items: stretch; margin: 1.5em 0;">
<div class="fragment">

**You tune** · open-source Milvus / other VectorDB

- Pick the index family yourself - IVF, HNSW, DiskANN, GPU…
- Set build knobs: `nlist`, `M` / `efConstruction`, graph degree
- Set search knobs per query: `nprobe`, `ef` - and re-tune as data shifts
- Choose quantisation & memory mode by hand

</div>
<div class="fragment">

**AUTOINDEX decides** · managed

- You set the **metric** and performance characteristics
- Index type, build params & quantisation derived automatically
- One `level` dial (1 - 10), default targets **~90% recall**
- Re-optimises per segment as the data moves

</div>
</div>

<blockquote class="fragment bottom"><span class="label">Trade-off</span><p>Full control and full responsibility, or <span class="hit-text">one dial</span> and trust the engine.</p></blockquote>

---

{.section}

# <span class="hero-text">Quantisation</span>: <br>smaller numbers

---

# Introducing the fingerprint

512 dimensions → a 16×32 grid → hue based on normalised dimension value → a fingerprint for each face.

<style>
  .fp-grid-wrap { --gap: 0.6vw; }
  .fp-grid-wrap .fp-trigger { position: absolute; }
  .fp-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-auto-rows: auto;
    gap: var(--gap);
    /* max-width: 70vh; */
  }
  .fp-grid .cell {
    position: relative;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border-radius: 6px;
    background: #eee;
  }
  .fp-grid .cell img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.5s ease;
  }
  .fp-grid .cell .fp { opacity: 0; image-rendering: pixelated; object-fit: contain; }
  .fp-grid-wrap .fp-trigger.is-revealed ~ .fp-grid .cell .face { opacity: 0; }
  .fp-grid-wrap .fp-trigger.is-revealed ~ .fp-grid .cell .fp { opacity: 1; }
</style>

<div class="fp-grid-wrap">
  <div class="fp-trigger fragment" aria-hidden="true"></div>
  <div class="fp-grid">
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/003983.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/003983.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/016605.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/016605.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/016709.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/016709.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/020172.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/020172.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/030754.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/030754.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/032437.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/032437.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/038300.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/038300.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/042926.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/042926.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/054550.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/054550.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/063886.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/063886.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/081746.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/081746.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/105328.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/105328.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/119244.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/119244.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/139091.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/139091.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/183263.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/183263.png" alt=""></div>
    <div class="cell"><img loading="lazy" class="face" src="../data/faces/187076.jpg" alt=""><img loading="lazy" class="fp" src="../data/fingerprints/187076.png" alt=""></div>
  </div>
</div>

---

{.small-title .center}

# Similar faces, similar fingerprints

The fingerprint isn't decoration - it _is_ the geometry. Close vectors share a pattern; distant ones don't.

<style>
  .fp-cmp { display: flex; flex-direction: column; gap: 4vh; margin: 3vh 0; }
  .fp-cmp .pair { display: grid; grid-template-columns: auto auto; gap: 2.5vw; align-items: center; justify-content: center; }
  .fp-cmp .verdict { font-family: var(--zilliz-font-mono, monospace); font-size: 1.1em; text-align: right; line-height: 1.4; }
  .fp-cmp .verdict .score { display: block; font-size: 1.9em; font-weight: 700; }
  .fp-cmp .verdict.hit .score { color: var(--zilliz-blue, #175fff); }
  .fp-cmp .verdict.miss .score { color: #c84cff; }
  .fp-cmp .row { display: flex; gap: 1.4vw; align-items: center; justify-content: center; }
  .fp-cmp figure { margin: 0; text-align: center; }
  .fp-cmp img { height: 13vh; border-radius: 6px; object-fit: cover; opacity: 0.85; }
  .fp-cmp .fp-duo { display: flex; align-items: center; gap: 0.6vw; padding: 1vh 1.2vw; border-radius: 12px; }
  .fp-cmp .fp-duo.hit { background: rgba(23, 95, 255, 0.09); outline: 1px solid rgba(23, 95, 255, 0.25); }
  .fp-cmp .fp-duo.miss { background: rgba(200, 76, 255, 0.09); outline: 1px solid rgba(200, 76, 255, 0.25); }
  .fp-cmp img.fp { height: 23vh; image-rendering: pixelated; object-fit: contain; background: #eee; opacity: 1; }
  .fp-cmp figcaption { font-family: var(--zilliz-font-mono, monospace); font-size: 0.7em; opacity: 0.6; margin-top: 0.4em; }
  .fp-cmp .vs { font-family: var(--zilliz-font-mono, monospace); opacity: 0.45; padding: 0 0.3vw; }
</style>

<div class="fp-cmp">
  <div class="pair fragment">
    <div class="verdict hit"><span class="score">0.43</span>cosine ·<br>close</div>
    <div class="row">
      <figure><img class="face" src="../data/faces/105328.jpg" alt=""><figcaption>face</figcaption></figure>
      <div class="fp-duo hit">
        <figure><img class="fp" src="../data/fingerprints/105328.png" alt=""><figcaption>fingerprint</figcaption></figure>
        <span class="vs">vs</span>
        <figure><img class="fp" src="../data/fingerprints/139091.png" alt=""><figcaption>fingerprint</figcaption></figure>
      </div>
      <figure><img class="face" src="../data/faces/139091.jpg" alt=""><figcaption>face</figcaption></figure>
    </div>
  </div>
  <div class="pair fragment">
    <div class="verdict miss"><span class="score">−0.35</span>cosine ·<br>far apart</div>
    <div class="row">
      <figure><img class="face" src="../data/faces/030754.jpg" alt=""><figcaption>face</figcaption></figure>
      <div class="fp-duo miss">
        <figure><img class="fp" src="../data/fingerprints/030754.png" alt=""><figcaption>fingerprint</figcaption></figure>
        <span class="vs">vs</span>
        <figure><img class="fp" src="../data/fingerprints/020172.png" alt=""><figcaption>fingerprint</figcaption></figure>
      </div>
      <figure><img class="face" src="../data/faces/020172.jpg" alt=""><figcaption>face</figcaption></figure>
    </div>
  </div>
</div>

---

# Scalar quantisation

Indexes make search _fast_. Quantisation makes vectors _small_. Round `float32 → int8`: **4× smaller embeddings**, a small recall hit, almost no work.

<blockquote class="blue fragment"><span class="label">Cheapest win</span><p>No training, no codebook - just rescale each value into a byte. <span class="hit-text">4× smaller</span>, and most indexes support it out of the box.</p></blockquote>

---

{.quant-steps}

# How scalar quantisation works

A float32 vector becomes one byte per dimension - step through the moves.

```vega
- spec: ../../visualisations/scalar-steps.json
  signal-stage: [0,1,2,3]
  renderer: svg
  actions: false
```

---

# RaBitQ: one bit per dimension

The recent breakthrough: rotate the space, then keep just the **sign** of each dimension - one bit. The bit-vector preserves angles with a _provable_ error bound, and a cheap correction term sharpens the estimate. Paired with the **RaBitQ index in Milvus**: up to **32× compression**.

<div class="q-grid">
  <img loading="lazy" src="../data/fingerprints-rabitq/003983.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/016605.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/016709.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/020172.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/030754.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/032437.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/038300.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/042926.png" alt="">
  <img loading="lazy" src="../data/fingerprints-rabitq/054550.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/063886.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/081746.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/105328.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/119244.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/139091.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/183263.png" alt=""><img loading="lazy" src="../data/fingerprints-rabitq/187076.png" alt="">
</div>

<blockquote class="blue fragment bottom"><span class="label">Milvus 2.6 · 1M × 768-D</span><p>1-bit alone: <span class="hit-text">32× smaller</span>, recall 0.76. Refine / rescore and recall recovers to <span class="hit-text">0.95</span> - at ~4× the throughput of full-precision flat.</p></blockquote>

---

{.quant-steps}

# How RaBitQ works

Rotate the space, then keep one bit per dimension - step through the moves.

```vega
- spec: ../../visualisations/rabitq-steps.json
  signal-stage: [0,1,2,3]
  renderer: svg
  actions: false
```

---

# Product quantisation

Scalar quantisation shrinks every number a little. **PQ** shrinks the whole vector a lot.

1. **Split** the 512-D vector into _m_ chunks - say 8 sub-vectors of 64-D.
2. **Cluster** each chunk's space with k-means into a small **codebook** (e.g. 256 centroids).
3. **Replace** each chunk with the ID of its nearest centroid - one byte, not 64 floats.
4. **Search** by reconstructing approximate distances straight from the codebooks - no decompression.

512 floats collapse to 8 IDs: a barcode.

<div class="q-grid fragment">
  <img loading="lazy" src="../data/fingerprints-pq/003983.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/016605.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/016709.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/020172.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/030754.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/032437.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/038300.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/042926.png" alt="">
  <img loading="lazy" src="../data/fingerprints-pq/054550.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/063886.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/081746.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/105328.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/119244.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/139091.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/183263.png" alt=""><img loading="lazy" src="../data/fingerprints-pq/187076.png" alt="">
</div>

<blockquote class="fragment"><span class="label">Warning</span><p>PQ leans on a <span class="hit-text">static codebook</span> - learned once, it degrades quietly under model drift.</p></blockquote>

---

{.quant-steps}

# How PQ works

A 512-D vector becomes eight centroid IDs - step through the four moves.

```vega
- spec: ../../visualisations/pq-steps.json
  signal-stage: [0,1,2,3]
  renderer: svg
  actions: false
```

---

{.small-title}

# What it costs you

Every lost bit risks recall, but the curve is surprisingly forgiving.

```vega
- spec: ../../visualisations/compression-recall.json
  renderer: svg
  signal-stage: [0,1]
  actions: false
```

---

{.chart-animate .small-title}

# Quantisation shifts everything cheaper

Each algorithm can use quantisation to trade accuracy for significantly reduced latency and cost.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [2,3]
  actions: false
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

# Matryoshka: one vector, many lengths

MRL tunes the model so the **dimensions are ordered by importance**. OpenAI's `text-embedding-3-large` is 3072-D native, but you can ask for any prefix down to 256-D via the `dimensions` parameter. The trade-off defers to **query time**.

<br>

<div class="two-col" style="grid-template-columns: 1.6fr 1fr; align-items: center;">
<div>

```vega
- spec: ../../visualisations/mrl-truncation.json
  renderer: svg
  signal-prefix: [256]
  actions: false
```

</div>
<div>

<blockquote class="blue small"><span class="label">Benefit</span><p>One model, <span class="hit-text">pick the length per query</span> - short prefix to shortlist fast, full vector to re-rank. Degrades gracefully.</p></blockquote>

<blockquote class="small"><span class="label">Drawback</span><p>Only works if the model was <em>trained</em> this way - truncate an ordinary embedding and recall falls off a cliff (the berry line).</p></blockquote>

</div>
</div>

<div class="fragment matryoshka-pop" aria-hidden="true">🪆</div>

<p class="source-ref">Funnel retrieval with Matryoshka embeddings · <a href="https://milvus.io/blog/matryoshka-embeddings-detail-at-multiple-scales.md">milvus.io/blog</a></p>

---

{.quant-steps}

# How Matryoshka works

The dimensions are ordered by importance, so a prefix is a complete vector - step through the moves.

```vega
- spec: ../../visualisations/mrl-steps.json
  signal-stage: [0,1,2,3]
  renderer: svg
  actions: false
```

---

{.chart-animate .small-title}

# Fewer dimensions, same precision

Dimensionality reduction nudges any index toward fast and cheap at once.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [3,4]
  actions: false
```

---

# Refine: search cheap, re-rank precise

Build time compression and dimensionality reduction both trade _accuracy to buy speed and scale_. **Refinement** wins accuracy back at query time.

<div class="two-col" style="grid-template-columns: 1.2fr 1fr; align-items: center;">
<div>

1. **Coarse pass** - bulk scan the 1-bit / PQ codes, over-fetch a wider candidate set.
2. **Refine pass** - re-rank that shortlist with retained higher-precision vectors.
3. **Return top-_k_** - recall recovers, latency barely moves.

</div>
<div>

<blockquote class="blue"><span class="label">Milvus built-in</span><p>Set <code>refine: true</code> at build, tune <code>refine_k</code> at query. Supported on RaBitQ, PQ and SQ indexes.</p></blockquote>

</div>
</div>

<blockquote class="fragment bottom"><span class="label">Superpower</span><p>Zilliz uses this technique for indexing <span class="hit-text">external</span> tables, for on-demand lakebase compute.</p></blockquote>

---

{.chart-animate .small-title}

# Refinement pulls the other way

PCA and Matryoshka trade accuracy for speed and cost. Refinement spends a little of both to buy **accuracy** back - the same triangle, travelled in reverse.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [4,5]
  actions: false
```

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

Trivial in SQL. On a graph index, the obvious fix quietly backfires 😞{.fragment}

```vega
- spec: ../../visualisations/filter-graph.json
  renderer: svg
  actions: false
  signal-stage: [0, 1, 2]
```

<blockquote class="blue fragment bottom"><span class="label">The catch</span><p>The harder you filter, the more of the graph you destroy. So there's no single fix - <span class="hit-text">the right technique depends on how much survives the filter</span>.</p></blockquote>

---

{.small-title}

# Three ways out, by selectivity

<br>

<p style="text-align: center">How much of your data survives the filter decides the strategy.<br><strong class="hit-text">High</strong> selectivity (few pass) &nbsp;→&nbsp; <strong>Medium</strong> &nbsp;→&nbsp; <strong>Low</strong> selectivity (most pass)</p>

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

<blockquote class="blue fragment bottom"><span class="label">What modern engines do</span><p>Zilliz watches selectivity per query and <span class="hit-text">picks the strategy automatically</span> - so you stay connected and accurate across the whole range.</p></blockquote>

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

{.small-title}

# Or let the platform measure it

Maintaining a golden set is work. Zilliz Cloud can compute `recall@k` for you, per query.

<pre><code>// POST /v2/vectordb/entities/search
{ "data": [[0.12, -0.04, ...]],          // query, embedded
  "limit": 10,                           // k = 10
  "searchParams": { "level": 6, <mark>"enableRecallCalculation": true</mark> } }

// → response
{ "code": 0,
  "data": [
    { "distance": 0.912, "title": "The Terminator" },      // ✓ relevant
    { "distance": 0.874, "title": "Terminator 3" },        // ✓ relevant
    { "distance": 0.861, "title": "I, Robot" },            // ✗ off-theme
    // … 7 more …
  ],
  <mark>"recalls": [0.667]</mark> }                   // 4 of 6 true neighbours in top-10
</code></pre>

<blockquote class="fragment bottom"><span class="label">How</span><p>It runs your search twice - once at your <code>level</code>, once in a high-precision mode that stands in as <span class="hit-text">ground truth</span>. The brute-force comparison from the last slide, done for you, per query.</p></blockquote>

---

{.small-title}

# Signals of silent degradation

| Symptom                              | Likely cause                                   | Where to look                                             |
| ------------------------------------ | ---------------------------------------------- | --------------------------------------------------------- |
| Recall drops, latency flat           | Index params drifted, or the data outgrew them | Raise `nprobe` / `ef` search effort                       |
| Recall drops right after a deploy    | The embedding model changed                    | Full reindex - old and new vectors aren't comparable      |
| Fine in tests, wrong in production   | Filtering                                      | Pre- vs post-filter; a selective filter wrecked the index |
| Scores all clustered, none confident | Cross-modal miscalibration                     | Normalise per modality; add a re-ranker                   |
| Recall erodes slowly over weeks      | Concept drift - the world moved on             | Refresh embeddings; watch the golden set                  |
| Memory or cost spiked                | Quantisation / index misconfigured             | Compression level vs your recall budget                   |

---

# Your agent won't tell you

A database throws an error, an agent won't.

Feed a RAG pipeline or an agent degraded results and **nothing crashes**. It just gets a bit worse, every time. {.fragment}

<p class="punchline fragment">The failure never surfaces as a failure.<br>It surfaces as <em>"the assistant got dumber"</em></p>

<blockquote class="fragment"><span class="label">Catch it here</span><p>Instrument retrieval <em>itself</em> - <span class="hit-text">recall@k</span>, score spread, filter hit-rate - and watch it <strong>before</strong> the agent ever consumes the results.</p></blockquote>

<blockquote class="fragment blue"><span class="label">Pro-tip</span><p>Use <span class="hit-text">refinement</span> and <span class="hit-text">semantic highlighting</span> to defend against poor results and high token usage.</p></blockquote>

---

# Strategies that actually work

- **Determine the correct index for your requirements** - HNSW, IVF or DiskANN when RAM runs out. Let AUTOINDEX choose if you'd rather not turn the knobs yourself.
- **Compress to fit your budget** - quantisation (SQ → PQ → RaBitQ) and dimensionality reduction trade recall for memory and speed.
- **Use query-time levers** - experiment with oversampling, refining, semantic highlighting to find the best balance of trade-offs for each use case.
- **Measure recall@k constantly** - version the index alongside the model that built it, and dual-write / A/B at the index level during migrations.
- **Watch retrieval before the agent consumes it** - score spread and filter hit-rate, not just recall@k. And budget for re-embedding from day one; it's not a side-quest.

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
