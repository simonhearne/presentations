// talks/vector-search-visualised/word2vec-learning.js
// Staged visualisation: a network learns what "similar" means — for words.
//   stage 0  bag of words — words are arbitrary IDs, no structure
//   stage 1  training     — skip-gram pairs cycle, points drift into clusters
//   stage 2  trained      — hidden weights ARE the 2D embedding
//   stage 3  arithmetic   — king − man + woman ≈ queen
// Presenter-stepped: advance()/retreat() consume the arrow keys.

import * as THREE from 'three';

const DEFAULTS = { background: '#070d18', speed: 1 };

// Hand-tuned target positions so king/man/queen/woman form a parallelogram:
//   king (2.0, 1.0) − man (2.0, 0.2) + woman (3.0, 0.2) = (3.0, 1.0) = queen
// Per-word jitter keeps it from reading as a literal rectangle.
const WORDS = [
  { text: 'king',  color: '#5b86e8', target: [2.0,  1.04], jitter: [ 0.03,  0.04] },
  { text: 'queen', color: '#5b86e8', target: [3.0,  0.97], jitter: [-0.04, -0.03] },
  { text: 'man',   color: '#b8c6e8', target: [2.0,  0.22], jitter: [-0.03,  0.02] },
  { text: 'woman', color: '#b8c6e8', target: [3.0,  0.18], jitter: [ 0.04, -0.02] },
  { text: 'dog',   color: '#e8a14b', target: [3.4, -1.30], jitter: [ 0.02,  0.03] },
  { text: 'cat',   color: '#e8a14b', target: [3.8, -1.00], jitter: [-0.03, -0.04] },
];

// Skip-gram pairs cycled during stage 1. Each entry is [centerIdx, contextIdx].
const SKIPGRAM_PAIRS = [[0, 1], [2, 3], [4, 5]];
const PAIR_DURATION = 2.5; // seconds per pair

const LAYERS = [6, 2, 6]; // input · hidden(=2D embedding dim) · output
const LAYER_X = [-3.8, -2.0, -0.4];
const INPUT_GAP = 0.42;
const HIDDEN_GAP = 0.7;
const OUTPUT_GAP = 0.42;
const NODE_GAPS = [INPUT_GAP, HIDDEN_GAP, OUTPUT_GAP];

const SCENE_X = 1.0;
const MAX_STAGE = 3;
const LERP = 0.07;

const ORIGIN = new THREE.Vector3(0, 0, 0); // embedding-space origin in world coords

// Deterministic pseudo-random for stable scatter / weight seeds.
function seedRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function smoothstep(a, b, x) {
  return THREE.MathUtils.smoothstep(x, a, b);
}

function trainingEnergy(t) {
  if (t <= 0.45 || t >= 2) return 0;
  return Math.sin(Math.max(0, (t - 0.45) * Math.PI));
}

// Hand-tuned activation values for each input word; cycle through them in stage 1
// so the hidden layer "looks busy" without us needing real weight matrices.
const HIDDEN_ACTIVATIONS = [
  [0.85, 0.30], // king
  [0.78, 0.35], // queen
  [0.55, 0.62], // man
  [0.48, 0.66], // woman
  [0.25, 0.82], // dog
  [0.20, 0.85], // cat
];

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

  // ---- network node positions ----
  const nodePos = []; // nodePos[layer][i] -> Vector3
  for (let l = 0; l < LAYERS.length; l++) {
    const row = [];
    const n = LAYERS[l];
    const gap = NODE_GAPS[l];
    for (let i = 0; i < n; i++) {
      row.push(new THREE.Vector3(LAYER_X[l], (i - (n - 1) / 2) * gap, 0));
    }
    nodePos.push(row);
  }

  // ---- nodes (one Points buffer) ----
  let totalNodes = 0;
  for (const n of LAYERS) totalNodes += n;
  const nodePosBuf = new Float32Array(totalNodes * 3);
  const nodeColBuf = new Float32Array(totalNodes * 3);
  const nodeIndex = [];
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
  const nodePoints = new THREE.Points(nodeGeo, nodeMat);
  group.add(nodePoints);
  disposables.push(nodeGeo, nodeMat);

  // ---- edges ----
  const edges = [];
  let edgeCount = 0;
  for (let l = 0; l < LAYERS.length - 1; l++) edgeCount += LAYERS[l] * LAYERS[l + 1];
  const edgePosBuf = new Float32Array(edgeCount * 2 * 3);
  const edgeColBuf = new Float32Array(edgeCount * 2 * 3);
  {
    let v = 0;
    const rand = seedRng(11);
    for (let l = 0; l < LAYERS.length - 1; l++) {
      for (let i = 0; i < LAYERS[l]; i++) {
        for (let j = 0; j < LAYERS[l + 1]; j++) {
          nodePos[l][i].toArray(edgePosBuf, v * 3); v++;
          nodePos[l + 1][j].toArray(edgePosBuf, v * 3); v++;
          edges.push({
            layerFrom: l,
            fromIdx: i,
            toIdx: j,
            weight: 0.35 + rand() * 0.65,
            vIdx: v - 2,
          });
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
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(edgeLines);
  disposables.push(edgeGeo, edgeMat);

  // ---- network labels ----
  const inputLabels = WORDS.map((wd, i) => {
    const sp = textSprite(wd.text, '#b8c6e8', 22);
    sp.scale.multiplyScalar(0.5);
    sp.position.set(LAYER_X[0] - 0.55, nodePos[0][i].y, 0);
    sp.material.opacity = 0;
    group.add(sp);
    return sp;
  });
  const outputLabels = WORDS.map((wd, i) => {
    const sp = textSprite(wd.text, '#b8c6e8', 22);
    sp.scale.multiplyScalar(0.5);
    sp.position.set(LAYER_X[2] + 0.55, nodePos[2][i].y, 0);
    sp.material.opacity = 0;
    group.add(sp);
    return sp;
  });
  const layerCaptions = ['input', 'hidden (2D)', 'softmax'];
  const layerCaptionSprites = layerCaptions.map((text, l) => {
    const sp = textSprite(text, '#7f93c8', 20);
    sp.scale.multiplyScalar(0.5);
    sp.position.set(LAYER_X[l], -1.75, 0);
    group.add(sp);
    return sp;
  });

  // ---- embedding-space word points ----
  // Pre-compute scatter (stage 0) and target (stage 2+) positions.
  const scatter = [];
  const targets = [];
  const labelOffsets = [
    [-0.32,  0.34], // king up-left
    [ 0.34,  0.32], // queen up-right
    [-0.32, -0.30], // man down-left
    [ 0.34, -0.30], // woman down-right
    [-0.30,  0.30], // dog up-left
    [ 0.30,  0.30], // cat up-right
  ];
  {
    const rand = seedRng(42);
    for (let i = 0; i < WORDS.length; i++) {
      scatter.push(new THREE.Vector3(
        SCENE_X + 1.5 + (rand() - 0.5) * 3.0,
        (rand() - 0.5) * 3.0,
        0,
      ));
      targets.push(new THREE.Vector3(
        WORDS[i].target[0] + WORDS[i].jitter[0],
        WORDS[i].target[1] + WORDS[i].jitter[1],
        0,
      ));
    }
  }

  const pointPosBuf = new Float32Array(WORDS.length * 3);
  const pointColBuf = new Float32Array(WORDS.length * 3);
  for (let i = 0; i < WORDS.length; i++) {
    scatter[i].toArray(pointPosBuf, i * 3);
  }
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.BufferAttribute(pointPosBuf, 3));
  pointGeo.setAttribute('color', new THREE.BufferAttribute(pointColBuf, 3));
  const pointMat = new THREE.PointsMaterial({
    map: sprite,
    size: 0.42,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
  });
  group.add(new THREE.Points(pointGeo, pointMat));
  disposables.push(pointGeo, pointMat);

  const wordLabels = WORDS.map((wd) => {
    const sp = textSprite(wd.text, '#eaf1ff', 28);
    sp.scale.multiplyScalar(0.62);
    sp.material.opacity = 0;
    group.add(sp);
    return sp;
  });

  // ---- cluster hulls (stage 2) ----
  function makeHull(centre, radiusX, radiusY, color) {
    const geo = new THREE.CircleGeometry(1, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(centre.x, centre.y, -0.05);
    mesh.scale.set(radiusX, radiusY, 1);
    group.add(mesh);
    disposables.push(geo, mat);
    return mesh;
  }
  const royalHull = makeHull(
    new THREE.Vector3(2.5, 0.6, 0), 1.05, 0.85,
    '#5b86e8',
  );
  const animalHull = makeHull(
    new THREE.Vector3(3.6, -1.15, 0), 0.65, 0.55,
    '#e8a14b',
  );

  // ---- arrows (stage 3) ----
  const upAxis = new THREE.Vector3(0, 1, 0);
  function makeArrow(color) {
    const shaftGeo = new THREE.BufferGeometry();
    const shaftPos = new Float32Array(6);
    shaftGeo.setAttribute('position', new THREE.BufferAttribute(shaftPos, 3));
    const shaftMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const shaft = new THREE.Line(shaftGeo, shaftMat);

    const headGeo = new THREE.ConeGeometry(0.07, 0.2, 16);
    const headMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const head = new THREE.Mesh(headGeo, headMat);

    const g = new THREE.Group();
    g.add(shaft);
    g.add(head);
    g.renderOrder = 10;
    shaft.renderOrder = 10;
    head.renderOrder = 10;
    group.add(g);
    disposables.push(shaftGeo, shaftMat, headGeo, headMat);

    const dir = new THREE.Vector3();
    const tipBase = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const fromTmp = new THREE.Vector3();
    const toTmp = new THREE.Vector3();

    return {
      group: g,
      setEndpoints(from, to, visibility) {
        fromTmp.copy(from);
        toTmp.copy(to);
        dir.subVectors(toTmp, fromTmp);
        const len = dir.length();
        if (len < 1e-4) {
          shaftMat.opacity = 0;
          headMat.opacity = 0;
          return;
        }
        dir.divideScalar(len);
        // Shorten shaft so it ends inside the cone base.
        const shaftEnd = tipBase.copy(toTmp).addScaledVector(dir, -0.12);
        shaftPos[0] = fromTmp.x; shaftPos[1] = fromTmp.y; shaftPos[2] = fromTmp.z;
        shaftPos[3] = shaftEnd.x; shaftPos[4] = shaftEnd.y; shaftPos[5] = shaftEnd.z;
        shaftGeo.attributes.position.needsUpdate = true;
        // Position cone at tip, oriented along dir.
        const conePos = tipBase.copy(toTmp).addScaledVector(dir, -0.04);
        head.position.copy(conePos);
        q.setFromUnitVectors(upAxis, dir);
        head.quaternion.copy(q);
        shaftMat.opacity = visibility;
        headMat.opacity = visibility;
      },
    };
  }
  const arrow0 = makeArrow('#eaf1ff');
  const arrow1 = makeArrow('#e8a14b');
  const arrow2 = makeArrow('#6dd6a0');

  // ---- origin marker (stage 3) ----
  const originSprite = textSprite('0', '#7f93c8', 24);
  originSprite.scale.multiplyScalar(0.45);
  originSprite.position.set(ORIGIN.x - 0.18, ORIGIN.y - 0.18, 0);
  originSprite.material.opacity = 0;
  group.add(originSprite);

  // ---- queen-landing ring (stage 3) ----
  const ringGeo = new THREE.RingGeometry(0.32, 0.4, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#bcd0ff'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.renderOrder = 9;
  group.add(ring);
  disposables.push(ringGeo, ringMat);

  // ---- equation sprite (stage 3) ----
  const equationSprite = textSprite('king − man + woman ≈ queen', '#eaf1ff', 28);
  equationSprite.scale.multiplyScalar(0.62);
  equationSprite.position.set(2.6, -2.05, 0);
  equationSprite.material.opacity = 0;
  group.add(equationSprite);

  // ---- captions ----
  const captionLines = [
    'Words are just IDs — no notion of meaning yet',
    'Training nudges weights — context predicts context',
    'The hidden weights ARE the embedding',
    'Meaning becomes math',
  ];
  const captionSprites = captionLines.map((text) => {
    const sp = textSprite(text, '#b8c6e8', 30);
    sp.scale.multiplyScalar(0.62);
    sp.position.set(SCENE_X, -2.55, 1.2);
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
  const dim = new THREE.Color(0x2a3552);
  const nodeBright = new THREE.Color(0xeaf1ff);
  const edgeBright = new THREE.Color(0xbcd0ff);
  const bg = new THREE.Color(cfg.background);
  const wordDim = new THREE.Color(0x3a4666); // muted slate — visible at stage 0
  const tmpCol = new THREE.Color();
  const wordColorTmp = new THREE.Color();
  const fromV = new THREE.Vector3();
  const toV = new THREE.Vector3();
  const orig = new THREE.Vector3();
  const kingV = new THREE.Vector3();
  const manV = new THREE.Vector3();
  const womanV = new THREE.Vector3();
  const kMinusMan = new THREE.Vector3();
  const result = new THREE.Vector3();

  // Scatter positions for input phases.
  const inputPhase = [0.0, 0.18, 0.36, 0.55, 0.72, 0.88];

  // Per-point phase offsets for residual oscillation.
  const oscPhase = WORDS.map((_, i) => i * 1.7);

  function networkOpacity(st) {
    if (st <= 1) return 0.35 + smoothstep(0.0, 1.0, st) * 0.65; // 0.35 → 1.0
    if (st <= 2) return 1.0 - smoothstep(1.0, 2.0, st) * 0.8;   // 1.0 → 0.2
    return 0.2 - smoothstep(2.0, 3.0, st) * 0.15;               // 0.2 → 0.05
  }

  function pointOpacity(st) {
    return 0.6 + smoothstep(0.5, 2.0, st) * 0.4; // 0.6 → 1.0
  }

  // Skip-gram cycle for stage 1. Returns { centerIdx, contextIdx, pulse } —
  // pulse rises from 0 → 1 → 0 across the pair's window.
  function skipgramPhase(elapsed) {
    const cycle = SKIPGRAM_PAIRS.length * PAIR_DURATION;
    const t = ((elapsed % cycle) + cycle) % cycle;
    const idx = Math.floor(t / PAIR_DURATION);
    const within = (t - idx * PAIR_DURATION) / PAIR_DURATION; // 0..1
    const [centerIdx, contextIdx] = SKIPGRAM_PAIRS[idx];
    const pulse = Math.sin(within * Math.PI); // 0 → 1 → 0
    return { centerIdx, contextIdx, pulse };
  }

  function applyState(st, elapsed) {
    const netOp = networkOpacity(st);
    nodeMat.opacity = netOp;
    edgeMat.opacity = netOp;

    // ---- input-node activations ----
    const inputAct = new Array(LAYERS[0]).fill(0);
    const outputAct = new Array(LAYERS[2]).fill(0);
    const hiddenAct = [0, 0];

    if (st < 0.95) {
      // Stage 0: cycle one input at a time.
      const cycle = inputPhase.length * 1.0;
      const t = ((elapsed % cycle) + cycle) % cycle;
      const k = Math.floor(t);
      const pulse = Math.sin((t - k) * Math.PI);
      const stage0Strength = 1 - smoothstep(0.7, 1.0, st);
      inputAct[k] = pulse * stage0Strength;
    }
    if (st >= 0.6 && st < 2.2) {
      // Stage 1: skip-gram cycle.
      const { centerIdx, contextIdx, pulse } = skipgramPhase(elapsed);
      const trainStrength = smoothstep(0.6, 1.1, st) * (1 - smoothstep(1.9, 2.2, st));
      // Center input lit + held for the full pair, with a pulse overlay.
      inputAct[centerIdx] = Math.max(inputAct[centerIdx], (0.55 + 0.45 * pulse) * trainStrength);
      // Hidden activations come from the center word's hand-tuned embedding.
      hiddenAct[0] = HIDDEN_ACTIVATIONS[centerIdx][0] * trainStrength * (0.6 + 0.4 * pulse);
      hiddenAct[1] = HIDDEN_ACTIVATIONS[centerIdx][1] * trainStrength * (0.6 + 0.4 * pulse);
      // Output context word lit.
      outputAct[contextIdx] = pulse * trainStrength;
    }

    // ---- write node colours ----
    for (let i = 0; i < LAYERS[0]; i++) {
      tmpCol.copy(dim).lerp(nodeBright, inputAct[i]);
      tmpCol.toArray(nodeColBuf, nodeIndex[0][i] * 3);
    }
    for (let i = 0; i < LAYERS[1]; i++) {
      tmpCol.copy(dim).lerp(nodeBright, hiddenAct[i]);
      tmpCol.toArray(nodeColBuf, nodeIndex[1][i] * 3);
    }
    for (let i = 0; i < LAYERS[2]; i++) {
      tmpCol.copy(dim).lerp(nodeBright, outputAct[i]);
      tmpCol.toArray(nodeColBuf, nodeIndex[2][i] * 3);
    }
    nodeGeo.attributes.color.needsUpdate = true;

    // ---- edges glow per-vertex ----
    const layerActs = [inputAct, hiddenAct, outputAct];
    for (let e = 0; e < edges.length; e++) {
      const ed = edges[e];
      const srcA = layerActs[ed.layerFrom][ed.fromIdx];
      const dstA = layerActs[ed.layerFrom + 1][ed.toIdx];
      const srcGlow = srcA * ed.weight;
      const dstGlow = dstA * ed.weight;
      tmpCol.copy(navy).lerp(edgeBright, srcGlow);
      tmpCol.toArray(edgeColBuf, ed.vIdx * 3);
      tmpCol.copy(navy).lerp(edgeBright, dstGlow);
      tmpCol.toArray(edgeColBuf, (ed.vIdx + 1) * 3);
    }
    edgeGeo.attributes.color.needsUpdate = true;

    // ---- input/output labels: visible once network is "live" ----
    const labelOp = smoothstep(0.4, 1.1, st) * (1 - smoothstep(1.8, 2.4, st)) * 0.9;
    for (let i = 0; i < WORDS.length; i++) {
      inputLabels[i].material.opacity = labelOp;
      outputLabels[i].material.opacity = labelOp;
    }
    // Layer captions follow netOp.
    for (const lc of layerCaptionSprites) lc.material.opacity = netOp * 0.7;

    // ---- embedding-space points ----
    const clusterT = smoothstep(0.8, 1.6, st);
    const energy = trainingEnergy(st);
    const ptOp = pointOpacity(st);
    pointMat.opacity = ptOp;

    for (let i = 0; i < WORDS.length; i++) {
      fromV.copy(scatter[i]);
      toV.copy(targets[i]);
      const px = fromV.x + (toV.x - fromV.x) * clusterT;
      const py = fromV.y + (toV.y - fromV.y) * clusterT;
      const osc = Math.sin(elapsed * 2 + oscPhase[i]) * 0.04 * energy;
      const oscY = Math.cos(elapsed * 1.7 + oscPhase[i]) * 0.04 * energy;
      pointPosBuf[i * 3]     = px + osc;
      pointPosBuf[i * 3 + 1] = py + oscY;
      pointPosBuf[i * 3 + 2] = 0;
      // Colour: muted slate at stage 0 → vivid wordColor over stageT∈[0.4, 1.6].
      const colT = smoothstep(0.4, 1.6, st);
      wordColorTmp.set(WORDS[i].color);
      tmpCol.copy(wordDim).lerp(wordColorTmp, colT);
      tmpCol.toArray(pointColBuf, i * 3);

      // Label follows the point with a per-word offset. Faded throughout stage 0,
      // strengthens as clusters form.
      const off = labelOffsets[i];
      wordLabels[i].position.set(px + off[0] + osc, py + off[1] + oscY, 0.1);
      const labelVisible = 0.35 + smoothstep(1.0, 1.9, st) * 0.65;
      wordLabels[i].material.opacity = labelVisible;
    }
    pointGeo.attributes.position.needsUpdate = true;
    pointGeo.attributes.color.needsUpdate = true;

    // ---- cluster hulls (stage 2 only; fade out as arrows draw) ----
    const hullOp = smoothstep(1.8, 2.1, st) * (1 - smoothstep(2.1, 2.4, st)) * 0.12;
    royalHull.material.opacity = hullOp;
    animalHull.material.opacity = hullOp;

    // ---- stage 3 arithmetic (animated across stage 2→3 transition) ----
    const arm0 = smoothstep(2.15, 2.4, st);
    const arm1 = smoothstep(2.4, 2.6, st);
    const arm2 = smoothstep(2.6, 2.8, st);
    const eqT = smoothstep(2.7, 2.95, st);
    const originOp = smoothstep(2.0, 2.15, st);
    originSprite.material.opacity = originOp;

    // Endpoints of arithmetic. Use the *target* positions (not the oscillating
    // live positions) so the arrows resolve to a clean parallelogram.
    orig.copy(ORIGIN);
    kingV.copy(targets[0]);
    manV.copy(targets[2]);
    womanV.copy(targets[3]);
    kMinusMan.copy(kingV).sub(manV);
    result.copy(kMinusMan).add(womanV);

    // Arrow 0: origin → king (drawn growing).
    toV.copy(orig).lerp(kingV, arm0);
    arrow0.setEndpoints(orig, toV, arm0);

    // Arrow 1: king → king−man (subtract man vector).
    toV.copy(kingV).lerp(kMinusMan, arm1);
    arrow1.setEndpoints(kingV, toV, arm1);

    // Arrow 2: (king−man) → result.
    toV.copy(kMinusMan).lerp(result, arm2);
    arrow2.setEndpoints(kMinusMan, toV, arm2);

    // Queen-landing ring.
    ring.position.set(targets[1].x, targets[1].y, 0);
    const ringPulse = eqT > 0.6 ? (0.55 + 0.45 * Math.sin(elapsed * 5)) : 0;
    ring.material.opacity = ringPulse * 0.9;

    // Equation sprite.
    equationSprite.material.opacity = eqT;

    // ---- captions ----
    for (let i = 0; i < captionSprites.length; i++) {
      const op = Math.max(0, 1 - Math.abs(st - i) / 0.5);
      captionSprites[i].material.opacity = op;
      captionSprites[i].visible = op > 0.01;
    }
  }

  // Initial state.
  applyState(stageT, 0);

  let raf = 0;
  let last = performance.now();
  let elapsed = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const sdt = dt * cfg.speed;
    elapsed += sdt;
    stageT += (targetStage - stageT) * LERP * (sdt * 60);
    applyState(stageT, elapsed);
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
