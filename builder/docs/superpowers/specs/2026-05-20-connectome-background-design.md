# Connectome background design

A reusable, ambient neural-network visualisation rendered as a full-bleed slide background, built as a shared three.js module that any deck can drop in via the existing `three` frontmatter block. First use: the opening scene-setting slide of `talks/vector-search-visualised/`.

The slide it replaces (slide 2, "Things your brain does effortlessly") becomes a connectome the speaker narrates over, with stepped text beats that build an arc into slide 3's keyword-vs-vector demo.

## Approach

The component is a **true three.js module** (perspective depth, depth-fade, gentle 3D rotation) — consistent with the existing `cloud.js` and `embedding-lift.js`, and richer than a flat 2D canvas for a hero background. A 2D-canvas alternative was considered and rejected: the depth is what makes a rotating connectome read as "complexity."

No build-pipeline changes. The `three` frontmatter block, build-time module inlining (`embedThreeModules`), and conditional three.js CDN injection all already exist. This feature adds one shared module, one CSS layout class, a slide rewrite, docs, and one test.

## The component — `visualisations/connectome.js`

Lives in `visualisations/` alongside the shared Vega specs. Other decks reference it by relative path exactly as they reference shared charts (`../../visualisations/knn-2d.json` precedent):

```three
- module: ../../visualisations/connectome.js
  id: connectome
```

`embedThreeModules` resolves `module` with `path.resolve(talkDir, e.module)`, which already handles parent-relative paths — no code change needed. The module is read and inlined as a base64 `data:text/javascript` URI at build time, like every local three module.

### Module contract

```js
import * as THREE from 'three';

export default function init({ canvas, opts }) {
  // build scene, start RAF loop
  return { dispose };
}
```

- Returns **only `dispose`** — no `advance`/`retreat`. The visual is ambient, so arrow keys pass straight through to deck navigation. The speaker drives the slide with stepped text fragments (handled entirely by the deck's existing fragment system) and their voice.
- `dispose()` cancels the RAF loop, removes the resize listener, and disposes geometries / materials / renderer — so the visual survives slide re-entry cleanly (matches `cloud.js`).

### What it renders

- `count` neuron points distributed across `lobes` ellipsoid clusters (two lobes → a brain-like silhouette, offset along x).
- kNN edges (k = 3) computed once at init, rendered as a single `THREE.LineSegments`.
- Travelling pulses: a pool of points that interpolate along random edges and respawn on arrival, lightly glowing.
- Nodes as a single `THREE.Points` with size attenuation; the node/edge/pulse group rotates slowly.
- Depth fade via `THREE.FogExp2` so far neurons recede — this is where the 3D earns its keep.

### Options (`opts`, all optional, good zero-config defaults)

Passed as extra keys on the `three` entry, parsed by the runtime's `parseValue` (numbers, booleans, JSON, else raw string):

| key | default | meaning |
|-----|---------|---------|
| `count` | `440` | total neuron count |
| `lobes` | `2` | ellipsoid clusters (1 = single cloud, 2 = brain-like) |
| `accent` | `#5b86e8` | colour for nodes / edges / pulses (`new THREE.Color`) |
| `background` | `#070d18` | renderer clear colour; the literal `transparent` makes the canvas transparent (alpha 0) |
| `speed` | `1` | global motion multiplier (rotation + pulse rate) |

`module: ../../visualisations/connectome.js` with no other keys must look good on its own.

### Implementation notes

Follow `cloud.js` conventions: `WebGLRenderer({ canvas, antialias: true, alpha: true })`, `setPixelRatio(Math.min(devicePixelRatio, 2))`, the module owns its own `window` resize handler (updating renderer size + camera aspect) and removes it in `dispose`. Brand colours are hex literals in the module (DOT/Vega precedent — viz code can't read CSS variables). Honour `prefers-reduced-motion`: when set, hold rotation still and slow or freeze pulses.

## Deck integration

### New layout class `.three-bg` (`css/layouts.css`)

Makes a `.three-canvas` a true background with legible text on top:

```css
.slide.three-bg .three-canvas { z-index: 0; }
.slide.three-bg > :not(.three-canvas) { position: relative; z-index: 1; }
```

The `.three-canvas` rule today sets `position: absolute; inset: 0` but no `z-index`, so an appended canvas paints over body text. `.three-bg` drops the canvas to `z-index: 0` and lifts slide content above it. A faint dark scrim sits behind the text content for contrast over bright pulses. Scoped to `.three-bg` — existing three slides (`cloud.js` etc.) are untouched.

Reusable: any deck gets a narratable visual background with `{.three-bg .dark .no-chrome}` + a `three` block + body text.

### Slide 2 rewrite (`talks/vector-search-visualised/slides.md`)

The current slide 2 (`# Things your brain does effortlessly`, three bullets, the "seventy years" line, and the `<!-- VIS -->` comment) is replaced with:

```
{.three-bg .dark .no-chrome}

` ` `three
- module: ../../visualisations/connectome.js
  id: connectome
` ` `

You recognise a friend's voice across a crowded room — instantly, without trying.
{.fragment}

Behind it: ~86 billion neurons, ~100 trillion connections, millions of years of tuning.
{.fragment}

A computer starts with none of it. The rest of this talk: teaching it to match **meaning**.
{.fragment}
```

An explicit `id: connectome` is set because the slide has no heading, so the auto-derived `three-<slug>` id would be empty.

### Stepped beats

Three `{.fragment}` paragraphs reveal on advance (the deck's existing fragment system — no module involvement):

1. *You recognise a friend's voice across a crowded room — instantly, without trying.* — the effortless hook.
2. *Behind it: ~86 billion neurons, ~100 trillion connections, millions of years of tuning.* — the hidden machinery; absorbs the old "seventy years" line.
3. *A computer starts with none of it. The rest of this talk: teaching it to match **meaning**.* — the turn; "meaning" hands directly into slide 3's keyword-vs-vector demo.

The slide enters as a pure connectome (all three beats hidden), letting the visual breathe before the first reveal. Copy is the author's to tweak.

## Tests (`test/build.test.js`)

`embedThreeModules` already covers local-module inlining, `https://` passthrough, `data:` passthrough, and the missing-file error. Append one test: a **parent-relative `module` path** (`../../visualisations/x.js` from a nested talk dir) inlines correctly — this is the cross-deck reuse mechanism and is worth a regression guard even though `path.resolve` handles it for free.

No unit tests for `connectome.js` itself (browser/WebGL module — consistent with `cloud.js` and `embedding-lift.js` having none). It is verified by building the deck and viewing it.

## Documentation

- `README.md` — add `.three-bg` to the layout-class list; note the shared `visualisations/connectome.js` component and how to drop it into a deck.
- `CLAUDE.md` — one line noting `visualisations/` now also holds a shared three.js module (`connectome.js`), not only Vega specs.

## Out of scope

- A 2D-canvas variant of the component.
- Additional shared backgrounds beyond the connectome.
- Visibility-driven animation pause when the slide is off-screen (acceptable — one ambient slide).
- Fully-offline bundle of three.js (pre-existing limitation, unchanged).
- Click/touch interaction with the visual — it is deliberately ambient.
