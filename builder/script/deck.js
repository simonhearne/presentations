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
    const previous = current;
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, n) => s.classList.toggle('is-current', n === current));
    const slide = slides[current];
    const id = slide.id || String(current + 1);
    if (location.hash !== `#${id}`) {
      history.replaceState(null, '', `#${id}`);
    }
    const direction =
      current === previous + 1 ? 'forward'
      : current === previous - 1 ? 'backward'
      : 'jump';
    document.dispatchEvent(new CustomEvent('slide:enter', {
      detail: { direction, index: current, slide }
    }));
  }

  function fromHash() {
    const m = location.hash.match(/^#(\d+)/);
    if (!m) return 0;
    const n = parseInt(m[1], 10) - 1;
    return Number.isInteger(n) && n >= 0 && n < slides.length ? n : 0;
  }

  let isFullscreen = false;
  function toggleFullscreen(element) {
    if (!isFullscreen) {
      isFullscreen = true;
      if(element.requestFullscreen) {
        element.requestFullscreen();
      } else if(element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if(element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if(element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } else {
      isFullscreen = false;
      if(document.exitFullscreen) {
        document.exitFullscreen();
      } else if(document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if(document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  function toggleBlackscreen() {
    const viewport = document.getElementsByClassName('deck-viewport')[0];
    viewport.style.display == 'none' ? viewport.style.display = '' : viewport.style.display = 'none';
  }

  let cursorVisible = true;
  let cursorTimeout;
  let cursorHideDelay = 1000; // milliseconds

  document.addEventListener("mousemove", magicMouse);

  function magicMouse() {
    if (!cursorVisible) {
      document.body.classList.remove("cursor-hidden");
      cursorVisible = true;
    }
    if (isFullscreen) {
      clearTimeout(cursorTimeout);
      cursorTimeout = setTimeout(() => {
        document.body.classList.add("cursor-hidden");
        cursorVisible = false;
      }, cursorHideDelay);
    }
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
      case 'n':
        e.preventDefault();
        show(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'p':
        e.preventDefault();
        show(current - 1);
        break;
      case 'Home':
      case '0':
        e.preventDefault();
        show(0);
        break;
      case 'End':
        e.preventDefault();
        show(slides.length - 1);
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen(document.documentElement);
        break;
      case 'b':
        e.preventDefault();
        toggleBlackscreen();
        break;
    }
  }

  // Swipe nav routes through a synthetic ArrowLeft/Right keydown rather than
  // calling show() directly, so the capture-phase fragment/vega/three steppers
  // get the same chance to consume a swipe as they do a real arrow key.
  const SWIPE_MIN = 50;
  let touchX = 0;
  let touchY = 0;
  let touchTracking = false;

  function onTouchStart(e) {
    touchTracking = e.touches.length === 1;
    if (!touchTracking) return;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (!touchTracking) return;
    touchTracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: dx < 0 ? 'ArrowRight' : 'ArrowLeft',
      bubbles: true,
      cancelable: true
    }));
  }

  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => show(fromHash()));
  document.addEventListener('keydown', onKey);
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });

  fit();
  show(fromHash());
})();
