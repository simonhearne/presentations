---
name: editing-vega-specs
description: Use when creating or editing a Vega or Vega-Lite chart spec in this repo (builder/visualisations/*.json or a talk folder), adding annotations, callouts, axes or reveal stages to a chart, or checking how a chart looks on a slide.
---

# Editing Vega specs

## Overview

Specs are shared across decks and only judged by how they look on a slide. The work loop is: find who uses the spec, hand-edit it, render it, render the slides that use it, rebuild those decks.

## The loop

1. **Find the slides using it.** `grep -rn "<name>.json" talks/*/slides.md`. Note each slide's `signal-stage` list: a change shows on every one of them, including slides that stop at an early stage.
2. **Edit as text, touching only the lines you mean to change.** The Edit tool, a one-value `sed`, or a script that swaps a line range are all fine. Parsing and re-serialising the file (`json.load`/`json.dump`, `JSON.stringify`) is not: specs keep `encode` entries on one line, and a reformat buries the change in a whole-file diff.
3. **Render the spec** and look at the PNG:
   ```bash
   node bin/render-spec.js visualisations/<name>.json --signal stage=3 --wait 2500 [--theme dark] [--out x.png]
   ```
   It runs the deck's own `script/vega.js`, so the brand theme is applied. `--signal` also sets Vega-Lite params. An unknown name fails loudly. Size `--wait` to the draw timer: a signal stepping `step` toward `span` every `throttle` ms needs `span / step * throttle` ms, plus margin.
4. **Render each slide** that uses it, stepped to the stage you changed:
   ```bash
   node bin/render-slide.js talks/<slug> <slide number> --steps <n> [--signal name=value] --wait 2500
   ```
   The slide can be given as its number or its heading text; heading text must pick out one slide or it errors with the matches. It builds the deck, opens it over `file://` (no server, no port clashes), presses ArrowRight `n` times and screenshots at 1920x1080.

   **Steps to the final stage** = the length of the slide's `signal-stage` list minus 1 (the first value is seeded on load), plus every `.fragment` reveal on the slide that steps before the chart: all of them, unless the `vega` block sets `fragment-index`.

   **Warnings:** `overflow:` means content runs into the footer, so fix it. `--steps ran past the slide` means you over-counted. "The input spec uses Vega v6" and warnings quoting other charts in the deck predate your change; ignore them.
5. **Rebuild every deck** from step 1: `npm run build talks/<slug>`.

## House patterns

| Need | Pattern |
|---|---|
| Stepped reveal | A `stage` signal; slides drive it with `signal-stage: [0, 1, 2]` in the `vega` block |
| Line that sweeps in | A timer signal (`drawX`) that climbs to `span` once `stage >= n`; data filters on it |
| Show a mark at a stage | Keep the mark, gate `update.opacity` on a signal (`drawX >= span ? 1 : 0`). Do not add/remove marks |
| Numbers in labels | Put assumptions in signals (`nsPerCmp`) and compute text with `format()` in `update.text`, so a retune updates every label |
| Colours and fonts | Leave them to the brand theme (`brandConfig` in `script/vega.js`). Set colours only when they carry meaning (a series, a callout matching its line) |
| Font sizes | Don't restate the theme's type scale (axis 16/22, text 20). Only specs narrower than ~900px set their own, axis and legend together |
| Rendered text | No em dashes: use commas, colons or two sentences |

## When the change exposes a wrong number

If the correct annotation contradicts the chart's own data or the slide's text (a hard-coded crossover that the constants don't produce, a "stays cheaper" claim that stops being true), make the requested change against the correct value, then report the contradiction. Do not rewrite the data or edit slide text unasked.

## Vega gotchas

- Check `$schema` first: Vega and Vega-Lite specs both live in `visualisations/` and take different syntax. Vega-Lite uses `params` (with `expr`) where Vega uses `signals`, and `transform: calculate` where Vega uses `formula`.
- Anchor annotations to data values through the scale (`{"scale": "x", "value": 2000}`, or a Vega-Lite `datum`), never a fixed pixel `x`/`y`. Pixel placement drifts onto legends when the data or size changes.
- Vega axes have no `labelExpr` (that is Vega-Lite). Use `encode.labels.update.text` with a signal on `datum.value`.
- Axis `values` accept `{"signal": "[...]"}`, which lets a second axis put ticks at computed positions on a shared scale.
- `dx`/`dy` on rotated text follow the text's angle. To nudge along screen axes, use `offset` on the `x`/`y` scale values.
- On log axes, pixels per decade = range / (log10(max) - log10(min)). A line's on-screen angle is `atan(ypx / xpx)` per decade, which is how to match a rotated label to its line.

## Common mistakes

| Mistake | Fix |
|---|---|
| Checked only the spec PNG | The slide adds a title, text and footer; render the slide too |
| Checked one slide of a shared spec | Render every slide from step 1 at its own final stage |
| Callout overlaps a line or label | Place it on the side away from the line and re-render; prefer `align: right` left of an end point |
| Second label on a line that already has one | Put it on the opposite side of the line or further along it, and split long text into an array with `lineHeight` |
| Colour unreadable on a dark slide | Check slides' classes (`.dark`, `.title`, `.hero`, `.bg`); if any use the chart, render `--theme dark` and pick a colour that works on both |
| `grep --include=*.md` fails with "no matches found" | zsh expands the glob: quote it or use `talks/*/slides.md` |
