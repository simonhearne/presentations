# HTML/MD Fragments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reveal.js-style `.fragment` incremental reveals for HTML/MD elements, parsed via pandoc-style `{.fragment}` markers and stepped by ArrowRight before the slide advances.

**Architecture:** A new `applyFragmentAttrs(html)` helper in `bin/build.js` strips trailing `{.class}` markers from rendered HTML and merges classes into the parent block (or wraps inline `[text]{.class}` in a `<span>`). A new `script/fragments.js` runtime registers a capture-phase keydown listener that reveals/hides `.fragment` elements on the current slide. `script/deck.js` is extended to dispatch a `slide:enter` CustomEvent with `direction` so the fragment runtime can reset state on forward entry and pre-reveal on backward entry.

**Tech Stack:** Node.js (ESM), `marked` (existing dep), Node's built-in test runner, plain browser JS.

**Spec:** [docs/superpowers/specs/2026-05-18-html-fragments-design.md](../specs/2026-05-18-html-fragments-design.md)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `bin/build.js` | Modify | Add `parseAttrList`, `applyFragmentAttrs` helpers above `renderSlide`; call from `renderSlide` after `marked.parse`; emit `<script src=".../fragments.js">` from `buildDeck`. |
| `test/build.test.js` | Modify | Append tests for `parseAttrList` and `applyFragmentAttrs` (inline, block, multi-class, malformed, nested, integration). |
| `script/fragments.js` | Create | Capture-phase keydown listener; `slide:enter` listener; per-slide reveal/hide. |
| `script/deck.js` | Modify | Track previous index in `show(i)`; dispatch `slide:enter` CustomEvent with direction. |
| `templates/deck.html` | Modify | Add `<script src="{{scriptDir}}/fragments.js"></script>` between `deck.js` and `{{vegaScripts}}`. |
| `css/deck.css` | Modify | Add `.fragment` (hidden) and `.fragment.is-revealed` (visible) rules. |
| `talks/2026-05-example/slides.md` | Modify | Add a demo slide using fragments. |
| `README.md` | Modify | New "Fragments" subsection. |
| `CLAUDE.md` | Modify | One paragraph on `fragments.js`, `slide:enter` contract, listener registration order. |

---

## Task 1: `parseAttrList` helper

**Files:**
- Modify: `bin/build.js` (add helper above `renderSlide`)
- Test: `test/build.test.js` (append)

- [ ] **Step 1: Write failing tests**

Append to `test/build.test.js`. Add `parseAttrList` to the import on line 3.

```javascript
test('parseAttrList: returns class tokens with leading dots stripped', () => {
  assert.deepEqual(parseAttrList('.fragment'), ['fragment']);
});

test('parseAttrList: parses multiple classes separated by whitespace', () => {
  assert.deepEqual(parseAttrList('.fragment .highlight'), ['fragment', 'highlight']);
});

test('parseAttrList: tolerates extra whitespace', () => {
  assert.deepEqual(parseAttrList('  .fragment   .highlight  '), ['fragment', 'highlight']);
});

test('parseAttrList: returns null when any token lacks a leading dot', () => {
  assert.equal(parseAttrList('fragment'), null);
  assert.equal(parseAttrList('.fragment highlight'), null);
});

test('parseAttrList: returns null when any token is not [\\w-]+', () => {
  assert.equal(parseAttrList('.123'), null);
  assert.equal(parseAttrList('.frag ment'), null);
  assert.equal(parseAttrList('.frag.ment'), null);
});

test('parseAttrList: returns null on empty input', () => {
  assert.equal(parseAttrList(''), null);
  assert.equal(parseAttrList('   '), null);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="parseAttrList"`
Expected: FAIL with `parseAttrList is not defined` (or undefined export).

- [ ] **Step 3: Implement `parseAttrList` in `bin/build.js`**

Add just above the `function escapeHtml` declaration (around line 90, before `parseKvList`):

```javascript
export function parseAttrList(raw) {
  const tokens = String(raw).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const classes = [];
  for (const t of tokens) {
    if (!/^\.[\w-]+$/.test(t)) return null;
    classes.push(t.slice(1));
  }
  return classes;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --test-name-pattern="parseAttrList"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): add parseAttrList helper for pandoc-style class markers

Shared parser used by the upcoming applyFragmentAttrs pass. Returns
null on any malformed token so callers can leave the source untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `applyFragmentAttrs` — inline pass

**Files:**
- Modify: `bin/build.js` (add helper above `renderSlide`)
- Test: `test/build.test.js` (append)

- [ ] **Step 1: Write failing tests**

Append to `test/build.test.js`. Add `applyFragmentAttrs` to the import on line 3.

```javascript
test('applyFragmentAttrs: inline [text]{.fragment} becomes a span', () => {
  const input = '<p>A paragraph with [a revealed phrase]{.fragment} mid-sentence.</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(
    output,
    '<p>A paragraph with <span class="fragment">a revealed phrase</span> mid-sentence.</p>'
  );
});

test('applyFragmentAttrs: inline multi-class', () => {
  const input = '<p>[x]{.fragment .highlight}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<p><span class="fragment highlight">x</span></p>');
});

test('applyFragmentAttrs: inline pass leaves malformed markers untouched', () => {
  const input = '<p>[x]{fragment} [y]{.123} [z]{.frag ment}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, input);
});

test('applyFragmentAttrs: inline pass leaves bracketed text without marker alone', () => {
  const input = '<p>see [reference] for more</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, input);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="applyFragmentAttrs"`
Expected: FAIL with `applyFragmentAttrs is not defined`.

- [ ] **Step 3: Implement inline pass in `bin/build.js`**

Add directly below `parseAttrList`:

```javascript
const INLINE_FRAGMENT_RE = /\[([^\]\n]+)\]\{([^}\n]+)\}/g;

export function applyFragmentAttrs(html) {
  return html.replace(INLINE_FRAGMENT_RE, (match, text, attrs) => {
    const classes = parseAttrList(attrs);
    if (!classes) return match;
    return `<span class="${classes.join(' ')}">${text}</span>`;
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --test-name-pattern="applyFragmentAttrs"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): applyFragmentAttrs inline pass

Replaces [text]{.class} markers with <span class="class">text</span>.
Malformed markers (no leading dot, non-identifier tokens) pass through
untouched so authors notice them in the rendered output.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `applyFragmentAttrs` — block pass

**Files:**
- Modify: `bin/build.js`
- Test: `test/build.test.js` (append)

- [ ] **Step 1: Write failing tests**

Append to `test/build.test.js`:

```javascript
test('applyFragmentAttrs: block trailing {.fragment} on <li>', () => {
  const input = '<ul>\n<li>First</li>\n<li>Second {.fragment}</li>\n<li>Third {.fragment}</li>\n</ul>';
  const output = applyFragmentAttrs(input);
  assert.equal(
    output,
    '<ul>\n<li>First</li>\n<li class="fragment">Second</li>\n<li class="fragment">Third</li>\n</ul>'
  );
});

test('applyFragmentAttrs: block trailing {.fragment} on <p>', () => {
  const input = '<p>A late paragraph {.fragment}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<p class="fragment">A late paragraph</p>');
});

test('applyFragmentAttrs: block trailing {.fragment} on <h2>', () => {
  const input = '<h2>A late heading {.fragment}</h2>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<h2 class="fragment">A late heading</h2>');
});

test('applyFragmentAttrs: block trailing {.fragment} on <blockquote>', () => {
  const input = '<blockquote>\n<p>Late quote</p>\n {.fragment}</blockquote>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<blockquote class="fragment">\n<p>Late quote</p>\n</blockquote>');
});

test('applyFragmentAttrs: block multi-class merges into existing class attribute', () => {
  const input = '<p class="lead">Intro {.fragment .highlight}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<p class="lead fragment highlight">Intro</p>');
});

test('applyFragmentAttrs: block pass attaches class to innermost matching block', () => {
  // a <li> containing a <p> with {.fragment} — class goes on the <p>, not <li>
  const input = '<ul>\n<li>\n<p>Nested {.fragment}</p>\n</li>\n</ul>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<ul>\n<li>\n<p class="fragment">Nested</p>\n</li>\n</ul>');
});

test('applyFragmentAttrs: block pass leaves malformed markers untouched', () => {
  const input = '<p>fine {fragment}</p><p>also fine {.123}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, input);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="applyFragmentAttrs: block"`
Expected: FAIL (each new block test fails — current implementation has inline only).

- [ ] **Step 3: Implement block pass in `bin/build.js`**

Extend `applyFragmentAttrs` (replace the existing function with the version below). The block pass runs **after** the inline pass so inline spans inside block content are already resolved.

```javascript
const INLINE_FRAGMENT_RE = /\[([^\]\n]+)\]\{([^}\n]+)\}/g;
const BLOCK_FRAGMENT_RE = /\s*\{([^}\n]+)\}\s*<\/(li|p|h[1-6]|blockquote)>/g;
const OPEN_TAG_RE = name => new RegExp(`<${name}(\\s[^>]*)?>`, 'g');

function mergeClassesIntoOpenTag(html, openIndex, classes) {
  // openIndex points at the '<' of an opening tag matched by OPEN_TAG_RE.
  const end = html.indexOf('>', openIndex);
  if (end === -1) return html;
  const tag = html.slice(openIndex, end);  // e.g. '<p class="lead"'  or  '<li'
  const attrMatch = tag.match(/\sclass="([^"]*)"/);
  let replaced;
  if (attrMatch) {
    const merged = (attrMatch[1] + ' ' + classes.join(' ')).trim();
    replaced = tag.replace(/\sclass="[^"]*"/, ` class="${merged}"`);
  } else {
    replaced = tag + ` class="${classes.join(' ')}"`;
  }
  return html.slice(0, openIndex) + replaced + html.slice(end);
}

function findMatchingOpener(html, closeIndex, name) {
  // Walk backwards from closeIndex finding the most recent unclosed
  // opening tag of `name`, accounting for nesting depth.
  const openRe = new RegExp(`<${name}(?:\\s[^>]*)?>`, 'g');
  const closeRe = new RegExp(`</${name}>`, 'g');
  const opens = [];
  let m;
  openRe.lastIndex = 0;
  while ((m = openRe.exec(html)) && m.index < closeIndex) opens.push(m.index);
  const closes = [];
  closeRe.lastIndex = 0;
  while ((m = closeRe.exec(html)) && m.index < closeIndex) closes.push(m.index);
  // Pair them: each close consumes the most recent unconsumed open.
  const stack = [];
  let oi = 0, ci = 0;
  while (oi < opens.length || ci < closes.length) {
    const o = oi < opens.length ? opens[oi] : Infinity;
    const c = ci < closes.length ? closes[ci] : Infinity;
    if (o < c) { stack.push(o); oi++; }
    else { stack.pop(); ci++; }
  }
  return stack.length ? stack[stack.length - 1] : -1;
}

export function applyFragmentAttrs(html) {
  let out = html.replace(INLINE_FRAGMENT_RE, (match, text, attrs) => {
    const classes = parseAttrList(attrs);
    if (!classes) return match;
    return `<span class="${classes.join(' ')}">${text}</span>`;
  });

  // Block pass: iterate markers from rightmost to leftmost so earlier
  // mutations don't invalidate indices of later matches.
  const matches = [];
  let m;
  BLOCK_FRAGMENT_RE.lastIndex = 0;
  while ((m = BLOCK_FRAGMENT_RE.exec(out)) !== null) {
    matches.push({ index: m.index, length: m[0].length, attrs: m[1], name: m[2] });
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const { index, length, attrs, name } = matches[i];
    const classes = parseAttrList(attrs);
    if (!classes) continue;
    const openIndex = findMatchingOpener(out, index, name);
    if (openIndex === -1) continue;
    // Strip marker (keep the closing tag).
    const closeStart = index + length - (`</${name}>`).length;
    out = out.slice(0, index) + out.slice(closeStart);
    out = mergeClassesIntoOpenTag(out, openIndex, classes);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --test-name-pattern="applyFragmentAttrs"`
Expected: PASS (all 11 tests — 4 inline + 7 block).

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): applyFragmentAttrs block pass

Strips trailing {.class} markers from <li>, <p>, <h1..6>, <blockquote>
and merges the classes into the matching opening tag. Walks tag depth
so a marker inside a nested <p> attaches to the <p>, not the parent <li>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire `applyFragmentAttrs` into `renderSlide`

**Files:**
- Modify: `bin/build.js` (line ~432, inside `renderSlide`)
- Test: `test/build.test.js` (append integration test)

- [ ] **Step 1: Write failing integration test**

Append to `test/build.test.js`:

```javascript
test('renderSlide: fragments applied to list items', () => {
  const chunk = '# Bullets\n\n- First\n- Second {.fragment}\n- Third {.fragment}';
  const html = renderSlide({ chunk, index: 1, total: 1 });
  assert.match(html, /<li>First<\/li>/);
  assert.match(html, /<li class="fragment">Second<\/li>/);
  assert.match(html, /<li class="fragment">Third<\/li>/);
});

test('renderSlide: inline fragment span inside paragraph', () => {
  const chunk = '# x\n\nA paragraph with [a phrase]{.fragment} mid-sentence.';
  const html = renderSlide({ chunk, index: 1, total: 1 });
  assert.match(html, /<span class="fragment">a phrase<\/span>/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="renderSlide: fragments|renderSlide: inline fragment"`
Expected: FAIL — `renderSlide` does not yet call `applyFragmentAttrs`.

- [ ] **Step 3: Wire `applyFragmentAttrs` into `renderSlide`**

In `bin/build.js`, modify `renderSlide` to apply fragment attributes after `marked.parse(body)` and before any placeholder substitution. Change:

```javascript
  const { classes, body } = parseAttrs(chunk);
  let html = marked.parse(body);
  const slug = slugify(extractTitle(html) || '');
```

to:

```javascript
  const { classes, body } = parseAttrs(chunk);
  let html = applyFragmentAttrs(marked.parse(body));
  const slug = slugify(extractTitle(html) || '');
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS — all existing tests still pass, both new tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): apply fragment attributes inside renderSlide

Runs applyFragmentAttrs on the marked output before placeholder
substitution so fragments work on every authored block.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Dispatch `slide:enter` event from `deck.js`

**Files:**
- Modify: `script/deck.js`

There are no automated tests for this file (browser-only runtime, same precedent as `vega.js`/`three.js`). Verify manually in Task 8.

- [ ] **Step 1: Update `show(i)` to track direction and dispatch event**

In `script/deck.js`, replace the existing `show` function (lines 17–25):

```javascript
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
      current === previous + 1 ? 'forward'
      : current === previous - 1 ? 'backward'
      : 'jump';
    document.dispatchEvent(new CustomEvent('slide:enter', {
      detail: { direction, index: current, slide }
    }));
  }
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS — no test changes touch this file.

- [ ] **Step 3: Commit**

```bash
git add script/deck.js
git commit -m "$(cat <<'EOF'
feat(deck): dispatch slide:enter event with direction

Lets capture-phase modules (fragments next, possibly vega resets later)
distinguish forward, backward, and jump transitions. Decoupled — the
event is dispatched whether or not a listener is present.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create `script/fragments.js` runtime

**Files:**
- Create: `script/fragments.js`

- [ ] **Step 1: Write the runtime**

Create `script/fragments.js` with the following content:

```javascript
// script/fragments.js — runtime for incremental .fragment reveals
(() => {
  function activeSlide() {
    return document.querySelector('.slide.is-current');
  }

  function fragmentsOn(slide) {
    return slide ? Array.from(slide.querySelectorAll('.fragment')) : [];
  }

  function stepFragments(direction) {
    const slide = activeSlide();
    if (!slide) return false;
    const frags = fragmentsOn(slide);
    if (direction > 0) {
      const next = frags.find(el => !el.classList.contains('is-revealed'));
      if (!next) return false;
      next.classList.add('is-revealed');
      return true;
    } else {
      const revealed = frags.filter(el => el.classList.contains('is-revealed'));
      if (revealed.length === 0) return false;
      revealed[revealed.length - 1].classList.remove('is-revealed');
      return true;
    }
  }

  function onKeyCapture(e) {
    if (e.defaultPrevented) return;
    let direction = 0;
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
      case 'n':
        direction = 1; break;
      case 'ArrowLeft':
      case 'PageUp':
      case 'p':
        direction = -1; break;
      default: return;
    }
    if (stepFragments(direction)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onSlideEnter(e) {
    const { direction, slide } = e.detail || {};
    if (!slide) return;
    const frags = fragmentsOn(slide);
    if (direction === 'backward') {
      frags.forEach(el => el.classList.add('is-revealed'));
    } else {
      frags.forEach(el => el.classList.remove('is-revealed'));
    }
  }

  document.addEventListener('keydown', onKeyCapture, true);
  document.addEventListener('slide:enter', onSlideEnter);
})();
```

- [ ] **Step 2: Commit**

```bash
git add script/fragments.js
git commit -m "$(cat <<'EOF'
feat(script): add fragments runtime for incremental reveals

Capture-phase keydown reveals/hides .fragment elements on the active
slide before the deck advances. Listens for slide:enter to reset
hidden on forward entry and pre-reveal on backward entry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire `fragments.js` into the template

**Files:**
- Modify: `templates/deck.html`

- [ ] **Step 1: Add the script tag**

In `templates/deck.html`, change line 21:

```html
  <script src="{{scriptDir}}/deck.js"></script>
```

to:

```html
  <script src="{{scriptDir}}/deck.js"></script>
  <script src="{{scriptDir}}/fragments.js"></script>
```

This places `fragments.js` before `{{vegaScripts}}` and `{{threeScripts}}`. Capture-phase listeners fire in registration order, so fragments will consume keypresses before vega/three step lists — matching the order decided in the design (`fragments → vega → three → deck`).

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS — template change only.

- [ ] **Step 3: Commit**

```bash
git add templates/deck.html
git commit -m "$(cat <<'EOF'
feat(template): include fragments.js after deck.js

Load order matters: fragments.js registers its capture-phase keydown
listener before vega.js and three.js so .fragment reveals consume
keypresses first, then vega step lists, then three stages, then the
deck advances.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `.fragment` CSS

**Files:**
- Modify: `css/deck.css`

- [ ] **Step 1: Append CSS rules**

Append to `css/deck.css` (at the bottom of the file):

```css
.fragment { visibility: hidden; opacity: 0; transition: opacity 200ms ease; }
.fragment.is-revealed { visibility: visible; opacity: 1; }
```

`visibility: hidden` (rather than `display: none`) keeps the element's box in the layout so revealing it does not shift surrounding content.

- [ ] **Step 2: Commit**

```bash
git add css/deck.css
git commit -m "$(cat <<'EOF'
feat(css): hide unrevealed .fragment elements

Uses visibility:hidden so reveals do not shift layout. Opacity
transition gives a soft fade.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Demo slide + manual verification

**Files:**
- Modify: `talks/2026-05-example/slides.md`

- [ ] **Step 1: Inspect the example deck to choose an insertion point**

Run: `cat talks/2026-05-example/slides.md | head -80`

Pick a list-bearing slide somewhere in the middle of the deck (or add a new slide before the closing one). The goal is to exercise both block and inline fragment forms.

- [ ] **Step 2: Add a fragments demo slide**

Insert a new slide block in `talks/2026-05-example/slides.md` at the chosen location, separated by `---` from its neighbours:

```markdown
{.center}
## Fragments demo

- First point is visible immediately
- Second point appears on ArrowRight {.fragment}
- Third point appears next {.fragment}

A paragraph with [a highlighted phrase]{.fragment} revealed inline.
```

- [ ] **Step 3: Build the deck**

Run: `npm run build talks/2026-05-example`
Expected: build succeeds. Confirm the generated `talks/2026-05-example/dist/index.html` contains `class="fragment"` on the expected `<li>` elements and `<span class="fragment">` for the inline phrase.

```bash
grep -c 'class="fragment"' talks/2026-05-example/dist/index.html
```

Expected: at least 4 (two `<li>`, one `<span>`, possibly one paragraph if present).

- [ ] **Step 4: Manual browser verification**

Open `talks/2026-05-example/dist/index.html` in a browser and navigate to the demo slide.

Verify:
- On entry, only the first bullet and surrounding text are visible (inline phrase reserves its width but is invisible).
- ArrowRight reveals the second bullet. ArrowRight again reveals the third. ArrowRight again reveals the inline phrase. One more ArrowRight advances to the next slide.
- ArrowLeft on the next slide enters the demo slide with all fragments already revealed.
- ArrowLeft on the demo slide un-reveals fragments in reverse order; one further ArrowLeft moves to the previous slide.
- Navigating away (e.g. to slide 1 via `#1-...` hash or by pressing Home) and re-entering the demo slide via ArrowRight starts with fragments hidden again.

If any of these fail, stop and diagnose — the runtime, deck event, or CSS is wrong.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add talks/2026-05-example/slides.md
git commit -m "$(cat <<'EOF'
docs(example): add fragments demo slide

Exercises block-level {.fragment} on list items and inline
[text]{.fragment} span syntax. Manual verification covers forward
reveal, backward pre-reveal on slide entry, and reset on jump.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Find the README authoring section**

Run: `grep -n "^##" README.md`

Identify the heading under which slide-authoring features are documented (likely "Slide authoring", "Authoring", or similar — same area where `authors`/`vega`/`dot`/`three` frontmatter blocks are described).

- [ ] **Step 2: Add a Fragments subsection to README.md**

Under the slide-authoring section in `README.md`, add:

```markdown
### Fragments (incremental reveals)

Mark any block or inline element to appear on a later ArrowRight rather
than with the slide. Uses pandoc-style trailing `{.fragment}` markers.

```markdown
- First point is visible immediately
- Second point appears on ArrowRight {.fragment}
- Third point appears next {.fragment}

A paragraph with [a highlighted phrase]{.fragment} revealed inline.

> Pull-quote that appears later {.fragment}

## A heading that comes in late {.fragment}
```

Block markers attach to the enclosing `<li>`, `<p>`, `<h1>`–`<h6>`, or
`<blockquote>`. Inline `[text]{.fragment}` is wrapped in a `<span>`.
Multiple classes are supported: `{.fragment .highlight}` lets you co-style
fragments with deck-specific CSS.

On forward navigation (ArrowRight from the previous slide, or hash/Home/End
jumps), fragments start hidden. On backward navigation (ArrowLeft from the
next slide), fragments enter fully revealed so you can backtrack naturally.
Fragments are revealed in DOM order before the slide advances.
```

(Match the surrounding heading depth — adjust `###` to `####` if necessary.)

- [ ] **Step 3: Add a paragraph to CLAUDE.md**

In `CLAUDE.md`, find the architecture section that describes the existing fenced-frontmatter blocks (vega, three, dot). Add a new paragraph near the `script/vega.js` mention:

```markdown
**Fragments** — Pandoc-style `{.fragment}` markers on block elements (`<li>`, `<p>`, `<h1>`–`<h6>`, `<blockquote>`) and inline `[text]{.fragment}` spans drive incremental reveals. `bin/build.js` runs `applyFragmentAttrs` on the rendered HTML to strip markers and merge classes; `script/fragments.js` registers a capture-phase keydown listener that reveals/hides on the active slide. `script/deck.js` dispatches a `slide:enter` CustomEvent on `document` with `detail: { direction, index, slide }` whenever the active slide changes, where `direction` is `'forward' | 'backward' | 'jump'`. Fragments listen and reset hidden on `forward`/`jump`, pre-reveal on `backward`. Capture-phase listener registration order in the template is `fragments → vega → three`, so fragments consume keypresses first.
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: fragments authoring + agent quick-start

README gets a Fragments subsection showing block + inline syntax and
the forward/backward entry behaviour. CLAUDE.md gets a one-paragraph
pointer at applyFragmentAttrs, fragments.js, the slide:enter event
contract, and the capture-phase listener registration order.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** all spec sections mapped — `parseAttrList` + inline pass (Tasks 1-2), block pass (Task 3), `renderSlide` wiring (Task 4), `slide:enter` event (Task 5), runtime (Task 6), template wiring (Task 7), CSS (Task 8), demo (Task 9), docs (Task 10). Out-of-scope items (fragment variants, `data-fragment-index`, cross-slide groups) explicitly excluded.
- **Type consistency:** `parseAttrList(raw) → string[] | null` referenced consistently. `applyFragmentAttrs(html) → string` consistent. CustomEvent detail shape `{ direction, index, slide }` matches between `deck.js` dispatcher and `fragments.js` listener. Direction values `'forward' | 'backward' | 'jump'` used consistently.
- **Path correction from spec:** CSS lives in `css/deck.css`, not `style/deck.css` as the spec mentioned. Plan uses the actual path.
- **Capture-phase order verified:** `script/vega.js:197` and `script/three.js:108` both register with `true` flag; `script/deck.js:101` registers without it. `fragments.js` script tag placed before `{{vegaScripts}}` in template guarantees registration-order precedence.
