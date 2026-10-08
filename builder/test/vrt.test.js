import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseVrtArgs, touchedDecks, listDecks, classify, summarise, renderMarkdown, renderReport } from '../bin/vrt.js';

test('parseVrtArgs: requires base and head, fills defaults', () => {
  const opts = parseVrtArgs(['--base', 'a', '--head', 'b']);
  assert.equal(opts.base, 'a');
  assert.equal(opts.head, 'b');
  assert.equal(opts.out, 'vrt-report');
  assert.equal(opts.changed, null);
  assert.deepEqual(opts.decks, []);
  assert.deepEqual(parseVrtArgs(['--base', 'a', '--head', 'b', '--deck', 'x', '--deck', 'y']).decks, ['x', 'y']);
  assert.equal(opts.concurrency, 4);
  assert.throws(() => parseVrtArgs(['--base', 'a']), /usage/);
  assert.throws(() => parseVrtArgs(['--base', 'a', '--head', 'b', 'c']), /unexpected/);
  assert.throws(() => parseVrtArgs(['--base', 'a', '--head', 'b', '--concurrency', '0']), /concurrency/);
  assert.throws(() => parseVrtArgs(['--base', 'a', '--head', 'b', '--threshold', '2']), /threshold/);
});

test('touchedDecks: deck slugs from repo- or builder-relative paths', () => {
  const slugs = touchedDecks([
    'builder/talks/rag-cost-curve/slides.md',
    'talks/vectordb-101/chart.json',
    'builder/css/layouts.css',
    'builder/talks/rag-cost-curve/img/x.png',
    'builder/talks',
    '',
  ]);
  assert.deepEqual([...slugs].sort(), ['rag-cost-curve', 'vectordb-101']);
});

test('listDecks: only directories holding a built deck', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vrt-'));
  try {
    for (const [slug, html] of [['b-deck', '<div class="deck">'], ['a-deck', '<div class="deck viewport">'], ['css', 'x'], ['og', null]]) {
      mkdirSync(join(dir, slug));
      if (html !== null) writeFileSync(join(dir, slug, 'index.html'), html);
    }
    writeFileSync(join(dir, 'index.html'), '<div class="deck">');
    assert.deepEqual(listDecks(dir), ['a-deck', 'b-deck']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('classify: added, removed, changed over threshold, same under it', () => {
  const base = { slug: 'd', slide: 1, threshold: 0.001 };
  assert.equal(classify({ ...base, base: false, head: true, diffRatio: null }).status, 'added');
  assert.equal(classify({ ...base, base: true, head: false, diffRatio: null }).status, 'removed');
  assert.equal(classify({ ...base, base: true, head: true, diffRatio: 0.01 }).status, 'changed');
  assert.equal(classify({ ...base, base: true, head: true, diffRatio: 0.001 }).status, 'same');
});

const results = [
  { slug: 'shared', slide: 1, status: 'same', diffRatio: 0 },
  { slug: 'shared', slide: 2, status: 'changed', diffRatio: 0.02 },
  { slug: 'edited', slide: 1, status: 'changed', diffRatio: 0.5 },
  { slug: 'edited', slide: 2, status: 'added', diffRatio: null },
  { slug: 'quiet', slide: 1, status: 'same', diffRatio: 0 },
];

test('summarise: splits diffs by whether the PR touched the deck', () => {
  const s = summarise(results, new Set(['edited']));
  assert.equal(s.slides, 5);
  assert.equal(s.unexpected, 1);
  assert.equal(s.expected, 2);
  assert.deepEqual(s.decks.map(d => d.slug), ['shared', 'quiet', 'edited']);
  assert.deepEqual(s.decks[0].diffs.map(d => d.slide), [2]);
});

test('renderMarkdown: flags untouched decks', () => {
  const md = renderMarkdown(summarise(results, new Set(['edited'])));
  assert.match(md, /^<!-- vrt-report -->/);
  assert.match(md, /\*\*1 slide\(s\) changed in decks this PR did not touch\*\*/);
  assert.match(md, /\| shared \| \*\*no\*\* \| 2 \|/);
  assert.match(md, /\| edited \| yes \| 1, 2 \(added\) \|/);
  assert.doesNotMatch(md, /quiet/);
});

test('renderMarkdown: says so when nothing changed', () => {
  const md = renderMarkdown(summarise(results.filter(r => r.status === 'same'), new Set()));
  assert.match(md, /No visual changes across 2 slides/);
});

test('renderReport: untouched decks open, edited decks collapsed, missing sides placeholdered', () => {
  const html = renderReport(summarise(results, new Set(['edited'])));
  assert.match(html, /<details open><summary>shared: 1 changed<\/summary>/);
  assert.match(html, /<details><summary>edited: 2 changed \(deck edited by this PR\)<\/summary>/);
  assert.match(html, /src="diff\/shared\/2\.png"/);
  assert.doesNotMatch(html, /src="base\/edited\/2\.png"/);
  assert.doesNotMatch(html, /quiet/);
});
