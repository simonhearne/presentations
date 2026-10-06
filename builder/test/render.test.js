import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRenderArgs, renderSpecPage } from '../bin/render-spec.js';
import { parseSlideArgs } from '../bin/render-slide.js';

test('parseRenderArgs: spec path with defaults', () => {
  const opts = parseRenderArgs(['visualisations/x.json']);
  assert.equal(opts.spec, 'visualisations/x.json');
  assert.deepEqual(opts.signals, {});
  assert.equal(opts.wait, 1500);
  assert.equal(opts.theme, 'light');
  assert.equal(opts.out, null);
});

test('parseRenderArgs: signals parse as JSON, falling back to strings', () => {
  const opts = parseRenderArgs(['x.json', '--signal', 'stage=3', '--signal', 'mode=fast', '--signal', 'pts=[1,2]']);
  assert.deepEqual(opts.signals, { stage: 3, mode: 'fast', pts: [1, 2] });
});

test('parseRenderArgs: wait, theme and out', () => {
  const opts = parseRenderArgs(['x.json', '--wait', '2500', '--theme', 'dark', '--out', 'a.png']);
  assert.equal(opts.wait, 2500);
  assert.equal(opts.theme, 'dark');
  assert.equal(opts.out, 'a.png');
});

test('parseRenderArgs: rejects bad input', () => {
  assert.throws(() => parseRenderArgs([]), /usage/);
  assert.throws(() => parseRenderArgs(['x.json', '--signal', 'stage']), /name=value/);
  assert.throws(() => parseRenderArgs(['x.json', '--theme', 'blue']), /light or dark/);
  assert.throws(() => parseRenderArgs(['x.json', 'y.json']), /unexpected/);
});

test('renderSpecPage: dark theme puts the chart in a .dark section', () => {
  const html = renderSpecPage({ specUri: 'data:application/json;base64,e30=', signals: { stage: 2 }, theme: 'dark', runtime: '/*rt*/' });
  assert.match(html, /<section class="slide dark"/);
  assert.match(html, /data-spec="data:application\/json;base64,e30="/);
  assert.match(html, /window.__signals = \{"stage":2\}/);
  assert.match(html, /\/\*rt\*\//);
});

test('renderSpecPage: light theme has no .dark class', () => {
  const html = renderSpecPage({ specUri: 'data:,', signals: {}, theme: 'light', runtime: '' });
  assert.match(html, /<section class="slide"/);
});

test('parseSlideArgs: slide number or heading, with steps', () => {
  assert.deepEqual(parseSlideArgs(['talks/x', '11', '--steps', '2']),
    { deck: 'talks/x', slide: 11, steps: 2, wait: 1500, out: null, signals: {} });
  assert.equal(parseSlideArgs(['talks/x', 'ANN Benefits']).slide, 'ANN Benefits');
});

test('parseSlideArgs: rejects bad input', () => {
  assert.throws(() => parseSlideArgs(['talks/x']), /usage/);
  assert.throws(() => parseSlideArgs(['talks/x', '3', '--steps', '-1']), /whole number/);
  assert.throws(() => parseSlideArgs(['talks/x', '3', 'extra']), /unexpected/);
});

test('parseSlideArgs: signals set params on the slide charts', () => {
  assert.deepEqual(parseSlideArgs(['talks/x', '34', '--signal', 'index_type=CAGRA']).signals, { index_type: 'CAGRA' });
});
