import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// script/iframe.js is browser runtime with no exports, so it's exercised by
// running the real source in a vm against a stubbed DOM and recording whether
// the host probe fired.
const SRC = readFileSync(fileURLToPath(new URL('../script/iframe.js', import.meta.url)), 'utf8');

function runRuntime({ href, target, probe }) {
  const url = new URL(href);
  let fetched = null;
  const slide = { dataset: {}, classList: { toggle() {} }, querySelectorAll: () => [] };
  const frame = {
    dataset: { src: target, ...(probe === undefined ? {} : { probe }) },
    closest: () => slide,
    classList: { contains: () => true },
  };
  vm.runInNewContext(SRC, {
    location: { href, protocol: url.protocol, hostname: url.hostname, search: url.search },
    document: { querySelectorAll: () => [frame], addEventListener() {}, activeElement: null },
    window: { addEventListener() {}, focus() {} },
    setTimeout,
    URL,
    URLSearchParams,
    AbortSignal,
    Array,
    Number,
    fetch: t => {
      fetched = t;
      return Promise.reject(new Error('refused'));
    },
  });
  return { probed: fetched !== null, state: slide.dataset.iframeState };
}

const HOSTED = 'https://talks.simonhearne.com/deck/';

test('iframe probe: a public-origin deck skips local targets', () => {
  for (const target of [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://192.168.1.5:8080',
    'http://10.1.2.3:8080',
    'http://172.20.0.4:8080',
    'http://mac.local:8080',
  ]) {
    const r = runRuntime({ href: HOSTED, target });
    assert.equal(r.probed, false, `expected no probe for ${target}`);
    assert.equal(r.state, 'offline');
  }
});

test('iframe probe: a public-origin deck still probes public targets', () => {
  for (const target of ['https://demo.example.com', 'http://172.15.0.4:8080']) {
    assert.equal(runRuntime({ href: HOSTED, target }).probed, true, `expected probe for ${target}`);
  }
});

test('iframe probe: a locally served deck probes local targets', () => {
  for (const href of [
    'http://localhost:8000/deck/',
    'http://127.0.0.1:8000/deck/',
    'http://192.168.1.5:8000/deck/',
    'file:///Users/simon/dist/index.html',
  ]) {
    const r = runRuntime({ href, target: 'http://localhost:8080' });
    assert.equal(r.probed, true, `expected probe when served from ${href}`);
  }
});

test('iframe probe: ?simon=true forces the probe from a public origin', () => {
  assert.equal(runRuntime({ href: `${HOSTED}?simon=true`, target: 'http://localhost:8080' }).probed, true);
  assert.equal(runRuntime({ href: `${HOSTED}?simon=false`, target: 'http://localhost:8080' }).probed, false);
});

test('iframe probe: probe:false loads the frame regardless of origin', () => {
  const r = runRuntime({ href: HOSTED, target: 'http://localhost:8080', probe: 'false' });
  assert.equal(r.state, 'live');
  assert.equal(r.probed, false);
});
