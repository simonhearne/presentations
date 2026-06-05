import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateManifest, normalizeDeck, deckHref, renderLanding, assembleSite, loadManifest } from '../bin/site.js';

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

test('loadManifest: parses and validates the real decks.json', () => {
  const m = loadManifest(new URL('../decks.json', import.meta.url).pathname);
  assert.ok(m.decks.length >= 5);
});

test('renderLanding: includes an inline SVG favicon', () => {
  const html = renderLanding({ title: 'Talks' }, []);
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml/);
});
