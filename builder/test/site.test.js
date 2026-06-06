import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateManifest, normalizeDeck, deckHref, renderLanding, assembleSite, loadManifest, rewriteAssetPaths, collectLocalAssetRefs, normalizeBaseUrl, deckCanonicalUrl, ogImageUrl, ogImageRelPath, firstH2Text } from '../bin/site.js';

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

test('assembleSite: builds (no bundle), copies shared + deck-local assets, rewrites paths', async () => {
  const root = mkdtempSync(join(tmpdir(), 'site-assemble-'));
  try {
    const talksRoot = join(root, 'talks');
    const outDir = join(root, '_site');
    const tokensCssPath = join(root, 'tokens.css');
    mkdirSync(talksRoot, { recursive: true });
    writeFileSync(tokensCssPath, ':root{--x:1}');

    // Shared asset dirs (copied once into _site).
    const cssDir = join(root, 'css');
    const imgDir = join(root, 'img');
    const scriptDir = join(root, 'script');
    mkdirSync(cssDir, { recursive: true });
    mkdirSync(imgDir, { recursive: true });
    mkdirSync(scriptDir, { recursive: true });
    writeFileSync(join(cssDir, 'layouts.css'), '.x{background:url(../img/automata.jpg)}');
    writeFileSync(join(imgDir, 'automata.jpg'), 'JPGBYTES');
    writeFileSync(join(scriptDir, 'deck.js'), '// deck');

    // Deck-local asset.
    const deckData = join(talksRoot, 'deck-a', 'data', 'faces');
    mkdirSync(deckData, { recursive: true });
    writeFileSync(join(deckData, 'x.jpg'), 'FACE');

    const manifest = {
      site: { title: 'Talks', tagline: 'hi' },
      decks: [
        { slug: 'deck-a', source: 'build', title: 'Deck A' },
        { slug: 'psych-speed', source: 'legacy', title: 'Psych' },
      ],
    };

    // Fake builder: writes a dist/index.html with shared + deck-local refs.
    const fakeBuild = async (talkDir) => {
      const dist = join(talkDir, 'dist');
      mkdirSync(dist, { recursive: true });
      const out = join(dist, 'index.html');
      writeFileSync(out,
        '<link href="../../../css/layouts.css">' +
        '<script src="../../../script/deck.js"></script>' +
        '<img src="../data/faces/x.jpg">');
      return out;
    };

    await assembleSite({
      manifest, talksRoot, outDir, tokensCssPath,
      sharedDirs: [cssDir, imgDir, scriptDir],
      buildOne: fakeBuild,
    });

    const deckHtml = readFileSync(join(outDir, 'deck-a', 'index.html'), 'utf8');
    assert.match(deckHtml, /href="\/css\/layouts\.css"/, 'shared css rewritten root-absolute');
    assert.match(deckHtml, /src="\/deck-a\/data\/faces\/x\.jpg"/, 'deck-local rewritten with slug');
    assert.doesNotMatch(deckHtml, /\.\.\//, 'no relative ../ left in deck html');

    assert.ok(existsSync(join(outDir, 'css', 'layouts.css')), 'shared css copied');
    assert.ok(existsSync(join(outDir, 'img', 'automata.jpg')), 'automata.jpg copied');
    assert.ok(existsSync(join(outDir, 'script', 'deck.js')), 'shared script copied');
    assert.ok(existsSync(join(outDir, 'deck-a', 'data', 'faces', 'x.jpg')), 'deck-local asset copied');

    // CSS left verbatim so its ../img/ resolves against the css↔img sibling layout.
    assert.match(readFileSync(join(outDir, 'css', 'layouts.css'), 'utf8'), /url\(\.\.\/img\/automata\.jpg\)/);

    assert.ok(existsSync(join(outDir, 'assets', 'tokens.css')), 'tokens copied');
    assert.ok(!existsSync(join(outDir, 'psych-speed')), 'legacy deck not copied');
    const landing = readFileSync(join(outDir, 'index.html'), 'utf8');
    assert.match(landing, /href="\/deck-a\/"/);
    assert.match(landing, /presentations\/psych-speed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadManifest: parses and validates the real decks.json', () => {
  const m = loadManifest(new URL('../decks.json', import.meta.url).pathname);
  assert.ok(m.decks.length >= 5);
});

test('renderLanding: includes an inline SVG favicon', () => {
  const html = renderLanding({ title: 'Talks' }, []);
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml/);
});

test('rewriteAssetPaths: shared three-up refs become root-absolute', () => {
  const html = '<link href="../../../css/layouts.css"><script src="../../../script/deck.js"></script>';
  const out = rewriteAssetPaths(html, 'deck-a');
  assert.match(out, /href="\/css\/layouts\.css"/);
  assert.match(out, /src="\/script\/deck\.js"/);
  assert.doesNotMatch(out, /\.\.\//);
});

test('rewriteAssetPaths: deck-local one-up refs become /<slug>/…', () => {
  const html = '<img src="../data/faces/003983.jpg">';
  const out = rewriteAssetPaths(html, 'deck-a');
  assert.match(out, /src="\/deck-a\/data\/faces\/003983\.jpg"/);
});

test('rewriteAssetPaths: does not touch a non-attribute ../ substring', () => {
  const html = 'background: url(../img/automata.jpg);';
  assert.equal(rewriteAssetPaths(html, 'deck-a'), html);
});

test('collectLocalAssetRefs: returns deck-local refs, excludes shared refs', () => {
  const html = '<link href="../../../css/x.css"><img src="../data/a.jpg"><script src="../../../script/deck.js"></script>';
  assert.deepEqual(collectLocalAssetRefs(html), ['data/a.jpg']);
});

test('collectLocalAssetRefs: de-duplicates repeated refs', () => {
  const html = '<img src="../data/a.jpg"><img src="../data/a.jpg">';
  assert.deepEqual(collectLocalAssetRefs(html), ['data/a.jpg']);
});

test('normalizeBaseUrl: strips a single trailing slash', () => {
  assert.equal(normalizeBaseUrl('https://talks.simonhearne.com/'), 'https://talks.simonhearne.com');
  assert.equal(normalizeBaseUrl('https://talks.simonhearne.com'), 'https://talks.simonhearne.com');
});

test('deckCanonicalUrl: builds an absolute trailing-slash deck url', () => {
  assert.equal(
    deckCanonicalUrl('https://talks.simonhearne.com/', 'vectordb-101'),
    'https://talks.simonhearne.com/vectordb-101/'
  );
});

test('ogImageRelPath: returns og/<slug>.png', () => {
  assert.equal(ogImageRelPath('vectordb-101'), 'og/vectordb-101.png');
});

test('ogImageUrl: builds an absolute og image url', () => {
  assert.equal(
    ogImageUrl('https://talks.simonhearne.com', 'vectordb-101'),
    'https://talks.simonhearne.com/og/vectordb-101.png'
  );
});

test('firstH2Text: returns text of the first h2, tags stripped', () => {
  const html = '<h1>Title</h1><h2>A <em>sub</em>title</h2><h2>second</h2>';
  assert.equal(firstH2Text(html), 'A subtitle');
});

test('firstH2Text: returns empty string when no h2', () => {
  assert.equal(firstH2Text('<h1>Only</h1>'), '');
});
