# Vega static signals + trade-off triangle

## Summary

Extend the `vega` frontmatter block with a generic `signal-<name>: <value>` convention that seeds a same-named signal in the loaded vega spec with a static initial value. The first consumer is a new "trade-off triangle" visualization for the *vector-search-visualised* talk, where successive slides advance a `stage` signal to progressively reveal indexing techniques on a Speed / Accuracy / Cost triangle.

## Motivation

The current vega plumbing supports two extremes: fully static specs (default signal values baked into the JSON) and time-varying ones (`animate-<name>` walks a signal over time). Decks routinely want a third mode: the *same* spec rendered with a different fixed signal value per slide — typically to advance through stages of an explanation without animation or interactivity.

The trade-off triangle is the immediate use case. We want one spec file describing all techniques, and slide N renders the spec with `stage: N`, revealing the Nth technique. A generic `signal-<name>` mechanism unlocks this and any future "stepwise reveal" or "preset-per-slide" pattern without bespoke per-deck wiring.

## Design

### Frontmatter convention

A vega frontmatter entry may include any number of keys prefixed with `signal-`. The suffix is the signal name as declared in the spec; the value is the static initial value.

```yaml
\`\`\`vega
- spec: ./trade-off-triangle.json
  signal-stage: 1
\`\`\`
```

Multiple signals are supported in a single entry:

```yaml
- spec: ./foo.json
  signal-k: 8
  signal-threshold: 0.75
  signal-mode: "exact"
```

Values are coerced by the same `parseValue` helper already used in `script/vega.js` for animator attributes — numbers, booleans, `null`, and JSON object/array literals decode automatically; everything else is treated as a string.

### Build-time behavior (`bin/build.js`)

No new validation. `parseKvList` already accepts arbitrary keys, and `renderVega` already forwards every non-reserved key as a `data-<key>` attribute on the chart `<div>` (kebab-cased per HTML dataset rules: `signal-stage` → `data-signal-stage`). The build needs no changes beyond a test that locks the round-trip in.

### Runtime behavior (`script/vega.js`)

- Add `SIGNAL_PREFIX = 'signal'` alongside the existing `ANIMATE_PREFIX`.
- `optionsFromDataset` skips any key starting with `signal` (so they are not forwarded to `vegaEmbed` as opts).
- A new helper `applySignals(el, view)` is called after `vegaEmbed` resolves and before `applyAnimator`. For each `data-signal-<name>` entry in `el.dataset`:
  - Convert the camelCase dataset key back to the signal name (`signalStage` → `stage`).
  - Parse the value with the existing `parseValue` helper.
  - Attempt `view.signal(sigName, value)`; if vega throws "Unrecognized signal name", log a `console.warn` naming the element id (or selector) and the signal that was missing. The chart still renders with the spec's default signal values.
- After processing all signal entries, call `view.runAsync()` once to apply.

Ordering rationale: signals are seeded *before* the animator starts so an animator's `from` initial doesn't fight a seeded value — and so animators that gate on a trigger signal (`animate-trigger`) see the seeded trigger state immediately.

### The trade-off triangle spec

New file: `talks/vector-search-visualised/trade-off-triangle.json`.

- Equilateral triangle, three corners labelled **Speed** (top), **Accuracy** (bottom-left), **Cost** (bottom-right). Three `rule` marks for edges, three `text` marks for labels. No axes.
- A `stage` signal, default 0.
- A `techniques` data source declared inline with one row per technique, fields: `name`, `stage` (1-based stage number it appears at), `ws`, `wa`, `wc` (barycentric weights summing to 1 over Speed/Accuracy/Cost).
- A formula transform converts `(ws, wa, wc)` to pixel `(x, y)` using the three corner coordinates.
- A filter transform keeps rows where `datum.stage <= stage`.
- Two mark layers: muted dots for previously-revealed techniques, brighter fill + a label for the technique whose stage equals the current `stage`.

Initial data (this PR):
- `{name: "Flat", stage: 1, ws: 0, wa: 0.5, wc: 0.5}` — mid-edge between Accuracy and Cost.

Future techniques (IVF, HNSW, PQ, etc.) are added to the same array with higher stage numbers; new slides reuse the spec with `signal-stage: 2`, `signal-stage: 3`, etc.

### Slide usage

The existing trade-off triangle slide (currently at `talks/vector-search-visualised/slides.md:210`) replaces its `<!-- VIS: -->` placeholder with the vega frontmatter shown above and `signal-stage: 1`.

## Testing

- New unit test in `test/build.test.js`: render a slide with a `signal-stage: 1` vega entry and assert the produced chart `<div>` carries `data-signal-stage="1"`. Confirms the round-trip without touching runtime code.
- Runtime signal seeding (`applySignals` in `script/vega.js`) is not unit-tested — it requires a JSDOM-or-equivalent harness around vega-embed, which the repo has historically avoided. We rely on the integration smoke of building the talk and opening the deck.
- The build's existing tests for `parseVega` already exercise arbitrary keys, so no parser changes need new coverage.

## Documentation

- `README.md`: in the vega frontmatter section, add a short paragraph introducing `signal-<name>` as the static counterpart to `animate-<name>`, with the trade-off triangle as the example use.
- `CLAUDE.md`: one sentence in the vega frontmatter paragraph pointing at the new convention.

## Alternatives considered

- **Nested `signals:` map** (`signals: {stage: 1}`). Rejected: `parseKvList` is deliberately flat and adding nested-object parsing for one feature is disproportionate. The prefix form slots in next to `animate-*` and reuses existing infrastructure.
- **Per-stage JSON files** (`trade-off-triangle-stage1.json`, `...-stage2.json`). Rejected: multiplies files and copy-paste; adding a technique requires editing every stage file.
- **Vega `bind` input slider** for stage. Rejected: breaks the "Right-arrow advances the stage" reading flow the talk wants — interactivity belongs on the click-to-pin patterns, not on linear narrative.

## Out of scope

- Setting signal values on already-rendered charts (slide-revisit / hot-update). Each slide reloads the spec; this is fine for the talk format.
- Two-way binding between signals and dataset attrs.
- Validation that the declared `signal-<name>` actually exists in the spec at build time. Caught at runtime with a `console.warn`; that's loud enough in dev.
