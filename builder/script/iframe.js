// script/iframe.js — keep deck keyboard nav alive when an embedded iframe
// captures focus on click. When an iframe inside the active slide steals
// focus, we blur it and refocus the parent window after the click has
// already registered. Side effect: text inputs inside the iframe won't
// receive typed characters; embeds intended for click-driven interaction.
(() => {
  function refocus() {
    const a = document.activeElement;
    if (!a || a.tagName !== 'IFRAME') return;
    if (!a.classList.contains('iframe-embed')) return;
    a.blur();
    window.focus();
  }
  window.addEventListener('blur', () => {
    setTimeout(refocus, 0);
  });
})();
