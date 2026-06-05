# Zilliz Presentations Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a minimal, dependency-light Markdown-to-HTML presentation framework with a single-file bundler, brand-aligned slide layouts, scale-to-fit canvas, keyboard navigation, hash deeplinks, and clean PDF print output.

**Architecture:** Two Node 20+ scripts (`bin/build.js` and `bin/bundle.js`) backed by one runtime dep (`marked`). Pure-function internals are TDD'd with the built-in `node:test` runner; the example talk doubles as an end-to-end smoke test. CSS uses `--zilliz-*` custom properties; runtime is ~80 lines of vanilla JS that scale-transforms a fixed 1920×1080 canvas, handles keyboard nav, and syncs `location.hash`.

**Tech Stack:** Node 20+, ESM, `marked` (^14), `node:test` + `node:assert`, vanilla CSS with custom properties, vanilla JS, Google Fonts (Inter + IBM Plex Mono).

**Spec:** [docs/superpowers/specs/2026-05-01-presentations-framework-design.md](../specs/2026-05-01-presentations-framework-design.md)

---

## File map

**Created by this plan:**

| Path | Responsibility |
|---|---|
| `package.json` | Node project manifest, ESM, `marked` dep, npm scripts |
| `.gitignore` | Excludes `node_modules/` and `talks/*/dist/` |
| `css/tokens.css` | `--zilliz-*` design tokens (colors, fonts, sizes, spacing) |
| `css/deck.css` | Canvas, slide visibility, chrome footer, print rules |
| `css/layouts.css` | `.title`, `.section`, `.hero`, default content layouts |
| `templates/deck.html` | Static HTML shell with `{{title}}`, `{{slides}}`, Google Fonts link |
| `img/zilliz-spark.svg` | 12-line spark mark (placeholder geometry; see Task 5) |
| `img/zilliz-logo-dark.svg` | Spark + "zilliz" wordmark, black |
| `img/zilliz-logo-white.svg` | Spark + "zilliz" wordmark, white |
| `bin/build.js` | Pipeline 1: md → HTML |
| `bin/bundle.js` | Pipeline 2: HTML + assets → single HTML |
| `script/deck.js` | Runtime: scale-to-fit, keyboard nav, hash deeplinks |
| `test/build.test.js` | Tests for `build.js` pure functions |
| `test/bundle.test.js` | Tests for `bundle.js` pure functions |
| `talks/2026-05-example/slides.md` | Example talk that exercises every layout |
| `README.md` | Brief usage docs |

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "zilliz-presentations",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node bin/build.js",
    "bundle": "node bin/bundle.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "marked": "^14.0.0"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
talks/*/dist/
.DS_Store
```

- [ ] **Step 3: Install marked**

Run: `npm install`
Expected: creates `node_modules/`, `package-lock.json`. Exit 0.

- [ ] **Step 4: Verify the test runner works**

Run: `npm test`
Expected: PASS with `tests 0` (no tests yet, exit 0). If a non-zero exit, investigate Node version (`node -v` should be ≥ 20).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: scaffold Node project with marked"
```

---

## Task 2: CSS design tokens

**Files:**
- Create: `css/tokens.css`

- [ ] **Step 1: Write `css/tokens.css`**

```css
:root {
  /* Brand — primary */
  --zilliz-black: #000000;
  --zilliz-white: #ffffff;
  --zilliz-blue: #175fff;
  --zilliz-blue-10: #e6f0ff;
  --zilliz-blue-20: #cce0ff;

  /* Brand — secondary */
  --zilliz-navy: #061982;
  --zilliz-berry: #c84cff;
  --zilliz-berry-10: #fbe6ff;
  --zilliz-berry-20: #f7c9ff;
  --zilliz-purple: #7f47ff;
  --zilliz-sky: #49bcff;
  --zilliz-green: #00dcc6;

  /* Brand — gradients */
  --zilliz-gradient: linear-gradient(135deg, #175fff 0%, #7f47ff 50%, #c84cff 100%);
  --zilliz-gradient-light:
    radial-gradient(circle at 12% 8%, var(--zilliz-blue-20) 0%, transparent 78%),
    radial-gradient(circle at 88% 92%, var(--zilliz-berry-20) 0%, transparent 78%),
    var(--zilliz-white);
  --zilliz-gradient-dark:
    radial-gradient(circle at 12% 8%, var(--zilliz-blue) 0%, transparent 78%),
    radial-gradient(circle at 88% 92%, var(--zilliz-berry) 0%, transparent 78%),
    var(--zilliz-navy);

  /* Type */
  --zilliz-font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --zilliz-font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;

  /* Canvas */
  --zilliz-slide-w: 1920px;
  --zilliz-slide-h: 1080px;

  /* Spacing scale (8px base) */
  --zilliz-s-1: 8px;
  --zilliz-s-2: 16px;
  --zilliz-s-3: 24px;
  --zilliz-s-4: 32px;
  --zilliz-s-6: 48px;
  --zilliz-s-8: 64px;
  --zilliz-s-12: 96px;
  --zilliz-s-16: 128px;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/tokens.css
git commit -m "feat(css): add Zilliz brand design tokens"
```

---

## Task 3: Deck CSS (canvas, visibility, print)

**Files:**
- Create: `css/deck.css`

- [ ] **Step 1: Write `css/deck.css`**

```css
@import url('./tokens.css');

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--zilliz-black);
  overflow: hidden;
  font-family: var(--zilliz-font-sans);
}

.deck-viewport {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
}

.deck {
  width: var(--zilliz-slide-w);
  height: var(--zilliz-slide-h);
  position: relative;
  transform-origin: center center;
}

.slide {
  position: absolute;
  inset: 0;
  width: var(--zilliz-slide-w);
  height: var(--zilliz-slide-h);
  display: none;
  flex-direction: column;
  font-family: var(--zilliz-font-sans);
  color: var(--zilliz-black);
  background: var(--zilliz-white);
  padding: var(--zilliz-s-16);
  box-sizing: border-box;
  overflow: hidden;
}

.slide.is-current {
  display: flex;
}

.chrome {
  position: absolute;
  bottom: var(--zilliz-s-4);
  right: var(--zilliz-s-4);
  display: flex;
  align-items: center;
  gap: var(--zilliz-s-2);
  font-family: var(--zilliz-font-mono);
  font-size: 18px;
  opacity: 0.5;
  color: inherit;
}

.chrome .mark {
  width: 24px;
  height: 24px;
}

.no-chrome .chrome {
  display: none;
}

@media print {
  html, body {
    height: auto;
    background: white;
    overflow: visible;
  }
  .deck-viewport {
    position: static;
    display: block;
  }
  .deck {
    width: auto;
    height: auto;
    transform: none !important;
  }
  .slide {
    display: flex !important;
    position: static;
    page-break-after: always;
    break-after: page;
  }
  .slide:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}

@page {
  size: 1920px 1080px;
  margin: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/deck.css
git commit -m "feat(css): add deck canvas, visibility, and print rules"
```

---

## Task 4: Layouts CSS (.title, .section, .hero, default)

**Files:**
- Create: `css/layouts.css`

- [ ] **Step 1: Write `css/layouts.css`**

```css
/* Default content slide — used when no layout class is set */
.slide h1 { font-size: 80px; font-weight: 600; margin: 0 0 var(--zilliz-s-4); line-height: 1.05; }
.slide h2 { font-size: 56px; font-weight: 500; margin: 0 0 var(--zilliz-s-3); line-height: 1.1; }
.slide h3 { font-size: 40px; font-weight: 500; margin: 0 0 var(--zilliz-s-3); line-height: 1.15; }
.slide p, .slide li { font-size: 32px; font-weight: 400; line-height: 1.4; margin: 0 0 var(--zilliz-s-2); }
.slide ul, .slide ol { padding-left: var(--zilliz-s-6); margin: 0 0 var(--zilliz-s-4); }
.slide li { margin-bottom: var(--zilliz-s-2); }
.slide strong { font-weight: 600; }
.slide a { color: var(--zilliz-blue); text-decoration: underline; text-underline-offset: 4px; }
.slide code {
  font-family: var(--zilliz-font-mono);
  font-size: 0.9em;
  background: var(--zilliz-blue-10);
  padding: 2px 8px;
  border-radius: 4px;
}
.slide pre {
  font-family: var(--zilliz-font-mono);
  background: var(--zilliz-blue-10);
  padding: var(--zilliz-s-4);
  border-radius: 12px;
  font-size: 24px;
  line-height: 1.5;
  overflow: auto;
  max-width: 100%;
}
.slide pre code { background: none; padding: 0; font-size: inherit; }
.slide img { max-width: 100%; height: auto; }
.slide blockquote {
  border-left: 8px solid var(--zilliz-blue);
  padding-left: var(--zilliz-s-4);
  margin: 0 0 var(--zilliz-s-4);
  font-size: 36px;
  font-style: italic;
  color: var(--zilliz-navy);
}

/* .title — opening slide: gradient background, white text */
.slide.title {
  background: var(--zilliz-gradient);
  color: var(--zilliz-white);
  justify-content: flex-end;
}
.slide.title h1 { font-size: 120px; font-weight: 600; line-height: 1.0; }
.slide.title h2 { font-size: 48px; font-weight: 400; opacity: 0.92; margin-bottom: var(--zilliz-s-8); }
.slide.title p { font-size: 32px; font-weight: 400; opacity: 0.85; }
.slide.title .logo {
  position: absolute;
  top: var(--zilliz-s-12);
  left: var(--zilliz-s-16);
  width: 280px;
  color: var(--zilliz-white);
}

/* .section — divider: light gradient, oversized number, section name */
.slide.section {
  background: var(--zilliz-gradient-light);
  color: var(--zilliz-black);
  justify-content: space-between;
}
.slide.section h1 {
  font-size: 480px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.04em;
}
.slide.section h2 {
  align-self: flex-end;
  font-size: 96px;
  font-weight: 400;
  margin: 0;
}

/* .hero — full-bleed statement: dark gradient, large white text */
.slide.hero {
  background: var(--zilliz-gradient-dark);
  color: var(--zilliz-white);
  justify-content: center;
  align-items: flex-start;
}
.slide.hero h1 {
  font-size: 144px;
  font-weight: 600;
  line-height: 1.05;
  max-width: 80%;
}
.slide.hero p {
  font-size: 40px;
  font-weight: 400;
  opacity: 0.85;
  max-width: 70%;
  margin-top: var(--zilliz-s-6);
}

/* Modifier: .center — horizontally and vertically center content */
.slide.center {
  align-items: center;
  text-align: center;
  justify-content: center;
}

/* Modifier: .dark — invert default content slide to dark on navy */
.slide.dark {
  background: var(--zilliz-navy);
  color: var(--zilliz-white);
}
.slide.dark a { color: var(--zilliz-sky); }
.slide.dark code, .slide.dark pre {
  background: rgba(255, 255, 255, 0.08);
  color: var(--zilliz-white);
}
```

- [ ] **Step 2: Commit**

```bash
git add css/layouts.css
git commit -m "feat(css): add title, section, hero, and content layouts"
```

---

## Task 5: Brand SVG assets

**Files:**
- Create: `img/zilliz-spark.svg`
- Create: `img/zilliz-logo.svg`
- Create: `img/zilliz-logo-white.svg`

**Note:** The official spark mark uses a specific geometric construction (12 lines at brand-defined angles and lengths) that lives in `brand_assets/logos/Zilliz Logo/ai files/`. The SVGs below are a clean approximation good enough to bootstrap the framework. Replace them with exports from the official artwork when convenient — drop-in compatible because they share the same filenames and `viewBox`.

- [ ] **Step 1: Write `img/zilliz-spark.svg`** (geometric placeholder, currentColor-aware)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round">
  <!-- 12 rays at every 30°, varying lengths approximate the brand spark -->
  <line x1="50" y1="50" x2="50" y2="6"/>
  <line x1="50" y1="50" x2="72" y2="14"/>
  <line x1="50" y1="50" x2="88" y2="34"/>
  <line x1="50" y1="50" x2="94" y2="50"/>
  <line x1="50" y1="50" x2="86" y2="68"/>
  <line x1="50" y1="50" x2="68" y2="84"/>
  <line x1="50" y1="50" x2="50" y2="94"/>
  <line x1="50" y1="50" x2="32" y2="86"/>
  <line x1="50" y1="50" x2="14" y2="72"/>
  <line x1="50" y1="50" x2="6" y2="50"/>
  <line x1="50" y1="50" x2="14" y2="32"/>
  <line x1="50" y1="50" x2="32" y2="14"/>
</svg>
```

- [ ] **Step 2: Write `img/zilliz-logo.svg`** (spark + "zilliz" wordmark, black)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 100" fill="none">
  <g stroke="#000000" stroke-width="6" stroke-linecap="round">
    <line x1="50" y1="50" x2="50" y2="6"/>
    <line x1="50" y1="50" x2="72" y2="14"/>
    <line x1="50" y1="50" x2="88" y2="34"/>
    <line x1="50" y1="50" x2="94" y2="50"/>
    <line x1="50" y1="50" x2="86" y2="68"/>
    <line x1="50" y1="50" x2="68" y2="84"/>
    <line x1="50" y1="50" x2="50" y2="94"/>
    <line x1="50" y1="50" x2="32" y2="86"/>
    <line x1="50" y1="50" x2="14" y2="72"/>
    <line x1="50" y1="50" x2="6" y2="50"/>
    <line x1="50" y1="50" x2="14" y2="32"/>
    <line x1="50" y1="50" x2="32" y2="14"/>
  </g>
  <text x="120" y="78" font-family="Inter, system-ui, sans-serif" font-size="78" font-weight="500" fill="#000000" letter-spacing="-1">zilliz</text>
</svg>
```

- [ ] **Step 3: Write `img/zilliz-logo-white.svg`** (spark + wordmark, white)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 100" fill="none">
  <g stroke="#ffffff" stroke-width="6" stroke-linecap="round">
    <line x1="50" y1="50" x2="50" y2="6"/>
    <line x1="50" y1="50" x2="72" y2="14"/>
    <line x1="50" y1="50" x2="88" y2="34"/>
    <line x1="50" y1="50" x2="94" y2="50"/>
    <line x1="50" y1="50" x2="86" y2="68"/>
    <line x1="50" y1="50" x2="68" y2="84"/>
    <line x1="50" y1="50" x2="50" y2="94"/>
    <line x1="50" y1="50" x2="32" y2="86"/>
    <line x1="50" y1="50" x2="14" y2="72"/>
    <line x1="50" y1="50" x2="6" y2="50"/>
    <line x1="50" y1="50" x2="14" y2="32"/>
    <line x1="50" y1="50" x2="32" y2="14"/>
  </g>
  <text x="120" y="78" font-family="Inter, system-ui, sans-serif" font-size="78" font-weight="500" fill="#ffffff" letter-spacing="-1">zilliz</text>
</svg>
```

- [ ] **Step 4: Commit**

```bash
git add img/zilliz-spark.svg img/zilliz-logo.svg img/zilliz-logo-white.svg
git commit -m "feat(img): add spark mark and logo SVGs"
```

---

## Task 6: HTML template

**Files:**
- Create: `templates/deck.html`

- [ ] **Step 1: Write `templates/deck.html`**

The template is rendered by `build.js`. It contains two placeholders, `{{title}}` and `{{slides}}`, replaced at build time. Asset URLs (`{{cssDir}}`, `{{scriptDir}}`) are also placeholders so the same template works whether the output sits at `talks/<slug>/dist/index.html` (deep) or elsewhere.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{{cssDir}}/tokens.css">
  <link rel="stylesheet" href="{{cssDir}}/deck.css">
  <link rel="stylesheet" href="{{cssDir}}/layouts.css">
</head>
<body>
  <div class="deck-viewport">
    <div class="deck">
{{slides}}
    </div>
  </div>
  <script src="{{scriptDir}}/deck.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add templates/deck.html
git commit -m "feat(templates): add deck HTML shell with placeholders"
```

---

## Task 7: build.js — slide splitter (TDD)

**Files:**
- Create: `bin/build.js`
- Create: `test/build.test.js`

Goal: a pure function `splitSlides(md)` that returns an array of slide chunks split on lines containing exactly `---`, while ignoring `---` inside fenced code blocks (\`\`\` or `~~~`).

- [ ] **Step 1: Write the failing tests**

Create `test/build.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSlides } from '../bin/build.js';

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
```

- [ ] **Step 2: Run tests — expect failure (file does not exist yet)**

Run: `npm test`
Expected: FAIL with `Cannot find module '../bin/build.js'` or similar.

- [ ] **Step 3: Implement `splitSlides` in `bin/build.js`**

Create `bin/build.js`:

```js
// bin/build.js — Pipeline 1: md → HTML

export function splitSlides(md) {
  const lines = md.split('\n');
  const chunks = [];
  let current = [];
  let inFence = false;
  let fenceMarker = '';

  for (const line of lines) {
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceMatch[1];
      } else if (line.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = '';
      }
      current.push(line);
      continue;
    }
    if (!inFence && line === '---') {
      chunks.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  chunks.push(current.join('\n'));
  return chunks;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 5 tests pass, exit 0.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): add slide splitter that respects fenced code blocks"
```

---

## Task 8: build.js — attribute line parser (TDD)

**Files:**
- Modify: `bin/build.js`
- Modify: `test/build.test.js`

Goal: a pure function `parseAttrs(chunk)` that, given a slide chunk, returns `{ classes: string[], body: string }`. If the first non-blank line matches `^\{\.[\w-]+( \.[\w-]+)*\}$`, those classes are extracted and the line is removed from the body. Otherwise classes is `[]`.

- [ ] **Step 1: Add tests to `test/build.test.js`**

Append:

```js
import { parseAttrs } from '../bin/build.js';

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
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: 5 prior pass, 5 new fail with `parseAttrs is not a function` or similar.

- [ ] **Step 3: Implement `parseAttrs` in `bin/build.js`**

Append to `bin/build.js`:

```js
const ATTR_RE = /^\{(\.[\w-]+(?:\s+\.[\w-]+)*)\}\s*$/;

export function parseAttrs(chunk) {
  const lines = chunk.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return { classes: [], body: chunk };
  const m = lines[i].match(ATTR_RE);
  if (!m) return { classes: [], body: chunk };
  const classes = m[1].split(/\s+/).map(s => s.replace(/^\./, ''));
  const body = lines.slice(i + 1).join('\n');
  return { classes, body };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): parse {.classname} attribute line per slide"
```

---

## Task 9: build.js — slug + title extraction (TDD)

**Files:**
- Modify: `bin/build.js`
- Modify: `test/build.test.js`

Goal: `slugify(text)` and `extractTitle(htmlOrMd)` pure functions. `slugify` lowercases, strips non-alphanumerics (keeps hyphens), collapses whitespace to `-`, and truncates to 60 chars. `extractTitle` finds the first `<h1>` or `<h2>` in rendered HTML and returns its text content; returns `null` when none.

- [ ] **Step 1: Add tests to `test/build.test.js`**

Append:

```js
import { slugify, extractTitle } from '../bin/build.js';

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
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: prior pass, 8 new fail.

- [ ] **Step 3: Implement `slugify` and `extractTitle` in `bin/build.js`**

Append to `bin/build.js`:

```js
export function slugify(text) {
  const s = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return s || 'slide';
}

export function extractTitle(html) {
  const m = html.match(/<(h1|h2)[^>]*>([\s\S]*?)<\/\1>/i);
  if (!m) return null;
  return m[2].replace(/<[^>]+>/g, '').trim();
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 18 tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): add slugify and title extraction helpers"
```

---

## Task 10: build.js — render single slide (TDD)

**Files:**
- Modify: `bin/build.js`
- Modify: `test/build.test.js`

Goal: `renderSlide({ chunk, index, total })` returns the full `<section>` HTML for one slide, including the auto-injected `<footer class="chrome">` (suppressed when class `no-chrome` is present).

- [ ] **Step 1: Add tests to `test/build.test.js`**

Append:

```js
import { renderSlide } from '../bin/build.js';

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

test('renderSlide: appends chrome footer with N / total', () => {
  const html = renderSlide({ chunk: '# A', index: 4, total: 9 });
  assert.match(html, /<footer class="chrome">[\s\S]*4 \/ 9[\s\S]*<\/footer>/);
});

test('renderSlide: omits chrome when no-chrome class set', () => {
  const html = renderSlide({ chunk: '{.title .no-chrome}\n# X', index: 1, total: 5 });
  assert.doesNotMatch(html, /<footer class="chrome">/);
});

test('renderSlide: id falls back to "slide" slug when no heading', () => {
  const html = renderSlide({ chunk: 'Just body text.', index: 7, total: 10 });
  assert.match(html, /id="7-slide"/);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: prior pass, 5 new fail.

- [ ] **Step 3: Implement `renderSlide` in `bin/build.js`**

Append to `bin/build.js`:

```js
import { marked } from 'marked';

const SPARK_INLINE = '<svg class="mark" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"><line x1="50" y1="50" x2="50" y2="6"/><line x1="50" y1="50" x2="72" y2="14"/><line x1="50" y1="50" x2="88" y2="34"/><line x1="50" y1="50" x2="94" y2="50"/><line x1="50" y1="50" x2="86" y2="68"/><line x1="50" y1="50" x2="68" y2="84"/><line x1="50" y1="50" x2="50" y2="94"/><line x1="50" y1="50" x2="32" y2="86"/><line x1="50" y1="50" x2="14" y2="72"/><line x1="50" y1="50" x2="6" y2="50"/><line x1="50" y1="50" x2="14" y2="32"/><line x1="50" y1="50" x2="32" y2="14"/></svg>';

export function renderSlide({ chunk, index, total }) {
  const { classes, body } = parseAttrs(chunk);
  const html = marked.parse(body);
  const slug = slugify(extractTitle(html) || '');
  const classList = ['slide', ...classes].join(' ');
  const noChrome = classes.includes('no-chrome');
  const chrome = noChrome
    ? ''
    : `<footer class="chrome"><span class="page">${index} / ${total}</span>${SPARK_INLINE}</footer>`;
  return `<section id="${index}-${slug}" class="${classList}" data-index="${index}">\n${html}\n${chrome}\n</section>`;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 23 tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/build.js test/build.test.js
git commit -m "feat(build): render single slide with auto chrome footer"
```

---

## Task 11: build.js — CLI wiring

**Files:**
- Modify: `bin/build.js`

Goal: when the file is run as a script (`node bin/build.js talks/<slug>`), read `slides.md`, render every slide, fill the template, and write `talks/<slug>/dist/index.html`. The pure functions stay exported for tests.

- [ ] **Step 1: Append CLI block to `bin/build.js`**

Add at the bottom:

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildDeck(talkDir) {
  const mdPath = resolve(talkDir, 'slides.md');
  const md = readFileSync(mdPath, 'utf8');
  const chunks = splitSlides(md);
  const total = chunks.length;
  const sections = chunks.map((chunk, i) =>
    renderSlide({ chunk, index: i + 1, total })
  );

  const templatePath = fileURLToPath(new URL('../templates/deck.html', import.meta.url));
  const template = readFileSync(templatePath, 'utf8');

  // First slide's title becomes the document <title>; fall back to talk folder name.
  const firstHtml = marked.parse(parseAttrs(chunks[0] || '').body);
  const deckTitle = extractTitle(firstHtml) || basename(talkDir);

  // dist sits 3 levels deep (talks/<slug>/dist/index.html) → ../../../ to repo root.
  const html = template
    .replaceAll('{{title}}', deckTitle)
    .replaceAll('{{cssDir}}', '../../../css')
    .replaceAll('{{scriptDir}}', '../../../script')
    .replace('{{slides}}', sections.join('\n'));

  const distDir = resolve(talkDir, 'dist');
  mkdirSync(distDir, { recursive: true });
  const outPath = resolve(distDir, 'index.html');
  writeFileSync(outPath, html);
  return outPath;
}

// Run as CLI when invoked directly: node bin/build.js <talkDir>
if (import.meta.url === `file://${process.argv[1]}`) {
  const talkDir = process.argv[2];
  if (!talkDir) {
    console.error('usage: node bin/build.js <talk-dir>');
    process.exit(2);
  }
  const out = buildDeck(resolve(talkDir));
  console.log(`built ${out}`);
}
```

- [ ] **Step 2: Run tests — confirm nothing broke**

Run: `npm test`
Expected: 23 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add bin/build.js
git commit -m "feat(build): wire CLI entry point and full pipeline"
```

---

## Task 12: Example talk + smoke test

**Files:**
- Create: `talks/2026-05-example/slides.md`

Goal: a small end-to-end example exercising every layout. Build it and visually verify in a browser.

- [ ] **Step 1: Write `talks/2026-05-example/slides.md`**

```markdown
{.title .no-chrome}
# Bootstrap Deck
## A minimal Zilliz presentation
Simon Hearne — May 2026

---

{.section}
# 01
## Why this exists

---

# What we get

- Markdown in, HTML out
- One brand-aligned design system
- Print-clean PDF export
- Single-file bundle for sharing

---

# Code looks like this

```js
const greet = (name) => `Hello, ${name}!`;
console.log(greet('Milvus'));
```

> Vector databases are the moat for AI applications.

---

{.hero .no-chrome}
# Memory is the moat.

---

{.section}
# 02
## The end
```

- [ ] **Step 2: Run the build**

Run: `npm run build talks/2026-05-example`
Expected: prints `built /…/talks/2026-05-example/dist/index.html`. Exit 0.

- [ ] **Step 3: Verify the output exists and looks valid**

Run: `head -20 talks/2026-05-example/dist/index.html`
Expected: shows `<!doctype html>`, `<title>Bootstrap Deck</title>`, and `<link rel="stylesheet" href="../../../css/tokens.css">`.

Run: `grep -c '<section' talks/2026-05-example/dist/index.html`
Expected: `6` (one per slide).

- [ ] **Step 4: Manual browser check**

Open the file in your browser:

```bash
open talks/2026-05-example/dist/index.html
```

You'll see only the first slide (`.title`), since `deck.js` doesn't exist yet — the runtime will be added in Task 13. Verify:
- Inter font loaded (no fallback Times-style serif).
- Title slide shows the gradient background and white text.
- No console errors except `deck.js` 404 (expected — fixed next task).

- [ ] **Step 5: Commit**

```bash
git add talks/2026-05-example/slides.md
git commit -m "feat(talks): add example deck exercising every layout"
```

---

## Task 13: Runtime — `script/deck.js`

**Files:**
- Create: `script/deck.js`

Goal: scale-to-fit, keyboard nav, hash deeplinks. ~80 lines, no dependencies.

- [ ] **Step 1: Write `script/deck.js`**

```js
// script/deck.js — runtime for scale, keyboard nav, hash deeplinks
(() => {
  const SLIDE_W = 1920;
  const SLIDE_H = 1080;

  const deck = document.querySelector('.deck');
  const slides = Array.from(document.querySelectorAll('.slide'));
  if (!deck || slides.length === 0) return;

  let current = 0;

  function fit() {
    const scale = Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H);
    deck.style.transform = `scale(${scale})`;
  }

  function show(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, n) => s.classList.toggle('is-current', n === current));
    const slide = slides[current];
    const id = slide.id || String(current + 1);
    if (location.hash !== `#${id}`) {
      history.replaceState(null, '', `#${id}`);
    }
  }

  function fromHash() {
    const m = location.hash.match(/^#(\d+)/);
    if (!m) return 0;
    const n = parseInt(m[1], 10) - 1;
    return Number.isInteger(n) && n >= 0 && n < slides.length ? n : 0;
  }

  function onKey(e) {
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        show(current + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        show(current - 1);
        break;
      case 'Home':
        e.preventDefault();
        show(0);
        break;
      case 'End':
        e.preventDefault();
        show(slides.length - 1);
        break;
    }
  }

  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => show(fromHash()));
  document.addEventListener('keydown', onKey);

  fit();
  show(fromHash());
})();
```

- [ ] **Step 2: Manual browser check**

Refresh `talks/2026-05-example/dist/index.html`. Verify:
- Slide auto-fits the window; resizing the window keeps it filling proportionally.
- Right arrow / space advances; left arrow goes back.
- URL hash updates to `#1-bootstrap-deck`, `#2-01`, etc. as you navigate.
- Pasting `…/dist/index.html#5-memory-is-the-moat` jumps directly to the hero slide.
- DevTools console shows no errors.

- [ ] **Step 3: Commit**

```bash
git add script/deck.js
git commit -m "feat(script): add runtime for scale, nav, and hash deeplinks"
```

---

## Task 14: bundle.js — inline relative `<link>` and `<script>` (TDD)

**Files:**
- Create: `bin/bundle.js`
- Create: `test/bundle.test.js`

Goal: pure function `inlineLocalAssets(html, fileLookup)` that replaces `<link rel="stylesheet" href="relative">` with `<style>...</style>` and `<script src="relative">` with `<script>...</script>`. The lookup is a function `(href) => string | null` so tests can pass a stub instead of touching disk.

- [ ] **Step 1: Write tests in `test/bundle.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineLocalAssets } from '../bin/bundle.js';

const lookup = (href) => {
  const map = {
    '../../../css/tokens.css': ':root { --x: 1; }',
    '../../../css/deck.css': '.deck {}',
    '../../../css/layouts.css': '.slide {}',
    '../../../script/deck.js': 'console.log("hi");',
  };
  return map[href] ?? null;
};

test('inlineLocalAssets: inlines relative <link> stylesheets', () => {
  const html = '<link rel="stylesheet" href="../../../css/tokens.css">';
  const out = inlineLocalAssets(html, lookup);
  assert.match(out, /<style>:root \{ --x: 1; \}<\/style>/);
  assert.doesNotMatch(out, /<link rel="stylesheet" href=/);
});

test('inlineLocalAssets: inlines relative <script src>', () => {
  const html = '<script src="../../../script/deck.js"></script>';
  const out = inlineLocalAssets(html, lookup);
  assert.match(out, /<script>console\.log\("hi"\);<\/script>/);
});

test('inlineLocalAssets: leaves https <link> alone', () => {
  const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?x">';
  const out = inlineLocalAssets(html, lookup);
  assert.equal(out, html);
});

test('inlineLocalAssets: leaves https <script> alone', () => {
  const html = '<script src="https://example.com/x.js"></script>';
  const out = inlineLocalAssets(html, lookup);
  assert.equal(out, html);
});

test('inlineLocalAssets: leaves unknown relative paths alone', () => {
  const html = '<link rel="stylesheet" href="../../../css/missing.css">';
  const out = inlineLocalAssets(html, lookup);
  assert.equal(out, html);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: prior pass, 5 new fail (`Cannot find module '../bin/bundle.js'`).

- [ ] **Step 3: Implement in `bin/bundle.js`**

```js
// bin/bundle.js — Pipeline 2: HTML + assets → single HTML

const LINK_RE = /<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g;
const SCRIPT_RE = /<script\s+src="([^"]+)"><\/script>/g;

function isRelative(href) {
  return !/^(https?:)?\/\//.test(href) && !href.startsWith('data:');
}

export function inlineLocalAssets(html, lookup) {
  let out = html.replace(LINK_RE, (match, href) => {
    if (!isRelative(href)) return match;
    const css = lookup(href);
    return css == null ? match : `<style>${css}</style>`;
  });
  out = out.replace(SCRIPT_RE, (match, src) => {
    if (!isRelative(src)) return match;
    const js = lookup(src);
    return js == null ? match : `<script>${js}</script>`;
  });
  return out;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 28 tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/bundle.js test/bundle.test.js
git commit -m "feat(bundle): inline relative stylesheet and script references"
```

---

## Task 15: bundle.js — inline Google Fonts (TDD)

**Files:**
- Modify: `bin/bundle.js`
- Modify: `test/bundle.test.js`

Goal: function `inlineGoogleFonts(html, fetchFn)` that replaces a Google Fonts `<link>` with a `<style>` block whose `@font-face src: url(...)` URLs are replaced with base64 data URIs. `fetchFn` is injected so tests don't hit the network.

- [ ] **Step 1: Write tests**

Append to `test/bundle.test.js`:

```js
import { inlineGoogleFonts } from '../bin/bundle.js';

const stubFetch = (urlMap) => async (url) => {
  if (!(url in urlMap)) throw new Error(`unexpected url ${url}`);
  const v = urlMap[url];
  return {
    ok: true,
    text: async () => typeof v === 'string' ? v : '',
    arrayBuffer: async () => v instanceof Uint8Array ? v.buffer : new ArrayBuffer(0),
  };
};

test('inlineGoogleFonts: replaces <link> with inlined @font-face data URIs', async () => {
  const css = `@font-face { font-family: 'Inter'; src: url(https://fonts.gstatic.com/s/inter/x.woff2) format('woff2'); }`;
  const woff = new Uint8Array([1, 2, 3, 4]);
  const fetchFn = stubFetch({
    'https://fonts.googleapis.com/css2?family=Inter': css,
    'https://fonts.gstatic.com/s/inter/x.woff2': woff,
  });
  const html = '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">';
  const out = await inlineGoogleFonts(html, fetchFn);
  assert.match(out, /<style>[\s\S]*data:font\/woff2;base64,AQIDBA==[\s\S]*<\/style>/);
  assert.doesNotMatch(out, /<link[^>]+fonts\.googleapis\.com/);
});

test('inlineGoogleFonts: no-op when no Google Fonts link present', async () => {
  const html = '<link rel="stylesheet" href="local.css">';
  const out = await inlineGoogleFonts(html, stubFetch({}));
  assert.equal(out, html);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: prior pass, 2 new fail.

- [ ] **Step 3: Implement in `bin/bundle.js`**

Append:

```js
const GFONTS_LINK_RE = /<link\s+(?:[^>]*?\s+)?href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"[^>]*>/g;
const GSTATIC_URL_RE = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g;

async function fetchText(fetchFn, url) {
  const r = await fetchFn(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`fetch failed ${url}: ${r.status}`);
  return r.text();
}

async function fetchBase64(fetchFn, url) {
  const r = await fetchFn(url);
  if (!r.ok) throw new Error(`fetch failed ${url}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.toString('base64');
}

export async function inlineGoogleFonts(html, fetchFn) {
  const matches = [...html.matchAll(GFONTS_LINK_RE)];
  if (matches.length === 0) return html;
  let out = html;
  for (const m of matches) {
    const url = m[1];
    let css = await fetchText(fetchFn, url);
    const fontUrls = [...css.matchAll(GSTATIC_URL_RE)].map(x => x[1]);
    for (const fontUrl of new Set(fontUrls)) {
      const b64 = await fetchBase64(fetchFn, fontUrl);
      const dataUri = `data:font/woff2;base64,${b64}`;
      css = css.split(fontUrl).join(dataUri);
    }
    out = out.replace(m[0], `<style>${css}</style>`);
  }
  return out;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 30 tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/bundle.js test/bundle.test.js
git commit -m "feat(bundle): inline Google Fonts CSS and woff2 as data URIs"
```

---

## Task 16: bundle.js — inline SVG `<img>` (TDD)

**Files:**
- Modify: `bin/bundle.js`
- Modify: `test/bundle.test.js`

Goal: `inlineSvgImages(html, lookup)` replaces every `<img src="*.svg" ...>` whose path the lookup resolves with the file's root `<svg>` element, transferring the `<img>`'s `class` and `id` attributes onto the resulting `<svg>`.

- [ ] **Step 1: Write tests**

Append to `test/bundle.test.js`:

```js
import { inlineSvgImages } from '../bin/bundle.js';

const svgLookup = (path) => {
  const map = {
    '../../../img/zilliz-spark.svg': '<svg viewBox="0 0 100 100"><line x1="0" y1="0" x2="10" y2="10"/></svg>',
  };
  return map[path] ?? null;
};

test('inlineSvgImages: replaces img with inline svg', () => {
  const html = '<img src="../../../img/zilliz-spark.svg">';
  const out = inlineSvgImages(html, svgLookup);
  assert.match(out, /<svg viewBox="0 0 100 100"/);
  assert.doesNotMatch(out, /<img/);
});

test('inlineSvgImages: transfers class onto inlined svg', () => {
  const html = '<img class="logo big" src="../../../img/zilliz-spark.svg">';
  const out = inlineSvgImages(html, svgLookup);
  assert.match(out, /<svg[^>]+class="logo big"[^>]+viewBox=/);
});

test('inlineSvgImages: transfers id onto inlined svg', () => {
  const html = '<img id="x" src="../../../img/zilliz-spark.svg">';
  const out = inlineSvgImages(html, svgLookup);
  assert.match(out, /<svg[^>]+id="x"/);
});

test('inlineSvgImages: leaves unknown svg paths alone', () => {
  const html = '<img src="../../../img/missing.svg">';
  const out = inlineSvgImages(html, svgLookup);
  assert.equal(out, html);
});

test('inlineSvgImages: ignores non-svg images', () => {
  const html = '<img src="cat.png">';
  const out = inlineSvgImages(html, svgLookup);
  assert.equal(out, html);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: prior pass, 5 new fail.

- [ ] **Step 3: Implement in `bin/bundle.js`**

Append:

```js
const IMG_SVG_RE = /<img\b([^>]*?)\bsrc="([^"]+\.svg)"([^>]*)>/g;

function getAttr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

export function inlineSvgImages(html, lookup) {
  return html.replace(IMG_SVG_RE, (match, before, src, after) => {
    if (!isRelative(src)) return match;
    const svg = lookup(src);
    if (svg == null) return match;
    const attrs = before + after;
    const cls = getAttr(attrs, 'class');
    const id = getAttr(attrs, 'id');
    let out = svg.replace(/<svg\b([^>]*)>/i, (_m, svgAttrs) => {
      let a = svgAttrs;
      if (cls && !/\bclass=/i.test(a)) a += ` class="${cls}"`;
      if (id && !/\bid=/i.test(a)) a += ` id="${id}"`;
      return `<svg${a}>`;
    });
    return out;
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 35 tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/bundle.js test/bundle.test.js
git commit -m "feat(bundle): inline SVG <img> with class/id transfer"
```

---

## Task 17: bundle.js — inline raster images and CSS `url(...)` (TDD)

**Files:**
- Modify: `bin/bundle.js`
- Modify: `test/bundle.test.js`

Goal: two functions.
- `inlineRasterImages(html, lookup, { skip })` — replaces `<img src="*.png|jpg|jpeg|webp">` with a base64 data URI; no-op when `skip` is true.
- `inlineCssUrls(html, lookup, { skipRaster })` — inside every `<style>` block, rewrite `url(...)` references: SVG → URL-encoded `data:image/svg+xml;utf8,...`, raster → base64 data URI (skipped when `skipRaster`).

- [ ] **Step 1: Write tests**

Append to `test/bundle.test.js`:

```js
import { inlineRasterImages, inlineCssUrls } from '../bin/bundle.js';

const rasterLookup = (path) => {
  const map = {
    '../../../img/photo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    '../../../img/photo.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
  };
  return map[path] ?? null;
};

test('inlineRasterImages: replaces img with base64 data URI', () => {
  const html = '<img src="../../../img/photo.png">';
  const out = inlineRasterImages(html, rasterLookup, { skip: false });
  assert.match(out, /src="data:image\/png;base64,iVBORw==/);
});

test('inlineRasterImages: picks correct mime for jpg', () => {
  const html = '<img src="../../../img/photo.jpg">';
  const out = inlineRasterImages(html, rasterLookup, { skip: false });
  assert.match(out, /src="data:image\/jpeg;base64,/);
});

test('inlineRasterImages: skip=true is a no-op', () => {
  const html = '<img src="../../../img/photo.png">';
  const out = inlineRasterImages(html, rasterLookup, { skip: true });
  assert.equal(out, html);
});

test('inlineRasterImages: leaves svg paths alone', () => {
  const html = '<img src="../../../img/x.svg">';
  const out = inlineRasterImages(html, rasterLookup, { skip: false });
  assert.equal(out, html);
});

const cssLookup = (path) => {
  const map = {
    '../../../img/bg.svg': '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    '../../../img/photo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  };
  return map[path] ?? null;
};

test('inlineCssUrls: rewrites svg url() to data:image/svg+xml;utf8,', () => {
  const html = '<style>.x { background: url(../../../img/bg.svg); }</style>';
  const out = inlineCssUrls(html, cssLookup, { skipRaster: false });
  assert.match(out, /url\("data:image\/svg\+xml;utf8,/);
  assert.match(out, /%3Csvg/);
});

test('inlineCssUrls: rewrites raster url() to base64', () => {
  const html = '<style>.x { background: url(../../../img/photo.png); }</style>';
  const out = inlineCssUrls(html, cssLookup, { skipRaster: false });
  assert.match(out, /url\("data:image\/png;base64,/);
});

test('inlineCssUrls: skipRaster keeps raster url() unchanged', () => {
  const html = '<style>.x { background: url(../../../img/photo.png); }</style>';
  const out = inlineCssUrls(html, cssLookup, { skipRaster: true });
  assert.equal(out, html);
});

test('inlineCssUrls: rewrites svg even when skipRaster=true', () => {
  const html = '<style>.x { background: url(../../../img/bg.svg); }</style>';
  const out = inlineCssUrls(html, cssLookup, { skipRaster: true });
  assert.match(out, /data:image\/svg\+xml;utf8,/);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: prior pass, 8 new fail.

- [ ] **Step 3: Implement in `bin/bundle.js`**

Append:

```js
const IMG_RASTER_RE = /<img\b([^>]*?)\bsrc="([^"]+\.(?:png|jpe?g|webp))"([^>]*)>/gi;
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/g;

function rasterMime(path) {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

export function inlineRasterImages(html, lookup, { skip } = { skip: false }) {
  if (skip) return html;
  return html.replace(IMG_RASTER_RE, (match, before, src, after) => {
    if (!isRelative(src)) return match;
    const bytes = lookup(src);
    if (bytes == null) return match;
    const dataUri = `data:${rasterMime(src)};base64,${bytesToBase64(bytes)}`;
    return `<img${before}src="${dataUri}"${after}>`;
  });
}

export function inlineCssUrls(html, lookup, { skipRaster } = { skipRaster: false }) {
  return html.replace(STYLE_BLOCK_RE, (block, css) => {
    const rewritten = css.replace(CSS_URL_RE, (m, q, ref) => {
      if (!isRelative(ref)) return m;
      const isSvg = ref.toLowerCase().endsWith('.svg');
      const isRaster = /\.(png|jpe?g|webp)$/i.test(ref);
      const value = lookup(ref);
      if (value == null) return m;
      if (isSvg) {
        const encoded = encodeURIComponent(value).replace(/'/g, '%27');
        return `url("data:image/svg+xml;utf8,${encoded}")`;
      }
      if (isRaster) {
        if (skipRaster) return m;
        return `url("data:${rasterMime(ref)};base64,${bytesToBase64(value)}")`;
      }
      return m;
    });
    return block.replace(css, rewritten);
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 43 tests pass.

- [ ] **Step 5: Commit**

```bash
git add bin/bundle.js test/bundle.test.js
git commit -m "feat(bundle): inline raster images and CSS url() refs"
```

---

## Task 18: bundle.js — CLI wiring + integration smoke

**Files:**
- Modify: `bin/bundle.js`

Goal: a `bundleDeck(talkDir, { noImages })` function that orchestrates all inlining steps from the previous tasks against the real filesystem, and a CLI entry point.

- [ ] **Step 1: Append CLI orchestration to `bin/bundle.js`**

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

function makeFsLookup(htmlPath) {
  const baseDir = dirname(htmlPath);
  return (relPath, { binary = false } = {}) => {
    try {
      const abs = resolve(baseDir, relPath);
      return binary ? readFileSync(abs) : readFileSync(abs, 'utf8');
    } catch {
      return null;
    }
  };
}

export async function bundleDeck(talkDir, { noImages = false, fetchFn = fetch } = {}) {
  const htmlPath = resolve(talkDir, 'dist', 'index.html');
  let html = readFileSync(htmlPath, 'utf8');

  const textLookup = makeFsLookup(htmlPath);
  const binaryLookup = (rel) => textLookup(rel, { binary: true });

  // Order matters: fonts first (they introduce a new <style> block), then text,
  // then SVG images (they introduce inline <svg>), then raster, then CSS urls
  // inside any <style> block we now have.
  html = await inlineGoogleFonts(html, fetchFn);
  html = inlineLocalAssets(html, textLookup);
  html = inlineSvgImages(html, textLookup);
  html = inlineRasterImages(html, binaryLookup, { skip: noImages });
  html = inlineCssUrls(html, (rel) => {
    if (rel.toLowerCase().endsWith('.svg')) return textLookup(rel);
    return binaryLookup(rel);
  }, { skipRaster: noImages });

  const outPath = resolve(talkDir, 'dist', 'bundle.html');
  writeFileSync(outPath, html);
  return outPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const noImages = args.includes('--no-images');
  const talkDir = args.find(a => !a.startsWith('--'));
  if (!talkDir) {
    console.error('usage: node bin/bundle.js <talk-dir> [--no-images]');
    process.exit(2);
  }
  bundleDeck(resolve(talkDir), { noImages }).then(out => {
    console.log(`bundled ${out}`);
  }).catch(err => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Verify unit tests still pass**

Run: `npm test`
Expected: 43 tests pass.

- [ ] **Step 3: Integration smoke — bundle the example talk**

Run: `npm run bundle talks/2026-05-example`
Expected: prints `bundled /…/talks/2026-05-example/dist/bundle.html`. Exit 0. Network access is required for the Google Fonts fetch.

- [ ] **Step 4: Verify the bundle is self-contained**

Run: `grep -c '<link rel="stylesheet"' talks/2026-05-example/dist/bundle.html`
Expected: `0` — no remaining `<link>` stylesheets.

Run: `grep -c 'data:font/woff2' talks/2026-05-example/dist/bundle.html`
Expected: at least `1` — fonts inlined.

Run: `grep -c '<script src=' talks/2026-05-example/dist/bundle.html`
Expected: `0` — no remaining external scripts.

- [ ] **Step 5: Manual browser check**

```bash
open talks/2026-05-example/dist/bundle.html
```

Disable network in DevTools → Network → "Offline", then refresh. The deck still renders, fonts still load (because they're inlined), and navigation still works.

- [ ] **Step 6: Spot-check `--no-images` flag**

Run: `npm run bundle talks/2026-05-example -- --no-images`
Expected: succeeds. The example deck has no raster images so the output should be identical in size to the default bundle modulo a few bytes — but the flag path is exercised.

- [ ] **Step 7: Commit**

```bash
git add bin/bundle.js
git commit -m "feat(bundle): orchestrate inlining and add CLI entry point"
```

---

## Task 19: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Zilliz Presentations

Minimal Markdown-to-HTML presentation framework, brand-aligned with Zilliz.

## Quick start

```bash
npm install                                   # one dep: marked
npm run build talks/2026-05-example           # → talks/2026-05-example/dist/index.html
npm run bundle talks/2026-05-example          # → talks/2026-05-example/dist/bundle.html
```

Open the HTML in any browser. Right arrow / space advances; URL hash deeplinks to a specific slide.

## Authoring a new talk

```
talks/<slug>/
├── slides.md          # your deck
└── img/               # optional, talk-specific images
```

Slides are separated by lines containing exactly `---`. The first non-blank
line of a slide may be an attribute block — `{.classname .modifier}` — to
apply slide layout classes. Available layouts:

| Class | Use |
|---|---|
| (none) | Content slide: white bg, black text, headings + body |
| `.title` | Opening title slide: gradient background, white text |
| `.section` | Divider between sections: oversized number + name |
| `.hero` | Full-bleed statement: dark gradient with one big claim |
| `.center` (modifier) | Centers content horizontally and vertically |
| `.dark` (modifier) | Inverts default content slide to white-on-navy |
| `.no-chrome` (modifier) | Hides the bottom-right page indicator |

Example:

```markdown
{.title .no-chrome}
# My deck title
## Subtitle
Author — Date

---

{.section}
# 01
## First section

---

# Regular content

- Bullet
- Another bullet
```

## PDF export

1. Build the deck.
2. Open the resulting HTML in Chrome.
3. File → Print.
4. Set **Margins: None** and enable **Background graphics**.
5. Save as PDF. Each slide becomes one landscape page at 1920×1080.

## Bundling

`npm run bundle talks/<slug>` produces a single `bundle.html` with all CSS,
JS, fonts, and images inlined. Network is required at bundle time (for
Google Fonts). Use `-- --no-images` to skip raster images if size matters.

## Folder structure

- `bin/` — build and bundle scripts
- `css/` — shared design tokens, deck rules, layouts
- `script/` — runtime (scale, navigation, deeplinks)
- `templates/` — HTML shell with placeholders
- `img/` — shared brand SVGs (spark, logo)
- `talks/<slug>/` — your decks
- `brand_assets/`, `inspiration/` — reference only, not consumed at build

## Tests

```bash
npm test
```

Tests live in `test/` and use Node's built-in test runner.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with quick start and authoring guide"
```

---

## Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: 43 tests pass.

- [ ] **Step 2: Run a full build + bundle on the example talk**

Run: `rm -rf talks/2026-05-example/dist && npm run build talks/2026-05-example && npm run bundle talks/2026-05-example`
Expected: both commands exit 0.

- [ ] **Step 3: Open the bundle, verify it works offline**

```bash
open talks/2026-05-example/dist/bundle.html
```

In DevTools, set Network to Offline, refresh. The deck renders fully (fonts, layouts, navigation, all six slides). No console errors.

- [ ] **Step 4: Sanity-check the print path**

In Chrome, open the deck, File → Print, set Margins: None and enable Background graphics. Confirm the preview shows six landscape pages, one per slide, each filling the page edge to edge.

- [ ] **Step 5: Summary commit (if anything changed)**

If the verification surfaced a small fix, commit it. Otherwise skip.
