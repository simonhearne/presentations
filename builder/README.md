# Zilliz Presentations

Minimal Markdown-to-HTML presentation framework, brand-aligned with Zilliz.

## Quick start

```bash
npm install                                   # one dep: marked
npm run build talks/2026-05-example           # → talks/2026-05-example/dist/index.html
npm run bundle talks/2026-05-example          # → talks/2026-05-example/dist/bundle.html
```

Open the HTML in any browser. Right arrow / space advances; URL hash deeplinks to a specific slide.

## Authoring a new talk

```
talks/<slug>/
├── slides.md          # your deck
└── img/               # optional, talk-specific images
```

Slides are separated by lines containing exactly `---`. The first non-blank
line of a slide may be an attribute block — `{.classname .modifier}` — to
apply slide layout classes. Available layouts:

| Class | Use |
| --- | --- |
| (none) | Content slide: white bg, black text, headings + body |
| `.title` | Opening title slide: gradient background, white text |
| `.section` | Divider between sections: oversized number + name |
| `.hero` | Full-bleed statement: dark gradient with one big claim |
| `.center` (modifier) | Centers content horizontally and vertically |
| `.dark` (modifier) | Inverts default content slide to white-on-navy |
| `.no-chrome` (modifier) | Hides the bottom-right page indicator |
| `.three-bg` (layout) | Renders a `three` block as a full-bleed background with slide text on top; pair with `.dark` and `.no-chrome` |

Example:

````markdown
{.title .no-chrome}
# My deck title
## Subtitle

```authors
- name: Jiang Chen
  position: head of developer relations
  company: zilliz
  photo: ./jiang.jpg
- name: Simon Hearne
  position: senior solutions architect
  company: zilliz
```

---

{.section}
# 01
## First section

---

# Regular content

- Bullet
- Another bullet
````

## Deck-level config

The very top of `slides.md` (before any slide content, leading blank lines OK) may carry a fenced ` ```deck ` block with deck-wide options:

```yaml
- agenda: false   # opt out of the auto-generated agenda slide (default: on)
```

Recognised keys:

- **`agenda`** — `true` (default) or `false`. When on (and the deck has at least one `{.section}` divider), the build injects an Agenda slide before the first section, with a numbered, hyperlinked table of contents pointing to each section. The agenda slide uses the auto-applied `.agenda` layout. Hash links go through the same slug pipeline as the section IDs they target, so they stay in sync.

Unknown keys are ignored — forward-compatible for future deck-level options.

A misplaced ` ```deck ` block (anywhere other than top-of-file) is treated as a regular fenced code block on whichever slide it lands in, which renders visibly and signals the authoring mistake.

## Speakers

The title slide can declare one or more speakers via a fenced ` ```authors `
block. Each entry renders as a card with avatar, name, and `position · company`.

```yaml
- name: Jiang Chen           # required
  position: head of devrel   # required
  company: zilliz            # required
  photo: ./jiang.jpg         # optional — local path or https:// URL
  initials: JC               # optional — overrides the auto-derived initials
```

Cards lay out 1–3 across in a row; 4 wraps to a 2×2 grid.

**Photo handling:**

- Local paths (e.g. `./jiang.jpg`) are copied into `dist/` at build time and inlined as data URIs at bundle time.
- `http://` and `https://` URLs are passed through unchanged.
- If `photo` is omitted, the avatar shows initials on a brand gradient. By default these are the first letter of the first word + first letter of the last word, uppercased; override with the `initials` field if needed.

## Charts (Vega / Vega-Lite)

Any slide can declare one or more Vega/Vega-Lite charts via a fenced ` ```vega ` block. Each entry renders as a `<div class="vega-chart vega-embed">` and the spec is loaded by [vega-embed](https://github.com/vega/vega-embed) at view time.

```yaml
- spec: ./scatter.json     # required — local path or https:// URL
  id: my-chart             # optional — default is "vis-<slide-slug>"
  renderer: svg            # optional — any extra key becomes data-<key>
  actions: false           # …passed to vegaEmbed (booleans/numbers parsed)
```

Any key prefixed with `signal-` seeds a same-named signal in the loaded spec with a static value. This is the static counterpart to `animate-<name>`: useful for showing the same chart across multiple slides with different fixed state. For example, on a stage-by-stage reveal the same spec is referenced with `signal-stage: 1`, `signal-stage: 2`, etc. Values are parsed as numbers, booleans, or JSON literals where possible. Unknown signal names log a console warning and the chart falls back to spec defaults.

Passing a JSON array (e.g. `signal-stage: [0, 1, 2]`) turns the signal into a click-through stepper: the first element seeds the signal at load time, and pressing ArrowRight/Space/n steps forward through the remaining values without advancing the slide. ArrowLeft/p steps back. Once the last value is reached, the next press advances the deck as normal; likewise stepping back past the first value retreats. Multiple stepped charts on the same slide advance in parallel.

Spec handling:

- Local `.json` paths are read at build time and inlined as base64 `data:application/json` URIs directly in the rendered HTML (the file is not copied to `dist/`). This means the unbundled `dist/index.html` works when opened directly via `file://` — no local server needed for the chart spec to load.
- `http://` and `https://` URLs pass through unchanged and are fetched at view time.

Vega/vega-lite/vega-embed are loaded from jsDelivr at view time, but **only when at least one slide has a chart** — chart-free decks pay nothing. Bundled decks still need network for those CDN scripts (same as Google Fonts today).

### Brand theme

Charts are automatically styled to match the Zilliz brand — Inter typography, brand-coloured axes and gridlines, a brand categorical palette (blue → berry → green → purple → sky), gradient bar/area fills, and a transparent background that lets the slide show through. **You don't need to add any styling config to a spec** — write the data and encoding, and it comes out on-brand. A spec's own `config` still wins where it sets something explicitly, so deliberate colours (e.g. semantic series colours) are preserved.

The theme has light and dark variants. The runtime picks one from the slide's background: dark slides (`.dark`, `.title`, `.hero`, `.bg`) get light text and axes; everything else gets the light variant. To override per chart, add `theme`:

```yaml
- spec: ./scatter.json
  theme: dark              # force the dark variant (or "light")
```

The theme lives in [script/vega.js](script/vega.js) (`brandConfig`); adjust palette or axis styling there and every chart updates.

## Diagrams (Graphviz)

Any slide can declare one or more Graphviz diagrams via a fenced ` ```dot ` block. The body is the digraph body — no `digraph { }` envelope needed; the build wraps it and injects brand-themed defaults (Inter font, brand-blue rounded boxes, navy edges, `rankdir=LR`).

```dot
A [label="Client"]
B [label="Ingest"]
C [label="Segment store" shape=cylinder]
A -> B -> C
```

Each diagram is rendered to SVG at build time using [`@hpcc-js/wasm-graphviz`](https://www.npmjs.com/package/@hpcc-js/wasm-graphviz) and inlined into `dist/index.html` — no client-side runtime, no CDN. Multiple ` ```dot ` blocks on the same slide work — they get suffixed ids (`diagram-<slug>-1`, `-2`, …).

To override the default `rankdir=LR`, write a `rankdir=TB` line in the body (graph attributes inside the body override the wrapper defaults). To restyle a single node, set per-node attributes (`label`, `shape`, `fillcolor`, `color`, etc.) the same way.

For the build to render text in the brand font, **Inter must be installed system-wide on the build machine**. Without it, Graphviz silently falls back to its default font.

## 3D visualizations (three.js)

A slide can embed a three.js scene via a fenced ` ```three ` block:

```three
- module: ./embedding-lift.js
```

`module` (required) is a local path or `https://` URL to an ES module whose default export is `init({ canvas, opts })`, returning `{ advance?, retreat?, dispose? }`. Any other key on the entry becomes a `data-*` attribute on the canvas and is parsed into `opts` (numbers, booleans, JSON literals, otherwise raw string).

`advance()` and `retreat()` are optional. Return `true` to consume the keypress (Right/n/Space or Left/p/PageUp) and step an internal stage; return `false` to let the deck navigate. Use `{.no-chrome}` on the slide for a full-bleed canvas.

three.js itself is loaded from a CDN via importmap; both the importmap and the runtime are only injected when at least one slide uses a `three` block. The module source is inlined as a base64 `data:` URL so the deck works straight from `file://` (matching the `vega` precedent).

See [talks/threejs-example/](talks/threejs-example/) for a working example — three Gaussian clusters that lift from 1D → 2D → 3D as you press the right arrow, with the camera arcing into a three-quarter view at stage 3.

### Shared connectome background

`visualisations/connectome.js` is a reusable, ambient neural-network background — a slowly rotating two-lobe neuron point cloud with pulsing connections. Drop it into any deck as a full-bleed background to narrate over:

````markdown
{.three-bg .dark .no-chrome}

```three
- module: ../../visualisations/connectome.js
  id: connectome
```
````

The `.three-bg` layout class makes the canvas a full-bleed background and keeps slide text legible on top; the visual is purely ambient (no `advance`/`retreat`). Optional `opts`: `count` (neuron count), `lobes` (`1` or `2`), `accent` (colour), `background` (clear colour; `transparent` for no fill, which also drops the depth fade), `speed` (motion multiplier).

### Shared UMAP modality-gap point cloud

`visualisations/umap-modality-gap.js` is a reusable cloud of CLIP image and caption embeddings projected to 3D with UMAP — two colours, two centroid pins, and a dashed line marking the modality gap between them. The point data ships inside the module (self-contained, no external file). It opens as a flat 2D projection; `advance()` lifts it into 3D with a slow idle spin, `retreat()` drops it back, and you can drag to rotate once lifted:

````markdown
{.three-bg .dark .small-title}
# Two cones in one hypersphere

```three
- module: ../../visualisations/umap-modality-gap.js
```
````

## Fragments (incremental reveals)

Mark any block or inline element to appear on a later ArrowRight rather
than with the slide. Uses pandoc-style trailing `{.fragment}` markers.

```markdown
- First point is visible immediately
- Second point appears on ArrowRight {.fragment}
- Third point appears next {.fragment}

A paragraph with [a highlighted phrase]{.fragment} revealed inline.

## A heading that comes in late {.fragment}
```

Block markers attach to the enclosing `<li>`, `<p>`, or `<h1>`–`<h6>`.
Inline `[text]{.fragment}` is wrapped in a `<span>`.
Multiple classes are supported: `{.fragment .highlight}` lets you co-style
fragments with deck-specific CSS.

On forward navigation (ArrowRight from the previous slide, or hash/Home/End
jumps), fragments start hidden. On backward navigation (ArrowLeft from the
next slide), fragments enter fully revealed so you can backtrack naturally.
Fragments are revealed in DOM order before the slide advances.

### Auto-advancing reveals

A slide can play its fragment reveals on a timer instead of one keypress
each. Add `.auto-reveal` to the slide's attribute block:

```markdown
{.auto-reveal delay=900}
## A list that builds itself

- Visible on entry
- Revealed by your first ArrowRight {.fragment}
- ...then the rest follow on the timer {.fragment}
```

Parameters, both optional:

- `delay=<ms>` — milliseconds between reveals. Default `1000`.
- `start=immediate` — begin the sequence on slide entry. Omit it to wait for
  the speaker's first manual reveal (the default).

In the default mode the first ArrowRight reveals fragment one as usual; that
reveal starts the timer and the remaining fragments appear every `delay` ms.
With `start=immediate` the timer starts as soon as the slide is shown.
Either way, pressing any arrow/space/page key while the timer runs cancels it
and hands back manual stepping. The sequence stops on the last fragment — it
never advances the deck. Entering a slide backward reveals every fragment at
once, with no timer.

## Iframe embeds

A slide can embed an external page full-bleed via a fenced ` ```iframe ` block:

```iframe
- url: http://127.0.0.1:8080
```

`url` (required) is the page to embed; any other key becomes a `data-*` attribute on the iframe. The frame fills the slide via `position: absolute; inset: 0`; chrome and footer overlay on top. Use `{.no-chrome}` on the slide if you want truly full-bleed.

Click events pass through to the iframe normally. To keep deck navigation alive after a click, a small runtime is injected (only when a slide uses an `iframe` block) that refocuses the parent window when the iframe steals focus — so `n` / `p` / `←` / `→` continue to advance and retreat slides. Trade-off: text inputs inside the iframe won't receive typed characters, so this is intended for click-driven embeds rather than authenticated forms.

## PDF export

1. Build the deck.
2. Open the resulting HTML in Chrome.
3. File → Print → Save as PDF. Each slide becomes one landscape page at 1920×1080.

The print stylesheet ([css/print.css](css/print.css)) handles margins and
background colours, so no print-dialog tweaks are needed.

## Bundling

`npm run bundle talks/<slug>` produces a single `bundle.html` with all CSS,
JS, fonts, and images inlined. Network is required at bundle time (for
Google Fonts). Use `-- --no-images` to skip raster images if size matters.

## Folder structure

- `bin/` — build and bundle scripts
- `css/` — shared design tokens, deck rules, layouts, print rules
- `script/` — runtime: `deck.js` (scale, navigation, deeplinks), `vega.js` (chart embedding)
- `templates/` — HTML shell with placeholders
- `img/` — shared brand SVGs (spark, logo)
- `talks/<slug>/` — your decks
- `brand_assets/`, `inspiration/` — reference only, not consumed at build

## Tests

```bash
npm test
```

Tests live in `test/` and use Node's built-in test runner.

## Deployment

The decks are published at **https://talks.simonhearne.com** (Netlify), built
from `simonhearne/presentations` where this builder lives under `builder/`.

- `decks.json` is the manifest of what gets published. Each entry has `slug`,
  `source` (`build` = compiled from `talks/<slug>/`, `legacy` = link-out to an
  existing reveal.js deck), `title`, optional `date`, and (legacy only) an
  optional `url` (defaults to `https://simonhearne.com/presentations/<slug>/`).
- `npm run site` runs `bin/site.js`: it builds + bundles every `build` deck,
  copies each self-contained `bundle.html` to `_site/<slug>/index.html`, copies
  `css/tokens.css` to `_site/assets/`, and generates `_site/index.html` (the
  landing page). `_site/` is the Netlify publish directory.
- Netlify config lives at the combined repo's root `netlify.toml`
  (`base = "builder"`, `command = "npm ci && node bin/site.js"`,
  `publish = "_site"`). Legacy decks remain served by GitHub Pages via the
  `simonhearne.com/presentations/*` proxy and are linked (not re-hosted).
