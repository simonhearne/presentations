// script/fragments.js — runtime for incremental .fragment reveals
(() => {
  function activeSlide() {
    return document.querySelector('.slide.is-current');
  }

  function fragmentsOn(slide) {
    return slide ? Array.from(slide.querySelectorAll('.fragment')) : [];
  }

  function stepFragments(direction) {
    const slide = activeSlide();
    if (!slide) return false;
    const frags = fragmentsOn(slide);
    if (direction > 0) {
      const next = frags.find(el => !el.classList.contains('is-revealed'));
      if (!next) return false;
      next.classList.add('is-revealed');
      return true;
    } else {
      const revealed = frags.filter(el => el.classList.contains('is-revealed'));
      if (revealed.length === 0) return false;
      revealed[revealed.length - 1].classList.remove('is-revealed');
      return true;
    }
  }

  // Auto-reveal: a per-slide state machine drives timed fragment reveals.
  // States: idle | armed (waiting for first manual reveal) | running | cancelled | done
  let autoTimer = null;
  let autoState = 'idle';

  function cancelAuto() {
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function scheduleNext(delay) {
    autoTimer = setTimeout(() => {
      autoTimer = null;
      if (stepFragments(1)) {
        scheduleNext(delay);
      } else {
        autoState = 'done';
      }
    }, delay);
  }

  function startAuto(slide) {
    const delay = parseInt(slide.dataset.autorevealDelay, 10);
    if (!Number.isInteger(delay) || delay <= 0) return;
    autoState = 'running';
    scheduleNext(delay);
  }

  function enterSlide(slide, direction) {
    cancelAuto();
    autoState = 'idle';
    const frags = fragmentsOn(slide);
    if (direction === 'backward') {
      frags.forEach(el => el.classList.add('is-revealed'));
      return;
    }
    frags.forEach(el => el.classList.remove('is-revealed'));
    if (slide.classList.contains('auto-reveal')) {
      if (slide.dataset.autorevealStart === 'immediate') {
        startAuto(slide);
      } else {
        autoState = 'armed';
      }
    }
  }

  function onKeyCapture(e) {
    if (e.defaultPrevented) return;
    let direction = 0;
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
      case 'n':
        direction = 1; break;
      case 'ArrowLeft':
      case 'PageUp':
      case 'p':
        direction = -1; break;
      default: return;
    }
    if (autoState === 'running') {
      cancelAuto();
      autoState = 'cancelled';
    }
    if (stepFragments(direction)) {
      if (direction > 0 && autoState === 'armed') {
        startAuto(activeSlide());
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onSlideEnter(e) {
    const { direction, slide } = e.detail || {};
    if (slide) enterSlide(slide, direction);
  }

  document.addEventListener('keydown', onKeyCapture, true);
  document.addEventListener('slide:enter', onSlideEnter);

  // deck.js dispatches the first slide:enter before this script registers its
  // listener above, so initialize auto-reveal for the slide already shown.
  const initialSlide = activeSlide();
  if (initialSlide) enterSlide(initialSlide, 'jump');
})();
