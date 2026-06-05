import { readFileSync, writeFileSync, mkdirSync, copyFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { escapeHtml, buildDeck } from './build.js';
import { bundleDeck } from './bundle.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_BASE = 'https://simonhearne.com/presentations';

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
  return `      <li class="deck-card">
        <a href="${escapeHtml(deckHref(deck))}">
          <span class="deck-title">${escapeHtml(deck.title)}</span>
          ${date}
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
    .deck-card a { display: flex; justify-content: space-between; align-items: baseline;
      gap: 1rem; padding: 1rem 1.25rem; border: 1px solid #e6e8ee;
      border-radius: 12px; text-decoration: none; color: inherit; transition: border-color .15s; }
    .deck-card a:hover { border-color: var(--zilliz-blue, #175fff); }
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

async function defaultBuildOne(talkDir, { fetchFn } = {}) {
  await buildDeck(talkDir);
  return bundleDeck(talkDir, fetchFn ? { fetchFn } : {});
}

export async function assembleSite({
  manifest,
  talksRoot,
  outDir,
  tokensCssPath,
  buildOne = defaultBuildOne,
  fetchFn,
}) {
  validateManifest(manifest);
  const decks = manifest.decks.map(normalizeDeck);

  mkdirSync(outDir, { recursive: true });
  mkdirSync(resolve(outDir, 'assets'), { recursive: true });
  copyFileSync(tokensCssPath, resolve(outDir, 'assets', 'tokens.css'));

  for (const deck of decks) {
    if (deck.source !== 'build') continue;
    const talkDir = resolve(talksRoot, deck.slug);
    const bundlePath = await buildOne(talkDir, { fetchFn });
    const deckOut = resolve(outDir, deck.slug);
    mkdirSync(deckOut, { recursive: true });
    copyFileSync(bundlePath, resolve(deckOut, 'index.html'));
  }

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
  }).then(out => console.log(`assembled ${out}`))
    .catch(err => { console.error(err.stack || err.message); process.exit(1); });
}
