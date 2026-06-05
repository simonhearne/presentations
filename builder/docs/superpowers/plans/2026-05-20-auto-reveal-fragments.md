# Auto-advancing Fragment Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-slide `.auto-reveal` opt-in that plays a slide's fragment reveals on a timer instead of one keypress each.

**Architecture:** The slide attribute block (`{.foo .bar}`) is widened to also parse pandoc `key=value` pairs. A `.auto-reveal` slide carries `delay` and `start` settings, which the build emits as `data-autoreveal-*` attributes on the `<section>`. The existing fragment runtime (`script/fragments.js`) reads those attributes and drives the existing `.fragment` / `is-revealed` reveal mechanism on a `setTimeout` loop, with a small per-slide state machine for the start trigger and manual cancellation.

**Tech Stack:** Node.js (ESM, `marked`), Node's built-in test runner (`node:test`), vanilla browser JS.

**Spec:** `docs/superpowers/specs/2026-05-20-auto-reveal-fragments-design.md`

---

## File Structure

- `bin/build.js` — Modify: `ATTR_RE` and `parseAttrs` parse `key=value`; new `autoRevealAttrs` helper; `renderSlide` emits the data attributes.
- `script/fragments.js` — Modify: add the timed-reveal state machine to the existing runtime.
- `talks/example/slides.md` — Modify: add an `.auto-reveal` demo slide to the canonical reference deck.
- `README.md` — Modify: document `.auto-reveal` under the "Fragments" section.
- `test/build.test.js` — Modify: append tests for the new parsing and rendering.

---

## Task 1: Parse `key=value` pairs in the slide attribute block

**Files:**
- Modify: `bin/build.js:53` (`ATTR_RE`), `bin/build.js:55-65` (`parseAttrs`)
- Test: `test/build.test.js` (append at end of file)

- [ ] **Step 1: Write the failing tests**

Append to the end of `test/build.test.js`:

```js
test('parseAttrs: parses key=value pairs into attrs', () => {
  const r = parseAttrs('{.auto-reveal delay=800 start=immediate}\n# X');
  assert.deepEqual(r.classes, ['auto-reveal']);
  assert.deepEqual(r.attrs, { delay: '800', start: 'immediate' });
  assert.equal(r.body.trim(), '# X');
});

test('parseAttrs: classes-only block yields empty attrs', () => {
  const r = parseAttrs('{.hero .center}\n# X');
  assert.deepEqual(r.classes, ['hero', 'center']);
  assert.deepEqual(r.attrs, {});
});

test('parseAttrs: no attribute line yields empty attrs', () => {
  const r = parseAttrs('# Plain content');
  assert.deepEqual(r.attrs, {});
});

test('parseAttrs: ignores a brace line that is not valid attrs', () => {
  const r = parseAttrs('{not an attr}\n# X');
  assert.deepEqual(r.classes, []);
  assert.deepEqual(r.attrs, {});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — the new `parseAttrs` tests error because `r.attrs` is `undefined` (`deepEqual` against `{}` / an object fails).

- [ ] **Step 3: Widen `ATTR_RE`**

In `bin/build.js`, replace line 53:

```js
const ATTR_RE = /^\{(\.[\w-]+(?:\s+\.[\w-]+)*)\}\s*$/;
```

with:

```js
const ATTR_RE = /^\{((?:\.[\w-]+|[\w-]+=[^\s}]+)(?:\s+(?:\.[\w-]+|[\w-]+=[^\s}]+))*)\}\s*$/;
```

Each token is now either a `.class` or a `key=value` pair (unquoted value, no whitespace). A line whose tokens are not all valid (e.g. `{not an attr}`) still fails to match, so it is left in the body — unchanged behavior.

- [ ] **Step 4: Update `parseAttrs` to split classes and attrs**

In `bin/build.js`, replace the whole `parseAttrs` function (lines 55-65):

```js
export function parseAttrs(chunk) {
  const lines = chunk.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return { classes: [], attrs: {}, body: chunk };
  const m = lines[i].match(ATTR_RE);
  if (!m) return { classes: [], attrs: {}, body: chunk };
  const classes = [];
  const attrs = {};
  for (const tok of m[1].split(/\s+/)) {
    if (tok.startsWith('.')) {
      classes.push(tok.slice(1));
    } else {
      const eq = tok.indexOf('=');
      attrs[tok.slice(0, eq)] = tok.slice(eq + 1);
    }
  }
  const body = lines.slice(i + 1).join('\n');
  return { classes, attrs, body };
}
```

`attrs` is additive — existing callers that destructure only `classes`/`body` are unaffected.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests, including the four new `parseAttrs` tests and the pre-existing `parseAttrs` / `renderSlide` tests.

- [ ] **Step 6: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): parse key=value pairs in slide attribute blocks

Pandoc attribute blocks may now carry key=value pairs alongside
classes. parseAttrs returns a new additive `attrs` object.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Emit `data-autoreveal-*` attributes for `.auto-reveal` slides

**Files:**
- Modify: `bin/build.js` (new `autoRevealAttrs` helper above `renderSlide`; `renderSlide` body)
- Test: `test/build.test.js` (append at end of file)

- [ ] **Step 1: Write the failing tests**

Append to the end of `test/build.test.js`:

```js
test('renderSlide: emits autoreveal data attributes', () => {
  const html = renderSlide({ chunk: '{.auto-reveal delay=800 start=immediate}\n# X', index: 1, total: 2 });
  assert.match(html, /class="slide auto-reveal"/);
  assert.match(html, /data-autoreveal-delay="800"/);
  assert.match(html, /data-autoreveal-start="immediate"/);
});

test('renderSlide: autoreveal defaults to 1000ms and cue start', () => {
  const html = renderSlide({ chunk: '{.auto-reveal}\n# X', index: 1, total: 2 });
  assert.match(html, /data-autoreveal-delay="1000"/);
  assert.match(html, /data-autoreveal-start="cue"/);
});

test('renderSlide: autoreveal clamps non-positive delay to default', () => {
  const html = renderSlide({ chunk: '{.auto-reveal delay=0}\n# X', index: 1, total: 2 });
  assert.match(html, /data-autoreveal-delay="1000"/);
});

test('renderSlide: autoreveal rejects an unknown start value', () => {
  const html = renderSlide({ chunk: '{.auto-reveal start=whenever}\n# X', index: 1, total: 2 });
  assert.match(html, /data-autoreveal-start="cue"/);
});

test('renderSlide: non-autoreveal slide emits no autoreveal attributes', () => {
  const html = renderSlide({ chunk: '{.hero}\n# X', index: 1, total: 2 });
  assert.doesNotMatch(html, /data-autoreveal/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — the four positive tests fail because no `data-autoreveal-*` attributes are emitted yet.

- [ ] **Step 3: Add the `autoRevealAttrs` helper**

In `bin/build.js`, immediately above the `renderSlide` function (currently line 509), add:

```js
function autoRevealAttrs(classes, attrs) {
  if (!classes.includes('auto-reveal')) return '';
  const delay = parseInt(attrs.delay, 10);
  const safeDelay = Number.isInteger(delay) && delay > 0 ? delay : 1000;
  const start = attrs.start === 'immediate' ? 'immediate' : 'cue';
  return ` data-autoreveal-delay="${safeDelay}" data-autoreveal-start="${start}"`;
}
```

`safeDelay` is a coerced positive integer and `start` is one of two literals, so the output is fully controlled — no escaping needed.

- [ ] **Step 4: Wire it into `renderSlide`**

In `bin/build.js`, in `renderSlide`, change the destructuring line (currently line 510):

```js
  const { classes, body } = parseAttrs(chunk);
```

to:

```js
  const { classes, attrs, body } = parseAttrs(chunk);
```

Then change the `return` line (currently line 548):

```js
  return `<section id="${index}-${slug}" class="${classList}" data-index="${index}">\n${html}\n${speakers}\n${chrome}\n${footer}\n</section>`;
```

to:

```js
  return `<section id="${index}-${slug}" class="${classList}" data-index="${index}"${autoRevealAttrs(classes, attrs)}>\n${html}\n${speakers}\n${chrome}\n${footer}\n</section>`;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests, including the five new `renderSlide` tests.

- [ ] **Step 6: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): emit data-autoreveal attributes for .auto-reveal slides

A slide with the .auto-reveal class gets data-autoreveal-delay and
data-autoreveal-start on its <section>, defaulting to 1000ms / cue.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add an `.auto-reveal` demo slide to the example deck

**Files:**
- Modify: `talks/example/slides.md` (insert a slide after the "Fragments demo" slide)

- [ ] **Step 1: Add the demo slide**

In `talks/example/slides.md`, find this block (lines 97-101):

```markdown
A paragraph with [a highlighted phrase]{.fragment} revealed inline.

---

{.hero .no-chrome}
```

Replace it with:

```markdown
A paragraph with [a highlighted phrase]{.fragment} revealed inline.

---

{.auto-reveal delay=900}
## Auto-reveal demo

- This point is visible on entry
- Press ArrowRight once to reveal this {.fragment}
- ...then the rest follow automatically, every 900ms {.fragment}
- Press any arrow key to cancel and step manually {.fragment}

---

{.hero .no-chrome}
```

- [ ] **Step 2: Build the example deck**

Run: `npm run build talks/example`
Expected: build succeeds, writes `talks/example/dist/index.html`.

- [ ] **Step 3: Verify the data attributes reached the output**

Run: `grep -o 'data-autoreveal-[a-z]*="[^"]*"' talks/example/dist/index.html`
Expected output (two lines):

```
data-autoreveal-delay="900"
data-autoreveal-start="cue"
```

- [ ] **Step 4: Commit**

```bash
git add talks/example/slides.md
git commit -m "$(cat <<'EOF'
docs(example): add auto-reveal demo slide

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Drive timed reveals in the fragment runtime + document the feature

**Files:**
- Modify: `script/fragments.js` (full rewrite of the IIFE)
- Modify: `README.md` (append an "Auto-advancing reveals" subsection to the Fragments section)

Note: `script/fragments.js` is browser runtime with no existing unit-test
coverage (the test suite covers `bin/build.js` and `bin/bundle.js` only).
This task is verified by `npm test` (no regressions) plus manual checks in a
built deck — consistent with the current setup.

- [ ] **Step 1: Rewrite `script/fragments.js`**

Replace the entire contents of `script/fragments.js` with:

```js
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

  // Auto-reveal: a per-slide state machine drives timed fragment reveals.
  // States: idle | armed (waiting for first manual reveal) | running | cancelled | done
  let autoTimer = null;
  let autoState = 'idle';

  function cancelAuto() {
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function scheduleNext(delay) {
    autoTimer = setTimeout(() => {
      autoTimer = null;
      if (stepFragments(1)) {
        scheduleNext(delay);
      } else {
        autoState = 'done';
      }
    }, delay);
  }

  function startAuto(slide) {
    const delay = parseInt(slide.dataset.autorevealDelay, 10);
    if (!Number.isInteger(delay) || delay <= 0) return;
    autoState = 'running';
    scheduleNext(delay);
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
    if (autoState === 'running') {
      cancelAuto();
      autoState = 'cancelled';
    }
    if (stepFragments(direction)) {
      if (direction > 0 && autoState === 'armed') {
        startAuto(activeSlide());
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onSlideEnter(e) {
    const { direction, slide } = e.detail || {};
    if (!slide) return;
    cancelAuto();
    autoState = 'idle';
    const frags = fragmentsOn(slide);
    if (direction === 'backward') {
      frags.forEach(el => el.classList.add('is-revealed'));
      return;
    }
    frags.forEach(el => el.classList.remove('is-revealed'));
    if (slide.classList.contains('auto-reveal')) {
      if (slide.dataset.autorevealStart === 'immediate') {
        startAuto(slide);
      } else {
        autoState = 'armed';
      }
    }
  }

  document.addEventListener('keydown', onKeyCapture, true);
  document.addEventListener('slide:enter', onSlideEnter);
})();
```

What changed from the original: `stepFragments`, `onKeyCapture`'s key
mapping, and `onSlideEnter`'s reveal/hide logic are unchanged. Added: the
`autoTimer`/`autoState` pair, `cancelAuto`/`scheduleNext`/`startAuto`, the
`running`→`cancelled` cancellation at the top of `onKeyCapture`, the
`armed`→`running` start after a first manual reveal, and the
`immediate`/`cue` branch at the end of `onSlideEnter`.

- [ ] **Step 2: Run the test suite to confirm no regressions**

Run: `npm test`
Expected: PASS — no test changes in this task; this confirms the build still
works end-to-end.

- [ ] **Step 3: Build the example deck and open it**

Run: `npm run build talks/example`
Then open `talks/example/dist/index.html` in a browser and navigate to the
"Auto-reveal demo" slide (use the on-page nav or `#`-deeplink).

- [ ] **Step 4: Manually verify the behavior**

On the "Auto-reveal demo" slide, confirm:

1. On entry, only "This point is visible on entry" shows; the timer has not started.
2. Press ArrowRight once → the second bullet reveals immediately.
3. Without further input, the third bullet appears ~900ms later, then the fourth ~900ms after that.
4. Re-enter the slide (ArrowLeft to the previous slide, then ArrowRight back). Press ArrowRight to begin the auto sequence, then press ArrowRight again while it is running → the sequence stops and the remaining bullets only advance on each keypress.
5. Re-enter the slide one more time and immediately ArrowLeft past it and back (ArrowRight) — entering backward shows all bullets at once with no timer.

Optionally: edit the demo slide's attribute block to `{.auto-reveal start=immediate delay=900}`, rebuild, and confirm the bullets reveal on a timer with no initial keypress. Revert the edit afterward.

- [ ] **Step 5: Document the feature in the README**

In `README.md`, find the end of the Fragments section — the paragraph ending
with "...Fragments are revealed in DOM order before the slide advances."
(currently line 199), immediately before `## Iframe embeds`.

Insert this subsection between that paragraph and `## Iframe embeds`:

````markdown

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
````

- [ ] **Step 6: Commit**

```bash
git add script/fragments.js README.md
git commit -m "$(cat <<'EOF'
feat(fragments): auto-advance fragment reveals on a timer

.auto-reveal slides play their reveals on a setTimeout loop. A small
per-slide state machine handles the cue/immediate start modes and
cancels on the first manual key while the timer runs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**

- Authoring syntax (`.auto-reveal`, `delay`, `start`) — Tasks 1-2 (parsing + data attributes), documented in Task 4 Step 5.
- `delay` default 1000, positive-integer validation — Task 2 `autoRevealAttrs` + tests.
- `start=immediate` vs default `cue` — Task 2 `autoRevealAttrs` + Task 4 `onSlideEnter`.
- Start modes (immediate timer on entry; cue starts after first manual reveal) — Task 4 `startAuto` / `onSlideEnter` / `onKeyCapture` (`armed`→`running`).
- End behavior (stop on last fragment, no deck advance) — Task 4 `scheduleNext` sets `done` when `stepFragments` returns false; nothing calls `show`.
- Manual override (any nav key cancels while running; the key still acts) — Task 4 `onKeyCapture` cancels before `stepFragments`.
- Backward navigation reveals all, no timer — Task 4 `onSlideEnter` `direction === 'backward'` branch.
- State machine (`armed`/`running`/`cancelled`/`done`) — Task 4.
- Timer cleared on slide change — Task 4 `onSlideEnter` calls `cancelAuto()` first.
- Tests for `parseAttrs` and `renderSlide` — Tasks 1-2.
- README + example deck — Tasks 3-4.

**Placeholder scan:** No TBD/TODO; every code step shows complete code.

**Type consistency:** `autoRevealAttrs(classes, attrs)` matches the `parseAttrs` return shape from Task 1. Data attribute names `data-autoreveal-delay` / `data-autoreveal-start` (Task 2) map to `dataset.autorevealDelay` / `dataset.autorevealStart` (Task 4) — the standard camelCase conversion. `autoState` values (`idle`/`armed`/`running`/`cancelled`/`done`) are used consistently across `onKeyCapture` and `onSlideEnter`.
