# Three.js Frontmatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional ` ```three ` fenced frontmatter block that embeds three.js 3D visualizations on slides, with optional keyboard-nav stage hooks. Ship a working `talks/threejs-example/` deck.

**Architecture:** Mirror the existing `vega` pattern. Build-time: parse the kv-list, base64-inline the JS module, emit a `<canvas data-module="data:...">`. Runtime: a new `script/three.js` that is **inlined** into the deck HTML as `<script type="module">` (so `file://` works without a server). The runtime dynamic-imports each canvas module, calls `init({ canvas, opts })`, and intercepts ArrowRight/n/Space and ArrowLeft/p in capture phase to call `advance()`/`retreat()` on the active slide's instance. If the module signals it consumed the keypress, deck navigation is suppressed; otherwise the event reaches `script/deck.js`.

**Tech Stack:** Node ESM, `marked`, `node:test`, three.js r128 via CDN importmap. No runtime dependencies added to `package.json`.

**Branch:** All work on a feature branch `feat/threejs-frontmatter`. Merge to main at the end.

**Spec:** `docs/superpowers/specs/2026-05-08-threejs-frontmatter-design.md`.

---

## File Structure

**New files:**
- `script/three.js` — runtime; capture-phase keydown handler; per-slide canvas init.
- `talks/threejs-example/slides.md` — title slide + viz slide.
- `talks/threejs-example/embedding-lift.js` — viz module port of `specs/threejs_example.html`.

**Modified files:**
- `bin/build.js` — add `parseThree`, `extractThree`, `embedThreeModules`, `renderThree`, `THREE_PLACEHOLDER`; wire into `buildDeck` and `renderSlide`; inject importmap and inline runtime when `hasThree`.
- `templates/deck.html` — add `{{threeImportmap}}` (in `<head>`) and `{{threeScripts}}` (after `{{vegaScripts}}`).
- `css/layouts.css` — add `.three-canvas` rule.
- `test/build.test.js` — append unit + integration tests for the new functions.
- `README.md` — add a `three` frontmatter section near `vega` and `dot`.
- `CLAUDE.md` — add a `three` paragraph alongside `vega` / `dot`.

---

## Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Confirm clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Create and check out feature branch**

Run: `git checkout -b feat/threejs-frontmatter`
Expected: `Switched to a new branch 'feat/threejs-frontmatter'`

- [ ] **Step 3: Verify tests pass on current main**

Run: `npm test`
Expected: all tests pass (130 tests).

---

## Task 1: `parseThree`

**Files:**
- Modify: `bin/build.js` (add `parseThree` near `parseVega`)
- Test: `test/build.test.js` (append to bottom)

- [ ] **Step 1: Write failing tests**

Append to `test/build.test.js`:

```js
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
```

Update the import line at the top of `test/build.test.js` to add `parseThree`:

```js
import { splitSlides, parseAttrs, slugify, extractTitle, renderSlide, parseAuthors, extractAuthors, renderAuthors, copyAuthorPhotos, parseVega, extractVega, renderVega, embedVegaSpecs, extractDot, DOT_DEFAULTS, renderDot, buildDeck, extractDeckConfig, renderAgendaChunk, parseThree } from '../bin/build.js';
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: 4 new failures (`parseThree is not a function` or similar).

- [ ] **Step 3: Implement `parseThree`**

In `bin/build.js`, add after `parseVega` (around line 207):

```js
export function parseThree(body) {
  const entries = parseKvList(body, 'parseThree');
  for (const e of entries) {
    if (!e.module) throw new Error('parseThree: missing required field "module"');
  }
  return entries;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): add parseThree for three frontmatter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `extractThree` and `THREE_PLACEHOLDER`

**Files:**
- Modify: `bin/build.js`
- Test: `test/build.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/build.test.js`:

```js
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
```

Update the import line to add `extractThree` and `THREE_PLACEHOLDER`:

```js
import { splitSlides, parseAttrs, slugify, extractTitle, renderSlide, parseAuthors, extractAuthors, renderAuthors, copyAuthorPhotos, parseVega, extractVega, renderVega, embedVegaSpecs, extractDot, DOT_DEFAULTS, renderDot, buildDeck, extractDeckConfig, renderAgendaChunk, parseThree, extractThree, THREE_PLACEHOLDER } from '../bin/build.js';
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: 4 new failures.

- [ ] **Step 3: Implement `extractThree` and `THREE_PLACEHOLDER`**

In `bin/build.js`, add `THREE_PLACEHOLDER` next to the existing `VEGA_PLACEHOLDER` (around line 182):

```js
export const VEGA_PLACEHOLDER = '<!--vega-placeholder-->';
export const THREE_PLACEHOLDER = '<!--three-placeholder-->';
export const dotPlaceholder = i => `<!--dot-placeholder-${i}-->`;
```

Add `extractThree` after `parseThree`:

```js
export function extractThree(chunk) {
  const found = extractFencedBlock(chunk, 'three', THREE_PLACEHOLDER);
  if (!found) return { entries: [], body: chunk };
  return { entries: parseThree(found.body), body: found.remaining };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): add extractThree and THREE_PLACEHOLDER

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `embedThreeModules`

**Files:**
- Modify: `bin/build.js`
- Test: `test/build.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/build.test.js`:

```js
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
```

Update the import line:

```js
import { splitSlides, parseAttrs, slugify, extractTitle, renderSlide, parseAuthors, extractAuthors, renderAuthors, copyAuthorPhotos, parseVega, extractVega, renderVega, embedVegaSpecs, extractDot, DOT_DEFAULTS, renderDot, buildDeck, extractDeckConfig, renderAgendaChunk, parseThree, extractThree, THREE_PLACEHOLDER, embedThreeModules } from '../bin/build.js';
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: 4 new failures.

- [ ] **Step 3: Implement `embedThreeModules`**

In `bin/build.js`, add after `embedVegaSpecs`:

```js
export function embedThreeModules(entries, talkDir) {
  for (const e of entries) {
    if (!e.module) continue;
    if (/^https?:\/\//i.test(e.module)) continue;
    if (e.module.startsWith('data:')) continue;
    const src = resolve(talkDir, e.module);
    let js;
    try {
      js = readFileSync(src, 'utf8');
    } catch (err) {
      throw new Error(`embedThreeModules: failed to read module ${e.module}: ${err.message}`);
    }
    const b64 = Buffer.from(js, 'utf8').toString('base64');
    e.module = `data:text/javascript;base64,${b64}`;
  }
  return entries;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): inline three modules as base64 data URLs

Same precedent as embedVegaSpecs: file:// CORS blocks fetch of relative
URLs, so we inline at build time.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `renderThree`

**Files:**
- Modify: `bin/build.js`
- Test: `test/build.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/build.test.js`:

```js
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
```

Update the import line:

```js
import { splitSlides, parseAttrs, slugify, extractTitle, renderSlide, parseAuthors, extractAuthors, renderAuthors, copyAuthorPhotos, parseVega, extractVega, renderVega, embedVegaSpecs, extractDot, DOT_DEFAULTS, renderDot, buildDeck, extractDeckConfig, renderAgendaChunk, parseThree, extractThree, THREE_PLACEHOLDER, embedThreeModules, renderThree } from '../bin/build.js';
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: 6 new failures.

- [ ] **Step 3: Implement `renderThree`**

In `bin/build.js`, add after `renderVega`:

```js
export function renderThree(entries, slug) {
  if (!entries || entries.length === 0) return '';
  return entries.map((e, i) => {
    const id = e.id || (entries.length === 1 ? `three-${slug}` : `three-${slug}-${i + 1}`);
    const dataAttrs = Object.entries(e)
      .filter(([k]) => k !== 'id' && k !== 'module')
      .map(([k, v]) => ` data-${escapeHtml(k)}="${escapeHtml(v)}"`)
      .join('');
    return `<canvas class="three-canvas" id="${escapeHtml(id)}" data-module="${escapeHtml(e.module)}"${dataAttrs}></canvas>`;
  }).join('\n');
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): render three entries as <canvas> placeholders

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `renderThree` into `renderSlide`

**Files:**
- Modify: `bin/build.js` (`renderSlide` function around line 355)
- Test: `test/build.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/build.test.js`:

```js
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: 3 new failures.

- [ ] **Step 3: Update `renderSlide`**

In `bin/build.js`, modify `renderSlide` (around line 355) to accept and render `threeEntries`. Replace the function with:

```js
export function renderSlide({ chunk, index, total, currentTitle = '', nextTitle = '', authors = [], charts = [], dotFigures = [], threeEntries = [] }) {
  const { classes, body } = parseAttrs(chunk);
  let html = marked.parse(body);
  const slug = slugify(extractTitle(html) || '');
  const vega = renderVega(charts, slug);
  if (vega) {
    html = html.includes(VEGA_PLACEHOLDER)
      ? html.replace(VEGA_PLACEHOLDER, vega)
      : `${html}\n${vega}`;
  }
  const three = renderThree(threeEntries, slug);
  if (three) {
    html = html.includes(THREE_PLACEHOLDER)
      ? html.replace(THREE_PLACEHOLDER, three)
      : `${html}\n${three}`;
  }
  for (let i = 0; i < dotFigures.length; i++) {
    const marker = dotPlaceholder(i);
    html = html.includes(marker)
      ? html.replace(marker, dotFigures[i])
      : `${html}\n${dotFigures[i]}`;
  }
  const classList = ['slide', ...classes].join(' ');
  const noChrome = classes.includes('no-chrome');
  const chrome = noChrome
    ? ''
    : `<aside class="chrome logo"><svg><use href='#logo'/></svg></aside><aside class="chrome"><span class="page">${index} / ${total}</span>${SPARK_INLINE}</aside>`;
  let footer = `<footer class="footer"><span class="footer-left">${currentTitle}</span>`;
  if (nextTitle != '') {
    footer += `<span class="footer-right">${nextTitle}</span>`;
  }
  footer += `</footer>`;
  const speakers = renderAuthors(authors);
  return `<section id="${index}-${slug}" class="${classList}" data-index="${index}">\n${html}\n${speakers}\n${chrome}\n${footer}\n</section>`;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): wire three entries through renderSlide

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Template placeholders

**Files:**
- Modify: `templates/deck.html`

- [ ] **Step 1: Add `{{threeImportmap}}` to `<head>`**

Open `templates/deck.html`. Replace the existing `<link rel="icon" ...>` line with:

```html
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 400 400'%3E%3ClinearGradient id='a' x1='85' x2='292' y1='42.5' y2='378' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%233dcbf9'/%3E%3Cstop offset='.2' stop-color='%2329b8ff'/%3E%3Cstop offset='.5' stop-color='%232858ff'/%3E%3Cstop offset='.8' stop-color='%239d41ff'/%3E%3Cstop offset='1' stop-color='%23e88dea'/%3E%3C/linearGradient%3E%3Cpath d='M0 0h400v400H0z'/%3E%3Cpath fill='url(%23a)' fill-rule='evenodd' d='M188 272v128h25V247l66 115 22-13-73-126 80 29q6-11 8-23l-45-16h129v-25H247l115-67-13-22-125 73 29-80-24-8-17 46V0h-24v153L121 38 99 51l73 125-80-29-8 24 46 17H0v25h153L38 279l13 22 126-73-29 80q11 6 23 9z' clip-rule='evenodd'/%3E%3C/svg%3E">
    {{threeImportmap}}
```

- [ ] **Step 2: Add `{{threeScripts}}` after `{{vegaScripts}}`**

In the same file, replace `{{vegaScripts}}` with:

```html
  {{vegaScripts}}
  {{threeScripts}}
```

- [ ] **Step 3: Verify template still renders existing decks**

Run: `npm test`
Expected: all tests pass — but `{{threeImportmap}}` and `{{threeScripts}}` will appear literally in built decks until `buildDeck` fills them. That's fine; the next task will replace them.

(If any existing test asserts on the literal HTML and now sees the placeholder strings, that's the signal to wire them up immediately. Continue to Task 7.)

- [ ] **Step 4: Commit**

```bash
git add templates/deck.html
git commit -m "$(cat <<'EOF'
feat(template): add three importmap and scripts placeholders

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire `extractThree` and importmap injection into `buildDeck`

**Files:**
- Modify: `bin/build.js` (`buildDeck` function around line 385)
- Test: `test/build.test.js`

- [ ] **Step 1: Write failing integration tests**

Append to `test/build.test.js`. Note: these read the dist HTML produced by `buildDeck`.

```js
test('buildDeck: injects three importmap and inlines runtime when a slide uses three', () => {
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
    return buildDeck(root).then(out => {
      const html = readFileSync(out, 'utf8');
      assert.match(html, /<script type="importmap">/);
      assert.match(html, /"three":\s*"https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.module\.min\.js"/);
      assert.match(html, /<script type="module">[\s\S]*three-canvas[\s\S]*<\/script>/);
      assert.match(html, /<canvas class="three-canvas"/);
      assert.match(html, /data-module="data:text\/javascript;base64,/);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildDeck: omits three importmap and runtime when no slide uses three', () => {
  const root = mkdtempSync(join(tmpdir(), 'three-build-empty-'));
  try {
    writeFileSync(join(root, 'slides.md'), '# Hello\n');
    return buildDeck(root).then(out => {
      const html = readFileSync(out, 'utf8');
      assert.doesNotMatch(html, /importmap/);
      assert.doesNotMatch(html, /three-canvas/);
      assert.doesNotMatch(html, /three\.module\.min\.js/);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: 2 new failures (importmap not present, runtime not inlined).

- [ ] **Step 3: Wire into `buildDeck`**

In `bin/build.js`, modify `buildDeck`. The per-chunk pipeline currently extracts authors, vega, dot. Add three extraction and embedding.

Replace this block (around lines 394–401):

```js
  const prepared = rawChunks.map(chunk => {
    const a = extractAuthors(chunk);
    const v = extractVega(a.body);
    const d = extractDot(v.body);
    copyAuthorPhotos(a.authors, talkDir, distDir);
    embedVegaSpecs(v.charts, talkDir);
    return { chunk: d.body, authors: a.authors, charts: v.charts, dotBlocks: d.blocks };
  });
```

with:

```js
  const prepared = rawChunks.map(chunk => {
    const a = extractAuthors(chunk);
    const v = extractVega(a.body);
    const t = extractThree(v.body);
    const d = extractDot(t.body);
    copyAuthorPhotos(a.authors, talkDir, distDir);
    embedVegaSpecs(v.charts, talkDir);
    embedThreeModules(t.entries, talkDir);
    return { chunk: d.body, authors: a.authors, charts: v.charts, threeEntries: t.entries, dotBlocks: d.blocks };
  });
```

Replace the `prepared.splice(...)` block (around line 414) — the agenda insertion — to add `threeEntries: []`:

```js
    prepared.splice(firstSectionIdx, 0, {
      chunk: renderAgendaChunk(sections),
      authors: [],
      charts: [],
      threeEntries: [],
      dotBlocks: [],
    });
```

Update the `sections` map (around line 436) to forward `threeEntries`:

```js
  const sections = prepared.map(({ chunk, authors, charts, threeEntries }, i) =>
    renderSlide({
      chunk,
      index: i + 1,
      total,
      currentTitle: i === 0 ? BRAND_FOOTER : titles[i],
      nextTitle: titles[i + 1] || '',
      authors,
      charts,
      dotFigures: dotHtmls[i],
      threeEntries,
    })
  );
```

After the `vegaScripts` definition (around line 454), add the three importmap + runtime injection. Replace this block:

```js
  const hasCharts = prepared.some(p => p.charts.length > 0);
  const vegaScripts = hasCharts
    ? '<script src="https://cdn.jsdelivr.net/npm/vega@5"></script>\n'
    + '  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>\n'
    + '  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>\n'
    + '  <script src="../../../script/vega.js"></script>'
    : '';
  const html = template
    .replaceAll('{{title}}', deckTitle)
    .replaceAll('{{cssDir}}', '../../../css')
    .replaceAll('{{scriptDir}}', '../../../script')
    .replace('{{slides}}', sections.join('\n'))
    .replace('{{vegaScripts}}', vegaScripts);
```

with:

```js
  const hasCharts = prepared.some(p => p.charts.length > 0);
  const vegaScripts = hasCharts
    ? '<script src="https://cdn.jsdelivr.net/npm/vega@5"></script>\n'
    + '  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>\n'
    + '  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>\n'
    + '  <script src="../../../script/vega.js"></script>'
    : '';
  const hasThree = prepared.some(p => p.threeEntries.length > 0);
  let threeImportmap = '';
  let threeScripts = '';
  if (hasThree) {
    threeImportmap =
      '<script type="importmap">\n'
      + '    { "imports": { "three": "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js" } }\n'
      + '    </script>';
    const runtimePath = fileURLToPath(new URL('../script/three.js', import.meta.url));
    const runtimeSrc = readFileSync(runtimePath, 'utf8');
    threeScripts = `<script type="module">\n${runtimeSrc}\n</script>`;
  }
  const html = template
    .replaceAll('{{title}}', deckTitle)
    .replaceAll('{{cssDir}}', '../../../css')
    .replaceAll('{{scriptDir}}', '../../../script')
    .replace('{{slides}}', sections.join('\n'))
    .replace('{{vegaScripts}}', vegaScripts)
    .replace('{{threeImportmap}}', threeImportmap)
    .replace('{{threeScripts}}', threeScripts);
```

- [ ] **Step 4: Create the runtime stub so `buildDeck` can read it**

Create `script/three.js` with a stub. We will fill it in Task 9. For now, this lets the build read a file that exists.

`script/three.js`:

```js
// script/three.js — runtime for embedding three.js viz canvases.
// Filled in by Task 9.
(() => {})();
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add bin/build.js script/three.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): inject three importmap and inline runtime when used

Conditionally emits the importmap and inlines script/three.js as a
type=module block, so file:// works without a server.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: CSS rule for `.three-canvas`

**Files:**
- Modify: `css/layouts.css`

- [ ] **Step 1: Inspect existing layout rules**

Run: `cat css/layouts.css | head -40`

- [ ] **Step 2: Append the `.three-canvas` rule**

Add to the end of `css/layouts.css`:

```css
.slide .three-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
```

- [ ] **Step 3: Commit**

```bash
git add css/layouts.css
git commit -m "$(cat <<'EOF'
feat(css): full-bleed positioning for .three-canvas

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Implement `script/three.js` runtime

**Files:**
- Modify: `script/three.js` (replace stub)

This task has no unit tests — runtime is verified manually in Task 12, matching the precedent set by `script/vega.js`.

- [ ] **Step 1: Replace the stub**

Replace the contents of `script/three.js` with:

```js
// script/three.js — runtime for embedding three.js viz canvases.
//
// Discovers .three-canvas elements, dynamic-imports each one's data-module
// (a base64 data: URL), calls init({ canvas, opts }), stores the returned
// handle, and routes ArrowRight/n/Space and ArrowLeft/p in capture phase to
// advance()/retreat(). If the module returns true, the keypress is consumed
// and deck.js doesn't see it.

const inited = new WeakSet();

function parseValue(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))) {
    try { return JSON.parse(v); } catch { /* fall through */ }
  }
  return v;
}

function optionsFromDataset(el) {
  const opts = {};
  for (const [key, raw] of Object.entries(el.dataset)) {
    if (key === 'module') continue;
    opts[key] = parseValue(raw);
  }
  return opts;
}

async function initCanvas(canvas) {
  if (inited.has(canvas)) return;
  inited.add(canvas);
  const url = canvas.dataset.module;
  if (!url) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
  try {
    const mod = await import(url);
    const init = mod.default || mod.init;
    if (typeof init !== 'function') {
      console.error('three: module exports no default init function', canvas.id);
      return;
    }
    const handle = init({ canvas, opts: optionsFromDataset(canvas) });
    canvas.__three = handle || {};
  } catch (err) {
    console.error('three: init failed for', canvas.id || canvas, err);
  }
}

function activeSlideCanvases() {
  const slide = document.querySelector('.slide.is-current');
  if (!slide) return [];
  return Array.from(slide.querySelectorAll('.three-canvas'));
}

function dispatchNav(method) {
  let consumed = false;
  for (const c of activeSlideCanvases()) {
    const fn = c.__three && c.__three[method];
    if (typeof fn === 'function') {
      try {
        if (fn.call(c.__three) === true) consumed = true;
      } catch (err) {
        console.error(`three: ${method}() threw for`, c.id || c, err);
      }
    }
  }
  return consumed;
}

function onKeyCapture(e) {
  if (e.defaultPrevented) return;
  let method = null;
  switch (e.key) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
    case 'n':
      method = 'advance';
      break;
    case 'ArrowLeft':
    case 'PageUp':
    case 'p':
      method = 'retreat';
      break;
    default:
      return;
  }
  if (dispatchNav(method)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function observeSlide(slide) {
  const obs = new MutationObserver(() => {
    if (slide.classList.contains('is-current')) {
      slide.querySelectorAll('.three-canvas').forEach(initCanvas);
    }
  });
  obs.observe(slide, { attributes: true, attributeFilter: ['class'] });
}

function start() {
  document.addEventListener('keydown', onKeyCapture, true);
  document.querySelectorAll('.slide').forEach(observeSlide);
  const current = document.querySelector('.slide.is-current');
  if (current) current.querySelectorAll('.three-canvas').forEach(initCanvas);
  window.addEventListener('resize', () => {
    document.querySelectorAll('.three-canvas').forEach(c => {
      if (!inited.has(c)) return;
      const rect = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(rect.width));
      c.height = Math.max(1, Math.round(rect.height));
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all tests pass (none of the runtime is unit-tested; existing build-side tests already cover the inlining).

- [ ] **Step 3: Commit**

```bash
git add script/three.js
git commit -m "$(cat <<'EOF'
feat(script): three.js runtime with stage-aware nav hooks

Capture-phase keydown listener inspects the active slide's canvases and
calls advance()/retreat() on each. If any returns true, deck.js never
sees the event. Otherwise the slide advances normally.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Example viz module — `embedding-lift.js`

**Files:**
- Create: `talks/threejs-example/embedding-lift.js`

- [ ] **Step 1: Create the talk dir**

Run: `mkdir -p talks/threejs-example`
Expected: directory created.

- [ ] **Step 2: Write the viz module**

Create `talks/threejs-example/embedding-lift.js`:

```js
import * as THREE from 'three';

const CLUSTER_COUNT = 3;
const PER_CLUSTER = 600;
const N = CLUSTER_COUNT * PER_CLUSTER;

function gauss(sigma = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}

function makePointTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export default function init({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
  camera.position.set(0, 0, 22);

  const centers = [
    { x: -4.5, y:  2.2, z:  3.0, color: new THREE.Color(0x175fff) },
    { x:  0.2, y: -2.8, z: -2.5, color: new THREE.Color(0xc84cff) },
    { x:  4.6, y:  2.6, z: -0.8, color: new THREE.Color(0x29b8ff) },
  ];

  const truePos = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  for (let c = 0; c < CLUSTER_COUNT; c++) {
    const center = centers[c];
    for (let i = 0; i < PER_CLUSTER; i++) {
      const idx = (c * PER_CLUSTER + i) * 3;
      truePos[idx + 0] = center.x + gauss(0.9);
      truePos[idx + 1] = center.y + gauss(0.9);
      truePos[idx + 2] = center.z + gauss(0.9);
      colors[idx + 0] = center.color.r;
      colors[idx + 1] = center.color.g;
      colors[idx + 2] = center.color.b;
    }
  }
  const livePos = new Float32Array(N * 3);
  livePos.set(truePos);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(livePos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    map: makePointTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  let stage = 1;
  let currentD = 1;
  let targetD = 1;
  let raf = 0;

  function applyDimension(d) {
    const yW = THREE.MathUtils.clamp(d - 1, 0, 1);
    const zW = THREE.MathUtils.clamp(d - 2, 0, 1);
    for (let i = 0; i < N; i++) {
      const idx = i * 3;
      livePos[idx + 0] = truePos[idx + 0];
      livePos[idx + 1] = truePos[idx + 1] * yW;
      livePos[idx + 2] = truePos[idx + 2] * zW;
    }
    geo.attributes.position.needsUpdate = true;
  }

  function applyCamera(d) {
    const t2 = THREE.MathUtils.clamp(d - 1, 0, 1);
    const t3 = THREE.MathUtils.clamp(d - 2, 0, 1);
    const radius = 22 - 2 * t2 + 6 * t3;
    const angleY = t3 * 0.55;
    const angleX = t3 * 0.28;
    camera.position.x = Math.sin(angleY) * radius * Math.cos(angleX);
    camera.position.z = Math.cos(angleY) * radius * Math.cos(angleX);
    camera.position.y = Math.sin(angleX) * radius;
    camera.lookAt(0, 0, 0);
  }

  function loop(now) {
    const t = now / 1000;
    currentD += (targetD - currentD) * 0.06;
    applyDimension(currentD);
    applyCamera(currentD);
    const idleRot = Math.max(0, currentD - 2.6) * 0.12;
    points.rotation.y = idleRot * Math.sin(t * 0.3);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function onResize() {
    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setSize(cw, ch, false);
  }
  window.addEventListener('resize', onResize);

  return {
    advance() {
      if (stage < 3) {
        stage++;
        targetD = stage;
        return true;
      }
      return false;
    },
    retreat() {
      if (stage > 1) {
        stage--;
        targetD = stage;
        return true;
      }
      return false;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add talks/threejs-example/embedding-lift.js
git commit -m "$(cat <<'EOF'
feat(example): embedding-lift viz module for threejs-example

Three gaussian clusters in 3D with brand colors. advance() ramps the
dimension target from 1→3, returning false on the third press so the
deck moves to the next slide.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Example deck — `talks/threejs-example/slides.md`

**Files:**
- Create: `talks/threejs-example/slides.md`

- [ ] **Step 1: Write the slides**

Create `talks/threejs-example/slides.md`:

```markdown
{.title}
# Embeddings: Dimensional Lift
## A 3D walk through clustering

```authors
- name: Simon Hearne
  position: Solutions Architect
  company: Zilliz
```

---

{.no-chrome}

```three
- module: ./embedding-lift.js
```
```

Note: the closing fence of the outer markdown code block here is just the file's own indicator; the actual `slides.md` ends with the closing ` ``` ` of the `three` block on its own line, no trailing fences.

The literal contents of `slides.md` should be:

```
{.title}
# Embeddings: Dimensional Lift
## A 3D walk through clustering

` + "```authors" + `
- name: Simon Hearne
  position: Solutions Architect
  company: Zilliz
` + "```" + `

---

{.no-chrome}

` + "```three" + `
- module: ./embedding-lift.js
` + "```" + `
```

(Use a heredoc or similar — exact triple-backticks, no escaping in the file itself.)

- [ ] **Step 2: Build the deck**

Run: `npm run build talks/threejs-example`
Expected: `built /Users/.../talks/threejs-example/dist/index.html` and no errors.

- [ ] **Step 3: Verify the build output**

Run: `grep -c 'three-canvas' talks/threejs-example/dist/index.html`
Expected: `1`

Run: `grep -c 'importmap' talks/threejs-example/dist/index.html`
Expected: `1`

Run: `grep -c 'data:text/javascript;base64' talks/threejs-example/dist/index.html`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add talks/threejs-example/slides.md
git commit -m "$(cat <<'EOF'
feat(example): threejs-example deck with title and viz slides

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Manual browser verification

**Files:** none modified. This is a verification step.

- [ ] **Step 1: Open the deck in a browser**

Run: `open talks/threejs-example/dist/index.html`
Expected: the title slide appears with the title, subtitle, and one author card.

- [ ] **Step 2: Verify the title slide chrome**

Confirm visually:
- Brand logo top-left, page indicator (1 / 2) top-right.
- "milvus.io | zilliz.com" footer left.
- No console errors.

- [ ] **Step 3: Advance to the viz slide**

Press Right Arrow once.
Expected: the slide swaps to a full-bleed three.js scene rendering one cluster (1D — all points on the X axis). No deck chrome visible (logo, page number, footer) because of `{.no-chrome}`.

- [ ] **Step 4: Verify stage hooks**

Press Right Arrow.
Expected: scene smoothly lerps to 2D (Y axis activates, second cluster spreads vertically). The deck does NOT advance — URL hash stays at `#2-...`.

Press Right Arrow again.
Expected: scene lerps to 3D, camera arcs to a three-quarter view, all three clusters separate.

Press Right Arrow a third time.
Expected: deck advances past the last slide (or stays on slide 2 — there is no next slide). URL hash unchanged.

- [ ] **Step 5: Verify retreat**

Press Left Arrow.
Expected: scene lerps back to 2D. Deck does NOT retreat to the title slide.

Press Left Arrow again.
Expected: scene lerps to 1D.

Press Left Arrow a third time.
Expected: deck navigates back to the title slide (hash `#1-...`).

- [ ] **Step 6: Re-enter the viz slide**

Press Right Arrow.
Expected: returns to the viz slide. Scene picks up from wherever it was when last seen (instances are preserved across slide nav). Animation is smooth.

- [ ] **Step 7: Console check**

Open DevTools console. Expected: no errors. `vegaEmbed`-style warnings are OK; nothing red.

- [ ] **Step 8: If any check fails, debug and fix before continuing**

Common issues to check:
- file:// blocking importmap dynamic imports → some browsers (Chromium) block module loading from file://. If broken, try Safari first; otherwise serve the dist via `python3 -m http.server 8000` from `talks/threejs-example/dist/`. If file:// is genuinely broken, document the limitation in `README.md` and mention `npm run preview` (if it exists) or `python3 -m http.server` as the fallback.
- Stage indicator: visual feedback for which stage the user is on is out-of-scope for v1. If the user wants it, add it as a follow-up.

- [ ] **Step 9: Commit (only if you fixed a bug)**

If a bug was fixed during verification, commit the fix with `fix(...):`.

---

## Task 13: README and CLAUDE.md updates

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Find the existing `vega` and `dot` sections in `README.md`**

Run: `grep -n '^##\|^### ' README.md`
Use the output to locate the right insertion point — adjacent to the `vega` and `dot` documentation.

- [ ] **Step 2: Add a `three` section to `README.md`**

Add a new section near the existing `vega` and `dot` documentation. Suggested copy:

```markdown
### Three.js (3D visualizations)

A slide can embed a three.js scene with a fenced `three` block:

` ```three
- module: ./embedding-lift.js
` ```

`module` is required (a local `.js` path or `https://` URL). The module is an ES module whose default export is `init({ canvas, opts })`, returning `{ advance?, retreat?, dispose? }`. Any other key on the entry is forwarded as a `data-*` attribute on the canvas and parsed into `opts` (numbers, booleans, JSON literals, otherwise raw string).

`advance()` and `retreat()` are optional. Return `true` if the keypress (Right/n/Space or Left/p) was consumed by the visualization (e.g. to step an internal stage); return `false` to let the deck navigate. Use `{.no-chrome}` on the slide for a full-bleed canvas.

The three.js library is loaded via an importmap to `cdnjs` and is only injected when at least one slide uses a `three` block. The module source is inlined as a base64 data URL so `file://` works without a server.

See `talks/threejs-example/` for a working example.
```

- [ ] **Step 3: Add a `three` paragraph to `CLAUDE.md`**

In `CLAUDE.md`, after the `Dot frontmatter` paragraph, add:

```markdown
**Three.js frontmatter** — a fenced ` ```three ` block embeds a three.js visualization. Same kv-list shape as `vega` and `authors`: list of objects with `module` (required, local path or URL), optional `id` (default `three-<slide-slug>`, suffixed `-2/-3/...` for multiples), and any other key passed through as a `data-<key>` attribute. Local module files are read at build time and **inlined as base64 `data:text/javascript` URIs** in the rendered HTML — same precedent as vega specs and for the same reason: `file://` blocks `fetch()` and dynamic `import()` of relative URLs. `script/three.js` (the runtime) is also inlined into the deck as a `<script type="module">` block, and the three.js library is loaded via a CDN importmap. Both injections are conditional on `hasThree` — chart-free decks pay nothing. The runtime listens for ArrowRight/n/Space and ArrowLeft/p in capture phase; if the active slide's canvas module returns `true` from `advance()`/`retreat()`, the keypress is consumed and `script/deck.js` never sees it.
```

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document three frontmatter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Final verification and merge

**Files:** none

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (130 + ~20 new = ~150 tests).

- [ ] **Step 2: Build the example again to confirm**

Run: `npm run build talks/threejs-example`
Expected: builds without errors.

- [ ] **Step 3: Build a non-three deck to confirm no regression**

Run: `npm run build talks/example`
Expected: builds without errors. Inspect output:

Run: `grep -c importmap talks/example/dist/index.html || true`
Expected: `0` — no importmap injected for non-three decks.

- [ ] **Step 4: Bundle the threejs example to confirm bundle pipeline**

Run: `npm run bundle talks/threejs-example`
Expected: produces `talks/threejs-example/dist/bundle.html` without errors.

Open the bundle: `open talks/threejs-example/dist/bundle.html`
Expected: works the same as `index.html`. (Three.js is still loaded from CDN — that is intentional for v1.)

- [ ] **Step 5: Final commit if anything changed**

Run: `git status`
Expected: clean (or commit the fix).

- [ ] **Step 6: Merge feature branch to main**

```bash
git checkout main
git merge --no-ff feat/threejs-frontmatter -m "Merge feat/threejs-frontmatter: three.js viz support"
```

Confirm the merge looks correct, then optionally delete the branch:

```bash
git branch -d feat/threejs-frontmatter
```

---

## Self-review notes

- All 14 tasks tied to spec sections: parse/extract/embed/render → Tasks 1–4; renderSlide wiring → Task 5; template → Task 6; buildDeck wiring + importmap + inline runtime → Task 7; CSS → Task 8; runtime → Task 9; example → Tasks 10–11; manual verification → Task 12; docs → Task 13; merge → Task 14.
- No placeholders. Every code step has full content.
- Consistent naming: `parseThree`, `extractThree`, `embedThreeModules`, `renderThree`, `THREE_PLACEHOLDER`, `threeEntries` (the field name on `prepared` and the `renderSlide` arg) used identically across tasks.
- Spec coverage: importmap injection, inline runtime (file:// safety), advance/retreat returning boolean, `{.no-chrome}` example, brand colors in viz, base64 data URL trick — all covered.
- Bundle: covered in Task 14 step 4. The `<script type="module">` inline block is not affected by `bundle.js`'s `SCRIPT_RE` (which matches `<script src="...">` only), so the inline runtime survives bundling unchanged.
