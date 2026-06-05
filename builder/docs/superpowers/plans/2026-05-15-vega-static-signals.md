# Vega Static Signals + Trade-off Triangle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic `signal-<name>` vega frontmatter convention that seeds static signal values into a spec at load time, and use it to drive a stage-by-stage trade-off triangle visualization in the *vector-search-visualised* talk.

**Architecture:** The build layer already round-trips arbitrary vega frontmatter keys to `data-<key>` attributes on the chart div — no build changes needed beyond a lock-in test. The runtime (`script/vega.js`) gets a small extension: skip `signal-*` dataset entries when forwarding opts to `vegaEmbed`, then after the view resolves, set each as a named signal on the view (with a console warning for unknown signal names). A new `trade-off-triangle.json` spec describes all techniques as inline data with barycentric weights and a `stage` filter; the existing trade-off-triangle slide wires it up with `signal-stage: 1`.

**Tech Stack:** Node `node:test`, Vega 5 + vega-embed, ESM modules, plain HTML/JS deck runtime.

**Reference spec:** `docs/superpowers/specs/2026-05-15-vega-static-signals-design.md`

---

## File Structure

- `test/build.test.js` (modify, append) — one new test locking the `signal-stage: 1` → `data-signal-stage="1"` round trip.
- `script/vega.js` (modify) — add `SIGNAL_PREFIX`, filter signal keys out of `optionsFromDataset`, add `applySignals` and call it from `embedAll`.
- `talks/vector-search-visualised/trade-off-triangle.json` (create) — the new spec.
- `talks/vector-search-visualised/slides.md` (modify, line ~210) — replace the `<!-- VIS: -->` placeholder with a `\`\`\`vega` block.
- `README.md` (modify) — new paragraph under the vega frontmatter section.
- `CLAUDE.md` (modify) — single sentence in the vega frontmatter paragraph.

---

## Task 1: Lock the `signal-<name>` round-trip in the build tests

**Files:**
- Test: `test/build.test.js` (append after the existing `renderVega:` tests around line 555)

- [ ] **Step 1: Write the failing test**

Append after the last existing `renderVega` test in `test/build.test.js`:

```javascript
test('renderVega: signal-<name> entries become data-signal-<name> attributes', () => {
  const html = renderVega([
    { spec: 'tri.json', 'signal-stage': 1, 'signal-k': 8 },
  ], 'slug');
  assert.match(html, /data-signal-stage="1"/);
  assert.match(html, /data-signal-k="8"/);
});
```

- [ ] **Step 2: Run test and confirm it passes**

Run: `npm test -- --test-name-pattern="signal-<name>"`

Expected: PASS (the existing `renderVega` already passes arbitrary fields through; this test locks the convention in).

If the test fails, do not "fix" `renderVega` — re-read the test against `bin/build.js:359` to confirm the assertions match what `renderVega` actually emits.

- [ ] **Step 3: Commit**

```bash
git add test/build.test.js
git commit -m "$(cat <<'EOF'
test(build): lock signal-<name> vega frontmatter round-trip

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Seed vega signals from `data-signal-*` dataset entries at runtime

**Files:**
- Modify: `script/vega.js`

- [ ] **Step 1: Add the signal prefix constant**

Edit `script/vega.js`. Find the existing constant declaration at the top of the IIFE:

```javascript
  const ANIMATE_PREFIX = 'animate';
```

Replace with:

```javascript
  const ANIMATE_PREFIX = 'animate';
  const SIGNAL_PREFIX = 'signal';
```

- [ ] **Step 2: Skip signal entries in `optionsFromDataset`**

In the same file, find `optionsFromDataset`:

```javascript
  function optionsFromDataset(el) {
    const opts = {};
    for (const [key, raw] of Object.entries(el.dataset)) {
      if (key === 'spec') continue;
      if (key.startsWith(ANIMATE_PREFIX)) continue;
      opts[key] = parseValue(raw);
    }
    return opts;
  }
```

Replace with:

```javascript
  function optionsFromDataset(el) {
    const opts = {};
    for (const [key, raw] of Object.entries(el.dataset)) {
      if (key === 'spec') continue;
      if (key.startsWith(ANIMATE_PREFIX)) continue;
      if (key.startsWith(SIGNAL_PREFIX)) continue;
      opts[key] = parseValue(raw);
    }
    return opts;
  }
```

- [ ] **Step 3: Add `applySignals` helper**

In `script/vega.js`, insert the following function definition immediately above `function applyAnimator(el, view) {`:

```javascript
  // Seed vega signals from data-signal-<name> dataset entries.
  // Camel-cased dataset keys (e.g. signalStage) are converted to the signal
  // name (stage) before being applied. Unknown signal names warn and skip.
  function applySignals(el, view) {
    let touched = false;
    for (const [key, raw] of Object.entries(el.dataset)) {
      if (!key.startsWith(SIGNAL_PREFIX) || key === SIGNAL_PREFIX) continue;
      const sigName = key.slice(SIGNAL_PREFIX.length, SIGNAL_PREFIX.length + 1).toLowerCase()
        + key.slice(SIGNAL_PREFIX.length + 1);
      const value = parseValue(raw);
      try {
        view.signal(sigName, value);
        touched = true;
      } catch (err) {
        console.warn(`vega signal "${sigName}" not found on`, el.id || el, err.message);
      }
    }
    if (touched) view.runAsync();
  }
```

- [ ] **Step 4: Call `applySignals` from `embedAll`, before `applyAnimator`**

Find this block in `embedAll`:

```javascript
      vegaEmbed(el, spec, opts).then(result => {
        el.__vegaView = result.view;
        try { applyAnimator(el, result.view); } catch (err) { console.error('vega animator failed for', el.id || el, err); }
```

Replace with:

```javascript
      vegaEmbed(el, spec, opts).then(result => {
        el.__vegaView = result.view;
        try { applySignals(el, result.view); } catch (err) { console.error('vega signals failed for', el.id || el, err); }
        try { applyAnimator(el, result.view); } catch (err) { console.error('vega animator failed for', el.id || el, err); }
```

- [ ] **Step 5: Re-run the full test suite to confirm nothing else regressed**

Run: `npm test`

Expected: all tests pass. `script/vega.js` is runtime-only and not covered by unit tests, so this is a regression smoke for the build side.

- [ ] **Step 6: Commit**

```bash
git add script/vega.js
git commit -m "$(cat <<'EOF'
feat(vega): seed signals from signal-<name> frontmatter

Adds a static counterpart to animate-<name>: any signal-<name> entry in
a vega frontmatter block is applied to the matching named signal on the
loaded view. Unknown signal names log a warning and the chart falls
back to spec defaults.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Author the trade-off triangle spec

**Files:**
- Create: `talks/vector-search-visualised/trade-off-triangle.json`

- [ ] **Step 1: Create the spec file**

Write the following to `talks/vector-search-visualised/trade-off-triangle.json`. The triangle uses barycentric weights (`ws`, `wa`, `wc` for Speed / Accuracy / Cost, summing to 1) so positioning matches narrative intent. The `stage` signal controls visibility; `stageSize` is set to `length(data('techniques'))` so the spec self-sizes if more techniques are added without changing the consuming slides.

```json
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "description": "Trade-off triangle: Speed / Accuracy / Cost. Techniques are revealed as `stage` increases.",
  "width": 600,
  "height": 540,
  "padding": 32,
  "background": "transparent",
  "config": {
    "view": { "stroke": "transparent" }
  },
  "signals": [
    { "name": "stage", "value": 0 },
    {
      "name": "vSpeed",
      "value": {"x": 300, "y": 20}
    },
    {
      "name": "vAccuracy",
      "value": {"x": 30, "y": 500}
    },
    {
      "name": "vCost",
      "value": {"x": 570, "y": 500}
    }
  ],
  "data": [
    {
      "name": "corners",
      "values": [
        {"label": "Speed", "x": 300, "y": 20, "ax": "center", "ay": "bottom", "dy": -12},
        {"label": "Accuracy", "x": 30, "y": 500, "ax": "left", "ay": "top", "dy": 14},
        {"label": "Cost", "x": 570, "y": 500, "ax": "right", "ay": "top", "dy": 14}
      ]
    },
    {
      "name": "edges",
      "values": [
        {"x": 300, "y": 20, "x2": 30, "y2": 500},
        {"x": 30, "y": 500, "x2": 570, "y2": 500},
        {"x": 570, "y": 500, "x2": 300, "y2": 20}
      ]
    },
    {
      "name": "techniques",
      "values": [
        {"name": "Flat", "stage": 1, "ws": 0.0, "wa": 0.5, "wc": 0.5}
      ],
      "transform": [
        {
          "type": "formula",
          "expr": "datum.ws * vSpeed.x + datum.wa * vAccuracy.x + datum.wc * vCost.x",
          "as": "x"
        },
        {
          "type": "formula",
          "expr": "datum.ws * vSpeed.y + datum.wa * vAccuracy.y + datum.wc * vCost.y",
          "as": "y"
        }
      ]
    },
    {
      "name": "revealed",
      "source": "techniques",
      "transform": [
        { "type": "filter", "expr": "datum.stage <= stage" }
      ]
    },
    {
      "name": "current",
      "source": "techniques",
      "transform": [
        { "type": "filter", "expr": "datum.stage === stage" }
      ]
    }
  ],
  "marks": [
    {
      "type": "rule",
      "from": {"data": "edges"},
      "encode": {
        "enter": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "x2": {"field": "x2"},
          "y2": {"field": "y2"},
          "stroke": {"value": "#1a1f4d"},
          "strokeWidth": {"value": 2}
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "corners"},
      "encode": {
        "enter": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "dy": {"field": "dy"},
          "align": {"field": "ax"},
          "baseline": {"field": "ay"},
          "text": {"field": "label"},
          "fontSize": {"value": 22},
          "fontWeight": {"value": 700},
          "fill": {"value": "#1a1f4d"}
        }
      }
    },
    {
      "type": "symbol",
      "from": {"data": "revealed"},
      "encode": {
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "shape": {"value": "circle"},
          "size": [
            {"test": "datum.stage === stage", "value": 520},
            {"value": 260}
          ],
          "fill": [
            {"test": "datum.stage === stage", "value": "#2858ff"},
            {"value": "#9bb5ff"}
          ],
          "stroke": {"value": "#1a1f4d"},
          "strokeWidth": {"value": 1.5},
          "opacity": [
            {"test": "datum.stage === stage", "value": 1},
            {"value": 0.65}
          ]
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "current"},
      "encode": {
        "enter": {
          "fontSize": {"value": 20},
          "fontWeight": {"value": 700},
          "fill": {"value": "#1a1f4d"},
          "align": {"value": "center"},
          "baseline": {"value": "top"}
        },
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y", "offset": 22},
          "text": {"field": "name"}
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Sanity-check the spec parses as JSON**

Run: `node -e "JSON.parse(require('node:fs').readFileSync('talks/vector-search-visualised/trade-off-triangle.json','utf8')); console.log('ok')"`

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add talks/vector-search-visualised/trade-off-triangle.json
git commit -m "$(cat <<'EOF'
feat(vector-search-visualised): trade-off triangle vega spec

Speed/Accuracy/Cost triangle with stage-controlled reveal. Techniques
are positioned via barycentric weights; flat search lands mid-edge
between accuracy and cost (ws=0, wa=0.5, wc=0.5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire the triangle into the trade-off slide

**Files:**
- Modify: `talks/vector-search-visualised/slides.md` (around line 210)

- [ ] **Step 1: Replace the placeholder with a vega frontmatter block**

Find this block in `talks/vector-search-visualised/slides.md`:

```markdown
# The trade-off triangle

Every technique from here on trades **speed**, **accuracy**, **cost**.

Flat search: perfect accuracy, terrible speed at scale.

<!-- VIS: The triangle — three axes labelled. Flat pinned at top-accuracy / bottom-speed. -->
```

Replace with:

````markdown
# The trade-off triangle

Every technique from here on trades **speed**, **accuracy**, **cost**.

Flat search: perfect accuracy, terrible speed at scale.

```vega
- spec: ./trade-off-triangle.json
  signal-stage: 1
  actions: false
```
````

- [ ] **Step 2: Build the deck**

Run: `npm run build talks/vector-search-visualised`

Expected: build completes, `dist/index.html` is written, no errors mentioning `trade-off-triangle.json`.

- [ ] **Step 3: Confirm the rendered HTML carries the expected data attributes**

Run: `grep -o 'data-signal-stage="[^"]*"' dist/index.html | head`

Expected: prints `data-signal-stage="1"`.

- [ ] **Step 4: Open the deck and visually verify**

Open `dist/index.html` in a browser, navigate to the "The trade-off triangle" slide. Confirm:

- Equilateral triangle is drawn with Speed at the top, Accuracy bottom-left, Cost bottom-right.
- A single highlighted dot sits at the midpoint of the Accuracy–Cost edge, labelled "Flat".
- Browser devtools console shows no errors and no `vega signal "stage" not found` warnings.

If the dot is missing, open the console and look for warnings about unknown signals — that indicates the `signal-stage` attribute didn't reach `view.signal()`.

- [ ] **Step 5: Commit**

```bash
git add talks/vector-search-visualised/slides.md
git commit -m "$(cat <<'EOF'
feat(vector-search-visualised): wire trade-off triangle into slide

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Document `signal-<name>` in README and CLAUDE.md

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Locate the vega frontmatter section in README**

Run: `grep -n "vega frontmatter\|Vega frontmatter\|\`\`\`vega" README.md | head`

Note the line numbers so the next step can target the right region.

- [ ] **Step 2: Add a paragraph about `signal-<name>` to README**

In `README.md`, find the existing vega frontmatter description. Immediately after the paragraph that explains how arbitrary keys flow through as `data-<key>` attributes, insert a new paragraph:

```markdown
Any key prefixed with `signal-` seeds a same-named signal in the loaded spec with a static value. This is the static counterpart to `animate-<name>`: useful for showing the same chart across multiple slides with different fixed state. For example, on a stage-by-stage reveal the same spec is referenced with `signal-stage: 1`, `signal-stage: 2`, etc. Values are parsed as numbers, booleans, or JSON literals where possible. Unknown signal names log a console warning and the chart falls back to spec defaults.
```

- [ ] **Step 3: Add the pointer to CLAUDE.md**

In `CLAUDE.md`, find the paragraph beginning `**Vega frontmatter** —`. After the sentence that describes how arbitrary keys become `data-<key>` attributes (`...read by [script/vega.js](script/vega.js) and forwarded to vegaEmbed`), append one sentence to the same paragraph:

```
Keys prefixed with `signal-` are a special case: they are pulled out of the opts stream and applied as named vega signals on the view after embed, mirroring `animate-<name>` but with a static value.
```

- [ ] **Step 4: Re-run the test suite as a final smoke**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document signal-<name> vega frontmatter convention

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:**
  - Generic `signal-<name>` mechanism → Tasks 1 (build round-trip), 2 (runtime apply).
  - Trade-off triangle spec → Task 3.
  - Slide wiring → Task 4.
  - README + CLAUDE.md updates → Task 5.
  - Test plan from the spec (build-side test + integration smoke, no JSDOM runtime test) → Tasks 1 and 4.
- **Camel-case conversion:** `data-signal-stage` arrives in `el.dataset` as `signalStage`. The slice in `applySignals` strips the 6-character `signal` prefix and lowercases the first remaining character → `stage`. For multi-segment keys like `data-signal-foo-bar` (dataset `signalFooBar`), the result is `fooBar`, matching vega's camelCase signal-name conventions.
- **Ordering:** signals are applied before animator. The animator's trigger-gated branch (`script/vega.js:85`) reads `view.signal(triggerSignal)` at start, so it sees the seeded value rather than the spec default.
- **No placeholders, no "TBD", all file paths absolute or repo-relative, all code blocks contain real code.**
