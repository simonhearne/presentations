# Notes for Claude

A markdown-to-HTML presentation builder, brand-aligned with Zilliz. Decks live under `talks/<slug>/`; each has a `slides.md` that is built into a self-contained HTML deck.

`README.md` covers the user-facing authoring story. This file is the agent quick-start: architecture, conventions, and where to find things.

## Architecture

Two independent pipelines:

1. **Build** ([bin/build.js](bin/build.js)) — `slides.md` → `dist/index.html`. References CSS, JS, and images via relative paths.
2. **Bundle** ([bin/bundle.js](bin/bundle.js)) — `dist/index.html` → `dist/bundle.html`. Inlines every local asset (CSS, JS, SVG, raster, Google Fonts) as a single self-contained file. Run after build.

## Site assembly & deploy

3. **Site** ([bin/site.js](bin/site.js)) — `decks.json` → `_site/`. Builds +
   bundles every `source: "build"` deck and copies its `bundle.html` to
   `_site/<slug>/index.html`, copies `css/tokens.css` to `_site/assets/`, and
   generates `_site/index.html` (landing page). `source: "legacy"` decks are
   link-outs to `simonhearne.com/presentations/<slug>/`, not re-hosted. Run via
   `npm run site`. This is the Netlify build; deployed at talks.simonhearne.com
   from `simonhearne/presentations` (this builder lives under `builder/` there).
   `bin/site.js` keeps pure helpers (`validateManifest`, `normalizeDeck`,
   `deckHref`, `renderLanding`) above the `assembleSite` orchestrator, same as
   `build.js`.

`buildDeck` is the central function. It splits `slides.md` on top-level `---`, extracts an optional `authors` block per slide, parses slide-level attribute classes (`{.title .center}` syntax), runs the body through `marked`, and assembles each slide into a `<section>` with chrome and footer.

## Slide authoring

See `README.md` for the full layout-class list. Two formats worth knowing in detail:

**Attribute block** — first non-blank line of a slide may be `{.foo .bar}`. Classes are added to the slide's `<section>`. Supports the layouts (`.title`, `.section`, `.hero`, `.bg`) and modifiers (`.center`, `.dark`, `.no-chrome`).

**Authors frontmatter** — a fenced ` ```authors ` block (typically on the title slide) renders speaker cards on that slide. Tiny YAML-subset format: list of objects with `name`, `position`, `company` (required), plus optional `photo` (local path or `http(s)://` URL) and `initials` (overrides the auto-derived first/last initial). Local photos are copied into `dist/`; URLs pass through.

**Vega frontmatter** — a fenced ` ```vega ` block renders one or more Vega/Vega-Lite charts on the slide. Same YAML-subset shape as `authors`: list of objects with `spec` (required, local path or URL), optional `id` (default `vis-<slide-slug>`, suffixed `-2/-3/...` for multiple charts on a slide), and any other key passed through as a `data-<key>` attribute on the chart `<div>` (read by [script/vega.js](script/vega.js) and forwarded to `vegaEmbed`). Keys prefixed with `signal-` are a special case: they are pulled out of the opts stream and applied as named vega signals on the view after embed, mirroring `animate-<name>` but with a static value. If the value parses as a JSON array (e.g. `signal-stage: [0, 1, 2]`), it becomes step-driven: the first element seeds the signal, and ArrowRight/Left step through the remaining values, consuming the keypress until exhausted (then the deck advances normally). Multiple stepped charts on the same slide advance in parallel. Local specs are read at build time and **inlined directly as base64 `data:application/json` URIs** in the rendered HTML — not copied to `dist/`. This is deliberate: vega-embed loads specs via `fetch()`, and `fetch()` against a relative path is blocked by CORS when the deck is opened over `file://`. Inlining at build time means the unbundled `dist/index.html` works straight from the filesystem. The bundle step's `inlineVegaSpecs` is a defensive no-op for normal builds but still handles HTML produced outside this pipeline. The build only injects vega-embed CDN scripts when at least one slide has a chart — chart-free decks pay nothing.

**Vega brand theme** — [script/vega.js](script/vega.js) merges a Zilliz brand config under every chart so specs don't carry their own styling. `brandConfig(isDark)` returns a Vega config (transparent background, Inter fonts, brand axis/legend/grid colours, brand `range.category`/`ramp`/`diverging`, gradient bar/area fills) and `embedAll` sets `opts.config = deepMerge(brandConfig(isDark), opts.config || {})` before calling `vegaEmbed`. vega-embed merges the spec's own `config` **over** this base, so a spec's explicit colours/ranges always win — the theme only fills what the spec leaves unset. `isDark` comes from the slide's classes (`section.matches('.dark, .title, .hero, .bg')`, the white-text layouts) or an explicit `data-theme="light|dark"` (filtered out of the forwarded opts alongside `spec`/`animate-*`/`signal-*`). Brand hex values are duplicated as literals in `BRAND` — same precedent as `DOT_DEFAULTS` and the three.js colour constants, since Vega config can't read CSS variables at render time. Specs therefore only need `config` for genuinely per-chart choices (deliberate font sizes, `axis.labels:false`, faceted `style.cell`, semantic series colours); everything else inherits the theme.

**Vega signal animator** — [script/vega.js](script/vega.js) includes a generic signal stepper for time-driven visualizations (e.g. animating an O(N) scan). After `vegaEmbed` resolves, it stores the view on `el.__vegaView` and reads `data-animate-*` attributes set via vega frontmatter. Keys (all optional except `animate-signal`): `animate-signal` (signal name to step — activates the animator), `animate-from` (start value, default 0), `animate-to` (end as number) OR `animate-to-data` (name of a data source whose `.length` is the end), `animate-step-ms` (default 80), `animate-step` (increment, default 1), `animate-loop` (`true` to loop), `animate-trigger` (gating signal name) + `animate-trigger-value` (parsed; animator runs while the trigger equals this, resets when it doesn't). Animator attrs are filtered out of the opts forwarded to `vegaEmbed` so they don't show up as warnings. The flat-scan visualization on [talks/vector-search-visualised/knn-2d-flat.json](talks/vector-search-visualised/knn-2d-flat.json) is the reference usage — `interactive=false` (click-to-pin) starts the scan, clicking again resets `cursor` to 0.

**Dot frontmatter** — a fenced ` ```dot ` block renders one or more Graphviz diagrams on the slide. Like `mermaid` was, the fence body is freeform (it's the digraph body — no `digraph { }` envelope; the build wraps it). Multiple ` ```dot ` blocks per slide are supported (`extractDot` loops `extractFencedBlock` until none remain). Each diagram becomes a `<figure class="dot" id="diagram-<slug>">` (suffixed `-2/-3/...` for multiples) containing inline SVG rendered at build time via [`@hpcc-js/wasm-graphviz`](https://www.npmjs.com/package/@hpcc-js/wasm-graphviz). The build wraps each body in `digraph G { ${DOT_DEFAULTS} ${body} }` where `DOT_DEFAULTS` injects the brand-themed graph/node/edge attributes (Inter font, brand-blue rounded boxes, navy edges, `rankdir=LR`); authors override per-diagram by writing graph attributes inside the body. Brand colors are duplicated as hex literals in `DOT_DEFAULTS` because DOT can't read CSS variables at render time — same precedent as vega specs that inline brand colors. Inter must be installed system-wide on the build machine for the SVG to render text in the brand font; Graphviz uses the OS font stack to resolve `fontname`. Graphviz WASM is loaded only when at least one slide has a dot block — chart-free decks pay nothing.

**Three.js frontmatter** — a fenced ` ```three ` block embeds a three.js visualization on the slide. Same kv-list shape as `vega` and `authors`: list of objects with `module` (required, local path or URL), optional `id` (default `three-<slide-slug>`, suffixed `-2/-3/...` for multiples), and any other key passed through as a `data-<key>` attribute. Local module files are read at build time and **inlined as base64 `data:text/javascript` URIs** in the rendered HTML — same precedent as vega specs and for the same reason: `file://` blocks `fetch()` and dynamic `import()` of relative URLs. [script/three.js](script/three.js) (the runtime) is also inlined into the deck as a `<script type="module">` block, and the three.js library is loaded via a CDN importmap. Both injections are conditional on `hasThree` — chart-free decks pay nothing. The runtime listens for ArrowRight/n/Space and ArrowLeft/p in capture phase; if the active slide's canvas module returns `true` from `advance()`/`retreat()`, the keypress is consumed and [script/deck.js](script/deck.js) never sees it. Module API: default export `init({ canvas, opts })` returning `{ advance?, retreat?, dispose? }`. The example deck at [talks/threejs-example/](talks/threejs-example/) ports `specs/threejs_example.html` and exercises the stage hooks (1D → 2D → 3D). Shared three modules can live in `visualisations/` alongside the Vega specs and be referenced cross-deck by relative path — `visualisations/connectome.js` is a reusable ambient neural-network background, used via the `.three-bg` layout class.

**Fragments** — Pandoc-style `{.fragment}` markers on block elements (`<li>`, `<p>`, `<h1>`–`<h6>`, `<blockquote>`) and inline `[text]{.fragment}` spans drive incremental reveals. `bin/build.js` runs `applyFragmentAttrs` on the rendered HTML to strip markers and merge classes; `script/fragments.js` registers a capture-phase keydown listener that reveals/hides on the active slide. `script/deck.js` dispatches a `slide:enter` CustomEvent on `document` with `detail: { direction, index, slide }` whenever the active slide changes, where `direction` is `'forward' | 'backward' | 'jump'`. Fragments listen and reset hidden on `forward`/`jump`, pre-reveal on `backward`. Capture-phase listener registration order in the template is `fragments → vega → three`, so fragments consume keypresses first.

The shared kv-list parser is `parseKvList` in [bin/build.js](bin/build.js) — `parseAuthors`, `parseVega`, and `parseThree` all validate on top of it. `dot` skips it because the body is freeform DOT, not kv pairs. Add new fenced frontmatter blocks the same way: `parseFoo` (validate required fields), `extractFoo` (uses `extractFencedBlock`, or loops it for multiples), `copyFooAssets` / `embedFooAssets` if it references local files, `renderFoo`, then wire into `buildDeck` and `renderSlide`.

## Code style

This is a deliberately dep-light project. One runtime dep (`marked`) and Node's built-in test runner. Match the surrounding style:

- Plain `function` declarations and arrow callbacks; no classes, no async helpers when sync works.
- ESM (`import`/`export`), no CommonJS.
- No comments unless the *why* is non-obvious. Don't restate what the code does.
- `escapeHtml` is the single point for HTML escaping in `bin/build.js` — reuse it for any new user-supplied output.
- Filesystem I/O lives in `buildDeck` / `bundleDeck`; `renderSlide` and friends stay pure for testability.
- For sub-tasks that touch `bin/build.js`, place new functions above `renderSlide`; keep `buildDeck` last.

## Tests

`npm test` — Node's built-in runner. Tests are unit-style (`node:test` + `node:assert/strict`), call exported functions directly, no mocking framework. Integration tests use temp dirs via `mkdtempSync` with `try/finally` cleanup.

When adding a feature, follow the existing pattern: append tests at the bottom of [test/build.test.js](test/build.test.js) or [test/bundle.test.js](test/bundle.test.js); add new imports to the existing import line for the same module rather than creating duplicate import statements.

## Commands

```bash
npm test                                    # run tests
npm run build talks/<slug>                  # build a deck → dist/index.html
npm run bundle talks/<slug>                 # bundle a built deck → dist/bundle.html
npm run bundle talks/<slug> -- --no-images  # bundle without inlining raster images
```

The example deck at [talks/2026-05-example/](talks/2026-05-example/) is the canonical reference and exercises every layout class, the `authors` frontmatter, and the `vega` frontmatter (scatter plot from [scatter.json](talks/2026-05-example/scatter.json)). The [talks/vectordb-101/](talks/vectordb-101/) deck additionally exercises three interactive Vega specs and two `dot` diagrams (slides 18 and 25).

## Conventions when changing code

- Branch policy on this repo: small features go directly to `main`. Don't open feature branches unless the user asks.
- Commit messages use Conventional-Commits-style scopes: `feat(build):`, `fix(build):`, `test(build):`, `feat(css):`, `docs(example):`. Keep them terse and explain the *why* in the body when non-obvious.
- The `Co-Authored-By: Claude ...` trailer is expected on agent-generated commits.
