// script/vega.js — runtime for embedding Vega/Vega-Lite charts on slides
(() => {
  const ANIMATE_PREFIX = 'animate';
  const SIGNAL_PREFIX = 'signal';

  // Zilliz brand Vega theme. Hex literals are duplicated from css/tokens.css
  // (Vega config can't read CSS variables at render time) — same precedent as
  // DOT_DEFAULTS in bin/build.js and the three.js colour constants.
  const BRAND = {
    blue: '#175fff', navy: '#061982', berry: '#c84cff', purple: '#7f47ff',
    sky: '#49bcff', green: '#00dcc6', orange: '#f59e0b', ink: '#1e293b',
    font: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'IBM Plex Mono, ui-monospace, monospace',
  };

  // A brand config merged under every spec, so charts inherit Zilliz styling
  // without per-spec theme blocks. The spec's own config takes precedence, so
  // explicit colours/ranges in a spec are preserved. isDark swaps text/axis
  // colours for charts on dark slides (.dark/.title/.hero/.bg).
  function brandConfig(isDark) {
    const ink = isDark ? '#ffffff' : BRAND.ink;
    const axisLabel = isDark ? '#cbd5e1' : '#475569';
    const axisTitle = isDark ? '#ffffff' : BRAND.ink;
    const grid = isDark ? '#1e293b' : '#eef2f7';
    const domain = isDark ? '#334155' : '#cbd5e1';
    const gradientFill = {
      gradient: 'linear', x1: 0, y1: 1, x2: 0, y2: 0,
      stops: [{ offset: 0, color: BRAND.blue }, { offset: 1, color: BRAND.purple }],
    };
    return {
      background: 'transparent',
      font: BRAND.font,
      view: { stroke: 'transparent' },
      title: {
        font: BRAND.font, subtitleFont: BRAND.font,
        color: ink, subtitleColor: axisLabel,
        fontSize: 19, fontWeight: 600, anchor: 'start',
      },
      axis: {
        labelFont: BRAND.font, titleFont: BRAND.font,
        labelColor: axisLabel, titleColor: axisTitle,
        labelFontSize: 15, titleFontSize: 17, titleFontWeight: 600,
        domainColor: domain, tickColor: domain, gridColor: grid,
        labelPadding: 4, tickSize: 5,
      },
      legend: {
        labelFont: BRAND.font, titleFont: BRAND.font,
        labelColor: axisLabel, titleColor: axisTitle,
        labelFontSize: 13, titleFontSize: 14, titleFontWeight: 600,
        symbolType: 'circle',
      },
      range: {
        category: [BRAND.blue, BRAND.berry, BRAND.green, BRAND.purple, BRAND.sky, BRAND.orange, BRAND.navy],
        ramp: ['#e6f0ff', BRAND.sky, BRAND.blue, BRAND.navy],
        heatmap: ['#e6f0ff', BRAND.sky, BRAND.blue, BRAND.navy],
        diverging: [BRAND.navy, BRAND.blue, '#e6f0ff', '#fbe6ff', BRAND.berry],
      },
      bar: { fill: gradientFill },
      rect: { fill: gradientFill },
      area: { fill: gradientFill, fillOpacity: 0.85, line: { color: BRAND.blue, strokeWidth: 2 } },
      point: { fill: BRAND.blue, filled: true, size: 80 },
      circle: { fill: BRAND.blue },
      line: { stroke: BRAND.blue, strokeWidth: 3, strokeCap: 'round', strokeJoin: 'round' },
      text: { font: BRAND.font, fill: ink },
      rule: { stroke: domain },
    };
  }

  function isPlainObject(x) {
    return x != null && typeof x === 'object' && !Array.isArray(x);
  }

  // Recursive merge: nested objects merge, everything else (scalars, arrays)
  // is taken from override. Used to layer a spec's config over the brand base.
  function deepMerge(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
      return override === undefined ? base : override;
    }
    const out = { ...base };
    for (const key of Object.keys(override)) {
      out[key] = isPlainObject(base[key]) && isPlainObject(override[key])
        ? deepMerge(base[key], override[key])
        : override[key];
    }
    return out;
  }

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
      if (key === 'spec') continue;
      if (key === 'theme') continue;
      if (key.startsWith(ANIMATE_PREFIX)) continue;
      if (key.startsWith(SIGNAL_PREFIX)) continue;
      opts[key] = parseValue(raw);
    }
    return opts;
  }

  // Seed vega signals from data-signal-<name> dataset entries.
  // Camel-cased dataset keys (e.g. signalStage) are converted to the signal
  // name (stage) before being applied. Unknown signal names warn and skip.
  // If the parsed value is an array, the signal becomes step-driven: the
  // first element is seeded now, and remaining elements are stepped through
  // via ArrowRight/Left (see applyStepper).
  function applySignals(el, view) {
    let touched = false;
    for (const [key, raw] of Object.entries(el.dataset)) {
      if (!key.startsWith(SIGNAL_PREFIX) || key === SIGNAL_PREFIX) continue;
      const sigName = key.slice(SIGNAL_PREFIX.length, SIGNAL_PREFIX.length + 1).toLowerCase()
        + key.slice(SIGNAL_PREFIX.length + 1);
      const value = parseValue(raw);
      const isStepList = Array.isArray(value) && value.length > 0;
      const seed = isStepList ? value[0] : value;
      try {
        view.signal(sigName, seed);
        touched = true;
        if (isStepList) {
          (el.__vegaSteps ||= []).push({ name: sigName, values: value, index: 0 });
        }
      } catch (err) {
        console.warn(`vega signal "${sigName}" not found on`, el.id || el, err.message);
      }
    }
    if (touched) view.runAsync();
  }

  function activeSlideCharts() {
    const slide = document.querySelector('.slide.is-current');
    if (!slide) return [];
    return Array.from(slide.querySelectorAll('.vega-chart'));
  }

  function stepCharts(direction) {
    let consumed = false;
    for (const el of activeSlideCharts()) {
      const steps = el.__vegaSteps;
      const view = el.__vegaView;
      if (!steps || !steps.length || !view) continue;
      for (const s of steps) {
        const next = s.index + direction;
        if (next < 0 || next >= s.values.length) continue;
        s.index = next;
        try { view.signal(s.name, s.values[next]); consumed = true; }
        catch (err) { console.warn(`vega step signal "${s.name}" failed on`, el.id || el, err.message); }
      }
      if (consumed) view.runAsync();
    }
    return consumed;
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
    if (stepCharts(direction)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Drive a vega signal over time, optionally gated by a trigger signal.
  // Data attributes:
  //   data-animate-signal         — name of signal to step (required to activate)
  //   data-animate-from           — start value (default 0)
  //   data-animate-to             — end value (number) OR
  //   data-animate-to-data        — name of a data source whose length is "to"
  //   data-animate-step-ms        — ms between steps (default 80)
  //   data-animate-step           — increment per tick (default 1)
  //   data-animate-loop           — "true" to loop on reaching end (default false)
  //   data-animate-trigger        — name of signal that gates animation
  //   data-animate-trigger-value  — value that activates (parsed; default true)
  function applyAnimator(el, view) {
    const signal = el.dataset.animateSignal;
    if (!signal) return;
    const from = Number(el.dataset.animateFrom ?? 0);
    const toRaw = el.dataset.animateTo;
    const toData = el.dataset.animateToData;
    const stepMs = Number(el.dataset.animateStepMs ?? 80);
    const step = Number(el.dataset.animateStep ?? 1);
    const loop = el.dataset.animateLoop === 'true';
    const triggerSignal = el.dataset.animateTrigger;
    const triggerValue = el.dataset.animateTriggerValue == null
      ? true
      : parseValue(el.dataset.animateTriggerValue);

    let timer = null;

    function endValue() {
      if (toData) {
        const d = view.data(toData);
        return d ? d.length : 0;
      }
      return Number(toRaw ?? 0);
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function reset() {
      stop();
      view.signal(signal, from).runAsync();
    }

    function start() {
      stop();
      view.signal(signal, from).runAsync();
      timer = setInterval(() => {
        const cur = view.signal(signal);
        const end = endValue();
        if (cur >= end) {
          if (loop) { view.signal(signal, from).runAsync(); }
          else { stop(); view.signal(signal, end + step).runAsync(); }
          return;
        }
        view.signal(signal, Math.min(cur + step, end)).runAsync();
      }, stepMs);
    }

    if (triggerSignal) {
      // Defer to a microtask so start/reset's runAsync doesn't re-enter a
      // dataflow still resolving from whatever changed the trigger (e.g. the
      // signal stepper's own runAsync). Harmless for event-driven triggers.
      const onChange = (_, value) => {
        Promise.resolve().then(() => {
          if (value === triggerValue) start();
          else reset();
        });
      };
      view.addSignalListener(triggerSignal, onChange);
      if (view.signal(triggerSignal) === triggerValue) start();
    } else {
      start();
    }
  }

  function embedAll() {
    if (typeof vegaEmbed !== 'function') return;
    const charts = document.querySelectorAll('.vega-chart[data-spec]');
    charts.forEach(el => {
      let rect = el.getBoundingClientRect();
      const spec = el.dataset.spec;
      const opts = optionsFromDataset(el);
      // Apply the brand theme as the config base. data-theme forces a variant;
      // otherwise dark slides (.dark/.title/.hero/.bg, all white-text) get the
      // dark variant. Any author-supplied data-config stays on top.
      const section = el.closest('section');
      const isDark = el.dataset.theme
        ? el.dataset.theme === 'dark'
        : !!(section && section.matches('.dark, .title, .hero, .bg'));
      opts.config = deepMerge(brandConfig(isDark), opts.config || {});
      vegaEmbed(el, spec, opts).then(result => {
        el.__vegaView = result.view;
        // applySignals must run before applyAnimator so trigger-value checks see seeded state.
        try { applySignals(el, result.view); } catch (err) { console.error('vega signals failed for', el.id || el, err); }
        try { applyAnimator(el, result.view); } catch (err) { console.error('vega animator failed for', el.id || el, err); }
        // const svgRect = el.querySelector('svg')?.getBoundingClientRect();
        // const containerRect = el.getBoundingClientRect();
        // if (svgRect && containerRect && svgRect.width > 0 && svgRect.height > 0) {
        //   const scale = Math.min(containerRect.width / svgRect.width, containerRect.height / svgRect.height);
        //   el.style.transformOrigin = 'top left';
        //   el.style.transform = `scale(${scale})`;
        // }
      }).catch(err => {
        console.error('vega-embed failed for', el.id || el, err);
      });
    });
  }

  document.addEventListener('keydown', onKeyCapture, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', embedAll);
  } else {
    embedAll();
  }
})();
