// visualisations/constellation.js — ambient nearest-neighbour search.
//
// A drifting point cloud with one glowing query point and live edges to its
// k nearest neighbours, re-ranked every frame. Plain 2D canvas: the `three`
// runtime only needs init({ canvas, opts }), not three.js itself. Ambient —
// no advance()/retreat(). Animates only while its slide is current and the
// tab is visible.

const DEFAULTS = {
  points: 60,
  k: 5,
  seed: 7,
  speed: 1,
  point: '#ffffff',
  neighbour: '#49bcff',
  query: '#c84cff',
};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function init({ canvas, opts = {} }) {
  const cfg = { ...DEFAULTS, ...opts };
  const ctx = canvas.getContext('2d');
  const slide = canvas.closest('.slide');
  const rand = mulberry32(cfg.seed);
  const v = 0.0007 * cfg.speed;

  const pts = Array.from({ length: cfg.points }, () => ({
    x: rand(), y: rand(),
    vx: (rand() - 0.5) * v, vy: (rand() - 0.5) * v,
  }));
  const q = { x: 0.55, y: 0.45, vx: 0.4 * v, vy: 0.3 * v };

  let W = 0, H = 0, rafId = null;

  // The runtime resets canvas.width on window resize, so re-fit lazily.
  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === H && canvas.width === Math.round(w * dpr)) return;
    W = w; H = h;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function step(p) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > 1) p.vx *= -1;
    if (p.y < 0 || p.y > 1) p.vy *= -1;
  }

  function draw(t) {
    fit();
    ctx.clearRect(0, 0, W, H);
    const d = p => Math.hypot((p.x - q.x) * W, (p.y - q.y) * H);
    const nn = pts.slice().sort((a, b) => d(a) - d(b)).slice(0, cfg.k);

    ctx.lineWidth = 2;
    ctx.strokeStyle = cfg.neighbour;
    nn.forEach((p, i) => {
      ctx.globalAlpha = 0.7 - i * (0.5 / cfg.k);
      ctx.beginPath();
      ctx.moveTo(q.x * W, q.y * H);
      ctx.lineTo(p.x * W, p.y * H);
      ctx.stroke();
    });

    for (const p of pts) {
      const isNN = nn.includes(p);
      ctx.globalAlpha = isNN ? 0.95 : 0.45;
      ctx.fillStyle = isNN ? cfg.neighbour : cfg.point;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, isNN ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = cfg.query;
    ctx.shadowColor = cfg.query;
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.arc(q.x * W, q.y * H, 9 + Math.sin(t / 500) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function frame(t) {
    pts.forEach(step);
    step(q);
    draw(t);
    rafId = requestAnimationFrame(frame);
  }

  function sync() {
    const on = !document.hidden && (!slide || slide.classList.contains('is-current'));
    if (on && rafId === null) rafId = requestAnimationFrame(frame);
    else if (!on && rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  const redraw = () => { if (rafId === null) draw(0); };
  draw(0);
  window.addEventListener('resize', redraw);
  const obs = slide && new MutationObserver(sync);
  if (obs) obs.observe(slide, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync);
  sync();

  return {
    dispose() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (obs) obs.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('resize', redraw);
    },
  };
}
