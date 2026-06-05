import * as THREE from 'three';

const RPM = 10;
const RAD_PER_MS = (RPM * 2 * Math.PI) / 60_000;

export default function init({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0e1a, 1);
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 0, 5);

  const geo = new THREE.BoxGeometry(2, 2, 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x175fff, wireframe: true });
  const cube = new THREE.Mesh(geo, mat);
  scene.add(cube);

  let raf = 0;
  let last = performance.now();
  function loop(now) {
    const dt = now - last;
    last = now;
    cube.rotation.x += RAD_PER_MS * dt;
    cube.rotation.y += RAD_PER_MS * dt;
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
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
