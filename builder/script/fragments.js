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
  // revealed in ascending index order, every element of a step at once. The
  // index rides along on each step because a chart can claim a slot in the
  // same order (see script/vega.js's window.deckCharts).
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
    return Array.from(byIndex.keys()).sort((a, b) => a - b)
      .map(index => ({ index, els: byIndex.get(index) }));
  }

  const isRevealed = el => el.classList.contains('is-revealed');

  // .is-current marks the most recently revealed step so decks can highlight
  // it differently from earlier, already-revealed fragments.
  function markCurrent(slide, steps) {
    let current = null;
    for (const step of steps) {
      if (step.els.every(isRevealed)) current = step; else break;
    }
    for (const step of steps) {
      for (const el of step.els) el.classList.toggle('is-current', step === current);
    }
    window.deckSteps?.refresh(slide);
  }

  // Fragment steps are one of the things a slide can owe the presenter, so the
  // footer cue counts them through deck.js rather than owning the class here:
  // a slide whose last advance is a vega signal stage isn't done when its
  // fragments are.
  window.deckSteps?.register(slide => {
    const steps = stepsOn(slide);
    return {
      total: steps.length,
      remaining: steps.filter(step => !step.els.every(isRevealed)).length,
    };
  });

  function stepFragments(direction) {
    const slide = activeSlide();
    if (!slide) return false;
    const steps = stepsOn(slide);
    // A chart holding a slot in this order gets the keypress when the step in
    // hand is at or after it. Declining to consume is what hands the key on:
    // script/vega.js's listener runs next (registration order in the template
    // is fragments -> vega -> three).
    const chartIndex = window.deckCharts?.index(slide) ?? Infinity;
    if (direction > 0) {
      const next = steps.find(step => !step.els.every(isRevealed));
      if (!next) return false;
      if (next.index >= chartIndex && window.deckCharts?.pending(slide, 1)) return false;
      next.els.forEach(el => el.classList.add('is-revealed'));
    } else {
      const revealed = steps.filter(step => step.els.some(isRevealed));
      if (revealed.length === 0) return false;
      const last = revealed[revealed.length - 1];
      if (last.index < chartIndex && window.deckCharts?.pending(slide, -1)) return false;
      last.els.forEach(el => el.classList.remove('is-revealed'));
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
    window.deckSteps?.refresh(slide);
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

  // Print and PDF export have no notion of a current step: every slide lands on
  // the page at once and should print finished. CSS can only force .fragment
  // visible; decks also style on .is-revealed and .is-current (the promise-card
  // verdict strips, the refine and size diagram stages), so the classes have to
  // go on for real and come back off afterwards. Snapshotting className is the
  // cheapest exact restore -- the presenter keeps whatever step they were on.
  //
  // Both mechanisms are wired because neither covers every path on its own:
  // beforeprint/afterprint is what the File > Print route fires, and the
  // matchMedia('print') change is what a headless page.pdf() and Safari give
  // instead. setPrintState is idempotent so a browser firing both is harmless.
  let printSnapshot = null;

  function setPrintState(printing) {
    if (printing) {
      if (printSnapshot) return;
      cancelAuto();
      autoState = 'cancelled';
      printSnapshot = Array.from(document.querySelectorAll('.fragment'))
        .map(el => [el, el.className]);
      for (const slide of document.querySelectorAll('.slide')) {
        const frags = fragmentsOn(slide);
        if (frags.length === 0) continue;
        frags.forEach(el => el.classList.add('is-revealed'));
        markCurrent(slide, stepsOn(slide));
      }
      return;
    }
    if (!printSnapshot) return;
    for (const [el, className] of printSnapshot) el.className = className;
    printSnapshot = null;
    const slide = activeSlide();
    if (slide) window.deckSteps?.refresh(slide);
  }

  document.addEventListener('keydown', onKeyCapture, true);
  document.addEventListener('slide:enter', onSlideEnter);
  window.addEventListener('beforeprint', () => setPrintState(true));
  window.addEventListener('afterprint', () => setPrintState(false));
  window.matchMedia?.('print').addEventListener('change', e => setPrintState(e.matches));

  // deck.js dispatches the first slide:enter before this script registers its
  // listener above, so initialize auto-reveal for the slide already shown.
  const initialSlide = activeSlide();
  if (initialSlide) enterSlide(initialSlide, 'jump');
})();
