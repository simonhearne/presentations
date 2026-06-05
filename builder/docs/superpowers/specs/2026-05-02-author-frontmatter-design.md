# Author / speaker frontmatter for the title slide

## Goal

Let deck authors declare one or more speakers in `slides.md` and have them
rendered as a row of speaker cards on the title slide. Each card shows a
profile photo (or initials fallback), name, and a `position · company` line.

## Authoring format

A fenced ```authors``` block placed inside the title slide markdown. The block
is parsed out before Markdown rendering and replaced with the rendered HTML.

Example:

````md
{.title .no-chrome}
# Bootstrap Deck
## A minimal Zilliz presentation

```authors
- name: Jiang Chen
  position: head of developer relations
  company: zilliz
  photo: ./jiang.jpg
- name: Simon Hearne
  position: senior solutions architect
  company: zilliz
```
````

### Fields

Per author:

- `name` — required.
- `position` — required.
- `company` — required.
- `photo` — optional. Either a path relative to the talk dir (e.g.
  `./jiang.jpg`) or a remote URL beginning with `http://` or `https://`.
- `initials` — optional. Overrides the auto-derived fallback initials.

### Initials fallback rule

If no `photo` is provided:

- If `initials` is set, use it (uppercased) verbatim.
- Else: take the first letter of the first whitespace-separated word, plus the
  first letter of the last word, uppercased. So `"Jiang Chen"` → `JC`,
  `"Jiang Yi Chen"` → `JC`, single-name `"Madonna"` → `M`.

### Authors block placement

The fenced block can in principle appear on any slide; the build does not
restrict it to the title slide. In practice the title slide is the intended
home, and the CSS positions the speakers grid for `.title` slides.

## Build pipeline changes (`bin/build.js`)

Four new functions, plus minor wiring in `buildDeck`:

### `parseAuthors(body)`

Tiny YAML-subset parser. Splits the body on `- ` list markers; for each entry,
parses `key: value` lines into a flat object. No nesting, no quoted strings,
no anchors, no flow style. Whitespace and blank lines tolerated.

Throws a clear error on:
- A non-blank line at the top level that is not a list marker.
- A list-item line missing the leading `- `.
- A `key: value` line missing the colon.

### `extractAuthors(chunk)`

Walks the chunk line-by-line looking for an opening ```` ```authors ```` fence
and the matching closing fence. If found, returns
`{ authors: parseAuthors(body), body: chunkWithoutFence }`. If absent, returns
`{ authors: [], body: chunk }`.

The fence detection mirrors the rules already used by `splitSlides`: only
recognize the fence when not already inside another fence.

### `copyAuthorPhotos(authors, talkDir, distDir)`

Mutates and returns the authors list. For each author with a `photo`:

- If `photo` starts with `http://` or `https://`: leave unchanged.
- Else: copy the file from `resolve(talkDir, photo)` to
  `resolve(distDir, basename(photo))`, then rewrite `author.photo` to
  `basename(photo)` so the rendered `<img src>` is a path relative to
  `dist/index.html`. This makes the existing bundler's
  `inlineRasterImages` step pick the file up automatically.

If a local photo cannot be read, throw with a clear message naming the
author and path.

### `renderAuthors(authors)`

Returns the HTML block:

```html
<div class="speakers">
  <div class="speaker">
    <div class="avatar"><img src="jiang.jpg" alt=""></div>
    <div>
      <div class="who-name">Jiang Chen</div>
      <div class="who-role">head of developer relations · zilliz</div>
    </div>
  </div>
  <div class="speaker">
    <div class="avatar">SH</div>
    <div>
      <div class="who-name">Simon Hearne</div>
      <div class="who-role">senior solutions architect · zilliz</div>
    </div>
  </div>
</div>
```

For an empty list, returns `''`.

All values are escaped via the existing `escapeHtml`.

### Wiring in `buildDeck`

For each chunk:

1. `extractAuthors(chunk)` → `{ authors, body }`.
2. `copyAuthorPhotos(authors, talkDir, distDir)`.
3. Pass the cleaned `body` (in place of the original chunk) and the
   `authors` array into `renderSlide`.

`renderSlide` itself stays pure — no I/O. Its signature gains an
`authors` field; internally it calls `renderAuthors(authors)` and
appends that HTML after the marked-up body and before the chrome and
footer. The photo copy lives in `buildDeck` because that's where
`distDir` is known.

The two `marked.parse` passes already in `buildDeck` (one for slide
HTML, one for title extraction) need to operate on the cleaned `body`,
not the raw chunk, so the `authors` fence does not show up in
extracted titles.

## CSS changes (`css/layouts.css`)

New rules:

- `.speakers` — flex container, `flex-wrap: wrap`, gap between cards. Each
  `.speaker` claims roughly a third of the row width so 1–3 fit on one line;
  4 wraps to a 2x2 grid.
- `.speaker` — flex row, avatar on the left, name/role stacked on the right.
- `.avatar` — circular, ~80px diameter. With an `<img>` child:
  `object-fit: cover`, clipped to a circle. With text initials: gradient
  background (`#f59e0b → #ec4899`, matching the existing
  `.hero-text-alternate` palette), white bold mono text, centered.
- `.who-name` — sans, bold, larger text.
- `.who-role` — mono, smaller, dimmer to match the screenshot reference.

Title-slide positioning lives under `.slide.title .speakers`, sitting just
above the footer area. Other styles are global so the speaker block can be
dropped on any slide.

## Tests (`test/build.test.js`)

Unit tests:

- `parseAuthors` — parses a multi-author block, ignores blank lines,
  errors clearly on malformed input.
- `extractAuthors` — strips the fence and returns parsed entries; chunks
  without the block return `{ authors: [], body: chunk }`.
- `renderAuthors`
  - Renders `<img>` when `photo` is set.
  - Falls back to first/last initial when no photo:
    `"Jiang Chen"` → `JC`, `"Madonna"` → `M`.
  - Honors explicit `initials` override.
  - HTML-escapes `name`, `position`, `company`.
  - Returns `''` for an empty array.

Integration test (`buildDeck` against a temp talk dir):

- A local photo path gets copied to `dist/` and the rendered `<img src>`
  is the bare filename.
- A remote `http(s)://` URL is emitted unchanged and not copied.

## Example deck (`talks/2026-05-example/slides.md`)

- Drop the manual `Simon Hearne — May 2026` byline line from the title slide.
- Add an `authors` block with two entries: one with a local photo (a small
  placeholder dropped into the talk folder) and one without — exercises both
  the photo-copy path and the initials-fallback path in the example deck.

## Out of scope

- Bundler changes. The bundler already inlines local raster images by path,
  so a copied photo is bundled with no new code.
- Authors on non-title slides — allowed by the parser/renderer, but not
  styled or documented as a feature.
- Schema validation beyond the required-field check in the parser.
- A separate `<head>` `<meta name="author">` tag — the title slide
  presentation is the only consumer.
