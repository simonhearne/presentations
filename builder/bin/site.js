import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, dirname, basename, extname, join as joinPath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { escapeHtml, buildDeck } from './build.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_BASE = 'https://simonhearne.com/presentations';

export function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

export function ogImageRelPath(slug) {
  return `og/${slug}.png`;
}

export function deckCanonicalUrl(baseUrl, slug) {
  return `${normalizeBaseUrl(baseUrl)}/${slug}/`;
}

export function ogImageUrl(baseUrl, slug) {
  return `${normalizeBaseUrl(baseUrl)}/${ogImageRelPath(slug)}`;
}

export function firstH2Text(html) {
  const m = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function injectOgMeta(html, { title, description, url, image, width, height }) {
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:width" content="${width}">`,
    `<meta property="og:image:height" content="${height}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ].join('\n  ');
  const block = `  ${tags}\n`;
  return html.includes('</head>')
    ? html.replace('</head>', `${block}</head>`)
    : block + html;
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest must be an object');
  if (!manifest.site || typeof manifest.site.title !== 'string') {
    throw new Error('manifest.site.title is required');
  }
  if (!Array.isArray(manifest.decks)) throw new Error('manifest.decks must be an array');
  for (const deck of manifest.decks) {
    if (!deck.slug) throw new Error(`deck missing slug: ${JSON.stringify(deck)}`);
    if (!deck.title) throw new Error(`deck ${deck.slug} missing title`);
    if (deck.source !== 'build' && deck.source !== 'legacy') {
      throw new Error(`deck ${deck.slug} has invalid source "${deck.source}" (expected build|legacy)`);
    }
  }
  return manifest;
}

export function normalizeDeck(deck) {
  if (deck.source === 'legacy') {
    return { ...deck, url: deck.url || `${LEGACY_BASE}/${deck.slug}/` };
  }
  return { ...deck };
}

export function deckHref(deck) {
  return deck.source === 'build' ? `/${deck.slug}/` : deck.url;
}

function renderCard(deck) {
  const date = deck.date ? `<span class="deck-date">${escapeHtml(deck.date)}</span>` : '';
  const thumb = deck.source === 'build'
    ? `<img class="deck-thumb" src="/${ogImageRelPath(deck.slug)}" alt="" loading="lazy">\n          `
    : '';
  return `      <li class="deck-card">
        <a href="${escapeHtml(deckHref(deck))}">
          ${thumb}<span class="deck-meta">
            <span class="deck-title">${escapeHtml(deck.title)}</span>
            ${date}
          </span>
        </a>
      </li>`;
}

function renderSection(heading, decks) {
  if (decks.length === 0) return '';
  return `    <section class="deck-group">
      <h2>${escapeHtml(heading)}</h2>
      <ul class="deck-list">
${decks.map(renderCard).join('\n')}
      </ul>
    </section>`;
}

export function renderLanding(site, decks) {
  const built = decks.filter(d => d.source === 'build');
  const legacy = decks.filter(d => d.source === 'legacy');
  const tagline = site.tagline ? `<p class="tagline">${escapeHtml(site.tagline)}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title)}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23175fff'/%3E%3Cpath d='M12 9 L12 23 L24 16 Z' fill='%23fff'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="/assets/tokens.css">
  <style>
    body { font-family: var(--zilliz-font-sans, Inter, system-ui, sans-serif); margin: 0;
      background: var(--zilliz-white, #fff); color: var(--zilliz-ink, #1e293b); }
    main { max-width: 880px; margin: 0 auto; padding: 4rem 1.5rem; }
    h1 { font-size: 2.5rem; margin: 0 0 .25rem; }
    .tagline { color: #5b6478; margin: 0 0 3rem; font-size: 1.1rem; }
    .deck-group h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .08em;
      color: #5b6478; margin: 2.5rem 0 .75rem; }
    .deck-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
    .deck-card a { display: flex; flex-direction: column; align-items: stretch;
      gap: .75rem; padding: 1rem 1.25rem; border: 1px solid #e6e8ee;
      border-radius: 12px; text-decoration: none; color: inherit; transition: border-color .15s; }
    .deck-card a:hover { border-color: var(--zilliz-blue, #175fff); }
    .deck-thumb { width: 100%; aspect-ratio: 16 / 9; object-fit: cover;
      border-radius: 8px; background: #0b1020; display: block; }
    .deck-meta { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
    .deck-title { font-weight: 600; font-size: 1.15rem; }
    .deck-date { color: #5b6478; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(site.title)}</h1>
    ${tagline}
${renderSection('Recent', built)}
${renderSection('Archive', legacy)}
  </main>
</body>
</html>
`;
}

export function rewriteAssetPaths(html, slug) {
  return html
    .replaceAll('="../../../', '="/')
    .replaceAll('="../', `="/${slug}/`);
}

export function collectLocalAssetRefs(html) {
  const re = /(?:href|src)="\.\.\/(?!\.\.\/)([^"]+)"/g;
  const refs = new Set();
  for (const m of html.matchAll(re)) refs.add(m[1]);
  return [...refs];
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

export function startStaticServer(root) {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      try {
        let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const filePath = joinPath(root, pathname);
        if (!filePath.startsWith(root)) { res.statusCode = 403; return res.end('forbidden'); }
        const body = readFileSync(filePath);
        res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
        res.end(body);
      } catch {
        res.statusCode = 404;
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolveServer({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

export async function captureTitleSlide({ url, outPath, width = 1920, height = 1080 }) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await page.waitForSelector('.slide.is-current', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    const deck = page.locator('.deck').first();
    await deck.screenshot({ path: outPath });
  } finally {
    await browser.close();
  }
}

async function defaultCapture(outDir, slugs) {
  if (slugs.length === 0) return;
  const server = await startStaticServer(outDir);
  try {
    for (const slug of slugs) {
      await captureTitleSlide({
        url: `${server.origin}/${slug}/`,
        outPath: resolve(outDir, ogImageRelPath(slug)),
      });
    }
  } finally {
    await server.close();
  }
}

async function defaultBuildOne(talkDir) {
  await buildDeck(talkDir);
  return resolve(talkDir, 'dist', 'index.html');
}

export async function assembleSite({
  manifest,
  talksRoot,
  outDir,
  tokensCssPath,
  sharedDirs = [],
  buildOne = defaultBuildOne,
  capture = defaultCapture,
}) {
  validateManifest(manifest);
  const decks = manifest.decks.map(normalizeDeck);

  mkdirSync(outDir, { recursive: true });
  mkdirSync(resolve(outDir, 'assets'), { recursive: true });
  copyFileSync(tokensCssPath, resolve(outDir, 'assets', 'tokens.css'));

  for (const dir of sharedDirs) {
    cpSync(dir, resolve(outDir, basename(dir)), { recursive: true });
  }

  const baseUrl = manifest.site.baseUrl;
  const builtSlugs = [];

  for (const deck of decks) {
    if (deck.source !== 'build') continue;
    const talkDir = resolve(talksRoot, deck.slug);
    const distPath = await buildOne(talkDir);
    const html = readFileSync(distPath, 'utf8');
    const deckOut = resolve(outDir, deck.slug);
    mkdirSync(deckOut, { recursive: true });
    for (const ref of collectLocalAssetRefs(html)) {
      const dest = resolve(deckOut, ref);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(resolve(talkDir, ref), dest);
    }
    const rewritten = rewriteAssetPaths(html, deck.slug);
    const withOg = injectOgMeta(rewritten, {
      title: deck.title,
      description: deck.description || firstH2Text(html) || manifest.site.tagline || '',
      url: deckCanonicalUrl(baseUrl, deck.slug),
      image: ogImageUrl(baseUrl, deck.slug),
      width: 1920,
      height: 1080,
    });
    writeFileSync(resolve(deckOut, 'index.html'), withOg);
    builtSlugs.push(deck.slug);
  }

  mkdirSync(resolve(outDir, 'og'), { recursive: true });
  await capture(outDir, builtSlugs);

  writeFileSync(resolve(outDir, 'index.html'), renderLanding(manifest.site, decks));
  return outDir;
}

export function loadManifest(path) {
  return validateManifest(JSON.parse(readFileSync(path, 'utf8')));
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const manifestPath = resolve(HERE, '..', 'decks.json');
  const manifest = loadManifest(manifestPath);
  assembleSite({
    manifest,
    talksRoot: resolve(HERE, '..', 'talks'),
    outDir: resolve(HERE, '..', '_site'),
    tokensCssPath: resolve(HERE, '..', 'css', 'tokens.css'),
    sharedDirs: ['css', 'img', 'script'].map(d => resolve(HERE, '..', d)),
  }).then(out => console.log(`assembled ${out}`))
    .catch(err => { console.error(err.stack || err.message); process.exit(1); });
}
