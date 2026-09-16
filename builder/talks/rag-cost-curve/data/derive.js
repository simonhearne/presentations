// Run by hand from talks/rag-cost-curve/data:  node derive.js
// Output is committed. SOURCES.md records what came from where.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SRC = '/Users/simon/Projects/rag-cost-curve/results';

const COPY = [
  ['ws1/gt_verification.csv', 'ws1/gt_verification.csv'],
  ['ws2/curves_10m.csv', 'ws2/curves_10m.csv'],
  ['ws2/curves_1m.csv', 'ws2/curves_1m.csv'],
  ['ws2/c8_verdict_10m.csv', 'ws2/c8_verdict_10m.csv'],
  ['ws3/dim_verdict_1m.csv', 'ws3/dim_verdict_1m.csv'],
  ['ws3/dim_verdict_10m.csv', 'ws3/dim_verdict_10m.csv'],
  ['ws3/transform_ceiling_1m.csv', 'ws3/transform_ceiling_1m.csv'],
  ['ws4/summary.csv', 'ws4/summary.csv'],
  ['ws4/pairs.csv', 'ws4/pairs.csv'],
  ['ws4d/solvable_changepoint.csv', 'ws4d/solvable_changepoint.csv'],
  ['ws4e/rstar_final.csv', 'ws4e/rstar_final.csv'],
  ['ws4e/ceiling.csv', 'ws4e/ceiling.csv'],
  ['ws4e/mediator_by_k.csv', 'ws4e/mediator_by_k.csv'],
  ['ws4e/composition_check.csv', 'ws4e/composition_check.csv'],
  ['ws4e/slope_by_k.csv', 'ws4e/slope_by_k.csv'],
  ['ws4e/conversion_composition_check.csv', 'ws4e/conversion_composition_check.csv'],
  ['ws5/break_even.csv', 'ws5/break_even.csv'],
  ['ws5/churn.csv', 'ws5/churn.csv'],
  ['ws5/sensitivity.csv', 'ws5/sensitivity.csv'],
  ['ws5/postdiction_gate.csv', 'ws5/postdiction_gate.csv'],
  ['ws6a/summary.csv', 'ws6a/summary.csv'],
  ['ws6a/setup_effort.csv', 'ws6a/setup_effort.csv'],
  ['ws6b/summary_l.csv', 'ws6b/summary_l.csv'],
  ['ws6b/skip_rate.csv', 'ws6b/skip_rate.csv'],
  ['ws6b/index_cost.csv', 'ws6b/index_cost.csv'],
  ['ws6c/paired_ci.csv', 'ws6c/paired_ci.csv'],
  ['ws6c/paired_ci_scaling.csv', 'ws6c/paired_ci_scaling.csv'],
  ['ws6c/branches.csv', 'ws6c/branches.csv'],
  ['ws6c/summary.csv', 'ws6c/summary.csv'],
  ['ws6c/nonmemorization_gate.csv', 'ws6c/nonmemorization_gate.csv'],
  ['ws6c/corpus_stats.csv', 'ws6c/corpus_stats.csv'],
  ['ws6c/index_cost.csv', 'ws6c/index_cost.csv'],
  ['ws8/paired_ci.csv', 'ws8/paired_ci.csv'],
  ['ws8/branches.csv', 'ws8/branches.csv'],
  ['ws8/summary.csv', 'ws8/summary.csv'],
  ['ws8/corpus_stats.csv', 'ws8/corpus_stats.csv'],
  ['ws8/questions_by_repo.csv', 'ws8/questions_by_repo.csv'],
  ['ws8/parametric_gate.csv', 'ws8/parametric_gate.csv'],
  ['ws8/index_cost.csv', 'ws8/index_cost.csv'],
  ['ws8/mde_retrospective.csv', 'ws8/mde_retrospective.csv'],
  ['ws8/robustness.csv', 'ws8/robustness.csv'],
];

for (const [from, to] of COPY) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(join(SRC, from), to);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // no-op
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function readCsv(path) {
  return parseCsv(readFileSync(path, 'utf8'));
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// RFC 4180 quoting. Every derivation before the WS4 answerability examples
// wrote bare numbers and comma-free labels, so this is a no-op on their output;
// the example rows carry verbatim model answers, which are not either.
function csvField(value) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, cols) {
  return [cols.join(','), ...rows.map(r => cols.map(c => csvField(r[c])).join(','))].join('\n') + '\n';
}

function toMicros(v) {
  return Math.round(parseFloat(v) * 1e6);
}

function formatUsd(micros) {
  return (Math.round(micros / 10) * 10 / 1e6).toFixed(5);
}

// Derived: a footprint denominator that includes the index structure.
// Upstream ships two, and neither counts the index in the baseline: raw fp32
// is the analytic n x d x 4, and measured FLAT is brute-force storage plus
// Milvus heap. Both sit only in the numerator, so every ratio understates the
// win. This column divides by the measured IVF_FLAT fp32 index at the row's
// own scale, making the comparison index-vs-index. WS3 borrows the WS2
// measurement exactly as upstream's notebook borrows WS2's flat_fp32 for its
// own vs-FLAT column (03_dimensionality.ipynb, "the measured WS2 FLAT load is
// the primary reference so WS3 points overlay directly on the WS2 chart").
function appendColumn(path, name, valueFor) {
  const text = readFileSync(path, 'utf8');
  const rows = parseCsv(text);
  const lines = text.replace(/\n$/, '').split('\n');
  if (lines.length - 1 !== rows.length) {
    throw new Error(`${path}: ${rows.length} rows but ${lines.length - 1} body lines`);
  }
  const out = [`${lines[0]},${name}`];
  rows.forEach((row, i) => out.push(`${lines[i + 1]},${valueFor(row)}`));
  writeFileSync(path, out.join('\n') + '\n');
}

function ivfFlatLoadedBytes(path) {
  const row = readCsv(path).find(r => r.arm === 'ivf_flat_fp32');
  if (!row) throw new Error(`${path}: no ivf_flat_fp32 row to use as baseline`);
  return parseFloat(row.loaded_bytes);
}

const IVF_FLAT_1M = ivfFlatLoadedBytes('ws2/curves_1m.csv');
const IVF_FLAT_10M = ivfFlatLoadedBytes('ws2/curves_10m.csv');

for (const [path, baseline] of [
  ['ws2/curves_1m.csv', IVF_FLAT_1M],
  ['ws2/curves_10m.csv', IVF_FLAT_10M],
  ['ws2/c8_verdict_10m.csv', IVF_FLAT_10M],
]) {
  appendColumn(path, 'footprint_compression_vs_ivf_flat',
    row => baseline / parseFloat(row.loaded_bytes));
}

// WS3 reports its load as MiB at 1M and GiB at 10M, and carries no fp32 arm
// of its own, so the baseline comes from WS2 at the matching scale. At 10M
// that is a genuine 10M measurement, where upstream's flat_1024_1m column
// carries the 1M figure across.
appendColumn('ws3/dim_verdict_1m.csv', 'footprint_compression_vs_ivf_flat_1024',
  row => IVF_FLAT_1M / (parseFloat(row.loaded_MiB) * 2 ** 20));
appendColumn('ws3/dim_verdict_10m.csv', 'footprint_compression_vs_ivf_flat_1024',
  row => IVF_FLAT_10M / (parseFloat(row.loaded_GiB) * 2 ** 30));

// Derived: WS4 answerability, how many of the eleven retrieval arms answered
// each question correctly. The closed-book parametric arm is dropped, so the
// count is "how many indexes could carry this question", not "how many runs
// happened to be right": including it would let a question the weights already
// know score 1 with every index having failed.
const WS4_ARMS = 11;
const ws4ByQid = new Map();
for (const r of readCsv(join(SRC, 'ws4/runs.csv'))) {
  if (r.subset !== 'main' || r.arm === 'parametric') continue;
  if (!ws4ByQid.has(r.qid)) ws4ByQid.set(r.qid, []);
  ws4ByQid.get(r.qid).push(r);
}
for (const [qid, rs] of ws4ByQid) {
  if (rs.length !== WS4_ARMS) {
    throw new Error(`ws4/runs.csv: qid ${qid} has ${rs.length} arms, expected ${WS4_ARMS}`);
  }
}
const ws4Correct = new Map([...ws4ByQid].map(([qid, rs]) =>
  [qid, rs.filter(r => r.judge_correct === 'True').length]));
const answerabilityRows = [];
for (let k = 0; k <= WS4_ARMS; k++) {
  const questions = [...ws4Correct.values()].filter(c => c === k).length;
  answerabilityRows.push({
    arms_correct: k,
    questions,
    share: (questions / ws4ByQid.size).toFixed(4),
  });
}
mkdirSync('ws4', { recursive: true });
writeFileSync('ws4/answerability.csv', toCsv(answerabilityRows, ['arms_correct', 'questions', 'share']));

// The three worked questions on that slide, one row per arm and verbatim: the
// slide quotes a tally of what the arms said, and grouping near-identical
// wordings ("Marry You" against "\"Marry You\"") is a judgement call, not a
// derivation. Ship every answer unnormalised so the tally can be recounted.
const WS4_EXAMPLE_QIDS = [['never', '907'], ['always', '264'], ['split', '3129']];
const WS4_EXAMPLE_COLS = ['bucket', 'qid', 'arms_correct', 'question', 'golds', 'arm', 'answer', 'idk', 'judge_correct'];
const answerabilityExampleRows = WS4_EXAMPLE_QIDS.flatMap(([bucket, qid]) => {
  const rs = ws4ByQid.get(qid);
  if (!rs) throw new Error(`ws4/runs.csv: no qid ${qid} in the main subset`);
  return [...rs].sort((a, b) => a.arm.localeCompare(b.arm)).map(r => ({
    bucket,
    qid,
    arms_correct: ws4Correct.get(qid),
    question: r.question,
    golds: r.golds,
    arm: r.arm,
    answer: r.answer,
    idk: r.idk,
    judge_correct: r.judge_correct,
  }));
});
writeFileSync('ws4/answerability_examples.csv', toCsv(answerabilityExampleRows, WS4_EXAMPLE_COLS));

// Derived: ws6a scaling medians, one row per arm per size.
// Raw scaling.csv is per-question; the chart needs the median prompt tokens.
const scaling = readCsv(join(SRC, 'ws6a/scaling.csv'));
const scalingSubset = scaling.filter(r => r.scaling_subset.toLowerCase() === 'true');
const sizeOrder = { S: 0, M: 1, L: 2, s: 0, m: 1, l: 2 };
const scalingGroups = new Map();
for (const r of scalingSubset) {
  const key = `${r.arm}|${r.size_point}`;
  if (!scalingGroups.has(key)) scalingGroups.set(key, []);
  scalingGroups.get(key).push(r);
}
const scalingMedianRows = [...scalingGroups.entries()]
  .map(([key, rs]) => {
    const [arm, size] = key.split('|');
    const promptTokens = rs.map(r => Number(r.input_tokens) + Number(r.cache_creation_input_tokens) + Number(r.cache_read_input_tokens));
    const acc = rs.filter(r => r.judge_correct === 'True').length / rs.length;
    return {
      arm,
      size,
      corpus_tokens: rs[0].corpus_tokens,
      median_prompt_tokens: median(promptTokens),
      judge_accuracy: acc.toFixed(3),
      n: rs.length,
    };
  })
  .sort((a, b) => a.arm.localeCompare(b.arm) || sizeOrder[a.size] - sizeOrder[b.size]);
mkdirSync('ws6a', { recursive: true });
writeFileSync('ws6a/scaling_medians.csv', toCsv(scalingMedianRows, ['arm', 'size', 'corpus_tokens', 'median_prompt_tokens', 'judge_accuracy', 'n']));

const CORPUS_TOKENS_WS6B = { s: 98134, m: 392116, l: 1221906 };
const runs = readCsv(join(SRC, 'ws6b/runs.csv'));
const scalingRuns = runs.filter(r => r.probe_set === 'scaling' && r.status === 'ok');
const runGroups = new Map();
for (const r of scalingRuns) {
  const arm = r.arm_base === 'replay_trunc' ? 'replay' : r.arm_base;
  const key = `${arm}|${r.size}`;
  if (!runGroups.has(key)) runGroups.set(key, []);
  runGroups.get(key).push(r);
}
const costVsHistoryRows = [...runGroups.entries()]
  .map(([key, rs]) => {
    const [arm, size] = key.split('|');
    const micros = rs.map(r => toMicros(r.cost_billed_usd));
    const acc = rs.filter(r => r.judge_correct === 'True').length / rs.length;
    return {
      arm,
      size,
      corpus_tokens: CORPUS_TOKENS_WS6B[size],
      cost_billed_usd: formatUsd(median(micros)),
      judge_accuracy: acc.toFixed(3),
      n: rs.length,
    };
  })
  .sort((a, b) => a.arm.localeCompare(b.arm) || sizeOrder[a.size] - sizeOrder[b.size]);
mkdirSync('ws6b', { recursive: true });
writeFileSync('ws6b/cost_vs_history.csv', toCsv(costVsHistoryRows, ['arm', 'size', 'corpus_tokens', 'cost_billed_usd', 'judge_accuracy', 'n']));

const gate = readCsv(join(SRC, 'ws6b/parametric_gate.csv'));
const gateCorrect = gate.filter(r => r.judge_correct === 'True').length;
const gateVerdicts = new Set(gate.map(r => r.verdict));
if (gateVerdicts.size !== 1) throw new Error('mixed verdicts in parametric_gate.csv');
const gateSummaryRows = [{
  n: gate.length,
  correct: gateCorrect,
  judge_accuracy: (gateCorrect / gate.length).toFixed(3),
  verdict: [...gateVerdicts][0],
}];
writeFileSync('ws6b/parametric_gate_summary.csv', toCsv(gateSummaryRows, ['n', 'correct', 'judge_accuracy', 'verdict']));

// Derived: the four primary WS6c token intervals in one frame.
// The fastapi indexed-vs-agentic row lives only in paired_ci.csv, which carries
// no corpus column; the other three live only in branches.csv. The forest chart
// needs all four together. Nothing is recomputed.
const GRID_COLS = ['corpus', 'arm_a', 'arm_b', 'metric', 'branch', 'n', 'median', 'ci_low', 'ci_high', 'n_positive', 'sign_p', 'excludes_zero'];
const pairedCi = readCsv(join(SRC, 'ws6c/paired_ci.csv'));
const branches = readCsv(join(SRC, 'ws6c/branches.csv'));
const gridRows = [
  ...pairedCi
    .filter(r => r.arm_a === 'indexed' && r.arm_b === 'agentic' && r.metric === 'prompt_tokens')
    .map(r => ({ ...r, corpus: 'fastapi' })),
  ...branches.filter(r => r.metric === 'prompt_tokens' && r.arm_b === 'agentic'),
];
if (gridRows.length !== 4) throw new Error(`expected 4 paired_grid rows, got ${gridRows.length}`);
mkdirSync('ws6c', { recursive: true });
writeFileSync('ws6c/paired_grid.csv', toCsv(gridRows, GRID_COLS));

// Derived: the contamination spectrum, five corpora from three sources.
// fastapi's parametric row and any_file_hit come from the WS6c summary; the
// three gate candidates from the gate file; the WS6b synthetic corpus from the
// gate summary already derived above. any_file_hit_rate is blank for the
// synthetic row because WS6b's gate summary does not carry that column.
const CONTAM_COLS = ['slug', 'label', 'n', 'judge_accuracy', 'any_file_hit_rate', 'source'];
const ws6cSummary = readCsv(join(SRC, 'ws6c/summary.csv'));
const fastapiParametric = ws6cSummary.find(r => r.corpus === 'fastapi' && r.arm === 'parametric');
if (!fastapiParametric) throw new Error('no fastapi parametric row in ws6c/summary.csv');
const gateRows = readCsv(join(SRC, 'ws6c/nonmemorization_gate.csv'));
const contamRows = [
  {
    slug: 'fastapi',
    label: 'fastapi (well-known OSS)',
    n: fastapiParametric.n,
    judge_accuracy: Number(fastapiParametric.judge_accuracy).toFixed(3),
    any_file_hit_rate: Number(fastapiParametric.any_file_hit_rate).toFixed(3),
    source: 'ws6c/summary.csv',
  },
  ...gateRows.map(r => ({
    slug: r.slug,
    label: r.repo.split('/')[1],
    n: r.n,
    judge_accuracy: Number(r.judge_accuracy).toFixed(3),
    any_file_hit_rate: Number(r.any_file_hit_rate).toFixed(3),
    source: 'ws6c/nonmemorization_gate.csv',
  })),
  {
    slug: 'ws6b_synthetic',
    label: 'synthetic history (WS6b)',
    n: gateSummaryRows[0].n,
    judge_accuracy: gateSummaryRows[0].judge_accuracy,
    any_file_hit_rate: '',
    source: 'ws6b/parametric_gate_summary.csv',
  },
];
writeFileSync('ws6c/contamination.csv', toCsv(contamRows, CONTAM_COLS));

// Derived: the WS8 forest rows, three strata plus the pre-registered contrast.
// The strata live in paired_ci.csv and the contrast only in branches.csv, and
// the chart needs them on one axis. Both are read at variant='all'; the
// excl_ws8_q067 sensitivity variant agrees and is not plotted. Nothing is
// recomputed -- every value is byte-identical to its source row, and `powered`
// is carried through so the chart can mark hop2 rather than the spec deciding.
const WS8_COLS = ['row_order', 'kind', 'stratum', 'label', 'n', 'powered', 'median', 'ci_low', 'ci_high', 'excludes_zero', 'sign_p', 'n_indexed_dearer', 'branch'];
const WS8_LABELS = {
  hop1: '1 hop: the answer is in one thread',
  hop2: '2 hops: underpowered (n=15 by design)',
  hop3plus: '3+ hops: the answer spans three or more threads',
};
const ws8Paired = readCsv(join(SRC, 'ws8/paired_ci.csv'));
const ws8Branches = readCsv(join(SRC, 'ws8/branches.csv'));
const ws8StrataRows = ['hop1', 'hop2', 'hop3plus'].map((stratum, i) => {
  const r = ws8Paired.find(x => x.variant === 'all' && x.stratum === stratum && x.metric === 'prompt_tokens');
  if (!r) throw new Error(`no ws8 paired_ci row for ${stratum}`);
  return {
    row_order: i,
    kind: 'stratum',
    stratum,
    label: WS8_LABELS[stratum],
    n: r.n,
    powered: r.powered,
    median: r.median_delta,
    ci_low: r.ci_lo,
    ci_high: r.ci_hi,
    excludes_zero: r.excludes_zero,
    sign_p: r.sign_p,
    n_indexed_dearer: r.n_indexed_dearer,
    branch: '',
  };
});
const ws8Contrast = ws8Branches.find(r => r.variant === 'all' && r.metric === 'prompt_tokens' && r.role === 'PRIMARY');
if (!ws8Contrast) throw new Error('no ws8 PRIMARY contrast row');
const ws8ForestRows = [...ws8StrataRows, {
  row_order: 3,
  kind: 'contrast',
  stratum: ws8Contrast.comparison,
  label: '3+ hops minus 1 hop: the pre-registered contrast',
  n: '',
  powered: 'True',
  median: ws8Contrast.median,
  ci_low: ws8Contrast.ci_lo,
  ci_high: ws8Contrast.ci_hi,
  excludes_zero: ws8Contrast.excludes_zero,
  sign_p: '',
  n_indexed_dearer: '',
  branch: ws8Contrast.branch,
}];
mkdirSync('ws8', { recursive: true });
writeFileSync('ws8/forest.csv', toCsv(ws8ForestRows, WS8_COLS));


// Derived: cost per correct answer, three corpora on one axis.
//
// This is the only figure in the deck that is a census rather than an estimate:
// total agent spend over the whole run, divided by the number of answers the
// judge marked correct. No interval, because nothing is being inferred -- every
// question ran in every arm and the sum is the sum.
//
// Basis is agent-billed, NOT agent-plus-judge. The judge is measurement
// apparatus and nobody runs one in production, so including it would inflate
// every arm by a constant that no user would ever pay. Note this differs from
// the `total_cost_billed` basis the 2.26x card quotes, which does include it.
//
// fastapi and agentic_hil come straight out of ws6c/summary.csv, which already
// carries total_cost_agent_billed per arm. WS8 has no agent-only total in its
// summary (total_cost_usd there is agent plus judge), so the two powered strata
// are summed from the per-run files. hop2 is excluded: paired_ci.csv carries
// powered=False and the string "cannot carry a claim" for every hop2 row, and
// pooling it into a headline number would be exactly the move the section
// before this one argues against.
//
// cost_per_correct_usd is left blank where the arm got nothing right. It is not
// zero and it is not infinity, it is undefined, and the chart must not draw it.
const CPC_COLS = ['corpus_order', 'corpus', 'corpus_label', 'arm', 'arm_label', 'n', 'n_correct', 'judge_accuracy', 'total_cost_agent_usd', 'cost_per_correct_usd'];
const ARM_LABELS = {
  parametric: 'no retrieval',
  agentic: 'agentic (grep)',
  indexed: 'indexed top-k 10',
  indexed_topk3: 'indexed top-k 3',
};
const CPC_ARMS = ['parametric', 'agentic', 'indexed_topk3', 'indexed'];

function cpcRow(corpusOrder, corpus, corpusLabel, arm, n, nCorrect, agentUsd) {
  return {
    corpus_order: corpusOrder,
    corpus,
    corpus_label: corpusLabel,
    arm,
    arm_label: ARM_LABELS[arm],
    n,
    n_correct: nCorrect,
    judge_accuracy: (nCorrect / n).toFixed(3),
    total_cost_agent_usd: agentUsd.toFixed(4),
    cost_per_correct_usd: nCorrect ? (agentUsd / nCorrect).toFixed(4) : '',
  };
}

const CPC_CORPORA = [
  ['fastapi', 'fastapi: code the model knows'],
  ['agentic_hil', 'agentic-hil: code it has never seen'],
];
const cpcRows = [];
CPC_CORPORA.forEach(([corpus, label], i) => {
  for (const arm of CPC_ARMS) {
    const r = ws6cSummary.find(x => x.corpus === corpus && x.arm === arm);
    if (!r) throw new Error(`no ws6c/summary row for ${corpus}/${arm}`);
    const n = Number(r.n);
    const nCorrect = Math.round(Number(r.judge_accuracy) * n);
    cpcRows.push(cpcRow(i, corpus, label, arm, n, nCorrect, Number(r.total_cost_agent_billed)));
  }
});

// WS8, powered strata only.
const WS8_POWERED = new Set(['hop1', 'hop3plus']);
const ws8Runs = [
  ...readCsv(join(SRC, 'ws8/runs.csv')),
  ...readCsv(join(SRC, 'ws8/runs_parametric.csv')),
].filter(r => WS8_POWERED.has(r.stratum));
for (const arm of ['parametric', 'agentic', 'indexed']) {
  const rs = ws8Runs.filter(r => r.arm === arm);
  if (rs.length !== 60) throw new Error(`expected 60 powered ws8 rows for ${arm}, got ${rs.length}`);
  const nCorrect = rs.filter(r => r.judge_correct === 'True').length;
  const agentUsd = rs.reduce((a, r) => a + Number(r.cost_agent_billed), 0);
  cpcRows.push(cpcRow(2, 'ws8_issues', 'GitHub issues: prose (1 and 3+ hop)', arm, rs.length, nCorrect, agentUsd));
}
for (const r of cpcRows) {
  for (const c of CPC_COLS) {
    if (String(r[c]).includes(',')) throw new Error(`comma in ${c}: ${r[c]} -- toCsv does not quote`);
  }
}
writeFileSync('cost_per_correct.csv', toCsv(cpcRows, CPC_COLS));


// Copied, not derived: WS5 break-even for the corpus the model has never seen.
//
// This was a derivation until WS9. Upstream's break_even.csv modelled the
// memory workload at three sizes and the code workload on fastapi only, so the
// deck recovered WS5's fixed-cost model from two anchor rows and ran it over
// the ws6c agentic_hil arms itself. WS9 retired that: break_even.csv now
// carries workload == 'code_unseen' at S, M and L, computed by the same
// notebook cell and the same benchlib/cost_model.py arithmetic as every other
// row. Every cost number below is a STRING COPY of the upstream cell, never
// re-rounded and never recomputed, so the deck has one source for them.
//
// Three columns the chart needs are not in break_even.csv and are added here:
// index_topk (read off index_arm), corpus_label (a deck constant), and n plus
// the two judge accuracies (grouped out of ws6c/scaling.csv, which is the
// panel these rows were costed over). No statistic is recomputed.
//
// The marginal rows exist upstream too, and are no longer refused: WS9 derives
// the index footprint from the measured chunk count rather than estimating it.
// This file stays dedicated-only because that is what the chart draws; the
// marginal rows are one filter away in ws5/break_even.csv.
const BE_COLS = ['corpus', 'corpus_label', 'size', 'live_arm', 'index_arm', 'index_topk',
  'corpus_tokens', 'regime', 'infra_mode', 'n', 'c_live', 'c_index_query', 'saving_per_query',
  'embed_once', 'infra_month', 'fixed_daily', 'break_even_qpd',
  'judge_accuracy_live', 'judge_accuracy_index'];

const BE_TOPK = { indexed: '10', indexed_topk3: '3' };

// n and the per-arm accuracies come from the panel itself, not from a restated
// figure: 37 questions at every size, because the panel is decided once at S
// from gold paths alone (q09, q30, q31 have gold outside src/) and the same
// population runs across the curve.
const ws9Scaling = readCsv(join(SRC, 'ws6c/scaling.csv'));
const ws9Panel = new Map();
for (const r of ws9Scaling) {
  const key = `${r.size_point}/${r.arm}`;
  if (!ws9Panel.has(key)) ws9Panel.set(key, []);
  ws9Panel.get(key).push(r);
}
const ws9PanelCell = key => {
  const rs = ws9Panel.get(key);
  if (!rs) throw new Error(`ws6c/scaling.csv: no rows for ${key}`);
  if (rs.length !== 37) throw new Error(`ws6c/scaling.csv: ${key} has n=${rs.length}, expected the 37-question panel`);
  const correct = rs.filter(r => String(r.judge_correct).toLowerCase() === 'true').length;
  return { n: String(rs.length), accuracy: (correct / rs.length).toFixed(4) };
};

const ws9IndexCost = readCsv(join(SRC, 'ws6c/index_cost.csv'));
const beUnseen = readCsv(join(SRC, 'ws5/break_even.csv'))
  .filter(r => r.workload === 'code_unseen' && r.live_arm === 'agentic' && r.regime === 'claude'
    && r.infra_mode === 'dedicated' && r.hit_rate_basis === 'measured'
    && r.footprint === 'pca_uc_384_sq8');
if (beUnseen.length !== 6) {
  throw new Error(`ws5/break_even.csv: ${beUnseen.length} code_unseen dedicated rows, expected 6 (3 sizes x 2 index arms)`);
}

const beRows = beUnseen
  .sort((a, b) => Number(a.corpus_tokens) - Number(b.corpus_tokens) || a.index_arm.localeCompare(b.index_arm))
  .map(r => {
    const topk = BE_TOPK[r.index_arm];
    if (!topk) throw new Error(`ws5/break_even.csv: unmapped index_arm ${r.index_arm}`);
    // The corpus token count on the row must be the one the index was built
    // over, or the x position on the chart is not the thing that was measured.
    const scope = ws9IndexCost.find(x => x.scope === r.size);
    if (!scope) throw new Error(`ws6c/index_cost.csv: no row for scope ${r.size}`);
    if (Number(scope.corpus_tokens_claude) !== Number(r.corpus_tokens)) {
      throw new Error(`corpus_tokens disagree at ${r.size}: break_even ${r.corpus_tokens} vs index_cost ${scope.corpus_tokens_claude}`);
    }
    if (!(Number(r.break_even_qpd) > 0) || !Number.isFinite(Number(r.break_even_qpd))) {
      throw new Error(`ws5/break_even.csv: ${r.size}/${r.index_arm} break_even_qpd is ${r.break_even_qpd}`);
    }
    const live = ws9PanelCell(`${r.size}/agentic`);
    const index = ws9PanelCell(`${r.size}/${r.index_arm}`);
    if (live.n !== index.n) throw new Error(`${r.size}: arms disagree on n, ${live.n} vs ${index.n}`);
    return {
      corpus: 'agentic_hil',
      corpus_label: 'agentic-hil: code it has never seen',
      size: r.size,
      live_arm: r.live_arm,
      index_arm: r.index_arm,
      index_topk: topk,
      corpus_tokens: r.corpus_tokens,
      regime: r.regime,
      infra_mode: r.infra_mode,
      n: index.n,
      c_live: r.c_live,
      c_index_query: r.c_index_query,
      saving_per_query: r.saving_per_query,
      embed_once: r.embed_once,
      infra_month: r.infra_month,
      fixed_daily: r.fixed_daily,
      break_even_qpd: r.break_even_qpd,
      judge_accuracy_live: live.accuracy,
      judge_accuracy_index: index.accuracy,
    };
  });
for (const r of beRows) {
  for (const c of BE_COLS) {
    if (String(r[c]).includes(',')) throw new Error(`comma in ${c}: ${r[c]} -- toCsv does not quote`);
  }
}
writeFileSync('ws5/break_even_ws6c.csv', toCsv(beRows, BE_COLS));

// Derived: ws5 serverless free-tier fit.
//
// Rates and allowances read from https://zilliz.com/pricing#calculator on
// 2026-09-15 (Serverless tab, GCP us-west1), by driving the calculator and
// solving for its model. Every constant below is measured off that page, not
// assumed:
//
//   vCU price          $4.00 per million vCU, identical for reads and writes.
//                      (100M vCU -> $400.00, 50M -> $200.00, 15M -> $60.00,
//                      5M -> $20.00, 1.5M -> $6.00, 0.15M -> $0.60.)
//   write metering     vCU per entity written = vector_bytes / 4096. Measured
//                      at 736 B -> 0.18, 3072 B -> 0.75, 6144 B -> 1.5 vCU.
//                      So the write rate is a function of dimension and dtype,
//                      NOT a flat per-entity price.
//   storage            billed GB = entities x vector_bytes x 1.165 at FP16
//                      (1.048 at FP32). $0.30 per GB-month in GCP us-west1;
//                      the rate varies by region.
//   read metering      linear in read count, sub-linear in collection size.
//                      Measured at 1536d FP16: 15 vCU per read at 1M entities,
//                      50 vCU per read at 10M. The calculator will not model a
//                      collection below 1M entities, which is 22x larger than
//                      the biggest corpus in this deck, so the 1M reading is
//                      carried here as an UPPER BOUND on a deck-sized read and
//                      is labelled as such. Nothing extrapolates below it.
//   free tier          $0, 5 GB storage, 2.5M vCU per month, up to 5
//                      collections (stated on the pricing page itself).
const SL_URL = 'https://zilliz.com/pricing#calculator';
const SL_USD_PER_MILLION_VCU = 4.0;
const SL_BYTES_PER_WRITE_VCU = 4096;
const SL_STORAGE_MULT_FP16 = 1.165;
const SL_USD_PER_GB_MONTH = 0.30;      // GCP us-west1
const SL_FREE_GB = 5.0;
const SL_FREE_VCU = 2.5e6;
const SL_FREE_COLLECTIONS = 5;
const SL_READ_VCU_AT_1M = 15;          // 1536d FP16; upper bound below 1M entities
const DAYS_PER_MONTH = 30.4375;

const slRows = [];
const slPush = (kind, item, value, unit, note) => slRows.push({ kind, item, value, unit, note });
const vcuUsd = v => v * SL_USD_PER_MILLION_VCU / 1e6;

slPush('rate', 'vcu', SL_USD_PER_MILLION_VCU, 'usd_per_million_vcu', 'same price for reads and writes');
slPush('rate', 'storage', SL_USD_PER_GB_MONTH, 'usd_per_gb_month', 'GCP us-west1; varies by region');
slPush('model', 'bytes_per_write_vcu', SL_BYTES_PER_WRITE_VCU, 'bytes', 'write vCU = vector_bytes / 4096');
slPush('model', 'storage_multiplier_fp16', SL_STORAGE_MULT_FP16, 'x', 'billed GB over raw FP16 vector bytes');
slPush('model', 'read_vcu_at_1m_entities_1536d', SL_READ_VCU_AT_1M, 'vcu_per_read', 'UPPER BOUND for any smaller collection; calculator floor is 1M entities');
slPush('model', 'read_vcu_at_10m_entities_1536d', 50, 'vcu_per_read', 'shows reads grow sub-linearly with collection size');
slPush('free', 'storage', SL_FREE_GB, 'gb', 'stated on the pricing page');
slPush('free', 'compute', SL_FREE_VCU, 'vcu_per_month', 'stated on the pricing page');
slPush('free', 'collections', SL_FREE_COLLECTIONS, 'collections', 'the deck indexed 8 corpora in total so not all at once on one free account');
slPush('rate', 'writes_1536d_fp16', +(1e6 * (1536 * 2 / SL_BYTES_PER_WRITE_VCU) * SL_USD_PER_MILLION_VCU / 1e6).toFixed(4), 'usd_per_million_writes', 'the deck embedding: 3072 B per vector');
slPush('rate', 'writes_368d_fp16', +(1e6 * (368 * 2 / SL_BYTES_PER_WRITE_VCU) * SL_USD_PER_MILLION_VCU / 1e6).toFixed(4), 'usd_per_million_writes', 'for contrast: a 368d vector is 4.17x cheaper to write than a 1536d one');

const slCorpora = [
  ['ws6b_l', readCsv(join(SRC, 'ws6b/index_cost.csv')).find(r => r.size === 'l').milvus_count, 1536, null],
  ['ws6c_agentic_hil', readCsv(join(SRC, 'ws6c/index_cost.csv'))[0].chunk_count, 1536, null],
  ['ws8_issues', readCsv(join(SRC, 'ws8/index_cost.csv'))[0].milvus_count, 1536,
    parseFloat(readCsv(join(SRC, 'ws8/index_cost.csv'))[0].chunk_chars)],
];
for (const [name, nRaw, dims, chunkChars] of slCorpora) {
  const n = parseInt(nRaw, 10);
  const vecBytes = dims * 2;
  const vecGb = n * vecBytes * SL_STORAGE_MULT_FP16 / 1e9;
  const payloadGb = chunkChars ? n * chunkChars / 1e9 : 0;
  const billedGb = vecGb + payloadGb;
  const ingestVcu = n * vecBytes / SL_BYTES_PER_WRITE_VCU;
  slPush('corpus', `${name}.n_vectors`, n, 'vectors', '');
  slPush('corpus', `${name}.vector_gb`, +vecGb.toFixed(6), 'gb', 'n x 3072 B x 1.165 storage multiplier');
  slPush('corpus', `${name}.payload_gb_upper`, +payloadGb.toFixed(6), 'gb', chunkChars ? `n x ${chunkChars} chunk-char cap; upper bound` : 'chunk_chars not recorded; payload not modelled');
  slPush('corpus', `${name}.billed_gb_upper`, +billedGb.toFixed(6), 'gb', 'vector plus payload upper bound');
  slPush('corpus', `${name}.pct_of_free_storage`, +(billedGb / SL_FREE_GB * 100).toFixed(4), 'percent', '');
  slPush('corpus', `${name}.ingest_vcu`, Math.round(ingestVcu), 'vcu', 'one-off; 0.75 vCU per 1536d FP16 entity');
  slPush('corpus', `${name}.ingest_usd_if_paid`, +vcuUsd(ingestVcu).toFixed(6), 'usd', 'what the one-off ingest would cost outside the free tier');
  slPush('corpus', `${name}.pct_of_free_vcu`, +(ingestVcu / SL_FREE_VCU * 100).toFixed(4), 'percent', '');
  slPush('corpus', `${name}.usd_per_query_max`, +vcuUsd(SL_READ_VCU_AT_1M).toFixed(8), 'usd', 'UPPER BOUND: priced at the 1M-entity read; this corpus is far smaller');
  slPush('corpus', `${name}.free_queries_per_day_min`, Math.floor((SL_FREE_VCU - ingestVcu) / SL_READ_VCU_AT_1M / DAYS_PER_MONTH), 'queries_per_day', 'LOWER BOUND: same 1M-entity read bound; after ingest in the loading month');
}
mkdirSync('ws5', { recursive: true });
writeFileSync('ws5/serverless.csv', toCsv(slRows, ['kind', 'item', 'value', 'unit', 'note']));
