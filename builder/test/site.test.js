import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateManifest, normalizeDeck, deckHref, renderLanding, assembleSite, loadManifest, rewriteAssetPaths, collectLocalAssetRefs, normalizeBaseUrl, deckCanonicalUrl, ogImageUrl, ogImageRelPath, firstH2Text, injectOgMeta, startStaticServer, captureTitleSlide } from '../bin/site.js';

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
      site: { title: 'Talks', tagline: 'hi', baseUrl: 'https://talks.simonhearne.com' },
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
        '<head></head>' +
        '<link href="../../../css/layouts.css">' +
        '<script src="../../../script/deck.js"></script>' +
        '<img src="../data/faces/x.jpg">');
      return out;
    };

    const captured = [];
    await assembleSite({
      manifest, talksRoot, outDir, tokensCssPath,
      sharedDirs: [cssDir, imgDir, scriptDir],
      buildOne: fakeBuild,
      capture: async (dir, slugs) => {
        for (const slug of slugs) {
          writeFileSync(join(dir, 'og', `${slug}.png`), 'PNG');
          captured.push(slug);
        }
      },
    });

    const deckHtml = readFileSync(join(outDir, 'deck-a', 'index.html'), 'utf8');
    assert.match(deckHtml, /href="\/css\/layouts\.css"/, 'shared css rewritten root-absolute');
    assert.match(deckHtml, /src="\/deck-a\/data\/faces\/x\.jpg"/, 'deck-local rewritten with slug');
    assert.doesNotMatch(deckHtml, /\.\.\//, 'no relative ../ left in deck html');

    assert.deepEqual(captured, ['deck-a'], 'capture called for built decks only');
    assert.match(deckHtml, /property="og:image" content="https:\/\/talks\.simonhearne\.com\/og\/deck-a\.png"/);
    assert.match(deckHtml, /property="og:url" content="https:\/\/talks\.simonhearne\.com\/deck-a\//);

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

test('injectOgMeta: inserts OG + Twitter tags before </head>', () => {
  const html = '<html><head><title>t</title></head><body>x</body></html>';
  const out = injectOgMeta(html, {
    title: 'Vector DB 101',
    description: 'An intro',
    url: 'https://talks.simonhearne.com/vectordb-101/',
    image: 'https://talks.simonhearne.com/og/vectordb-101.png',
    width: 1920,
    height: 1080,
  });
  assert.match(out, /<meta property="og:title" content="Vector DB 101">/);
  assert.match(out, /<meta property="og:description" content="An intro">/);
  assert.match(out, /<meta property="og:type" content="website">/);
  assert.match(out, /<meta property="og:url" content="https:\/\/talks\.simonhearne\.com\/vectordb-101\/">/);
  assert.match(out, /<meta property="og:image" content="https:\/\/talks\.simonhearne\.com\/og\/vectordb-101\.png">/);
  assert.match(out, /<meta property="og:image:width" content="1920">/);
  assert.match(out, /<meta property="og:image:height" content="1080">/);
  assert.match(out, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(out, /<meta name="twitter:image" content="https:\/\/talks\.simonhearne\.com\/og\/vectordb-101\.png">/);
  assert.ok(out.indexOf('og:title') < out.indexOf('</head>'));
});

test('injectOgMeta: escapes attribute values', () => {
  const out = injectOgMeta('<head></head>', {
    title: 'A "quoted" & <b>title</b>',
    description: 'd', url: 'u', image: 'i', width: 1, height: 1,
  });
  assert.match(out, /content="A &quot;quoted&quot; &amp; &lt;b&gt;title&lt;\/b&gt;"/);
});

test('renderLanding: built deck card includes an og thumbnail', () => {
  const decks = [{ slug: 'deck-a', source: 'build', title: 'Deck A' }];
  const html = renderLanding({ title: 'Talks' }, decks);
  assert.match(html, /<img class="deck-thumb"[^>]*src="\/og\/deck-a\.png"/);
});

test('renderLanding: legacy deck card has no thumbnail', () => {
  const decks = [{ slug: 'old', source: 'legacy', title: 'Old', url: 'https://x/old/' }];
  const html = renderLanding({ title: 'Talks' }, decks);
  assert.doesNotMatch(html, /<img class="deck-thumb"/);
});

test('renderLanding: defines a .deck-thumb style', () => {
  const html = renderLanding({ title: 'Talks' }, []);
  assert.match(html, /\.deck-thumb\s*\{/);
});

test('startStaticServer: serves files from the root over http', async () => {
  const root = mkdtempSync(join(tmpdir(), 'site-serve-'));
  try {
    mkdirSync(join(root, 'deck-a'), { recursive: true });
    writeFileSync(join(root, 'deck-a', 'index.html'), '<h1>hi</h1>');
    const server = await startStaticServer(root);
    try {
      const res = await fetch(`${server.origin}/deck-a/`);
      assert.equal(res.status, 200);
      assert.match(await res.text(), /<h1>hi<\/h1>/);
    } finally {
      await server.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assembleSite: OG description prefers deck.description, then first h2, then tagline', async () => {
  const root = mkdtempSync(join(tmpdir(), 'site-og-'));
  try {
    const talksRoot = join(root, 'talks');
    const outDir = join(root, '_site');
    const tokensCssPath = join(root, 'tokens.css');
    mkdirSync(talksRoot, { recursive: true });
    writeFileSync(tokensCssPath, ':root{}');
    const manifest = {
      site: { title: 'Talks', tagline: 'fallback tag', baseUrl: 'https://talks.simonhearne.com' },
      decks: [
        { slug: 'has-desc', source: 'build', title: 'Has Desc', description: 'Explicit desc' },
        { slug: 'has-h2', source: 'build', title: 'Has H2' },
        { slug: 'bare', source: 'build', title: 'Bare' },
      ],
    };
    const bodies = {
      'has-desc': '<head></head><body><h1>Has Desc</h1><h2>Ignored Subtitle</h2></body>',
      'has-h2': '<head></head><body><h1>Has H2</h1><h2>The Subtitle</h2></body>',
      'bare': '<head></head><body><h1>Bare</h1></body>',
    };
    const fakeBuild = async (talkDir) => {
      const slug = talkDir.split('/').pop();
      const dist = join(talkDir, 'dist');
      mkdirSync(dist, { recursive: true });
      const out = join(dist, 'index.html');
      writeFileSync(out, bodies[slug]);
      return out;
    };
    await assembleSite({
      manifest, talksRoot, outDir, tokensCssPath, sharedDirs: [],
      buildOne: fakeBuild,
      capture: async () => {},
    });
    const read = (slug) => readFileSync(join(outDir, slug, 'index.html'), 'utf8');
    assert.match(read('has-desc'), /property="og:description" content="Explicit desc"/);
    assert.match(read('has-h2'), /property="og:description" content="The Subtitle"/);
    assert.match(read('bare'), /property="og:description" content="fallback tag"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assembleSite: throws when a built deck has no absolute baseUrl', async () => {
  const root = mkdtempSync(join(tmpdir(), 'site-nobase-'));
  try {
    const talksRoot = join(root, 'talks');
    mkdirSync(talksRoot, { recursive: true });
    const tokensCssPath = join(root, 'tokens.css');
    writeFileSync(tokensCssPath, ':root{}');
    const manifest = {
      site: { title: 'Talks' }, // no baseUrl
      decks: [{ slug: 'deck-a', source: 'build', title: 'Deck A' }],
    };
    await assert.rejects(
      assembleSite({
        manifest, talksRoot, outDir: join(root, '_site'), tokensCssPath,
        sharedDirs: [], buildOne: async () => '', capture: async () => {},
      }),
      /baseUrl/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assembleSite: allows a missing baseUrl when there are no built decks', async () => {
  const root = mkdtempSync(join(tmpdir(), 'site-nobase-ok-'));
  try {
    const talksRoot = join(root, 'talks');
    mkdirSync(talksRoot, { recursive: true });
    const tokensCssPath = join(root, 'tokens.css');
    writeFileSync(tokensCssPath, ':root{}');
    const manifest = {
      site: { title: 'Talks' },
      decks: [{ slug: 'old', source: 'legacy', title: 'Old', url: 'https://x/old/' }],
    };
    await assembleSite({
      manifest, talksRoot, outDir: join(root, '_site'), tokensCssPath,
      sharedDirs: [], capture: async () => {},
    });
    // no throw = pass
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('captureTitleSlide: writes a PNG of the .deck element', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'site-shot-'));
  let server;
  try {
    mkdirSync(join(root, 'deck-a'), { recursive: true });
    writeFileSync(join(root, 'deck-a', 'index.html'),
      '<!doctype html><html><head></head><body>' +
      '<div class="deck" style="width:1920px;height:1080px;background:#123">' +
      '<div class="slide is-current">hi</div></div></body></html>');
    server = await startStaticServer(root);
    const outPath = join(root, 'og', 'deck-a.png');
    mkdirSync(join(root, 'og'), { recursive: true });
    try {
      await captureTitleSlide({ url: `${server.origin}/deck-a/`, outPath });
    } catch (err) {
      return t.skip(`chromium unavailable: ${err.message}`);
    }
    const bytes = readFileSync(outPath);
    assert.ok(bytes.length > 0, 'png not empty');
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'PNG magic bytes');
  } finally {
    if (server) await server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
