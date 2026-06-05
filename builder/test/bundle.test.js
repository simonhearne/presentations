import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inlineLocalAssets,
  inlineGoogleFonts,
  inlineSvgImages,
  inlineRasterImages,
  inlineCssUrls,
  inlineVegaSpecs,
  stripGoogleFontsPreconnect,
} from '../bin/bundle.js';

const lookup = (href) => {
  const map = {
    '../../../css/tokens.css': ':root { --x: 1; }',
    '../../../css/deck.css': '.deck {}',
    '../../../css/layouts.css': '.slide {}',
    '../../../script/deck.js': 'console.log("hi");',
  };
  return map[href] ?? null;
};

test('inlineLocalAssets: inlines relative <link> stylesheets', () => {
  const html = '<link rel="stylesheet" href="../../../css/tokens.css">';
  const out = inlineLocalAssets(html, lookup);
  assert.match(out, /<style>:root \{ --x: 1; \}<\/style>/);
  assert.doesNotMatch(out, /<link rel="stylesheet" href=/);
});

test('inlineLocalAssets: inlines relative <script src>', () => {
  const html = '<script src="../../../script/deck.js"></script>';
  const out = inlineLocalAssets(html, lookup);
  assert.match(out, /<script>console\.log\("hi"\);<\/script>/);
});

test('inlineLocalAssets: leaves https <link> alone', () => {
  const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?x">';
  const out = inlineLocalAssets(html, lookup);
  assert.equal(out, html);
});

test('inlineLocalAssets: leaves https <script> alone', () => {
  const html = '<script src="https://example.com/x.js"></script>';
  const out = inlineLocalAssets(html, lookup);
  assert.equal(out, html);
});

test('inlineLocalAssets: leaves unknown relative paths alone', () => {
  const html = '<link rel="stylesheet" href="../../../css/missing.css">';
  const out = inlineLocalAssets(html, lookup);
  assert.equal(out, html);
});

test('inlineLocalAssets: preserves media attribute when inlining', () => {
  const html = '<link rel="stylesheet" media="print" href="../../../css/tokens.css">';
  const out = inlineLocalAssets(html, lookup);
  assert.match(out, /<style media="print">:root \{ --x: 1; \}<\/style>/);
});

const stubFetch = (urlMap) => async (url) => {
  if (!(url in urlMap)) throw new Error(`unexpected url ${url}`);
  const v = urlMap[url];
  return {
    ok: true,
    text: async () => typeof v === 'string' ? v : '',
    arrayBuffer: async () => v instanceof Uint8Array ? v.buffer : new ArrayBuffer(0),
  };
};

test('inlineGoogleFonts: replaces <link> with inlined @font-face data URIs', async () => {
  const css = `@font-face { font-family: 'Inter'; src: url(https://fonts.gstatic.com/s/inter/x.woff2) format('woff2'); }`;
  const woff = new Uint8Array([1, 2, 3, 4]);
  const fetchFn = stubFetch({
    'https://fonts.googleapis.com/css2?family=Inter': css,
    'https://fonts.gstatic.com/s/inter/x.woff2': woff,
  });
  const html = '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">';
  const out = await inlineGoogleFonts(html, fetchFn);
  assert.match(out, /<style>[\s\S]*data:font\/woff2;base64,AQIDBA==[\s\S]*<\/style>/);
  assert.doesNotMatch(out, /<link[^>]+fonts\.googleapis\.com/);
});

test('inlineGoogleFonts: no-op when no Google Fonts link present', async () => {
  const html = '<link rel="stylesheet" href="local.css">';
  const out = await inlineGoogleFonts(html, stubFetch({}));
  assert.equal(out, html);
});

const svgLookup = (path) => {
  const map = {
    '../../../img/zilliz-spark.svg': '<svg viewBox="0 0 100 100"><line x1="0" y1="0" x2="10" y2="10"/></svg>',
  };
  return map[path] ?? null;
};

test('inlineSvgImages: replaces img with inline svg', () => {
  const html = '<img src="../../../img/zilliz-spark.svg">';
  const out = inlineSvgImages(html, svgLookup);
  assert.match(out, /<svg viewBox="0 0 100 100"/);
  assert.doesNotMatch(out, /<img/);
});

test('inlineSvgImages: transfers class onto inlined svg', () => {
  const html = '<img class="logo big" src="../../../img/zilliz-spark.svg">';
  const out = inlineSvgImages(html, svgLookup);
  assert.match(out, /<svg[^>]+class="logo big"[^>]+viewBox=/);
});

test('inlineSvgImages: transfers id onto inlined svg', () => {
  const html = '<img id="x" src="../../../img/zilliz-spark.svg">';
  const out = inlineSvgImages(html, svgLookup);
  assert.match(out, /<svg[^>]+id="x"/);
});

test('inlineSvgImages: leaves unknown svg paths alone', () => {
  const html = '<img src="../../../img/missing.svg">';
  const out = inlineSvgImages(html, svgLookup);
  assert.equal(out, html);
});

test('inlineSvgImages: ignores non-svg images', () => {
  const html = '<img src="cat.png">';
  const out = inlineSvgImages(html, svgLookup);
  assert.equal(out, html);
});

const rasterLookup = (path) => {
  const map = {
    '../../../img/photo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    '../../../img/photo.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
  };
  return map[path] ?? null;
};

test('inlineRasterImages: replaces img with base64 data URI', () => {
  const html = '<img src="../../../img/photo.png">';
  const out = inlineRasterImages(html, rasterLookup, { skip: false });
  assert.match(out, /src="data:image\/png;base64,iVBORw==/);
});

test('inlineRasterImages: picks correct mime for jpg', () => {
  const html = '<img src="../../../img/photo.jpg">';
  const out = inlineRasterImages(html, rasterLookup, { skip: false });
  assert.match(out, /src="data:image\/jpeg;base64,/);
});

test('inlineRasterImages: skip=true is a no-op', () => {
  const html = '<img src="../../../img/photo.png">';
  const out = inlineRasterImages(html, rasterLookup, { skip: true });
  assert.equal(out, html);
});

test('inlineRasterImages: leaves svg paths alone', () => {
  const html = '<img src="../../../img/x.svg">';
  const out = inlineRasterImages(html, rasterLookup, { skip: false });
  assert.equal(out, html);
});

const cssLookup = (path) => {
  const map = {
    '../../../img/bg.svg': '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    '../../../img/photo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  };
  return map[path] ?? null;
};

test('inlineCssUrls: rewrites svg url() to data:image/svg+xml;utf8,', () => {
  const html = '<style>.x { background: url(../../../img/bg.svg); }</style>';
  const out = inlineCssUrls(html, cssLookup, { skipRaster: false });
  assert.match(out, /url\("data:image\/svg\+xml;utf8,/);
  assert.match(out, /%3Csvg/);
});

test('inlineCssUrls: rewrites raster url() to base64', () => {
  const html = '<style>.x { background: url(../../../img/photo.png); }</style>';
  const out = inlineCssUrls(html, cssLookup, { skipRaster: false });
  assert.match(out, /url\("data:image\/png;base64,/);
});

test('inlineCssUrls: skipRaster keeps raster url() unchanged', () => {
  const html = '<style>.x { background: url(../../../img/photo.png); }</style>';
  const out = inlineCssUrls(html, cssLookup, { skipRaster: true });
  assert.equal(out, html);
});

test('inlineCssUrls: rewrites svg even when skipRaster=true', () => {
  const html = '<style>.x { background: url(../../../img/bg.svg); }</style>';
  const out = inlineCssUrls(html, cssLookup, { skipRaster: true });
  assert.match(out, /data:image\/svg\+xml;utf8,/);
});

test('stripGoogleFontsPreconnect: removes both googleapis and gstatic preconnect tags', () => {
  const html = '<head>\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n</head>';
  const out = stripGoogleFontsPreconnect(html);
  assert.doesNotMatch(out, /preconnect/);
});

test('stripGoogleFontsPreconnect: leaves unrelated preconnect tags alone', () => {
  const html = '<link rel="preconnect" href="https://example.com">';
  const out = stripGoogleFontsPreconnect(html);
  assert.equal(out, html);
});

test('inlineVegaSpecs: inlines local JSON spec as base64 data URI', () => {
  const html = '<div class="vega-chart vega-embed" data-spec="scatter.json"></div>';
  const out = inlineVegaSpecs(html, (rel) => rel === 'scatter.json' ? '{"mark":"circle"}' : null);
  const expected = Buffer.from('{"mark":"circle"}', 'utf8').toString('base64');
  assert.match(out, new RegExp(`data-spec="data:application/json;base64,${expected}"`));
});

test('inlineVegaSpecs: leaves http(s) URLs alone', () => {
  const html = '<div data-spec="https://example.com/spec.json"></div>';
  const out = inlineVegaSpecs(html, () => 'should not be used');
  assert.equal(out, html);
});

test('inlineVegaSpecs: leaves unknown relative paths alone', () => {
  const html = '<div data-spec="missing.json"></div>';
  const out = inlineVegaSpecs(html, () => null);
  assert.equal(out, html);
});
