// test/runtime.test.js — browser tests for the shared slide runtime in script/.
// Drives the real deck.js/fragments.js/vega.js against a synthetic deck so the
// keyboard-stepping behaviour is exercised the way a presenter hits it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from '../bin/site.js';

const SCRIPT_DIR = fileURLToPath(new URL('../script/', import.meta.url));

// Slides in the order a presenter walks them: plain, fragments only, vega
// signal stages only, one slide that stages both, and two that place the chart
// in the fragment index space with data-fragment-index.
const PAGE = `<!doctype html><html><head></head><body>
<div class="deck">
  <section class="slide" id="plain"><h1>Plain</h1></section>
  <section class="slide" id="frags">
    <p class="fragment">one</p><p class="fragment">two</p>
  </section>
  <section class="slide" id="vega">
    <div class="vega-chart" id="chart-a" data-signal-stage="[0, 1, 2]"></div>
  </section>
  <section class="slide" id="mixed">
    <p class="fragment">note</p>
    <div class="vega-chart" id="chart-b" data-signal-stage="[0, 1, 2, 3]"></div>
  </section>
  <section class="slide" id="chart-first">
    <div class="vega-chart" id="chart-c" data-signal-stage="[0, 1, 2]" data-fragment-index="0"></div>
    <p class="fragment">the punchline the stages earn</p>
  </section>
  <section class="slide" id="around-chart">
    <p class="fragment" data-fragment-index="0">setup</p>
    <div class="vega-chart" id="chart-d" data-signal-stage="[0, 1]" data-fragment-index="1"></div>
    <p class="fragment" data-fragment-index="2">payoff</p>
  </section>
</div>
<script src="deck.js"></script>
<script src="fragments.js"></script>
<script src="vega.js"></script>
<script>
  // vegaEmbed is a CDN dependency, so stand in for the embedded view: the step
  // list and view handle are what vega.js's stepper and counter actually read.
  for (const el of document.querySelectorAll('.vega-chart')) {
    const values = JSON.parse(el.dataset.signalStage);
    el.__vegaSteps = [{ name: 'stage', values, index: 0 }];
    el.__vegaView = { signal() { return this; }, runAsync() { return Promise.resolve(); } };
  }
</script>
</body></html>`;

async function withDeck(t, run) {
  const root = mkdtempSync(join(tmpdir(), 'runtime-'));
  let server;
  let browser;
  try {
    mkdirSync(root, { recursive: true });
    for (const name of ['deck.js', 'fragments.js', 'vega.js']) {
      copyFileSync(join(SCRIPT_DIR, name), join(root, name));
    }
    writeFileSync(join(root, 'index.html'), PAGE);
    server = await startStaticServer(root);
    let chromium;
    try {
      ({ chromium } = await import('playwright'));
      browser = await chromium.launch();
    } catch (err) {
      return t.skip(`chromium unavailable: ${err.message}`);
    }
    const page = await browser.newPage();
    const cueOn = async () => page.evaluate(
      () => document.querySelector('.slide.is-current').classList.contains('fragments-done'));
    const press = async () => {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(20);
    };
    const slideId = async () => page.evaluate(() => document.querySelector('.slide.is-current').id);
    const back = async () => {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(20);
    };
    const revealed = async id => page.evaluate(sel => Array.from(
      document.querySelectorAll(`#${sel} .fragment`)).map(el => el.classList.contains('is-revealed')),
      id);
    const stage = async id => page.evaluate(sel => document.getElementById(sel).__vegaSteps[0].index, id);
    // emulateMedia resolves when the CDP command is acked; the matchMedia
    // listener runs some time after that, so wait on the reveal itself.
    const printed = async n => page.waitForFunction(
      count => document.querySelectorAll('#frags .fragment.is-revealed').length === count,
      n, { timeout: 2000 });
    await run({ page, origin: server.origin, cueOn, press, back, slideId, revealed, stage, printed });
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
    rmSync(root, { recursive: true, force: true });
  }
}

test('presenter cue: a slide with nothing staged never shows the cue', async (t) => {
  await withDeck(t, async ({ page, origin, cueOn, slideId }) => {
    await page.goto(`${origin}/#1`);
    assert.equal(await slideId(), 'plain');
    assert.equal(await cueOn(), false, 'plain slide has no staged advance to finish');
  });
});

test('presenter cue: a fragment slide shows the cue on its last fragment', async (t) => {
  await withDeck(t, async ({ page, origin, cueOn, press, slideId }) => {
    await page.goto(`${origin}/#2`);
    assert.equal(await slideId(), 'frags');
    assert.equal(await cueOn(), false, 'no fragment revealed yet');
    await press();
    assert.equal(await cueOn(), false, 'one of two fragments revealed');
    await press();
    assert.equal(await cueOn(), true, 'both fragments revealed, next advance leaves');
  });
});

test('presenter cue: a vega signal-stage slide shows the cue on its last stage', async (t) => {
  await withDeck(t, async ({ page, origin, cueOn, press, slideId }) => {
    await page.goto(`${origin}/#3`);
    assert.equal(await slideId(), 'vega');
    assert.equal(await cueOn(), false, 'seeded on stage 0, two stages still to come');
    await press();
    assert.equal(await cueOn(), false, 'stage 1 of 2');
    await press();
    assert.equal(await cueOn(), true, 'last stage on screen, next advance leaves');
    await press();
    assert.equal(await slideId(), 'mixed', 'and the next advance really does leave');
  });
});

test('presenter cue: a mixed slide waits for the vega stages, not just the fragments', async (t) => {
  await withDeck(t, async ({ page, origin, cueOn, press, slideId }) => {
    await page.goto(`${origin}/#4`);
    assert.equal(await slideId(), 'mixed');
    await press();
    assert.equal(await cueOn(), false, 'fragment revealed but three vega stages remain');
    await press();
    await press();
    assert.equal(await cueOn(), false, 'still one vega stage to go');
    await press();
    assert.equal(await cueOn(), true, 'fragment and every stage on screen');
  });
});

test('presenter cue: stepping back off the last stage clears the cue', async (t) => {
  await withDeck(t, async ({ page, origin, cueOn, press, slideId }) => {
    await page.goto(`${origin}/#3`);
    await press();
    await press();
    assert.equal(await cueOn(), true, 'last stage reached');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(20);
    assert.equal(await slideId(), 'vega', 'still on the same slide');
    assert.equal(await cueOn(), false, 'a stage is owed again');
  });
});

test('print: every fragment in the deck is revealed, on slides the presenter never reached', async (t) => {
  await withDeck(t, async ({ page, origin, printed }) => {
    await page.goto(`${origin}/#1`);
    const revealedOn = id => page.evaluate(sel => Array.from(
      document.querySelectorAll(`#${sel} .fragment`)).map(el => el.classList.contains('is-revealed')),
      id);

    assert.deepEqual(await revealedOn('frags'), [false, false], 'slide 2 is still untouched');
    await page.emulateMedia({ media: 'print' });
    await printed(2);
    assert.deepEqual(await revealedOn('frags'), [true, true], 'print reveals a slide never visited');
    assert.deepEqual(await revealedOn('mixed'), [true]);
  });
});

test('print: the presenter keeps the step they were on once printing is done', async (t) => {
  await withDeck(t, async ({ page, origin, press, cueOn, printed }) => {
    await page.goto(`${origin}/#2`);
    await press();
    const stateOn = () => page.evaluate(() => Array.from(
      document.querySelectorAll('#frags .fragment')).map(el => el.className));
    const mid = await stateOn();

    await page.emulateMedia({ media: 'print' });
    await printed(2);
    await page.emulateMedia({ media: null });
    await printed(1);
    assert.deepEqual(await stateOn(), mid, 'one of two fragments revealed, exactly as before');
    assert.equal(await cueOn(), false, 'and the cue still says a step is owed');
    await press();
    assert.equal(await cueOn(), true, 'the second fragment still steps');
  });
});

test('chart position: a fragment after the chart waits for every stage', async (t) => {
  await withDeck(t, async ({ page, origin, press, slideId, revealed, stage }) => {
    await page.goto(`${origin}/#5`);
    assert.equal(await slideId(), 'chart-first');
    await press();
    assert.deepEqual(await revealed('chart-first'), [false], 'stage 1 goes first, not the fragment');
    assert.equal(await stage('chart-c'), 1);
    await press();
    assert.deepEqual(await revealed('chart-first'), [false], 'stage 2 too');
    assert.equal(await stage('chart-c'), 2);
    await press();
    assert.deepEqual(await revealed('chart-first'), [true], 'stages spent, now the fragment');
    assert.equal(await slideId(), 'chart-first', 'and the deck has not moved on');
  });
});

test('chart position: fragments below the chart index still go first', async (t) => {
  await withDeck(t, async ({ page, origin, press, slideId, revealed, stage }) => {
    await page.goto(`${origin}/#6`);
    assert.equal(await slideId(), 'around-chart');
    await press();
    assert.deepEqual(await revealed('around-chart'), [true, false], 'the setup line precedes the chart');
    assert.equal(await stage('chart-d'), 0, 'and the chart has not stepped');
    await press();
    assert.deepEqual(await revealed('around-chart'), [true, false], 'then the chart takes its stage');
    assert.equal(await stage('chart-d'), 1);
    await press();
    assert.deepEqual(await revealed('around-chart'), [true, true], 'and the payoff lands last');
  });
});

test('chart position: stepping back rewinds the fragment before the stages', async (t) => {
  await withDeck(t, async ({ page, origin, press, back, slideId, revealed, stage }) => {
    await page.goto(`${origin}/#5`);
    await press();
    await press();
    await press();
    assert.deepEqual(await revealed('chart-first'), [true], 'everything is on screen');
    await back();
    assert.deepEqual(await revealed('chart-first'), [false], 'the fragment goes back first');
    assert.equal(await stage('chart-c'), 2, 'the chart is untouched');
    await back();
    assert.equal(await stage('chart-c'), 1, 'then the stages rewind');
    assert.equal(await slideId(), 'chart-first', 'without leaving the slide');
  });
});

test('presenter cue: a chart-first slide is not done until its fragment lands', async (t) => {
  await withDeck(t, async ({ page, origin, cueOn, press }) => {
    await page.goto(`${origin}/#5`);
    await press();
    await press();
    assert.equal(await cueOn(), false, 'every stage shown, but the fragment is still owed');
    await press();
    assert.equal(await cueOn(), true, 'fragment and stages both on screen');
  });
});
