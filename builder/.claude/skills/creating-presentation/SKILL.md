---
name: creating-presentation
description: Use when authoring a new talk in this repo, scaffolding a slides.md, or composing slides with the Zilliz markdown-to-HTML deck format (slide separators, attribute blocks, layout classes, authors frontmatter, vega chart frontmatter, dot diagram frontmatter)
---

# Creating a Zilliz Presentation

## Overview

Decks are markdown files at `talks/<slug>/slides.md`, built to a self-contained HTML deck by [bin/build.js](../../../bin/build.js) and optionally inlined into a single `bundle.html` by [bin/bundle.js](../../../bin/bundle.js). Authoring is plain markdown plus three repo-specific conventions: top-level `---` slide separators, `{.classname}` attribute blocks, and a fenced ` ```authors ` block on the title slide.

## File layout

```
talks/<slug>/
├── slides.md          # the deck
└── img/               # optional, talk-specific images
```

Build with `npm run build talks/<slug>`. Bundle with `npm run bundle talks/<slug>`. The canonical reference is [talks/2026-05-example/slides.md](../../../talks/2026-05-example/slides.md) — exercises every layout.

## Slide syntax

**Separator:** a line containing exactly `---` (top-level only — don't use `---` thematic breaks inside a slide).

**Attribute block:** the first non-blank line of a slide may be `{.foo .bar}`. Classes attach to the slide's `<section>`.

**Title slide:** include `<img class="logo" src="../../../img/zilliz-light.svg" alt="">` at the top so the brand mark renders on the gradient.

## Layout classes

| Class | Use |
|---|---|
| (none) | Content slide: white bg, black text, headings + body |
| `.title` | Opening title slide: gradient + white text |
| `.section` | Divider: oversized number + name |
| `.hero` | Full-bleed statement: dark gradient, one big claim |
| `.bg` | Full-bleed background image (first child must be `![alt](url)`) |
| `.center` | Modifier: centers content on both axes |
| `.dark` | Modifier: white-on-navy content slide |
| `.no-chrome` | Modifier: hides bottom-right page indicator |

Modifiers stack: `{.title .no-chrome}`, `{.hero .no-chrome}`.

## Authors block

On the title slide, a fenced ` ```authors ` block renders speaker cards. Tiny YAML subset — list of objects:

```yaml
- name: Jiang Chen           # required
  position: head of devrel   # required
  company: zilliz            # required
  photo: ./jiang.jpg         # optional — local path or https:// URL
  initials: JC               # optional — overrides auto-derived initials
```

1–3 cards lay out across; 4+ wraps to 2×2. Local `photo` paths are copied to `dist/` at build, inlined as data URIs at bundle. Omit `photo` to get initials on a brand gradient.

## Vega charts block

Any slide can have a fenced ` ```vega ` block to render Vega/Vega-Lite charts:

```yaml
- spec: ./scatter.json     # required — local path (read at build, inlined as base64 data URI) or https:// URL
  id: custom-id            # optional — default "vis-<slide-slug>", with -2/-3/... when multiple charts on a slide
  renderer: svg            # optional — any extra key becomes data-<key> and is passed to vegaEmbed
  actions: false           # values like "true"/"false"/numbers are parsed; everything else stays a string
```

Spec files live alongside `slides.md` (e.g. `talks/<slug>/scatter.json`). The chart appears at the end of the slide content (after the markdown body, before chrome). Local specs are inlined into the HTML at build time — the unbundled deck works when opened via `file://`, no local server needed. Vega/vega-lite/vega-embed scripts auto-load from jsDelivr only when at least one slide has a chart — there's no setup for chart-free decks.

## Dot diagrams block

Any slide can have one or more fenced ` ```dot ` blocks. Unlike `authors`/`vega`, the body is **the digraph body written inline** — not a YAML kv-list, not a path to a spec file, and no `digraph { }` envelope (the build wraps it):

````markdown
# A 30-second tour of Milvus

```dot
A [label="Ingest"]
B [label="Index"]
C [label="Query"]
A -> B -> C
```
````

Each diagram becomes a `<figure class="dot" id="diagram-<slide-slug>">` (suffixed `-2/-3/...` when a slide has multiples) containing inline SVG rendered at build time via [`@hpcc-js/wasm-graphviz`](https://www.npmjs.com/package/@hpcc-js/wasm-graphviz) — no client runtime, no CDN. The build wraps the body with brand defaults (Inter font, brand-blue rounded boxes, navy edges, `rankdir=LR`). Override per-diagram by writing graph attributes in the body, e.g. `rankdir=TB` to flip orientation, or per-node `fillcolor=...` `color=...` to highlight one box.

## Minimal template

````markdown
{.title .no-chrome}
<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Deck title
## Subtitle

```authors
- name: Simon Hearne
  position: solutions architect
  company: zilliz
```

---

{.section}
# 01
## First section

---

# Regular content slide

- Bullet
- Another bullet

---

{.hero .no-chrome}
# One big claim.

---

# Chart slide

```vega
- spec: ./scatter.json
  renderer: svg
  actions: false
```

---

# Diagram slide

```dot
A [label="Ingest"]
B [label="Index"]
C [label="Query"]
A -> B -> C
```
````

## Common mistakes

- Using `---` as a thematic break inside a slide — splits the slide. Use `***` or omit.
- Putting the attribute block after a blank line — must be the first non-blank line.
- Forgetting the logo `<img>` on the `.title` slide — gradient renders without the brand mark.
- Using `.bg` without an image as the first child — layout breaks. The `![alt](url)` must come first.
- Hand-writing a byline on the title slide instead of using the `authors` block — loses the card layout.
- Editing files under `dist/` — generated. Edit `slides.md` and rebuild.
- Putting the vega `spec:` JSON inline in the markdown — the parser expects a path/URL, not a literal spec. Save it as `scatter.json` next to `slides.md`.
- Vega chart not rendering — open DevTools and check for vega-embed errors (likely a malformed spec). The init script logs `vega-embed failed for <id>` with details.
- Treating ` ```dot ` like a kv-list (writing `- spec: ...`) — it isn't. The fence body is the digraph body written inline.
- Wrapping the dot body in `digraph G { ... }` — don't. The build adds the envelope; authors write only the body statements.
- Dot diagram fails to build — the build will throw with a graphviz syntax error. Validate the body (without the envelope) at the [Graphviz online editor](https://dreampuf.github.io/GraphvizOnline/) by wrapping it in `digraph { ... }` there.

## After authoring

Run `npm run build talks/<slug>` and open `talks/<slug>/dist/index.html`. Right arrow / space advances; URL hash deeplinks. For a shareable single file: `npm run bundle talks/<slug>` (needs network for Google Fonts). For PDF: open the built HTML in Chrome → Print → Save as PDF — [css/print.css](../../../css/print.css) handles the rest.
