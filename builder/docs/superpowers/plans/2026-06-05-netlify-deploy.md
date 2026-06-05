# Netlify Deploy at talks.simonhearne.com — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a site-assembly step that compiles the real new decks into a publishable `_site/` with a generated landing page, then migrate this builder into `simonhearne/presentations` and deploy it via Netlify at `talks.simonhearne.com`.

**Architecture:** A new `bin/site.js` reads `decks.json` (the deck manifest), builds + bundles each `source: "build"` deck and copies its self-contained `bundle.html` to `_site/<slug>/index.html`, then generates `_site/index.html` (a brand-styled landing page) linking built decks at `/<slug>/` and legacy decks out to `simonhearne.com/presentations/<deck>/`. All of this is developed and tested in *this* repo (`zilliz-presentations`), then copied wholesale into `builder/` inside the legacy repo, with a root `netlify.toml` (`base = "builder"`). GitHub Pages and the 11ty `/presentations/*` proxy are left untouched.

**Tech Stack:** Node ESM, `node:test`, existing `buildDeck`/`bundleDeck` from `bin/build.js` + `bin/bundle.js`, `marked`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-05-netlify-deploy-design.md`

---

## File Structure

- **Modify** `bin/build.js` — export the existing `escapeHtml` so `site.js` can reuse it.
- **Create** `decks.json` (repo root) — the deck manifest (site metadata + ordered deck list).
- **Create** `bin/site.js` — site assembly: manifest validation, landing-page rendering, orchestration, CLI entry. Pure helpers above the orchestrator (matches house style in `bin/build.js`).
- **Create** `test/site.test.js` — unit tests for validation + landing rendering, one integration test for `assembleSite` with an injected fake builder (no network, deterministic).
- **Modify** `.gitignore` — ignore `_site/`.
- **Modify** `README.md`, `CLAUDE.md` — document the deploy pipeline and `decks.json`.
- **Migration only (in `/Users/simon/Projects/presentations-legacy`)** — create `builder/` (copy of this repo), `netlify.toml` (root), `builder/.nvmrc`, `builder/.gitignore` entry for `_site/`.

`site.js` is one focused file: a manifest layer (`loadManifest`/`validateManifest`/`normalizeDeck`), a rendering layer (`deckHref`/`renderLanding`), and a thin I/O orchestrator (`assembleSite`) + CLI. This mirrors how `build.js` keeps pure helpers above `buildDeck`.

---

## Task 1: Export `escapeHtml` from build.js

**Files:**
- Modify: `bin/build.js:178`
- Test: `test/build.test.js` (append + extend import line)

- [ ] **Step 1: Write the failing test**

Add `escapeHtml` to the existing `../bin/build.js` import line at the top of `test/build.test.js` (append to the destructured list, do not add a second import statement). Then append this test at the bottom of the file:

```js
test('escapeHtml: escapes &, <, >, and quotes', () => {
  assert.equal(escapeHtml('a & b <c> "d"'), 'a &amp; b &lt;c&gt; &quot;d&quot;');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `escapeHtml` is not exported (`SyntaxError: ... does not provide an export named 'escapeHtml'`).

- [ ] **Step 3: Make the minimal change**

In `bin/build.js`, line 178, add the `export` keyword:

```js
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): export escapeHtml for reuse in site assembly"
```

---

## Task 2: Create `decks.json` manifest

**Files:**
- Create: `decks.json`

- [ ] **Step 1: Write the manifest**

Create `decks.json` at the repo root with exactly this content (titles extracted from the new decks' `slides.md` and the legacy `<deck>/index.html` `<title>` tags; legacy `date` values are best-effort and can be tuned later):

```json
{
  "site": {
    "title": "Simon Hearne — Talks",
    "tagline": "Slides from talks and workshops."
  },
  "decks": [
    { "slug": "vector-search-visualised", "source": "build", "title": "Vector Search, Visualised", "date": "2026-06" },
    { "slug": "vectordb-101", "source": "build", "title": "Vector Databases 101", "date": "2026" },
    { "slug": "vectordb-201", "source": "build", "title": "Vector Databases 201", "date": "2026" },
    { "slug": "vectordb-301", "source": "build", "title": "Vector Databases 301", "date": "2026" },
    { "slug": "vectordb-301-rabitq", "source": "build", "title": "Vector Databases 301 — RaBitQ", "date": "2026" },
    { "slug": "psych-speed", "source": "legacy", "title": "The Psychology of Speed", "date": "2020" },
    { "slug": "inclusive-design", "source": "legacy", "title": "An Inclusive Web is Fast by Default", "date": "2021" },
    { "slug": "cwv-spa", "source": "legacy", "title": "Optimising Core Web Vitals on SPAs", "date": "2021" },
    { "slug": "third-party-deep", "source": "legacy", "title": "Third-party content: a deep dive", "date": "2019" },
    { "slug": "ad-block-perf", "source": "legacy", "title": "The state of third-party tag performance", "date": "2019" },
    { "slug": "digital-revenue", "source": "legacy", "title": "Maximise Digital Revenue", "date": "2019" },
    { "slug": "future-of-webperf", "source": "legacy", "title": "The Future of Web Performance", "date": "2019" },
    { "slug": "improving-engagement", "source": "legacy", "title": "Five Surprising Techniques to Improve Online Engagement", "date": "2018" },
    { "slug": "workshop", "source": "legacy", "title": "Web Performance Workshop", "date": "2019" },
    { "slug": "weaklinks", "source": "legacy", "title": "Weak Links", "url": "https://simonhearne.com/presentations/weaklinks.html", "date": "2018" }
  ]
}
```

- [ ] **Step 2: Verify it parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('decks.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add decks.json
git commit -m "feat(site): add decks.json manifest"
```

---

## Task 3: Manifest loading & validation in site.js

**Files:**
- Create: `bin/site.js`
- Test: `test/site.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/site.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, normalizeDeck } from '../bin/site.js';

test('validateManifest: accepts a minimal valid manifest', () => {
  const m = { site: { title: 'T' }, decks: [{ slug: 'a', source: 'build', title: 'A' }] };
  assert.equal(validateManifest(m), m);
});

test('validateManifest: rejects a deck missing a required field', () => {
  const m = { site: { title: 'T' }, decks: [{ slug: 'a', source: 'build' }] };
  assert.throws(() => validateManifest(m), /title/);
});

test('validateManifest: rejects an unknown source', () => {
  const m = { site: { title: 'T' }, decks: [{ slug: 'a', source: 'video', title: 'A' }] };
  assert.throws(() => validateManifest(m), /source/);
});

test('validateManifest: rejects when decks is not an array', () => {
  assert.throws(() => validateManifest({ site: { title: 'T' }, decks: {} }), /decks/);
});

test('normalizeDeck: defaults legacy url to /presentations/<slug>/', () => {
  assert.equal(
    normalizeDeck({ slug: 'psych-speed', source: 'legacy', title: 'P' }).url,
    'https://simonhearne.com/presentations/psych-speed/'
  );
});

test('normalizeDeck: keeps an explicit legacy url', () => {
  assert.equal(
    normalizeDeck({ slug: 'weaklinks', source: 'legacy', title: 'W', url: 'https://x/y.html' }).url,
    'https://x/y.html'
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/site.test.js`
Expected: FAIL — cannot find module `../bin/site.js` / exports not defined.

- [ ] **Step 3: Write the minimal implementation**

Create `bin/site.js`:

```js
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/site.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add bin/site.js test/site.test.js
git commit -m "feat(site): manifest validation and legacy-url normalization"
```

---

## Task 4: Landing-page rendering

**Files:**
- Modify: `bin/site.js`
- Test: `test/site.test.js`

- [ ] **Step 1: Write the failing tests**

Add `deckHref, renderLanding` to the existing `../bin/site.js` import line in `test/site.test.js`, then append:

```js
test('deckHref: built decks link to /<slug>/', () => {
  assert.equal(deckHref(normalizeDeck({ slug: 'vectordb-101', source: 'build', title: 'X' })), '/vectordb-101/');
});

test('deckHref: legacy decks link to their url', () => {
  assert.equal(deckHref(normalizeDeck({ slug: 'psych-speed', source: 'legacy', title: 'X' })),
    'https://simonhearne.com/presentations/psych-speed/');
});

test('renderLanding: includes a link for every deck with correct href', () => {
  const decks = [
    normalizeDeck({ slug: 'vectordb-101', source: 'build', title: 'Vector Databases 101' }),
    normalizeDeck({ slug: 'psych-speed', source: 'legacy', title: 'The Psychology of Speed' }),
  ];
  const html = renderLanding({ title: 'Talks' }, decks);
  assert.match(html, /href="\/vectordb-101\/"/);
  assert.match(html, />Vector Databases 101</);
  assert.match(html, /href="https:\/\/simonhearne\.com\/presentations\/psych-speed\/"/);
  assert.match(html, /assets\/tokens\.css/);
});

test('renderLanding: escapes deck titles', () => {
  const decks = [normalizeDeck({ slug: 'x', source: 'build', title: 'A & <b>' })];
  const html = renderLanding({ title: 'Talks' }, decks);
  assert.match(html, /A &amp; &lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});

test('renderLanding: groups built decks under Recent and legacy under Archive', () => {
  const decks = [
    normalizeDeck({ slug: 'a', source: 'build', title: 'A' }),
    normalizeDeck({ slug: 'b', source: 'legacy', title: 'B' }),
  ];
  const html = renderLanding({ title: 'Talks' }, decks);
  assert.match(html, /Recent[\s\S]*Archive/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/site.test.js`
Expected: FAIL — `deckHref`/`renderLanding` not exported.

- [ ] **Step 3: Implement rendering**

Append to `bin/site.js` (after `normalizeDeck`):

```js
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
  <link rel="stylesheet" href="/assets/tokens.css">
  <style>
    body { font-family: var(--font-sans, Inter, system-ui, sans-serif); margin: 0;
      background: var(--color-bg, #fff); color: var(--color-ink, #0b1020); }
    main { max-width: 880px; margin: 0 auto; padding: 4rem 1.5rem; }
    h1 { font-size: 2.5rem; margin: 0 0 .25rem; }
    .tagline { color: var(--color-muted, #5b6478); margin: 0 0 3rem; font-size: 1.1rem; }
    .deck-group h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .08em;
      color: var(--color-muted, #5b6478); margin: 2.5rem 0 .75rem; }
    .deck-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
    .deck-card a { display: flex; justify-content: space-between; align-items: baseline;
      gap: 1rem; padding: 1rem 1.25rem; border: 1px solid var(--color-line, #e6e8ee);
      border-radius: 12px; text-decoration: none; color: inherit; transition: border-color .15s; }
    .deck-card a:hover { border-color: var(--color-accent, #2563eb); }
    .deck-title { font-weight: 600; font-size: 1.15rem; }
    .deck-date { color: var(--color-muted, #5b6478); font-variant-numeric: tabular-nums; }
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/site.test.js`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add bin/site.js test/site.test.js
git commit -m "feat(site): render brand-styled landing page from manifest"
```

---

## Task 5: `assembleSite` orchestrator

**Files:**
- Modify: `bin/site.js`
- Test: `test/site.test.js`

- [ ] **Step 1: Write the failing integration test**

Add `assembleSite` to the `../bin/site.js` import line, and add these fs/path imports to the existing import lines in `test/site.test.js`:

```js
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
```

Then append the test. It injects a fake builder so no real deck build or network fetch happens — it verifies copy + landing + tokens wiring only:

```js
test('assembleSite: copies built bundles, writes landing, copies tokens.css', async () => {
  const root = mkdtempSync(join(tmpdir(), 'site-assemble-'));
  try {
    const talksRoot = join(root, 'talks');
    const outDir = join(root, '_site');
    const tokensCssPath = join(root, 'tokens.css');
    mkdirSync(talksRoot, { recursive: true });
    writeFileSync(tokensCssPath, ':root{--x:1}');

    const manifest = {
      site: { title: 'Talks', tagline: 'hi' },
      decks: [
        { slug: 'deck-a', source: 'build', title: 'Deck A' },
        { slug: 'psych-speed', source: 'legacy', title: 'Psych' },
      ],
    };

    // Fake builder: writes a recognizable bundle.html into the deck's dist dir.
    const fakeBuild = async (talkDir) => {
      const dist = join(talkDir, 'dist');
      mkdirSync(dist, { recursive: true });
      const out = join(dist, 'bundle.html');
      writeFileSync(out, '<html>BUNDLE deck-a</html>');
      return out;
    };

    await assembleSite({ manifest, talksRoot, outDir, tokensCssPath, buildOne: fakeBuild });

    assert.ok(existsSync(join(outDir, 'deck-a', 'index.html')), 'built deck copied');
    assert.match(readFileSync(join(outDir, 'deck-a', 'index.html'), 'utf8'), /BUNDLE deck-a/);
    assert.ok(!existsSync(join(outDir, 'psych-speed')), 'legacy deck not copied');
    assert.ok(existsSync(join(outDir, 'assets', 'tokens.css')), 'tokens copied');
    const landing = readFileSync(join(outDir, 'index.html'), 'utf8');
    assert.match(landing, /href="\/deck-a\/"/);
    assert.match(landing, /presentations\/psych-speed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/site.test.js`
Expected: FAIL — `assembleSite` not exported.

- [ ] **Step 3: Implement the orchestrator**

Append to `bin/site.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/site.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 6: Commit**

```bash
git add bin/site.js test/site.test.js
git commit -m "feat(site): assembleSite orchestrator (build, copy, landing, tokens)"
```

---

## Task 6: CLI entry + real local build verification

**Files:**
- Modify: `bin/site.js`
- Modify: `.gitignore`
- Modify: `package.json` (add a `site` script)

- [ ] **Step 1: Add the CLI entry**

Append to `bin/site.js`:

```js
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
```

Add `loadManifest` to the `test/site.test.js` import line and append a test:

```js
test('loadManifest: parses and validates the real decks.json', () => {
  const m = loadManifest(new URL('../decks.json', import.meta.url).pathname);
  assert.ok(m.decks.length >= 5);
});
```

- [ ] **Step 2: Run tests**

Run: `node --test test/site.test.js`
Expected: PASS (13 tests).

- [ ] **Step 3: Add the npm script**

In `package.json`, add to `scripts` (after `bundle`):

```json
    "site": "node bin/site.js",
```

- [ ] **Step 4: Ignore the build output**

Add to `.gitignore` (new line):

```
_site/
```

- [ ] **Step 5: Run the real assembly end-to-end**

Run: `npm run site`
Expected: builds each of the 5 `build` decks and prints `assembled .../_site`. (This runs the real `buildDeck`/`bundleDeck`; it needs network for Google Fonts inlining, which is fine locally.)

- [ ] **Step 6: Verify the output structure**

Run: `ls _site && ls _site/vectordb-101 && ls _site/assets && head -c 400 _site/index.html`
Expected: directories `vector-search-visualised vectordb-101 vectordb-201 vectordb-301 vectordb-301-rabitq assets` + `index.html`; `_site/vectordb-101/index.html` exists; `_site/assets/tokens.css` exists; landing HTML shows the site title and deck links.

- [ ] **Step 7: Spot-check a deck and the landing in a browser**

Run: `open _site/index.html` then click into a built deck.
Expected: landing lists all decks (Recent + Archive); built-deck links open the deck; legacy links point to `simonhearne.com/presentations/<slug>/`.

- [ ] **Step 8: Commit**

```bash
git add bin/site.js package.json .gitignore test/site.test.js
git commit -m "feat(site): CLI entry + npm run site; ignore _site output"
```

---

## Task 7: Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a Deployment section to README.md**

Append a new section near the end of `README.md`:

```markdown
## Deployment

The decks are published at **https://talks.simonhearne.com** (Netlify), built
from `simonhearne/presentations` where this builder lives under `builder/`.

- `decks.json` is the manifest of what gets published. Each entry has `slug`,
  `source` (`build` = compiled from `talks/<slug>/`, `legacy` = link-out to an
  existing reveal.js deck), `title`, optional `date`, and (legacy only) an
  optional `url` (defaults to `https://simonhearne.com/presentations/<slug>/`).
- `npm run site` runs `bin/site.js`: it builds + bundles every `build` deck,
  copies each self-contained `bundle.html` to `_site/<slug>/index.html`, copies
  `css/tokens.css` to `_site/assets/`, and generates `_site/index.html` (the
  landing page). `_site/` is the Netlify publish directory.
- Netlify config lives at the combined repo's root `netlify.toml`
  (`base = "builder"`, `command = "npm ci && node bin/site.js"`,
  `publish = "_site"`). Legacy decks remain served by GitHub Pages via the
  `simonhearne.com/presentations/*` proxy and are linked (not re-hosted).
```

- [ ] **Step 2: Add a Deploy/site note to CLAUDE.md**

Append under the Architecture section of `CLAUDE.md`:

```markdown
## Site assembly & deploy

3. **Site** ([bin/site.js](bin/site.js)) — `decks.json` → `_site/`. Builds +
   bundles every `source: "build"` deck and copies its `bundle.html` to
   `_site/<slug>/index.html`, copies `css/tokens.css` to `_site/assets/`, and
   generates `_site/index.html` (landing page). `source: "legacy"` decks are
   link-outs to `simonhearne.com/presentations/<slug>/`, not re-hosted. Run via
   `npm run site`. This is the Netlify build; deployed at talks.simonhearne.com
   from `simonhearne/presentations` (this builder lives under `builder/` there).
   `bin/site.js` keeps pure helpers (`validateManifest`, `normalizeDeck`,
   `deckHref`, `renderLanding`) above the `assembleSite` orchestrator, same as
   `build.js`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document the site assembly + Netlify deploy pipeline"
```

---

## Task 8: Migration into the legacy repo

Operates on the **already-cloned** legacy repo at `/Users/simon/Projects/presentations-legacy` (remote `git@github.com:simonhearne/presentations.git`, branch `master`). The builder source is this repo at `/Users/simon/Projects/presentations`.

- [ ] **Step 1: Confirm a clean legacy working tree**

Run: `git -C /Users/simon/Projects/presentations-legacy status --short`
Expected: empty output (clean).

- [ ] **Step 2: Copy this repo into `builder/` (excluding VCS, node_modules, build output)**

Run:

```bash
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '_site' \
  --exclude 'talks/*/dist' --exclude '.DS_Store' \
  /Users/simon/Projects/presentations/ \
  /Users/simon/Projects/presentations-legacy/builder/
```

Expected: `/Users/simon/Projects/presentations-legacy/builder/` now contains `bin/ css/ script/ talks/ test/ decks.json package.json ...`.

- [ ] **Step 3: Add `builder/.nvmrc`**

Create `/Users/simon/Projects/presentations-legacy/builder/.nvmrc` containing the Node major version used locally:

```
20
```

(Confirm with `node -v`; use that major version.)

- [ ] **Step 4: Ensure `_site/` is ignored in the builder**

Confirm `/Users/simon/Projects/presentations-legacy/builder/.gitignore` contains `_site/` (it was copied from this repo, which added it in Task 6). If missing, add it.

- [ ] **Step 5: Create the root `netlify.toml`**

Create `/Users/simon/Projects/presentations-legacy/netlify.toml`:

```toml
[build]
  base = "builder"
  command = "npm ci && node bin/site.js"
  publish = "_site"
```

- [ ] **Step 6: Install deps and run the assembly inside the builder**

Run:

```bash
cd /Users/simon/Projects/presentations-legacy/builder && npm ci && node bin/site.js
```

Expected: prints `assembled .../builder/_site`; `builder/_site/index.html` and one dir per built deck exist.

- [ ] **Step 7: Confirm legacy decks are untouched at root**

Run: `ls /Users/simon/Projects/presentations-legacy/psych-speed/index.html /Users/simon/Projects/presentations-legacy/css/reveal.css`
Expected: both exist (root legacy content unchanged → GitHub Pages keeps serving `/presentations/<deck>/`).

- [ ] **Step 8: Stage everything and verify `_site/` is not staged**

Run:

```bash
cd /Users/simon/Projects/presentations-legacy && git add -A && git status --short | grep -c '_site/'
```

Expected: `0` (the build output is ignored).

- [ ] **Step 9: Commit as a single commit**

```bash
cd /Users/simon/Projects/presentations-legacy
git commit -m "feat: add deck builder + Netlify deploy under builder/

Adds the markdown-to-HTML deck builder and new vector-search decks under
builder/, plus a root netlify.toml that builds _site/ for talks.simonhearne.com.
Legacy reveal.js decks at the repo root are unchanged and keep being served by
GitHub Pages via the simonhearne.com/presentations/* proxy.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Push (only when the user confirms)**

```bash
cd /Users/simon/Projects/presentations-legacy && git push origin master
```

Expected: push succeeds. **Do not push without explicit user go-ahead.**

---

## Task 9: Netlify + DNS (manual, user-performed)

These steps are performed by the user in the Netlify and DNS dashboards — not by an agent. Documented here for completeness.

- [ ] **Step 1:** In Netlify, "Add new site → Import from Git", pick `simonhearne/presentations`, branch `master`. Netlify reads `netlify.toml` (`base = builder`). Trigger the first deploy and confirm it succeeds (publishes `builder/_site`).
- [ ] **Step 2:** Verify the `*.netlify.app` URL serves the landing page and a built deck.
- [ ] **Step 3:** In Netlify "Domain management", add custom domain `talks.simonhearne.com`.
- [ ] **Step 4:** At the DNS provider for `simonhearne.com`, add a `CNAME` record: `talks` → `<your-site>.netlify.app`.
- [ ] **Step 5:** Wait for DNS propagation; confirm Netlify provisions HTTPS and `https://talks.simonhearne.com` serves the landing page.

---

## Self-Review Notes

- **Spec coverage:** manifest (Task 2/3), `site.js` build/copy/landing/tokens (Tasks 3–6), Netlify config + base=builder (Task 8), DNS (Task 9), legacy link-out + no re-host (Task 3 `normalizeDeck`/Task 5 skips non-build), legacy untouched at root (Task 8 Step 7), docs (Task 7), tests (Tasks 1,3,4,5,6). 11ty/GitHub Pages untouched — no task modifies them. ✓
- **Type consistency:** `validateManifest`, `normalizeDeck`, `deckHref`, `renderLanding`, `assembleSite`, `loadManifest`, `defaultBuildOne`/`buildOne` used consistently across tasks. `assembleSite` options object (`manifest, talksRoot, outDir, tokensCssPath, buildOne, fetchFn`) matches between Task 5 impl and its test. ✓
- **No placeholders:** all code shown in full; legacy `date` values flagged as tunable, not blocking. ✓
