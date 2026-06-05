// bin/bundle.js — Pipeline 2: HTML + assets → single HTML

import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINK_RE = /<link\b([^>]*)>/g;
const SCRIPT_RE = /<script\s+src="([^"]+)"><\/script>/g;

function isRelative(href) {
  return !/^(https?:)?\/\//.test(href) && !href.startsWith('data:');
}

export function inlineLocalAssets(html, lookup) {
  let out = html.replace(LINK_RE, (match, attrs) => {
    if (!/\brel="stylesheet"/i.test(attrs)) return match;
    const hrefMatch = attrs.match(/\bhref="([^"]+)"/i);
    if (!hrefMatch) return match;
    const href = hrefMatch[1];
    if (!isRelative(href)) return match;
    const css = lookup(href);
    if (css == null) return match;
    const mediaMatch = attrs.match(/\bmedia="([^"]+)"/i);
    const mediaAttr = mediaMatch ? ` media="${mediaMatch[1]}"` : '';
    return `<style${mediaAttr}>${css}</style>`;
  });
  out = out.replace(SCRIPT_RE, (match, src) => {
    if (!isRelative(src)) return match;
    const js = lookup(src);
    return js == null ? match : `<script>${js}</script>`;
  });
  return out;
}

const GFONTS_LINK_RE = /<link\s+(?:[^>]*?\s+)?href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"[^>]*>/g;
const GSTATIC_URL_RE = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.(woff2|woff|ttf|otf))\)/g;

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fontMime(url) {
  const ext = url.split('.').pop().split('?')[0].toLowerCase();
  if (ext === 'woff2') return 'font/woff2';
  if (ext === 'woff') return 'font/woff';
  if (ext === 'ttf') return 'font/ttf';
  if (ext === 'otf') return 'font/otf';
  throw new Error(`fontMime: unrecognized font extension in ${url}`);
}

async function fetchText(fetchFn, url) {
  const r = await fetchFn(url, { headers: { 'User-Agent': CHROME_UA } });
  if (!r.ok) throw new Error(`fetch failed ${url}: ${r.status}`);
  return r.text();
}

async function fetchBase64(fetchFn, url) {
  const r = await fetchFn(url);
  if (!r.ok) throw new Error(`fetch failed ${url}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.toString('base64');
}

const IMG_SVG_RE = /<img\b([^>]*?)\bsrc="([^"]+\.svg)"([^>]*)>/g;

function getAttr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

export function inlineSvgImages(html, lookup) {
  return html.replace(IMG_SVG_RE, (match, before, src, after) => {
    if (!isRelative(src)) return match;
    const svg = lookup(src);
    if (svg == null) return match;
    const attrs = before + after;
    const cls = getAttr(attrs, 'class');
    const id = getAttr(attrs, 'id');
    let out = svg.replace(/<svg\b([^>]*)>/i, (_m, svgAttrs) => {
      let prefix = '';
      if (cls && !/\bclass=/i.test(svgAttrs)) prefix += ` class="${cls}"`;
      if (id && !/\bid=/i.test(svgAttrs)) prefix += ` id="${id}"`;
      return `<svg${prefix}${svgAttrs}>`;
    });
    return out;
  });
}

export async function inlineGoogleFonts(html, fetchFn) {
  const matches = [...html.matchAll(GFONTS_LINK_RE)];
  if (matches.length === 0) return html;
  let out = html;
  for (const m of matches) {
    const url = m[1];
    let css = await fetchText(fetchFn, url);
    const fontUrls = [...css.matchAll(GSTATIC_URL_RE)].map(x => x[1]);
    for (const fontUrl of new Set(fontUrls)) {
      const b64 = await fetchBase64(fetchFn, fontUrl);
      const dataUri = `data:${fontMime(fontUrl)};base64,${b64}`;
      css = css.split(fontUrl).join(dataUri);
    }
    out = out.replace(m[0], `<style>${css}</style>`);
  }
  return out;
}

const IMG_RASTER_RE = /<img\b([^>]*?)\bsrc="([^"]+\.(?:png|jpe?g|webp))"([^>]*)>/gi;
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const STYLE_BLOCK_RE = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g;

function rasterMime(path) {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

export function inlineRasterImages(html, lookup, { skip = false } = {}) {
  if (skip) return html;
  return html.replace(IMG_RASTER_RE, (match, before, src, after) => {
    if (!isRelative(src)) return match;
    const bytes = lookup(src);
    if (bytes == null) return match;
    const dataUri = `data:${rasterMime(src)};base64,${bytesToBase64(bytes)}`;
    return `<img${before}src="${dataUri}"${after}>`;
  });
}

const VEGA_SPEC_RE = /\bdata-spec="([^"]+\.json)"/g;

export function inlineVegaSpecs(html, lookup) {
  return html.replace(VEGA_SPEC_RE, (match, src) => {
    if (!isRelative(src)) return match;
    const json = lookup(src);
    if (json == null) return match;
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    return `data-spec="data:application/json;base64,${b64}"`;
  });
}

export function inlineCssUrls(html, lookup, { skipRaster = false } = {}) {
  return html.replace(STYLE_BLOCK_RE, (_match, openTag, css, closeTag) => {
    const rewritten = css.replace(CSS_URL_RE, (m, q, ref) => {
      if (!isRelative(ref)) return m;
      const isSvg = ref.toLowerCase().endsWith('.svg');
      const isRaster = /\.(png|jpe?g|webp)$/i.test(ref);
      const value = lookup(ref);
      if (value == null) return m;
      if (isSvg) {
        const encoded = encodeURIComponent(value).replace(/'/g, '%27');
        return `url("data:image/svg+xml;utf8,${encoded}")`;
      }
      if (isRaster) {
        if (skipRaster) return m;
        return `url("data:${rasterMime(ref)};base64,${bytesToBase64(value)}")`;
      }
      return m;
    });
    return openTag + rewritten + closeTag;
  });
}

const PRECONNECT_RE = /\s*<link\s+(?:[^>]*?\s+)?rel="preconnect"[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>/g;

export function stripGoogleFontsPreconnect(html) {
  return html.replace(PRECONNECT_RE, '');
}

function makeFsLookup(htmlPath) {
  const baseDir = dirname(htmlPath);
  return (relPath, { binary = false } = {}) => {
    try {
      const abs = resolve(baseDir, relPath);
      return binary ? readFileSync(abs) : readFileSync(abs, 'utf8');
    } catch {
      return null;
    }
  };
}

export async function bundleDeck(talkDir, { noImages = false, fetchFn = fetch } = {}) {
  const htmlPath = resolve(talkDir, 'dist', 'index.html');
  let html = readFileSync(htmlPath, 'utf8');

  const textLookup = makeFsLookup(htmlPath);
  const binaryLookup = (rel) => textLookup(rel, { binary: true });

  // Order matters: fonts first (they introduce a new <style> block), then text,
  // then SVG images (they introduce inline <svg>), then raster, then CSS urls
  // inside any <style> block we now have.
  html = await inlineGoogleFonts(html, fetchFn);
  html = stripGoogleFontsPreconnect(html);
  html = inlineLocalAssets(html, textLookup);
  html = inlineSvgImages(html, textLookup);
  html = inlineVegaSpecs(html, textLookup);
  html = inlineRasterImages(html, binaryLookup, { skip: noImages });
  html = inlineCssUrls(html, (rel) => {
    if (rel.toLowerCase().endsWith('.svg')) return textLookup(rel);
    return binaryLookup(rel);
  }, { skipRaster: noImages });

  const outPath = resolve(talkDir, 'dist', 'bundle.html');
  writeFileSync(outPath, html);
  return outPath;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const args = process.argv.slice(2);
  const noImages = args.includes('--no-images');
  const talkDir = args.find(a => !a.startsWith('--'));
  if (!talkDir) {
    console.error('usage: node bin/bundle.js <talk-dir> [--no-images]');
    process.exit(2);
  }
  bundleDeck(resolve(talkDir), { noImages }).then(out => {
    console.log(`bundled ${out}`);
  }).catch(err => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
