// script/fragments.js — runtime for incremental .fragment reveals
(() => {
  function activeSlide() {
    return document.querySelector('.slide.is-current');
  }

  function fragmentsOn(slide) {
    return slide ? Array.from(slide.querySelectorAll('.fragment')) : [];
  }

  // Group fragments into steps. A fragment with data-fragment-index joins the
  // step of that number; one without takes the previous fragment's index + 1
  // (so an all-unindexed slide steps in document order, 0, 1, 2...). Steps are
  // revealed in ascending index order, every element of a step at once.
  function stepsOn(slide) {
    const byIndex = new Map();
    let last = -1;
    for (const el of fragmentsOn(slide)) {
      const explicit = parseInt(el.dataset.fragmentIndex, 10);
      const idx = Number.isInteger(explicit) ? explicit : last + 1;
      last = idx;
      if (!byIndex.has(idx)) byIndex.set(idx, []);
      byIndex.get(idx).push(el);
    }
    return Array.from(byIndex.keys()).sort((a, b) => a - b).map(k => byIndex.get(k));
  }

  const isRevealed = el => el.classList.contains('is-revealed');

  // .is-current marks the most recently revealed step so decks can highlight
  // it differently from earlier, already-revealed fragments. .fragments-done
  // on the slide means every step is on screen, so the next advance leaves
  // the slide; the footer shows a dot so the presenter can see that coming.
  function markCurrent(slide, steps) {
    let current = null;
    for (const step of steps) {
      if (step.every(isRevealed)) current = step; else break;
    }
    for (const step of steps) {
      for (const el of step) el.classList.toggle('is-current', step === current);
    }
    slide.classList.toggle('fragments-done', steps.length > 0 && current === steps[steps.length - 1]);
  }

  function stepFragments(direction) {
    const slide = activeSlide();
    if (!slide) return false;
    const steps = stepsOn(slide);
    if (direction > 0) {
      const next = steps.find(step => !step.every(isRevealed));
      if (!next) return false;
      next.forEach(el => el.classList.add('is-revealed'));
    } else {
      const revealed = steps.filter(step => step.some(isRevealed));
      if (revealed.length === 0) return false;
      revealed[revealed.length - 1].forEach(el => el.classList.remove('is-revealed'));
    }
    markCurrent(slide, steps);
    return true;
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
      markCurrent(slide, stepsOn(slide));
      return;
    }
    frags.forEach(el => el.classList.remove('is-revealed', 'is-current'));
    slide.classList.remove('fragments-done');
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
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
      case 'n':
        direction = 1; break;
      case 'ArrowLeft':
      case 'ArrowUp':
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
