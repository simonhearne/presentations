# Deck Config & Auto-Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-of-file ` ```deck ` config block (carrier for future deck-level options) and an opt-out, auto-injected agenda slide hyperlinking to each `.section` divider.

**Architecture:** A new `extractDeckConfig(md)` runs before `splitSlides` and strips the top-of-file ` ```deck ` fenced block, returning a parsed config object plus the remaining markdown. After per-slide chunks are prepared, `buildDeck` finds the first `.section` slide, builds a list of section `{title, slug, slideIndex}` entries (slideIndex is post-splice 1-based), synthesises an agenda chunk via `renderAgendaChunk`, and splices it in at the first-section index. Downstream code (titles, page numbers, footers, hash IDs) operates on the post-splice array unchanged. A new `.slide.agenda` rule in `css/layouts.css` styles the slide.

**Tech Stack:** Node.js (ESM), `marked` v14, Node's built-in `node:test` runner. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-06-deck-config-and-agenda-design.md`

---

## File Structure

- **Modify** `bin/build.js` — add `extractDeckConfig`, `renderAgendaChunk`, and wire them into `buildDeck`. New helpers go above `renderSlide`, matching the project convention. `buildDeck` stays last.
- **Modify** `test/build.test.js` — append unit and integration tests at the bottom; extend the existing import line from `bin/build.js` rather than adding a duplicate.
- **Modify** `css/layouts.css` — add a `.slide.agenda` block. Match the surrounding terse style.
- **Modify** `talks/vectordb-201/slides.md` — visual-verification target (no edits to its content unless the build surfaces an issue).

No new files. No new dependencies.

---

### Task 1: `extractDeckConfig` — parse top-of-file deck config block

**Files:**
- Modify: `bin/build.js` (add `extractDeckConfig` above `renderSlide`; export it)
- Test: `test/build.test.js` (append tests, extend import line)

- [ ] **Step 1: Write the failing tests**

Append to `test/build.test.js`:

```js
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
```

Update the existing import line at the top of `test/build.test.js` to add `extractDeckConfig`:

```js
import { splitSlides, parseAttrs, slugify, extractTitle, renderSlide, parseAuthors, extractAuthors, renderAuthors, copyAuthorPhotos, parseVega, extractVega, renderVega, embedVegaSpecs, extractDot, DOT_DEFAULTS, renderDot, buildDeck, extractDeckConfig } from '../bin/build.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -E "extractDeckConfig|fail" | head -20`
Expected: FAIL with `extractDeckConfig is not defined` (or similar — the import will throw at module load).

- [ ] **Step 3: Implement `extractDeckConfig`**

Add to `bin/build.js`, immediately above `renderSlide` (around line 322, before the `renderSlide` definition):

```js
export function extractDeckConfig(md) {
  const text = String(md).replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return { config: {}, remaining: md };
  const openMatch = lines[i].match(/^(```|~~~)deck\s*$/);
  if (!openMatch) return { config: {}, remaining: md };
  const fence = openMatch[1];
  const start = i;
  let end = -1;
  for (i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith(fence)) { end = i; break; }
  }
  if (end === -1) return { config: {}, remaining: md };
  const body = lines.slice(start + 1, end).join('\n');
  const items = body.trim() === '' ? [] : parseKvList(body, 'extractDeckConfig');
  const config = {};
  for (const item of items) Object.assign(config, item);
  let after = end + 1;
  if (after < lines.length && lines[after].trim() === '') after++;
  return { config, remaining: lines.slice(after).join('\n') };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: all tests pass, including the new `extractDeckConfig` cases.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): extract top-of-file deck config block

Adds extractDeckConfig as a new pipeline step that strips a
top-of-file ```deck fenced block and returns its kv-list contents as a
flat config object. Block must be at top-of-file (leading blanks
tolerated); embedded fences are left alone for the slide to render —
which surfaces the authoring mistake.

Carrier for future deck-level options. The agenda opt-out lands in a
follow-up commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `renderAgendaChunk` — synthesise the agenda slide markdown

**Files:**
- Modify: `bin/build.js` (add `renderAgendaChunk` above `renderSlide`; export it)
- Test: `test/build.test.js` (append tests, extend import line)

- [ ] **Step 1: Write the failing tests**

Append to `test/build.test.js`:

```js
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
```

Update the import line to add `renderAgendaChunk`:

```js
import { splitSlides, parseAttrs, slugify, extractTitle, renderSlide, parseAuthors, extractAuthors, renderAuthors, copyAuthorPhotos, parseVega, extractVega, renderVega, embedVegaSpecs, extractDot, DOT_DEFAULTS, renderDot, buildDeck, extractDeckConfig, renderAgendaChunk } from '../bin/build.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -E "renderAgendaChunk|fail" | head -20`
Expected: FAIL — `renderAgendaChunk is not defined`.

- [ ] **Step 3: Implement `renderAgendaChunk`**

Add to `bin/build.js`, immediately above `renderSlide`:

```js
export function renderAgendaChunk(sections) {
  if (!sections || sections.length === 0) return '{.agenda}\n# Agenda';
  const items = sections.map((s, i) =>
    `${i + 1}. [${s.title}](#${s.slideIndex}-${s.slug})`
  );
  return `{.agenda}\n# Agenda\n\n${items.join('\n')}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): renderAgendaChunk synthesises agenda markdown

Pure helper that takes [{title, slug, slideIndex}] and returns a
markdown chunk with a {.agenda} attribute block, an # Agenda heading,
and a numbered list of hyperlinks to each section. Wired into
buildDeck in a follow-up commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire deck config and agenda injection into `buildDeck`

**Files:**
- Modify: `bin/build.js` (`buildDeck` function only)
- Test: `test/build.test.js` (append integration tests)

- [ ] **Step 1: Write the failing integration tests**

Append to `test/build.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -30`
Expected: the four new integration tests fail (no agenda being injected; section counts off by one).

- [ ] **Step 3: Modify `buildDeck` to extract config and inject the agenda**

Replace the body of `buildDeck` in `bin/build.js`. The full new body:

```js
export async function buildDeck(talkDir) {
  const mdPath = resolve(talkDir, 'slides.md');
  const md = readFileSync(mdPath, 'utf8');
  const { config: deckConfig, remaining } = extractDeckConfig(md);
  const rawChunks = splitSlides(remaining);

  const distDir = resolve(talkDir, 'dist');
  mkdirSync(distDir, { recursive: true });

  const prepared = rawChunks.map(chunk => {
    const a = extractAuthors(chunk);
    const v = extractVega(a.body);
    const d = extractDot(v.body);
    copyAuthorPhotos(a.authors, talkDir, distDir);
    embedVegaSpecs(v.charts, talkDir);
    return { chunk: d.body, authors: a.authors, charts: v.charts, dotBlocks: d.blocks };
  });

  const agendaOff = String(deckConfig.agenda || '').toLowerCase() === 'false';
  const firstSectionIdx = prepared.findIndex(p => parseAttrs(p.chunk).classes.includes('section'));
  if (!agendaOff && firstSectionIdx !== -1) {
    const sections = [];
    for (let i = firstSectionIdx; i < prepared.length; i++) {
      const { classes, body } = parseAttrs(prepared[i].chunk);
      if (!classes.includes('section')) continue;
      const html = marked.parse(body);
      const title = extractTitle(html) || '';
      sections.push({ title, slug: slugify(title), slideIndex: i + 2 });
    }
    prepared.splice(firstSectionIdx, 0, {
      chunk: renderAgendaChunk(sections),
      authors: [],
      charts: [],
      dotBlocks: [],
    });
  }

  const total = prepared.length;
  const titles = prepared.map(({ chunk }) => {
    const html = marked.parse(parseAttrs(chunk).body);
    return extractTitle(html) || '';
  });
  const slugs = prepared.map(({ chunk }) => {
    const html = marked.parse(parseAttrs(chunk).body);
    return slugify(extractTitle(html) || '');
  });
  const hasDot = prepared.some(p => p.dotBlocks.length > 0);
  const graphviz = hasDot ? await Graphviz.load() : null;
  const dotHtmls = await Promise.all(prepared.map((p, i) =>
    renderDot(p.dotBlocks, slugs[i], graphviz)
  ));
  const sections = prepared.map(({ chunk, authors, charts }, i) =>
    renderSlide({
      chunk,
      index: i + 1,
      total,
      currentTitle: i === 0 ? BRAND_FOOTER : titles[i],
      nextTitle: titles[i + 1] || '',
      authors,
      charts,
      dotFigures: dotHtmls[i],
    })
  );

  const templatePath = fileURLToPath(new URL('../templates/deck.html', import.meta.url));
  const template = readFileSync(templatePath, 'utf8');

  const deckTitle = titles[0] || basename(talkDir);
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

  const outPath = resolve(distDir, 'index.html');
  writeFileSync(outPath, html);
  return outPath;
}
```

The only changes vs. the existing function: the two new lines reading `extractDeckConfig` at the top, and the `agendaOff`/`firstSectionIdx`/splice block inserted between `prepared` construction and the `total = prepared.length` line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: all tests pass — full suite green (existing 117+ tests plus the new integration tests).

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "$(cat <<'EOF'
feat(build): inject auto agenda before the first .section slide

buildDeck now reads top-of-file deck config (via extractDeckConfig) and
splices a synthesised agenda slide ({.agenda}, # Agenda heading,
numbered hyperlinks to each section) before the first section divider.
Opt out with `agenda: false` in the deck block. Skipped silently when
the deck has no section slides. Hash links use post-splice slide
indices, which the existing deck.js navigation already handles via the
leading-number regex.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Style `.slide.agenda` and visually verify with vectordb-201

**Files:**
- Modify: `css/layouts.css` (append a `.slide.agenda` block)
- Visual check: `talks/vectordb-201/dist/index.html` after rebuild

- [ ] **Step 1: Append the CSS rule**

Append to `css/layouts.css` after the `.section` block (around line 80, after `.slide.section h2 { ... }`):

```css
/* .agenda — auto-generated TOC: numbered, hyperlinked section list */
.slide.agenda h1 {
  font-size: 96px;
  font-weight: 600;
  margin-bottom: var(--zilliz-s-12);
}
.slide.agenda ol {
  font-size: 52px;
  line-height: 1.5;
  font-weight: 500;
  padding-left: 1.5em;
  margin: 0;
}
.slide.agenda ol li::marker {
  color: var(--zilliz-blue);
  font-weight: 700;
}
.slide.agenda a {
  color: var(--zilliz-black);
  text-decoration: none;
}
.slide.agenda a:hover,
.slide.agenda a:focus {
  color: var(--zilliz-blue);
  text-decoration: underline;
  text-underline-offset: 6px;
}
```

- [ ] **Step 2: Build vectordb-201 and inspect the output**

Run: `npm run build talks/vectordb-201`
Expected: build completes without errors; `talks/vectordb-201/dist/index.html` is regenerated.

Then verify the agenda slide is present and well-formed:

```bash
grep -c 'class="slide agenda"' talks/vectordb-201/dist/index.html
grep -oE '<a href="#[0-9]+-[a-z-]+">[^<]+</a>' talks/vectordb-201/dist/index.html | head -10
```

Expected: count is `1`; the printed anchors include the four section titles (Indexes that don't fall over, Hybrid search & reranking, Distribution & isolation, Observability & alerting) with slide numbers shifted by +1 vs. the pre-agenda numbering.

Open the file in a browser (`open talks/vectordb-201/dist/index.html`) and:
- Confirm the agenda renders between the title intro slides and the first section divider.
- Click each link — it should jump to the corresponding section slide.
- Confirm the page-number chrome shows `N / total` with the bumped total.

- [ ] **Step 3: Run the full test suite once more**

Run: `npm test 2>&1 | tail -5`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add css/layouts.css
git commit -m "$(cat <<'EOF'
feat(css): style .slide.agenda layout

Numbered list with brand-blue markers and underline-on-hover links.
Heading scale tuned for projection legibility; plain-link colour keeps
the list readable when projected, with hover/focus signalling clickability for screen viewers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification checklist

After all four tasks:

- [ ] `npm test` is green.
- [ ] `npm run build talks/vectordb-201` succeeds; agenda slide is present, hyperlinks resolve, page numbers reflect the +1 total.
- [ ] `npm run build talks/vectordb-101` and `npm run build talks/2026-05-example` still succeed (no regressions on decks without `.section` slides).
- [ ] `npm run bundle talks/vectordb-201` produces a self-contained `bundle.html` with the agenda still functional (anchor links inside a single-file HTML still work via `location.hash`).
