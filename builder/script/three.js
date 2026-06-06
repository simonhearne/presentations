// script/three.js — runtime for embedding three.js viz canvases.
//
// Discovers .three-canvas elements, dynamic-imports each one's data-module
// (a base64 data: URL), calls init({ canvas, opts }), stores the returned
// handle, and routes ArrowRight/n/Space and ArrowLeft/p in capture phase to
// advance()/retreat(). If the module returns true, the keypress is consumed
// and deck.js doesn't see it.

const inited = new WeakSet();

function parseValue(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))) {
    try { return JSON.parse(v); } catch { /* fall through */ }
  }
  return v;
}

function optionsFromDataset(el) {
  const opts = {};
  for (const [key, raw] of Object.entries(el.dataset)) {
    if (key === 'module') continue;
    opts[key] = parseValue(raw);
  }
  return opts;
}

async function initCanvas(canvas) {
  if (inited.has(canvas)) return;
  inited.add(canvas);
  const url = canvas.dataset.module;
  if (!url) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
  try {
    const mod = await import(url);
    const init = mod.default || mod.init;
    if (typeof init !== 'function') {
      console.error('three: module exports no default init function', canvas.id);
      return;
    }
    const handle = init({ canvas, opts: optionsFromDataset(canvas) });
    canvas.__three = handle || {};
  } catch (err) {
    console.error('three: init failed for', canvas.id || canvas, err);
  }
}

function activeSlideCanvases() {
  const slide = document.querySelector('.slide.is-current');
  if (!slide) return [];
  return Array.from(slide.querySelectorAll('.three-canvas'));
}

function dispatchNav(method) {
  let consumed = false;
  for (const c of activeSlideCanvases()) {
    const fn = c.__three && c.__three[method];
    if (typeof fn === 'function') {
      try {
        if (fn.call(c.__three) === true) consumed = true;
      } catch (err) {
        console.error(`three: ${method}() threw for`, c.id || c, err);
      }
    }
  }
  return consumed;
}

function onKeyCapture(e) {
  if (e.defaultPrevented) return;
  let method = null;
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
    case 'n':
      method = 'advance';
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
    case 'p':
      method = 'retreat';
      break;
    default:
      return;
  }
  if (dispatchNav(method)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function observeSlide(slide) {
  const obs = new MutationObserver(() => {
    if (slide.classList.contains('is-current')) {
      slide.querySelectorAll('.three-canvas').forEach(initCanvas);
    }
  });
  obs.observe(slide, { attributes: true, attributeFilter: ['class'] });
}

function start() {
  document.addEventListener('keydown', onKeyCapture, true);
  document.querySelectorAll('.slide').forEach(observeSlide);
  const current = document.querySelector('.slide.is-current');
  if (current) current.querySelectorAll('.three-canvas').forEach(initCanvas);
  window.addEventListener('resize', () => {
    document.querySelectorAll('.three-canvas').forEach(c => {
      if (!inited.has(c)) return;
      const rect = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(rect.width));
      c.height = Math.max(1, Math.round(rect.height));
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
