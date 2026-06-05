# Graphviz diagrams design

Replace the Mermaid frontmatter pipeline with build-time Graphviz rendering. Diagrams are authored as DOT, rendered to inline SVG during `npm run build`, and styled via injected brand defaults so authors write minimal source.

## Why

Mermaid renders client-side and measures text width before custom fonts are loaded, which clips node labels (visible in `vectordb-101` slide 18: `Inges`, `Segme`, `Query Coor`, etc.). Its flowchart aesthetics also have weak theming hooks.

Graphviz via `@hpcc-js/wasm-graphviz` is npm-pinnable, has world-class layout engines, and renders at build time — no runtime CDN, no font race condition, smaller deck output.

## Decisions

- **Replace, don't coexist.** Mermaid is removed entirely (`extractMermaid`, `renderMermaid`, the CDN injection, the `script/mermaid.js` runtime). The two existing `mermaid` blocks in `talks/vectordb-101/slides.md` (slides 18 and 25) are rewritten in DOT as part of this change.
- **Auto-wrap with brand defaults.** The build injects a brand-themed attribute block at the top of every diagram. Authors write minimal DOT and get on-brand output automatically.
- **`rankdir=LR` default.** Slides are 1920×1080; wide diagrams use the canvas. Authors override per-diagram via `rankdir=TB` in the body.
- **Body-only authoring.** Fence body is the digraph body — no `digraph { }` envelope. The build wraps it.
- **Build-time SVG inlining.** Same pattern as `vega`: WASM runs in Node during `npm run build`, output SVG is inlined directly into `dist/index.html`. No client runtime.

## Authoring format

A fenced ` ```dot ` block whose body is the digraph body:

````markdown
```dot
A [label="Client"]
B [label="Ingest"]
C [label="Segment store" shape=cylinder]
A -> B -> C
```
````

The build wraps this as `digraph G { <DOT_DEFAULTS> <body> }` before rendering.

- Block name `dot` (matches the language, matches GitHub convention).
- Multiple blocks per slide supported via the same loop pattern as the old `mermaid` extractor; IDs auto-suffixed `-2`, `-3`, etc.
- Body is freeform DOT — no kv-list parser. Authors override anything (including `rankdir`) by writing graph attributes inside the body.

## Build pipeline

Four additions to [bin/build.js](../../../bin/build.js), placed above `renderSlide` to match the file's existing organization:

- **`DOT_DEFAULTS`** — a string constant with the brand attribute block (graph/node/edge defaults). Defined near the top of the file alongside other rendering helpers.
- **`extractDot(body)`** — loops `extractFencedBlock(body, 'dot')` until none remain. Returns `{ body, blocks: string[] }` where each string is the raw DOT body.
- **`renderDot(blocks, slug, graphviz)`** — for each block: wraps body in `digraph G { ${DOT_DEFAULTS} ${body} }`, calls `graphviz.dot(source)` to get SVG, post-processes the SVG (strip explicit root `width=`/`height=` attributes so CSS controls sizing), emits `<figure class="dot" id="diagram-${slug}[-N]">${svg}</figure>`. Returns the joined HTML string.
- **`buildDeck` wiring** — top-level ESM import of `Graphviz` (matches the file's import style). Inside `buildDeck`, detect "any slide has dot blocks" before the slide loop; if any, `await Graphviz.load()` once and pass the instance into per-slide rendering. If none, skip the load call entirely — chart-free decks pay nothing, matching the existing vega pattern.

`renderSlide` stays pure (no I/O, no async) and receives the rendered dot HTML as a parameter, same way it receives rendered vega/authors HTML today.

### DOT brand defaults

```dot
graph [
  rankdir=LR
  fontname="Inter"
  bgcolor="transparent"
  pad=0.3
  nodesep=0.5
  ranksep=0.7
]
node [
  fontname="Inter"
  shape=box
  style="rounded,filled"
  fillcolor="#e6f0ff"
  color="#175fff"
  fontcolor="#061982"
  penwidth=1.5
  margin="0.25,0.15"
]
edge [
  fontname="Inter"
  color="#061982"
  penwidth=1.5
  arrowsize=0.8
]
```

Hex literals duplicate values from [css/tokens.css](../../../css/tokens.css). Deliberate, small duplication — same precedent as vega specs that inline brand colors. If brand colors change, both files update.

Inter must be installed system-wide on the build machine for the SVG to render text in Inter; Graphviz uses the OS font stack to resolve `fontname`. If Inter isn't available, it silently falls back. Documented in CLAUDE.md.

## CSS

One new rule block in [css/deck.css](../../../css/deck.css), placed near the new table styles:

```css
.slide .dot {
  margin: var(--zilliz-s-3) auto;
  display: flex;
  justify-content: center;
}
.slide .dot svg {
  max-width: 100%;
  max-height: 60vh;
  height: auto;
  width: auto;
}
```

The `<figure>` centers in the slide content area. The SVG keeps its `viewBox` (graphviz emits one) so it scales proportionally; root `width`/`height` attrs are stripped in `renderDot` so CSS controls sizing instead of graphviz's hardcoded points. The `60vh` cap prevents tall diagrams from overflowing the footer.

## Bundle pipeline

[bin/bundle.js](../../../bin/bundle.js) needs no changes — it already inlines `dist/index.html` as-is, and SVGs are inline. The mermaid CDN inlining branch (if any) is deleted alongside the build-side mermaid removal.

## Migration of existing diagrams

Two diagrams in [talks/vectordb-101/slides.md](../../../talks/vectordb-101/slides.md) are rewritten in DOT:

- **Slide 18** — "A 30-second tour of Milvus" architecture flowchart (Client → Ingest/Query Coord → Segment store ← Index Builder → Top-k results). Natural LR. Currently produces the clipped screenshot.
- **Slide 25** — translated verbatim from existing mermaid source.

Each is verified visually in the browser after rewrite (Playwright screenshot at the relevant slide), same check pattern used for the table styling work.

## Removals

- `extractMermaid`, `renderMermaid`, and the mermaid CDN-injection branch in [bin/build.js](../../../bin/build.js).
- [script/mermaid.js](../../../script/mermaid.js) (the runtime initializer).
- Mermaid-related tests in [test/build.test.js](../../../test/build.test.js).
- Mermaid CDN inlining branch in [bin/bundle.js](../../../bin/bundle.js), if present.

## Tests

Append to [test/build.test.js](../../../test/build.test.js), matching the existing `node:test` + `node:assert/strict` style:

- `extractDot` — single block; multiple blocks; empty result when no blocks; non-`dot` fences left intact.
- `renderDot` — wraps body in `digraph G { … }`; injects `DOT_DEFAULTS`; emits `<figure class="dot" id="diagram-slug">`; suffixes IDs `-2`/`-3` for multiples; output contains `<svg` and a `viewBox`; explicit root `width=`/`height=` attrs are stripped.
- Integration: `buildDeck` on a temp dir with a slide containing a dot block produces an `index.html` that includes the rendered SVG inline.
- Removal verification: no mermaid CDN script tag in build output for a deck with a dot block.

## Docs

- **README.md** — replace the `mermaid` frontmatter paragraph with a `dot` paragraph; update the syntax example.
- **CLAUDE.md** — replace the "Mermaid frontmatter" paragraph in the slide-authoring section. Note that DOT body is freeform (no kv-list parser). Note the system-Inter font requirement. Update the line about `vectordb-101` exercising "two mermaid diagrams" → "two dot diagrams."

## Dependencies

- Add `@hpcc-js/wasm-graphviz` to `package.json` `dependencies`. Focused package (~2MB), smaller than the umbrella `@hpcc-js/wasm`.
- Project remains otherwise dep-light (still just `marked` + this).
