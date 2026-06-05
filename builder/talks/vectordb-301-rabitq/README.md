# vectordb-301 / RaBitQ visualizations

Six independent Vega / Vega-Lite specs that walk the dimensionality ladder for the RaBitQ quantizer (Gao & Long, SIGMOD 2024 — [arXiv:2405.12497](https://arxiv.org/abs/2405.12497)). Each spec is self-contained and renders on its own slide. Captions live inside each spec as text marks.

This deck is a staging ground for visualizations that will eventually fold into [`talks/vectordb-301`](../vectordb-301/). Slides narrative is intentionally minimal in this first pass — the goal here is to get the six visualizations right.

## Specs

| File | Tool | What it shows |
|---|---|---|
| [01_estimator_1d.vg.json](./01_estimator_1d.vg.json) | Vega | Estimator as arithmetic on three scalars on a number line |
| [02_codebook_2d.vg.json](./02_codebook_2d.vg.json) | Vega | Codebook = 4 vertices on the unit circle vs axis-clustered real data |
| [03_rotation_2d.vg.json](./03_rotation_2d.vg.json) | Vega | Snap-error angle as a function of data orientation; rotation as the fix |
| [04_concentration_highd.vl.json](./04_concentration_highd.vl.json) | Vega-Lite | ⟨ō, o⟩ concentrating around 0.798 as D grows |
| [05_error_scaling_highd.vl.json](./05_error_scaling_highd.vl.json) | Vega-Lite | Estimator error scaling as O(1/√D), with a PQ contrast baseline |
| [06_bit_string_highd.vg.json](./06_bit_string_highd.vg.json) | Vega | The stored artifact — D bits, no decompression |

`.vg.json` is Vega; `.vl.json` is Vega-Lite. The choice is deliberate per spec — see the implementation spec for reasoning.

## Theme

Specs share a brand-aligned palette adapted from [css/tokens.css](../../css/tokens.css):

| Role (per spec) | Color | Token |
|---|---|---|
| `accent-data` (data vector) | `#c84cff` | `--zilliz-berry` |
| `accent-code` (codebook) | `#175fff` | `--zilliz-blue` |
| `accent-good` (correct, unbiased) | `#00a884` | darker `--zilliz-green` for white bg |
| `accent-bad` (error) | `#e45756` | matches existing decks |
| `accent-hi` (highlight, expected value) | `#7f47ff` | `--zilliz-purple` |
| `text-primary` | `#1e293b` | `--zilliz-ink` |
| `text-dim` | `#6b7280` | — |
| `rule` (axes, circles) | `#cbd5e1` | — |

Fonts: Inter for body and headings, IBM Plex Mono for monospace readouts. The implementation spec called for `Fraunces` italic for titles; in this repo's white-background context, italic Inter holds the same role.

## Preview

```bash
npm run build talks/vectordb-301-rabitq
open talks/vectordb-301-rabitq/dist/index.html
```

Each viz renders on its own slide. Resize the browser to validate scaling — the build inlines specs as base64 data URIs so they work over `file://` without a server.

## Regenerating precomputed data

Two specs (04 concentration, 05 error scaling) and one (06 bit string) read from precomputed JSON in `data/`. To regenerate:

```bash
cd talks/vectordb-301-rabitq
node scripts/gen_bit_patterns.mjs    > data/bit_patterns.json
node scripts/gen_concentration.mjs   > data/concentration.json
node scripts/gen_error_scaling.mjs   > data/error_scaling.json
```

Scripts use a deterministic `mulberry32` PRNG, so output is reproducible. After regenerating, the data is **not auto-rebuilt into the specs** — `06` and `04`/`05` re-embed inline. To fully refresh, also re-run the spec generation snippets in this repo's commit history (or re-construct via the Node one-liners under `scripts/build_*.mjs` if added later).

The PQ baseline in `05` is **synthetic** — RaBitQ's 1/√D scaling is the headline; PQ's flat-in-D behavior is the qualitative contrast. A real PQ benchmark would show a similar trend with different constants. The chart caption acknowledges this.

## Source

Gao, J. & Long, C. *RaBitQ: Quantizing High-Dimensional Vectors with a Theoretical Error Bound for Approximate Nearest Neighbor Search.* SIGMOD 2024. [arXiv:2405.12497](https://arxiv.org/abs/2405.12497).

Quantities verified against the paper:
- ⟨ō, o⟩ expected value ≈ 0.798 = √(2/π) — Appendix B.1.
- Estimator error bound `c/√D` — Theorem 3.2.
- Bit-string compression: D × 32 bits → D × 1 bit = 32× — §3.1.
