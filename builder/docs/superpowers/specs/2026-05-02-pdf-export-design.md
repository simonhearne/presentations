# One-click PDF export via print stylesheet

## Goal

Make `File → Print → Save as PDF` in Chrome produce a correct landscape PDF
of any built deck without the user needing to change any setting in the
Chrome print dialog. No new CLI command, no new dependency.

## Background

`css/deck.css` already contains an `@media print` block and an `@page` rule
that set the paper size to 1920×1080 with zero margin and disable the
absolute-positioned slide stacking used on screen so that each slide flows
to its own page.

Despite this, the README currently instructs users to manually:

1. Set **Margins: None**.
2. Enable **Background graphics**.

Step 2 is required because Chrome strips background colors and gradients on
print by default. Without it, the title slide gradient, hero gradient,
section background, `.dark` slides, code-block tints, blockquote tints, and
avatar gradients all render as plain white. Step 1 may also be required if
Chrome ignores the existing `@page { margin: 0 }` declaration.

The print rules currently live mixed in with screen rules in `deck.css`.
Print concerns are a self-contained surface and benefit from being a
single file you can read end-to-end.

## Scope

In scope:

- A new `css/print.css` file containing every print-only rule.
- Removal of the corresponding rules from `css/deck.css`.
- A new `<link rel="stylesheet" media="print">` for `print.css` in
  `templates/deck.html`.
- The CSS additions described below so neither manual print-dialog toggle
  is needed for a faithful PDF.
- A README update reflecting the simpler workflow and the new file.

Out of scope:

- A `pdf` npm script or CLI command.
- Any headless-browser dependency (Puppeteer, Playwright, system Chrome).
- Browsers other than Chrome / Chromium for the documented flow. Other
  browsers may still work; the README documents Chrome as the canonical
  path because the project already standardises on Chrome's print engine.

## Design

### File layout

A new file `css/print.css` owns every print-only rule. After this change:

- `css/deck.css` contains only screen rules. The current `@media print`
  block (lines 125–152) and the trailing top-level `@page` rule
  (lines 154–157) are removed.
- `css/print.css` is the single source of truth for print behaviour. It
  contains one `@media print { … }` block plus a top-level `@page` rule.

The new file is loaded with `media="print"` on the link tag, so its
contents do not need an outer `@media print` wrapper. The bundle inliner
([bin/bundle.js](../../../bin/bundle.js)) is updated alongside this
change so its `LINK_RE` accepts arbitrary attribute order and preserves
any `media="…"` attribute when rewriting `<link>` to `<style>` — without
that, the inlined block would lose the print-only restriction and apply
to the screen.

### Template

[templates/deck.html](../../../templates/deck.html) gets one new link
after the existing `layouts.css` link:

```html
<link rel="stylesheet" media="print" href="{{cssDir}}/print.css">
```

Loading order matters: `print.css` comes last so its print rules can
override anything cascaded in from screen styles when the print engine
runs.

### `print.css` contents

```css
html, body, .slide {
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

html, body {
  height: auto;
  background: white;
  overflow: visible;
}

.deck-viewport {
  position: static;
  display: block;
}

.deck {
  width: auto;
  height: auto;
  transform: none !important;
}

.slide {
  display: flex !important;
  position: static;
  overflow: visible;
  page-break-after: always;
  break-after: page;
  opacity: 1 !important;
  transition: none !important;
}

.slide:last-child {
  page-break-after: auto;
  break-after: auto;
}

@page {
  size: 1920px 1080px;
  margin: 0;
}
```

Notes on the new declarations:

- `print-color-adjust: exact` (with the `-webkit-` prefix Chrome still
  requires) preserves background colours, images, and gradients on print,
  removing the need to enable "Background graphics" in the dialog.
- `.slide { overflow: visible }` is added (the screen rule sets
  `overflow: hidden` to clip mis-sized content inside the scaled viewport;
  on print the page is sized exactly to the slide, and clipping risks
  silently dropping content flush against the 1920×1080 edge).
- The `@page` rule is duplicated — once inside `@media print` and once at
  top level — as belt-and-braces for Chrome versions that only honour one
  form or the other. Both are valid CSS.
- All other rules are moved verbatim from `deck.css`.

## README update

`README.md` § "PDF export" is rewritten from five steps to:

```
1. Build the deck.
2. Open the resulting HTML in Chrome.
3. File → Print → Save as PDF.
```

The "Margins: None" and "Background graphics" instructions are removed,
since the stylesheet now handles both.

## Verification

After the change, build the example deck and open `dist/index.html` in
Chrome. Open the print dialog without altering any setting and confirm:

1. The preview shows one slide per page in landscape.
2. The title slide gradient, hero slide gradient, `.section` light
   gradient, `.dark` slide background, code-block / blockquote tint, and
   avatar gradient all render in the preview.
3. There are no white margins around any slide.
4. No content is clipped at the page edge.

If any of these fail in current Chrome, the spec is wrong; iterate on the
CSS until they all pass before declaring the work done.

## Risks

- Browser-specific: `print-color-adjust` is well-supported in Chrome,
  Edge, Safari, and Firefox, but exact rendering can drift between
  versions. Verification is done on the user's current Chrome; we do not
  promise pixel-perfect output across every browser.
- A future Chrome change could re-introduce the need for "Background
  graphics" if the implementation regresses. The README would then need
  updating; nothing in the build pipeline changes.
