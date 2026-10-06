#!/usr/bin/env node
// Builds a deck and screenshots one slide at 1920x1080 after stepping through
// its fragments and chart stages, then reports content running into the footer.
// Opens dist/index.html over file:// so no server (or free port) is needed.
//
//   node bin/render-slide.js talks/rag-cost-curve 11 --steps 2
//   node bin/render-slide.js talks/vectordb-301 34 --signal index_type=CAGRA
import { realpathSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDeck } from './build.js';
import { launch, parseSignal } from './render-spec.js';

export function parseSlideArgs(argv) {
  const opts = { deck: null, slide: null, steps: 0, wait: 1500, out: null, signals: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--steps') opts.steps = Number(argv[++i]);
    else if (arg === '--signal') Object.assign(opts.signals, parseSignal(argv[++i]));
    else if (arg === '--wait') opts.wait = Number(argv[++i]);
    else if (arg === '--out') opts.out = argv[++i];
    else if (!opts.deck) opts.deck = arg;
    else if (opts.slide === null) opts.slide = /^\d+$/.test(arg) ? Number(arg) : arg;
    else throw new Error(`unexpected argument "${arg}"`);
  }
  if (!opts.deck || opts.slide === null) {
    throw new Error('usage: render-slide.js talks/<slug> <slide number|heading text> [--steps n] [--signal name=value]... [--wait ms] [--out file.png]');
  }
  if (!Number.isInteger(opts.steps) || opts.steps < 0) throw new Error(`--steps must be a whole number, got "${opts.steps}"`);
  return opts;
}

export async function renderSlide(opts) {
  const talkDir = resolve(opts.deck);
  const htmlPath = await buildDeck(talkDir);
  const out = resolve(opts.out || join(tmpdir(), `${basename(talkDir)}-${String(opts.slide).replace(/\W+/g, '-')}.png`));

  const browser = await launch();
  const problems = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', err => problems.push(`pageerror: ${err.message}`));
    await page.goto(pathToFileURL(htmlPath).href);

    const number = typeof opts.slide === 'number' ? opts.slide : await page.evaluate(query => {
      const q = query.trim().toLowerCase();
      const headings = [...document.querySelectorAll('.slide')].map((s, i) => ({
        n: i + 1,
        texts: [...s.querySelectorAll('h1, h2')].map(h => h.textContent.trim().toLowerCase()),
      }));
      const exact = headings.filter(h => h.texts.includes(q));
      const partial = headings.filter(h => h.texts.some(t => t.includes(q)));
      const hits = exact.length ? exact : partial;
      return hits.length === 1 ? hits[0].n : { matches: hits.map(h => h.n) };
    }, opts.slide);
    if (typeof number !== 'number') {
      throw new Error(number.matches.length
        ? `heading "${opts.slide}" matches slides ${number.matches.join(', ')}: pass the slide number`
        : `no slide has a heading containing "${opts.slide}"`);
    }
    await page.evaluate(n => { location.hash = `#${n}`; }, number);

    await page.waitForFunction(() => {
      const charts = document.querySelectorAll('.slide.is-current .vega-chart');
      return [...charts].every(el => el.__vegaView);
    }, null, { timeout: 15000 }).catch(() => { throw new Error(`charts on slide ${number} never embedded:\n${problems.join('\n')}`); });
    await page.evaluate(async signals => {
      for (const el of document.querySelectorAll('.slide.is-current .vega-chart')) {
        const view = el.__vegaView;
        const names = Object.keys(signals).filter(name => {
          try { view.signal(name); return true; } catch { return false; }
        });
        for (const name of names) view.signal(name, signals[name]);
        if (names.length) await view.runAsync();
      }
    }, opts.signals);
    for (let i = 0; i < opts.steps; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(opts.wait);

    const fit = await page.evaluate(() => {
      const slide = document.querySelector('.slide.is-current');
      const footer = slide.querySelector('footer.footer');
      if (!footer) return null;
      const limit = footer.getBoundingClientRect().top;
      let bottom = 0;
      for (const el of slide.querySelectorAll('h1, h2, h3, p, ul, ol, table, pre, img, figure, .vega-chart svg > g')) {
        if (el.closest('footer, aside.chrome')) continue;
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
      }
      return { bottom: Math.round(bottom), limit: Math.round(limit) };
    });
    if (fit && fit.bottom > fit.limit) {
      problems.push(`overflow: slide content reaches y=${fit.bottom}px, ${fit.bottom - fit.limit}px past the footer at y=${fit.limit}px`);
    }
    const slideNow = await page.evaluate(() => location.hash);
    if (parseInt(slideNow.slice(1), 10) !== number) {
      problems.push(`--steps ran past the slide: now on ${slideNow}, so the chart had fewer stages than steps`);
    }
    await page.screenshot({ path: out });
    // Every chart in the deck embeds on load, so one noisy spec elsewhere would
    // otherwise repeat its warnings once per view.
    return { out, number, problems: [...new Set(problems)] };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  try {
    const { out, number, problems } = await renderSlide(parseSlideArgs(process.argv.slice(2)));
    for (const p of problems) console.warn(p);
    console.log(`rendered slide ${number} to ${out}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
