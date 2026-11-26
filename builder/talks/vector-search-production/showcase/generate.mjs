#!/usr/bin/env node
// Builds the three showcase slides from vector_search_ecom's probes/probe_boombox.json (PoC vs
// production), results/showcase.json (narrow filter) and probes/probe_campaign.json (boosts on): copies the thumbnails they show into this folder and writes the slide bodies to
// snippets.html, for pasting into slides.md under each slide's heading.
//
//   node talks/vector-search-production/showcase/generate.mjs --src ~/Projects/vector_search_ecom

import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../../../bin/build.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const POC_QUERY = '18462';
const FILTER_KEY = '<0.1%|109822';
const SLOTS = 10;
const LABEL_NAMES = { E: 'exact', S: 'substitute', C: 'complement', I: 'irrelevant' };
const SOURCE_NAMES = { esci: 'ESCI human label', judge: 'LLM judge' };

export function parseArgs(argv) {
  const i = argv.indexOf('--src');
  if (i === -1 || !argv[i + 1]) throw new Error('usage: generate.mjs --src <path to vector_search_ecom>');
  return { src: resolve(argv[i + 1]) };
}

export function shortTitle(title, max = 30) {
  const t = title.replace(/^\s*\[[^\]]*\]\s*/, '').split(/\s[-–|]\s|[,([|]/)[0].trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s/&+-]+$/, '') + '…';
}

// Full name minus any leading [tag]; only very long ones are cut, at a word.
export function longTitle(title, max = 88) {
  const t = title.replace(/^\s*\[[^\]]*\]\s*/, '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,/&+-]+$/, '') + '…';
}

function renderThumb(card, images) {
  const file = card.image && images.get(card.image);
  if (!file) return `<span class="result-thumb is-missing" role="img" aria-label="no image: ${escapeHtml(card.title)}">no image</span>`;
  return `<span class="result-thumb"><img loading="lazy" src="../showcase/${file}" alt="${escapeHtml(card.title)}"></span>`;
}

// The label is spelled out; a person icon marks the human ones, the rest are the LLM judge's.
function renderPill(card) {
  if (!card.label) return '<span class="pill">unjudged</span>';
  const human = card.label_source === 'esci' ? ' is-human' : '';
  const what = `${LABEL_NAMES[card.label]}, ${SOURCE_NAMES[card.label_source] || 'unknown source'}`;
  return `<span class="pill is-${card.label.toLowerCase()}${human}" title="${escapeHtml(what)}">${LABEL_NAMES[card.label]}</span>`;
}

export function renderRow(card, i, images) {
  const hit = card.label === 'E' ? ' is-hit' : '';
  return `<li class="result${hit}"><span class="rank">${String(i + 1).padStart(2, '0')}</span>${renderThumb(card, images)}<span class="title">${escapeHtml(longTitle(card.title))}</span>${renderPill(card)}</li>`;
}

export function renderSlot(card, images) {
  if (!card) return '<li class="result-slot is-empty" aria-label="no result"><span class="result-thumb"></span></li>';
  return `<li class="result-slot">${renderThumb(card, images)}<span class="result-title">${escapeHtml(shortTitle(card.title))}</span></li>`;
}

export function renderStrip({ label, stats, results, warn = false }, images) {
  const values = stats.map(s => `<div><span class="stat-value">${escapeHtml(s.value)}</span><span class="stat-note">${escapeHtml(s.note)}</span></div>`).join('');
  const slots = Array.from({ length: SLOTS }, (_, i) => renderSlot(results[i], images)).join('\n');
  return [
    '<div class="result-strip">',
    `<div class="stat-card${warn ? ' is-warn' : ''}"><span class="stat-label">${escapeHtml(label)}</span><div class="strip-stats">${values}</div></div>`,
    `<ol class="result-slots">\n${slots}\n</ol>`,
    '</div>',
  ].join('\n');
}

const thousands = n => `${Math.round(n / 1000)}k`;

export function renderPocSlide(pv, nRows, images) {
  const row = pv.rows.find(r => r.query_id === POC_QUERY);
  if (!row) throw new Error(`poc_vs_prod: no row with query_id ${POC_QUERY}`);
  if (pv.mode !== 'dense_text') throw new Error(`poc_vs_prod: the slide says dense vectors, the run was ${pv.mode}`);
  const slice = pv.collections[0].match(/_(\d+k)$/)?.[1] ?? '';
  const section = (label, s) => [
    '<div class="section">',
    `<div class="section-title"><span>${escapeHtml(label)}</span><span class="score">nDCG@10 <strong>${s['ndcg@10'].toFixed(3)}</strong></span></div>`,
    `<ol class="results">\n${s.results.slice(0, SLOTS).map((c, i) => renderRow(c, i, images)).join('\n')}\n</ol>`,
    '</div>',
  ].join('\n');
  return [
    '<div class="search-demo result-compare">',
    `<div class="header"><div class="query">${escapeHtml(row.query)}</div><div class="technique"><strong>Dense vector search, no keywords</strong><span>Qwen3-Embedding-0.6B · HNSW, ef ${pv.ef} · same on both</span></div><div class="label-key"><span><span class="pill is-human">label</span> by a human</span><span>others: LLM judge</span></div></div>`,
    '<div class="body">',
    section(`PoC · ${slice} ${pv.poc_category} slice`, row.poc),
    section(`Production · ${thousands(nRows)} products`, row.prod),
    '</div>',
    '</div>',
    '<p class="closing-line is-emphatic fragment">A slice flatters this query but starves others: over all 50 PoC queries nDCG is 0.06, against 0.64 in production, mostly from missing categories.</p>',
  ].join('\n');
}

function renderStars(min) {
  const on = Math.round(min);
  return `<span class="stars" aria-hidden="true">${'★'.repeat(on)}<span class="is-off">${'★'.repeat(5 - on)}</span></span>`;
}

export function renderFilters(f) {
  const chip = (field, value) => `<span class="filter-chip"><span class="field">${field}</span>${value}</span>`;
  const chips = [chip('Category', escapeHtml(f.category))];
  if (f.price_min != null && f.price_max != null) chips.push(chip('Price', `$${Math.round(f.price_min)}–${Math.round(f.price_max)}`));
  if (f.rating_min != null) chips.push(chip('Rating', `${renderStars(f.rating_min)} ${f.rating_min}+`));
  if (f.brand) chips.push(chip('Brand', escapeHtml(f.brand)));
  return `<div class="filter-chips">${chips.join('')}</div>`;
}

export function renderFilterSlide(nf, images) {
  const row = nf.rows.find(r => r.key === FILTER_KEY);
  if (!row) throw new Error(`narrow_filter: no row with key ${FILTER_KEY}`);
  const bucket = nf.rows.filter(r => r.key.startsWith(`${nf.bucket}|`));
  const empty = bucket.filter(r => r.rabitq.returned === 0).length;
  const shortPct = (nf.short_rate.rabitq * 100).toFixed(1);
  const side = (label, s, warn) => ({
    label,
    warn,
    results: s.results || [],
    stats: [{ value: `${s.returned} of ${SLOTS}`, note: `recall@10 ${s['recall@10'].toFixed(1)}` }],
  });
  return [
    '<div class="search-demo result-filter">',
    `<div class="header"><div class="query">${escapeHtml(row.query)}</div>${renderFilters(row.filter)}<div class="match-count"><strong>${row.n_matches}</strong> of ${row.n_rows.toLocaleString('en-GB')}<br>products match</div></div>`,
    '<div class="result-strips">',
    renderStrip(side('HNSW', row.hnsw, false), images),
    renderStrip(side(`IVF_RABITQ · nprobe ${nf.rabitq.nprobe}`, row.rabitq, true), images),
    '</div>',
    '</div>',
    `<p class="closing-line fragment">IVF_RABITQ at nprobe ${nf.rabitq.nprobe} comes back short on ${shortPct}% of narrow filters like this one, and empty on ${empty} of ${bucket.length}.</p>`,
  ].join('\n');
}

function renderBoostSlot(card, images) {
  const sale = card.on_sale ? ' is-sale' : '';
  return `<li class="result-slot${sale}">${renderThumb(card, images)}${sale && '<span class="sale-tag">sale</span>'}</li>`;
}

const pct = v => `${(v * 100).toFixed(v > 0.99 ? 1 : 0)}%`;
const points = arm => (Math.abs(arm.all.minus_off[0]) * 100).toFixed(1).replace(/\.0$/, '');

export function renderBoostSlide(bc, images) {
  const chip = (field, value) => `<span class="filter-chip"><span class="field">${field}</span>${value}</span>`;
  const chips = [
    chip('Synthetic campaign', 'Black Friday sale'),
    chip('On sale', `${thousands(bc.n_on_sale)} products, ${bc.n_brands.toLocaleString('en-GB')} random brands`),
    chip('The boost', 'sale products: score × weight'),
  ].join('');
  const strip = arm => [
    '<div class="result-strip fragment">',
    `<div class="stat-card${arm.weight && arm['ndcg@10'] < 0.5 ? ' is-warn' : ''}"><strong class="boost-name">${arm.weight ? `Boost ×${arm.weight}` : 'No boost'}</strong><div class="strip-stats"><div><span class="stat-value">${arm.all['ndcg@10'].toFixed(2)}</span><span class="stat-note">nDCG@10</span></div><div><span class="stat-value">${pct(arm.all.reach)}</span><span class="stat-note">pages with sale</span></div></div></div>`,
    `<ol class="result-slots">\n${arm.results.slice(0, SLOTS).map(c => renderBoostSlot(c, images)).join('\n')}\n</ol>`,
    '</div>',
  ].join('\n');
  const [mild, strong] = bc.arms.filter(a => a.weight);
  return [
    '<div class="search-demo result-filter result-boost">',
    `<div class="header"><div class="query">${escapeHtml(bc.query)}</div><div class="filter-chips">${chips}</div></div>`,
    '<div class="result-strips">',
    ...bc.arms.map(strip),
    '</div>',
    '</div>',
    `<p class="closing-line is-emphatic fragment">A promotion costs relevance, the weight sets how much: ×${mild.weight} costs ${points(mild)} nDCG points, ×${strong.weight} costs ${points(strong)}.</p>`,
    `<p class="setup-line"><strong>Setup</strong> Card numbers are over ${bc.n.toLocaleString('en-GB')} judged queries. Text vectors, HNSW ef ${bc.ef}, ${thousands(bc.n_products)} products, Milvus boost ranker over ${bc.limit} results.</p>`,
  ].join('\n');
}

export function cardsShown(pocVsProd, narrowFilter, campaign) {
  const pv = pocVsProd.rows.find(r => r.query_id === POC_QUERY);
  const nf = narrowFilter.rows.find(r => r.key === FILTER_KEY);
  return [pv?.poc, pv?.prod, nf?.hnsw, nf?.rabitq, ...(campaign?.arms || [])].flatMap(s => (s?.results || []).slice(0, SLOTS));
}

function copyImages(cards, src) {
  const images = new Map();
  for (const card of cards) {
    if (!card.image || images.has(card.image)) continue;
    const from = resolve(src, card.image);
    if (!existsSync(from)) {
      console.warn(`missing thumbnail ${card.image} for ${card.product_id}: using a placeholder`);
      continue;
    }
    const name = `${card.product_id}.jpg`;
    copyFileSync(from, resolve(HERE, name));
    images.set(card.image, name);
  }
  const keep = new Set(images.values());
  for (const f of readdirSync(HERE)) {
    if (f.endsWith('.jpg') && !keep.has(f)) unlinkSync(resolve(HERE, f));
  }
  return images;
}

function main() {
  const { src } = parseArgs(process.argv.slice(2));
  const readJson = f => JSON.parse(readFileSync(resolve(src, f), 'utf8'));
  const { narrow_filter: narrowFilter } = readJson('results/showcase.json').payload;
  const pocVsProd = readJson('probes/probe_boombox.json');
  const campaign = readJson('probes/probe_campaign.json');
  const images = copyImages(cardsShown(pocVsProd, narrowFilter, campaign), src);
  const nRows = narrowFilter.rows[0].n_rows;
  const out = [
    '<!-- Generated by showcase/generate.mjs from vector_search_ecom probes/probe_boombox.json, results/showcase.json and probes/probe_campaign.json. Do not edit by hand. -->',
    '<!-- slide: Run the PoC on the full catalogue -->',
    renderPocSlide(pocVsProd, nRows, images),
    '<!-- slide: Test every index on narrow filters -->',
    renderFilterSlide(narrowFilter, images),
    '<!-- slide: Tune boost weights against nDCG -->',
    renderBoostSlide(campaign, images),
    '',
  ].join('\n');
  writeFileSync(resolve(HERE, 'snippets.html'), out);
  console.log(`wrote snippets.html and ${images.size} thumbnails to ${HERE}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
