# Author/Speaker Frontmatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let deck authors declare speakers in `slides.md` via a fenced ```authors``` block; render them as a row of speaker cards on the title slide with photo (or initials fallback), name, position, and company.

**Architecture:** Add four small pure functions to `bin/build.js` (`parseAuthors`, `extractAuthors`, `renderAuthors`, plus a side-effecting `copyAuthorPhotos`). Wire them into `buildDeck` and `renderSlide` so each chunk is stripped of its authors block before Markdown rendering, photos are copied into `dist/`, and the rendered authors HTML is appended to the slide. Add CSS for `.speakers`, `.speaker`, `.avatar`, `.who-name`, `.who-role`. Update the example deck to exercise both the photo and initials-fallback paths.

**Tech Stack:** Node.js (ESM), `marked` for Markdown, `node:test` for testing. No new runtime dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-02-author-frontmatter-design.md`

---

## File Structure

**Files to create:**
- `talks/2026-05-example/jiang.jpg` — small placeholder photo (any small JPG, generated at fixture-creation time).

**Files to modify:**
- `bin/build.js` — add `parseAuthors`, `extractAuthors`, `renderAuthors`, `copyAuthorPhotos`; wire into `buildDeck` and `renderSlide`.
- `css/layouts.css` — add `.speakers` / `.speaker` / `.avatar` / `.who-name` / `.who-role` rules.
- `talks/2026-05-example/slides.md` — replace the byline with an `authors` block.
- `test/build.test.js` — add unit tests for the four new functions plus an integration test for photo copying via `buildDeck`.

All build logic stays in a single file because every existing build helper lives in `bin/build.js` — splitting would diverge from the current pattern.

---

## Task 1: `parseAuthors` — happy-path parsing

**Files:**
- Modify: `bin/build.js` (add new exported function)
- Test: `test/build.test.js` (add tests)

- [ ] **Step 1: Write the failing tests**

Append to `test/build.test.js`:

```js
import { parseAuthors } from '../bin/build.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern parseAuthors`
Expected: FAIL — `parseAuthors` is not exported.

- [ ] **Step 3: Implement `parseAuthors`**

Add to `bin/build.js` (place above `renderSlide`):

```js
export function parseAuthors(body) {
  const lines = String(body).replace(/\r\n/g, '\n').split('\n');
  const authors = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    const itemMatch = raw.match(/^-\s+(.*)$/);
    if (itemMatch) {
      current = {};
      authors.push(current);
      const kv = itemMatch[1];
      const colon = kv.indexOf(':');
      if (colon === -1) {
        throw new Error(`parseAuthors: expected "key: value" after "- " on line ${i + 1}: ${raw}`);
      }
      const key = kv.slice(0, colon).trim();
      const value = kv.slice(colon + 1).trim();
      current[key] = value;
      continue;
    }
    const indented = raw.match(/^\s+(.*)$/);
    if (indented && current) {
      const kv = indented[1];
      const colon = kv.indexOf(':');
      if (colon === -1) {
        throw new Error(`parseAuthors: expected "key: value" on line ${i + 1}: ${raw}`);
      }
      const key = kv.slice(0, colon).trim();
      const value = kv.slice(colon + 1).trim();
      current[key] = value;
      continue;
    }
    throw new Error(`parseAuthors: unexpected line ${i + 1}: ${raw}`);
  }
  return authors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern parseAuthors`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): add parseAuthors for fenced-block frontmatter"
```

---

## Task 2: `parseAuthors` — error cases

**Files:**
- Test: `test/build.test.js`

- [ ] **Step 1: Write the failing tests**

Append:

```js
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern parseAuthors`
Expected: PASS, all 7 tests (the implementation from Task 1 already throws these errors).

- [ ] **Step 3: Commit**

```bash
git add test/build.test.js
git commit -m "test(build): cover parseAuthors error paths"
```

---

## Task 3: `extractAuthors` — pulls fence out of a chunk

**Files:**
- Modify: `bin/build.js`
- Test: `test/build.test.js`

- [ ] **Step 1: Write the failing tests**

Append:

```js
import { extractAuthors } from '../bin/build.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern extractAuthors`
Expected: FAIL — `extractAuthors` not exported.

- [ ] **Step 3: Implement `extractAuthors`**

Add to `bin/build.js` (above `renderSlide`):

```js
export function extractAuthors(chunk) {
  const lines = String(chunk).replace(/\r\n/g, '\n').split('\n');
  let inOuterFence = false;
  let outerMarker = '';
  let start = -1;
  let end = -1;
  let fenceMarker = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (start === -1) {
      const openOuter = line.match(/^(```|~~~)/);
      if (openOuter && !inOuterFence) {
        const m = line.match(/^(```|~~~)authors\s*$/);
        if (m) {
          start = i;
          fenceMarker = m[1];
          continue;
        }
        inOuterFence = true;
        outerMarker = openOuter[1];
        continue;
      }
      if (inOuterFence && line.startsWith(outerMarker)) {
        inOuterFence = false;
        outerMarker = '';
      }
      continue;
    }
    if (line.startsWith(fenceMarker)) {
      end = i;
      break;
    }
  }
  if (start === -1 || end === -1) {
    return { authors: [], body: chunk };
  }
  const body = lines.slice(start + 1, end).join('\n');
  const authors = parseAuthors(body);
  const before = lines.slice(0, start);
  const after = lines.slice(end + 1);
  // Drop a single blank line on either side of the removed fence to avoid
  // leaving a double blank line in the chunk.
  if (before.length && before[before.length - 1].trim() === '') before.pop();
  if (after.length && after[0].trim() === '') after.shift();
  const remaining = [...before, ...after].join('\n');
  return { authors, body: remaining };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern extractAuthors`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): extract ```authors fenced block from a slide chunk"
```

---

## Task 4: `renderAuthors` — initials fallback rules

**Files:**
- Modify: `bin/build.js`
- Test: `test/build.test.js`

- [ ] **Step 1: Write the failing tests**

Append:

```js
import { renderAuthors } from '../bin/build.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern renderAuthors`
Expected: FAIL — `renderAuthors` not exported.

- [ ] **Step 3: Implement `renderAuthors`**

Add to `bin/build.js` (above `renderSlide`, after the existing `escapeHtml` helper):

```js
function deriveInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function renderAuthors(authors) {
  if (!authors || authors.length === 0) return '';
  const cards = authors.map(a => {
    const avatar = a.photo
      ? `<img src="${escapeHtml(a.photo)}" alt="">`
      : escapeHtml((a.initials || deriveInitials(a.name)).toUpperCase());
    return (
      '<div class="speaker">' +
      `<div class="avatar">${avatar}</div>` +
      '<div>' +
      `<div class="who-name">${escapeHtml(a.name)}</div>` +
      `<div class="who-role">${escapeHtml(a.position)} · ${escapeHtml(a.company)}</div>` +
      '</div>' +
      '</div>'
    );
  });
  return `<div class="speakers">${cards.join('')}</div>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern renderAuthors`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): render speaker cards with initials fallback"
```

---

## Task 5: `copyAuthorPhotos` — copy local photos, leave URLs alone

**Files:**
- Modify: `bin/build.js`
- Test: `test/build.test.js`

- [ ] **Step 1: Write the failing tests**

Append at the top of `test/build.test.js` (after the existing imports):

```js
import { copyAuthorPhotos } from '../bin/build.js';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
```

Then append at the bottom of `test/build.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern copyAuthorPhotos`
Expected: FAIL — `copyAuthorPhotos` not exported.

- [ ] **Step 3: Implement `copyAuthorPhotos`**

Add to `bin/build.js`. First, update the existing `node:fs` import at the top of the file:

```js
import { readFileSync, writeFileSync, mkdirSync, realpathSync, copyFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
```

(`copyFileSync` is added; `basename` is already imported.)

Then add (above `renderSlide`):

```js
export function copyAuthorPhotos(authors, talkDir, distDir) {
  for (const a of authors) {
    if (!a.photo) continue;
    if (/^https?:\/\//i.test(a.photo)) continue;
    const src = resolve(talkDir, a.photo);
    const name = basename(a.photo);
    const dest = resolve(distDir, name);
    try {
      copyFileSync(src, dest);
    } catch (err) {
      throw new Error(`copyAuthorPhotos: failed to copy photo for ${a.name} from ${a.photo}: ${err.message}`);
    }
    a.photo = name;
  }
  return authors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern copyAuthorPhotos`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): copy local author photos into dist, pass URLs through"
```

---

## Task 6: Wire authors into `renderSlide` and `buildDeck`

**Files:**
- Modify: `bin/build.js`
- Test: `test/build.test.js`

- [ ] **Step 1: Write the failing tests**

Append:

```js
import { buildDeck } from '../bin/build.js';

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

test('buildDeck: integration — local photo gets copied and inlined as bare filename', () => {
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
    const out = buildDeck(root);
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

test('buildDeck: integration — extracted title ignores the authors fence', () => {
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
    const out = buildDeck(root);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /<title>Real Title<\/title>/);
    assert.match(html, /id="1-real-title"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern "renderSlide: appends authors|renderSlide: omits authors|buildDeck: integration"`
Expected: FAIL — `renderSlide` does not yet handle `authors`, and `buildDeck` does not yet extract the fence.

- [ ] **Step 3: Update `renderSlide`**

Replace the existing `renderSlide` in `bin/build.js` with:

```js
export function renderSlide({ chunk, index, total, currentTitle = '', nextTitle = '', authors = [] }) {
  const { classes, body } = parseAttrs(chunk);
  const html = marked.parse(body);
  const slug = slugify(extractTitle(html) || '');
  const classList = ['slide', ...classes].join(' ');
  const noChrome = classes.includes('no-chrome');
  const chrome = noChrome
    ? ''
    : `<aside class="chrome logo"><svg><use href='#logo'/></svg></aside><aside class="chrome"><span class="page">${index} / ${total}</span>${SPARK_INLINE}</aside>`;
  const footer = `<footer class="footer"><span class="footer-left">${escapeHtml(currentTitle)}</span><span class="footer-right">${escapeHtml(nextTitle)}</span></footer>`;
  const speakers = renderAuthors(authors);
  return `<section id="${index}-${slug}" class="${classList}" data-index="${index}">\n${html}\n${speakers}\n${chrome}\n${footer}\n</section>`;
}
```

- [ ] **Step 4: Update `buildDeck`**

Replace the existing `buildDeck` in `bin/build.js` with:

```js
export function buildDeck(talkDir) {
  const mdPath = resolve(talkDir, 'slides.md');
  const md = readFileSync(mdPath, 'utf8');
  const rawChunks = splitSlides(md);

  const distDir = resolve(talkDir, 'dist');
  mkdirSync(distDir, { recursive: true });

  const prepared = rawChunks.map(chunk => {
    const { authors, body } = extractAuthors(chunk);
    copyAuthorPhotos(authors, talkDir, distDir);
    return { chunk: body, authors };
  });

  const total = prepared.length;
  const titles = prepared.map(({ chunk }) => {
    const html = marked.parse(parseAttrs(chunk).body);
    return extractTitle(html) || '';
  });
  const sections = prepared.map(({ chunk, authors }, i) =>
    renderSlide({
      chunk,
      index: i + 1,
      total,
      currentTitle: i === 0 ? BRAND_FOOTER : titles[i],
      nextTitle: titles[i + 1] || '',
      authors,
    })
  );

  const templatePath = fileURLToPath(new URL('../templates/deck.html', import.meta.url));
  const template = readFileSync(templatePath, 'utf8');

  const deckTitle = titles[0] || basename(talkDir);

  const html = template
    .replaceAll('{{title}}', deckTitle)
    .replaceAll('{{cssDir}}', '../../../css')
    .replaceAll('{{scriptDir}}', '../../../script')
    .replace('{{slides}}', sections.join('\n'));

  const outPath = resolve(distDir, 'index.html');
  writeFileSync(outPath, html);
  return outPath;
}
```

- [ ] **Step 5: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS, all existing tests plus the new ones from Tasks 1–6.

- [ ] **Step 6: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): wire authors extraction into buildDeck and renderSlide"
```

---

## Task 7: CSS for speaker cards

**Files:**
- Modify: `css/layouts.css`

- [ ] **Step 1: Append the new rules to `css/layouts.css`**

Add at the bottom of the file:

```css
/* Speaker cards — used by the `authors` frontmatter block */
.speakers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--zilliz-s-4);
  width: 100%;
}
.speaker {
  display: flex;
  align-items: center;
  gap: var(--zilliz-s-3);
  flex: 1 1 calc(33.333% - var(--zilliz-s-4));
  min-width: 360px;
}
.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  flex: 0 0 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f59e0b, #ec4899);
  color: var(--zilliz-white);
  font-family: var(--zilliz-font-mono);
  font-weight: 700;
  font-size: 28px;
  letter-spacing: 0.04em;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.who-name {
  font-family: var(--zilliz-font-sans);
  font-weight: 700;
  font-size: 32px;
  line-height: 1.1;
}
.who-role {
  font-family: var(--zilliz-font-mono);
  font-weight: 400;
  font-size: 22px;
  line-height: 1.3;
  opacity: 0.85;
  margin-top: 4px;
}

/* Title slide places the speakers row above the footer area */
.slide.title .speakers {
  margin-top: var(--zilliz-s-8);
}
.slide.title .who-name { color: var(--zilliz-white); }
.slide.title .who-role { color: var(--zilliz-white); opacity: 0.85; }
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: PASS — CSS changes do not break tests.

- [ ] **Step 3: Commit**

```bash
git add css/layouts.css
git commit -m "feat(css): style speaker cards and avatar fallback"
```

---

## Task 8: Update example deck and visually verify

**Files:**
- Create: `talks/2026-05-example/jiang.jpg` (small placeholder — see Step 1)
- Modify: `talks/2026-05-example/slides.md`

- [ ] **Step 1: Create a small placeholder photo**

Run from the repo root:

```bash
node -e "import('node:fs').then(fs => { const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJ+f/9k=', 'base64'); fs.writeFileSync('talks/2026-05-example/jiang.jpg', buf); });"
```

This writes a 1×1 black JPEG (~150 bytes) suitable as a placeholder. Authors can replace it with a real photo later.

- [ ] **Step 2: Update `talks/2026-05-example/slides.md`**

Replace the first slide section. Find:

```md
{.title .no-chrome}
<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Bootstrap Deck
## A minimal Zilliz presentation
Simon Hearne — May 2026

---
```

Replace with:

````md
{.title .no-chrome}
<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Bootstrap Deck
## A minimal Zilliz presentation

```authors
- name: Simon Hearne
  position: senior solutions architect
  company: zilliz
  photo: ./jiang.jpg
- name: Jiang Chen
  position: head of developer relations
  company: zilliz
```

---
````

(One author has a photo, one falls back to initials — exercises both code paths.)

- [ ] **Step 3: Run the build**

Run: `npm run build talks/2026-05-example`
Expected: prints `built …/dist/index.html`, no errors.

- [ ] **Step 4: Verify the rendered HTML by inspection**

Run: `grep -E 'speakers|speaker|avatar|who-name|who-role' talks/2026-05-example/dist/index.html | head -20`
Expected: see the new wrapper, two `.speaker` cards, one `<img src="jiang.jpg" ...>`, and one `<div class="avatar">JC</div>`.

Also confirm the photo was copied:

Run: `ls talks/2026-05-example/dist/jiang.jpg`
Expected: file exists.

- [ ] **Step 5: Visually check in a browser**

Open `talks/2026-05-example/dist/index.html` in a browser. The first slide should show:
- The deck title "Bootstrap Deck" with subtitle.
- Two speaker cards in a row at the bottom: one with the placeholder photo (a 1×1 black square scaled up to 80px circle — looks like a black dot, but proves the photo path works), one with "JC" on a gradient avatar.

If the cards are misaligned or overlap the footer, tweak `--zilliz-s-8` margin in Task 7 and re-build. (No code change required if it looks right.)

- [ ] **Step 6: Run the bundler and confirm the photo is inlined**

Run: `npm run bundle talks/2026-05-example`
Run: `grep -o 'data:image/jpeg;base64' talks/2026-05-example/dist/bundle.html | head`
Expected: at least one match (the inlined `jiang.jpg`).

- [ ] **Step 7: Commit**

```bash
git add talks/2026-05-example/slides.md talks/2026-05-example/jiang.jpg
git commit -m "docs(example): use authors frontmatter on title slide"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests, no failures.

- [ ] **Step 2: Build and bundle the example deck end-to-end**

Run: `npm run build talks/2026-05-example && npm run bundle talks/2026-05-example`
Expected: both succeed; `dist/index.html` and `dist/bundle.html` both exist.

- [ ] **Step 3: Confirm git status is clean**

Run: `git status`
Expected: clean working tree.
