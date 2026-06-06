import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSlides, parseAttrs, slugify, extractTitle, renderSlide, parseAuthors, extractAuthors, renderAuthors, copyAuthorPhotos, parseVega, extractVega, renderVega, embedVegaSpecs, extractDot, DOT_DEFAULTS, renderDot, buildDeck, extractDeckConfig, renderAgendaChunk, parseThree, extractThree, THREE_PLACEHOLDER, embedThreeModules, renderThree, parseIframe, extractIframe, renderIframe, IFRAME_PLACEHOLDER, parseAttrList, applyFragmentAttrs, escapeHtml, stripComments } from '../bin/build.js';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('splitSlides: splits on top-level ---', () => {
  const md = '# A\n\n---\n\n# B\n\n---\n\n# C';
  assert.deepEqual(splitSlides(md).map(s => s.trim()), ['# A', '# B', '# C']);
});

test('splitSlides: returns single chunk when no separator', () => {
  assert.deepEqual(splitSlides('# only').map(s => s.trim()), ['# only']);
});

test('splitSlides: ignores --- inside ``` fenced code blocks', () => {
  const md = '# A\n\n```\n---\n```\n\n---\n\n# B';
  const out = splitSlides(md).map(s => s.trim());
  assert.equal(out.length, 2);
  assert.match(out[0], /```\n---\n```/);
  assert.equal(out[1], '# B');
});

test('splitSlides: ignores --- inside ~~~ fenced code blocks', () => {
  const md = '# A\n\n~~~\n---\n~~~\n\n---\n\n# B';
  const out = splitSlides(md).map(s => s.trim());
  assert.equal(out.length, 2);
});

test('splitSlides: only matches lines that are exactly ---', () => {
  const md = '# A\n\n----\n\n# still A';
  assert.equal(splitSlides(md).length, 1);
});

test('parseAttrs: extracts single class', () => {
  const r = parseAttrs('{.hero}\n# Memory is the moat.');
  assert.deepEqual(r.classes, ['hero']);
  assert.equal(r.body.trim(), '# Memory is the moat.');
});

test('parseAttrs: extracts multiple classes', () => {
  const r = parseAttrs('{.hero .center .dark}\n# x');
  assert.deepEqual(r.classes, ['hero', 'center', 'dark']);
});

test('parseAttrs: returns empty classes when no attribute line', () => {
  const r = parseAttrs('# Plain content\n\nbody');
  assert.deepEqual(r.classes, []);
  assert.equal(r.body, '# Plain content\n\nbody');
});

test('parseAttrs: skips leading blank lines before attribute', () => {
  const r = parseAttrs('\n\n{.title}\n# X');
  assert.deepEqual(r.classes, ['title']);
  assert.equal(r.body.trim(), '# X');
});

test('parseAttrs: ignores attribute-like text not on its own line', () => {
  const r = parseAttrs('# {.notattr} title');
  assert.deepEqual(r.classes, []);
});

test('slugify: basic', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('slugify: strips non-alphanumeric, keeps hyphens', () => {
  assert.equal(slugify('Memory is the moat!'), 'memory-is-the-moat');
});

test('slugify: collapses whitespace and trims hyphens', () => {
  assert.equal(slugify('  spaced   out  '), 'spaced-out');
});

test('slugify: truncates to 60 chars', () => {
  const long = 'a'.repeat(80);
  assert.equal(slugify(long).length, 60);
});

test('slugify: empty input → "slide"', () => {
  assert.equal(slugify(''), 'slide');
  assert.equal(slugify('   '), 'slide');
});

test('extractTitle: returns first h1 text', () => {
  assert.equal(extractTitle('<h1>Hello <em>World</em></h1><p>x</p>'), 'Hello World');
});

test('extractTitle: falls back to first h2', () => {
  assert.equal(extractTitle('<p>x</p><h2>Section</h2>'), 'Section');
});

test('extractTitle: returns null when no heading', () => {
  assert.equal(extractTitle('<p>just body</p>'), null);
});

test('renderSlide: wraps in section with index-slug id and class', () => {
  const html = renderSlide({ chunk: '# Hello', index: 1, total: 3 });
  assert.match(html, /<section[^>]+id="1-hello"/);
  assert.match(html, /class="slide"/);
  assert.match(html, /data-index="1"/);
  assert.match(html, /<h1[^>]*>Hello<\/h1>/);
});

test('renderSlide: applies attribute classes', () => {
  const html = renderSlide({ chunk: '{.hero .center}\n# X', index: 2, total: 3 });
  assert.match(html, /class="slide hero center"/);
  assert.match(html, /id="2-x"/);
});

test('renderSlide: appends chrome with N / total', () => {
  const html = renderSlide({ chunk: '# A', index: 4, total: 9 });
  assert.match(html, /<aside class="chrome">[\s\S]*4 \/ 9[\s\S]*<\/aside>/);
});

test('renderSlide: footer-right is an anchor linking to the next slide', () => {
  const html = renderSlide({ chunk: '# A', index: 4, total: 9, nextTitle: 'Next Up' });
  assert.match(html, /<a class="footer-right" href="#5-next-up">Next Up<\/a>/);
});

test('renderSlide: omits footer-right anchor when there is no next slide', () => {
  const html = renderSlide({ chunk: '# A', index: 9, total: 9 });
  assert.doesNotMatch(html, /class="footer-right"/);
});

test('renderSlide: omits chrome when no-chrome class set', () => {
  const html = renderSlide({ chunk: '{.title .no-chrome}\n# X', index: 1, total: 5 });
  assert.doesNotMatch(html, /<footer class="chrome">/);
});

test('renderSlide: id falls back to "slide" slug when no heading', () => {
  const html = renderSlide({ chunk: 'Just body text.', index: 7, total: 10 });
  assert.match(html, /id="7-slide"/);
});

test('renderSlide: backticks inside an inline HTML block become <code>', () => {
  const html = renderSlide({
    chunk: '<p class="callout">Set `nprobe` high — keep `efSearch` modest.</p>',
    index: 1,
    total: 1,
  });
  assert.match(html, /<p class="callout">Set <code>nprobe<\/code> high — keep <code>efSearch<\/code> modest\.<\/p>/);
});

test('splitSlides: handles CRLF line endings', () => {
  const md = '# A\r\n\r\n---\r\n\r\n# B';
  assert.deepEqual(splitSlides(md).map(s => s.trim()), ['# A', '# B']);
});

test('slugify: strips diacritics from Latin characters', () => {
  assert.equal(slugify('Mémoire vive'), 'memoire-vive');
  assert.equal(slugify('Über vector'), 'uber-vector');
});

test('slugify: strips HTML entities instead of mangling them into digits', () => {
  assert.equal(slugify('When EXPLAIN isn&#39;t there'), 'when-explain-isnt-there');
  assert.equal(slugify('A &amp; B'), 'a-b');
  assert.equal(slugify('he said &#8220;hi&#8221;'), 'he-said-hi');
});

test('parseAuthors: parses a single author', () => {
  const body = '- name: Jiang Chen\n  position: head of devrel\n  company: zilliz';
  assert.deepEqual(parseAuthors(body), [
    { name: 'Jiang Chen', position: 'head of devrel', company: 'zilliz' },
  ]);
});

test('parseAuthors: parses multiple authors with all fields', () => {
  const body =
    '- name: Jiang Chen\n' +
    '  position: head of devrel\n' +
    '  company: zilliz\n' +
    '  photo: ./jiang.jpg\n' +
    '- name: Simon Hearne\n' +
    '  position: senior solutions architect\n' +
    '  company: zilliz\n' +
    '  initials: SH';
  assert.deepEqual(parseAuthors(body), [
    { name: 'Jiang Chen', position: 'head of devrel', company: 'zilliz', photo: './jiang.jpg' },
    { name: 'Simon Hearne', position: 'senior solutions architect', company: 'zilliz', initials: 'SH' },
  ]);
});

test('parseAuthors: tolerates blank lines and trailing whitespace', () => {
  const body = '\n- name: A  \n  position: P\n  company: C  \n\n- name: B\n  position: P2\n  company: C2\n';
  assert.deepEqual(parseAuthors(body), [
    { name: 'A', position: 'P', company: 'C' },
    { name: 'B', position: 'P2', company: 'C2' },
  ]);
});

test('parseAuthors: returns [] for empty body', () => {
  assert.deepEqual(parseAuthors(''), []);
  assert.deepEqual(parseAuthors('   \n\n'), []);
});

test('parseAuthors: throws when first non-blank line is not a list item', () => {
  assert.throws(
    () => parseAuthors('name: Jiang Chen\n  position: x\n  company: y'),
    /unexpected line 1/
  );
});

test('parseAuthors: throws when list item missing colon', () => {
  assert.throws(
    () => parseAuthors('- name'),
    /expected "key: value" after "- "/
  );
});

test('parseAuthors: throws when indented line missing colon', () => {
  assert.throws(
    () => parseAuthors('- name: A\n  position'),
    /expected "key: value" on line 2/
  );
});

test('parseAuthors: throws when required field is missing', () => {
  assert.throws(
    () => parseAuthors('- name: A\n  position: P'),
    /missing required field "company"/
  );
  assert.throws(
    () => parseAuthors('- position: P\n  company: C'),
    /missing required field "name"/
  );
});

test('extractAuthors: returns empty authors and original body when no fence', () => {
  const chunk = '{.title}\n# Hello\n\nbody';
  assert.deepEqual(extractAuthors(chunk), { authors: [], body: chunk });
});

test('extractAuthors: strips the authors fence and parses entries', () => {
  const chunk =
    '{.title .no-chrome}\n' +
    '# Bootstrap Deck\n' +
    '## A minimal Zilliz presentation\n' +
    '\n' +
    '```authors\n' +
    '- name: Jiang Chen\n' +
    '  position: head of devrel\n' +
    '  company: zilliz\n' +
    '```\n';
  const r = extractAuthors(chunk);
  assert.deepEqual(r.authors, [
    { name: 'Jiang Chen', position: 'head of devrel', company: 'zilliz' },
  ]);
  assert.doesNotMatch(r.body, /```authors/);
  assert.doesNotMatch(r.body, /^- name:/m);
  assert.match(r.body, /# Bootstrap Deck/);
});

test('extractAuthors: ignores ```authors when nested inside another fence', () => {
  const chunk =
    '# A\n\n' +
    '```\n' +
    '```authors\n' +
    '- name: Not Real\n' +
    '  position: x\n' +
    '  company: y\n' +
    '```\n' +
    '```\n';
  const r = extractAuthors(chunk);
  assert.deepEqual(r.authors, []);
  assert.equal(r.body, chunk);
});

test('extractAuthors: supports ~~~authors as well as ```authors', () => {
  const chunk = '# A\n\n~~~authors\n- name: A\n  position: P\n  company: C\n~~~\n';
  const r = extractAuthors(chunk);
  assert.deepEqual(r.authors, [{ name: 'A', position: 'P', company: 'C' }]);
  assert.doesNotMatch(r.body, /authors/);
});

test('renderAuthors: returns empty string for empty array', () => {
  assert.equal(renderAuthors([]), '');
});

test('renderAuthors: emits speakers wrapper with one speaker per author', () => {
  const html = renderAuthors([
    { name: 'A', position: 'P1', company: 'C1' },
    { name: 'B', position: 'P2', company: 'C2' },
  ]);
  assert.match(html, /^<div class="speakers">/);
  assert.equal((html.match(/<div class="speaker">/g) || []).length, 2);
});

test('renderAuthors: uses photo <img> when photo is set', () => {
  const html = renderAuthors([
    { name: 'Jiang Chen', position: 'head', company: 'zilliz', photo: 'jiang.jpg' },
  ]);
  assert.match(html, /<div class="avatar"><img src="jiang\.jpg" alt=""><\/div>/);
});

test('renderAuthors: derives initials from first and last word', () => {
  const html = renderAuthors([
    { name: 'Jiang Chen', position: 'p', company: 'c' },
    { name: 'Jiang Yi Chen', position: 'p', company: 'c' },
  ]);
  assert.match(html, /<div class="avatar">JC<\/div>[\s\S]*<div class="avatar">JC<\/div>/);
});

test('renderAuthors: single-word name uses single-letter initial', () => {
  const html = renderAuthors([{ name: 'Madonna', position: 'p', company: 'c' }]);
  assert.match(html, /<div class="avatar">M<\/div>/);
});

test('renderAuthors: explicit initials override the derived value', () => {
  const html = renderAuthors([
    { name: 'Mary-Jane O\'Brien', position: 'p', company: 'c', initials: 'MJ' },
  ]);
  assert.match(html, /<div class="avatar">MJ<\/div>/);
});

test('renderAuthors: emits who-name and who-role with bullet separator', () => {
  const html = renderAuthors([
    { name: 'A', position: 'head of devrel', company: 'zilliz' },
  ]);
  assert.match(html, /<div class="who-name">A<\/div>/);
  assert.match(html, /<div class="who-role">head of devrel · zilliz<\/div>/);
});

test('renderAuthors: HTML-escapes name, position, company', () => {
  const html = renderAuthors([
    { name: 'A & B', position: '<p>', company: '"z"' },
  ]);
  assert.match(html, /<div class="who-name">A &amp; B<\/div>/);
  assert.match(html, /<div class="who-role">&lt;p&gt; · &quot;z&quot;<\/div>/);
});

function makeTempTalk() {
  const root = mkdtempSync(join(tmpdir(), 'authors-test-'));
  const dist = join(root, 'dist');
  mkdirSync(dist, { recursive: true });
  return { root, dist };
}

test('copyAuthorPhotos: copies a local photo to dist and rewrites path to basename', () => {
  const { root, dist } = makeTempTalk();
  try {
    writeFileSync(join(root, 'jiang.jpg'), 'JPG-BYTES');
    const out = copyAuthorPhotos(
      [{ name: 'A', position: 'P', company: 'C', photo: './jiang.jpg' }],
      root,
      dist,
    );
    assert.equal(out[0].photo, 'jiang.jpg');
    assert.ok(existsSync(join(dist, 'jiang.jpg')));
    assert.equal(readFileSync(join(dist, 'jiang.jpg'), 'utf8'), 'JPG-BYTES');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('copyAuthorPhotos: leaves http(s) URLs untouched and does not copy', () => {
  const { root, dist } = makeTempTalk();
  try {
    const out = copyAuthorPhotos(
      [
        { name: 'A', position: 'P', company: 'C', photo: 'https://example.com/x.jpg' },
        { name: 'B', position: 'P', company: 'C', photo: 'http://example.com/y.png' },
      ],
      root,
      dist,
    );
    assert.equal(out[0].photo, 'https://example.com/x.jpg');
    assert.equal(out[1].photo, 'http://example.com/y.png');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('copyAuthorPhotos: leaves authors without photo unchanged', () => {
  const { root, dist } = makeTempTalk();
  try {
    const input = [{ name: 'A', position: 'P', company: 'C' }];
    const out = copyAuthorPhotos(input, root, dist);
    assert.deepEqual(out, input);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('copyAuthorPhotos: throws when local photo file is missing', () => {
  const { root, dist } = makeTempTalk();
  try {
    assert.throws(
      () => copyAuthorPhotos(
        [{ name: 'A', position: 'P', company: 'C', photo: './missing.jpg' }],
        root,
        dist,
      ),
      /missing\.jpg/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('renderSlide: appends authors HTML when authors are provided', () => {
  const html = renderSlide({
    chunk: '{.title .no-chrome}\n# Hello',
    index: 1,
    total: 2,
    authors: [{ name: 'A', position: 'P', company: 'C' }],
  });
  assert.match(html, /<div class="speakers">/);
  assert.match(html, /<div class="who-name">A<\/div>/);
});

test('renderSlide: omits authors block when authors is empty or missing', () => {
  const html = renderSlide({ chunk: '# Hello', index: 1, total: 1 });
  assert.doesNotMatch(html, /class="speakers"/);
  const html2 = renderSlide({ chunk: '# Hello', index: 1, total: 1, authors: [] });
  assert.doesNotMatch(html2, /class="speakers"/);
});

test('buildDeck: integration — local photo gets copied and inlined as bare filename', async () => {
  const root = mkdtempSync(join(tmpdir(), 'authors-build-'));
  try {
    writeFileSync(join(root, 'jiang.jpg'), 'JPG-BYTES');
    writeFileSync(
      join(root, 'slides.md'),
      '{.title .no-chrome}\n' +
      '# Deck\n' +
      '\n' +
      '```authors\n' +
      '- name: Jiang Chen\n' +
      '  position: head of devrel\n' +
      '  company: zilliz\n' +
      '  photo: ./jiang.jpg\n' +
      '- name: Remote Person\n' +
      '  position: cto\n' +
      '  company: example\n' +
      '  photo: https://example.com/x.jpg\n' +
      '- name: No Photo\n' +
      '  position: vp\n' +
      '  company: example\n' +
      '```\n',
    );
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /<img src="jiang\.jpg" alt="">/);
    assert.match(html, /<img src="https:\/\/example\.com\/x\.jpg" alt="">/);
    assert.match(html, /<div class="avatar">NP<\/div>/);
    assert.ok(existsSync(join(root, 'dist', 'jiang.jpg')));
    assert.doesNotMatch(html, /```authors/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: integration — extracted title ignores the authors fence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'authors-title-'));
  try {
    writeFileSync(
      join(root, 'slides.md'),
      '{.title}\n' +
      '# Real Title\n' +
      '\n' +
      '```authors\n' +
      '- name: A\n' +
      '  position: p\n' +
      '  company: c\n' +
      '```\n',
    );
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /<title>Real Title<\/title>/);
    assert.match(html, /id="1-real-title"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseVega: parses a single chart with extra options', () => {
  const body = '- spec: ./scatter.json\n  renderer: svg\n  actions: false';
  assert.deepEqual(parseVega(body), [
    { spec: './scatter.json', renderer: 'svg', actions: 'false' },
  ]);
});

test('parseVega: parses multiple charts', () => {
  const body =
    '- spec: ./a.json\n' +
    '- spec: https://example.com/b.json\n' +
    '  id: my-chart';
  assert.deepEqual(parseVega(body), [
    { spec: './a.json' },
    { spec: 'https://example.com/b.json', id: 'my-chart' },
  ]);
});

test('parseVega: returns [] for empty body', () => {
  assert.deepEqual(parseVega(''), []);
});

test('parseVega: throws when spec is missing', () => {
  assert.throws(
    () => parseVega('- renderer: svg'),
    /missing required field "spec"/,
  );
});

test('extractVega: returns empty charts and original body when no fence', () => {
  const chunk = '# Hello\n\nbody';
  assert.deepEqual(extractVega(chunk), { charts: [], body: chunk });
});

test('extractVega: strips the vega fence and parses entries', () => {
  const chunk =
    '# Vega slide\n' +
    '\n' +
    '```vega\n' +
    '- spec: ./scatter.json\n' +
    '  renderer: svg\n' +
    '```\n';
  const r = extractVega(chunk);
  assert.deepEqual(r.charts, [{ spec: './scatter.json', renderer: 'svg' }]);
  assert.doesNotMatch(r.body, /```vega/);
  assert.match(r.body, /# Vega slide/);
});

test('extractVega: ignores ```vega when nested inside another fence', () => {
  const chunk =
    '# A\n\n' +
    '```\n' +
    '```vega\n' +
    '- spec: ./not-real.json\n' +
    '```\n' +
    '```\n';
  const r = extractVega(chunk);
  assert.deepEqual(r.charts, []);
  assert.equal(r.body, chunk);
});

test('renderVega: returns empty string for empty array', () => {
  assert.equal(renderVega([], 'slug'), '');
});

test('renderVega: emits a div with vega-chart class, default id, and data-spec', () => {
  const html = renderVega([{ spec: 'scatter.json' }], 'my-slide');
  assert.match(html, /<div class="vega-chart vega-embed"/);
  assert.match(html, /id="vis-my-slide"/);
  assert.match(html, /data-spec="scatter\.json"/);
});

test('renderVega: passes extra fields through as data-* attributes', () => {
  const html = renderVega([
    { spec: 's.json', renderer: 'svg', actions: 'false' },
  ], 'x');
  assert.match(html, /data-renderer="svg"/);
  assert.match(html, /data-actions="false"/);
});

test('renderVega: explicit id overrides the default', () => {
  const html = renderVega([{ spec: 's.json', id: 'custom' }], 'x');
  assert.match(html, /id="custom"/);
  assert.doesNotMatch(html, /id="vis-x"/);
});

test('renderVega: multiple charts get suffixed default ids', () => {
  const html = renderVega([
    { spec: 'a.json' },
    { spec: 'b.json' },
  ], 'slug');
  assert.match(html, /id="vis-slug-1"/);
  assert.match(html, /id="vis-slug-2"/);
});

test('renderVega: HTML-escapes attributes', () => {
  const html = renderVega([
    { spec: 'a"b.json', tooltip: '"<x>"' },
  ], 'x');
  assert.match(html, /data-spec="a&quot;b\.json"/);
  assert.match(html, /data-tooltip="&quot;&lt;x&gt;&quot;"/);
});

test('renderVega: signal-<name> entries become data-signal-<name> attributes', () => {
  const html = renderVega([
    { spec: 'tri.json', 'signal-stage': 1, 'signal-k': 8 },
  ], 'slug');
  assert.match(html, /data-signal-stage="1"/);
  assert.match(html, /data-signal-k="8"/);
});

test('embedVegaSpecs: inlines a local spec as a base64 data URI', () => {
  const root = mkdtempSync(join(tmpdir(), 'vega-embed-'));
  try {
    writeFileSync(join(root, 'scatter.json'), '{"mark":"circle"}');
    const out = embedVegaSpecs([{ spec: './scatter.json' }], root);
    const expected = Buffer.from('{"mark":"circle"}', 'utf8').toString('base64');
    assert.equal(out[0].spec, `data:application/json;base64,${expected}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('embedVegaSpecs: leaves http(s) URLs untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'vega-embed-url-'));
  try {
    const out = embedVegaSpecs([{ spec: 'https://example.com/spec.json' }], root);
    assert.equal(out[0].spec, 'https://example.com/spec.json');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('embedVegaSpecs: leaves already-embedded data: URIs untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'vega-embed-data-'));
  try {
    const existing = 'data:application/json;base64,e30=';
    const out = embedVegaSpecs([{ spec: existing }], root);
    assert.equal(out[0].spec, existing);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('embedVegaSpecs: throws when local spec file is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'vega-embed-missing-'));
  try {
    assert.throws(
      () => embedVegaSpecs([{ spec: './missing.json' }], root),
      /missing\.json/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('renderSlide: appends vega charts when charts are provided', () => {
  const html = renderSlide({
    chunk: '# Chart slide',
    index: 1,
    total: 1,
    charts: [{ spec: 'scatter.json' }],
  });
  assert.match(html, /<div class="vega-chart vega-embed"[^>]*data-spec="scatter\.json"/);
  assert.match(html, /id="vis-chart-slide"/);
});

test('renderSlide: omits vega chart block when charts is empty or missing', () => {
  const html = renderSlide({ chunk: '# Hello', index: 1, total: 1 });
  assert.doesNotMatch(html, /class="vega-chart/);
});

test('renderSlide: text before and after a vega block renders as separate paragraphs around the chart', () => {
  const { body } = extractVega(
    '# Slide\n\n' +
    'Para A.\n\n' +
    '```vega\n' +
    '- spec: ./s.json\n' +
    '```\n\n' +
    'Para B.\n'
  );
  const html = renderSlide({
    chunk: body,
    index: 1,
    total: 1,
    charts: [{ spec: './s.json' }],
  });
  const aIdx = html.indexOf('<p>Para A.</p>');
  const chartIdx = html.indexOf('class="vega-chart');
  const bIdx = html.indexOf('<p>Para B.</p>');
  assert.notEqual(aIdx, -1, 'Para A should be its own paragraph');
  assert.notEqual(bIdx, -1, 'Para B should be its own paragraph');
  assert.ok(aIdx < chartIdx, 'Para A should appear before the chart');
  assert.ok(chartIdx < bIdx, 'Para B should appear after the chart');
});

test('renderSlide: text before and after a dot block renders as separate paragraphs around the figure', () => {
  const { body } = extractDot(
    '# Slide\n\n' +
    'Para A.\n\n' +
    '```dot\n' +
    'A -> B\n' +
    '```\n\n' +
    'Para B.\n'
  );
  const html = renderSlide({
    chunk: body,
    index: 1,
    total: 1,
    dotFigures: ['<figure class="dot" id="diagram-slide">SVG</figure>'],
  });
  const aIdx = html.indexOf('<p>Para A.</p>');
  const figIdx = html.indexOf('class="dot"');
  const bIdx = html.indexOf('<p>Para B.</p>');
  assert.notEqual(aIdx, -1);
  assert.notEqual(bIdx, -1);
  assert.ok(aIdx < figIdx);
  assert.ok(figIdx < bIdx);
});

test('stripComments: removes single-line and multi-line HTML comments', () => {
  assert.equal(stripComments('a<!-- x -->b'), 'ab');
  assert.equal(stripComments('a<!--\nmulti\nline\n-->b'), 'ab');
  assert.equal(stripComments('a<!-- one --><!-- two -->b'), 'ab');
});

test('stripComments: leaves comment-free content untouched', () => {
  assert.equal(stripComments('<p>no comments here</p>'), '<p>no comments here</p>');
});

test('renderSlide: strips author HTML comments from the rendered slide', () => {
  const html = renderSlide({
    chunk: '# Slide\n\n<!-- VIS: scatter goes here -->\n\nReal content.',
    index: 1,
    total: 1,
  });
  assert.doesNotMatch(html, /<!--/);
  assert.match(html, /Real content\./);
});

test('renderSlide: a comment shown as literal code (escaped) is preserved', () => {
  const html = renderSlide({ chunk: '# Slide\n\n`<!-- example -->`', index: 1, total: 1 });
  assert.match(html, /<code>&lt;!-- example --&gt;<\/code>/);
});

test('renderSlide: stripping comments does not eat the dot placeholder', () => {
  const { body } = extractDot('# Slide\n\n```dot\nA -> B\n```\n');
  const html = renderSlide({
    chunk: body,
    index: 1,
    total: 1,
    dotFigures: ['<figure class="dot" id="diagram-slide">SVG</figure>'],
  });
  assert.match(html, /class="dot"/);
  assert.doesNotMatch(html, /dot-placeholder/);
});

test('buildDeck: integration — local vega spec is inlined as data URI and scripts injected', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vega-build-'));
  try {
    writeFileSync(join(root, 'scatter.json'), '{"mark":"circle"}');
    writeFileSync(
      join(root, 'slides.md'),
      '# Chart\n' +
      '\n' +
      '```vega\n' +
      '- spec: ./scatter.json\n' +
      '  renderer: svg\n' +
      '```\n',
    );
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    const expected = Buffer.from('{"mark":"circle"}', 'utf8').toString('base64');
    assert.match(html, new RegExp(`data-spec="data:application/json;base64,${expected}"`));
    assert.match(html, /data-renderer="svg"/);
    assert.match(html, /cdn\.jsdelivr\.net\/npm\/vega-embed/);
    assert.match(html, /script\/vega\.js/);
    assert.ok(!existsSync(join(root, 'dist', 'scatter.json')), 'spec should not be copied to dist');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: integration — vega scripts omitted when no charts present', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vega-empty-'));
  try {
    writeFileSync(join(root, 'slides.md'), '# Plain\n\nbody\n');
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    assert.doesNotMatch(html, /vega-embed/);
    assert.doesNotMatch(html, /script\/vega\.js/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('extractDot: returns no blocks and original body when no fence', () => {
  const chunk = '# Title\n\nSome prose.';
  assert.deepEqual(extractDot(chunk), { blocks: [], body: chunk });
});

test('extractDot: strips a single dot fence and returns its body', () => {
  const chunk =
    '# Arch\n\n' +
    '```dot\n' +
    'A -> B\n' +
    '```\n' +
    '\nFollowing prose.';
  const r = extractDot(chunk);
  assert.deepEqual(r.blocks, ['A -> B']);
  assert.doesNotMatch(r.body, /```dot/);
  assert.match(r.body, /Following prose\./);
});

test('extractDot: collects multiple dot fences from one slide', () => {
  const chunk =
    '# Two diagrams\n\n' +
    '```dot\n' +
    'A -> B\n' +
    '```\n' +
    '\nMiddle text.\n\n' +
    '```dot\n' +
    'X -> Y\n' +
    '```\n';
  const r = extractDot(chunk);
  assert.deepEqual(r.blocks, ['A -> B', 'X -> Y']);
  assert.doesNotMatch(r.body, /```dot/);
  assert.match(r.body, /Middle text\./);
});

test('extractDot: ignores ```dot when nested inside another fence', () => {
  const chunk =
    '````md\n' +
    '```dot\n' +
    'inner -> stuff\n' +
    '```\n' +
    '````\n';
  const r = extractDot(chunk);
  assert.deepEqual(r.blocks, []);
});

test('extractDot: throws when a dot block is empty', () => {
  assert.throws(
    () => extractDot('```dot\n```'),
    /empty dot block/,
  );
});

test('DOT_DEFAULTS: contains the brand-themed graph/node/edge attributes', () => {
  assert.match(DOT_DEFAULTS, /rankdir=LR/);
  assert.match(DOT_DEFAULTS, /fontname="Inter"/);
  assert.match(DOT_DEFAULTS, /#175fff/);
  assert.match(DOT_DEFAULTS, /#061982/);
  assert.match(DOT_DEFAULTS, /#e6f0ff/);
});

test('renderDot: returns empty array for empty input', async () => {
  const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
  const g = await Graphviz.load();
  assert.deepEqual(await renderDot([], 'slug', g), []);
});

test('renderDot: emits a figure.dot with default id and inline svg', async () => {
  const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
  const g = await Graphviz.load();
  const figs = await renderDot(['A -> B'], 'my-slide', g);
  assert.equal(figs.length, 1);
  assert.match(figs[0], /<figure class="dot" id="diagram-my-slide">/);
  assert.match(figs[0], /<svg /);
  assert.match(figs[0], /viewBox="/);
  assert.match(figs[0], /<\/svg>\s*<\/figure>/);
});

test('renderDot: preserves intrinsic width and height so CSS max-* can scale the svg', async () => {
  const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
  const g = await Graphviz.load();
  const figs = await renderDot(['A -> B'], 'slug', g);
  const svgOpen = figs[0].match(/<svg[\s\S]*?>/)[0];
  assert.match(svgOpen, /\swidth="[^"]+"/);
  assert.match(svgOpen, /\sheight="[^"]+"/);
});

test('renderDot: strips XML declaration / DOCTYPE preamble (inline svg in HTML body)', async () => {
  const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
  const g = await Graphviz.load();
  const figs = await renderDot(['A -> B'], 'slug', g);
  assert.doesNotMatch(figs[0], /<\?xml/);
  assert.doesNotMatch(figs[0], /<!DOCTYPE/i);
});

test('renderDot: multiple diagrams get suffixed default ids', async () => {
  const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
  const g = await Graphviz.load();
  const figs = await renderDot(['A -> B', 'X -> Y'], 'slug', g);
  assert.equal(figs.length, 2);
  assert.match(figs[0], /id="diagram-slug-1"/);
  assert.match(figs[1], /id="diagram-slug-2"/);
});

test('renderDot: injects DOT_DEFAULTS into the rendered svg (Inter font appears)', async () => {
  const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
  const g = await Graphviz.load();
  const figs = await renderDot(['A -> B'], 'slug', g);
  assert.match(figs[0], /Inter/);
});

test('buildDeck: integration — dot diagram is rendered as inline svg', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dot-build-'));
  try {
    const talkDir = join(root, 'talk');
    mkdirSync(talkDir, { recursive: true });
    writeFileSync(join(talkDir, 'slides.md'),
      '# Architecture\n\n' +
      '```dot\n' +
      'A -> B\n' +
      '```\n'
    );
    const out = await buildDeck(talkDir);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /<figure class="dot" id="diagram-architecture">/);
    assert.match(html, /<svg /);
    assert.match(html, /viewBox="/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: integration — Graphviz is not loaded when no dot blocks present', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dot-empty-'));
  try {
    const talkDir = join(root, 'talk');
    mkdirSync(talkDir, { recursive: true });
    writeFileSync(join(talkDir, 'slides.md'), '# Plain\n\nJust prose.');
    const out = await buildDeck(talkDir);
    const html = readFileSync(out, 'utf8');
    assert.doesNotMatch(html, /class="dot"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('extractDeckConfig: returns empty config and unchanged remaining when no block', () => {
  const md = '# Title\n\nbody';
  assert.deepEqual(extractDeckConfig(md), { config: {}, remaining: md });
});

test('extractDeckConfig: extracts top-of-file deck block and strips it from remaining', () => {
  const md = '```deck\n- agenda: false\n```\n\n# Title\n\nbody';
  const r = extractDeckConfig(md);
  assert.deepEqual(r.config, { agenda: 'false' });
  assert.equal(r.remaining, '# Title\n\nbody');
});

test('extractDeckConfig: tolerates leading blank lines before the block', () => {
  const md = '\n\n```deck\n- agenda: false\n```\n\n# Title';
  const r = extractDeckConfig(md);
  assert.deepEqual(r.config, { agenda: 'false' });
  assert.equal(r.remaining, '# Title');
});

test('extractDeckConfig: ignores deck block when slide content precedes it', () => {
  const md = '# Title\n\n```deck\n- agenda: false\n```\n\nmore';
  const r = extractDeckConfig(md);
  assert.deepEqual(r.config, {});
  assert.equal(r.remaining, md);
});

test('extractDeckConfig: collects multiple keys into a flat object', () => {
  const md = '```deck\n- agenda: false\n- notes: foo\n```\n\n# Title';
  const r = extractDeckConfig(md);
  assert.deepEqual(r.config, { agenda: 'false', notes: 'foo' });
});

test('extractDeckConfig: tolerates ~~~ fence delimiter', () => {
  const md = '~~~deck\n- agenda: false\n~~~\n\n# Title';
  const r = extractDeckConfig(md);
  assert.deepEqual(r.config, { agenda: 'false' });
  assert.equal(r.remaining, '# Title');
});

test('extractDeckConfig: empty body yields empty config but still strips the block', () => {
  const md = '```deck\n```\n\n# Title';
  const r = extractDeckConfig(md);
  assert.deepEqual(r.config, {});
  assert.equal(r.remaining, '# Title');
});

test('renderAgendaChunk: emits attribute block, heading, and numbered link list', () => {
  const sections = [
    { title: 'Indexes', slug: 'indexes', slideIndex: 7 },
    { title: 'Hybrid search', slug: 'hybrid-search', slideIndex: 19 },
  ];
  const md = renderAgendaChunk(sections);
  assert.match(md, /^\{\.agenda\}\n# Agenda\n\n/);
  assert.match(md, /^1\. \[Indexes\]\(#7-indexes\)$/m);
  assert.match(md, /^2\. \[Hybrid search\]\(#19-hybrid-search\)$/m);
});

test('renderAgendaChunk: returns just the heading when sections is empty', () => {
  const md = renderAgendaChunk([]);
  assert.match(md, /^\{\.agenda\}\n# Agenda$/);
});

test('buildDeck: integration — agenda slide is injected before the first .section', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agenda-build-'));
  try {
    writeFileSync(
      join(root, 'slides.md'),
      '# Title\n' +
      '\n---\n\n' +
      '{.section}\n# Indexes\n' +
      '\n---\n\n' +
      '# Detail\n' +
      '\n---\n\n' +
      '{.section}\n# Hybrid search\n' +
      '\n---\n\n' +
      '# More\n',
    );
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    // 5 authored slides + 1 agenda = 6 sections
    const sectionCount = (html.match(/<section[^>]*class="slide/g) || []).length;
    assert.equal(sectionCount, 6);
    // Agenda slide present with correct class
    assert.match(html, /<section[^>]*class="slide agenda"[^>]*>[\s\S]*?<h1[^>]*>Agenda<\/h1>/);
    // Links point to post-splice slide indices: original 1-based 2 -> 3, 4 -> 5
    assert.match(html, /<a href="#3-indexes">Indexes<\/a>/);
    assert.match(html, /<a href="#5-hybrid-search">Hybrid search<\/a>/);
    // Page numbers reflect 6 total
    assert.match(html, /1 \/ 6/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: integration — agenda is omitted when deck config has agenda: false', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agenda-optout-'));
  try {
    writeFileSync(
      join(root, 'slides.md'),
      '```deck\n- agenda: false\n```\n\n' +
      '# Title\n' +
      '\n---\n\n' +
      '{.section}\n# Indexes\n' +
      '\n---\n\n' +
      '# Detail\n',
    );
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    const sectionCount = (html.match(/<section[^>]*class="slide/g) || []).length;
    assert.equal(sectionCount, 3);
    assert.doesNotMatch(html, /class="slide agenda"/);
    assert.doesNotMatch(html, /<h1[^>]*>Agenda<\/h1>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: integration — no agenda when deck has zero .section slides', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agenda-no-sections-'));
  try {
    writeFileSync(
      join(root, 'slides.md'),
      '# Title\n\n---\n\n# Just content\n',
    );
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    const sectionCount = (html.match(/<section[^>]*class="slide/g) || []).length;
    assert.equal(sectionCount, 2);
    assert.doesNotMatch(html, /class="slide agenda"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseThree: parses a single entry with extra options', () => {
  const body = '- module: ./viz.js\n  preset: clusters\n  count: 600';
  assert.deepEqual(parseThree(body), [
    { module: './viz.js', preset: 'clusters', count: '600' },
  ]);
});

test('parseThree: parses multiple entries', () => {
  const body =
    '- module: ./a.js\n' +
    '- module: ./b.js\n' +
    '  id: my-canvas';
  assert.deepEqual(parseThree(body), [
    { module: './a.js' },
    { module: './b.js', id: 'my-canvas' },
  ]);
});

test('parseThree: returns [] for empty body', () => {
  assert.deepEqual(parseThree(''), []);
});

test('parseThree: throws when module is missing', () => {
  assert.throws(
    () => parseThree('- preset: clusters'),
    /missing required field "module"/,
  );
});

test('extractThree: returns empty entries and original body when no fence', () => {
  const chunk = '# Hello\n\nbody';
  assert.deepEqual(extractThree(chunk), { entries: [], body: chunk });
});

test('extractThree: strips the three fence and parses entries', () => {
  const chunk =
    '# Three slide\n' +
    '\n' +
    '```three\n' +
    '- module: ./viz.js\n' +
    '```\n';
  const r = extractThree(chunk);
  assert.deepEqual(r.entries, [{ module: './viz.js' }]);
  assert.doesNotMatch(r.body, /```three/);
  assert.match(r.body, /# Three slide/);
});

test('extractThree: ignores ```three when nested inside another fence', () => {
  const chunk =
    '# A\n\n' +
    '```\n' +
    '```three\n' +
    '- module: ./not-real.js\n' +
    '```\n' +
    '```\n';
  const r = extractThree(chunk);
  assert.deepEqual(r.entries, []);
  assert.equal(r.body, chunk);
});

test('extractThree: leaves a placeholder so surrounding text renders around the canvas', () => {
  const chunk =
    '# Slide\n\n' +
    'Before.\n\n' +
    '```three\n' +
    '- module: ./v.js\n' +
    '```\n\n' +
    'After.\n';
  const r = extractThree(chunk);
  assert.match(r.body, /Before\./);
  assert.match(r.body, /After\./);
  assert.match(r.body, /<!--three-placeholder-->/);
});

test('embedThreeModules: inlines a local module as a base64 data URL', () => {
  const root = mkdtempSync(join(tmpdir(), 'three-embed-'));
  try {
    writeFileSync(join(root, 'viz.js'), 'export default () => ({})');
    const out = embedThreeModules([{ module: './viz.js' }], root);
    const expected = Buffer.from('export default () => ({})', 'utf8').toString('base64');
    assert.equal(out[0].module, `data:text/javascript;base64,${expected}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('embedThreeModules: leaves http(s) URLs untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'three-embed-url-'));
  try {
    const out = embedThreeModules(
      [{ module: 'https://example.com/viz.js' }],
      root,
    );
    assert.equal(out[0].module, 'https://example.com/viz.js');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('embedThreeModules: leaves already-embedded data: URLs untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'three-embed-data-'));
  try {
    const existing = 'data:text/javascript;base64,e30=';
    const out = embedThreeModules([{ module: existing }], root);
    assert.equal(out[0].module, existing);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('embedThreeModules: throws when local module file is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'three-embed-missing-'));
  try {
    assert.throws(
      () => embedThreeModules([{ module: './nope.js' }], root),
      /nope\.js/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('renderThree: returns empty string for empty array', () => {
  assert.equal(renderThree([], 'slug'), '');
});

test('renderThree: emits a canvas with three-canvas class, default id, and data-module', () => {
  const html = renderThree([{ module: 'data:text/javascript;base64,xxx' }], 'my-slide');
  assert.match(html, /<canvas class="three-canvas"/);
  assert.match(html, /id="three-my-slide"/);
  assert.match(html, /data-module="data:text\/javascript;base64,xxx"/);
});

test('renderThree: passes extra fields through as data-* attributes', () => {
  const html = renderThree([
    { module: 'a.js', preset: 'clusters', count: '600' },
  ], 'x');
  assert.match(html, /data-preset="clusters"/);
  assert.match(html, /data-count="600"/);
});

test('renderThree: explicit id overrides the default', () => {
  const html = renderThree([{ module: 'a.js', id: 'custom' }], 'x');
  assert.match(html, /id="custom"/);
  assert.doesNotMatch(html, /id="three-x"/);
});

test('renderThree: multiple canvases get suffixed default ids', () => {
  const html = renderThree([
    { module: 'a.js' },
    { module: 'b.js' },
  ], 'slug');
  assert.match(html, /id="three-slug-1"/);
  assert.match(html, /id="three-slug-2"/);
});

test('renderThree: HTML-escapes attributes', () => {
  const html = renderThree([
    { module: 'a"b.js', label: '"<x>"' },
  ], 'x');
  assert.match(html, /data-module="a&quot;b\.js"/);
  assert.match(html, /data-label="&quot;&lt;x&gt;&quot;"/);
});

test('renderSlide: appends three canvas when entries are provided', () => {
  const html = renderSlide({
    chunk: '# Three slide',
    index: 1,
    total: 1,
    threeEntries: [{ module: 'data:text/javascript;base64,xxx' }],
  });
  assert.match(html, /<canvas class="three-canvas"[^>]*data-module="data:text\/javascript;base64,xxx"/);
  assert.match(html, /id="three-three-slide"/);
});

test('renderSlide: omits canvas when threeEntries is empty or missing', () => {
  const html = renderSlide({ chunk: '# Hello', index: 1, total: 1 });
  assert.doesNotMatch(html, /class="three-canvas"/);
});

test('renderSlide: text before and after a three block renders around the canvas', () => {
  const { body } = extractThree(
    '# Slide\n\n' +
    'Para A.\n\n' +
    '```three\n' +
    '- module: ./v.js\n' +
    '```\n\n' +
    'Para B.\n'
  );
  const html = renderSlide({
    chunk: body,
    index: 1,
    total: 1,
    threeEntries: [{ module: './v.js' }],
  });
  const aIdx = html.indexOf('<p>Para A.</p>');
  const cIdx = html.indexOf('class="three-canvas');
  const bIdx = html.indexOf('<p>Para B.</p>');
  assert.notEqual(aIdx, -1);
  assert.notEqual(bIdx, -1);
  assert.ok(aIdx < cIdx);
  assert.ok(cIdx < bIdx);
});

test('buildDeck: integration — unknown deck config keys do not throw', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agenda-unknown-'));
  try {
    writeFileSync(
      join(root, 'slides.md'),
      '```deck\n- notes: enabled\n```\n\n' +
      '# Title\n\n---\n\n' +
      '{.section}\n# Indexes\n',
    );
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    // Unknown key is forward-compat; agenda still injects (default on).
    assert.match(html, /class="slide agenda"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: injects three importmap and inlines runtime when a slide uses three', async () => {
  const root = mkdtempSync(join(tmpdir(), 'three-build-'));
  try {
    writeFileSync(join(root, 'viz.js'), 'export default () => ({})');
    const md =
      '# Title\n\n' +
      '---\n\n' +
      '{.no-chrome}\n# Viz\n\n' +
      '```three\n' +
      '- module: ./viz.js\n' +
      '```\n';
    writeFileSync(join(root, 'slides.md'), md);
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /<script type="importmap">/);
    assert.match(html, /"three":\s*"https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.module\.min\.js"/);
    assert.match(html, /<script type="module">[\s\S]*three-canvas[\s\S]*<\/script>/);
    assert.match(html, /<canvas class="three-canvas"/);
    assert.match(html, /data-module="data:text\/javascript;base64,/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: omits three importmap and runtime when no slide uses three', async () => {
  const root = mkdtempSync(join(tmpdir(), 'three-build-empty-'));
  try {
    writeFileSync(join(root, 'slides.md'), '# Hello\n');
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    assert.doesNotMatch(html, /importmap/);
    assert.doesNotMatch(html, /three-canvas/);
    assert.doesNotMatch(html, /three\.module\.min\.js/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseIframe: parses a single entry with extra options', () => {
  const body = '- url: https://example.com\n  allow: clipboard-read';
  assert.deepEqual(parseIframe(body), [
    { url: 'https://example.com', allow: 'clipboard-read' },
  ]);
});

test('parseIframe: parses multiple entries', () => {
  const body =
    '- url: https://a.example\n' +
    '- url: https://b.example\n' +
    '  id: my-frame';
  assert.deepEqual(parseIframe(body), [
    { url: 'https://a.example' },
    { url: 'https://b.example', id: 'my-frame' },
  ]);
});

test('parseIframe: returns [] for empty body', () => {
  assert.deepEqual(parseIframe(''), []);
});

test('parseIframe: throws when url is missing', () => {
  assert.throws(
    () => parseIframe('- id: nope'),
    /missing required field "url"/,
  );
});

test('extractIframe: returns empty entries and original body when no fence', () => {
  const chunk = '# Hello\n\nbody';
  assert.deepEqual(extractIframe(chunk), { entries: [], body: chunk });
});

test('extractIframe: strips the iframe fence and parses entries', () => {
  const chunk =
    '# Embed slide\n' +
    '\n' +
    '```iframe\n' +
    '- url: https://example.com\n' +
    '```\n';
  const r = extractIframe(chunk);
  assert.deepEqual(r.entries, [{ url: 'https://example.com' }]);
  assert.doesNotMatch(r.body, /```iframe/);
  assert.match(r.body, /# Embed slide/);
});

test('extractIframe: leaves a placeholder so surrounding text renders around the frame', () => {
  const chunk =
    '# Slide\n\n' +
    'Before.\n\n' +
    '```iframe\n' +
    '- url: https://example.com\n' +
    '```\n\n' +
    'After.\n';
  const r = extractIframe(chunk);
  assert.match(r.body, /Before\./);
  assert.match(r.body, /After\./);
  assert.match(r.body, /<!--iframe-placeholder-->/);
});

test('renderIframe: returns empty string for empty array', () => {
  assert.equal(renderIframe([], 'slug'), '');
});

test('renderIframe: emits an iframe with iframe-embed class, default id, and src', () => {
  const html = renderIframe([{ url: 'https://example.com' }], 'my-slide');
  assert.match(html, /<iframe class="iframe-embed"/);
  assert.match(html, /id="iframe-my-slide"/);
  assert.match(html, /src="https:\/\/example\.com"/);
});

test('renderIframe: passes extra fields through as data-* attributes', () => {
  const html = renderIframe([
    { url: 'https://example.com', label: 'demo' },
  ], 'x');
  assert.match(html, /data-label="demo"/);
});

test('renderIframe: explicit id overrides the default', () => {
  const html = renderIframe([{ url: 'https://example.com', id: 'custom' }], 'x');
  assert.match(html, /id="custom"/);
  assert.doesNotMatch(html, /id="iframe-x"/);
});

test('renderIframe: multiple frames get suffixed default ids', () => {
  const html = renderIframe([
    { url: 'https://a.example' },
    { url: 'https://b.example' },
  ], 'slug');
  assert.match(html, /id="iframe-slug-1"/);
  assert.match(html, /id="iframe-slug-2"/);
});

test('renderIframe: HTML-escapes attributes', () => {
  const html = renderIframe([
    { url: 'https://x.example/?q="<x>"' },
  ], 'x');
  assert.match(html, /src="https:\/\/x\.example\/\?q=&quot;&lt;x&gt;&quot;"/);
});

test('renderSlide: appends iframe when entries are provided', () => {
  const html = renderSlide({
    chunk: '# Frame slide',
    index: 1,
    total: 1,
    iframeEntries: [{ url: 'https://example.com' }],
  });
  assert.match(html, /<iframe class="iframe-embed"[^>]*src="https:\/\/example\.com"/);
  assert.match(html, /id="iframe-frame-slide"/);
});

test('renderSlide: omits iframe when iframeEntries is empty or missing', () => {
  const html = renderSlide({ chunk: '# Hello', index: 1, total: 1 });
  assert.doesNotMatch(html, /class="iframe-embed"/);
});

test('buildDeck: inlines iframe runtime when a slide uses iframe', async () => {
  const root = mkdtempSync(join(tmpdir(), 'iframe-build-'));
  try {
    const md =
      '# Title\n\n' +
      '---\n\n' +
      '# Embed\n\n' +
      '```iframe\n' +
      '- url: https://example.com\n' +
      '```\n';
    writeFileSync(join(root, 'slides.md'), md);
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /<iframe class="iframe-embed"[^>]*src="https:\/\/example\.com"/);
    assert.match(html, /<script>[\s\S]*iframe-embed[\s\S]*<\/script>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: omits iframe runtime when no slide uses iframe', async () => {
  const root = mkdtempSync(join(tmpdir(), 'iframe-build-empty-'));
  try {
    writeFileSync(join(root, 'slides.md'), '# Hello\n');
    const out = await buildDeck(root);
    const html = readFileSync(out, 'utf8');
    assert.doesNotMatch(html, /iframe-embed/);
    assert.doesNotMatch(html, /class="iframe-embed"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseAttrList: returns class tokens with leading dots stripped', () => {
  assert.deepEqual(parseAttrList('.fragment'), ['fragment']);
});

test('parseAttrList: parses multiple classes separated by whitespace', () => {
  assert.deepEqual(parseAttrList('.fragment .highlight'), ['fragment', 'highlight']);
});

test('parseAttrList: tolerates extra whitespace', () => {
  assert.deepEqual(parseAttrList('  .fragment   .highlight  '), ['fragment', 'highlight']);
});

test('parseAttrList: returns null when any token lacks a leading dot', () => {
  assert.equal(parseAttrList('fragment'), null);
  assert.equal(parseAttrList('.fragment highlight'), null);
});

test('parseAttrList: returns null when any token is not [\\w-]+', () => {
  assert.equal(parseAttrList('.123'), null);
  assert.equal(parseAttrList('.frag ment'), null);
  assert.equal(parseAttrList('.frag.ment'), null);
});

test('parseAttrList: returns null on empty input', () => {
  assert.equal(parseAttrList(''), null);
  assert.equal(parseAttrList('   '), null);
});

test('applyFragmentAttrs: inline [text]{.fragment} becomes a span', () => {
  const input = '<p>A paragraph with [a revealed phrase]{.fragment} mid-sentence.</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(
    output,
    '<p>A paragraph with <span class="fragment">a revealed phrase</span> mid-sentence.</p>'
  );
});

test('applyFragmentAttrs: inline multi-class', () => {
  const input = '<p>[x]{.fragment .highlight}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<p><span class="fragment highlight">x</span></p>');
});

test('applyFragmentAttrs: inline pass leaves malformed markers untouched', () => {
  const input = '<p>[x]{fragment} [y]{.123} [z]{.frag ment}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, input);
});

test('applyFragmentAttrs: inline pass leaves bracketed text without marker alone', () => {
  const input = '<p>see [reference] for more</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, input);
});

test('applyFragmentAttrs: block trailing {.fragment} on <li>', () => {
  const input = '<ul>\n<li>First</li>\n<li>Second {.fragment}</li>\n<li>Third {.fragment}</li>\n</ul>';
  const output = applyFragmentAttrs(input);
  assert.equal(
    output,
    '<ul>\n<li>First</li>\n<li class="fragment">Second</li>\n<li class="fragment">Third</li>\n</ul>'
  );
});

test('applyFragmentAttrs: block trailing {.fragment} on <p>', () => {
  const input = '<p>A late paragraph {.fragment}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<p class="fragment">A late paragraph</p>');
});

test('applyFragmentAttrs: block trailing {.fragment} on <h2>', () => {
  const input = '<h2>A late heading {.fragment}</h2>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<h2 class="fragment">A late heading</h2>');
});

test('applyFragmentAttrs: block trailing {.fragment} on <blockquote>', () => {
  const input = '<blockquote>\n<p>Late quote</p>\n {.fragment}</blockquote>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<blockquote class="fragment">\n<p>Late quote</p>\n</blockquote>');
});

test('applyFragmentAttrs: block multi-class merges into existing class attribute', () => {
  const input = '<p class="lead">Intro {.fragment .highlight}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<p class="lead fragment highlight">Intro</p>');
});

test('applyFragmentAttrs: block pass attaches class to innermost matching block', () => {
  // a <li> containing a <p> with {.fragment} — class goes on the <p>, not <li>
  const input = '<ul>\n<li>\n<p>Nested {.fragment}</p>\n</li>\n</ul>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, '<ul>\n<li>\n<p class="fragment">Nested</p>\n</li>\n</ul>');
});

test('applyFragmentAttrs: block pass leaves malformed markers untouched', () => {
  const input = '<p>fine {fragment}</p><p>also fine {.123}</p>';
  const output = applyFragmentAttrs(input);
  assert.equal(output, input);
});

test('renderSlide: fragments applied to list items', () => {
  const chunk = '# Bullets\n\n- First\n- Second {.fragment}\n- Third {.fragment}';
  const html = renderSlide({ chunk, index: 1, total: 1 });
  assert.match(html, /<li>First<\/li>/);
  assert.match(html, /<li class="fragment">Second<\/li>/);
  assert.match(html, /<li class="fragment">Third<\/li>/);
});

test('renderSlide: inline fragment span inside paragraph', () => {
  const chunk = '# x\n\nA paragraph with [a phrase]{.fragment} mid-sentence.';
  const html = renderSlide({ chunk, index: 1, total: 1 });
  assert.match(html, /<span class="fragment">a phrase<\/span>/);
});

test('embedThreeModules: inlines a module referenced by a parent-relative path', () => {
  const root = mkdtempSync(join(tmpdir(), 'three-embed-rel-'));
  try {
    mkdirSync(join(root, 'visualisations'));
    mkdirSync(join(root, 'talks', 'demo'), { recursive: true });
    writeFileSync(join(root, 'visualisations', 'shared.js'), 'export default () => ({})');
    const talkDir = join(root, 'talks', 'demo');
    const out = embedThreeModules([{ module: '../../visualisations/shared.js' }], talkDir);
    const expected = Buffer.from('export default () => ({})', 'utf8').toString('base64');
    assert.equal(out[0].module, `data:text/javascript;base64,${expected}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseAttrs: parses key=value pairs into attrs', () => {
  const r = parseAttrs('{.auto-reveal delay=800 start=immediate}\n# X');
  assert.deepEqual(r.classes, ['auto-reveal']);
  assert.deepEqual(r.attrs, { delay: '800', start: 'immediate' });
  assert.equal(r.body.trim(), '# X');
});

test('parseAttrs: classes-only block yields empty attrs', () => {
  const r = parseAttrs('{.hero .center}\n# X');
  assert.deepEqual(r.classes, ['hero', 'center']);
  assert.deepEqual(r.attrs, {});
});

test('parseAttrs: no attribute line yields empty attrs', () => {
  const r = parseAttrs('# Plain content');
  assert.deepEqual(r.attrs, {});
});

test('parseAttrs: ignores a brace line that is not valid attrs', () => {
  const r = parseAttrs('{not an attr}\n# X');
  assert.deepEqual(r.classes, []);
  assert.deepEqual(r.attrs, {});
});

test('renderSlide: emits autoreveal data attributes', () => {
  const html = renderSlide({ chunk: '{.auto-reveal delay=800 start=immediate}\n# X', index: 1, total: 2 });
  assert.match(html, /class="slide auto-reveal"/);
  assert.match(html, /data-autoreveal-delay="800"/);
  assert.match(html, /data-autoreveal-start="immediate"/);
});

test('renderSlide: autoreveal defaults to 1000ms and cue start', () => {
  const html = renderSlide({ chunk: '{.auto-reveal}\n# X', index: 1, total: 2 });
  assert.match(html, /data-autoreveal-delay="1000"/);
  assert.match(html, /data-autoreveal-start="cue"/);
});

test('renderSlide: autoreveal clamps non-positive delay to default', () => {
  const html = renderSlide({ chunk: '{.auto-reveal delay=0}\n# X', index: 1, total: 2 });
  assert.match(html, /data-autoreveal-delay="1000"/);
});

test('renderSlide: autoreveal rejects an unknown start value', () => {
  const html = renderSlide({ chunk: '{.auto-reveal start=whenever}\n# X', index: 1, total: 2 });
  assert.match(html, /data-autoreveal-start="cue"/);
});

test('renderSlide: non-autoreveal slide emits no autoreveal attributes', () => {
  const html = renderSlide({ chunk: '{.hero}\n# X', index: 1, total: 2 });
  assert.doesNotMatch(html, /data-autoreveal/);
});

test('parseAttrs: tolerates whitespace inside the braces', () => {
  const r = parseAttrs('{ delay=900 .auto-reveal  .dark }\n# X');
  assert.deepEqual(r.classes, ['auto-reveal', 'dark']);
  assert.deepEqual(r.attrs, { delay: '900' });
  assert.equal(r.body.trim(), '# X');
});

test('escapeHtml: escapes &, <, >, and quotes', () => {
  assert.equal(escapeHtml('a & b <c> "d"'), 'a &amp; b &lt;c&gt; &quot;d&quot;');
});
