# Data sources

Every CSV under `talks/rag-cost-curve/data/` comes from
`/Users/simon/Projects/rag-cost-curve` (read-only), commit
`11752504199e41049e0b40d2851093a7ad404884`, the tip of branch **`ws9`** on
2026-09-16. Single pin, no split.

> The previous pin was `2e5432f...` for everything except `ws8/`. That split is
> retired because it stopped being true: WS9 changed four `ws5/` files the deck
> copies and added the size sweep behind `ws6c/index_cost.csv`, so the old
> header's "no committed CSV the deck reads has changed between the two points"
> no longer held as written. Every file below was re-copied at the `ws9` commit
> and the table re-walked, rather than carrying a three-way pin.
>
> ⚠️ `ws9` was **not yet merged into `main`** when these files were copied: it
> was 27 commits ahead. The handoff asks for the merge commit; the merge had not
> happened, so the branch tip is pinned instead. Every CSV the deck copies has
> been unchanged since `b5fed17` ("carry the unseen-corpus curve into the WS5
> cost model"), and the six commits after it touch only prose and
> `results/ws6c/scaling_provenance.txt`, so the merge commit will carry byte
> identical data. Re-pin the header to it when the merge lands; nothing else
> needs to move.

> ⚠️ **`results/ws8/transcripts/` was deleted upstream** in `19894d0` (third-party
> comment prose with no covering licence). The CSVs are unaffected, but the
> parametric gate's *declining-rather-than-guessing* evidence is no longer
> independently checkable: a reader can verify the `0.000` score and
> `any_doc_hit = 0/75`, and must take the rest on the report. Copies and derivations were
produced by `data/derive.js`, run by hand from `talks/rag-cost-curve/data`:
`node derive.js`. Its output is committed, so a deck build never depends on
the source repo being present.

| deck path | source path | copied or derived | what the derivation does |
|---|---|---|---|
| `ws1/gt_verification.csv` | `results/ws1/gt_verification.csv` | copied | none |
| `ws2/curves_10m.csv` | `results/ws2/curves_10m.csv` | copied, then one column appended | `footprint_compression_vs_ivf_flat` (`_1024` in ws3), the row's `loaded_bytes` measured against the WS2 `ivf_flat_fp32` load at the same scale, appended by `derive.js`. Upstream columns are untouched: the append is by line, so every byte before the last comma is the copied file. See ruling R26. Also read by the recall-target slide for the one cross-workstream number in the deck: `ivf_sq8` throughput at nprobe 64 and 512, quoted against WS4e accuracy. See the 2026-09-13 audit for why that join is safe and why the figure is stated as a bound |
| `ws2/curves_1m.csv` | `results/ws2/curves_1m.csv` | copied, then one column appended | `footprint_compression_vs_ivf_flat` (`_1024` in ws3), the row's `loaded_bytes` measured against the WS2 `ivf_flat_fp32` load at the same scale, appended by `derive.js`. Upstream columns are untouched: the append is by line, so every byte before the last comma is the copied file. See ruling R26 |
| `ws2/c8_verdict_10m.csv` | `results/ws2/c8_verdict_10m.csv` | copied, then one column appended | `footprint_compression_vs_ivf_flat` (`_1024` in ws3), the row's `loaded_bytes` measured against the WS2 `ivf_flat_fp32` load at the same scale, appended by `derive.js`. Upstream columns are untouched: the append is by line, so every byte before the last comma is the copied file. See ruling R26 |
| `ws3/dim_verdict_1m.csv` | `results/ws3/dim_verdict_1m.csv` | copied, then one column appended | `footprint_compression_vs_ivf_flat` (`_1024` in ws3), the row's `loaded_bytes` measured against the WS2 `ivf_flat_fp32` load at the same scale, appended by `derive.js`. Upstream columns are untouched: the append is by line, so every byte before the last comma is the copied file. See ruling R26. WS3 has no fp32 arm of its own, so the baseline is borrowed from WS2 exactly as upstream borrows WS2's `flat_fp32` |
| `ws3/dim_verdict_10m.csv` | `results/ws3/dim_verdict_10m.csv` | copied, then one column appended | `footprint_compression_vs_ivf_flat` (`_1024` in ws3), the row's `loaded_bytes` measured against the WS2 `ivf_flat_fp32` load at the same scale, appended by `derive.js`. Upstream columns are untouched: the append is by line, so every byte before the last comma is the copied file. See ruling R26. At 10M the new column is a true 10M measurement, where upstream's `footprint_compression_vs_flat_1024_1m` carries the 1M figure across |
| `ws3/transform_ceiling_1m.csv` | `results/ws3/transform_ceiling_1m.csv` | copied | none |
| `ws4/summary.csv` | `results/ws4/summary.csv` | copied, unfiltered | copied as-is, long-form and unfiltered: the metric filter (which `class`/`metric`/`family` rows a given chart plots) lives in the Vega specs, not in this file |
| `ws4/pairs.csv` | `results/ws4/pairs.csv` | copied | none |
| `ws4/mediator.csv` | `RESULTS-WS4.md` §6 (prose) | transcribed, not derived | hand-typed from the three counts in §6 (368 of 450 answers had gold in the top 10: 214 judge-correct, 106 "I don't know", 48 answered something else). Not generated by `derive.js` and has no corresponding raw CSV row to diff against |
| `ws4/answerability.csv` | `results/ws4/runs.csv` | **derived** by `derive.js` | Backs the answerability slide's three stat cards. Counts, for each of the 450 `subset == "main"` questions, how many of the eleven retrieval arms the judge marked correct, and tallies the 450 questions into the twelve possible counts. ⚠️ **The `parametric` arm is dropped**, leaving 11 arms of the 12 in `runs.csv`: it answers closed-book, so counting it would let a question the weights already know score 1 with every index having failed. `derive.js` asserts every qid has exactly 11 rows after the filter. The distribution is a barbell, not a bell: **173 questions (0.3844) at zero arms and 150 (0.3333) at eleven**, with the remaining 127 spread across one to ten. The slide's third card sums `arms_correct` 4 to 7, which is **32 questions (7.1 %)** |
| `ws4/answerability_examples.csv` | `results/ws4/runs.csv` | **filtered copy** by `derive.js` | The three worked questions on that slide, one row per arm, 33 rows: qid 907 (`never`, 0 of 11), 264 (`always`, 11 of 11), 3129 (`split`, 6 of 11). Every answer is the verbatim upstream cell, **unnormalised**, because grouping near-identical wordings (`Marry You` against `"Marry You"`) is a judgement call and not a derivation; the slide's tallies are counted by hand off this file and can be recounted the same way. ⚠️ **The three questions were chosen, not sampled.** They illustrate the buckets and are evidence about nothing. ⚠️ qid 907's eleven answers are **4 "Marry You", 2 "Hallelujah", 2 "Death of a Bachelor", 3 declines**, and the slide says four-four-three; an earlier hand tally that read the `pca_uc_512` answer as "Hallelujah" was wrong, that row resolves to "Death of a Bachelor". Writing this file needed `toCsv` to learn RFC 4180 quoting: model answers carry commas, quotes and newlines, and every earlier derivation wrote neither |
| `ws4/judge_prompt.txt` | `results/ws4/judge_prompt.txt` | copied by hand (not `derive.js`) | none, byte-for-byte, for backup 39 |
| `ws4d/solvable_changepoint.csv` | `results/ws4d/solvable_changepoint.csv` | copied | none. Added 2026-09-13 with the WS4e fold-in. The deck cites only the `all_eligible` row (15 arms, 264 eligible questions): `slope` 0.234763, `slope_ci_lo` 0.121615, `slope_ci_hi` 0.352557, rounded to 0.235 [0.122, 0.353] on the recall slide's money card and on scorecard C6 |
| `ws4e/rstar_final.csv` | `results/ws4e/rstar_final.csv` | copied | none. The consolidated r\*/τ record across all four attempts. ⚠️ This file is the authority that retires r\*, and it supersedes any threshold reading of `ws4/summary.csv`: see the warning below this table |
| `ws4e/ceiling.csv` | `results/ws4e/ceiling.csv` | copied | none. Pre-registered by artifact: written and committed before a single WS4e row was generated. Source of the depth slide's 0.371 to 0.913 separability figures (`separable_rate` at k=1 and k=10) |
| `ws4e/mediator_by_k.csv` | `results/ws4e/mediator_by_k.csv` | copied | none. Backs `charts/depth-sweep.vl.json`, which plots the `arm=sq8_np512` rows only. ⚠️ `presence_at_k` here is on the 264-question eligible stratum and reaches 1.000 at k=10 by construction; it is **not** the same quantity as `ws4/summary.csv`'s `answer_presence_at_10` (0.7378 to 0.8178 over 450 unfiltered questions) |
| `ws4e/composition_check.csv` | `results/ws4e/composition_check.csv` | copied | none. Source of the depth slide's fixed-population figures: `fixed_separable_rate` is 0.47959 at both k=1 and k=10, printed as 0.4796. ⚠️ The 2026-09-16 re-pin picked up a **prose-only** change upstream: the `note` column dropped its internal task references ("fix round 1, CRITICAL 1", "task 10 MUST FIX 1") for the public release. **No numeric cell moved**; the deck quotes no part of `note` |
| `ws4e/slope_by_k.csv` | `results/ws4e/slope_by_k.csv` | copied | none. ⚠️ Same prose-only `note` change at the 2026-09-16 re-pin as `composition_check.csv`; no numeric cell moved. `changepoint_fitted` is `False` at every depth by design: 4 arms against WS4d's 4-parameter changepoint model is zero residual degrees of freedom. ⚠️ Its `note` column warns that `slope_by_k` and `discrimination_by_k` answer different questions and move in opposite directions with k; neither may be quoted without the other |
| `ws4e/conversion_composition_check.csv` | `results/ws4e/conversion_composition_check.csv` | copied | none. Backs the depth slide's speaker-note claim that the apparent fall in gold-conversion with depth is a composition artifact, and the marginal-gold figures (a gold first present at ranks 6 to 10 converts at ~0.36 against ~0.71 to 0.75 for one present by rank 5) |
| `ws5/break_even.csv` | `results/ws5/break_even.csv` | copied | none. ⚠️ **Re-copied 2026-09-16 at the `ws9` pin.** **360 rows to 504**: WS9 added 144 `workload == "code_unseen"` rows, the unseen-corpus curve at S, M and L (3 sizes x 2 index arms x 3 regimes x 2 hit-rate bases x 2 footprints x 2 infra modes), computed by the same notebook cell and the same `benchlib/cost_model.py` arithmetic as every other row. **No column changed and the 360 pre-existing rows are byte-identical**, asserted upstream by `tests/test_ws9_cost_model.py::test_existing_workloads_are_byte_identical` against a pre-WS9 snapshot. The deck reads the new rows through `ws5/break_even_ws6c.csv`, a filtered copy. Note for anyone writing a new filter: three workloads now share the same `size` letters, so `workload` is load-bearing. ⚠️ Two columns added 2026-09-15, `c_live_over_window` and `break_even_qpd_over_window`: a COUNTERFACTUAL, not a measurement and not an interpolation. They carry what a regime's own list price would charge for a request its input cap refuses, and are emitted only where that cap is an API limit on a model with a larger context window. In practice that is OpenAI alone (922k cap, 1,050k context), 48 of 360 rows; the headline is `regime=openai, workload=memory, size=L` at $0.478913 a query and **6.15** queries a day. No counterfactual is emitted for `open_weight`, whose 131,072 is Llama 3.3 70B's own context length, so there is no price to look up. `break_even_qpd` itself is untouched and still empty wherever the live arm cannot run. ⚠️ Also regenerated 2026-09-15: the source repo's serving-memory pin moved from `r7i.large` ($0.1323/hr, $96.65/month) to `r8g.large` ($0.11782/hr, $86.07/month), the like-for-like Graviton4 box (same 2 vCPU and 16 GiB, 11% cheaper, and exactly linear in $/GiB across the family rather than linear to within 1%). Nothing else in the model changed. `break_even_qpd` is linear in the instance price, so every dedicated figure scales by 0.8906: the headline goes 375 / 17 / 12 to 334 / 15 / 10, still inside the pre-registered `[10, 1000)` band at all three sizes, and the postdiction gate is untouched because infra does not enter it |
| `ws5/churn.csv` | `results/ws5/churn.csv` | copied | none. ⚠️ **Re-copied 2026-09-16 at the `ws9` pin.** **168 rows to 336**: 168 `code_unseen` rows added, rows only. The file already carried a `workload` column before WS9 and the 168 `memory` rows are byte-identical. ⚠️ **The deck's churn citations must filter `workload == "memory"`.** The L figures on the verdict slide ($0.29 to $3.84 a query, break-even 10.42 to 0.74) are memory rows, and `code_unseen` now has L rows under the same letter. Regenerated 2026-09-15 by the r7i to r8g re-pin; `c_live` is unchanged, `break_even_qpd` scales by 0.8906 |
| `ws5/sensitivity.csv` | `results/ws5/sensitivity.csv` | copied | none. ⚠️ **Re-copied 2026-09-16 at the `ws9` pin.** **48 rows to 96, and a new `workload` column** (the pre-WS9 file had none): 48 `code_unseen` rows added, the 48 `memory` rows byte-identical once `workload` is dropped for the comparison. `max_spread_ratio` is computed within a workload and never across one, asserted upstream by `test_sensitivity_ranks_per_workload_not_across_them`. ⚠️ **The deck's 69,000x mega-stat must filter `workload == "memory"`.** `max_spread_ratio` at `knob == infra_mode` is 68,944.94 on memory and **7,421.06** on `code_unseen`; an unfiltered read is ambiguous between them. The WS5 sensitivity backup table is the memory workload throughout and now says so on the slide. Regenerated 2026-09-15 by the same re-pin. Every knob's `ratio_vs_base` and every `max_spread_ratio` is unchanged except `infra_mode`, 69452.55 to 68944.94: the dedicated and marginal arms are priced off the same instance, so the spread is really instance GiB over index GiB and moves only by the embed-amortisation residual in `fixed_daily`. The ranking is identical |
| `ws5/serverless.csv` | [`zilliz.com/pricing#calculator`](https://zilliz.com/pricing#calculator) | derived by `derive.js` from rates read off that calculator plus committed vector counts | The only file here sourced outside the rag-cost-curve repo. Rates were read on 2026-09-15 by driving the calculator's Serverless tab (GCP us-west1) and solving for its model, not by assumption: **$4.00 per million vCU** for reads and writes alike (confirmed across six readings, 0.15M vCU to 100M vCU, all exact); **write vCU = vector_bytes / 4096** (measured at 736 B, 3072 B and 6144 B per vector); **billed storage = entities x vector_bytes x 1.165** at FP16, at **$0.30 per GB-month** in GCP us-west1. The free tier (5 GB, 2.5M vCU per month, up to 5 collections) is stated on the pricing page itself. ⚠️ Two consequences the deck must not paper over. A write is priced per **4 KiB**, so there is no flat per-row write rate: the deck's 1536d FP16 embedding costs $3.00 per million writes where a 368d one costs $0.72. And reads scale with collection size, measured at 15 vCU per read on 1M vectors and 50 on 10M; the calculator refuses to model a collection below 1M vectors, which is 22x larger than the deck's biggest corpus, so `usd_per_query_max` and `free_queries_per_day_min` are carried as a **bound**, never as a measurement. `payload_gb_upper` uses the chunker's `chunk_chars` cap, so storage is an upper bound too |
| `ws5/postdiction_gate.csv` | `results/ws5/postdiction_gate.csv` | copied | none. Added 2026-09-07 so the two "0.09 %" gate citations (slide 30 notes, backup 45) point at the underlying data instead of `RESULTS-WS5.md`. ⚠️ **Re-copied 2026-09-16 at the `ws9` pin.** **42 rows to 72**: 30 `code_unseen` rows added (3 sizes x 3 arms x 3 bases, plus parametric at L x 3), rows only. The gate now covers the unseen corpus at 0.0000 % worst error on both asserted bases. **The deck's citation moved from 14 rows to 24**: max absolute `rel_error` over the `basis=mean_billed` rows is still 0.0009 (0.09 %), now across 24 rows spanning all three workloads rather than 14. The number did not move; the gate got broader, and the deck says the broader thing |
| `ws5/break_even_ws6c.csv` | `results/ws5/break_even.csv` (+ `results/ws6c/scaling.csv`, `results/ws6c/index_cost.csv` for three non-cost columns) | **filtered copy** by `derive.js` | Stage 6 of `charts/cost-curve.vg.json` (stage 5 until the code workload was split across two stages on 2026-09-16): WS5 break-even for the **agentic-hil** corpus, a repository the model has never seen. Six rows, three sizes x two index arms, filtered to `workload == "code_unseen" && live_arm == "agentic" && regime == "claude" && infra_mode == "dedicated" && hit_rate_basis == "measured" && footprint == "pca_uc_384_sq8"`. ⚠️ **This file was a derivation until 2026-09-16 and is not one any more.** The deck used to recover WS5's fixed-cost model from two anchor rows of `break_even.csv` and run it over the `ws6c/summary.csv` arms itself, because upstream modelled the code workload on `fastapi` only. WS9 retired that: `break_even.csv` now carries the `code_unseen` rows, computed by the same notebook cell and the same `benchlib/cost_model.py` arithmetic as every other point on the chart. **Every cost column here is now a string copy of the upstream cell, never re-rounded and never recomputed**, so there is one source for these numbers rather than two that could drift. `derive.js` adds exactly three things and recomputes no statistic: `index_topk` (read off `index_arm`, `indexed` to 10 and `indexed_topk3` to 3), `corpus_label` (a deck constant), and `n` plus the two judge accuracies (grouped out of `ws6c/scaling.csv`, the panel these rows were costed over; it asserts n = 37 in every cell and that `corpus_tokens` agrees with `ws6c/index_cost.csv` at each scope). Break-even is **finite at every size**: 36.99 / 25.73 / 63.79 queries a day at top-k 10 and 54.81 / 23.71 / 82.52 at top-k 3, for S / M / L. ⚠️ **The curve is not monotone and must not be drawn or narrated as one.** M is the cheapest crossover and L the worst; the reports do not resolve whether that is the corpus or the panel, and the pre-registered H1 (the saving widens with size) did **not** hold. ⚠️ **The two series cross at M** (25.73 at k=10 against 23.71 at k=3), which is the pre-registered K2 outcome: the shipped default may not be presented as the cheaper setting. ⚠️ **`U3` at every size for `indexed - agentic`**, and at eight of the nine cells overall. Break-even is a ratio of means and may be stated as a point estimate, which is what the pre-registration permits, but **the index may not be said to "win" at any size on this corpus**. The one `U1` cell (M, `indexed_topk3 - agentic`) is an isolated resolution among nine unadjusted cells and is not a finding. ⚠️ **The three L caveats travel with any L point**: the paired median interval for `indexed` vs `agentic` straddles zero (`sign_p` 0.081, `ws6c/branches.csv`, P3); the agentic arm hit the turn cap on 2 of 37 runs at L (1 of 37 at S, 2 of 37 at M), so the saving is the conservative end; and the `indexed_topk3` contrasts' per-arm medians in `ws6c/summary.csv` carry the opposite sign to the paired deltas. ⚠️ **The L point moved from 58.94 / 70.44 to 63.79 / 82.52 and this is composition, not a new result.** Nothing was re-run. The old pair averaged all 40 `agentic_hil` questions; these average the 37-question panel that runs at every size, which excludes `q09`, `q30` and `q31` because their gold files sit outside `src/` and cannot be held fixed across the sweep. Per-arm mean $/query, n = 40 to 37: agentic 0.1387 to 0.1392, indexed 0.0907 to 0.0949, indexed_topk3 0.0985 to 0.1050. The deck shows the n = 37 pair on the chart and carries the n = 40 pair in the speaker notes as the previously published figure. ⚠️ **Wall clock**: L was measured 2026-09-08, S and M 2026-09-15. **Dedicated only, by choice rather than refusal.** The previous entry here refused the marginal arm because it needs an index footprint and agentic-hil's "was never measured; estimating it would put the only estimated number on a chart where everything else is measured or exactly derived". **That refusal is retired.** WS9 derives the footprint the same way the `fastapi` rows' is, from the measured chunk count (`count(*)` against Milvus, 2,099 / 3,324 / 7,441 at S / M / L in `ws6c/index_cost.csv`) x 1536 dims x 4 bytes / the footprint multiplier, through `cost_model.index_footprint_bytes` and asserted upstream by `test_index_footprint_is_derived_from_the_measured_chunk_count`. The marginal rows are real, are one filter away in `ws5/break_even.csv` (`infra_mode == "marginal"`, 0.004985 / 0.005580 / 0.030649 queries a day at k=10), and are left off this file and the chart because the marginal argument is made on the 'floor can go to zero' slide instead. On 2026-09-16 the **memory** workload's marginal line came off the chart too, so no marginal series is drawn at any stage. `break_even.csv` itself is untouched and keeps its copied status |
| `ws6a/summary.csv` | `results/ws6a/summary.csv` | copied | none. ⚠️ superseded for the indexed vs agentic contrast, see the warning below this table |
| `ws6a/setup_effort.csv` | `results/ws6a/setup_effort.csv` | copied | none |
| `ws6a/judge_prompt.txt` | `results/ws6a/judge_prompt.txt` | copied by hand (not `derive.js`) | none, byte-for-byte, for backup 39 |
| `ws6a/scaling_medians.csv` | `results/ws6a/scaling.csv` | derived | groups the 60 per-question rows (case-insensitive `scaling_subset == true`) by `arm` × `size_point`, 10 rows each. `median_prompt_tokens` is the median of `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` per group (the cache columns are 0 for every row in this file, so this coincides with `input_tokens` alone, both candidate definitions matched equally). `judge_accuracy` is the mean of `judge_correct`. See "Known mismatch" below: two of the six medians differ from the spec's expected values by 0.5. |
| `ws6b/cost_vs_history.csv` | `results/ws6b/runs.csv` | derived | filters `probe_set == 'scaling' && status == 'ok'` (72 of 125 rows), groups by `arm_base` × `size` (n=12 per group). The L-size replay arm is `replay_trunc` in the raw data (corpus truncated to 78.5% at L); its `arm_base` is relabelled `replay` in the output so the three sizes read as one series. `cost_billed_usd` is the median, computed in integer micro-dollars to avoid floating-point rounding drift before formatting to 5 decimal places. `judge_accuracy` is the mean of `judge_correct` on that same 12-row subset, so all three points (recall, quality, cost) share one n. `corpus_tokens` (98134 / 392116 / 1221906 for s/m/l) comes from `results/ws6b/corpus_stats.csv`, since `runs.csv` has no corpus-size column of its own. |
| `ws6b/parametric_gate_summary.csv` | `results/ws6b/parametric_gate.csv` | derived | one row summarising all 38 rows: `correct` = count of `judge_correct == 'True'` (0), `judge_accuracy` = correct / n (0.000), `verdict` = the single verdict value shared by every row (`pass`) |
| `ws6b/summary_l.csv` | `results/ws6b/summary_l.csv` | copied | none |
| `ws6b/judge_prompt.txt` | `results/ws6b/judge_prompt.txt` | copied by hand (not `derive.js`) | none, byte-for-byte, for backup 39 |
| `ws6b/skip_rate.csv` | `results/ws6b/skip_rate.csv` | copied | none |
| `ws6b/index_cost.csv` | `results/ws6b/index_cost.csv` | copied | none |
| `ws6c/paired_ci.csv` | `results/ws6c/paired_ci.csv` | copied | none. The paired restatement of WS6a's own frozen rows: zero API spend, computed over `results/ws6a/runs.csv` |
| `ws6c/paired_ci_scaling.csv` | `results/ws6c/paired_ci_scaling.csv` | copied | none. Paired deltas over WS6a's frozen `scaling.csv`, 10 `scaling_subset` questions at S, M and L |
| `ws6c/branches.csv` | `results/ws6c/branches.csv` | copied | none. Carries the pre-registered branch letter per (comparison, metric). Rows outside the spec's A/T/S/P series read `n/a (not pre-registered)`, and the `K_LESS`/`K_FLAT` labels carry a `plan:` prefix because they come from the implementation plan, not the pre-registration |
| `ws6c/summary.csv` | `results/ws6c/summary.csv` | copied | none. **Marginal per-arm medians, not paired deltas.** WS6c §9.1 shows the two carrying opposite signs on this very data. Use it for magnitudes; use `branches.csv` and `paired_ci.csv` for every verdict |
| `ws6c/nonmemorization_gate.csv` | `results/ws6c/nonmemorization_gate.csv` | copied | none |
| `ws6c/corpus_stats.csv` | `results/ws6c/corpus_stats.csv` | copied | none |
| `ws6c/index_cost.csv` | `results/ws6c/index_cost.csv` | copied | none. ⚠️ **Re-copied 2026-09-16 at the `ws9` pin: one row to three.** It now carries the measured index at all three sweep scopes, `scope` L / M / S, with chunk counts 7,441 / 3,324 / 2,099, `corpus_tokens_claude` 4,307,363 / 2,017,476 / 1,139,248 and `embed_cost_usd` 0.050975 / 0.022858 / 0.014457. Row 0 is still the L row. Any read that assumed a single row must now name a `scope`; `derive.js` joins on it |
| `ws6c/paired_grid.csv` | `results/ws6c/paired_ci.csv` + `results/ws6c/branches.csv` | derived | union of the four primary `prompt_tokens` deltas against the `agentic` arm. The fastapi `indexed` row comes from `paired_ci.csv` (which has no `corpus` column, so `fastapi` is added as a constant); the other three are the `branches.csv` rows with `metric == 'prompt_tokens'` and `arm_b == 'agentic'`. The `mean` column is dropped. No statistic is recomputed and every retained value is byte-identical to its source row |
| `ws6c/contamination.csv` | `results/ws6c/summary.csv` + `results/ws6c/nonmemorization_gate.csv` + `ws6b/parametric_gate_summary.csv` | derived | five rows for the contamination spectrum. fastapi's parametric `judge_accuracy` and `any_file_hit_rate` from the WS6c summary; the three gate candidates from the gate file; the WS6b synthetic corpus from the already-derived gate summary. Accuracies formatted to three decimals. `any_file_hit_rate` is blank on the synthetic row because WS6b's gate summary does not carry that column |
| `ws8/paired_ci.csv` | `results/ws8/paired_ci.csv` | copied | none. The per-stratum paired `indexed − agentic` deltas. ⚠️ The `hop2` rows carry `powered = False` and the string *"NOT POWERED: n=15 by design (spec section 3); reported as-is, cannot carry a claim"* **in the CSV itself**. Two `variant` values are present: the deck plots `all`, and `excl_ws8_q067` (the censored-row sensitivity) agrees |
| `ws8/branches.csv` | `results/ws8/branches.csv` | copied | none. Carries WS8's **primary** outcome, the `hop3plus_minus_hop1` contrast, and its pre-registered branch verdict `H4-confounded`. The `branch_if_hop1_were_null` column is `H2`, i.e. no effect detected: there is no positive hop finding being confounded away |
| `ws8/summary.csv` | `results/ws8/summary.csv` | copied | none. Marginal per-arm medians, the source of the "~4x" secondary. ⚠️ `accuracy_measured` here is **marginal, not paired**; WS8 computed no paired accuracy test, so the 0.50-vs-0.60 and 0.586-vs-0.667 gaps are not a claim that the index is less accurate |
| `ws8/corpus_stats.csv` | `results/ws8/corpus_stats.csv` | copied | none. 7,647 threads over three repos, 31.7M measured tokens, window `2026-06-01` to `2026-08-31` (postdates the training cutoff) |
| `ws8/questions_by_repo.csv` | `results/ws8/questions_by_repo.csv` | copied | none. 75 questions, from `kubernetes` (30) and `rust-lang` (45) only; `fastapi` contributed corpus but **no questions** |
| `ws8/parametric_gate.csv` | `results/ws8/parametric_gate.csv` | copied | none. The non-memorisation gate: n=75, accuracy `0.000`, `any_doc_hit` 0/75, branch `G1` (pass). ⚠️ `any_doc_hit` reads weaker than the underlying signal: the first gate run used the code-search system prompt, which asks for Python file paths, wrong for Go and Rust issue threads. It was re-run under a corrected prompt; accuracy `0.000` holds under both |
| `ws8/index_cost.csv` | `results/ws8/index_cost.csv` | copied | none. 45,888 chunks of 1,800 chars, `text-embedding-3-small`, $0.461456 to embed |
| `ws8/mde_retrospective.csv` | `results/ws8/mde_retrospective.csv` | copied | none. The retrospective power ladder behind "the null is uninformative below ~100,000 tokens". The `injected_gradient_tokens = 0` row is the null calibration: that power (0.043) IS the false-positive rate and lands near alpha. ⚠️ Its `role` column says `post-hoc diagnostic (does NOT affect the branch verdict)` |
| `ws8/robustness.csv` | `results/ws8/robustness.csv` | copied | none. Leave-k-out and false-positive-rate checks. The `contrast_fpr` rows publish **all three** defensible null pools rather than the flattering one |
| `ws8/forest.csv` | `results/ws8/paired_ci.csv` + `results/ws8/branches.csv` | derived | the four rows of `charts/ws8-forest.vl.json` (on `Backup: fine-tuning required` since 2026-09-16, `Fine-tuning required` in the main deck before that): the three strata from `paired_ci.csv` and the primary contrast from `branches.csv`, both read at `variant = 'all'`. Adds a `label`, a `row_order` and a `kind` (`stratum` / `contrast`) for the chart axis; carries `powered` through so the spec can mute `hop2` rather than deciding that itself. No statistic is recomputed and every retained value is byte-identical to its source row |
| `ws8/judge_prompt.txt` | `results/ws8/judge_prompt.txt` | copied by hand (not `derive.js`) | none, byte-for-byte, for the judge-prompts backup |
| `cost_per_correct.csv` | `results/ws6c/summary.csv` + `results/ws8/runs.csv` + `results/ws8/runs_parametric.csv` | derived | eleven rows for `charts/cost-per-correct.vl.json`: total agent spend over a whole run divided by the answers the judge marked correct. The only figure in the deck that is a **census rather than an estimate** — every question ran in every arm, so no interval is computed and none is drawable. Basis is `total_cost_agent_billed`, **judge cost excluded**: the judge is measurement apparatus and nobody runs one in production, so including it would add a near-constant to every arm. ⚠️ This means these numbers do **not** match the `2.26x` billed-per-question card on the contamination slide, which quotes the agent-plus-judge `total_cost_billed` basis. Same runs, different basis. fastapi and agentic_hil come straight out of the WS6c summary (which already carries an agent-only total); WS8 has no agent-only total in its summary — `total_cost_usd` there is agent plus judge — so the two **powered** strata are summed from the per-run files, 60 questions an arm. ⚠️ `hop2` is excluded because `ws8/paired_ci.csv` carries `powered = False` and *"cannot carry a claim"* for every hop2 row; including it would move the indexed arm from $0.8393 to $1.1285 and flatter the deck's case. `cost_per_correct_usd` is **blank, not zero**, where an arm got nothing right (parametric on agentic_hil, 0 of 40, and on ws8, 0 of 60): the ratio is undefined and the chart must not draw it. ⚠️ **Since 2026-09-16 the three `ws8_issues` rows are derived but not drawn**: the prose section moved to backup and `The actual $ I spent` now runs `signal-stage: [0, 1]`, so the chart's `datum.corpus_order <= stage` filter never reaches them. They are kept because the derivation, its validation and its caveats are unchanged, and restoring the band is a one-token edit to the slide |

> ⚠️ **`ws6a/summary.csv` is superseded for the `indexed` vs `agentic` contrast.**
> It still carries the marginal medians (16,452 and 9,485) that produce the
> published "+73.5% more tokens", and the marginal accuracies (1.000 and 0.975)
> that produce "+2.5pp". WS6a's design is **paired**, so neither is a statistic
> the design supports. The paired restatement is `ws6c/paired_ci.csv`:
> **+2,856.5 tokens, CI [+9.0, +7,691.5]** (branch A1), and accuracy
> **0.0, CI [0.0, 0.0]** (branch A3, the arms differed on 1 of 40 questions).
> `RESULTS-WS6a.md` §4 and §7 carry correction blocks to the same effect.
> **Do not re-derive +73.5% or +2.5pp from this file.** It is kept because the
> per-arm marginal medians, costs and setup effort are still cited elsewhere in
> the deck and are still correct as marginals.

## ⚠️ `ws4/summary.csv` is superseded for any threshold claim

`ws4/summary.csv` carries the `class` column (PLATEAU / DROP per arm per
metric) that the original r\* = 0.9231 plateau rule was read off. That
reading is **withdrawn**. `ws4e/rstar_final.csv` is the authority:

- WS4's r\* is a plateau rule, not a fit, so it has no CI of its own. It
  reproduces its own branch in 0.6749 of 10,000 paired resamples; 0.2787 of
  resamples find no plateau at all, meaning r\* does not exist under the
  rule's own definition; and 0.1904 of all resamples land within ±0.01 of
  the published point.
- WS4d fitted a real two-segment changepoint twice, at 11 arms and at 15.
  Both give τ = 0.789429 with CI widths 0.213005 and 0.212559 against a
  quotable bar (`N1_MAX_CI_WIDTH`) of 0.05, so both are branch N2.
- The `verdict` row reads RETIRED at 0.2126, 4.25x the bar.

**Do not print r\*, τ, or "the knee" from this file.** The quotable
replacement is the slope in `ws4d/solvable_changepoint.csv`:`all_eligible`,
0.235 [0.122, 0.353] judge-accuracy points per unit of recall@10. The
`class` column remains correct for what it actually is, a per-arm verdict
against the reference, and backup 44 still prints it as that.

## Slide 33 scorecard: tracker v2.2

Slide 33's fifteen claim lines are transcribed word for word from the
**claim tracker, version v2.2**, dated 2026-09-07. The tracker is not a
file in either repo (not in `talks/rag-cost-curve/`, not in
`/Users/simon/Projects/rag-cost-curve`); it was supplied directly by the
controller as the design spec's slide-33 table. `PLAN.md` in the source
repo carries a mirror of the tracker's verdicts that lags it by design and
must not be used to re-derive wording. Where the two conflicted, the
tracker's v2.2 table won, three times, all in the deck's favour over the
mirror's earlier reconstruction: **C1 is HELD**, not REFRAMED; **C10 is
HELD**, not REFRAMED; **C12 is one SPLIT verdict**, not an INVERTED verdict
plus a separate partial. The tracker's own em dashes were rendered as
colons on the slide (repo rule); the clause after each dash is otherwise
verbatim.

## Known mismatch: `ws6a/scaling_medians.csv`

The spec expects median prompt tokens of 6,040 / 7,873 / 8,151 for the
`agentic` arm at S/M/L. The derivation above reproduces M exactly (7,873) but
gives S = 6,040.5 and L = 8,150.5, each 0.5 token away from the spec's value,
in opposite rounding directions (S would need to round down to match, L would
need to round up). This was checked against every column definition the
context allowed (`input_tokens` alone and `input_tokens` plus both cache
columns, both give the same result here, since the cache columns are 0 for
every row in `scaling.csv`), and against the raw sorted `input_tokens` values
for both groups, which confirm 6,040.5 and 8,150.5 are the correct medians of
the ten values on file. No consistent rounding rule reconciles both points
with the spec at once, so the true computed medians are committed rather than
adjusted to fit.

As of the `24x the corpus, nothing we can detect` chart swap, no slide consumes
this file: `charts/scaling-tokens.vl.json` was the only reader and it has been
retired in favour of `charts/scaling-deltas.vl.json`, which draws the paired
intervals in `ws6c/paired_ci_scaling.csv` instead. The file stays committed as
the marginal-median backing for the speaker notes, and the 0.5-token mismatch
above no longer reaches a rendered slide.

## Audit 2026-09-16: the WS9 unseen-corpus fold-in

WS9 carried the corpus the model has never seen into WS5's own cost model at
three sizes, which retired a deck-side derivation and widened four copied
files. The whole `data/` tree was re-copied at the single `ws9` pin in this
pass and the split pin at the top of this file was retired with it.

**What changed upstream**, each asserted upstream against a pre-WS9 snapshot in
`tests/test_ws9_cost_model.py`:

| file | rows before | rows after | change |
|---|---|---|---|
| `ws5/break_even.csv` | 360 | 504 | +144 `code_unseen` rows; no column change; the 360 pre-existing rows byte-identical |
| `ws5/churn.csv` | 168 | 336 | +168 `code_unseen` rows; already had a `workload` column; the 168 `memory` rows byte-identical |
| `ws5/sensitivity.csv` | 48 | 96 | +48 `code_unseen` rows **and a new `workload` column**; the 48 `memory` rows byte-identical once `workload` is dropped |
| `ws5/postdiction_gate.csv` | 42 | 72 | +30 `code_unseen` rows; rows only |
| `ws6c/index_cost.csv` | 1 | 3 | the sweep's S and M scopes joined the existing L row |

**What changed in the deck.** `ws5/break_even_ws6c.csv` stopped being a
derivation and became a filtered copy (see its row in the table above).
`charts/cost-curve.vg.json` stage 6 went from one filled point to two series of
three, and was later renumbered to stage 5 (see the note at the end of this
section). Three citations gained a `workload` filter that is now load-bearing, and
one count moved because the gate got broader.

| claim | file:column | file value | slide value | result |
|---|---|---|---|---|
| slide 31 stage 6, unseen repo | `ws5/break_even_ws6c.csv:break_even_qpd` | `indexed` 36.990903 / 25.734208 / 63.792266; `indexed_topk3` 54.813822 / 23.705945 / 82.516378 | 37 / 26 / 64 and 55 / 24 / 83 | PASS. Byte copies of `break_even.csv`; see the re-walked row in the Audit 2026-09-07 table |
| gate citation, slide 30 notes and backup 45 | `ws5/postdiction_gate.csv:rel_error`, `basis=mean_billed` | max abs 0.0009 over **24** rows | "0.09 %, across 24 rows" | PASS, changed from 14 rows. The error did not move; the gate now spans `memory`, `code` and `code_unseen` rather than the first two |
| 69,000x mega-stat | `ws5/sensitivity.csv:max_spread_ratio`, `knob=infra_mode`, **`workload=memory`** | 68944.94 | 69,000x | PASS, unchanged. ⚠️ The filter is new and load-bearing: the same knob reads 7421.06 on `code_unseen`, and an unfiltered read is ambiguous |
| churn card, verdict slide | `ws5/churn.csv:c_live,break_even_qpd`, `size=L, regime=claude, infra_mode=dedicated`, **`workload=memory`** | 0.2902 to 3.8394; 10.42 to 0.74 | "$0.29 to $3.84", "10.4 to 0.7 a day" | PASS, unchanged. ⚠️ Same new load-bearing filter: `code_unseen` now has L rows too |
| memory headline, slide 30 | `ws5/break_even.csv:break_even_qpd`, `workload=memory` | S 333.76, M 14.84, L 10.42 | 334 / 15 / 10 | PASS, unchanged by WS9. Already filtered on `workload` |
| WS5 sensitivity backup table | `ws5/sensitivity.csv`, `workload=memory` throughout | nine knob rows unchanged | the nine table rows | PASS, unchanged. The slide now states that it is the memory workload |
| `ws4e/composition_check.csv`, `ws4e/slope_by_k.csv` | `note` column | internal task references dropped for the public release | not quoted on any slide | PASS. Prose-only; no numeric cell moved |

**One thing this pass deliberately did not do.** The `code_unseen` **marginal**
rows are now available and defensible (WS9 derives the footprint from the
measured chunk count rather than estimating it, which retired the refusal
recorded in the old `break_even_ws6c.csv` entry), but they are not on the chart.
That is an editorial call about how much a single frame can carry, not a claim
about the data. Same for the serverless extension: `ws5/serverless.csv` could
now cover this corpus at every size, since the vector counts are committed at
2,099 / 3,324 / 7,441, and it has not been extended.

**Removed from the chart on 2026-09-16, after the fold-in.** Two series came
off `charts/cost-curve.vg.json`, neither for a data reason:

- **open-weight, rented H100** (`regime=open_weight`). `break_even_qpd` is the
  string `inf` at S, because the regime's own cached replay is cheaper per
  query than an indexed query, and the regime is infeasible from M on its
  131,072 context. It drew as a hollow ring with an "∞ at S" label, a mark
  whose content was that there was no crossover. Still modelled upstream,
  still on the method slide, still a row in the WS5 sensitivity table.
- **the marginal deployment** (`infra_mode=marginal`, memory workload). The
  argument is made on `The floor can go to zero`, which cites
  `sensitivity.csv:max_spread_ratio` (68,944.94, `workload=memory`). Drawing
  break-even in thousandths of a query a day cost the rest of the chart a
  four-decade y zoom to say what one card says better.

Removing the marginal series emptied the stage that existed to zoom for it, so
the y domain is now fixed at `[5, 1000]` and the old stage 6 was renumbered to
stage 5. Later the same day the code workload was split back across two stages
and two slides, which restored a sixth: **stage 5 is fastapi alone and stage 6
is the unseen repo**, `The final break-even chart` runs `signal-stage:
[2, 3, 4, 5]` and the new `Code it has never seen` runs `[5, 6]`. **Both of
those were superseded later the same day**, when the chart was split a second
time so that each frame carries exactly one benchmark:
`Break-even on conversation memory` runs `[2, 3, 4]` (`workload=memory`),
`Code the model already knows` runs a bare `signal-stage: 5` (`workload=code`)
and `Code it has never seen` runs a bare `signal-stage: 6`
(`workload=code_unseen`). Nothing after stage 4 is additive: the memory and
OpenAI layers carry `&& stage < 5`, the fastapi layers `stage >= 5 && stage < 6`,
and each frame has its own x domain (`[80k, 1.5M]`, `[200k, 9M]`, `[700k, 7M]`),
its own tick labels and its own footnote. **The three footnotes exist because no
one line is true of all three frames**: the memory footnote alone carries the
measured cache hit rates `1.00 / 0.92 / 0.97` and the mean-billed basis, and it
now says so on the slide, because the memory section's own cost chart
(`charts/cost-vs-history.vg.json`, slide `Replay gets dearer, the index does
not`) plots `ws6b/cost_vs_history.csv:cost_billed_usd`, which is the **median
steady-state** basis and reads `0.0789` at M where the break-even model reads
`0.2030`. Both bases are asserted in `postdiction_gate.csv`, both are now
labelled on the slides that use them, and they must not be quoted against each
other. That split also drew the `live_arm=stuffed` row, which had
been speaker-note-only, and widened the stage-5 x domain from `[80k, 7M]` to
`[80k, 9M]` to fit it. No CSV changed and no cited figure moved: the audit rows above were re-walked against the same files
after the removal, and the one row that pointed at the chart's marginal line is
marked RETIRED in the Audit 2026-09-07 table.

**A pre-existing inconsistency this pass fixed.** `ws8/forest.csv` carried four
`label` values that had been hand-edited in the CSV at commit `525ee45` without
updating the `derive.js` constants that generate them, so running `derive.js`
silently reverted the wording. The constants now match the committed file and
`derive.js` is idempotent again. No numeric cell was involved.

## Audit 2026-09-13: the WS4e fold-in

The seven files under `ws4d/` and `ws4e/` were added on 2026-09-13 from
source-repo commit `2339864597c25dd2eb4fbb16a279509919be61f2`, which was
later than the commit then pinned at the top of this file. Every other file
in `data/` was unchanged and nothing was re-derived in that pass.

> ⚠️ **That sub-pin is superseded.** The 2026-09-16 WS9 re-pin re-copied every
> file, these seven included, at the single `ws9` commit. Two of them changed:
> `ws4e/composition_check.csv` and `ws4e/slope_by_k.csv` picked up a prose-only
> edit to their `note` column for the public release. **No numeric cell moved**,
> so every result below still holds as walked.

Values placed on slides in this pass:

| claim | file:column | file value | slide value | result |
|---|---|---|---|---|
| recall slide money card | `ws4d/solvable_changepoint.csv:slope,slope_ci_lo,slope_ci_hi`, row `all_eligible` | 0.234763, 0.121615, 0.352557 | +0.235, [0.122, 0.353] | PASS |
| scorecard C6 slope | same row | same | 0.235 [0.122, 0.353] | PASS, same number, same rounding |
| scorecard C6 "4.25x the quotable bar" | `ws4e/rstar_final.csv:ci_width`, row `verdict` | 0.2126 against `N1_MAX_CI_WIDTH` 0.05 | 4.25x | PASS, 0.2126 / 0.05 = 4.252 |
| depth slide separability | `ws4e/ceiling.csv:separable_rate`, k=1 and k=10 | 0.371212, 0.912879 | 0.37, 0.91 | PASS |
| depth slide fixed population | `ws4e/composition_check.csv:fixed_separable_rate`, k=1 and k=10 | 0.47959183673469385 at both | 0.4796 at both | PASS, the two rows are bit-identical in the file |
| depth chart endpoints | `ws4e/mediator_by_k.csv`, `arm=sq8_np512` | presence_at_k 0.530303 → 1.0, judge_accuracy 0.537879 → 0.674242 | 0.530 → 1.000, 0.538 → 0.674 | PASS |
| depth slide notes, marginal gold | `ws4e/conversion_composition_check.csv`, `sq8_np512`/`sq8_np48` at k=10 | newly-present conversion 0.3571 / 0.3704 against already-present 0.7119 / 0.7106 | "~0.36 against ~0.71 to 0.75" | PASS, the 0.75 end is `sq8_np512` at k=3 (0.7500), stated as a range across the sweep |
| recall-target slide, k=1 range | `ws4e/mediator_by_k.csv:judge_accuracy`, k=1, sq8_np1 to sq8_np512 | 0.473485 to 0.537879, difference 0.064394 | 0.064 | PASS |
| recall-target slide, k=10 range | same, k=10 | 0.530303 to 0.674242, difference 0.143939 | 0.144 | PASS |
| recall-target slide, k=3 range | same, k=3 | 0.473485 to 0.587121, difference 0.113636 | 0.114 | PASS. k=3 was added to the chart on 2026-09-15; it had been filtered out for legibility |
| recall-target slide, k=5 range | same, k=5 | 0.492424 to 0.617424, difference 0.125 | 0.125 | PASS as an **np1-to-np512 endpoint range**, which is how the k=1 and k=10 rows above are defined. ⚠️ NOT max-minus-min: k=5 peaks at `sq8_np48` (0.651515), so a max-min reading is 0.159091 and breaks the monotone-with-depth ordering. The notes say "from nprobe 1 to nprobe 512" for this reason |
| recall-target slide, depth ordering | `ws4e/slope_by_k.csv:slope`, k=1/3/5/10 | 0.149496, 0.280227, 0.362966, 0.375069 | "the same ordering the slope measure gives" | PASS, monotone increasing, matching the endpoint ranges 0.064394 / 0.113636 / 0.125 / 0.143939 |
| recall-target slide, k=3 and k=1 coincide at np1 | `ws4e/mediator_by_k.csv:judge_accuracy`, `sq8_np1`, k=1 and k=3 | 0.473485 and 0.473485, identical | "sit on top of each other at the left edge" | PASS, the two points genuinely coincide; this is data, not a plotting fault |
| recall-target slide, the top step | same, k=10, sq8_np48 to sq8_np512 | 0.670455 to 0.674242, difference 0.003787 | "0.4 points" | PASS, stated as percentage points. ⚠️ NOT a demonstrated gain: the two arms' CIs are [0.613636, 0.723485] and [0.617424, 0.731061], almost entirely overlapping. The slide claims the cost, not the gain |
| recall-target slide, 10.7x | arm definitions (`WS4E_ARMS`), nprobe 512 over nprobe 48 | 10.667 | 10.7x | PASS. nprobe is the search-cost knob, so this is cells scanned and needs no cross-workstream join |
| recall-target slide, ">= 4.3x slower" | `ws2/curves_10m.csv:qps`, arm `ivf_sq8`, nprobe 64 and 512 | 37.878102 and 8.769665, ratio 4.319 | "at least 4.3x slower" | PASS as a **bound**, not an estimate. np48 is not in WS2's sweep, but it is cheaper than the measured np64, so the true np48-to-np512 gap is at least this ratio. Stated on the slide with "at least" for that reason |
| recall-target cross-workstream join | `ws2/curves_10m.csv:recall_at_10` vs `ws4e/mediator_by_k.csv:recall_at_10`, `ivf_sq8`/`sq8_np512` at nprobe 512 | 0.99166 and 0.991288 | join asserted safe | PASS. The two workstreams read the same index to within 0.0004 at the one arm they share, which is what licenses quoting WS2's throughput against WS4e's accuracy |
| methodology slide strata | `ws4d/solvable_changepoint.csv:n_arms,n_questions`; `ws4e/ceiling.csv:n,arms` | 15 arms / 264 questions; 264 questions / 4 arms | "15 arms", "264-question stratum", "4 arms" | PASS |
| r\* removed from the recall chart | `ws4e/rstar_final.csv:status`, row WS4 | WITHDRAWN | no r\* drawn anywhere | PASS, `grep 0.923` over `slides.md` and `charts/` returns only `ws4/summary.csv`'s measured recall for `pca_uc_384_sq8@512` on backup 44, which is an arm's recall and not a threshold |

## Audit 2026-09-07

Every `<!-- src: -->` comment in `slides.md` (41) and every chart
`description` in `charts/*.json` (14) was walked by hand and by a throwaway
script kept outside this repo, in the SDD workspace
(`scripts/number-audit.mjs`). The script confirms every `data/*.csv` file
named in a src comment exists and that every column name it cites is a
literal header column in that file. The specific values below were checked
individually against the named file and column (rounding shown is expected
unless flagged).

| claim | file:column | file value | slide value | result |
|---|---|---|---|---|
| slide 27 headline compression | `ws3/dim_verdict_10m.csv:footprint_compression_vs_ivf_flat_1024`, arm `pca_uc_384_sq8` | 9.216722 | 9.22x | PASS, re-walked under ruling R26. Was 8.66x from `footprint_compression_vs_flat_1024_1m`, which carried the 1M denominator onto a 10M row; the new column is measured at 10M against the 42.31 GB IVF_FLAT index. The two sibling columns on the same row are 8.659581 (vs 1M FLAT) and 8.922159 (vs raw fp32), confirmed NOT the value quoted |
| slide 25 ladder rungs | `ws3/dim_verdict_1m.csv:best_recall_at_10,footprint_compression_vs_ivf_flat_1024`, the five `single_digit_loss=True` SQ8 arms | 0.99139/3.6156, 0.98168/4.8261, 0.95993/6.8795, 0.93922/7.9607, 0.90888/8.8833 | 0.99 to 3.6x, 0.98 to 4.8x, 0.96 to 6.9x, 0.94 to 8.0x, 0.91 to 8.9x | PASS, re-walked under ruling R26. Rungs are drawn by the chart, not quoted in prose, so the only edit was the column the spec reads |
| slide 33 C4/C13 8.7x | canonical tracker v2.2 (transcribed, not derived) | 8.6596 rounds to 8.7 at 2 s.f. | 8.7x | ⚠️ SUPERSEDED, not re-walked. The slide 33 scorecard was merged into the six mechanism cards (commit 362b2fe) and this line no longer appears in the deck. Kept as history. Under ruling R26 the underlying figure would now be 8.8833, which rounds to 8.9x |
| slide 20 stages | `ws2/c8_verdict_10m.csv:payload_compression,footprint_compression_vs_ivf_flat` | rabitq 32.0/14.565, pq_m128 32.0/15.931, pq_m256 16.0/10.749, sq8 4.0/3.655, refine 3.556/3.218 | 32x/14.6x, 32x/15.9x, 16x/10.7x, 4x/3.65x, 3.56x/3.22x | PASS, re-walked under ruling R26 |
| slide 21 two numbers | same file, arms `rabitq` and `rabitq_refine_sq8_k2` | payload 32.0, `footprint_compression_vs_ivf_flat` 3.2176 | 32x, 3.2x (labelled "vs the fp32 index") | PASS, re-walked under ruling R26. Ruling R24 settled that the old "vs raw fp32" label was correct for the old column; R26 changes the column, and the label moved with it. The denominator now matches slide 20's axis as it did before |
| slide 30 break-even | `ws5/break_even.csv:break_even_qpd`, filtered `hit_rate_basis=measured, infra_mode=dedicated, regime=claude, workload=memory` | S 333.76, M 14.84, L 10.42 | 334 / 15 / 10 | PASS, re-walked 2026-09-15 after the instance re-pin |
| slide 31 stage 6, unseen repo | `ws5/break_even_ws6c.csv:break_even_qpd`, a filtered copy of `ws5/break_even.csv` at `workload=code_unseen, live_arm=agentic, regime=claude, infra_mode=dedicated, hit_rate_basis=measured, footprint=pca_uc_384_sq8` | `indexed` 36.990903 / 25.734208 / 63.792266 and `indexed_topk3` 54.813822 / 23.705945 / 82.516378, at S / M / L | 37 / 26 / 64 and 55 / 24 / 83 on the chart; the same six in the speaker notes | PASS, re-walked 2026-09-16. Every cell is a **byte copy** of the upstream row, checked against `results/ws5/break_even.csv` at the `ws9` pin; `node derive.js` reproduces the file and asserts n = 37 per cell and `corpus_tokens` agreement with `ws6c/index_cost.csv` per scope. ⚠️ Was 58.94 / 70.44 at L over n = 40 before this pass; see the file's row above for why that is composition and not a new result |
| slide 30 stage 5, fastapi ∞ | `ws5/break_even.csv:break_even_qpd`, `workload=code, live_arm=agentic, regime=claude, infra_mode=dedicated, hit_rate_basis=measured` | `inf` at S, M and L | three hollow rings, "∞ at every size" | PASS. Read straight from the copied file, no derivation |
| slide 30 stage 5, fastapi stuffed | `ws5/break_even.csv:break_even_qpd`, `workload=code, live_arm=stuffed, regime=claude, infra_mode=dedicated, hit_rate_basis=measured, footprint=pca_uc_384_sq8` | `12.43389864688289` at L, `corpus_tokens` 6,232,509, `c_live` 0.2940356, `c_index_query` 0.06659835 | one filled amber circle, "12 a day", "whole repo stuffed into context" | PASS, new on the chart 2026-09-16. Read straight from the copied file, no derivation. ⚠️ **This row was speaker-note-only until the break-even slide was split in two**; it is drawn now because 'the index never repays on fastapi' and 'unless you stuff the context' are one argument and belong in one frame. ⚠️ **`stuffed` is a live arm, not an index arm, and is not the same thing as `replay`** (see the withdrawn finding in `DECK-AUDIT.md`): it re-sends the repository as a prompt-cached prefix, 960,124 mean input tokens a query over n = 40 (`ws6a/summary.csv:arm=stuffed`). ⚠️ **The x position is `corpus_tokens`, 6.2M, not the 960k prefix**, which is the same column every other mark on the chart uses and the same value as the fastapi L ∞ ring directly above it; the dashed rule joining the two is there to say they are one corpus with two live arms. Only the `claude` regime has a value: `openai` and `open_weight` are `feasible=False` at this size and their cells are empty |
| slide 30 marginal line | same filter, `infra_mode=marginal`, size M | 0.0009525 | ⚠️ **no longer on the chart** | RETIRED 2026-09-16. The marginal series was removed from `cost-curve.vg.json` and the deployment-floor argument now lives only on `The floor can go to zero`, which cites `sensitivity.csv:max_spread_ratio` rather than this row. The upstream row is unchanged |
| slide 30 OpenAI over-cap point | `ws5/break_even.csv:break_even_qpd_over_window,c_live_over_window`, filtered `regime=openai, workload=memory, size=L, hit_rate_basis=measured, infra_mode=dedicated, footprint=pca_uc_384_sq8` | 6.150310, 0.478913 | hollow ring at 6.15/day, speaker note says "48 cents a query" and "6 queries a day" | PASS, added 2026-09-15. ⚠️ This is the only figure on the chart that is a counterfactual rather than a measured-or-interpolated point: 959,282 live tokens exceed OpenAI's 922,000 input cap, so the request cannot be made. Drawn dotted with a hollow terminator, and flagged in the key subtitle, the method slide and the speaker note |
| slide 33 serverless floor | `ws5/serverless.csv`, rows `ws8_issues.billed_gb_upper`, `ws8_issues.pct_of_free_storage`, `ws8_issues.usd_per_query_max`; `ws5/break_even.csv:c_index_query` min and max | 0.246826, 4.9365, 0.00006; 0.0114765 to 0.0665983 | "0.25 GB" of 5 GB, "at most $0.00006" a query against "$0.011 to $0.067" of tokens | PASS. The per-query figure is a bound, and the slide says "at most" |
| slide 32 / backup 45 | `ws5/sensitivity.csv:max_spread_ratio`, `knob=infra_mode` | 68944.94 | 69,000x (slide 32 money stat) / 68,944.94x (backup 45 table) | PASS, expected two roundings of one number; re-walked 2026-09-15 after the instance re-pin |
| answerability stat cards | `ws4/answerability.csv:questions,share`, `arms_correct` 0, 11, and 4 to 7 | 173/0.3844, 150/0.3333, 6+8+8+10 = 32 | 38 % / 173, 33 % / 150, 7 % / 32 | PASS. The 7 % is 32/450 = 0.0711. ⚠️ The 4-to-7 band is a **choice of where to draw the contested middle**, not a boundary in the data: 127 questions (28 %) are neither 0 nor 11. The speaker notes carry both numbers |
| answerability worked questions | `ws4/answerability_examples.csv` | qid 907 0/11, gold `I Write Sins Not Tragedies`, 4 "Marry You" / 2 "Hallelujah" / 2 "Death of a Bachelor" / 3 declines; qid 264 11/11, gold `Lord Irwin`, eleven byte-identical `Lord Irwin`; qid 3129 6/11, gold `Mike Post`, 6 `Mike Post` / 5 `I don't know` | "Four arms said Marry You ... Four named a different Panic! song. Three declined"; "Eleven arms, eleven byte-identical answers"; "Six arms said Mike Post. The other five said I don't know. Not one got it wrong" | PASS, recounted off the file. Marry You is a Bruno Mars song, which is the slide's point and is not a claim the data makes; Hallelujah and Death of a Bachelor are both Panic! At The Disco. qid 3129's five non-answers are all `idk = True`, so "not one got it wrong" is exact |
| slide 28 mediator counts | `ws4/mediator.csv` (transcribed from `RESULTS-WS4.md` section 6) | 214/0.58, 106/0.29, 48/0.13 | 214 / 106 / 48, 58% / 29% / 13% | PASS, cross-checked against `RESULTS-WS4.md` section 6's own table |
| postdiction gate | `ws5/postdiction_gate.csv:rel_error`, `basis=mean_billed` | 14 rows, max abs rel_error 0.0009 | "0.09 %, mean-billed basis, across 14 rows" (slide 30 notes, backup 45) | PASS. Both citations repointed from `RESULTS-WS5.md` to this file under ruling R23 |
| slide 24 / 36 transform ceiling | `ws3/transform_ceiling_1m.csv:recall_at_10`, `dim=512` | mrl 0.70035, pca 0.8271, pca_uc 0.96374 | 0.700 / 0.827 / 0.964 | PASS |
| refinement funnel | `ws2/curves_10m.csv:arm,sweep_value,recall_at_10,qps`, arm `rabitq` and `rabitq_refine_sq8_k2` | rabitq@nprobe 256 0.77763/2.72, k2@nprobe 256 0.98562/3.44, k2@nprobe 1024 0.99200/0.88 | 77.8% / 98.6% / 99.2% | PASS. Prior values on this slide (87% / 97% / 99%+) were unsourced illustrative figures: bare RaBitQ never exceeds 0.7776 at 10M or 0.7411 at 1M, and no FP32-refine or re-ranker arm was ever run, so the 99%+ was attributed to a stage that was not measured. The three values now walk one arm along its own nprobe sweep and agree with the backup 37 k-anchor table. |
| backup 37 k-anchor table | `ws2/curves_10m.csv`, best `recall_at_10`/`sweep_value`/`qps` per arm | rabitq 0.7776/256/2.72, k1 0.9793/256/1.94, k2 0.9920/1024/0.88, k5 0.9921/1024/0.64, k10 0.9849/256/1.89 | matches table exactly | PASS |
| backup 38 ground truth | `ws1/gt_verification.csv` | 1M: 50/50, 45/50, 12, 0; 10M: 50/50, 50/50, 0, 0 | matches table exactly | PASS |
| backup 39 judge reliability | `RESULTS-WS4.md` section 9 | "60 of 60 verdicts agree ... against a 0.95 threshold" | verbatim match | PASS |
| backup 40 setup effort | `ws6a/setup_effort.csv` | parametric 0/0/0/0/0, stuffed 4/0/0/0/0, agentic 4/0/0/0/1, indexed 8/70/2/3/4 | matches table exactly | PASS |
| backup 42 M2 pairs | `ws4/pairs.csv`, `metric=judge` rows | diffs and CIs for pairs A-F | matches table exactly, including matched=True/False per pair | PASS |
| backup 44 WS4 secondary metrics | `ws4/summary.csv:class`, all four metrics per arm | `sq8_np16` and `mrl_512_sq8_np512` both PLATEAU on em/f1, DROP on judge | matches the two highlighted rows exactly | PASS |
| slide 35 nlist / heap | `benchlib/config.py` (`WS4_NLIST = 4096`), `RESULTS-WS3.md:232-237` | 4096; "~54 MiB", "5 %" at 1024d, "28 %" at 128d | matches | PASS |
| slide 9 inversion | `ws6a/summary.csv`, arms `agentic`/`indexed`, fastapi corpus | tokens +73.45 %, `total_cost_agent_billed` +22.55 % (rounds to 23 %), judge_accuracy +2.5 pp | "73.5 % more tokens... cost 23 % more... +2.5 pp" | PASS |
| slide 7-13 WS6a stats | `ws6a/summary.csv` | cache_savings_ratio 0.8477, total_cost_agent_billed ratio 5.41, judge_accuracy 0.9/0.625, per-question cost 0.294 | 84.8 %, 5.4x, 0.900, 0.625, $0.29 | PASS |
| slide 15-16 B1 / window | `ws6b/cost_vs_history.csv`, `ws6b/summary_l.csv` | replay 0.01995/0.07890/0.19405 (L truncated to 78.5%), memsearch 0.01048/0.01045/0.01880 (approx); L: memsearch 1.000 vs replay_trunc 0.474, cost/correct 0.0188 vs 0.6126 (32.6x) | matches | PASS |
| slide 17 index cost / skip rate | `ws6b/index_cost.csv`, `ws6b/skip_rate.csv` | embed cost sum 0.001+0.004032+0.012601=0.017633; skip rates 0.999656/0.999656/0.998279 | $0.0176; 99.97 % / 99.97 % / 99.83 % | PASS |
| slide 13 parametric gate | `ws6b/parametric_gate_summary.csv` | n=38, correct=0, judge_accuracy=0.000 | "0 of 38" | PASS |
| `The study` rig diagram | `ws6c/summary.csv:n` (8 corpus-arm rows at 40), `ws6a/summary.csv:n` (arm `stuffed`, 40, fastapi only), `ws6a/judge_prompt.txt` | 40 x 2 corpora x 4 arms = 320, plus the fastapi-only stuffed arm = 360; the judge prompt states "You will NOT be told how the answer was produced" | "360 answers scored", "blind to arm" | PASS. The three ws6a rows other than `stuffed` are the same runs as ws6c's fastapi rows (identical medians and totals; `ws6c/paired_ci.csv` is computed over `results/ws6a/runs.csv`), so they are not counted twice |
| slide 33 fifteen lines | canonical tracker v2.2 (see "Slide 33 scorecard" section above) | HELD 11 (C1,C2,C3,C5,C6,C7,C9,C10,C13,C14,C15), REFRAMED 2 (C4,C8), INVERTED 1 (C11), SPLIT 1 (C12) | matches word for word except em dash to colon | PASS |
| slide 33 C4/C8 denominators | `ws3/dim_verdict_1m.csv` (C4, 1M); `ws2/c8_verdict_10m.csv` (C8, 10M) | see slides 25 and 20/21 rows above for the underlying values | footnote added under ruling R25 (below) | ⚠️ SUPERSEDED, not re-walked. The scorecard and its `stamp-sub` footnote went with commit 362b2fe. Ruling R25 would in any case be moot under R26: both lines now carry the same denominator, which is the gap R25 existed to paper over |
| slide 31 small corpora | `ws6a/summary.csv:judge_accuracy,total_cost_agent_billed` (arm `agentic`), `ws6a/setup_effort.csv:steps,external_accounts,failed_attempts` (arm `indexed`), `ws5/break_even.csv:break_even_qpd` (`size=S, regime=claude, infra_mode=dedicated, hit_rate_basis=measured`) | judge_accuracy 0.975, total_cost_agent_billed/40 0.054345, steps 8 / external_accounts 2 / failed_attempts 4, break_even_qpd 333.76 | "0.975 accuracy at $0.054 per question, index setup 8 steps, 2 accounts, 4 failed attempts" / "375 queries per day" | PASS. `total_cost_billed`/40 (0.0659) does not match the quoted $0.054; the agent-billed column does |

**Ruling R24.** The plan's denominator-label list for the audit was wrong
for slide 21, not the deck: slide 21's "vs raw fp32" is correct as built.
WS2's 10M dataset (`c8_verdict_10m.csv`) has no vs-FLAT column, so vs raw
fp32, matching slide 20's axis, is the only denominator its data supports.

**Ruling R25.** Slide 33's C4 and C8 verdict lines are the verbatim
canonical tracker wording (locked at Task 11's review) and do not carry a
denominator inline. Unlike slide 21, this was judged a real gap: C4's
3.5x-8.7x is the 1M vs-FLAT-1024d figure (same as slide 25) and C8's
3.1x-3.54x is the 10M vs-raw-fp32 figure (same as slides 20/21), and a
reader of the scorecard alone cannot tell that these two REFRAMED lines use
two different denominators from two different scales without having just
seen slides 20-25. Fixed by adding one muted footnote line under the
scorecard, `<p class="stamp-sub">C4 footprint vs FLAT 1024d at 1M. C8: 32x
is payload; 3.1x to 3.54x is footprint vs raw fp32 at 10M.</p>`, with a src
comment naming both files. No new CSS: `.stamp-sub` already exists in the
deck's CSS banner.

**Ruling R26.** Every footprint-compression ratio in the deck now divides by
the measured `ivf_flat_fp32` load at its own scale, 4.26 GB at 1M and 42.31 GB
at 10M, via a `footprint_compression_vs_ivf_flat` column that `derive.js`
appends on copy. The two denominators upstream ships both exclude the index
from the baseline while every numerator includes it: raw fp32 is the analytic
n x d x 4, and measured FLAT is brute-force storage plus Milvus heap. That
compared an index against a non-index and understated every compression figure
by 3 to 4 %. Three consequences worth recording. First, `ivf_flat_fp32` now
sits at exactly 1.00x, so the chart's 1x reference is a real measured point
rather than a nominal one, and its recall is visible as 0.995 at 1M and 0.970
at 10M rather than implied to be 1.0. Second, the 1M and 10M slides share a
denominator for the first time and are comparable point for point: SQ8 3.60x
against 3.65x, RaBitQ plus refine 3.19x against 3.22x. (The 1M slide moved to
the backups on 2026-09-16 as `Backup: recall vs compression (1M)`, for running
time rather than for anything in the data. No figure here moved with it, and
the comparability this paragraph records is exactly why it is still worth
pulling. **Backup 41, `C8 at 1M`, was retired the same day** as a duplicate of
it: same twelve arms, same `curves_1m.csv`, same denominator, drawn statically
instead of staged, and without the `hnsw_fp32` point. `charts/backup-c8-1m.vl.json`
was deleted with it. Nothing in this paragraph was re-derived for either change,
and `ws2/curves_1m.csv` is still live: the surviving 1M chart reads it.) The
caveats on slides 20, 21 and the since-retired backup 41 telling a reader not to
compare them were removed, and
ruling R25's footnote became moot. Third, WS3's 10M headline improved as a
side effect: it had been quoting `footprint_compression_vs_flat_1024_1m`, the
*1M* denominator applied to a 10M row, and is now measured at 10M, 8.66x to
9.22x. The upstream columns are all still present and every pre-existing `src`
pointer still resolves. ⚠️ Not changed: WS5's cost model took its footprint
multiplier from the old `footprint_compression_vs_flat_1024_1m` (8.66x for
`pca_uc_384_sq8`, see `scripts/cost-model/build_ws5_notebook.py:190-195`), so
the break-even CSVs in `ws5/` are still computed on the old denominator. They
are copied from upstream, not recomputed here, and re-deriving them needs the
source repo's toolchain. The gap is 6 % on the footprint term, which the
sensitivity table already shows moves break-even by 1.00x, so no `ws5` figure
in the deck moves. Recorded rather than silently reconciled.

No other discrepancy was found. Every value traced back to a named file and
column exists and matches within expected rounding.

### 2026-09-08 audit, WS6c fold-in

Re-walked every `<!-- src: -->` comment in `slides.md` and every chart
`description` after the WS6c update. All citations resolve to an existing file,
column and value.

Scope of this walk: 55 `<!-- src: -->` comments in `slides.md` and 16 chart
`description` fields, one per spec in `charts/`. All resolve to an existing
file, column and value.

**Numbers that reach a slide without a CSV of their own.** These are cited to
`RESULTS-WS6c.md` by section rather than to a column, and are reproducible from
committed inputs in the source repo but stated by no committed CSV:

- The measured shipped default `limit = 10`: `results/ws6c/topk_provenance.txt`,
  read from the pinned package's own `dist/handlers.js`.
- The `limit`-supplied call counts, 1 of 119 in the default arm and 0 of 221 in
  the constrained arm: counted from the committed transcripts, §5.4.
- The near-miss robustness table in the `85 tokens` speaker notes: sensitivity
  re-runs over `results/ws6c/runs.csv`, §5.2. **Not committed results.** The
  committed branch resolution is the alpha 0.05, seed 42, `n_boot` 10,000 row in
  `branches.csv` and nothing in that table displaces it.
- The 8.4x file-count comparison: `ws6c/corpus_stats.csv` (342) against
  `results/ws6a/repo_stats.csv` (2,888), which this deck does not carry.
- The vendor bug in `The study`'s speaker notes: §6, mechanism read from the
  package source.

### 2026-09-13, the churn figure on `Where each side wins.`

The churn card previously read "losing the replay cache takes L from $0.29 to
$1.92 per query", cited to `ws5/churn.csv`. `churn.csv` contains no $1.92 at
any size, arm or regime: its `c_live` column holds exactly six distinct values,
$0.0199 / $0.2030 / $0.2902 with the cache measured at S / M / L, and $0.3929 /
$1.5689 / $3.8394 with it invalidated. The $1.92 came from `break_even.csv` at
`hit_rate_basis=uncached_list`, a different basis: invalidation prices a cache
re-write at 2x base input, `uncached_list` prices a plain uncached read, and the
two differ by exactly that factor. The wording mapped to the churn model while
the number mapped to the list-price model.

Resolved by quoting the churn model on both sides, which is the option that
strengthens the inversion rather than softening it: $0.29 to $3.84 per query at
L, with `break_even_qpd` falling 10.42 to 0.74, cited to `ws5/churn.csv` with
the row selectors named. `deck_review.md` section 1 raised this and lists the
alternative; the deck takes its option (a).

This figure now has an audit row, which the 2026-09-07 walk did not give it. It
propagates: the spec document's C15 row still carries "$0.29 to $1.92/q at L"
and is not this repo's to edit.

**The 2026-09-07 audit section above is a dated record and has not been
rewritten.** Two things about it are no longer true of the deck. Its slide
numbers predate this update, which took the deck from 46 slides to 48, moved
four memsearch slides into the backup block and replaced two others, so those
numbers no longer resolve; slides are referenced by title everywhere in the
current deck. And its "slide 9 inversion" row records `+73.45%` tokens and
`+2.5 pp` accuracy as PASS. Both are retracted: they are differences of
medians on a paired design, superseded by `ws6c/paired_ci.csv` per the
supersession warning on the `ws6a/summary.csv` row above. The row stands as a
record of what was checked on 2026-09-07, not as a current citation.
