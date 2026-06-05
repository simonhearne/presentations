# Three.js frontmatter design

Optional 3D visualizations on slides via a new `three` fenced frontmatter block, mirroring the existing `vega` and `dot` patterns. Three.js is loaded only when at least one slide uses it. Modules can optionally hook the next/previous slide nav to drive internal stages before yielding to the deck.

## Authoring

A slide opts in via a fenced ` ```three ` block. Body is the same kv-list shape as `authors` and `vega`:

```three
- module: ./embedding-lift.js
```

`module` (required, local path or `https://`) points at an ES module. Any other key on an entry is passed through to the canvas as a `data-<key>` attribute, which the runtime forwards to `init()` for module-specific config.

Multiple `three` entries on one slide are supported (they render multiple canvases, sized per CSS); first version of the example uses a single canvas.

The slide containing a 3D visualization should typically use `{.no-chrome}` so the canvas fills the slide cleanly. The `three` block does not require `.no-chrome` — it is an authoring choice.

## Module contract

```js
import * as THREE from 'three';

export default function init({ canvas, opts }) {
  // build scene, start animation loop
  return {
    advance() { /* true if consumed; false lets the deck advance */ },
    retreat() { /* symmetric for back nav; optional */ },
    dispose() { /* optional cleanup */ },
  };
}
```

`advance` and `retreat` are optional. If absent, the runtime never intercepts navigation for this canvas.

`opts` carries any `data-*` keys parsed from the entry (excluding `id` and `module`). Same parser as `script/vega.js` (numbers, booleans, JSON literals, otherwise raw string).

## Build pipeline (`bin/build.js`)

New functions, placed above `renderSlide` to match the existing layout:

- `parseThree(body)` — validates the kv-list (`module` required), returns array of entries.
- `extractThree(chunk)` — uses `extractFencedBlock(chunk, 'three', THREE_PLACEHOLDER)`. Single placeholder, like vega.
- `embedThreeModules(entries, talkDir)` — for each entry with a local `module`, read the file, base64-encode, replace `entry.module` with `data:text/javascript;base64,...`. URLs (`https://`) pass through. Same precedent as `embedVegaSpecs`.
- `renderThree(entries, slug)` — emits `<canvas class="three-canvas" id="three-<slug>[-N]" data-module="..." data-<key>="...">`. Multiple entries get suffixed ids.

`THREE_PLACEHOLDER = '<!--three-placeholder-->'` — analogous to `VEGA_PLACEHOLDER`.

In `buildDeck`:
- After vega/dot extraction in the per-chunk pipeline, run `extractThree` and `embedThreeModules`.
- After computing `hasCharts`/`hasDot`, compute `hasThree = prepared.some(p => p.three.length > 0)`.
- If `hasThree`, inject the importmap and the three.js runtime script into the template.

In `renderSlide`:
- Accept `three` entries, render via `renderThree`, replace `THREE_PLACEHOLDER` (or append) — same shape as vega handling.

## Template (`templates/deck.html`)

Two new placeholders: `{{threeImportmap}}` (rendered in `<head>`) and `{{threeScripts}}` (rendered after `{{vegaScripts}}`).

When `hasThree`:

```html
<script type="importmap">
{ "imports": { "three": "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js" } }
</script>
```

```html
<script type="module" src="../../../script/three.js"></script>
```

When `hasThree` is false, both placeholders are replaced with empty strings — chart-free decks pay nothing, matching the vega pattern.

## Runtime (`script/three.js`)

New file. Module script (`type="module"`) so it can dynamic-import canvas modules.

Responsibilities:

1. Discover `.three-canvas[data-module]` elements.
2. Lazy-init: when a slide first gains `.is-current`, for each canvas in that slide:
   - Resize canvas backing store to its CSS box.
   - Dynamic-import `data-module`.
   - Call `init({ canvas, opts })` where `opts = optionsFromDataset(canvas)` (same parser as `script/vega.js`).
   - Store the returned handle on the element (e.g. `el.__three`).
3. On `ArrowRight` / `n` / `Space` (capture phase, before `deck.js`): for each canvas on the current slide, call `advance()`. If any returns truthy, `e.preventDefault()` and `e.stopPropagation()`. Otherwise let the event reach `deck.js`. Symmetric for `ArrowLeft` / `p` / `retreat()`.
4. Window resize: re-size canvas backing store; module's animation loop owns the rest.
5. `dispose()` is best-effort, called on `beforeunload`. Slides keep their three.js instance alive across nav (matches typical deck behavior — revisits should not reset state).

The capture-phase listener is added in `script/three.js`. `deck.js` is unchanged.

Initial-slide observer: use a `MutationObserver` on each `.slide` watching for `class` changes, plus a one-shot init pass on load for whichever slide is already `.is-current`.

## CSS (`css/layouts.css`)

```css
.slide .three-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
```

The canvas naturally sits beneath any markdown content the slide contains (markdown renders inside the same `<section>`). For a clean full-bleed look, authors use `{.no-chrome}` and put no other text on the slide; or layer absolutely-positioned text via inline HTML if they want overlays like the spec.

## Example deck (`talks/threejs-example/`)

Two slides:

1. **Title slide** — `{.title}`, `# Embeddings: Dimensional Lift`, authors block with one entry.
2. **Visualization slide** — `{.no-chrome}`, single ` ```three ` block referencing `./embedding-lift.js`.

`embedding-lift.js` is a port of `specs/threejs_example.html`'s core scene:
- 3 gaussian clusters, ~600 points each.
- `truePos` Float32Array; `livePos` is the animated projection.
- `advance()` ramps `targetD` from 1 → 2 → 3 (returns `true` while transitioning); on the third `advance()` from stage 3, returns `false` so deck advances off the slide.
- `retreat()` symmetric.
- Animation loop: lerp `currentD` → `targetD`, write `livePos` from `truePos` with weighted y/z, render. Camera arcs between stages.
- Brand colors: replace the inspiration's accent palette with brand tokens (cluster colors `#175fff`, `#c84cff`, `#29b8ff`; matches `vectordb-301-rabitq` precedent of using brand hex literals in viz code).

The example does NOT include the spec's overlay UI (controls, big number, axes key) in v1 — keeping it pragmatic. Stage indicator can be added later as overlay markdown if desired.

## Bundle pipeline (`bin/bundle.js`)

The build inlines the module source as a `data:text/javascript;base64,...` URL on `data-module`, so per-canvas module code is already self-contained. The importmap points at the three.js CDN; the bundle leaves this alone for v1, matching how vega/vega-lite/vega-embed CDN scripts are left in place today. Network is required for the bundle to render three.js, same as vega charts.

If the user later wants a fully-offline bundle, that is a follow-up: vendor `three.module.min.js` into the repo and rewrite the importmap during bundle.

## Tests (`test/build.test.js`)

Append unit tests at the bottom of the file:

- `parseThree` — required `module`, extra keys preserved.
- `extractThree` — placeholder behavior, single block.
- `embedThreeModules` — local file → base64 data URL; `https://` passes through.
- `renderThree` — single canvas, multiple canvases (suffixed ids), passthrough `data-*` attributes.
- Integration: a deck with one `three` slide produces an importmap and `script/three.js` reference; a deck without `three` produces neither.

No tests for `script/three.js` runtime (consistent with `script/vega.js` having no unit tests — runtime is exercised manually via the example deck).

## Documentation

- `README.md` — add a `three` frontmatter section, alongside `vega` and `dot`.
- `CLAUDE.md` — add a paragraph describing the `three` frontmatter, mirroring the dot/vega paragraphs (parse pipeline, inlining strategy, conditional CDN injection, where to put new functions).

## Out of scope (v1)

- Vendoring three.js into the bundle.
- Multi-canvas slides in the example deck.
- Spec-style overlay UI (big numerals, axis key, control buttons).
- Touch/click stage controls — keyboard only for v1.
- Visibility-driven animation pause (slide off-screen: animation keeps running). Acceptable trade-off for a deck with one or two three-slides.
