# Zilliz Presentations Framework — Design

**Date:** 2026-05-01
**Status:** Draft for review

## Goal

A minimal, dependency-light framework for authoring brand-consistent Zilliz
presentations in Markdown, building them to standalone HTML, and bundling them
to a single self-contained HTML file for sharing. Slides must look correct on
screen, print cleanly to PDF, and support hash-based deeplinking.

## Non-goals

- Live reload / dev server (use `python3 -m http.server`).
- Speaker notes view (deferrable).
- Animations or slide transitions beyond instant cuts.
- Multi-user collaboration, theming UI, or a CLI beyond two scripts.
- Headless PDF export from the build script (Chrome's print dialog is enough).

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Runtime | Node 20+ with one runtime dep: `marked` |
| 2 | Slide separator | A line containing exactly `---` (top-level only; fenced code blocks excluded) |
| 3 | Folder structure | Self-contained talk folders under `talks/<slug>/` with their own `slides.md`, `img/`, `dist/` |
| 4 | Slide variants | First-line attribute syntax `{.classname [.modifier]}` parsed into `<section class="…">` |
| 5 | Sizing | Fixed 1920×1080 canvas; CSS `transform: scale(...)` to fit viewport on screen; one native page per slide for print |
| 6 | Aspect ratio | 16:9 |
| 7 | Deeplinks | `#<index>-<slug>` (number is canonical, slug cosmetic — rename-safe and reorder-safe via index) |
| 8 | Bundling | Inline CSS, JS, fonts (fetched from Google Fonts at bundle time), and SVGs by default. `--no-images` skips raster only. SVG always inlines. |
| 9 | Fonts | Google Fonts via `<link>` in dev; fetched and base64-inlined at bundle time |
| 10 | Design tokens | CSS custom properties under `--zilliz-` prefix; tokens.css is single source of truth |
| 11 | Image format | SVG preferred for logos, marks, and simple diagrams; PNG/JPG only for photos |

## Repo layout

```
presentations/
├── package.json              # one dep: marked
├── bin/
│   ├── build.js              # pipeline 1: md → HTML
│   └── bundle.js             # pipeline 2: HTML + assets → single HTML
├── css/
│   ├── tokens.css            # --zilliz-* CSS variables
│   ├── deck.css              # canvas, slide visibility, print rules
│   └── layouts.css           # .title, .section, .hero, default content
├── script/
│   └── deck.js               # scale, keyboard nav, hash deeplink
├── img/                      # shared brand SVGs (spark mark, logo variants)
├── templates/
│   └── deck.html             # static shell with {{title}} and {{slides}} placeholders
├── talks/
│   └── <slug>/
│       ├── slides.md
│       ├── img/              # talk-specific images
│       └── dist/             # gitignored build output
│           ├── index.html
│           └── bundle.html
├── docs/superpowers/specs/   # this spec lives here
├── brand_assets/             # reference only, not consumed at build
└── inspiration/              # reference only
```

## Pipeline 1 — `bin/build.js` (md → HTML)

**Invocation:** `node bin/build.js talks/<slug>` or `npm run build -- talks/<slug>`.

**Steps:**

1. Read `talks/<slug>/slides.md`.
2. Split on lines that are exactly `---`. A simple state machine skips
   `---` that appear inside fenced code blocks (\`\`\` or ~~~).
3. For each slide chunk:
   - Detect optional first non-blank line matching `^\{\.[\w\-]+( \.[\w\-]+)*\}$`. If
     present, capture the class names and strip the line.
   - Run `marked.parse()` on the remaining body.
   - Extract first `<h1>` or `<h2>` text. Slugify (lowercase, ASCII, hyphenated,
     max ~60 chars). Empty/missing title → slug is `slide`.
   - Wrap as
     `<section id="<index>-<slug>" class="slide <classes>" data-index="<index>">…</section>`.
4. Auto-append a chrome footer (`<footer class="chrome"><span class="page">N / total</span><span class="mark">…spark…</span></footer>`)
   to every slide unless the slide has class `no-chrome`.
5. Read `templates/deck.html`, replace `{{title}}` (deck title from first slide's
   H1, falling back to slug) and `{{slides}}` (concatenated `<section>`s).
6. Write `talks/<slug>/dist/index.html`. CSS/JS are referenced via relative paths
   (`../../../css/...`, `../../../script/...`, `../../../img/...`).

**Size target:** ~80–120 LOC, no helper deps beyond `marked` and `node:fs`/`node:path`.

## Pipeline 2 — `bin/bundle.js` (single-file HTML)

**Invocation:** `node bin/bundle.js talks/<slug> [--no-images]`.

**Steps:**

1. Read `talks/<slug>/dist/index.html` produced by pipeline 1.
2. **Inline `<link rel="stylesheet" href="...">`** for relative paths: replace
   with `<style>…file contents…</style>`.
3. **Inline `<script src="...">`** for relative paths: replace with
   `<script>…file contents…</script>`.
4. **Inline Google Fonts:**
   - Detect `<link>` to `fonts.googleapis.com/css2?...`.
   - Fetch that URL with a desktop User-Agent (so Google returns woff2 rules).
   - For each `src: url(https://fonts.gstatic.com/...woff2)` in the returned CSS,
     fetch the woff2 and rewrite the `url(...)` to a base64
     `data:font/woff2;base64,...` URI.
   - Replace the `<link>` with `<style>…rewritten CSS…</style>`.
5. **Inline SVG `<img src="*.svg">`:** read the SVG file, parse out the root
   `<svg>` element, transfer the `<img>`'s `class` and `id` attributes onto the
   root `<svg>`, and replace the `<img>` element with the inlined SVG markup.
6. **Inline raster images** (`<img src="*.png|jpg|jpeg|webp">`) as base64 data
   URIs, unless `--no-images` is set.
7. **Inline assets in CSS:**
   - `url(*.svg)` → `data:image/svg+xml;utf8,<URL-encoded>`.
   - `url(*.png|jpg|jpeg|webp)` → base64 data URI (skipped under `--no-images`).
8. Write `talks/<slug>/dist/bundle.html`.

**Constraints:**

- HTML rewriting uses regex over the known-shape template, not an HTML parser.
  Acceptable because the template is fully under our control.
- `--no-images` skips raster only. SVG always inlines (small, semantic, often
  themable via `currentColor`).
- Network is required at bundle time (for Google Fonts). Future flag
  `--no-fonts` could keep the CDN `<link>` instead — out of scope for v1.

**Size target:** ~80–120 LOC plus a small set of regexes.

## Runtime — `script/deck.js`

Three responsibilities:

**1. Scale-to-fit.**
- A wrapper element `.deck` is sized exactly `1920×1080` via CSS variables.
- On `DOMContentLoaded` and on `window.resize`:
  `scale = Math.min(innerWidth / 1920, innerHeight / 1080)`.
- Apply `transform: scale(<scale>)` to `.deck` with `transform-origin: top left`,
  and translate to center it horizontally and vertically.

**2. Keyboard navigation.**
- `ArrowRight`, `Space`, `PageDown` → next slide.
- `ArrowLeft`, `PageUp` → previous slide.
- `Home` → first slide. `End` → last slide.
- Toggle `.is-current` on the active `<section.slide>`. CSS controls visibility.

**3. Hash deeplinks.**
- On every navigation, `history.replaceState(null, '', '#' + index + '-' + slug)`
  where slug comes from the slide's `id` attribute (already in `id="N-slug"`
  form). No history pollution; back button leaves the deck.
- On page load and on `hashchange`, parse the leading integer (regex
  `^#(\d+)`); if valid and in range, jump to that slide. Slug is ignored on
  parse, so renaming a title does not break old links.

**Size target:** ~80 LOC. No framework, no router, no build watcher.

## Styling

### `css/tokens.css`

Single source of truth for design tokens, all under `--zilliz-` prefix.
Pre-supplied tokens (verbatim from user):

```css
:root {
  --zilliz-black: #000000;
  --zilliz-white: #ffffff;
  --zilliz-blue: #175fff;
  --zilliz-blue-10: #e6f0ff;
  --zilliz-blue-20: #cce0ff;
  --zilliz-navy: #061982;
  --zilliz-berry: #c84cff;
  --zilliz-berry-10: #fbe6ff;
  --zilliz-berry-20: #f7c9ff;
  --zilliz-purple: #7f47ff;
  --zilliz-sky: #49bcff;
  --zilliz-green: #00dcc6;
  --zilliz-gradient: linear-gradient(135deg, #175fff 0%, #7f47ff 50%, #c84cff 100%);
  --zilliz-gradient-light: radial-gradient(circle at 12% 8%, var(--zilliz-blue-20) 0%, transparent 78%),
                           radial-gradient(circle at 88% 92%, var(--zilliz-berry-20) 0%, transparent 78%),
                           var(--zilliz-white);
  --zilliz-gradient-dark: radial-gradient(circle at 12% 8%, var(--zilliz-blue) 0%, transparent 78%),
                          radial-gradient(circle at 88% 92%, var(--zilliz-berry) 0%, transparent 78%),
                          var(--zilliz-navy);
}
```

Added by this design (under same prefix):

```css
:root {
  --zilliz-font-sans: 'Inter', system-ui, sans-serif;
  --zilliz-font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --zilliz-slide-w: 1920px;
  --zilliz-slide-h: 1080px;
  --zilliz-s-1: 8px; --zilliz-s-2: 16px; --zilliz-s-3: 24px;
  --zilliz-s-4: 32px; --zilliz-s-6: 48px; --zilliz-s-8: 64px;
  --zilliz-s-12: 96px; --zilliz-s-16: 128px;
}
```

`deck.css` and `layouts.css` consume only these variables — no raw hex or px values.

### `css/deck.css`

Canvas, slide visibility, print rules (sketch):

```css
html, body { margin: 0; height: 100%; background: var(--zilliz-black); overflow: hidden; }
.deck { width: var(--zilliz-slide-w); height: var(--zilliz-slide-h);
        position: relative; transform-origin: top left; }
.slide {
  position: absolute; inset: 0;
  width: var(--zilliz-slide-w); height: var(--zilliz-slide-h);
  display: none;
  font-family: var(--zilliz-font-sans);
  color: var(--zilliz-black);
  background: var(--zilliz-white);
  padding: var(--zilliz-s-16);
  box-sizing: border-box;
}
.slide.is-current { display: flex; flex-direction: column; }
.chrome { position: absolute; bottom: var(--zilliz-s-4); right: var(--zilliz-s-4);
          font-family: var(--zilliz-font-mono); font-size: 18px; opacity: 0.6; }
.no-chrome .chrome { display: none; }

@media print {
  html, body, .deck { width: auto; height: auto; overflow: visible; background: white; transform: none !important; }
  .slide { display: flex !important; position: static; page-break-after: always; }
  .slide:last-child { page-break-after: auto; }
}
@page { size: 1920px 1080px; margin: 0; }
```

### `css/layouts.css` — four starter classes

| Class | Background | Text color | Notes |
|---|---|---|---|
| (none) | `var(--zilliz-white)` | `var(--zilliz-black)` | Default content. H1 ~80px, H2 ~56px, body ~32px. Code uses mono on `--zilliz-blue-10` panel. |
| `.title` | `var(--zilliz-gradient)` | `var(--zilliz-white)` | Spark logo top-left; deck title 120px Inter Semibold; subtitle/author 32px Regular bottom-left. |
| `.section` | `var(--zilliz-gradient-light)` | `var(--zilliz-black)` | Oversized number (480px Bold) top-left; section name 96px Regular bottom-right. Mirrors brand guide "01 / Introduction" pages. |
| `.hero` | `var(--zilliz-gradient-dark)` | `var(--zilliz-white)` | Single big statement 96–144px Semibold. Optional spark mark watermark. |

Modifiers stack: `{.hero .center}`, `{.section .dark}`. New layouts = append a block to `layouts.css`; no JS or build changes.

## Markdown authoring example

```markdown
{.title .no-chrome}
# Building Agent Memory at Scale
## with Milvus & Zilliz Cloud
Simon Hearne — May 2026

---

{.section}
# 01
## Why memory?

---

# What we'll cover

- The shape of agent memory
- Why vector search is the right primitive
- Cost and latency at scale

---

{.hero .no-chrome}
# Memory is the moat.
```

## `package.json` scripts

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "build":  "node bin/build.js",
    "bundle": "node bin/bundle.js"
  },
  "dependencies": {
    "marked": "^14.0.0"
  }
}
```

Usage:
- `npm run build talks/2026-05-agent-memory`
- `npm run bundle talks/2026-05-agent-memory`
- `npm run bundle talks/2026-05-agent-memory -- --no-images`

## PDF export

Chrome's print-to-PDF flow:
1. Open `dist/index.html` (or `dist/bundle.html`) in Chrome.
2. File → Print.
3. Set **Margins: None** and enable **Background graphics**.
4. Save as PDF.

Each slide becomes one landscape PDF page at native 1920×1080, no reflow.
README will document this.

## Brand SVG assets

`img/` ships three reusable shared SVGs:

- `zilliz-spark.svg` — the 12-line spark mark, recreated from the brand guide's
  geometric construction. Uses `currentColor` so any consumer can theme it.
- `zilliz-logo-dark.svg` — spark + "zilliz" wordmark in black.
- `zilliz-logo-white.svg` — same, white variant for dark backgrounds.

These can be referenced from any slide via `<img src="../../../img/zilliz-spark.svg" class="logo">`,
and the bundler will swap them inline so CSS like `.slide.title .logo { color: var(--zilliz-white); }` works.

## Out of scope (deferred)

- Speaker notes / presenter view.
- Slide transitions (fade, slide).
- Live reload / file watching.
- Headless PDF rendering.
- Theming beyond Zilliz brand.
- A README beyond a short usage section. (Will be written during implementation, not designed here.)

## Open questions

None at sign-off. Future-flag candidates: `--no-fonts` (keep CDN link),
speaker notes, code-block syntax highlighting.
