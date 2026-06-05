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
    scene.fog = new THREE.Fog(new THREE.Color(cfg.background), 5.5, 12);
  }

  const camera = new THREE.PerspectiveCamera(45, (w || 1) / (h || 1), 0.1, 100);
  camera.position.set(0, 0, 7.5);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  // Soft circular sprite so points render as round dots, not squares.
  function discTexture() {
    const s = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.55, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }
  const sprite = discTexture();

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
    const x = p.x * 1.7 + side * 1.3;
    const y = p.y * 2.25;
    const z = p.z * 1.95;
    nodes.push({ x, y, z });
    nodePos[i * 3] = x;
    nodePos[i * 3 + 1] = y;
    nodePos[i * 3 + 2] = z;
  }

  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  const nodeMat = new THREE.PointsMaterial({
    color: accent,
    map: sprite,
    size: 0.17,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
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
  const pulseCount = edges.length ? Math.max(1, Math.round(edges.length * 0.06)) : 0;
  const pulses = [];
  const pulsePos = new Float32Array(Math.max(1, pulseCount) * 3);
  for (let i = 0; i < pulseCount; i++) pulses.push(spawnPulse());
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  pulseGeo.setDrawRange(0, pulseCount);
  const pulseMat = new THREE.PointsMaterial({
    color: accent.clone().lerp(new THREE.Color(0xffffff), 0.55),
    map: sprite,
    size: 0.26,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  group.add(new THREE.Points(pulseGeo, pulseMat));

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
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      nodeGeo.dispose();
      edgeGeo.dispose();
      pulseGeo.dispose();
      sprite.dispose();
      nodeMat.dispose();
      edgeMat.dispose();
      pulseMat.dispose();
      renderer.dispose();
    },
  };
}
