#!/usr/bin/env node
// Visual regression between two assembled sites (see bin/site.js): walks every
// slide of every deck in both, steps each to its final fragment and chart
// stage, screenshots it, and diffs the pair. Built for the PR workflow in
// .github/workflows/vrt.yml, where base is the PR's target branch and head is
// the PR, but any two _site directories work.
//
//   node bin/vrt.js --base ../base/builder/_site --head _site --out vrt-report \
//     --changed changed-files.txt
//
// A diff in a deck whose own files the PR touched is expected and reported
// quietly; a diff anywhere else came from shared assets (css, script,
// templates, visualisations) and is flagged. Exits 0 whatever the diffs are,
// and non-zero only when the harness itself fails.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './site.js';
import { launch } from './render-spec.js';

const SLIDE_W = 1920;
const SLIDE_H = 1080;
// Fake time starts here on both sides so Date-driven content matches.
const CLOCK_START = new Date('2026-01-01T00:00:00Z').getTime();

export function parseVrtArgs(argv) {
  const opts = { base: null, head: null, out: 'vrt-report', changed: null, decks: [], concurrency: 4, threshold: 0.00025 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') opts.base = argv[++i];
    else if (arg === '--head') opts.head = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--changed') opts.changed = argv[++i];
    else if (arg === '--deck') opts.decks.push(argv[++i]);
    else if (arg === '--concurrency') opts.concurrency = Number(argv[++i]);
    else if (arg === '--threshold') opts.threshold = Number(argv[++i]);
    else throw new Error(`unexpected argument "${arg}"`);
  }
  if (!opts.base || !opts.head) {
    throw new Error('usage: vrt.js --base <site dir> --head <site dir> [--out dir] [--changed file] [--deck slug]... [--concurrency n] [--threshold fraction]');
  }
  if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) throw new Error(`--concurrency must be a positive whole number, got "${opts.concurrency}"`);
  if (!(opts.threshold >= 0 && opts.threshold < 1)) throw new Error(`--threshold must be a fraction of the slide's pixels, got "${opts.threshold}"`);
  return opts;
}

// Repo-relative paths (as `git diff --name-only` prints them) to the deck slugs
// whose own sources changed. Paths without the builder/ prefix count too, so
// the list can come from inside builder/ as well.
export function touchedDecks(paths) {
  const slugs = new Set();
  for (const p of paths) {
    const m = p.trim().match(/^(?:builder\/)?talks\/([^/]+)\//);
    if (m) slugs.add(m[1]);
  }
  return slugs;
}

// Deck slugs in an assembled site: every top-level directory with an index.html
// holding a .deck. Legacy decks are links out, so they never appear here.
export function listDecks(siteDir) {
  return readdirSync(siteDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(slug => {
      const html = join(siteDir, slug, 'index.html');
      return existsSync(html) && /class="deck[\s"]/.test(readFileSync(html, 'utf8'));
    })
    .sort();
}

// Pairs base and head captures slide by slide. `diffRatio` is the share of
// pixels pixelmatch flagged, or null when either side is missing.
export function classify({ slug, slide, base, head, diffRatio, threshold }) {
  let status;
  if (!base) status = 'added';
  else if (!head) status = 'removed';
  else status = diffRatio > threshold ? 'changed' : 'same';
  return { slug, slide, status, diffRatio };
}

export function summarise(results, touched) {
  const decks = new Map();
  for (const r of results) {
    if (!decks.has(r.slug)) decks.set(r.slug, { slug: r.slug, touched: touched.has(r.slug), slides: [] });
    decks.get(r.slug).slides.push(r);
  }
  const list = [...decks.values()].map(d => ({
    ...d,
    diffs: d.slides.filter(s => s.status !== 'same'),
  }));
  const unexpected = list.filter(d => !d.touched && d.diffs.length);
  const expected = list.filter(d => d.touched && d.diffs.length);
  return {
    slides: results.length,
    unexpected: unexpected.reduce((n, d) => n + d.diffs.length, 0),
    expected: expected.reduce((n, d) => n + d.diffs.length, 0),
    decks: list.sort((a, b) => (a.touched - b.touched) || (b.diffs.length - a.diffs.length) || a.slug.localeCompare(b.slug)),
  };
}

const pct = r => (r === null || r === undefined ? '' : `${(r * 100).toFixed(2)}%`);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function renderMarkdown(summary) {
  const lines = ['<!-- vrt-report -->', '### Visual regression'];
  if (!summary.unexpected && !summary.expected) {
    lines.push('', `No visual changes across ${summary.slides} slides.`);
  } else {
    lines.push('', summary.unexpected
      ? `**${summary.unexpected} slide(s) changed in decks this PR did not touch**, so the change came from shared assets.`
      : 'Every change is in a deck this PR edits.');
    lines.push('', '| Deck | Touched by PR | Changed slides |', '| --- | --- | --- |');
    for (const d of summary.decks.filter(d => d.diffs.length)) {
      const slides = d.diffs.map(s => `${s.slide}${s.status === 'changed' ? '' : ` (${s.status})`}`).join(', ');
      lines.push(`| ${d.slug} | ${d.touched ? 'yes' : '**no**'} | ${slides} |`);
    }
    lines.push('', `${summary.slides} slides compared.`);
  }
  return lines.join('\n') + '\n';
}

export function renderReport(summary) {
  const card = (d, s) => {
    const name = `${d.slug}/${s.slide}.png`;
    const img = (side, label) => (s.status === (side === 'base' ? 'added' : 'removed') || (side === 'diff' && s.status !== 'changed'))
      ? `<figure><figcaption>${label}</figcaption><div class="none">none</div></figure>`
      : `<figure><figcaption>${label}</figcaption><a href="${side}/${name}"><img loading="lazy" src="${side}/${name}" alt="${label} ${esc(d.slug)} slide ${s.slide}"></a></figure>`;
    return `<article><h3>${esc(d.slug)} #${s.slide} <span>${s.status} ${pct(s.diffRatio)}</span></h3>
<div class="trio">${img('base', 'Before')}${img('head', 'After')}${img('diff', 'Diff')}</div></article>`;
  };
  const section = d => `<details${d.touched ? '' : ' open'}><summary>${esc(d.slug)}: ${d.diffs.length} changed${d.touched ? ' (deck edited by this PR)' : ''}</summary>
${d.diffs.map(s => card(d, s)).join('\n')}</details>`;
  const changed = summary.decks.filter(d => d.diffs.length);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual regression</title>
<style>
:root { --bg: #fff; --fg: #111; --muted: #666; --line: #ddd; --flag: #b42318; }
@media (prefers-color-scheme: dark) { :root { --bg: #111; --fg: #eee; --muted: #999; --line: #333; --flag: #f97066; } }
body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 1600px; margin: 0 auto; }
summary { cursor: pointer; font-weight: 600; padding: 8px 0; border-top: 1px solid var(--line); }
article h3 { font-size: 15px; margin: 16px 0 8px; } article h3 span { color: var(--muted); font-weight: 400; }
.trio { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
figure { margin: 0; } figcaption { color: var(--muted); font-size: 13px; }
img { width: 100%; height: auto; border: 1px solid var(--line); display: block; }
.none { aspect-ratio: 16 / 9; border: 1px dashed var(--line); display: grid; place-items: center; color: var(--muted); }
.flag { color: var(--flag); font-weight: 600; }
</style></head><body><main>
<h1>Visual regression</h1>
<p>${summary.slides} slides compared. <span class="${summary.unexpected ? 'flag' : ''}">${summary.unexpected} changed in decks the PR did not touch</span>; ${summary.expected} in decks it edits.</p>
${changed.length ? changed.map(section).join('\n') : '<p>No visual changes.</p>'}
</main></body></html>
`;
}

// In the page: how many advances the current slide still owes. Reads the
// runtime state directly (unrevealed fragments, vega step lists) rather than
// the footer cue, which cannot tell "no steps" from "steps still owed".
function remainingSteps() {
  const slide = document.querySelector('.slide.is-current');
  if (!slide) return 0;
  let n = slide.querySelectorAll('.fragment:not(.is-revealed)').length;
  for (const el of slide.querySelectorAll('.vega-chart')) {
    for (const s of el.__vegaSteps || []) n += s.values.length - 1 - s.index;
  }
  return n;
}

// Lets the current slide's async work land before fake time moves: three.js
// modules import and init when their slide becomes current, and a stepped vega
// signal starts its animator from a microtask once the dataflow has run. Fake
// time advanced before either lands would start them a tick late on one side.
async function drain(page) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline && !(await page.evaluate(() =>
    [...document.querySelectorAll('.slide.is-current .three-canvas')].every(c => c.__three)))) {
    await page.waitForTimeout(50);
  }
  await page.evaluate(async () => {
    const views = [...document.querySelectorAll('.slide.is-current .vega-chart')].map(el => el.__vegaView).filter(Boolean);
    await Promise.all(views.map(v => v.runAsync()));
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

// Moves animators, auto-reveal timers and frame loops on by the same fake time
// on both sides. Page-side requestAnimationFrame and setTimeout are fake too,
// so nothing in a page.evaluate may wait on them: only runFor moves them on.
async function settle(page, ms) {
  await drain(page);
  await page.clock.runFor(ms);
  await drain(page);
}

// Fonts and CDN scripts, fetched once per run and shared by every context.
// Contexts don't share an HTTP cache, and a font that lands after vega has
// measured its labels moves them by a sub-pixel, so every deck has to get the
// same bytes at the same (immediate) moment.
const REMOTE = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com)\//;
const remoteCache = new Map();

async function serveRemote(route) {
  const url = route.request().url();
  if (!remoteCache.has(url)) {
    remoteCache.set(url, route.fetch().then(async res => ({ status: res.status(), headers: res.headers(), body: await res.body() })));
  }
  try {
    await route.fulfill(await remoteCache.get(url));
  } catch (err) {
    remoteCache.delete(url);
    throw err;
  }
}

// Playwright's clock belongs to the browser context, not the page, so every
// open deck gets a context of its own: sharing one would let each deck's
// runFor move the others' animations on.
async function openDeck(browser, url, problems) {
  const context = await browser.newContext({ viewport: { width: SLIDE_W, height: SLIDE_H }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  // Seeded Math.random so randomised layouts (facenet, connectome) land the same.
  await context.addInitScript(() => {
    let a = 0x9e3779b9;
    Math.random = () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Charts measure their text when they embed, so hold every embed until
    // every font face has loaded; otherwise labels land a sub-pixel apart
    // depending on which arrived first.
    let embed;
    Object.defineProperty(window, 'vegaEmbed', {
      configurable: true,
      get: () => embed,
      set: fn => {
        embed = (...args) => Promise.all([...document.fonts].map(f => f.load().catch(() => {}))).then(() => fn(...args));
      },
    });
  });
  await context.route(REMOTE, serveRemote);
  await context.clock.install({ time: CLOCK_START });
  await context.clock.pauseAt(CLOCK_START + 1000);
  const page = await context.newPage();
  page.on('pageerror', err => problems.push(`${url}: ${err.message}`));
  page.on('crash', () => problems.push(`${url}: page crashed`));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  // Every chart in the deck embeds on load. Fake time stays put while waiting,
  // however long the embed takes in real time, so animators and frame loops
  // start from the same instant on both sides.
  const deadline = Date.now() + 20000;
  while (!(await page.evaluate(() => [...document.querySelectorAll('.vega-chart[data-spec]')].every(el => el.__vegaView)))) {
    if (Date.now() > deadline) { problems.push(`${url}: charts never embedded`); break; }
    await page.waitForTimeout(100);
  }
  return page;
}

async function captureDeck(browser, origin, slug, outDir) {
  const problems = [];
  let page = await openDeck(browser, `${origin}/${slug}/#1`, problems);
  try {
    const count = await page.evaluate(() => document.querySelectorAll('.slide').length);
    mkdirSync(join(outDir, slug), { recursive: true });
    for (let n = 1; n <= count; n++) try {
      await page.evaluate(i => { location.hash = `#${i}`; }, n);
      await page.waitForFunction(i => document.querySelectorAll('.slide')[i - 1]?.classList.contains('is-current'), n, { polling: 50 });
      await settle(page, 100);
      for (let guard = 0; guard < 100 && (await page.evaluate(remainingSteps)) > 0; guard++) {
        await page.keyboard.press('ArrowRight');
        await settle(page, 100);
      }
      await settle(page, 1000);
      // The deck fills the viewport exactly. A locator screenshot would wait for
      // the element to be stable, which Playwright checks on animation frames
      // the paused clock never delivers.
      await page.screenshot({ path: join(outDir, slug, `${n}.png`), animations: 'disabled', caret: 'hide' });
      // script/three.js keeps a canvas rendering after its slide is left, and
      // every fake frame after that pays for it in software WebGL, so start
      // the rest of the deck from a fresh page.
      if (n < count && await page.evaluate(() => !!document.querySelector('.slide.is-current canvas'))) {
        await page.context().close();
        page = await openDeck(browser, `${origin}/${slug}/#${n + 1}`, problems);
      }
    } catch (err) {
      throw new Error(`${slug} slide ${n}: ${err.message}`, { cause: err });
    }
    return { count, problems };
  } finally {
    await page.context().close();
  }
}

async function captureSite(browser, siteDir, outDir, { concurrency, decks }) {
  const server = await startStaticServer(resolve(siteDir));
  try {
    const queue = listDecks(siteDir).filter(slug => !decks.length || decks.includes(slug));
    const counts = {};
    const problems = [];
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const slug = queue.shift();
        const r = await captureDeck(browser, server.origin, slug, outDir);
        counts[slug] = r.count;
        problems.push(...r.problems);
      }
    }));
    return { counts, problems };
  } finally {
    await server.close();
  }
}

async function diffPair(basePath, headPath, diffPath) {
  const { PNG } = await import('pngjs');
  const { default: pixelmatch } = await import('pixelmatch');
  const a = PNG.sync.read(readFileSync(basePath));
  const b = PNG.sync.read(readFileSync(headPath));
  if (a.width !== b.width || a.height !== b.height) return 1;
  const diff = new PNG({ width: a.width, height: a.height });
  // Exact per-pixel match: pixelmatch's colour tolerance and anti-aliasing
  // filter hide real changes to thin lines such as chart gridlines. Raster
  // jitter (a few hundred pixels, a few levels of one channel) is left to the
  // area threshold in classify instead.
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0, includeAA: true });
  if (n) writeFileSync(diffPath, PNG.sync.write(diff));
  return n / (a.width * a.height);
}

export async function runVrt(opts) {
  const out = resolve(opts.out);
  const changed = opts.changed ? readFileSync(opts.changed, 'utf8').split('\n').filter(Boolean) : [];
  const touched = touchedDecks(changed);
  const browser = await launch();
  let base, head;
  try {
    base = await captureSite(browser, opts.base, join(out, 'base'), opts);
    head = await captureSite(browser, opts.head, join(out, 'head'), opts);
  } finally {
    await browser.close();
  }
  const results = [];
  for (const slug of [...new Set([...Object.keys(base.counts), ...Object.keys(head.counts)])].sort()) {
    const max = Math.max(base.counts[slug] || 0, head.counts[slug] || 0);
    mkdirSync(join(out, 'diff', slug), { recursive: true });
    for (let n = 1; n <= max; n++) {
      const has = side => n <= (side.counts[slug] || 0);
      const diffRatio = has(base) && has(head)
        ? await diffPair(join(out, 'base', slug, `${n}.png`), join(out, 'head', slug, `${n}.png`), join(out, 'diff', slug, `${n}.png`))
        : null;
      results.push(classify({ slug, slide: n, base: has(base), head: has(head), diffRatio, threshold: opts.threshold }));
    }
  }
  const summary = summarise(results, touched);
  writeFileSync(join(out, 'results.json'), JSON.stringify({ ...summary, problems: [...base.problems, ...head.problems] }, null, 2));
  writeFileSync(join(out, 'index.html'), renderReport(summary));
  writeFileSync(join(out, 'summary.md'), renderMarkdown(summary));
  return { summary, problems: [...new Set([...base.problems, ...head.problems])], out };
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  try {
    const { summary, problems, out } = await runVrt(parseVrtArgs(process.argv.slice(2)));
    for (const p of problems) console.warn(p);
    console.log(`${summary.slides} slides compared: ${summary.unexpected} unexpected, ${summary.expected} expected changes. Report: ${join(out, 'index.html')}`);
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}
