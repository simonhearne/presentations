# FaceNet learning visualisation design

An ambient, never-ending three.js visualisation of how FaceNet turns a face image into a vector and learns the embedding space through triplet loss. It replaces the placeholder on slide 5 of `talks/vector-search-visualised/` — `# Neural networks approximate human learning` — and answers the question the deck has been building toward: *where do the vectors come from?*

The visual loops forever with no presenter steps. The speaker narrates freely over it.

## Factual basis

FaceNet (Schroff, Kalenichenko, Philbin — Google, 2015) is **supervised metric learning**, not unsupervised. It is trained with **triplet loss**: each step samples an *anchor* face, a *positive* (a different photo of the same identity) and a *negative* (a different identity), then pulls anchor+positive together and pushes anchor+negative apart in embedding space, by at least a margin. The output is an L2-normalised embedding vector.

The slide therefore drops the word "unsupervised". The honest, still-striking framing is that the network is never handed hand-engineered features ("distance between the eyes") — it **discovers its own features** by being shown which faces are the same and which differ. The visualisation animates that exact mechanic; it is not a metaphor.

## Approach

A **true three.js module**, consistent with the deck's existing `cloud.js` and `connectome.js` — perspective depth, depth-fade fog, identity-coloured glowing points. A flat 2D canvas was considered and rejected: depth lets clusters overlap and read as a populated space, and matches the surrounding slides.

The module is **ambient**: it returns only `dispose()`, no `advance`/`retreat`, so arrow keys pass straight through to deck navigation (the `connectome.js` precedent). Two independent timers — traveller spawns and triplet samples — run at different periods so the loop never looks scripted.

No build-pipeline changes. The `three` frontmatter block, build-time module inlining (`embedThreeModules`), conditional three.js CDN injection, and the `.three-bg` layout class all already exist. This feature adds one module, one generator script, a slide rewrite, and nothing else.

## The component — `talks/vector-search-visualised/facenet-learning.js`

Lives in the **deck folder**, not `visualisations/` — like `cloud.js`, it embeds celebrity face thumbnails as base64 data URIs, so it is deck-specific, not a reusable shared module. Referenced from the slide by local path:

```three
- module: ./facenet-learning.js
```

The build reads it and inlines it as a base64 `data:text/javascript` URI, exactly like every local three module.

### Module contract

```js
import * as THREE from 'three';

export default function init({ canvas, opts }) {
  // build scene, start RAF loop
  return { dispose };
}
```

- Returns **only `dispose`**. Ambient — no stepped interaction.
- `dispose()` cancels the RAF loop, removes the resize listener, and disposes geometries / materials / textures / renderer, so the visual survives slide re-entry cleanly (matches `cloud.js`).

### What it renders

**The embedding space.** ~5 identities, each with a cluster centre placed in 3D and an identity colour. Each identity holds ~5 points. Points are a single `THREE.Points` with a per-vertex colour attribute and a soft circular sprite (the `discTexture` technique from `connectome.js`). Every point eases toward its cluster centre with a small random walk, so the space is always loosely formed and gently breathing — it never collapses and never freezes.

**The network strip.** A thin, fixed slab of layered nodes near the screen-left edge — a stylised "FaceNet". Rendered as a small static `THREE.Points`. A sweep highlight runs through it while a traveller is passing.

**Travellers (image → vector).** A pool of at most ~2 active travellers, each a textured plane showing a real celebrity face. Lifecycle state machine:

1. *enter* — spawn off the left edge, ease toward the network strip;
2. *process* — pause briefly inside the strip while the sweep highlight runs;
3. *morph* — the face plane shrinks and fades out; a new point of that identity's colour is born at the same spot;
4. *settle* — the new point eases into its identity's cluster and joins the breathing pool.

This is the literal *image becomes a vector* moment. A new traveller spawns every few seconds.

**Triplet events (the learning).** On a separate timer, three existing points are sampled: an **anchor**, a **positive** of the same identity, a **negative** of a different identity. For the duration of the event:

- the anchor wears a thin white ring (a `THREE.RingGeometry` billboarded toward the camera);
- a green link is drawn anchor→positive and the positive is given a transient extra pull *toward* the anchor;
- a red link is drawn anchor→negative and the negative is given a transient extra push *away* from the anchor;
- small canvas-texture sprite labels — `pull · same identity` (green), `push · different` (red) — fade in and out with the event.

After the event the transient forces release; the points' normal spring-to-cluster keeps the space stable. Clusters tighten and loosen perpetually — the visible signature of training that never ends.

**Motion.** The whole point-cloud `group` does a gentle **sway** — `rotation.y` oscillates within roughly ±0.12 rad on a slow sine — rather than a full rotation. A full spin would carry the fixed left-edge network strip and the traveller entry point around the screen and break the "faces arrive, get processed, land" reading. Sway plus per-point drift plus traveller and triplet motion give the scene ample life. Depth-fade fog (as in `connectome.js`) lets far points recede.

### Options (`opts`, all optional, good zero-config defaults)

Passed as extra keys on the `three` entry, parsed by the runtime's `parseValue`:

| key | default | meaning |
|-----|---------|---------|
| `background` | `#070d18` | renderer clear colour |
| `speed` | `1` | global motion multiplier (sway, travellers, triplet rate) |

`module: ./facenet-learning.js` with no other keys must look good on its own.

### Implementation notes

Follow `cloud.js` / `connectome.js` conventions: `WebGLRenderer({ canvas, antialias: true, alpha: true })`, `setPixelRatio(Math.min(devicePixelRatio, 2))`, a `discTexture`-style round sprite for points, the module owns its own `window` resize handler and removes it in `dispose`. Identity colours and the background are hex literals in the module (the Vega/DOT precedent — viz code cannot read CSS variables). Honour `prefers-reduced-motion`: hold the sway still and stop the traveller and triplet timers, leaving a calm, already-organised space.

### Embedded face data — `data/make_facenet_module.js`

`facenet-learning.js` is inlined (base64) by the build, so any relative `./data/faces/...` path would not resolve at runtime — the face JPEGs must be embedded as data URIs inside the module, exactly as `cloud.js` does.

The module is hand-written and editable. Only its face-data block is generated. `facenet-learning.js` contains a `FACES` constant fenced by sentinel comments:

```js
/* FACES_START — generated by data/make_facenet_module.js, do not edit by hand */
const FACES = [ /* { color, dataUri } ... */ ];
/* FACES_END */
```

`data/make_facenet_module.js` (mirroring the existing `data/make_cloud_module.js`) reads a curated subset of ~5 face JPEGs from `data/faces/`, base64-encodes each, pairs each with an identity colour, and rewrites only the region between the sentinels. The rest of the module is never touched by the generator — this keeps a non-trivial module maintainable, unlike `cloud.js`, whose entire body lives in its generator's template string.

The generator is committed and `facenet-learning.js` is committed with its data block already populated, so a fresh checkout builds with no generator run.

## Deck integration — slide 5 rewrite (`slides.md`)

The current slide 5 — `# Neural networks approximate human learning` plus the `<!-- snazzy visualisation... -->` comment — becomes:

```
{.three-bg .dark .small-title}

# Neural networks approximate human learning

` ` `three
- module: ./facenet-learning.js
` ` `
```

`.three-bg` (already in `css/layouts.css`) drops the full-bleed `.three-canvas` to `z-index: 0` and lifts the heading above it with `z-index: 1` and a legibility text-shadow. `.dark` gives light text; `.small-title` keeps the heading compact so the visual dominates. The canvas is always full-bleed `inset: 0` — `.three-bg` is simply what keeps the title readable on top of it. No body copy: the loop carries the slide and the speaker narrates.

No CSS changes — `.three-bg` already exists from the connectome work.

## Tests

No automated test is added. Consistent with precedent: `cloud.js`, `connectome.js`, `umap-modality-gap.js` and `make_cloud_module.js` have none — they are browser/WebGL code and fs-bound generators. There is also no new build-pipeline mechanism to guard: a local `./module.js` three entry and its base64 inlining are already covered by the existing `embedThreeModules` tests in `test/build.test.js`.

Verification is by building the deck and viewing it:

1. `node data/make_facenet_module.js` regenerates the face-data block without error.
2. `npm test` still passes (no regressions).
3. `npm run build talks/vector-search-visualised` succeeds; `dist/index.html` slide 5 contains a `<canvas class="three-canvas">` whose `data-module` is a `data:text/javascript;base64,` URI.
4. Open the built deck on slide 5 and confirm: faces enter from the left and morph into points; triplet events show ring + green pull + red push with fading labels; clusters stay loosely formed; the scene sways and never freezes or collapses; navigating away and back re-initialises cleanly.

## Out of scope

- A 2D-canvas variant.
- Presenter-stepped beats — the loop is deliberately ambient (chosen during brainstorming).
- Reusing the module across decks / moving it to `visualisations/` — it is face-data-bound, like `cloud.js`.
- Photographically distinct "same person, different photo" positives — only one image per celebrity exists; identity in the space is carried by colour, which is sufficient and accurate once faces have morphed into points.
- Visibility-driven pause when the slide is off-screen (acceptable — one ambient slide).
- README / CLAUDE.md changes — this adds a deck-internal visual, not a new authoring capability; `cloud.js` set the precedent of no special docs.
