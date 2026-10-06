// talks/vector-search-visualised/text-mechanism.js
// Forward-pass visualisation: a text phrase enters a small neural network,
// activations propagate forward through weighted edges, and the output layer
// becomes an embedding vector — which drops as a point into 2D space.
//   stage 0  input layer lit with the phrase's activation pattern
//   stage 1  forward pass complete; output values shown as a bar chart
//   stage 2  the output vector flies out to a point in 2D space
//   stage 3  a second, similar phrase lands as a nearby point
// Presenter-stepped: advance()/retreat() consume the arrow keys.

import * as THREE from 'three';

const DEFAULTS = { background: '#070d18', speed: 1 };

// Two near-synonym phrases. Their hand-tuned activation patterns share most
// of their structure — exactly the property a trained embedding network has.
const PHRASES = [
  { text: 'running shoes', color: '#5b86e8' },
  { text: 'sneakers', color: '#6dd6a0' },
];

const LAYERS = [6, 8, 8, 6]; // input · hidden · hidden · output (= embedding dim)
const LAYER_X = [-3.8, -2.5, -1.2, 0.1];
const LAYER_NAMES = ['input', 'hidden', 'hidden', 'output'];
const NODE_GAP = 0.42;
const MAX_STAGE = 3;
const LERP = 0.045; // slower than FaceNet so the cascade has room to read

// Activation patterns per phrase, per layer. Hand-tuned so phrase 2's pattern
// shares most structure with phrase 1 (small per-element deltas) — the result
// a network that has learned "running shoes ≈ sneakers" would produce.
const ACTIVATIONS = [
  [
    [0.85, 0.20, 0.70, 0.55, 0.15, 0.65],
    [0.60, 0.90, 0.25, 0.75, 0.40, 0.30, 0.80, 0.55],
    [0.45, 0.85, 0.30, 0.65, 0.70, 0.20, 0.55, 0.40],
    [0.72, 0.28, 0.81, 0.42, 0.63, 0.19],
  ],
  [
    [0.75, 0.30, 0.65, 0.45, 0.25, 0.55],
    [0.55, 0.85, 0.30, 0.70, 0.45, 0.35, 0.72, 0.58],
    [0.40, 0.80, 0.35, 0.60, 0.65, 0.25, 0.50, 0.45],
    [0.66, 0.34, 0.75, 0.46, 0.58, 0.24],
  ],
];

const SCENE_X = 1.0;
const LANDINGS = [
  new THREE.Vector3(3.3, 0.55, 0),
  new THREE.Vector3(3.7, 0.25, 0),
];

const BAR_BASE_X = -0.7;
const BAR_GAP = 0.32;
const BAR_WIDTH = 0.2;
const BAR_BASELINE = -1.8;
const BAR_MAX_H = 0.85;

// activationOf(layer, nodeIdx, stageT) — single source of truth for what every
// node should show at any stageT. Stage 0→1 cascades the first phrase forward
// layer by layer; stage 2→3 morphs each layer in turn into the second phrase.
function activationOf(l, i, st) {
  if (st <= 1) {
    const target = ACTIVATIONS[0][l][i];
    if (l === 0) return target; // input is lit from the moment the slide opens
    const start = (l - 1) / 3;
    const end = l / 3;
    return target * THREE.MathUtils.smoothstep(st, start, end);
  }
  if (st <= 2) return ACTIVATIONS[0][l][i];
  if (st <= 3) {
    const t1 = ACTIVATIONS[0][l][i];
    const t2 = ACTIVATIONS[1][l][i];
    const start = 2 + l * 0.25;
    const end = start + 0.25;
    return t1 + (t2 - t1) * THREE.MathUtils.smoothstep(st, start, end);
  }
  return ACTIVATIONS[1][l][i];
}

// phrase-colour mix at any stageT (blue → green as we cross stage 2→3).
function phraseColor(st, out) {
  const k = THREE.MathUtils.smoothstep(st, 2.5, 3);
  const a = new THREE.Color(PHRASES[0].color);
  const b = new THREE.Color(PHRASES[1].color);
  out.copy(a).lerp(b, k);
  return out;
}

export default function init({ canvas, opts = {} }) {
  const cfg = { ...DEFAULTS, ...opts };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  let w = canvas.clientWidth || canvas.width;
  let h = canvas.clientHeight || canvas.height;
  renderer.setSize(w, h, false);
  renderer.setClearColor(new THREE.Color(cfg.background), 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(cfg.background), 11, 24);

  const camera = new THREE.PerspectiveCamera(42, (w || 1) / (h || 1), 0.1, 100);
  camera.position.set(SCENE_X, 0, 9.6);
  camera.lookAt(SCENE_X, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  const disposables = [];

  function discTexture() {
    const s = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(cv);
    disposables.push(tex);
    return tex;
  }
  const sprite = discTexture();

  // 2x DPI text sprite, identical recipe to facenet-learning.js.
  function textSprite(text, color, fontPx = 30) {
    const dpi = 2;
    const pad = 12 * dpi;
    const cv = document.createElement('canvas');
    let ctx = cv.getContext('2d');
    const font = `600 ${fontPx * dpi}px Inter, system-ui, sans-serif`;
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    cv.width = tw + pad * 2;
    cv.height = (fontPx + 16) * dpi;
    ctx = cv.getContext('2d');
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, cv.height / 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set((cv.width / cv.height) * 0.6, 0.6, 1);
    disposables.push(tex, mat);
    return sp;
  }

  // ---- node positions ----
  const nodePos = []; // nodePos[layer][i] -> Vector3
  for (let l = 0; l < LAYERS.length; l++) {
    const row = [];
    const n = LAYERS[l];
    for (let i = 0; i < n; i++) {
      row.push(new THREE.Vector3(LAYER_X[l], (i - (n - 1) / 2) * NODE_GAP, 0));
    }
    nodePos.push(row);
  }

  // ---- nodes (one Points buffer) ----
  let totalNodes = 0;
  for (const n of LAYERS) totalNodes += n;
  const nodePosBuf = new Float32Array(totalNodes * 3);
  const nodeColBuf = new Float32Array(totalNodes * 3);
  const nodeIndex = []; // nodeIndex[layer][i] -> global node index
  {
    let k = 0;
    for (let l = 0; l < LAYERS.length; l++) {
      const row = [];
      for (let i = 0; i < LAYERS[l]; i++) {
        nodePos[l][i].toArray(nodePosBuf, k * 3);
        row.push(k);
        k++;
      }
      nodeIndex.push(row);
    }
  }
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePosBuf, 3));
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColBuf, 3));
  const nodeMat = new THREE.PointsMaterial({
    map: sprite,
    size: 0.3,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
  });
  group.add(new THREE.Points(nodeGeo, nodeMat));
  disposables.push(nodeGeo, nodeMat);

  // ---- edges (one LineSegments buffer; per-vertex colour drives glow) ----
  const edges = []; // { layerFrom, fromIdx, toIdx, weight, vIdx }
  let edgeCount = 0;
  for (let l = 0; l < LAYERS.length - 1; l++) edgeCount += LAYERS[l] * LAYERS[l + 1];
  const edgePosBuf = new Float32Array(edgeCount * 2 * 3);
  const edgeColBuf = new Float32Array(edgeCount * 2 * 3);
  {
    let v = 0;
    let seed = 7;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let l = 0; l < LAYERS.length - 1; l++) {
      for (let i = 0; i < LAYERS[l]; i++) {
        for (let j = 0; j < LAYERS[l + 1]; j++) {
          nodePos[l][i].toArray(edgePosBuf, v * 3); v++;
          nodePos[l + 1][j].toArray(edgePosBuf, v * 3); v++;
          edges.push({ layerFrom: l, fromIdx: i, toIdx: j, weight: 0.3 + rand() * 0.7, vIdx: (v - 2) });
        }
      }
    }
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePosBuf, 3));
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeColBuf, 3));
  const edgeMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));
  disposables.push(edgeGeo, edgeMat);

  // ---- layer labels ---- (aligned at a single y so 6- and 8-node layers line up)
  const LABEL_Y = -1.95;
  for (let l = 0; l < LAYERS.length; l++) {
    const label = textSprite(LAYER_NAMES[l], '#7f93c8', 22);
    label.scale.multiplyScalar(0.55);
    label.position.set(LAYER_X[l], LABEL_Y, 0);
    group.add(label);
  }
  // "weights" sits above the network so it doesn't collide with the row of
  // input/hidden/hidden/output labels below.
  const weightsLabel = textSprite('weights', '#7f93c8', 22);
  weightsLabel.scale.multiplyScalar(0.55);
  weightsLabel.position.set((LAYER_X[1] + LAYER_X[2]) / 2, 2.05, 0);
  group.add(weightsLabel);

  // ---- phrase labels (cross-fading) ----
  const phraseSprites = PHRASES.map((p) => {
    const sp = textSprite(p.text, '#ffffff', 34);
    sp.scale.multiplyScalar(0.78);
    sp.position.set(LAYER_X[0], (LAYERS[0] - 1) / 2 * NODE_GAP + 0.75, 0.2);
    sp.material.opacity = 0;
    group.add(sp);
    return sp;
  });

  // ---- output bar chart (six bars under the output layer) ----
  const barGeo = new THREE.PlaneGeometry(BAR_WIDTH, 1);
  barGeo.translate(0, 0.5, 0); // anchor at the bottom edge
  disposables.push(barGeo);
  const barMats = [];
  const bars = [];
  for (let i = 0; i < LAYERS[3]; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PHRASES[0].color),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(barGeo, mat);
    mesh.position.set(BAR_BASE_X + i * BAR_GAP, BAR_BASELINE, 0);
    mesh.scale.y = 0.01;
    group.add(mesh);
    barMats.push(mat);
    bars.push(mesh);
    disposables.push(mat);
  }
  const barLabel = textSprite('output vector', '#7f93c8', 20);
  barLabel.scale.multiplyScalar(0.5);
  barLabel.position.set(BAR_BASE_X + ((LAYERS[3] - 1) * BAR_GAP) / 2, BAR_BASELINE - 0.32, 0);
  barLabel.material.opacity = 0;
  group.add(barLabel);

  // ---- 2D embedding points (one Points buffer with two slots) ----
  const pointPos = new Float32Array(PHRASES.length * 3);
  const pointCol = new Float32Array(PHRASES.length * 3);
  const bg = new THREE.Color(cfg.background);
  for (let i = 0; i < PHRASES.length; i++) {
    pointPos[i * 3] = LANDINGS[i].x;
    pointPos[i * 3 + 1] = LANDINGS[i].y;
    pointPos[i * 3 + 2] = LANDINGS[i].z;
    bg.toArray(pointCol, i * 3); // hidden by default
  }
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.BufferAttribute(pointPos, 3));
  pointGeo.setAttribute('color', new THREE.BufferAttribute(pointCol, 3));
  const pointMat = new THREE.PointsMaterial({
    map: sprite,
    size: 0.45,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
  });
  group.add(new THREE.Points(pointGeo, pointMat));
  disposables.push(pointGeo, pointMat);
  const spaceLabel = textSprite('embedding space', '#7f93c8', 22);
  spaceLabel.scale.multiplyScalar(0.55);
  spaceLabel.position.set(3.5, -1.55, 0);
  spaceLabel.material.opacity = 0;
  group.add(spaceLabel);

  // ---- captions ----
  const captionLines = [
    'An input becomes a pattern of activations',
    'Weights and activations propagate forward',
    'The output is the embedding — a point in space',
    'Similar meaning → nearby position',
  ];
  const captionSprites = captionLines.map((text) => {
    const sp = textSprite(text, '#b8c6e8', 30);
    sp.scale.multiplyScalar(0.62);
    sp.position.set(SCENE_X, -2.7, 1.2);
    sp.material.opacity = 0;
    group.add(sp);
    return sp;
  });

  // ---- stage state ----
  let stage = 0;
  let targetStage = 0;
  let stageT = 0;

  // pre-allocated working values
  const navy = new THREE.Color(0x1e2740);
  const nodeBright = new THREE.Color(0xeaf1ff);
  const edgeBright = new THREE.Color(0xbcd0ff);
  const tmpCol = new THREE.Color();
  const pcol = new THREE.Color();

  function applyState(st) {
    // ---- nodes ----
    for (let l = 0; l < LAYERS.length; l++) {
      for (let i = 0; i < LAYERS[l]; i++) {
        const a = activationOf(l, i, st);
        tmpCol.copy(navy).lerp(nodeBright, a);
        tmpCol.toArray(nodeColBuf, nodeIndex[l][i] * 3);
      }
    }
    nodeGeo.attributes.color.needsUpdate = true;

    // ---- edges ----
    for (let e = 0; e < edges.length; e++) {
      const ed = edges[e];
      const srcA = activationOf(ed.layerFrom, ed.fromIdx, st);
      const dstA = activationOf(ed.layerFrom + 1, ed.toIdx, st);
      const srcGlow = srcA * ed.weight;
      const dstGlow = dstA * ed.weight;
      tmpCol.copy(navy).lerp(edgeBright, srcGlow);
      tmpCol.toArray(edgeColBuf, ed.vIdx * 3);
      tmpCol.copy(navy).lerp(edgeBright, dstGlow);
      tmpCol.toArray(edgeColBuf, (ed.vIdx + 1) * 3);
    }
    edgeGeo.attributes.color.needsUpdate = true;

    // ---- phrase labels (cross-fade between phrase 1 and phrase 2) ----
    const k = THREE.MathUtils.smoothstep(st, 2, 2.4);
    phraseSprites[0].material.opacity = 1 - k;
    phraseSprites[1].material.opacity = k;

    // ---- output bars ----
    const barOpacity = THREE.MathUtils.smoothstep(st, 0.85, 1.05);
    phraseColor(st, pcol);
    for (let i = 0; i < LAYERS[3]; i++) {
      const a = activationOf(3, i, st);
      bars[i].scale.y = Math.max(0.01, a * BAR_MAX_H);
      barMats[i].opacity = barOpacity;
      barMats[i].color.copy(pcol);
    }
    barLabel.material.opacity = barOpacity * 0.85;

    // ---- 2D embedding points ----
    const p0Vis = THREE.MathUtils.smoothstep(st, 1.15, 1.95);
    const p1Vis = THREE.MathUtils.smoothstep(st, 2.7, 2.98);
    // first point travels from the bar chart to its landing during 1→2
    const barCentre = new THREE.Vector3(
      BAR_BASE_X + ((LAYERS[3] - 1) * BAR_GAP) / 2,
      BAR_BASELINE + 0.3,
      0,
    );
    const p0Pos = new THREE.Vector3().lerpVectors(barCentre, LANDINGS[0], p0Vis);
    pointPos[0] = p0Pos.x; pointPos[1] = p0Pos.y; pointPos[2] = p0Pos.z;
    // colours: bg when invisible, identity colour when settled
    tmpCol.copy(bg).lerp(new THREE.Color(PHRASES[0].color), p0Vis);
    tmpCol.toArray(pointCol, 0);
    const p1Pos = new THREE.Vector3().lerpVectors(barCentre, LANDINGS[1], p1Vis);
    pointPos[3] = p1Pos.x; pointPos[4] = p1Pos.y; pointPos[5] = p1Pos.z;
    tmpCol.copy(bg).lerp(new THREE.Color(PHRASES[1].color), p1Vis);
    tmpCol.toArray(pointCol, 3);
    pointGeo.attributes.position.needsUpdate = true;
    pointGeo.attributes.color.needsUpdate = true;
    spaceLabel.material.opacity = p0Vis * 0.85;

    // ---- captions ----
    for (let i = 0; i < captionSprites.length; i++) {
      const op = Math.max(0, 1 - Math.abs(st - i) / 0.5);
      captionSprites[i].material.opacity = op;
      captionSprites[i].visible = op > 0.01;
    }
  }

  // initialise visible state
  applyState(stageT);

  let raf = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const sdt = dt * cfg.speed;
    stageT += (targetStage - stageT) * LERP * (sdt * 60); // frame-rate-stable lerp
    applyState(stageT);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function onResize() {
    w = canvas.clientWidth || canvas.width;
    h = canvas.clientHeight || canvas.height;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  return {
    advance() {
      if (stage >= MAX_STAGE) return false;
      stage++;
      targetStage = stage;
      return true;
    },
    retreat() {
      if (stage <= 0) return false;
      stage--;
      targetStage = stage;
      return true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
