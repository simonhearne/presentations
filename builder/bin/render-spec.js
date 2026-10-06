#!/usr/bin/env node
// Renders one Vega spec to a PNG through the deck's own runtime (script/vega.js),
// so the screenshot carries the brand theme exactly as a slide would.
//
//   node bin/render-spec.js visualisations/ann-vs-exact.json --signal stage=3 --wait 2500
import { readFileSync, writeFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { embedVegaData, escapeHtml } from './build.js';

const RUNTIME = fileURLToPath(new URL('../script/vega.js', import.meta.url));
const DARK_BG = '#061982';

export function parseSignal(pair = '') {
  const eq = pair.indexOf('=');
  if (eq < 1) throw new Error(`--signal expects name=value, got "${pair}"`);
  const raw = pair.slice(eq + 1);
  let value;
  try { value = JSON.parse(raw); } catch { value = raw; }
  return { [pair.slice(0, eq)]: value };
}

export function parseRenderArgs(argv) {
  const opts = { signals: {}, wait: 1500, theme: 'light', out: null, spec: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--signal') {
      Object.assign(opts.signals, parseSignal(argv[++i]));
    } else if (arg === '--wait') {
      opts.wait = Number(argv[++i]);
    } else if (arg === '--theme') {
      opts.theme = argv[++i];
    } else if (arg === '--out') {
      opts.out = argv[++i];
    } else if (!opts.spec) {
      opts.spec = arg;
    } else {
      throw new Error(`unexpected argument "${arg}"`);
    }
  }
  if (!opts.spec) throw new Error('usage: render-spec.js <spec.json> [--signal name=value]... [--wait ms] [--theme light|dark] [--out file.png]');
  if (!['light', 'dark'].includes(opts.theme)) throw new Error(`--theme must be light or dark, got "${opts.theme}"`);
  return opts;
}

export function renderSpecPage({ specUri, signals, theme, runtime }) {
  const sectionClass = theme === 'dark' ? 'slide dark' : 'slide';
  const bg = theme === 'dark' ? DARK_BG : '#ffffff';
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=block" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
<script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
<script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
</head><body style="margin:0;background:${bg}">
<style>.vega-chart svg { overflow: visible; }</style>
<section class="${sectionClass}" style="display:inline-block;padding:16px;background:${bg}">
<div class="vega-chart" id="chart" data-spec="${escapeHtml(specUri)}" data-renderer="svg" data-actions="false"></div>
</section>
<script>${runtime}</script>
<script>
  window.__signals = ${JSON.stringify(signals)};
</script>
</body></html>`;
}

export async function launch() {
  const { chromium } = await import('playwright');
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: 'chrome' });
  }
}

export async function renderSpec(opts) {
  const specPath = resolve(opts.spec);
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  embedVegaData(spec, dirname(specPath));
  const specUri = `data:application/json;base64,${Buffer.from(JSON.stringify(spec)).toString('base64')}`;
  const html = renderSpecPage({ specUri, signals: opts.signals, theme: opts.theme, runtime: readFileSync(RUNTIME, 'utf8') });
  const out = resolve(opts.out || join(tmpdir(), `${basename(specPath, '.json')}.png`));

  // A file page rather than setContent: setContent goes through document.write,
  // which makes Chrome warn about every parser-blocking CDN script.
  const dir = mkdtempSync(join(tmpdir(), 'render-spec-'));
  const pagePath = join(dir, 'index.html');
  writeFileSync(pagePath, html);
  const browser = await launch();
  const problems = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', err => problems.push(`pageerror: ${err.message}`));
    await page.goto(pathToFileURL(pagePath).href);
    await page.waitForFunction(() => document.getElementById('chart').__vegaView, null, { timeout: 15000 })
      .catch(() => { throw new Error(`chart never embedded:\n${problems.join('\n')}`); });
    await page.evaluate(async () => {
      const view = document.getElementById('chart').__vegaView;
      for (const [name, value] of Object.entries(window.__signals)) view.signal(name, value);
      await view.runAsync();
    });
    await page.waitForTimeout(opts.wait);
    // Vega can paint past its own svg box (a long legend label, an offset
    // annotation) and the deck shows that overflow, so clip to what was painted.
    const clip = await page.evaluate(() => {
      const box = document.querySelector('section').getBoundingClientRect();
      const ink = document.querySelector('#chart svg > g')?.getBoundingClientRect() || box;
      const pad = 16;
      const x = Math.max(0, Math.min(box.left, ink.left - pad));
      const y = Math.max(0, Math.min(box.top, ink.top - pad));
      return {
        x, y,
        width: Math.max(box.right, ink.right + pad) - x,
        height: Math.max(box.bottom, ink.bottom + pad) - y,
      };
    });
    await page.screenshot({ path: out, clip, fullPage: true });
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
  return { out, problems };
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  try {
    const { out, problems } = await renderSpec(parseRenderArgs(process.argv.slice(2)));
    for (const p of problems) console.warn(p);
    console.log(`rendered ${out}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
