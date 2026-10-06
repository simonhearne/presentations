```deck
- agenda: false
```

{.title .no-chrome .constellation}

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

```three
- module: ../../visualisations/constellation.js
  id: constellation
  points: 90
  k: 5
```

---

{.small-title}

# Why vector search exists...

<div class="search-demo">
  <div class="header fragment">
    <div>
      <div class="query">Maison Lune dress for a summer wedding in Provence</div>
    </div>
  </div>

  <div class="body">

  <div class="section fragment">
    <div class="section-title"><span>Keyword</span><span class="tag">BM25</span></div>
    <ol class="results">
      <li class="result"><span class="rank">01</span><span class="title"><span class="hit-text">Maison Lune</span> Wool Coat</span><span class="pill miss">Wrong</span></li>
      <li class="result"><span class="rank">02</span><span class="title"><span class="hit-text">Maison Lune</span> Gift Card</span><span class="pill miss">Wrong</span></li>
      <li class="result is-hit"><span class="rank">03</span><span class="title"><span class="hit-text">Maison Lune</span> Linen Floral Midi</span><span class="pill hit">Match</span></li>
      <li class="result"><span class="rank">04</span><span class="title"><span class="hit-text">Provence</span> Lavender Candle</span><span class="pill miss">Wrong</span></li>
      <li class="result"><span class="rank">05</span><span class="title"><span class="hit-text">Summer Wedding</span> Planner</span><span class="pill miss">Wrong</span></li>
    </ol>
    <p class="below-note">Finds the <strong>brand</strong>, misses the <strong>occasion</strong>.</p>
  </div>

  <div class="section fragment">
    <div class="section-title"><span>Vector</span><span class="tag">dense</span></div>
    <ol class="results">
      <li class="result"><span class="rank">01</span><span class="title">Linen Floral Midi · other brand</span><span class="pill near">Close</span></li>
      <li class="result"><span class="rank">02</span><span class="title">Sage Chiffon Wrap · other brand</span><span class="pill near">Close</span></li>
      <li class="result is-hit"><span class="rank">03</span><span class="title"><span class="hit-text">Maison Lune</span> Linen Floral Midi</span><span class="pill hit">Match</span></li>
      <li class="result"><span class="rank">04</span><span class="title">Pale Blue Cotton Midi · other brand</span><span class="pill near">Close</span></li>
      <li class="result"><span class="rank">05</span><span class="title">Blush Silk Slip · other brand</span><span class="pill near">Close</span></li>
    </ol>
    <p class="below-note">Gets the <strong>occasion</strong>, blurs the <strong>brand</strong>.</p>
  </div>

  <div class="section fragment is-best">
    <div class="section-title"><span>Hybrid</span><span class="tag">BM25 + dense</span></div>
    <ol class="results">
      <li class="result is-hit"><span class="rank">01</span><span class="title"><span class="hit-text">Maison Lune</span> Linen Floral Midi</span><span class="pill hit">Match</span></li>
      <li class="result is-hit"><span class="rank">02</span><span class="title"><span class="hit-text">Maison Lune</span> Sage Wrap Dress</span><span class="pill hit">Match</span></li>
      <li class="result is-hit"><span class="rank">03</span><span class="title"><span class="hit-text">Maison Lune</span> Cotton Sundress</span><span class="pill hit">Match</span></li>
      <li class="result is-hit"><span class="rank">04</span><span class="title"><span class="hit-text">Maison Lune</span> Pale Blue Midi</span><span class="pill hit">Match</span></li>
      <li class="result"><span class="rank">05</span><span class="title">Linen Floral Midi · other brand</span><span class="pill near">Close</span></li>
    </ol>
    <p class="below-note">The <strong>brand</strong> and the <strong>occasion</strong>.</p>
  </div>

  </div>
</div>
<br><br>

<blockquote class="fragment bottom"><span class="label">Takeaway</span><p>Keyword matches <span class="hit-text">tokens</span>, vectors match <span class="hit-text">meaning</span>. In production you run <span class="hit-text">both</span>: Milvus does BM25 and dense in one query.</p></blockquote>

<!-- notes
One shopper, one errand, and it runs through every search demo tonight: a
guest dress for a summer wedding in Provence. Maison Lune is made up.

Keyword nails the brand and nothing else: a coat, a gift card, a candle
because it says Provence. No synonym list turns "summer wedding in Provence"
into linen, midi, floral. Vector gets the occasion, light fabrics and
pastels, but treats "Maison Lune" as just more meaning, so other brands
crowd in. Hybrid fuses both ranked lists. Built into Milvus: BM25 full-text
plus dense in one hybrid search, fused with RRF or weighted ranking.
-->

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

{.small-title}

# Let's build a dress-finder model

```three
- module: ./dress-cloud.js
```

---

{.small-title}

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

16 dresses, fine. A billion vectors? Not so much. Latency grows linearly and ~all comparisons are waste.

```vega
- spec: ../../visualisations/ann-vs-exact.json
  renderer: svg
  signal-stage: [0, 1]
  actions: false
  fit: contain
```

---

{.section}

# <span class="hero-text">Approximate</span> <br>nearest neighbour

<div class="section-byline">
  <div class="bi-cell give"><span class="bi-num">&lt;10%</span><span class="bi-lab">recall you give up</span></div>
  <div class="bi-arrow">→</div>
  <div class="bi-cell get"><span class="bi-num">&gt;100×</span><span class="bi-lab">faster, cheaper search</span></div>
</div>

<!-- notes
The big idea of the whole talk, in one line: give up under 10% recall, get
over 100x faster and cheaper search. Everything in this section is how.
-->

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

{.small-title}

# Recall & Precision: how we measure <span class="hero-text">accuracy</span>

<div class="search-demo">
  <div class="header fragment">
    <div>
      <div class="query">dress for a summer wedding in Provence</div>
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
      <li class="result is-hit"><span class="rank">01</span><span class="title">Linen Floral Midi</span><span class="pill hit">Relevant</span></li>
      <li class="result"><span class="rank">02</span><span class="title">Ivory Lace Maxi <span class="year">never wear white</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result is-hit"><span class="rank">03</span><span class="title">Sage Chiffon Wrap Dress</span><span class="pill hit">Relevant</span></li>
      <li class="result"><span class="rank">04</span><span class="title">Black Wool Sheath <span class="year">not summer</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result"><span class="rank">05</span><span class="title">Striped Beach Cover-up <span class="year">not a wedding</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result is-hit"><span class="rank">06</span><span class="title">Lavender-Print Sundress</span><span class="pill hit">Relevant</span></li>
      <li class="result"><span class="rank">07</span><span class="title">Sequin Cocktail Dress <span class="year">evening, not daytime</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result"><span class="rank">08</span><span class="title">Linen Wide-Leg Trousers <span class="year">not a dress</span></span><span class="pill miss">Not relevant</span></li>
      <li class="result is-hit"><span class="rank">09</span><span class="title">Pale Blue Cotton Midi</span><span class="pill hit">Relevant</span></li>
      <li class="result"><span class="rank">10</span><span class="title">Velvet Midi <span class="year">winter</span></span><span class="pill miss">Not relevant</span></li>
      <div class="cutoff">
        <span class="cutoff-label">k = 10 cutoff</span>
        <span class="cutoff-line"></span>
      </div>
      <li class="result below is-hit"><span class="rank">14</span><span class="title">Blush Silk Slip Midi</span><span class="pill hit">Relevant</span></li>
      <li class="result below is-hit"><span class="rank">27</span><span class="title">Terracotta Poplin Maxi</span><span class="pill hit">Relevant</span></li>
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
      <p>Recall &amp; precision are measured against <span class="hit-text">exact</span> search, not human judgement.</p>
    </blockquote>
    <blockquote class="small blue fragment" style="margin-top: 0">
      <span class="label">Thought</span>
      <p>What would happen if we <span class="hit-text">filtered to size 38, under €150?</span></p>
    </blockquote>
  </div>

  </div>
</div>


<!-- notes
Same errand, brand dropped: now it is pure meaning, vector search's home
ground, so this is where we measure it.

On the misses: every "not relevant" dress has half the query. Ivory lace:
a wedding dress, and you never wear white to someone else's wedding. Black
wool, velvet: wedding-ish, wrong season. Beach cover-up: summer, no wedding.
Sequins: a party, but this is a daytime garden in Provence. Trousers: right
fabric, not a dress. The two we missed sit at 14 and 27, perfectly good
dresses the index ranked below the cut.
-->
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

# IVF: partition the space

IVF clusters the vectors into _nlist_ cells. At query time, only search within the nearest _nprobe_ cells. A true neighbour just over the border of a cell you never open is simply gone.

```vega
- spec: ../../visualisations/ivf-voronoi.json
  renderer: svg
  actions: false
  signal-stage: [2, 4, 6]
  signal-qx: 5.75
  signal-interactive: false
```

<!-- notes
Three clicks: nprobe 2, 4, 6. Filled blue are the true top-10, found.
Ringed berry are true top-10 sitting in a cell we never opened: that is
where recall goes. Each click opens more cells and the berry rings turn
blue, at the cost of scanning more vectors (top-left counter): 5, then 9,
then all 10.

This is the answer to "why does recall drop where it does": queries near a
cell border lose neighbours to the cell next door. Raising nprobe is the
fix, and it is paid for in scanned vectors.

Query pinned at qx=5.75, qy=5 (chosen so nprobe 2 misses five) and frozen
on load. Click the chart to let the query follow the pointer.
-->

---

{.no-vega-bindings}

# DiskANN: when RAM runs out

Graph index, engineered for SSD. Minimises random reads, index billions of vectors on ~GBs of RAM.

<!--
TALK TRACK (~45s, one ArrowRight per stage - 2 advances, then the deck moves on)
Left: a built Vamana graph (grey local edges, a few purple long-range ones).
Right: what lives where. RAM strip = PQ codes, SSD grid = one block per vector.

Stage 0 - Where things live.
  On screen: graph, RAM strip of tiny PQ codes, SSD grid of 60 blocks.
  "DiskANN is a graph index like HNSW, flattened to one layer and built so it
   can live on disk. Each vector's full data and its neighbour list sit
   together in one SSD block. RAM only keeps a compressed PQ code per vector,
   a few dozen bytes. The purple long edges are what the build deliberately
   keeps so a search can cross the space in a few hops."

Stage 1 - Query lands. [->]
  On screen: orange query star, medoid labelled as the entry point.
  "A query arrives. Every search starts from the same place, the medoid."

Stage 2 - The walk. [->] (animates on its own, ~6s)
  On screen: each hop lights a node, its SSD block, and the neighbours'
  PQ codes in RAM; counter climbs to 5, then "flat scan: 60 reads".
  "Each hop is one SSD read: pull the block, get the neighbour list, score
   those neighbours cheaply with the PQ codes already in RAM, jump to the
   closest. Five reads and we've converged. A flat scan would read all sixty.
   Notice the blocks are scattered: these are random reads, which is why
   DiskANN wants an NVMe SSD, and why minimising hops is the whole game."
-->

```vega
- spec: ../../visualisations/diskann-query.json
  renderer: svg
  signal-stage: [0,1,2]
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

All those knobs. Can't the machine work it out?

<!--
TALK TRACK (~40s, 2 advances)

Stage 0 - You tune.
  On screen: one control panel, eight decisions across build, query, operate.
  "Everything we just saw is yours to set in open-source Milvus. Pick the
   metric, pick the index family, set its build knobs, pick quantisation.
   Then at query time a different knob per family: nprobe for IVF, ef for
   HNSW, search_list for DiskANN. And when the data shifts, you re-tune."

Stage 1 - AUTOINDEX decides. [->]
  On screen: build controls are replaced by AUTO pills, the three query knobs fold
  into one level dial, the counter drops to 2.
  "With AUTOINDEX you still choose the metric. Index type, build params and
   quantisation are picked for you, per segment, and re-optimised as data
   moves. At query time there is one dial, level 1 to 10: recall vs speed."

Stage 2 - Trade-off. [->]
-->

<svg class="tune-panel" viewBox="0 0 1700 570" role="img" aria-label="A control panel of index settings. Manually you set eight things: metric, index family, M, efConstruction and quantisation at build time, nprobe, ef or search_list per query, and re-tune by hand as the data shifts. With AUTOINDEX the build row is chosen automatically, the three query knobs collapse into a single level dial from 1 to 10, and only the metric and level remain yours.">
<rect class="panel" x="10" y="80" width="1680" height="480" rx="16"/>
<path class="divider" d="M30 270 H1670 M30 450 H1670"/>
<g class="head manual"><text class="htitle" x="20" y="50">You tune <tspan class="hsub">· open-source Milvus / other vector DBs</tspan></text><text class="hcount" x="1690" y="50" text-anchor="end">8 decisions</text></g>
<g class="rows">
<text class="rlabel" x="40" y="170">BUILD</text><text class="rsub" x="40" y="197">per index</text>
<text class="rlabel" x="40" y="355">QUERY</text><text class="rsub" x="40" y="382">per request</text>
<text class="rlabel" x="40" y="500">OPERATE</text><text class="rsub" x="40" y="527">as data shifts</text>
</g>
<g class="switch">
<rect class="sw" x="210" y="135" width="270" height="50" rx="25"/><rect class="sw-on" x="390" y="135" width="90" height="50" rx="25"/>
<text class="swt" x="255" y="167" text-anchor="middle">L2</text><text class="swt" x="345" y="167" text-anchor="middle">IP</text><text class="swt on" x="435" y="167" text-anchor="middle">COSINE</text>
<text class="klabel" x="345" y="232" text-anchor="middle">metric</text>
</g>
<g class="auto-dim">
<g class="switch">
<rect class="sw" x="510" y="135" width="400" height="50" rx="25"/><rect class="sw-on" x="610" y="135" width="100" height="50" rx="25"/>
<text class="swt" x="560" y="167" text-anchor="middle">IVF</text><text class="swt on" x="660" y="167" text-anchor="middle">HNSW</text><text class="swt" x="760" y="167" text-anchor="middle">DiskANN</text><text class="swt" x="860" y="167" text-anchor="middle">GPU</text>
<text class="klabel" x="710" y="232" text-anchor="middle">index</text>
</g>
<g class="knob" transform="translate(1060 160)"><circle r="32"/><path d="M0 0 V-24" transform="rotate(40)"/></g><text class="klabel" x="1060" y="232" text-anchor="middle">M</text>
<g class="knob" transform="translate(1200 160)"><circle r="32"/><path d="M0 0 V-24" transform="rotate(115)"/></g><text class="klabel" x="1200" y="232" text-anchor="middle">efConstruction</text>
<g class="switch">
<rect class="sw" x="1350" y="135" width="285" height="50" rx="25"/><rect class="sw-on" x="1445" y="135" width="95" height="50" rx="25"/>
<text class="swt" x="1397" y="167" text-anchor="middle">none</text><text class="swt on" x="1492" y="167" text-anchor="middle">SQ8</text><text class="swt" x="1587" y="167" text-anchor="middle">PQ</text>
<text class="klabel" x="1492" y="232" text-anchor="middle">quantisation</text>
</g>
</g>
<g class="collapse" style="--dx: 160px"><g class="knob" transform="translate(360 350)"><circle r="32"/><path d="M0 0 V-24" transform="rotate(20)"/></g><text class="klabel" x="360" y="420" text-anchor="middle">nprobe</text></g>
<g class="collapse" style="--dx: 0px"><g class="knob" transform="translate(520 350)"><circle r="32"/><path d="M0 0 V-24" transform="rotate(-90)"/></g><text class="klabel" x="520" y="420" text-anchor="middle">ef</text></g>
<g class="collapse" style="--dx: -160px"><g class="knob" transform="translate(680 350)"><circle r="32"/><path d="M0 0 V-24" transform="rotate(75)"/></g><text class="klabel" x="680" y="420" text-anchor="middle">search_list</text></g>
<text class="note manual" x="800" y="358">a different knob for every index family</text>
<text class="op manual" x="210" y="513">↻  watch recall drift, re-tune, rebuild</text>
<g class="stage stage-1 fragment" data-fragment-index="1">
<g class="head"><text class="htitle" x="20" y="50">AUTOINDEX decides <tspan class="hsub">· managed, on Zilliz Cloud</tspan></text><text class="hcount auto" x="1690" y="50" text-anchor="end">2 decisions</text></g>
<rect class="ring" x="198" y="123" width="294" height="74" rx="37"/>
<text class="klabel auto" x="345" y="262" text-anchor="middle">you choose</text>
<rect class="auto-badge" x="506" y="126" width="408" height="68" rx="34"/><text class="auto-badge-t" x="710" y="169" text-anchor="middle">AUTO</text>
<rect class="auto-badge" x="1010" y="126" width="240" height="68" rx="34"/><text class="auto-badge-t" x="1130" y="169" text-anchor="middle">AUTO</text>
<rect class="auto-badge" x="1346" y="126" width="293" height="68" rx="34"/><text class="auto-badge-t" x="1492" y="169" text-anchor="middle">AUTO</text>
<g class="dial" transform="translate(520 360)">
<circle r="56"/>
<g class="ticks"><path d="M0 -64 V-74" transform="rotate(-135)"/><path d="M0 -64 V-74" transform="rotate(-105)"/><path d="M0 -64 V-74" transform="rotate(-75)"/><path d="M0 -64 V-74" transform="rotate(-45)"/><path d="M0 -64 V-74" transform="rotate(-15)"/><path d="M0 -64 V-74" transform="rotate(15)"/><path d="M0 -64 V-74" transform="rotate(45)"/><path d="M0 -64 V-74" transform="rotate(75)"/><path d="M0 -64 V-74" transform="rotate(105)"/><path d="M0 -64 V-74" transform="rotate(135)"/></g>
<path class="pointer" d="M0 0 V-42" transform="rotate(-15)"/>
<text class="dnum" x="-68" y="80" text-anchor="middle">1</text><text class="dnum" x="68" y="80" text-anchor="middle">10</text>
</g>
<text class="dlabel" x="640" y="352">level</text>
<text class="dsub" x="640" y="386">one dial: recall vs speed</text>
<text class="op auto" x="210" y="513">↻  re-optimised per segment as the data moves</text>
</g>
</svg>

<blockquote class="fragment bottom" data-fragment-index="2"><span class="label">Trade-off</span><p>Full control and full responsibility, or <span class="hit-text">one dial</span> and trust the engine.</p></blockquote>

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

<p class="closing-line fragment" data-fragment-index="4">100M chunks and you are holding <strong>1.23 TB</strong> before indexing overhead or a single query runs.</p>

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

Round `float32 → int8`: **4x smaller embeddings**, a tiny recall hit & almost no work.

```vega
- spec: ../../visualisations/scalar-steps.json
  signal-stage: [0,1,2,3]
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

# What it costs you [(in theory)]{.reality-swap}

Every lost bit risks recall, but the curve is surprisingly forgiving.

```vega
- spec: compression-recall.json
  renderer: svg
  signal-stage: [1, 2]
  actions: false
  fit: contain
```

<!-- src: compression-recall.json:source_1 (recall illustrative, authored at 768-D; the Embedding dim control scales residual error for PQ/PRQ/RaBitQ only. Stage 2 x drift: measured footprint vs IVF_FLAT fp32 from rag-cost-curve/data/ws2/curves_1m.csv (1024-D) for SQ8 3.60x, PQ m512/m256/m128 6.16/9.39/12.93x, RaBitQ 13.98x, RaBitQ+SQ8 refine k=2 3.19x; RaBitQ+refine with SQ8 on disk inferred at bare RaBitQ footprint 13.98x and refine recall; FP16/BF16/PQ 4/PRQ approximated as 1/(1/c + 0.04)) -->

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

Refinement spends a little cost & latency to buy **accuracy** back.

```vega
- spec: ../../visualisations/trade-off-triangle.json
  renderer: svg
  signal-stage: [4,5]
  actions: false
  fit: contain
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
      <div class="query">dress for a summer wedding in Provence · size 38 · under €150</div>
    </div>
  </div>
</div>

<br>

```vega
- spec: ../../visualisations/filter-graph.json
  renderer: svg
  actions: false
  signal-stage: [0, 1, 2]
  fragment-index: 0
  fit: contain
```

<blockquote class="blue fragment bottom" data-fragment-index="1"><span class="label">The catch</span><p>The harder you filter, the more of the graph you destroy.<br>There's no single fix - <span class="hit-text">the right technique depends on how much survives the filter</span>.</p></blockquote>

<!-- notes
Same errand, now with the filters every shop has: size 38, under 150 euros.
The green node is the perfect dress, and it passes both filters. But the
filter knocked out the dresses around it, the ones the graph used to walk
through, so the search stops at the orange node and returns something worse.
No error, no warning: the shopper just never sees it.
-->

---

{.small-title}

# Three ways out

```vega
- spec: ../../visualisations/filter-strategies.json
  renderer: svg
  actions: false
  signal-stage: [0, 1, 2, 3]
  fit: contain
```

<!-- src: milvus.io/blog/how-to-filter-efficiently-without-killing-recall.md (alpha strategy, brute-force fallback at ~99% filtered, metadata-aware column graphs, iterative filtering, external filtering, AUTOINDEX) -->
<!-- src: milvus.io/docs/filtered-search.md (search_params={"hints": "iterative_filter"}) -->

<!-- notes
Source: milvus.io/blog/how-to-filter-efficiently-without-killing-recall.md.

Axes first: how much survives the filter, and how costly the filter is.

Alpha (cheap filter, most survive). The graph traversal visits filtered-out nodes with a
probability tied to the filter ratio, purely as stepping stones, so matches
on the far side stay reachable. That is the "graph destroyed" picture on the
previous slide, repaired.

Brute force (right strip): when the filter removes about 99%, Milvus detects it and
falls back to brute force over the survivors.

Iterative (costly filter): inspired by VBase. Search a batch,
filter it, fetch more until k survive. Wins when evaluating the filter costs
more than the vector maths. The hint is hints="iterative_filter" in the
search params.

If asked: metadata-aware indexing (column graphs per field) for repeated
filter patterns; external filtering through the search iterator when the
filter data lives in Postgres or Mongo. ACORN is the academic approach to
the same problem. On Zilliz Cloud, metadata-aware indexing adds subgraphs
for filter values you hit often, and AUTOINDEX tunes the rest from your
data's statistics.
-->
---

{.section}

# When retrieval <span class="hero-text">quietly fails</span>

---

# The <span class="hero-text">EXPLAIN</span> you don't get

<div class="explain-pair">
<div class="term fragment" data-fragment-index="1">
<div class="term-head"><span class="term-name">postgres</span><span class="term-verdict">fails loudly</span></div>
<pre><span class="prompt">=#</span> EXPLAIN ANALYZE SELECT * FROM dresses
     WHERE size = 38 AND price &lt; 150;
<span class="out">Index Scan using <mark>dresses_size_price_idx</mark>
  (cost=<mark>0.42..8.44</mark> rows=12)
  (actual time=0.03..0.04 <mark>rows=12</mark> loops=1)
  Index Cond: ((size = 38) AND (price &lt; 150))
Execution Time: 0.05 ms</span></pre>
<div class="term-tags"><span>which index</span><span>what it cost</span><span>how many matched</span></div>
</div>
<div class="term milvus fragment" data-fragment-index="2">
<div class="term-head"><span class="term-name">milvus</span><span class="term-verdict">fails silently</span></div>
<pre><span class="prompt">&gt;&gt;&gt;</span> client.search("dresses", data=[q], limit=5,
      filter="size == 38 and price &lt; 150")</pre>
<div class="hits">
<ol class="hit-list got">
<li class="hit-label">what you got</li>
<li class="returned"><span>#1</span><span>dress_8812</span><span>0.83</span></li>
<li><span>#2</span><span>dress_1204</span><span>0.81</span></li>
<li><span>#3</span><span>dress_0937</span><span>0.80</span></li>
<li><span>#4</span><span>dress_5521</span><span>0.79</span></li>
<li><span>#5</span><span>dress_3310</span><span>0.78</span></li>
<li class="ghost-row"><span>✕</span><span>dress_0412</span><span>0.91</span></li>
</ol>
<ol class="hit-list truth fragment" data-fragment-index="3">
<li class="hit-label">what was there</li>
<li class="perfect"><span>#1</span><span>dress_0412</span><span>0.91</span></li>
<li><span>#2</span><span>dress_8812</span><span>0.83</span></li>
<li><span>#3</span><span>dress_1204</span><span>0.81</span></li>
<li><span>#4</span><span>dress_0937</span><span>0.80</span></li>
<li><span>#5</span><span>dress_5521</span><span>0.79</span></li>
</ol>
</div>
</div>
</div>

<blockquote class="fragment bottom" data-fragment-index="4"><span class="label">The gap</span><p>SQL fails <span class="hit-text">loudly</span>. Vector search fails <span class="hit-text">silently</span>, so we have to build the instrumentation back ourselves.</p></blockquote>

<!-- notes
Same errand as the filter slides: size 38, under 150 euros.

Postgres first. EXPLAIN ANALYZE tells you which index it used, what it
expected to cost, and how many rows actually matched. If nothing matched,
you get zero rows, which is an unmistakable signal.

Milvus, same query. Five rows, five scores. That's the whole response. No
plan, no "why", no "were these any good?".

Now put the two side by side. Left is what the filtered graph search
returned. Right is what an exact search over the same filter returns. The
perfect dress, 0.91, the green node from two slides back, is missing from
the left. Nothing in the response tells you. The scores look healthy. Four
of five overlap. You'd ship this.

The only way to see the difference is to have the right-hand list. Which is
the next slide.
-->

---

# Measure what you can't see

Score the index against exact search, on every deploy and every data change.

<div class="recall-watch">
<div class="card rw-sample">
<div class="feature-cat">golden query #127</div>
<pre class="rw-query">size == 38 and price &lt; 150</pre>
<div class="rw-lists">
<ol class="rw-list">
<li class="rw-label">exact (truth)</li>
<li class="miss"><span>dress_0412</span><span>0.91</span></li>
<li class="hit"><span>dress_8812</span><span>0.83</span></li>
<li class="hit"><span>dress_1204</span><span>0.81</span></li>
<li class="hit"><span>dress_0937</span><span>0.80</span></li>
<li class="hit"><span>dress_5521</span><span>0.79</span></li>
</ol>
<ol class="rw-list">
<li class="rw-label">production (ANN)</li>
<li class="hit"><span>dress_8812</span><span>0.83</span></li>
<li class="hit"><span>dress_1204</span><span>0.81</span></li>
<li class="hit"><span>dress_0937</span><span>0.80</span></li>
<li class="hit"><span>dress_5521</span><span>0.79</span></li>
<li class="extra"><span>dress_3310</span><span>0.78</span></li>
</ol>
</div>
<div class="rw-score"><span>recall@5</span><span><b>4</b> / 5 = <b>0.80</b></span></div>
<p class="rw-foot">Average over ~500 real queries, plot it daily.</p>
</div>

<div class="rw-chart">

```vega
- spec: ./recall-watch.vl.json
  renderer: svg
  actions: false
  signal-stage: [0, 1, 2]
  fit: contain
```

</div>
</div>

<!-- notes
This is the right-hand list from the last slide, turned into a habit.

Left: one golden query. Exact search gives the truth, computed offline, and
recomputed whenever the data changes. Production gives what users actually
get. Overlap four of five: recall@5 is 0.80. Do that for a few hundred real
queries and you have one number per day.

Right, illustrative but very typical. Two weeks flat around 0.97.

Click: the catalogue grows 30 percent. Nobody deployed anything. Same
nprobe, more vectors per cluster, recall slides to 0.88. Nothing errors,
latency looks fine, every response still has ten rows. Only the golden set
notices, and it fires the alert.

Click: retune nprobe from 16 to 32, recall is back. That is the loop: the
data drifts, the measurement catches it, you buy recall back on purpose.

The ground truth goes stale too: when the data changes, re-run exact search
for the golden set, or you're scoring against yesterday's catalogue.
-->

---

{.small-title}

# Recall is a proxy. <span class="hero-text">Users are the truth.</span>

<div class="metric-ladder">
<div class="ml-head"><span>layer</span><span>metrics</span><span>scored against</span><span>cadence</span><span>catches</span></div>
<div class="ml-body">
<div class="ml-rail"><span>closer to the user</span></div>
<div class="ml-rungs">
<div class="ml-rung fragment" data-fragment-index="1"><span class="ml-name">Index</span><span class="ml-metrics"><span class="pill ghost">recall@k</span></span><span>exact search</span><span>every deploy</span><span>ANN params, data drift</span></div>
<div class="ml-rung fragment" data-fragment-index="2"><span class="ml-name">Relevance</span><span class="ml-metrics"><span class="pill ghost">NDCG@k</span><span class="pill ghost">MRR</span><span class="pill ghost">precision@k</span></span><span>graded human or LLM labels</span><span>every model change</span><span>weak embeddings, chunking</span></div>
<div class="ml-rung fragment" data-fragment-index="3"><span class="ml-name">Behaviour</span><span class="ml-metrics"><span class="pill ghost">CTR</span><span class="pill ghost">zero results</span><span class="pill ghost">reformulations</span><span class="pill ghost">thumbs up / down</span></span><span>real users</span><span>live, A/B</span><span>ranking users ignore</span></div>
<div class="ml-rung fragment" data-fragment-index="4"><span class="ml-name">Business</span><span class="ml-metrics"><span class="pill ghost">conversion</span><span class="pill ghost">revenue / search</span><span class="pill ghost">return rate</span></span><span>the P&amp;L</span><span>A/B, quarterly</span><span>relevant that doesn't sell</span></div>
</div>
</div>
</div>

<blockquote class="blue fragment bottom" data-fragment-index="5"><span class="label">Watch every layer</span><p>Each layer up is slower and noisier, but closer to what matters. A dip at the <span class="hit-text">bottom</span> is cheap to catch.</p></blockquote>

<!-- notes
Recall@k tells you the index agrees with exact search. It doesn't tell you
exact search was any good. So measure up the stack, bottom first.

Index: what we just built. Cheap, deterministic, run it on every deploy.

Relevance: now you need labels. Graded judgements from people, or an LLM
judge you've checked against people. NDCG rewards putting the best result
first, MRR asks how far down the first good one is. This is where a bad
embedding model or bad chunking shows up, and no nprobe fixes it.

Behaviour: real users. Click-through, how often a search returns nothing,
how often people rephrase, thumbs up and down in a chat UI. Noisy, needs
traffic and A/B tests, but it's what people actually do.

Business: conversion, revenue per search. For the dress finder, return
rate. Remember the size-38 dress the filtered search never surfaced? That
miss shows up months later as a wrong-size order coming back.

The layers come apart. The next section shows how far apart the first two
are, with real numbers.
-->

---

{.section}

# Is the index <span class="hero-text">worth it</span>?

<div class="section-byline">
  <div class="bi-cell get"><span class="bi-num">Code search</span><span class="bi-lab">benchmark: grep vs index</span></div>
  <div class="bi-arrow">&amp;</div>
  <div class="bi-cell get"><span class="bi-num">Agentic memory</span><span class="bi-lab">benchmark: replay vs index</span></div>
</div>

<!-- notes
Bridge from measurement. We can now measure index recall on every deploy.
Two questions are left, and they are the ones the room is actually asking in
2026: does that recall reach the answer, and with agents that can grep, is
an index worth paying for at all?

Everything that follows is from the RAG cost curve study: open source,
reproducible, every number traceable to a CSV.
-->

---

{.small-title}

# Recall isn't answer quality

*Index recall: does the index match exact search? Answer-presence: is the answer in the top 10?*

<div class="chart-band">

```vega
- spec: ./recall-vs-presence.vl.json
  renderer: svg
  actions: false
  signal-stage: [0, 1, 2]
  fit: contain
  fragment-index: 0
```

</div>

<blockquote class="blue fragment" style="margin-top: var(--zilliz-s-3)"><span class="label">Evaluate the model first</span><p>The embedding model and chunking set the ceiling. Measure <span class="hit-text">LGTM@k</span> using exact search before ANN.</p></blockquote>

<!-- src: ../rag-cost-curve/data/ws4/summary.csv:metric=answer_presence_at_10 sq8_np512 recall 0.992 quality 0.8178; rabitq_np256 recall 0.7811 quality 0.7911 -->

<!-- notes
Two different recalls, finally side by side. Back on the Recall & Precision
slide we scored results against human judgement. Every recall number since
(0.778, 0.986, the golden set) scored the index against exact search.

Click one: index recall across eleven configurations of a 10M index, from
1-bit RaBitQ to SQ8 at nprobe 512. On the diagonal, because that is what
the metric measures.

Click two: for the same configurations, how often the gold answer is
anywhere in the top 10. It never gets past 0.82. Above recall 0.9 it barely
moves, 0.80 to 0.82. The one low dot is SQ8 at nprobe 4, recall 0.80 and
presence 0.74: cut recall hard enough and you do lose answers, but past
about 0.9 the extra recall buys almost nothing.

Click three: the ceiling. Even at recall 0.992, one question in five does
not have its answer in the retrieved ten. That is not the index. It is the
embedding model and the chunking, and no nprobe fixes it.

Caveat if pushed: NQ-Open gold answers are 2018-era against a 2023 corpus,
so some of the missing fifth is stale gold, not model failure. The flatness
holds either way because every arm sees the same stale questions.

Takeaway: build a golden set with answers, not just neighbours. Swap
embedding models against it before you touch the index.
-->
---

{.small-title}

# Benchmarking agentic search

Three ways for an agent to answer the same question, the search itself is not expensive.

<svg class="cost-anatomy" viewBox="0 0 1400 378" role="img" aria-label="One pipeline, three ways to feed it. A question goes into a model and the model returns an answer. Three stations sit below the model. Parametric has no retrieval at all and pays only for the answer it writes. Agentic loops three to four times through a grep, read and glob tool, each turn cheap on its own but re-sending the whole transcript. Indexed takes one or two fat payloads of chunks from a vector search, and carries a navy band across the foot of its own box marking the charge it incurs per day whether or not anything is asked. Every per-query charge is marked with a purple coin; the one per-day charge is the navy band inside the index's box.">
<defs>
<marker id="ca-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="18" markerHeight="18" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
<marker id="ca-arrow-fat" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="26" markerHeight="28" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
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
<path class="edge call" d="M620 122 V224"/>
<path class="edge flow flow-thin" d="M560 230 V126"/>
<text class="elabel" x="534" y="188" text-anchor="end">&times; 3 to 4 turns</text>
<rect class="node" x="380" y="230" width="300" height="72" rx="10"/>
<text class="nlabel" x="530" y="274" text-anchor="middle">grep / read / glob</text>
<circle class="coin" cx="560" cy="210" r="18"/><text class="coin-mark" x="560" y="218" text-anchor="middle">$</text>
<text class="elabel" x="534" y="216" text-anchor="end">per query</text>
<rect class="tag tag-navy" x="435" y="336" width="190" height="38" rx="19"/><text class="tlabel tlabel-navy" x="530" y="362" text-anchor="middle">agentic</text>
</g>

<g class="stage stage-3 fragment" data-fragment-index="3">
<path class="edge call" d="M780 122 V224"/>
<path class="edge flow flow-fat" d="M840 230 V152"/>
<text class="elabel" x="866" y="188" text-anchor="start">&times; 1 to 2</text>
<rect class="node" x="720" y="230" width="300" height="88" rx="10"/>
<text class="nlabel" x="870" y="260" text-anchor="middle">vector search</text>
<text class="nsub muted" x="870" y="285" text-anchor="middle">embed once, negligible</text>
<path class="plinth" d="M721.25 292 H1018.75 V308 A8.75 8.75 0 0 1 1010 316.75 H730 A8.75 8.75 0 0 1 721.25 308 Z"/>
<text class="plabel" x="870" y="310" text-anchor="middle">$ per day, query or not</text>
<rect class="node node-edge" x="720" y="230" width="300" height="88" rx="10"/>
<circle class="coin" cx="840" cy="210" r="18"/><text class="coin-mark" x="840" y="218" text-anchor="middle">$</text>
<text class="elabel" x="866" y="216" text-anchor="start">per query</text>
<rect class="tag tag-gradient" x="775" y="336" width="190" height="38" rx="19"/><text class="tlabel tlabel-gradient" x="870" y="362" text-anchor="middle">indexed</text>
</g>
</svg>

<div class="cost-notes cols-3">
<p class="fragment" data-fragment-index="1">No search, no payload. You pay for the answer, and nothing else.</p>
<p class="fragment" data-fragment-index="2">Small results each time. But the whole transcript goes back every turn.</p>
<p class="fragment" data-fragment-index="3">One fat payload of chunks, and a box that bills daily whether you ask or not.</p>
</div>

<p class="closing-line is-emphatic fragment" data-fragment-index="4">Only the index has a fixed cost, everything else is per query or per embedding. The same logic applies for code search and agentic memory.</p>

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

Land the closing line: one fixed cost, everything else per query. So the
question is always how many queries a day repay the box.
-->

---

{.chart-animate}

# Training data matters

A blind model answered 25 of 40 questions on fastapi, and
0 on a repository published after training cutoff.
<!-- src: data/ws6c/summary.csv:judge_accuracy arm=parametric, corpus=fastapi 0.625, corpus=agentic_hil 0.000 -->

```vega
- spec: ../rag-cost-curve/charts/accuracy-by-arm.vl.json
  actions: false
  renderer: svg
  signal-stage: [0, 1, 2, 3]
  signal-zoom: true
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

<table class="cost-latency fragment">
<thead><tr><th></th><th>Code it knows</th><th>Code it has never seen</th></tr></thead>
<tbody>
<tr><th scope="row">cost</th><td>every retrieval arm within <strong>~15%</strong><!-- src: data/cost_per_correct.csv:corpus=fastapi agentic=0.0557, indexed_topk3=0.0598, indexed=0.0666 --></td><td>the index is <strong>~40%</strong> cheaper<!-- src: data/cost_per_correct.csv:corpus=agentic_hil indexed=0.0930, agentic=0.1541 --></td></tr>
<tr><th scope="row">p95 latency</th><td>grep <strong>32 s</strong>, indexed <strong>46 s</strong><!-- src: ../rag-cost-curve/data/ws6c/summary.csv:corpus=fastapi p95_latency_s agentic 31.90 indexed 45.97 --></td><td>grep <strong>60 s</strong>, indexed <strong>39 s</strong><!-- src: ../rag-cost-curve/data/ws6c/summary.csv:corpus=agentic_hil p95_latency_s agentic 60.25 indexed 39.19; median_turns 4.0 2.5 --></td></tr>
</tbody>
</table>

<!-- notes
This one is not an estimate. Every question ran in every arm, I have the
invoice, and I divided it by the answers the judge marked correct. It is a
census, so there is no interval to argue about.

Stage one, fastapi, code the model knows: every retrieval arm within about
15% of the others. Nobody should pick an architecture off this.

Stage two, agentic-hil, code it has never seen: the ranking inverts. Indexed
goes from dearest to cheapest, 0.093 against grep's 0.154 per correct answer,
and more accurate, 39 of 40 against 36.

Latency row: p95 only, medians are within ten percent either way. On known
code grep has the shorter tail; on unseen code grep wanders, four turns at
the median, and the index cuts the tail from a minute to 39 seconds.
The search itself is a sliver of the wall-clock: milliseconds against
seconds per model turn. The model's turns are the latency, and the index
only trims them when the model is lost.

Caveats to have ready, do not volunteer them all:
- Judge cost is excluded, it is the measuring instrument, not anyone's bill.
- Break-even on unseen code lands at tens of queries a day, but the paired
  test does not clear at any size, so do NOT say "the index wins". Say "cheaper
  per correct answer", which is what the census shows.
- Prose goes the other way (about 6.9x dearer per correct answer than grep).
  It is in the rag-cost-curve backup slides.
-->

---

{.memory-break-even}

# Break-even on agentic memory

*No memory system vs Milvus memsearch index on a box at $86.07 a month*

| Token $ per query | 98k tokens | 392k tokens | 1.2M tokens* |
|---|---|---|---|
| Replay, cache warm | <span class="bar bar-replay" style="--v:0.0052">$0.020</span> | <span class="bar bar-replay" style="--v:0.0529">$0.203</span> | <span class="bar bar-replay" style="--v:0.0756">$0.290</span> |
| Replay, cache cold | <span class="bar bar-replay" style="--v:0.1023">$0.393</span> | <span class="bar bar-replay" style="--v:0.4086">$1.569</span> | <span class="bar bar-replay" style="--v:1.0000">$3.839</span> |
| Index | <span class="bar bar-index" style="--v:0.0030">$0.011</span> | <span class="bar bar-index" style="--v:0.0032">$0.012</span> | <span class="bar bar-index" style="--v:0.0049">$0.019</span> |
| **Break-even, cache warm** | **334 a day** | **15 a day** | **10 a day** |
| **Break-even, cache cold** | **7.4 a day** | **1.8 a day** | **0.7 a day** |

<!-- src: data/ws5/break_even.csv:c_live,c_index_query,break_even_qpd workload=memory regime=claude infra_mode=dedicated hit_rate_basis=measured footprint=pca_uc_384_sq8; S replay 0.01995/0.01148/333.76, M replay 0.20300/0.01245/14.84, L replay_trunc 0.29018/0.01880/10.42; cache_hit 1.0/0.9167/0.9737 -->
<!-- src: data/ws5/churn.csv:c_live,break_even_qpd same filters, live_cache=invalidated churn_frac_per_day=0.0 edit_kind=append; S 0.39286/7.41, M 1.56887/1.82, L 3.83945/0.74 -->
<!-- src: data/ws5/break_even.csv:fixed_daily 2.8277 (infra_month 86.06751) -->
<!-- src: data/ws6b/summary_l.csv:judge_accuracy replay_trunc 0.474, memsearch 1.0, n=38 -->

<p class="table-note">Break-even is the box's $2.83 a day divided by the saving per query. Warm uses the measured cache hit rates, 100%, 92% and 97%; cold is a miss on every query, which is what a five-minute cache sees at 15 queries a day. Mean billed cost per query; bars share one scale.</p>
<p class="table-note">* 1.2M tokens is past the context window: replay keeps 78.5% of the history and answers 47% of questions correctly, against 100% for the index.</p>

<!-- notes
Second workload: agent memory. A synthetic conversation history in markdown
at 98k, 392k and 1.2M tokens, with facts planted in it. Say "synthetic" out
loud. The live arm is what you do with no memory system: the whole history
goes into the prompt on every query, prompt-cached, one turn per query, so
there is no per-turn multiplication. Real agents compact or summarise long
before this; replay is the upper bound, not what anyone ships. The index arm
is memsearch over Milvus, hybrid dense plus BM25.

Read the warm row first. Break-even on one r8g.large, $86.07 a month: 334 a
day at 98k tokens, then 15 and 10. A 22x fall for a 4x corpus.

Then the catch: those warm figures assume the cache hit, and the cache lives
five minutes. At 15 queries a day it is cold every time. A miss on every
query takes the big history from $0.29 to $3.84 a query and break-even from
10 a day to under one. Even the small history drops from 334 to 7.

The 1.2M column is not a fair cost fight at all: it does not fit the
context window, replay keeps 78.5% of the history and gets 47% right. Past
the window the index wins on answers, not on price.
-->

---

{.floor-rungs}

# The floor can go to zero

*Same index, same corpus, the same measured token costs. Only the thing underneath it changes*

<div class="card-grid cols-3">
<div class="card"><p><span class="pill gradient">a box of your own</span></p><p>A dedicated r8g.large at <strong>$86.07 a month</strong> to hold the index. Break-even lands at <strong>10 to 334</strong> queries per day with a warm cache, and <strong>under 8</strong> with a cold one.<!-- src: data/ws5/break_even.csv:infra_mode=dedicated infra_month=86.06751; break_even_qpd 333.76/14.84/10.42 at S/M/L; data/ws5/churn.csv:live_cache=invalidated churn_frac_per_day=0.0 edit_kind=append break_even_qpd 7.41/1.82/0.74 --></p></div>
<div class="card"><p><span class="pill navy">a box you already run</span></p><p>Milvus Lite on your laptop or spare space on an existing box. Same index, same prices, break-even on the first query.<!-- src: data/ws5/sensitivity.csv:max_spread_ratio=68944.94 knob=infra_mode workload=memory. The workload filter is load-bearing since WS9: the same knob reads 7421.06 on code_unseen --></p></div>
<div class="card is-win"><p><span class="pill ghost">no box at all</span></p><p>Serverless, metered per query with no floor to amortise. Every corpus combined fits into the <strong>Zilliz free-forever</strong> tier.<!-- src: data/ws5/serverless.csv:ws8_issues.billed_gb_upper=0.246826 pct_of_free_storage=4.9365 usd_per_query_max=0.00006; data/ws5/break_even.csv:c_index_query 0.0114765 to 0.0665983 --></p></div>
</div>

<!-- src: data/ws5/serverless.csv:kind=rate,model,free. Rates read off zilliz.com/pricing#calculator on 2026-09-15: $4 per million vCU, write 0.75 vCU, read 15 vCU on 1M vectors, free tier 5 GB plus 2.5M vCU a month -->

<!-- notes
Every break-even so far assumed a dedicated box at $86 a month, and that box
is the whole numerator. Change what sits underneath and the floor moves.

A box you already run, Milvus Lite on a laptop or spare room on an existing
cluster: same index, break-even on the first query. No box at all: serverless,
metered per query, and every corpus in the study combined fits in the Zilliz
free tier.

So the real answer to "is the index worth it" is: for unseen code and long
agent memory, yes, and the fixed cost is a deployment choice, not a law.
Then the recap: every lever in one loop.
-->

---

{.section}

# In summary

---

# Spend recall on purpose

Every lever in this talk spends recall, buys it back, or checks the balance.

<svg class="levers-diagram" viewBox="0 0 1400 412" role="img" aria-label="The levers from this talk as a loop: check the model's answer ceiling, pick the index, shrink the vectors, buy recall back at query time, match the filter strategy to selectivity, then measure recall@k against a golden set on every deploy and feed the result back into the index choice">
<defs>
<marker id="lv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>
</defs>
<g class="rail"><path d="M10 360 H1390"/></g>
<text class="elabel muted" x="10" y="404">recall</text>
<g class="stage stage-1 fragment" data-fragment-index="1">
<rect class="node" x="10" y="110" width="200" height="120" rx="16"/>
<text class="nlabel" x="110" y="162" text-anchor="middle">Check model</text>
<text class="nsub" x="110" y="198" text-anchor="middle">LGTM@k</text>
<text class="elabel muted" x="110" y="272" text-anchor="middle">sets the ceiling</text>
<rect class="tag" x="40" y="338" width="140" height="44" rx="22"/><text class="tlabel" x="110" y="368" text-anchor="middle">ceiling</text>
</g>
<g class="stage stage-2 fragment" data-fragment-index="2">
<path class="edge" d="M214 170 H242"/>
<rect class="node" x="246" y="110" width="200" height="120" rx="16"/>
<text class="nlabel" x="346" y="162" text-anchor="middle">Pick index</text>
<text class="nsub" x="346" y="198" text-anchor="middle">HNSW · IVF · DiskANN</text>
<text class="elabel muted" x="346" y="272" text-anchor="middle">or AUTOINDEX</text>
<rect class="tag" x="276" y="338" width="140" height="44" rx="22"/><text class="tlabel" x="346" y="368" text-anchor="middle">spend</text>
</g>
<g class="stage stage-3 fragment" data-fragment-index="3">
<path class="edge" d="M450 170 H478"/>
<rect class="node" x="482" y="110" width="200" height="120" rx="16"/>
<text class="nlabel" x="582" y="162" text-anchor="middle">Shrink it</text>
<text class="nsub" x="582" y="198" text-anchor="middle">SQ · PQ · RaBitQ</text>
<text class="elabel muted" x="582" y="272" text-anchor="middle">or AUTOINDEX</text>
<rect class="tag" x="512" y="338" width="140" height="44" rx="22"/><text class="tlabel" x="582" y="368" text-anchor="middle">spend</text>
</g>
<g class="stage stage-4 fragment" data-fragment-index="4">
<path class="edge" d="M686 170 H714"/>
<rect class="node" x="718" y="110" width="200" height="120" rx="16"/>
<text class="nlabel" x="818" y="162" text-anchor="middle">Buy it back</text>
<text class="nsub" x="818" y="198" text-anchor="middle">refine · nprobe</text>
<text class="elabel muted" x="818" y="272" text-anchor="middle">or level</text>
<rect class="tag" x="748" y="338" width="140" height="44" rx="22"/><text class="tlabel" x="818" y="368" text-anchor="middle">buy back</text>
</g>
<g class="stage stage-5 fragment" data-fragment-index="5">
<path class="edge" d="M922 170 H950"/>
<rect class="node" x="954" y="110" width="200" height="120" rx="16"/>
<text class="nlabel" x="1054" y="162" text-anchor="middle">Filter wisely</text>
<text class="nsub" x="1054" y="198" text-anchor="middle">match selectivity</text>
<text class="elabel muted" x="1054" y="272" text-anchor="middle">or lose recall</text>
<rect class="tag" x="984" y="338" width="140" height="44" rx="22"/><text class="tlabel" x="1054" y="368" text-anchor="middle">protect</text>
</g>
<g class="stage stage-6 fragment" data-fragment-index="6">
<path class="edge" d="M1158 170 H1186"/>
<rect class="node node-measure" x="1190" y="110" width="200" height="120" rx="16"/>
<text class="nlabel nlabel-measure" x="1290" y="162" text-anchor="middle">Measure</text>
<text class="nsub nsub-measure" x="1290" y="198" text-anchor="middle">every deploy</text>
<text class="elabel muted" x="1290" y="272" text-anchor="middle">on a golden set</text>
<rect class="tag" x="1220" y="338" width="140" height="44" rx="22"/><text class="tlabel" x="1290" y="368" text-anchor="middle">audit</text>
</g>
<g class="stage stage-7 fragment" data-fragment-index="7">
<path class="edge dashed" d="M1290 104 V56 H110 V102"/>
<text class="elabel" x="700" y="42" text-anchor="middle">re-check as data and models drift</text>
</g>
</svg>

<p class="closing-line fragment" data-fragment-index="7">Trade <strong>&lt;10% recall</strong> for <strong>&gt;100× speed</strong>, but only if the index is needed.</p>

<!-- notes
Seven clicks, one per lever, then the loop.

1. Check the model. Answer-presence@k on your own questions, before any
   index exists. It is the ceiling every later lever works under.
2. Pick the index. HNSW, IVF, DiskANN when RAM runs out, or let AUTOINDEX
   turn the knobs. This is where you first spend recall for speed.
3. Shrink it. SQ, PQ, RaBitQ, and PCA and MRL for fewer dimensions. Spend
   more recall to fit the budget.
4. Buy it back. Refine with the SQ8 copies, widen nprobe. Query-time levers,
   tuned per use case.
5. Filter wisely. Match the strategy to selectivity, or a filter quietly
   wrecks the recall you just paid for.
6. Measure. The golden set from earlier, recall@k on every deploy.
   Version the index alongside the model that built it.
7. The loop. Data shifts, models change, so the measurement feeds back to
   the model check. Land the big idea again: under 10% recall for over 100x,
   but only if you know what you gave up, and only when the queries repay
   the box.

If asked what to monitor in production beyond recall@k: score spread and
filter hit-rate before the agent consumes results. Dual-write and A/B at the
index level during migrations. Budget for re-embedding from day one.
-->

---

# Up next

So far we've looked at the tech and the numbers, next we'll see what it looks like in production.

<div class="card-grid cols-2">
<div class="card fragment">
<p><span class="pill navy">19:20 · Criteo</span></p>
<p><strong>From Product Need to Distributed Vector Search</strong></p>
<p>Mehdi &amp; Peter on why their use case needed a distributed vector database, and the pain points on the way.</p>
</div>
<div class="card fragment">
<p><span class="pill gradient">20:00 · Gorgias</span></p>
<p><strong>RAG Design Patterns: Product Indexing at Scale</strong></p>
<p>Mohamed &amp; Othmane on two years of scalability pressure shaping a product index.</p>
</div>
</div>

<!-- notes
One breath. The wedding-guest dresses from slide two were product search: Criteo and
Gorgias both live there, at a scale where every lever tonight is a daily
decision. Hand over.
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
