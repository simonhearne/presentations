// script/iframe.js — runtime for iframe embeds: host probing and focus rescue.
//
// Probing: an iframe gives no usable signal when its host is unreachable —
// `onerror` doesn't fire for a refused connection or a cross-origin failure,
// and we can't read into the frame to check. So before loading anything we
// send a no-cors GET at the host: an opaque response means something answered,
// a rejection means refused / blocked / timed out. Frames therefore ship with
// `data-src` and only get a real `src` once that probe passes; until then the
// slide shows its `iframe-fallback` content instead. No JS at all — print, PDF
// export, a saved copy of the deck — means the fallback is simply what renders.
//
// Focus rescue: when an embedded page steals focus on click, we blur it and
// refocus the parent so deck keys keep working. Side effect: text inputs
// inside the frame won't receive typed characters. Opt out per embed with
// `nav: passthrough` — the frame keeps focus (typing works), and deck keys
// resume after a click on the deck's own chrome or footer.
(() => {
  const DEFAULT_TIMEOUT_MS = 1500;

  function setState(frame, state) {
    const slide = frame.closest('.slide');
    if (!slide) return;
    slide.dataset.iframeState = state;
    slide.classList.toggle('iframe-live', state === 'live');
    if (state === 'live' && frame.dataset.src && frame.src !== frame.dataset.src) {
      frame.src = frame.dataset.src;
    }
  }

  function probe(frame) {
    if (frame.dataset.probing === 'true') return;
    const url = frame.dataset.src;
    if (!url) return;
    if (frame.dataset.probe === 'false') {
      setState(frame, 'live');
      return;
    }
    const target = frame.dataset.probe || url;
    const timeout = Number(frame.dataset.probeTimeout) || DEFAULT_TIMEOUT_MS;
    frame.dataset.probing = 'true';
    fetch(target, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    }).then(
      () => setState(frame, 'live'),
      () => setState(frame, 'offline')
    ).finally(() => {
      frame.dataset.probing = 'false';
    });
  }

  const frames = Array.from(document.querySelectorAll('.iframe-embed'));
  frames.forEach(frame => {
    setState(frame, 'pending');
    probe(frame);
  });

  // Re-probe on entry so a demo started after the deck was opened still gets
  // picked up — navigate away and back rather than reloading the deck.
  document.addEventListener('slide:enter', e => {
    const slide = e.detail && e.detail.slide;
    if (!slide || slide.dataset.iframeState === 'live') return;
    slide.querySelectorAll('.iframe-embed').forEach(probe);
  });

  function refocus() {
    const a = document.activeElement;
    if (!a || a.tagName !== 'IFRAME') return;
    if (!a.classList.contains('iframe-embed')) return;
    if (a.dataset.nav === 'passthrough') return;
    a.blur();
    window.focus();
  }
  window.addEventListener('blur', () => {
    setTimeout(refocus, 0);
  });
})();
