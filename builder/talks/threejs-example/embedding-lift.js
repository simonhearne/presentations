import * as THREE from 'three';

const CLUSTER_COUNT = 8;
const PER_CLUSTER = 300;
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
  g.addColorStop(0.9, 'rgba(255,255,255,0.6)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export default function init({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0e1a, 1);
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
  camera.position.set(0, 0, 22);

  const centers = [
    { x: -4.6, y:  2.4, z:  2.8, color: new THREE.Color(0x175fff) },
    { x:  4.8, y:  2.6, z: -0.6, color: new THREE.Color(0xc84cff) },
    { x:  0.3, y: -3.0, z: -2.6, color: new THREE.Color(0x29b8ff) },
    { x: -3.2, y: -2.4, z:  2.2, color: new THREE.Color(0xff6b9d) },
    { x:  3.4, y: -1.8, z:  2.6, color: new THREE.Color(0x4cffb8) },
    { x: -1.6, y:  3.0, z: -2.4, color: new THREE.Color(0xffb84c) },
    { x:  2.6, y:  0.6, z:  3.4, color: new THREE.Color(0x9d4cff) },
    { x: -2.8, y:  0.2, z: -3.2, color: new THREE.Color(0x4cd6ff) },
  ];

  const truePos = new Float32Array(N * 3);
  const trueColors = new Float32Array(N * 3);
  for (let c = 0; c < CLUSTER_COUNT; c++) {
    const center = centers[c];
    for (let i = 0; i < PER_CLUSTER; i++) {
      const idx = (c * PER_CLUSTER + i) * 3;
      truePos[idx + 0] = center.x + gauss(0.9);
      truePos[idx + 1] = center.y + gauss(0.9);
      truePos[idx + 2] = center.z + gauss(0.9);
      trueColors[idx + 0] = center.color.r;
      trueColors[idx + 1] = center.color.g;
      trueColors[idx + 2] = center.color.b;
    }
  }
  const livePos = new Float32Array(N * 3);
  livePos.set(truePos);
  const liveColors = new Float32Array(N * 3).fill(1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(livePos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(liveColors, 3));

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

  function makeAxis(dir) {
    const len = 7;
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-dir.x * len, -dir.y * len, -dir.z * len),
      new THREE.Vector3( dir.x * len,  dir.y * len,  dir.z * len),
    ]);
    const m = new THREE.LineBasicMaterial({ color: 0xe8e6e1, transparent: true, opacity: 0 });
    return new THREE.Line(g, m);
  }
  const axisX = makeAxis(new THREE.Vector3(1, 0, 0));
  const axisY = makeAxis(new THREE.Vector3(0, 1, 0));
  const axisZ = makeAxis(new THREE.Vector3(0, 0, 1));
  scene.add(axisX, axisY, axisZ);

  let stage = 1;
  let currentD = 1;
  let targetD = 1;
  let raf = 0;

  function applyDimension(d) {
    const yW = THREE.MathUtils.clamp(d - 1, 0, 1);
    const zW = THREE.MathUtils.clamp(d - 2, 0, 1);
    const cW = zW;
    for (let i = 0; i < N; i++) {
      const idx = i * 3;
      livePos[idx + 0] = truePos[idx + 0];
      livePos[idx + 1] = truePos[idx + 1] * yW;
      livePos[idx + 2] = truePos[idx + 2] * zW;
      liveColors[idx + 0] = 1 + (trueColors[idx + 0] - 1) * cW;
      liveColors[idx + 1] = 1 + (trueColors[idx + 1] - 1) * cW;
      liveColors[idx + 2] = 1 + (trueColors[idx + 2] - 1) * cW;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    axisX.material.opacity = 0.35;
    axisY.material.opacity = 0.35 * yW;
    axisZ.material.opacity = 0.35 * zW;
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
    const idleRot = Math.max(0, currentD - 2.6) * 0.82;
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
      for (const a of [axisX, axisY, axisZ]) {
        a.geometry.dispose();
        a.material.dispose();
      }
      renderer.dispose();
    },
  };
}
