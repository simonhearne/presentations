# Visualisation plan — Vector Search Visualised

This deck has **two running visual primitives** that switch deliberately at section boundaries. The switch is a teaching cue: "we're moving from *what's inside a vector* to *where vectors live*", or back.

## The two primitives

### 1. The fingerprint
A celebrity's embedding rendered as a 32×24 grid of coloured cells. Each cell encodes one dimension's value.

Used when the topic is *what's inside a vector*: embeddings, quantisation, dimensionality reduction, multi-modal differences, model drift.

### 2. The cloud
Faces as points floating in 3D space. Explicit caveat: a "useful lie" — a shadow of the true high-dimensional geometry.

Used when the topic is *how vectors relate spatially*: similarity, search, indexes, filters.

### 3. The triangle (continuity device)
Speed / accuracy / cost. Same drawing throughout — dots added or moved, never redrawn.

---

## Data needed

- **16 celebrity portraits** — recognisable, diverse on age / gender / hair / nationality (the dimensions the deck names).
- **An embedding per celebrity** from a real model (768D or 1536D). Used to drive every fingerprint and every cloud position.
- **Per-celebrity metadata** — age, gender, hair colour, nationality (for the filter section, slides 7.x).
- **Text captions** for each celebrity ("actor in their 50s" etc.) — for slide 8.1 image↔text demo.
- **Two embedding models** for slide 9.1 (the drift visual): same 16 faces under both, fingerprints will differ entirely.

Rough license / sourcing TBD — likely Wikimedia portraits + a public face-embedding model (CLIP or similar).

---

## Per-slide visualisation work

Legend: **build** = needs a new asset/component. **reuse** = uses an earlier component with different data/state. **static** = single image or simple svg.

### Section 1 — The problem space
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 1.1 Title | fingerprint | build | 16-portrait grid, each with their fingerprint beneath. Foreshadows the running example without explaining it. |
| 1.2 Effortless | — | static | Three side-by-side panels (face/voice/phrase variants connected by a match line). |
| 1.3 Keyword breaks | — | static | Two queries → empty intersection diagram. |
| 1.4 Roadmap | — | static | Visual roadmap with fingerprint icon at each stop. |

### Section 2 — Embeddings via faces (introduces both primitives)
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 2.1 16 celebs | fingerprint | reuse | 16-portrait grid alone. |
| 2.2 1D age | cloud (1D) | build | Faces on a line. Query drops in, nearest two light up. |
| 2.3 2D | cloud (2D) | build | Faces on age × gender plane. Nearest changes. |
| 2.4 3D | **cloud** | build | three.js orbiting 3D scatter. **First three.js scene.** |
| 2.5 768D | cloud → cloud | build | Zoom out from 3D cube into stylised hi-D cloud. Shadow metaphor optional sidebar. |
| 2.6 Fingerprint intro | **fingerprint** | build | Face morphs into 32×24 grid. Then four more appear. **First fingerprint scene.** |
| 2.7 Similarity measures | cloud | reuse | Toggle cosine / L2 / dot — neighbours change. |

### Section 3 — Flat search
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 3.1 Naive | cloud | reuse | Query drops in; distance lines to all 16; nearest sticks. |
| 3.2 Doesn't scale | — | static | 16 → 16M → 8B counter with latency bar. |
| 3.3 Triangle | **triangle** | build | First appearance. Flat dot pinned. |
| 3.4 Recall@k | — | static | Two result lists side-by-side, overlap highlighted. |

### Section 4 — ANN indexes (cloud-mode)
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 4.1 Big idea | cloud | reuse | Tiny region of the cloud touched, not all of it. |
| 4.2 IVF | cloud | build | Voronoi partition over the cloud; nprobe slider; recall/latency update. |
| 4.3 IVF triangle | triangle | reuse | Add IVF dot. |
| 4.4 HNSW | cloud | build | Multi-layer graph descent animation. |
| 4.5 HNSW triangle | triangle | reuse | Add HNSW dot. |
| 4.6 DiskANN | — | static | RAM vs SSD diagram with cost meter. |
| 4.7 All three | triangle | reuse | Three dots placed. |

### Section 5 — Quantisation (fingerprint-mode)
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 5.1 Same shape, less precision | fingerprint | reuse | Full-precision fingerprint, "before" image. |
| 5.2 Scalar | fingerprint | build | Gradient steps down to 256 shades. Original + quantised side-by-side. |
| 5.3 PQ | fingerprint | build | Fingerprint → 8 vertical strips → 8 colour blocks. |
| 5.4 RaBitQ | fingerprint | build | **Pure black/white binary fingerprint, still recognisable.** The big visual punchline of the talk. |
| 5.5 Triangle | triangle | reuse | Existing dots shift toward lower cost. |

### Section 6 — DR (fingerprint-mode)
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 6.1 vs quantisation | fingerprint | build | Two fingerprints: 768×8-bit (chunky) vs 128×full (smaller). |
| 6.2 PCA | fingerprint + cloud | build | Cells fade right-to-left; then 3D scatter rotates to principal axes and flattens to 2D. |
| 6.3 UMAP | cloud | build | 3D cloud → 2D clustered layout. Caveat: lens, not a database. |
| 6.4 MRL | fingerprint | build | Truncate fingerprint full → 256 → 128 → 64. Still recognisable at each step. |
| 6.5 Triangle | triangle | reuse | Update. |

### Section 7 — Filters (cloud-mode)
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 7.1 Filter request | cloud | reuse | Filter chips overlaid. |
| 7.2 Pre vs post | cloud | build | Two failure-mode animations side-by-side. |
| 7.3 Filtered ANN | cloud | build | HNSW graph with filtered nodes greyed out; traversal still finds a path. |
| 7.4 Triangle | triangle | reuse | Filtered zone shaded. |

### Section 8 — Multi-modal (fingerprint-mode)
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 8.1 CLIP intro | fingerprint | build | Image-fingerprint and text-fingerprint side-by-side, both broadly similar. |
| 8.2 The gap | fingerprint + cloud | build | Stack of image fingerprints vs stack of text fingerprints — systematic difference visible. Then cloud showing two clusters with a gap. |
| 8.3 Calibration | — | static | Naive vs calibrated retrieval ranking lists. |

### Section 9 — Operations (fingerprint-mode)
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 9.1 Model-bound | fingerprint | build | Same celebrity under model A vs model B. Patterns unrelated. |
| 9.2 Drift kinds | — | static | Timeline with both kinds marked. |
| 9.3 Strategies | — | static | Deployment diagram (model v1 / index v1 vs v2 / v2). |
| 9.4 Final triangle | triangle | reuse | All techniques placed. |

### Section 10 — Close
| Slide | Primitive | Type | Notes |
|---|---|---|---|
| 10.1 Recap | montage | build | Fingerprints → cloud → triangle → architecture diagram. |
| 10.2 Open question | — | (static / text-only) | |
| 10.3 Thanks | — | — | |

---

## Implementation strategy

### Fingerprint component
A reusable JS component (likely a three.js `InstancedMesh` of cells, or a `<canvas>` 2D grid). Takes:

- a 768-length array (one cell per dimension)
- a render mode: `full` | `int8` | `pq(strips)` | `binary` | `truncate(k)`
- a colour palette tied to brand colours

Sized to fit a slide; could be invoked many times per slide for side-by-side comparisons. Likely a three.js module (since we have three.js infrastructure already — see [talks/threejs-example/](../threejs-example/)).

### Cloud component
A three.js scene with the 16 faces as billboarded sprites in 3D. Modes:

- 1D / 2D / 3D placement
- Voronoi overlay (IVF)
- HNSW graph overlay
- Filter dimming
- Query-point drop + nearest highlighting
- Camera orbit

Per-slide config via `data-mode=`, `data-query=`, `data-nprobe=`, etc., passed through the `three` frontmatter block. Stage hooks (`advance` / `retreat`) drive the per-slide animations.

### Triangle component
Simpler. Probably a static SVG with dots positioned by data attribute, or a small three.js / canvas scene. Each slide that shows the triangle declares which dots are present and where.

### Static slides
Standard markdown + occasional `dot` diagrams for deployment / drift diagrams.

---

## Open questions

- **Embedding source.** Local computed CLIP embeddings, or pre-baked JSON next to slides.md? Pre-baked is friendlier for `file://` deck portability.
- **Face image sourcing.** Need licence-clean portraits for 16 recognisable people. Wikimedia is the obvious answer; verify per-image rights.
- **Real vs faked data.** The fingerprint patterns are more compelling if they're from a real model. The cloud positions can be real too (UMAP'd down for the 3D view).
- **Pacing budget.** Plan flags sections 4 + 5 as a third of the talk. If we run long, DiskANN (4.6) and UMAP (6.3) are the safest cuts.

## Build order suggestion

1. Fingerprint component — biggest visual payoff, used most often, contains the talk's punchline (slide 5.4).
2. Cloud component (3D baseline, then IVF/HNSW overlays).
3. Triangle component.
4. Static slide art.
5. Per-slide wiring + stage animations.
