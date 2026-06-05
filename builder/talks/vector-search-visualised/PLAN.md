# Vector Search Visualised — pre-deadline review & finishing plan

Working doc for finishing the deck before the talk. Reviewed at 57 slides; target is a
~36-slide, 30–35 min deck that delivers the brief's diagnostic promise.

> **Status — implemented in commit `f5f6c01`.** Sections 1–8 below are done: the deck
> is 44 slides, the "Diagnose it" section exists, the fingerprint quantisation viz is
> built, and the deck builds/bundles clean. §9 (trade-off triangle) items 1–3 are now
> also done — only the optional item 4 remains.

## Context

The talk is booked for a **30–35 min slot**. The current deck (`slides.md`) is
**57 slides** — far too long — and roughly **40% of it is unfinished**: 2 slides are
entirely empty and ~22 carry `<!-- VIS -->` placeholder comments for visualisations that
were never built. The first half (through DiskANN) is largely built and working; the
second half (Quantisation onward) is prose + placeholders.

More importantly, the deck has **drifted from the brief**. The brief sells a *diagnostic*
talk — "SQL has EXPLAIN, vector search offers no such comfort… catch retrieval failures
before your agents do… a diagnostic toolkit for the production problems hardest to see."
The current deck is a well-illustrated **techniques tour** and never delivers the EXPLAIN
payoff. The hook is set up and never paid off.

**Agreed direction:**
1. Target a **30–35 min** deck → trim to **~36 slides**.
2. **Add a dedicated "Diagnose it" section** to deliver the brief's spine.
3. Finish the second half by **building the hero visualisations only** (the fingerprint
   quantisation payoff + reusing two already-built specs); simplify or cut the rest.

---

## 1. Technical correctness

Checked every factual claim against the brief and current literature. The descriptions of
IVF/HNSW/DiskANN, scalar/product quantisation, PCA, UMAP, Matryoshka, and the CLIP modality
gap are **accurate**. Recall/Precision arithmetic checks out (P@10 = 4/10 = 40%,
R@10 = 4/6 = 66.7%). Issues found, in priority order:

| # | Slide | Issue | Fix |
|---|---|---|---|
| T1 | "RaBitQ: 1 bit per dimension" | **Factual error.** "BBQ in Milvus" — BBQ (Better Binary Quantization) is *Elasticsearch's* branding. Milvus exposes RaBitQ directly (e.g. `IVF_RABITQ`). | "the RaBitQ index in Milvus" — optionally note BBQ is Elastic's name for the same family. |
| T2 | Connectome opener | **Typo.** "good facsimilies" | "facsimiles" |
| T3 | "All models produce numbers" / "Now imagine 768 dimensions" | **Inconsistency.** Generic copy says "generally 768 × Float32"; the running-example faces are **512-D** (fingerprint is 16×32 = 512); the MRL slide later says "1536D". | Make the generic statement "hundreds to a few thousand"; state the face model is 512-D so the running example is internally consistent. |
| T4 | Section divider "Why we built VectorDBs" | **Structural mismatch.** The section contains embedding/geometry content (celebrities, dimensions, fingerprint, similarity) — nothing about *databases*. The genuine "why a DB, not a flat FAISS index" argument (CRUD, filtering, persistence, scale) is never made. | Rename the section to what it actually covers — e.g. "What an embedding is" / "Picturing meaning". |
| T5 | "Introducing UMAP" | **Misplaced.** UMAP is a dimensionality-reduction / visualisation technique but sits under the "multi-modal gap" section. | Fold the UMAP explanation into the "Two cones" viz slide as the tool used to *see* the gap. |
| T6 | Recall & Precision | Low priority: ground-truth labels are debatable (I, Robot / Ex Machina / The Matrix marked "not relevant" for "movie with a robot from the future"). Fine as a teaching example. | Optional: leave as-is, or pick a cleaner query. |

Connectome stats (~86B neurons, ~100T connections, ~2.7 PB) are within commonly cited
ranges — acceptable for an analogy.

**Unverified in this review (browser check required):** the four three.js modules
(`connectome.js`, `facenet-learning.js`, `cloud.js`, `umap-modality-gap.js`) and all
vega specs must be confirmed to render correctly in the built deck.

---

## 2. Thematic gap analysis (vs the brief)

The brief promises two things. The deck delivers one.

**Delivered well — "a sharper mental model":** embeddings as geometry, the 16-celebrity
running example, the fingerprint, the 2D/3D clouds, exact vs ANN, quantisation, the
modality gap. The mental-model half is strong.

**Missing — "a diagnostic toolkit":** This is the brief's *spine* and it is absent.
- No "EXPLAIN for vector search" payoff — the opening promise is never cashed.
- No guidance on **measuring recall in production** (one bullet on the "Strategies" slide
  mentions a "golden set"; it is never developed).
- No treatment of **silent degradation** — the exact phrase in the brief ("results
  quietly degrade") has no slide.
- The **"before your agents do"** angle is unfulfilled. Agent memory / RAG appear once on
  the use-case grid and are never revisited as *failure modes*.

**Secondary gap:** the **recall-vs-latency Pareto curve** — the single most important
mental model for choosing an ANN index — is missing, even though a built spec already
exists (`visualisations/recall-latency.json`, currently unused).

→ **Resolution:** add a dedicated **"Diagnose it"** section (Section 4 below). It also
absorbs the drift content currently stranded in "Operational reality".

---

## 3. What to cut / consolidate

The deck must lose ~21 slides. Cuts, in order of confidence:

**Cut outright (empty or off-message):**
- "This isn't a keyword vs vector search talk" — **completely empty**, and the meta-framing
  works against the brief's actual hook.
- "SQL + vectors?" — **completely empty** (see fix T4: rename the section instead).

**Cut the repetition — the "X on the triangle" motif:** there are **8 triangle slides**
(intro + 6 per-technique + final). Keep only **two**: the intro ("The trade-off triangle")
and a single **"Final triangle"** with everything placed. Replace the 6 per-technique
slides with a **one-line caption** on each technique slide. → saves 6 slides.

**Merge:**
- "Why DiskANN" (empty placeholder) → fold its one point into the DiskANN slide.
- "Different goal from quantisation" → fold into the dimensionality-reduction slide.
- Drift slides ("Embeddings are model-bound", "Concept drift vs model drift") → fold into
  the diagnostics decision tree.

**Trim hard (whole sections that are all-placeholder and least on-brief):**
- **Dimensionality reduction** (5 slides: divider, "different goal", PCA, MRL, DR triangle)
  → collapse to **one** slide: "Fewer dimensions: PCA & Matryoshka". MRL is elegant but
  not core to a diagnostics talk.
- **Filters** (5 slides, all placeholder) → collapse to **one** slide: "Filtering quietly
  wrecks your index" (pre- vs post-filter failure). Filtered-ANN failure is genuinely a
  silent-degradation source, so it also becomes a row in the diagnostics decision tree.

If 30 min proves tight, the **next cuts** are: the use-cases grid, the single DR slide,
and merging "Why flat search doesn't scale" into the flat-scan slide.

---

## 4. What to add — the "Diagnose it" section

A new section (~5 slides) placed after the multimodal gap, before the close. This is the
brief's payoff and the reason the talk exists.

1. **Section divider** — "Diagnose it" (or "When retrieval quietly fails").
2. **"The EXPLAIN you never got"** — callback to the opening. SQL hands you a query plan;
   vector search hands you *k* rows and no story. A plausible-looking wrong answer is
   indistinguishable from a right one. This is the moment the talk's promise lands.
3. **"Measure what you can't see"** — you cannot eyeball recall. Build a **golden set**:
   frozen queries + ground truth from **exact brute-force search** (direct callback to the
   flat-scan slide) and track recall@k continuously. Reuses the Recall/Precision concepts
   already taught.
4. **"Signals of silent degradation"** — a **symptom → likely cause → fix** decision tree.
   This one slide ties every section of the talk together:
   - recall down, latency flat → index params (`nprobe`/`ef`) drifted, or data grew
   - recall drops right after a deploy → model changed → reindex (model drift)
   - fine offline, bad in prod → filter selectivity (pre/post-filter)
   - scores all clustered low → cross-modal miscalibration (modality gap)
   - recall erodes over weeks → concept drift / stale embeddings
   - cost/memory spiked → quantisation misconfigured
5. **"Your agent won't tell you"** — agents and RAG pipelines don't *throw* on bad
   retrieval; they just answer worse. Delivers the brief's "before your agents do".
   Callback to "agent memory" / "RAG" from the use-case grid.

Then a lean **"Operate it"** beat (2 slides): "Strategies that work" (version index with
model, dual-write on migration, frozen golden set, budget for re-embedding) and the
**Final triangle**.

---

## 5. Build plan — hero visualisations only

**Must build (critical path):**
1. **Fingerprint quantisation viz** — the celebrity fingerprint degrading through
   full-precision → scalar (int8) → product quantisation → RaBitQ (1-bit). This is *the*
   payoff the deck sets up at "Introducing the fingerprint" and currently never delivers.
   Build it once as a reusable component with ~4 states. **Extend the existing
   `data/make_fingerprints.js`** to emit the quantised variants as PNGs — same pattern as
   the current fingerprints, lowest-risk approach.
2. **Diagnostics decision-tree slide** — pure HTML/CSS, following the existing
   `search-demo` and `stat-grid` slide patterns. No custom viz engine, low risk.
3. **Final triangle** — `trade-off-triangle.json` already exists; just needs an
   all-techniques stage.

**Reuse — already built, just wire in (zero build cost):**
4. `visualisations/recall-latency.json` → add to the end of the ANN section.
5. `visualisations/compression-recall.json` → add to the quantisation section.

**Skip / fall back:** per-technique triangle slides, custom filter animations, DR custom
viz, operational diagrams, counter animations. Static numbers and text are fine for these.
`hybrid-fusion.json`, `rotation-visualizer.json`, `cost-*.json`, `gpu-breakeven.json`
remain unused — leave them.

**Fallback if the fingerprint viz slips:** ship static before/after PNG pairs (generated
by the same `make_fingerprints.js` extension) instead of an animated component.

---

## 6. Recommended running order (~36 slides, down from 57)

```
OPEN (3)            Title · Connectome hook · Keyword-vs-vector demo
01 EMBEDDINGS (6)   FaceNet viz · Use cases · "All models produce numbers" (fix T3)
                    · 16 celebrities · Fingerprint · What "similar" means (knn-2d)
02 EXACT (5)        Divider · Naïve flat scan · Why flat doesn't scale
                    · Trade-off triangle (intro) · Recall & Precision
03 ANN (6)          Divider · The big idea · IVF · HNSW · DiskANN (+why)
                    · Recall-vs-latency curve  [NEW — reuse spec]
04 QUANTISATION (6) Divider · Full-precision fingerprint · Scalar Q · Product Q
                    · RaBitQ (fix T1) · Compression-vs-recall curve  [NEW — reuse spec]
   FEWER DIMS (1)   PCA & Matryoshka — one slide
05 MULTIMODAL (4)   Divider · CLIP / one space · Modality-gap stats · Two cones (UMAP)
   FILTERS (1)      Filtering quietly wrecks your index
06 DIAGNOSE IT (5)  Divider · The EXPLAIN you never got · Measure recall (golden set)
                    · Silent-degradation decision tree · Your agent won't tell you
07 OPERATE (2)      Strategies that work · Final triangle
CLOSE (2)           Recap · Thanks
```

Cuts applied: empty slides ×2, per-technique triangles ×6, DR section 5→1, filters 5→1,
drift slides merged, "Why DiskANN" merged. New: diagnostics section. Section numbering and
the "X on the triangle" captions get renumbered/rewired during edit.

---

## 7. Verification

1. `npm run build talks/vector-search-visualised` — must succeed with no errors.
2. Open `dist/index.html`, arrow through **every** slide. Confirm all four three.js
   modules render (connectome, facenet-learning, cloud, umap-modality-gap) and every vega
   spec renders (none of these were verifiable in the static review).
3. Confirm the new fingerprint quantisation viz advances correctly through its states.
4. `npm run bundle talks/vector-search-visualised` — confirm the single-file bundle works.
5. `npm test` — confirm still green (only expected if `bin/build.js` is touched).
6. Confirm `../../../img/image_embedding.svg` exists (referenced on "All models produce
   numbers").
7. Time a dry run — confirm ≤ 35 min.

## 8. Housekeeping / notes

- The FaceNet slide was rebuilt as a presenter-staged visualisation (`facenet-learning.js`):
  4 stages — untrained scatter → training → trained clusters → a held-out photo generalising
  in. Retitled "Networks learn what \"similar\" means"; the old ambient triplet-loss loop and
  its jargon labels are gone.
- An alternative slide is authored at `text-mechanism.js` — a forward-pass story using two
  near-synonym phrases ("running shoes" / "sneakers") to expose input layer, weighted edges,
  cascading activations, and the output vector dropping as a point into 2D space. 4 stages:
  input pattern → cascade through weights → output bar chart → second phrase lands nearby.
  Not wired into slides.md by default. To A/B in rehearsal, insert this block after the
  FaceNet slide (or replace it):

  ````
  {.three-bg .dark .small-title}

  # How a network turns text into a vector

  ```three
  - module: ./text-mechanism.js
  ```
  ````
- ~~`linkedin.png` (2.5 MB) is not referenced by `slides.md`~~ — removed in `f5f6c01`.
- There is **no spec doc** for this talk under `docs/superpowers/specs/` (the existing
  specs are for vectordb-201/301). Worth writing one once this plan is settled.
- Update `README.md` only if any user-facing build/authoring behaviour changes (per the
  project's standing rule); a pure content edit needs no README change.
- The original visualisation plan (the deck's design source) is preserved at
  `VISUALISATION-PLAN.md` — it still documents the fingerprint / cloud / triangle
  primitives and is useful background for §9.

---

## 9. Next session — trade-off triangle

The triangle (`visualisations/trade-off-triangle.json`) is used on two slides: the intro
(**"The trade-off triangle"**, `signal-stage: [0,1]`) and the closer (**"No universal
best"**, `signal-stage: 5`). This session added DiskANN as a fourth technique (stage 4)
and rewrote the opacity formula to `datum.stage > stage ? 0 : (datum.stage === stage ? 1
: 0.6)` so a high stage shows everything.

> **Status — items 1–3 done.** DiskANN retuned to `ws .5, wa .8, wc 1.0` so it reads
> clearly cheaper than HNSW (labels no longer collide); amber `+ quantisation`
> shift-arrows added (a `rule` per technique with a `triangle` arrowhead symbol, gated
> at `stage >= 5`); the closer is now `signal-stage: [2,3,4,5]`. Built and verified by
> arrowing through both triangle slides in a browser. Only item 4 (optional) remains.

1. ✓ **Put quantisation on the triangle.** The closer slide's copy claims "quantisation
   shifts any of them toward *Cheap*" — but the viz never showed it. A short
   **shift-arrow** is now drawn from every technique dot toward the Cheap corner,
   labelled `+ quantisation`, appearing at `stage >= 5` (a `rule` mark + a rotated
   `triangle` symbol arrowhead — far less clutter than plotting 8 separate dots).

2. ✓ **Separate DiskANN from HNSW.** Retuned DiskANN to `{ws .5, wa .8, wc 1.0}` (was
   `{ws .7, wa .85, wc .85}`) so it reads as clearly *cheaper* — it now sits ~125px from
   HNSW and the labels no longer collide.

3. ✓ **Stepped reveal on the closer.** "No universal best" was `signal-stage: 5` (all
   four dots at once); now `signal-stage: [2,3,4,5]` for a corner-by-corner walkthrough,
   with the shift-arrows revealed on the final step.

4. *(Optional, not done)* The intro triangle (`[0,1]`: empty → Flat) could be `[0,1,2]`
   to also tease IVF as the first ANN step.

> **Update — 2026-06-01: one-section-per-stage redesign.** The triangle now recurs at
> the end of *each* relevant section as a running "where are we" map, and `stage` is
> re-keyed from one-technique-per-stage to **one section per stage**:
> **1** = exact (`FLAT`) · **2** = ANN index family (`IVF_FLAT`, `HNSW`, `DISKANN`,
> `SCANN`, `AISAQ` — `GPU_*` variants deliberately excluded, not covered in the talk) ·
> **3** = quantisation, drawn as amber arrows for *valid Milvus index+quant combos only*
> (`IVF_SQ8`/`IVF_PQ`/`IVF_RABITQ` from IVF, `HNSW_SQ`/`HNSW_PQ`/`HNSW_PRQ` from HNSW;
> each arrow runs from its base index to the combo's own barycentric position via inline
> `bws/bwa/bwc` weights) · **4** = dimensionality reduction, one global teal arrow toward
> the Fast–Cheap edge labelled `PCA / MRL: fewer dims` (DR is pre-index, not an index
> type). The old generic `+ quantisation` shift-arrow group and `quantLabel` were removed.
> Reveal stays cumulative (`stage > current` hidden, `=== current` highlighted, `<`
> dimmed). Slides: intro `[0,1]`; new section-enders **"Where ANN lands"** `[1,2]`,
> **"Quantisation shifts everything cheaper"** `[2,3]`, **"Fewer dimensions, same
> precision"** `[3,4]`; closer **"No universal best"** now `[1,2,3,4]`.
