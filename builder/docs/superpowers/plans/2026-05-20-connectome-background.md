# Connectome Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable ambient neural-network visualisation as a shared three.js module and use it as the full-bleed background of the `vector-search-visualised` opening slide.

**Architecture:** A new three.js module `visualisations/connectome.js` renders a two-lobe neuron point cloud with kNN edges and travelling pulses. It plugs into the deck's existing `three` frontmatter pipeline (build-time inlining, conditional CDN injection) with no pipeline changes. A new `.three-bg` CSS layout class makes any `three` canvas a true background with legible text on top. Slide 2 of the deck is rewritten to use it with three stepped `{.fragment}` beats.

**Tech Stack:** three.js r128 (ES module, loaded via importmap), plain CSS, Node's built-in test runner.

---

## File Structure

| File | Responsibility |
|---|---|
| `visualisations/connectome.js` | **New.** The reusable connectome three.js module. Self-contained: scene, animation, dispose. |
| `css/layouts.css` | **Modify.** Add the `.three-bg` layout class (canvas-as-background stacking + text legibility). |
| `talks/vector-search-visualised/slides.md` | **Modify.** Rewrite slide 2 to use the connectome + stepped beats. |
| `test/build.test.js` | **Modify.** Add one regression test for parent-relative `module` paths. |
| `README.md` | **Modify.** Document the `.three-bg` class and the shared connectome component. |
| `CLAUDE.md` | **Modify.** One sentence noting `visualisations/` now also holds a shared three module. |

No `bin/build.js` changes — the `three` block, `embedThreeModules`, and importmap injection already exist.

---

### Task 1: Regression test for parent-relative module paths

The cross-deck reuse mechanism is referencing `../../visualisations/connectome.js` from a talk dir. `embedThreeModules` already handles this via `path.resolve`, but there is no test pinning it. This task adds a regression guard.

**Files:**
- Test: `test/build.test.js` (append at end of file)

- [ ] **Step 1: Write the test**

Append to the end of `test/build.test.js`:

```js
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
```

All imports used (`test`, `assert`, `embedThreeModules`, `mkdtempSync`, `mkdirSync`, `writeFileSync`, `rmSync`, `tmpdir`, `join`) are already imported at the top of `test/build.test.js` — no import changes needed.

- [ ] **Step 2: Run the test**

Run: `npm test -- --test-name-pattern="parent-relative path"`
Expected: PASS. This is a regression guard, not red-green TDD — `path.resolve(talkDir, '../../visualisations/shared.js')` already resolves correctly. The test locks the behavior so a future refactor of `embedThreeModules` cannot silently break cross-deck reuse.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass (the new test plus the existing suite).

- [ ] **Step 4: Commit**

```bash
git add test/build.test.js
git commit -m "test(build): cover parent-relative three module paths

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create the connectome component

A self-contained three.js module. No unit tests — it is a browser/WebGL module, consistent with `talks/vector-search-visualised/cloud.js` and `talks/threejs-example/embedding-lift.js`, which have none (the design spec states this explicitly). Verification is `node --check` for syntax now, and visual confirmation in Task 4.

**Files:**
- Create: `visualisations/connectome.js`

- [ ] **Step 1: Write the module**

Create `visualisations/connectome.js` with exactly this content:

```js
// visualisations/connectome.js — reusable ambient neural-network background.
//
// A two-lobe point cloud of "neurons" with kNN edges and pulses travelling
// along them, rotating slowly with depth fade. Drop into any deck via the
// `three` frontmatter block. Ambient — no advance()/retreat(), so arrow keys
// pass straight through to deck navigation.

import * as THREE from 'three';

const DEFAULTS = {
  count: 440,
  lobes: 2,
  accent: '#5b86e8',
  background: '#070d18',
  speed: 1,
};

export default function init({ canvas, opts = {} }) {
  const cfg = { ...DEFAULTS, ...opts };
  const accent = new THREE.Color(cfg.accent);
  const transparent = cfg.background === 'transparent';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  let w = canvas.clientWidth || canvas.width;
  let h = canvas.clientHeight || canvas.height;
  renderer.setSize(w, h, false);
  if (transparent) {
    renderer.setClearColor(0x000000, 0);
  } else {
    renderer.setClearColor(new THREE.Color(cfg.background), 1);
  }

  const scene = new THREE.Scene();
  if (!transparent) {
    scene.fog = new THREE.Fog(new THREE.Color(cfg.background), 6.5, 13.5);
  }

  const camera = new THREE.PerspectiveCamera(45, (w || 1) / (h || 1), 0.1, 100);
  camera.position.set(0, 0, 9);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  function ballPoint() {
    let x, y, z;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
    } while (x * x + y * y + z * z > 1);
    return { x, y, z };
  }

  // Neuron positions: one or two offset ellipsoidal lobes.
  const count = Math.max(40, cfg.count | 0);
  const twoLobes = cfg.lobes >= 2;
  const nodes = [];
  const nodePos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const side = twoLobes ? (i < count / 2 ? -1 : 1) : 0;
    const p = ballPoint();
    const x = p.x * 1.5 + side * 1.15;
    const y = p.y * 1.95;
    const z = p.z * 1.7;
    nodes.push({ x, y, z });
    nodePos[i * 3] = x;
    nodePos[i * 3 + 1] = y;
    nodePos[i * 3 + 2] = z;
  }

  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  const nodeMat = new THREE.PointsMaterial({
    color: accent,
    size: 0.13,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  group.add(new THREE.Points(nodeGeo, nodeMat));

  // kNN edges (k = 3), deduplicated.
  const K = 3;
  const seen = new Set();
  const edges = [];
  for (let i = 0; i < count; i++) {
    const near = [];
    for (let j = 0; j < count; j++) {
      if (j === i) continue;
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dz = nodes[i].z - nodes[j].z;
      near.push({ j, d: dx * dx + dy * dy + dz * dz });
    }
    near.sort((a, b) => a.d - b.d);
    for (let k = 0; k < K && k < near.length; k++) {
      const a = Math.min(i, near[k].j);
      const b = Math.max(i, near[k].j);
      const key = a + ':' + b;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([a, b]);
      }
    }
  }

  const edgePos = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => {
    edgePos[i * 6] = nodes[a].x;
    edgePos[i * 6 + 1] = nodes[a].y;
    edgePos[i * 6 + 2] = nodes[a].z;
    edgePos[i * 6 + 3] = nodes[b].x;
    edgePos[i * 6 + 4] = nodes[b].y;
    edgePos[i * 6 + 5] = nodes[b].z;
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  const edgeMat = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // Pulses travelling along random edges.
  function spawnPulse() {
    const e = edges[(Math.random() * edges.length) | 0];
    return { a: e[0], b: e[1], t: Math.random(), sp: 0.25 + Math.random() * 0.4 };
  }
  const pulseCount = reduceMotion ? 0 : Math.max(1, Math.round(edges.length * 0.06));
  const pulses = [];
  const pulsePos = new Float32Array(Math.max(1, pulseCount) * 3);
  for (let i = 0; i < pulseCount; i++) pulses.push(spawnPulse());
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  pulseGeo.setDrawRange(0, pulseCount);
  const pulseMat = new THREE.PointsMaterial({
    color: accent.clone().lerp(new THREE.Color(0xffffff), 0.55),
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  group.add(new THREE.Points(pulseGeo, pulseMat));

  function render() {
    renderer.render(scene, camera);
  }

  let raf = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    group.rotation.y += dt * 0.12 * cfg.speed;
    for (let i = 0; i < pulses.length; i++) {
      const p = pulses[i];
      p.t += dt * p.sp * cfg.speed;
      if (p.t >= 1) Object.assign(p, spawnPulse());
      const a = nodes[p.a];
      const b = nodes[p.b];
      pulsePos[i * 3] = a.x + (b.x - a.x) * p.t;
      pulsePos[i * 3 + 1] = a.y + (b.y - a.y) * p.t;
      pulsePos[i * 3 + 2] = a.z + (b.z - a.z) * p.t;
    }
    pulseGeo.attributes.position.needsUpdate = true;
    render();
    raf = requestAnimationFrame(frame);
  }

  if (reduceMotion) render();
  else raf = requestAnimationFrame(frame);

  function onResize() {
    w = canvas.clientWidth || canvas.width;
    h = canvas.clientHeight || canvas.height;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduceMotion) render();
  }
  window.addEventListener('resize', onResize);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      nodeGeo.dispose();
      edgeGeo.dispose();
      pulseGeo.dispose();
      nodeMat.dispose();
      edgeMat.dispose();
      pulseMat.dispose();
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 2: Syntax-check the module**

Run: `node --check visualisations/connectome.js`
Expected: no output, exit code 0. (`node --check` parses ESM syntax; it does not resolve the bare `three` import, so a missing CDN is irrelevant here.)

- [ ] **Step 3: Commit**

```bash
git add visualisations/connectome.js
git commit -m "feat(viz): add reusable connectome background component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add the `.three-bg` layout class

Today `.slide .three-canvas` is `position: absolute; inset: 0` with no `z-index`, so an appended canvas paints over body text. `.three-bg` drops the canvas behind the text and adds a text-shadow for legibility over bright pulses. Scoped to `.three-bg` — existing three slides (e.g. `cloud.js`) are untouched.

**Files:**
- Modify: `css/layouts.css` (insert after the `.slide .three-canvas` rule, currently lines 331–337)

- [ ] **Step 1: Add the CSS rule**

In `css/layouts.css`, find this exact block:

```css
.slide .three-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
```

Insert directly **after** it (before the `/* iframe embeds ... */` comment):

```css

/* Full-bleed three.js canvas as a slide background, text legible on top.
   Pair with .dark (light text) and .no-chrome (clean hero). */
.slide.three-bg .three-canvas { z-index: 0; }
.slide.three-bg > :not(.three-canvas) {
  position: relative;
  z-index: 1;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
}
```

- [ ] **Step 2: Commit**

```bash
git add css/layouts.css
git commit -m "feat(css): add .three-bg layout for canvas backgrounds

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rewrite the opening slide and verify the deck

Replace slide 2 of `vector-search-visualised` with the connectome background and three stepped `{.fragment}` beats, then build and verify.

**Files:**
- Modify: `talks/vector-search-visualised/slides.md` (slide 2, currently lines 17–25)

- [ ] **Step 1: Rewrite slide 2**

In `talks/vector-search-visualised/slides.md`, find this exact block:

```
# Things your brain does effortlessly

- Recognising the same face from a different angle, in different lighting
- Hearing a friend's voice in a noisy pub
- Understanding "the place I get my morning coffee" means the café down the road

Millions of years of evolution wired this in. Computers have had about seventy.

<!-- VIS: Three side-by-side panels — same face/voice/phrase shown in two superficially different forms, with a "match" line connecting them. -->
```

Replace it entirely with (note: the block below contains a ` ```three ` fenced block — copy it verbatim into `slides.md`):

````
{.three-bg .dark .no-chrome}

```three
- module: ../../visualisations/connectome.js
  id: connectome
```

You recognise a friend's voice across a crowded room — instantly, without trying. {.fragment}

Behind it: ~86 billion neurons, ~100 trillion connections, millions of years of tuning. {.fragment}

A computer starts with none of it. The rest of this talk: teaching it to match **meaning**. {.fragment}
````

The surrounding `---` slide separators (above and below) stay unchanged.

- [ ] **Step 2: Build the deck**

Run: `npm run build talks/vector-search-visualised`
Expected: build completes with no error; `talks/vector-search-visualised/dist/index.html` is written.

- [ ] **Step 3: Verify the built HTML**

Run each and confirm the expected result:

```bash
grep -c 'class="three-canvas" id="connectome"' talks/vector-search-visualised/dist/index.html
```
Expected: `1` — the connectome canvas with the explicit id.

```bash
grep -o 'class="slide[^"]*three-bg[^"]*"' talks/vector-search-visualised/dist/index.html | head -1
```
Expected: a match — the slide `<section>` carries `three-bg` (alongside `dark` and `no-chrome`).

```bash
grep -c '<p class="fragment">' talks/vector-search-visualised/dist/index.html
```
Expected: `3` or more — the three beat paragraphs got `class="fragment"` merged by `applyFragmentAttrs` (the deck may contain other fragments too; it must be at least 3).

```bash
grep -c 'type="importmap"' talks/vector-search-visualised/dist/index.html
```
Expected: `1` — three.js importmap injected (the deck already uses `three` via `cloud.js`, so this confirms nothing regressed).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass — nothing in the build pipeline changed, this is a regression check.

- [ ] **Step 5: Visual confirmation**

Run: `open talks/vector-search-visualised/dist/index.html`
Navigate to slide 2 and confirm: a dark, slowly rotating two-lobe neuron cloud with pulsing connections fills the slide; the slide enters with no beat text; pressing the right arrow reveals beat 1, then beat 2, then beat 3; a fourth right-arrow advances to slide 3. Beat text is light and legible over the visual.

If the cloud framing looks off (too large/small/clipped), adjust the constants in `visualisations/connectome.js` — `camera.position.set(0, 0, 9)`, the lobe offset `1.15`, and the scale factors `1.5 / 1.95 / 1.7` — rebuild, and re-check. Re-run Step 2 after any change.

- [ ] **Step 6: Commit**

```bash
git add talks/vector-search-visualised/slides.md visualisations/connectome.js
git commit -m "feat: connectome opener slide for vector-search-visualised

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(`visualisations/connectome.js` is included in case Step 5 required tuning. If it was untouched, `git add` simply ignores it — the commit still succeeds with just `slides.md`.)

---

### Task 5: Documentation

Document the new layout class and the shared component so other decks can reuse them. (Per the project's standing rule: README updates are part of done, not a follow-up.)

**Files:**
- Modify: `README.md` (layout-class table ~line 35; 3D-visualizations section ~line 158)
- Modify: `CLAUDE.md` (three.js frontmatter paragraph)

- [ ] **Step 1: Add `.three-bg` to the README layout table**

In `README.md`, find this exact line:

```
| `.no-chrome` (modifier) | Hides the bottom-right page indicator |
```

Add a new row directly after it:

```
| `.three-bg` (layout) | Renders a `three` block as a full-bleed background with slide text on top; pair with `.dark` and `.no-chrome` |
```

- [ ] **Step 2: Document the shared connectome in the README 3D section**

In `README.md`, find this exact line (end of the "3D visualizations" section):

```
See [talks/threejs-example/](talks/threejs-example/) for a working example — three Gaussian clusters that lift from 1D → 2D → 3D as you press the right arrow, with the camera arcing into a three-quarter view at stage 3.
```

Insert directly **after** it:

````

### Shared connectome background

`visualisations/connectome.js` is a reusable, ambient neural-network visual — a slowly rotating two-lobe neuron point cloud with pulsing connections. Drop it into any deck as a full-bleed background:

```
{.three-bg .dark .no-chrome}

```three
- module: ../../visualisations/connectome.js
  id: connectome
```
```

The `.three-bg` layout class makes the canvas a background and keeps slide text legible on top. It is purely ambient — no `advance`/`retreat` — so you narrate over it. Optional `opts`: `count` (neuron count), `lobes` (`1` or `2`), `accent` (colour), `background` (clear colour, or `transparent`), `speed` (motion multiplier).
````

- [ ] **Step 3: Update CLAUDE.md**

In `CLAUDE.md`, find the end of the **Three.js frontmatter** paragraph — the sentence ending:

```
The example deck at [talks/threejs-example/](talks/threejs-example/) ports `specs/threejs_example.html` and exercises the stage hooks (1D → 2D → 3D).
```

Append this sentence to the end of that paragraph (same paragraph, after the sentence above):

```
 Shared three modules can live in `visualisations/` alongside the Vega specs and be referenced cross-deck by relative path — `visualisations/connectome.js` is a reusable ambient neural-network background, used via the `.three-bg` layout class.
```

- [ ] **Step 4: Verify the docs build references nothing broken**

Run: `npm test`
Expected: all tests pass (docs-only changes; this is a sanity check).

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document .three-bg layout and connectome component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Reusable three.js module in `visualisations/` → Task 2. ✓
- Module API (`init` → `{ dispose }`, no advance/retreat), opts surface, prefers-reduced-motion, clean dispose → Task 2. ✓
- Cross-deck reuse via parent-relative path → Task 4 (usage) + Task 1 (regression test). ✓
- `.three-bg` layout class → Task 3. ✓
- Slide 2 rewrite with `{.three-bg .dark .no-chrome}` + connectome + three stepped beats → Task 4. ✓
- Stepped-beat copy landing on "meaning" → Task 4 Step 1. ✓
- README + CLAUDE.md docs → Task 5. ✓
- `embedThreeModules` parent-relative test → Task 1. ✓
- No build-pipeline changes → confirmed; no task touches `bin/build.js`. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step has complete content.

**Type consistency:** Module API (`init({ canvas, opts })` → `{ dispose }`) matches the runtime in `script/three.js` (`mod.default`, `handle.dispose` not required but used on teardown). `id: connectome` in the `three` block matches the `id="connectome"` asserted in Task 4 Step 3. The `.three-bg` class name is identical across Task 3 (CSS), Task 4 (slide attribute block), and Task 5 (docs).
