# HTML/MD Fragments — Design

**Date:** 2026-05-18
**Status:** Draft for review

## Problem

The deck already supports incremental stepping inside a slide for two cases: Vega charts (via array-form `signal-<name>` step lists) and three.js stages (via `advance()`/`retreat()` returning `true`). Plain HTML/markdown content has no equivalent. Authors who want to reveal a bullet point, a paragraph, or a highlighted phrase one keypress at a time must currently put each on its own slide or hand-roll JavaScript per deck.

Goal: add reveal.js-style `.fragment` behavior so any block-level or inline element in markdown can be marked to appear on the next ArrowRight, in DOM order, before the slide advances to its next sibling.

## Authoring surface

Pandoc-style trailing attribute markers, consistent with the existing slide-level `{.title .center}` syntax:

```markdown
- First point (visible immediately)
- Second point {.fragment}
- Third point {.fragment}

A paragraph with [a revealed phrase]{.fragment} mid-sentence.

> Pull-quote that appears later {.fragment}

## A heading that comes in late {.fragment}
```

**Block-level form.** A trailing `{.class1 .class2}` at the end of the inner text of an `<li>`, `<p>`, `<h1>`–`<h6>`, or `<blockquote>` is stripped and merged into that element's `class` attribute.

**Inline form.** `[text]{.class}` becomes `<span class="class">text</span>`. CommonMark renders bare `[text]` as literal text (no link, since there is no `(url)` or reference def), so this is unambiguous.

**Multi-class.** `{.fragment .highlight}` is supported — whitespace-separated tokens, each starting with `.`.

**Malformed markers.** `{fragment}` (no leading dot), `{.123}` (non-identifier), or `{.fragment` (no close) pass through to the rendered HTML untouched. Authors will see the marker on screen and notice the mistake.

Only `.fragment` is wired into runtime behavior in this iteration; the parser is generic over class names so authors can co-locate styling classes (e.g. `{.fragment .highlight}`) without further build work.

## Runtime behavior

### New file: `script/fragments.js`

A capture-phase `keydown` listener on `document`, mirroring the pattern in `script/vega.js` and `script/three.js`.

- **Forward keys** (`ArrowRight`, `PageDown`, `Space`, `n`): find the first `.fragment:not(.is-revealed)` on the active slide in DOM order. If one exists, add `.is-revealed` to it, then `e.preventDefault()` + `e.stopPropagation()`. Otherwise return without consuming — the event flows on to vega.js → three.js → deck.js.
- **Backward keys** (`ArrowLeft`, `PageUp`, `p`): find the last `.fragment.is-revealed` on the active slide. If one exists, remove `.is-revealed`, consume the event. Otherwise pass through.

The active slide is `document.querySelector('.slide.is-current')`, same selector vega.js uses.

### Listener registration order

Capture-phase listeners fire in the order they were registered. To get fragments-before-vega resolution:

- `fragments.js` `<script>` tag is emitted **before** the vega and three.js script tags in `bin/build.js`.
- Each script registers its capture listener at top-level, so registration order follows script order.

This puts fragments innermost in the chain: fragments consume first, then vega step lists, then three stages, then deck.js advances the slide.

### Slide-entry direction

Fragment state resets on every slide change. To support "backward enters fully revealed, forward enters hidden":

- `script/deck.js` is extended to track the previous index inside `show(i)`:
  - Index increased by 1 → `direction = 'forward'`
  - Index decreased by 1 → `direction = 'backward'`
  - Any other change (hash navigation, `Home`/`End`, initial load, multi-step skip) → `direction = 'jump'`
- After applying `.is-current`, `deck.js` dispatches `new CustomEvent('slide:enter', { detail: { direction, index, slide } })` on `document`.

`fragments.js` listens for `slide:enter` and:

- `'forward'` or `'jump'` → remove `.is-revealed` from every `.fragment` inside `detail.slide` (start hidden).
- `'backward'` → add `.is-revealed` to every `.fragment` inside `detail.slide` (enter fully revealed).

`deck.js` dispatches the event whether or not fragments are present, keeping it decoupled. Other future runtimes (e.g. resetting Vega step indices on re-entry) could subscribe.

## CSS

Added to `style/deck.css`:

```css
.fragment { visibility: hidden; opacity: 0; transition: opacity 200ms ease; }
.fragment.is-revealed { visibility: visible; opacity: 1; }
```

`visibility: hidden` preserves layout: a hidden `<li>` keeps its bullet slot, an inline `<span>` reserves its width, so revealing items does not shift surrounding content. The opacity transition gives a soft fade without being showy.

## Build changes (`bin/build.js`)

One new pure helper, placed above `renderSlide`:

```js
function applyFragmentAttrs(html) { ... }
```

It runs on the HTML string returned by `marked.parse(body)` inside `renderSlide`, before the slide chrome is wrapped around it. Two ordered passes:

A shared `parseAttrList(raw)` helper takes the contents of a `{...}` marker and returns the class tokens (split on whitespace; each token must match `\.[\w-]+`, leading dot stripped). If any token is malformed, the helper returns `null` and the caller leaves the source untouched.

1. **Inline pass.** Regex over the HTML matching `\[([^\]\n]+)\]\{([^}]+)\}` (outside of HTML tags), replaced with `<span class="...">text</span>` when `parseAttrList` accepts the inner content. Non-conforming markers (e.g. `{fragment}`, `{.123}`) are left in place.
2. **Block pass.** Regex matching `\s*\{([^}]+)\}\s*</(li|p|h[1-6]|blockquote)>` to detect a trailing marker just before a closing block tag. For each match where `parseAttrList` accepts, locate the matching opening tag (the most recent unclosed opener of the same name before the marker) and merge the class tokens into its `class=` attribute — creating one if absent, appending if present.

Implementation notes:

- The block pass uses a small balanced scan rather than a single regex, because matching the *correct* opening tag in the presence of nesting (e.g. an `<li>` containing a `<p>`) needs awareness of tag depth. A simple per-block-name counter walking backwards from the marker position is sufficient — no general HTML parser needed.
- Both passes operate on the string in-place. No `cheerio` / DOM dep. Matches the existing `bin/build.js` style (string manipulation; `marked` is the one runtime dep).
- `escapeHtml` is unaffected — `applyFragmentAttrs` operates on already-rendered HTML where the user-supplied `text` inside `[text]{.fragment}` has already been escaped by `marked`.

## `script/deck.js` changes

Minimal, scoped to `show(i)`:

```js
function show(i) {
  const previous = current;
  current = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, n) => s.classList.toggle('is-current', n === current));
  const slide = slides[current];
  const id = slide.id || String(current + 1);
  if (location.hash !== `#${id}`) {
    history.replaceState(null, '', `#${id}`);
  }
  const direction =
    previous === current ? 'jump'
    : current === previous + 1 ? 'forward'
    : current === previous - 1 ? 'backward'
    : 'jump';
  document.dispatchEvent(new CustomEvent('slide:enter', {
    detail: { direction, index: current, slide }
  }));
}
```

The initial `show(fromHash())` call at the bottom dispatches with `direction: 'jump'` (since `previous === current === 0` when starting on slide 1, or both indices match on a deep-link). That's the desired behavior — initial load starts with fragments hidden.

## Tests

Added to `test/build.test.js`, appended at the bottom:

- inline `[x]{.fragment}` → `<span class="fragment">x</span>`
- inline multi-class `[x]{.fragment .highlight}` → `<span class="fragment highlight">x</span>`
- block trailing `{.fragment}` on `<li>`, `<p>`, `<h2>`, `<blockquote>`
- block multi-class merged when the element already has classes (rare in practice but tested for correctness)
- nested case: `<li>` containing a `<p>` with `{.fragment}` — the class goes on the `<p>`, not the `<li>`
- malformed markers pass through: `{fragment}` (no dot), `{.fragment` (no close), `{.123}` (non-identifier)
- integration: a slide-string with one fragment list renders with `class="fragment"` on the expected `<li>` elements

No browser-side runtime tests — same precedent as `vega.js` and `three.js`, which are exercised manually on the example deck.

## Documentation

- `README.md`: new "Fragments" subsection under authoring, with the markdown examples above and a one-line note about forward/backward entry behavior.
- `CLAUDE.md`: one paragraph in the architecture section pointing at `script/fragments.js`, the `slide:enter` event contract on `document`, and the listener registration order (fragments → vega → three → deck).
- Demo: add a fragment example to `talks/2026-05-example/slides.md` (the canonical reference deck) so the feature is exercised by the example.

## Out of scope (YAGNI)

- Fragment variants (`fade-out`, `highlight-current-blue`, `grow`, `shrink`). Only the base `.fragment` is wired into runtime behavior. Authors who want a one-off effect can add their own class alongside (`{.fragment .my-style}`) and style it in their deck's CSS.
- Explicit `data-fragment-index` for non-DOM ordering. Defer until a real slide demands it.
- Cross-slide fragment groups.
- Resetting Vega step lists on slide re-entry. Existing behavior (charts retain their last step when navigating away and back) is preserved. The `slide:enter` event is now available if a future change wants to wire this.

## File changes summary

| File | Change |
|---|---|
| `bin/build.js` | New `applyFragmentAttrs(html)` helper above `renderSlide`; called from `renderSlide` after `marked.parse`. New `<script>` tag emitted before vega and three scripts. |
| `script/fragments.js` | **New.** Capture-phase keydown listener; `slide:enter` listener; per-slide reveal/hide logic. |
| `script/deck.js` | `show(i)` tracks previous index and dispatches `slide:enter` with direction. |
| `style/deck.css` | Two CSS rules for `.fragment` and `.fragment.is-revealed`. |
| `test/build.test.js` | New tests appended for `applyFragmentAttrs` (inline, block, multi-class, malformed, nested, integration). |
| `README.md` | "Fragments" subsection. |
| `CLAUDE.md` | One paragraph on `fragments.js` + `slide:enter` contract + listener order. |
| `talks/2026-05-example/slides.md` | Demo slide using fragments. |
