// bin/build.js — Pipeline 1: md → HTML

import { marked } from 'marked';
import { Graphviz } from '@hpcc-js/wasm-graphviz';
import { readFileSync, writeFileSync, mkdirSync, realpathSync, copyFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

marked.use({
  renderer: {
    html(token) {
      const raw = typeof token === 'string' ? token : token.text;
      return raw.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    },
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img loading="lazy" alt="${escapeHtml(text)}" src="${escapeHtml(href)}"${titleAttr}>`;
    }
  },
});

export function splitSlides(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const chunks = [];
  let current = [];
  let inFence = false;
  let fenceMarker = '';

  for (const line of lines) {
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceMatch[1];
      } else if (line.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = '';
      }
      current.push(line);
      continue;
    }
    if (!inFence && line === '---') {
      chunks.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  chunks.push(current.join('\n'));
  return chunks;
}

const ATTR_RE = /^\{\s*((?:\.[\w-]+|[\w-]+=[^\s}]+)(?:\s+(?:\.[\w-]+|[\w-]+=[^\s}]+))*)\s*\}\s*$/;

export function parseAttrs(chunk) {
  const lines = chunk.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return { classes: [], attrs: {}, body: chunk };
  const m = lines[i].match(ATTR_RE);
  if (!m) return { classes: [], attrs: {}, body: chunk };
  const classes = [];
  const attrs = {};
  for (const tok of m[1].split(/\s+/)) {
    if (tok.startsWith('.')) {
      classes.push(tok.slice(1));
    } else {
      const eq = tok.indexOf('=');
      attrs[tok.slice(0, eq)] = tok.slice(eq + 1);
    }
  }
  const body = lines.slice(i + 1).join('\n');
  return { classes, attrs, body };
}

export function slugify(text) {
  const s = (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return s || 'slide';
}

export function extractTitle(html) {
  const m = html.match(/<(h1|h2)[^>]*>([\s\S]*?)<\/\1>/i);
  if (!m) return null;
  return m[2].replace(/<[^>]+>/g, '').trim();
}

// const SPARK_INLINE = '<svg width="40" height="40" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.2815 32.3162V47.5339H25.2524V29.3107L33.1523 42.9936C34.0462 42.5564 34.9052 42.0588 35.7238 41.5059L27.076 26.5275L36.5995 29.9938C37.0292 29.1099 37.3702 28.1749 37.6111 27.2004L32.2589 25.2524H47.5339V22.2815H29.3106L42.9937 14.3816C42.5565 13.4877 42.0588 12.6287 41.5059 11.8101L26.6162 20.4066L30.0532 10.9636C29.1712 10.5297 28.2378 10.1843 27.2646 9.93893L25.2524 15.4675V0H22.2815V18.2232L14.3816 4.54022C13.4877 4.9774 12.6287 5.4751 11.8101 6.02797L20.422 20.9441L10.9549 17.4984C10.5223 18.381 10.1782 19.3148 9.93411 20.2884L15.4103 22.2815H0V25.2524H18.2232L4.54024 33.1522C4.97743 34.0462 5.47512 34.9051 6.02799 35.7237L21.0328 27.0607L17.5579 36.6081C18.4423 37.0365 19.3778 37.3763 20.3526 37.6158L22.2815 32.3162Z" fill="currentColor"/></svg>';
const SPARK_INLINE = '<svg width="40" height="40"><use href="#spark"/></svg>'
export const BRAND_FOOTER = 'milvus.io | zilliz.com';

export function parseAttrList(raw) {
  const tokens = String(raw).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const classes = [];
  for (const t of tokens) {
    if (!/^\.[a-zA-Z_][a-zA-Z0-9_-]*$/.test(t)) return null;
    classes.push(t.slice(1));
  }
  return classes;
}

const INLINE_FRAGMENT_RE = /\[([^\]\n]+)\]\{([^}\n]+)\}/g;
const BLOCK_FRAGMENT_RE = /[ \t]*\{([^}\n]+)\}\s*<\/(li|p|h[1-6]|blockquote)>/g;

function mergeClassesIntoOpenTag(html, openIndex, classes) {
  // openIndex points at the '<' of an opening tag.
  const end = html.indexOf('>', openIndex);
  if (end === -1) return html;
  const tag = html.slice(openIndex, end);  // e.g. '<p class="lead"'  or  '<li'
  const attrMatch = tag.match(/\sclass="([^"]*)"/);
  let replaced;
  if (attrMatch) {
    const merged = (attrMatch[1] + ' ' + classes.join(' ')).trim();
    replaced = tag.replace(/\sclass="[^"]*"/, ` class="${merged}"`);
  } else {
    replaced = tag + ` class="${classes.join(' ')}"`;
  }
  return html.slice(0, openIndex) + replaced + html.slice(end);
}

function findMatchingOpener(html, closeIndex, name) {
  // Walk forward through opens/closes before closeIndex, account for nesting depth.
  const openRe = new RegExp(`<${name}(?:\\s[^>]*)?>`, 'g');
  const closeRe = new RegExp(`</${name}>`, 'g');
  const opens = [];
  let m;
  while ((m = openRe.exec(html)) && m.index < closeIndex) opens.push(m.index);
  const closes = [];
  while ((m = closeRe.exec(html)) && m.index < closeIndex) closes.push(m.index);
  const stack = [];
  let oi = 0, ci = 0;
  while (oi < opens.length || ci < closes.length) {
    const o = oi < opens.length ? opens[oi] : Infinity;
    const c = ci < closes.length ? closes[ci] : Infinity;
    if (o < c) { stack.push(o); oi++; }
    else { stack.pop(); ci++; }
  }
  return stack.length ? stack[stack.length - 1] : -1;
}

export function applyFragmentAttrs(html) {
  let out = html.replace(INLINE_FRAGMENT_RE, (match, text, attrs) => {
    const classes = parseAttrList(attrs);
    if (!classes) return match;
    return `<span class="${classes.join(' ')}">${text}</span>`;
  });

  // Block pass: collect matches first (so right-to-left rewriting doesn't invalidate indices).
  const matches = [];
  let m;
  BLOCK_FRAGMENT_RE.lastIndex = 0;
  while ((m = BLOCK_FRAGMENT_RE.exec(out)) !== null) {
    matches.push({ index: m.index, length: m[0].length, attrs: m[1], name: m[2] });
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const { index, length, attrs, name } = matches[i];
    const classes = parseAttrList(attrs);
    if (!classes) continue;
    const openIndex = findMatchingOpener(out, index, name);
    if (openIndex === -1) continue;
    // Strip marker (keep the closing tag).
    const closeStart = index + length - (`</${name}>`).length;
    out = out.slice(0, index) + out.slice(closeStart);
    out = mergeClassesIntoOpenTag(out, openIndex, classes);
  }
  return out;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function parseKvList(body, label) {
  const lines = String(body).replace(/\r\n/g, '\n').split('\n');
  const items = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    const itemMatch = raw.match(/^-\s+(.*)$/);
    if (itemMatch) {
      current = {};
      items.push(current);
      const kv = itemMatch[1];
      const colon = kv.indexOf(':');
      if (colon === -1) {
        throw new Error(`${label}: expected "key: value" after "- " on line ${i + 1}: ${raw}`);
      }
      current[kv.slice(0, colon).trim()] = kv.slice(colon + 1).trim();
      continue;
    }
    const indented = raw.match(/^\s+(.*)$/);
    if (indented && current) {
      const kv = indented[1];
      const colon = kv.indexOf(':');
      if (colon === -1) {
        throw new Error(`${label}: expected "key: value" on line ${i + 1}: ${raw}`);
      }
      current[kv.slice(0, colon).trim()] = kv.slice(colon + 1).trim();
      continue;
    }
    throw new Error(`${label}: unexpected line ${i + 1}: ${raw}`);
  }
  return items;
}

function extractFencedBlock(chunk, blockName, placeholder = null) {
  const lines = String(chunk).replace(/\r\n/g, '\n').split('\n');
  let inOuterFence = false;
  let outerMarker = '';
  let start = -1;
  let end = -1;
  let fenceMarker = '';
  const headerRe = new RegExp(`^(\`\`\`|~~~)${blockName}\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (start === -1) {
      const openOuter = line.match(/^(```|~~~)/);
      if (openOuter && !inOuterFence) {
        const m = line.match(headerRe);
        if (m) {
          start = i;
          fenceMarker = m[1];
          continue;
        }
        inOuterFence = true;
        outerMarker = openOuter[1];
        continue;
      }
      if (inOuterFence && line.startsWith(outerMarker)) {
        inOuterFence = false;
        outerMarker = '';
      }
      continue;
    }
    if (line.startsWith(fenceMarker)) {
      end = i;
      break;
    }
  }
  if (start === -1 || end === -1) return null;
  const body = lines.slice(start + 1, end).join('\n');
  const before = lines.slice(0, start);
  const after = lines.slice(end + 1);
  if (before.length && before[before.length - 1].trim() === '') before.pop();
  if (after.length && after[0].trim() === '') after.shift();
  let remaining;
  if (placeholder !== null) {
    const parts = [];
    if (before.length) parts.push(before.join('\n'));
    parts.push(placeholder);
    if (after.length) parts.push(after.join('\n'));
    remaining = parts.join('\n\n');
  } else {
    remaining = [...before, ...after].join('\n');
  }
  return { body, remaining };
}

export const VEGA_PLACEHOLDER = '<!--vega-placeholder-->';
export const THREE_PLACEHOLDER = '<!--three-placeholder-->';
export const IFRAME_PLACEHOLDER = '<!--iframe-placeholder-->';
export const dotPlaceholder = i => `<!--dot-placeholder-${i}-->`;

export function parseAuthors(body) {
  const authors = parseKvList(body, 'parseAuthors');
  for (const a of authors) {
    for (const field of ['name', 'position', 'company']) {
      if (!a[field]) throw new Error(`parseAuthors: missing required field "${field}"`);
    }
  }
  return authors;
}

export function extractAuthors(chunk) {
  const found = extractFencedBlock(chunk, 'authors');
  if (!found) return { authors: [], body: chunk };
  return { authors: parseAuthors(found.body), body: found.remaining };
}

export function parseVega(body) {
  const charts = parseKvList(body, 'parseVega');
  for (const c of charts) {
    if (!c.spec) throw new Error('parseVega: missing required field "spec"');
  }
  return charts;
}

export function parseThree(body) {
  const entries = parseKvList(body, 'parseThree');
  for (const e of entries) {
    if (!e.module) throw new Error('parseThree: missing required field "module"');
  }
  return entries;
}

export function extractThree(chunk) {
  const found = extractFencedBlock(chunk, 'three', THREE_PLACEHOLDER);
  if (!found) return { entries: [], body: chunk };
  return { entries: parseThree(found.body), body: found.remaining };
}

export function parseIframe(body) {
  const entries = parseKvList(body, 'parseIframe');
  for (const e of entries) {
    if (!e.url) throw new Error('parseIframe: missing required field "url"');
  }
  return entries;
}

export function extractIframe(chunk) {
  const found = extractFencedBlock(chunk, 'iframe', IFRAME_PLACEHOLDER);
  if (!found) return { entries: [], body: chunk };
  return { entries: parseIframe(found.body), body: found.remaining };
}

export function extractVega(chunk) {
  const found = extractFencedBlock(chunk, 'vega', VEGA_PLACEHOLDER);
  if (!found) return { charts: [], body: chunk };
  return { charts: parseVega(found.body), body: found.remaining };
}

export function extractDot(chunk) {
  const blocks = [];
  let body = chunk;
  while (true) {
    const found = extractFencedBlock(body, 'dot', dotPlaceholder(blocks.length));
    if (!found) break;
    const def = found.body.trim();
    if (!def) throw new Error('extractDot: empty dot block');
    blocks.push(def);
    body = found.remaining;
  }
  return { blocks, body };
}

export const DOT_DEFAULTS = `
  graph [rankdir=LR fontname="Inter" bgcolor="transparent" pad=0.3 nodesep=0.5 ranksep=0.7]
  node  [fontname="Inter" shape=box style="rounded,filled" fillcolor="#e6f0ff" color="#175fff" fontcolor="#061982" penwidth=1.5 margin="0.25,0.15"]
  edge  [fontname="Inter" color="#061982" penwidth=1.5 arrowsize=0.8]
`;

function cleanSvgPreamble(svg) {
  const svgStart = svg.indexOf('<svg');
  return svgStart > 0 ? svg.slice(svgStart) : svg;
}

export async function renderDot(blocks, slug, graphviz) {
  if (!blocks || blocks.length === 0) return [];
  return blocks.map((body, i) => {
    const id = blocks.length === 1 ? `diagram-${slug}` : `diagram-${slug}-${i + 1}`;
    const source = `digraph G {\n${DOT_DEFAULTS}\n${body}\n}`;
    const svg = cleanSvgPreamble(graphviz.dot(source));
    return `<figure class="dot" id="${escapeHtml(id)}">${svg}</figure>`;
  });
}

function deriveInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function renderAuthors(authors) {
  if (!authors || authors.length === 0) return '';
  const cards = authors.map(a => {
    const avatar = a.photo
      ? `<img src="${escapeHtml(a.photo)}" alt="">`
      : escapeHtml((a.initials || deriveInitials(a.name)).toUpperCase());
    return (
      '<div class="speaker">' +
      `<div class="avatar">${avatar}</div>` +
      '<div>' +
      `<div class="who-name">${escapeHtml(a.name)}</div>` +
      `<div class="who-role">${escapeHtml(a.position)} · ${escapeHtml(a.company)}</div>` +
      '</div>' +
      '</div>'
    );
  });
  return `<div class="speakers">${cards.join('')}</div>`;
}

export function copyAuthorPhotos(authors, talkDir, distDir) {
  for (const a of authors) {
    if (!a.photo) continue;
    if (/^https?:\/\//i.test(a.photo)) continue;
    const src = resolve(talkDir, a.photo);
    const name = basename(a.photo);
    const dest = resolve(distDir, name);
    try {
      copyFileSync(src, dest);
    } catch (err) {
      throw new Error(`copyAuthorPhotos: failed to copy photo for ${a.name} from ${a.photo}: ${err.message}`);
    }
    a.photo = name;
  }
  return authors;
}

export function embedVegaSpecs(charts, talkDir) {
  for (const c of charts) {
    if (!c.spec) continue;
    if (/^https?:\/\//i.test(c.spec)) continue;
    if (c.spec.startsWith('data:')) continue;
    const src = resolve(talkDir, c.spec);
    let json;
    try {
      json = readFileSync(src, 'utf8');
    } catch (err) {
      throw new Error(`embedVegaSpecs: failed to read spec ${c.spec}: ${err.message}`);
    }
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    c.spec = `data:application/json;base64,${b64}`;
  }
  return charts;
}

export function embedThreeModules(entries, talkDir) {
  for (const e of entries) {
    if (!e.module) continue;
    if (/^https?:\/\//i.test(e.module)) continue;
    if (e.module.startsWith('data:')) continue;
    const src = resolve(talkDir, e.module);
    let js;
    try {
      js = readFileSync(src, 'utf8');
    } catch (err) {
      throw new Error(`embedThreeModules: failed to read module ${e.module}: ${err.message}`);
    }
    const b64 = Buffer.from(js, 'utf8').toString('base64');
    e.module = `data:text/javascript;base64,${b64}`;
  }
  return entries;
}

export function renderVega(charts, slug) {
  if (!charts || charts.length === 0) return '';
  return charts.map((c, i) => {
    const id = c.id || (charts.length === 1 ? `vis-${slug}` : `vis-${slug}-${i + 1}`);
    const dataAttrs = Object.entries(c)
      .filter(([k]) => k !== 'id' && k !== 'spec')
      .map(([k, v]) => ` data-${escapeHtml(k)}="${escapeHtml(v)}"`)
      .join('');
    return `<div class="vega-chart vega-embed" id="${escapeHtml(id)}" data-spec="${escapeHtml(c.spec)}"${dataAttrs}></div>`;
  }).join('\n');
}

export function renderThree(entries, slug) {
  if (!entries || entries.length === 0) return '';
  return entries.map((e, i) => {
    const id = e.id || (entries.length === 1 ? `three-${slug}` : `three-${slug}-${i + 1}`);
    const dataAttrs = Object.entries(e)
      .filter(([k]) => k !== 'id' && k !== 'module')
      .map(([k, v]) => ` data-${escapeHtml(k)}="${escapeHtml(v)}"`)
      .join('');
    return `<canvas class="three-canvas" id="${escapeHtml(id)}" data-module="${escapeHtml(e.module)}"${dataAttrs}></canvas>`;
  }).join('\n');
}

export function renderIframe(entries, slug) {
  if (!entries || entries.length === 0) return '';
  return entries.map((e, i) => {
    const id = e.id || (entries.length === 1 ? `iframe-${slug}` : `iframe-${slug}-${i + 1}`);
    const dataAttrs = Object.entries(e)
      .filter(([k]) => k !== 'id' && k !== 'url')
      .map(([k, v]) => ` data-${escapeHtml(k)}="${escapeHtml(v)}"`)
      .join('');
    return `<iframe class="iframe-embed" id="${escapeHtml(id)}" src="${escapeHtml(e.url)}"${dataAttrs}></iframe>`;
  }).join('\n');
}

export function extractDeckConfig(md) {
  const text = String(md).replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return { config: {}, remaining: md };
  const openMatch = lines[i].match(/^(```|~~~)deck\s*$/);
  if (!openMatch) return { config: {}, remaining: md };
  const fence = openMatch[1];
  const start = i;
  let end = -1;
  for (i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith(fence)) { end = i; break; }
  }
  if (end === -1) return { config: {}, remaining: md };
  const body = lines.slice(start + 1, end).join('\n');
  const items = body.trim() === '' ? [] : parseKvList(body, 'extractDeckConfig');
  const config = {};
  for (const item of items) Object.assign(config, item);
  let after = end + 1;
  if (after < lines.length && lines[after].trim() === '') after++;
  return { config, remaining: lines.slice(after).join('\n') };
}

export function renderAgendaChunk(sections) {
  if (!sections || sections.length === 0) return '{.agenda}\n# Agenda';
  const items = sections.map((s, i) =>
    `${i + 1}. [${s.title}](#${s.slideIndex}-${s.slug})`
  );
  return `{.agenda}\n# Agenda\n\n${items.join('\n')}`;
}

function autoRevealAttrs(classes, attrs) {
  if (!classes.includes('auto-reveal')) return '';
  const delay = parseInt(attrs.delay, 10);
  const safeDelay = Number.isInteger(delay) && delay > 0 ? delay : 1000;
  const start = attrs.start === 'immediate' ? 'immediate' : 'cue';
  return ` data-autoreveal-delay="${safeDelay}" data-autoreveal-start="${start}"`;
}

export function renderSlide({ chunk, index, total, currentTitle = '', nextTitle = '', authors = [], charts = [], dotFigures = [], threeEntries = [], iframeEntries = [] }) {
  const { classes, attrs, body } = parseAttrs(chunk);
  let html = applyFragmentAttrs(marked.parse(body));
  const slug = slugify(extractTitle(html) || '');
  const vega = renderVega(charts, slug);
  if (vega) {
    html = html.includes(VEGA_PLACEHOLDER)
      ? html.replace(VEGA_PLACEHOLDER, vega)
      : `${html}\n${vega}`;
  }
  const three = renderThree(threeEntries, slug);
  if (three) {
    html = html.includes(THREE_PLACEHOLDER)
      ? html.replace(THREE_PLACEHOLDER, three)
      : `${html}\n${three}`;
  }
  const iframe = renderIframe(iframeEntries, slug);
  if (iframe) {
    html = html.includes(IFRAME_PLACEHOLDER)
      ? html.replace(IFRAME_PLACEHOLDER, iframe)
      : `${html}\n${iframe}`;
  }
  for (let i = 0; i < dotFigures.length; i++) {
    const marker = dotPlaceholder(i);
    html = html.includes(marker)
      ? html.replace(marker, dotFigures[i])
      : `${html}\n${dotFigures[i]}`;
  }
  html = stripComments(html);
  const classList = ['slide', ...classes].join(' ');
  const noChrome = classes.includes('no-chrome');
  const chrome = noChrome
    ? ''
    : `<aside class="chrome logo"><svg><use href='#logo'/></svg></aside><aside class="chrome"><span class="page">${index} / ${total}</span>${SPARK_INLINE}</aside>`;
  let footer = `<footer class="footer"><span class="footer-left">${currentTitle}</span>`;
  if (nextTitle != '') {
    footer += `<span class="footer-right">${nextTitle}</span>`;
  }
  footer += `</footer>`;
  const speakers = renderAuthors(authors);
  return `<section id="${index}-${slug}" class="${classList}" data-index="${index}"${autoRevealAttrs(classes, attrs)}>\n${html}\n${speakers}\n${chrome}\n${footer}\n</section>`;
}

export async function buildDeck(talkDir) {
  const mdPath = resolve(talkDir, 'slides.md');
  const md = readFileSync(mdPath, 'utf8');
  const { config: deckConfig, remaining } = extractDeckConfig(md);
  const rawChunks = splitSlides(remaining);

  const distDir = resolve(talkDir, 'dist');
  mkdirSync(distDir, { recursive: true });

  const prepared = rawChunks.map(chunk => {
    const a = extractAuthors(chunk);
    const v = extractVega(a.body);
    const t = extractThree(v.body);
    const f = extractIframe(t.body);
    const d = extractDot(f.body);
    copyAuthorPhotos(a.authors, talkDir, distDir);
    embedVegaSpecs(v.charts, talkDir);
    embedThreeModules(t.entries, talkDir);
    return { chunk: d.body, authors: a.authors, charts: v.charts, threeEntries: t.entries, iframeEntries: f.entries, dotBlocks: d.blocks };
  });

  const agendaOff = String(deckConfig.agenda || '').toLowerCase() === 'false';
  const firstSectionIdx = prepared.findIndex(p => parseAttrs(p.chunk).classes.includes('section'));
  if (!agendaOff && firstSectionIdx !== -1) {
    const sections = [];
    for (let i = firstSectionIdx; i < prepared.length; i++) {
      const { classes, body } = parseAttrs(prepared[i].chunk);
      if (!classes.includes('section')) continue;
      const html = marked.parse(body);
      const title = extractTitle(html) || '';
      sections.push({ title, slug: slugify(title), slideIndex: i + 2 });
    }
    prepared.splice(firstSectionIdx, 0, {
      chunk: renderAgendaChunk(sections),
      authors: [],
      charts: [],
      threeEntries: [],
      iframeEntries: [],
      dotBlocks: [],
    });
  }

  const total = prepared.length;
  const titles = prepared.map(({ chunk }) => {
    const html = marked.parse(parseAttrs(chunk).body);
    return extractTitle(html) || '';
  });
  const slugs = prepared.map(({ chunk }) => {
    const html = marked.parse(parseAttrs(chunk).body);
    return slugify(extractTitle(html) || '');
  });
  const hasDot = prepared.some(p => p.dotBlocks.length > 0);
  const graphviz = hasDot ? await Graphviz.load() : null;
  const dotHtmls = await Promise.all(prepared.map((p, i) =>
    renderDot(p.dotBlocks, slugs[i], graphviz)
  ));
  const sections = prepared.map(({ chunk, authors, charts, threeEntries, iframeEntries }, i) =>
    renderSlide({
      chunk,
      index: i + 1,
      total,
      currentTitle: i === 0 ? BRAND_FOOTER : titles[i],
      nextTitle: titles[i + 1] || '',
      authors,
      charts,
      dotFigures: dotHtmls[i],
      threeEntries,
      iframeEntries,
    })
  );

  const templatePath = fileURLToPath(new URL('../templates/deck.html', import.meta.url));
  const template = readFileSync(templatePath, 'utf8');

  const deckTitle = titles[0] || basename(talkDir);
  const hasCharts = prepared.some(p => p.charts.length > 0);
  const vegaScripts = hasCharts
    ? '<script src="https://cdn.jsdelivr.net/npm/vega@5"></script>\n'
    + '  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>\n'
    + '  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>\n'
    + '  <script src="../../../script/vega.js"></script>'
    : '';
  const hasThree = prepared.some(p => p.threeEntries.length > 0);
  let threeImportmap = '';
  let threeScripts = '';
  if (hasThree) {
    threeImportmap =
      '<script type="importmap">\n'
      + '    { "imports": { "three": "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js" } }\n'
      + '    </script>';
    const runtimePath = fileURLToPath(new URL('../script/three.js', import.meta.url));
    const runtimeSrc = readFileSync(runtimePath, 'utf8');
    threeScripts = `<script type="module">\n${runtimeSrc}\n</script>`;
  }
  const hasIframe = prepared.some(p => p.iframeEntries.length > 0);
  let iframeScripts = '';
  if (hasIframe) {
    const runtimePath = fileURLToPath(new URL('../script/iframe.js', import.meta.url));
    const runtimeSrc = readFileSync(runtimePath, 'utf8');
    iframeScripts = `<script>\n${runtimeSrc}\n</script>`;
  }
  const html = template
    .replaceAll('{{title}}', deckTitle)
    .replaceAll('{{cssDir}}', '../../../css')
    .replaceAll('{{scriptDir}}', '../../../script')
    .replace('{{slides}}', sections.join('\n'))
    .replace('{{vegaScripts}}', vegaScripts)
    .replace('{{threeImportmap}}', threeImportmap)
    .replace('{{threeScripts}}', threeScripts)
    .replace('{{iframeScripts}}', iframeScripts);

  const outPath = resolve(distDir, 'index.html');
  writeFileSync(outPath, html);
  return outPath;
}

// Run as CLI when invoked directly: node bin/build.js <talkDir>
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const talkDir = process.argv[2];
  if (!talkDir) {
    console.error('usage: node bin/build.js <talk-dir>');
    process.exit(2);
  }
  const out = await buildDeck(resolve(talkDir));
  console.log(`built ${out}`);
}
