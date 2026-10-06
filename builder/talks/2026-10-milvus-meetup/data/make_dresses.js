#!/usr/bin/env node
// Regenerates the DRESSES data block in ../dress-cloud.js.
//
// Each dress is drawn from its own coordinates, so where it lands on an axis
// is exactly what the picture shows: `length` sets the hem, `formality` sets
// the waist, flare, neckline, belt and sheen, and `colour` is the fill's
// lightness (CIE L*), computed from the hex rather than hand-scored.
// SVGs are inlined as data URIs for the same reason make_facenet_module.js
// inlines JPEGs: the build base64-encodes the module, so relative paths
// would not resolve at runtime.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const modulePath = resolve(here, '..', 'dress-cloud.js');

// length: -1 mini … 1 floor; formality: -1 beachwear … 1 black tie.
// Names match the ranked results on the recall & precision slide.
const DRESSES = [
  { name: 'Linen Floral Midi', length: 0.05, formality: -0.25, hex: '#e6cfa3', pattern: 'floral' },
  { name: 'Ivory Lace Maxi', length: 0.9, formality: 0.85, hex: '#f2ead6', pattern: 'lace' },
  { name: 'Sage Chiffon Wrap Dress', length: 0.25, formality: 0.3, hex: '#9db592' },
  { name: 'Black Wool Sheath', length: -0.15, formality: 0.55, hex: '#1c1c22' },
  { name: 'Striped Beach Cover-up', length: -0.6, formality: -0.95, hex: '#e4edf5', pattern: 'stripe' },
  { name: 'Lavender-Print Sundress', length: -0.2, formality: -0.55, hex: '#c3aee3', pattern: 'floral' },
  { name: 'Sequin Cocktail Dress', length: -0.55, formality: 0.75, hex: '#b38b3c', pattern: 'sequin' },
  { name: 'Pale Blue Cotton Midi', length: 0.15, formality: -0.35, hex: '#b9d4ee' },
  { name: 'Velvet Midi', length: 0.3, formality: 0.45, hex: '#5c1838' },
  { name: 'Blush Silk Slip Midi', length: 0.35, formality: 0.2, hex: '#efc6be' },
  { name: 'Terracotta Poplin Maxi', length: 0.75, formality: -0.05, hex: '#bf5d36' },
  { name: 'Denim Mini', length: -0.9, formality: -0.75, hex: '#3f5c82' },
  { name: 'Red Satin Gown', length: 1.0, formality: 1.0, hex: '#a3202b' },
  { name: 'Navy Shirt Dress', length: -0.05, formality: -0.1, hex: '#24315c' },
  { name: 'White Tennis Dress', length: -0.85, formality: -0.6, hex: '#f7f6f1' },
  { name: 'Charcoal Jersey Maxi', length: 0.85, formality: -0.45, hex: '#3b3b40' },
];

const CARD = '#f4f1ec';

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function mix(hex, other, t) {
  const a = rgb(hex);
  const b = rgb(other);
  return toHex(a.map((v, i) => v + (b[i] - v) * t));
}

// CIE L* (0 black … 100 white), so the axis tracks perceived lightness.
function lightness(hex) {
  const lin = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

const lerp = (a, b, t) => a + (b - a) * t;
const r1 = (v) => Math.round(v * 10) / 10;

function patternDef(kind, fill, id) {
  const ink = lightness(fill) > 60 ? mix(fill, '#000000', 0.45) : mix(fill, '#ffffff', 0.55);
  switch (kind) {
    case 'floral':
      return `<pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse">
        <circle cx="7" cy="7" r="3.2" fill="${ink}"/><circle cx="20" cy="19" r="2.4" fill="${ink}" opacity="0.7"/>
        <circle cx="7" cy="7" r="1.1" fill="${CARD}"/></pattern>`;
    case 'stripe':
      return `<pattern id="${id}" width="20" height="18" patternUnits="userSpaceOnUse">
        <rect y="0" width="20" height="6" fill="#2c4a7a"/></pattern>`;
    case 'lace':
      return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="8" cy="8" r="4.5" fill="none" stroke="#c9bb98" stroke-width="1.2"/>
        <circle cx="0" cy="0" r="2" fill="none" stroke="#c9bb98" stroke-width="1"/></pattern>`;
    case 'sequin':
      return `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.8" fill="#f3dd9a" opacity="0.8"/>
        <circle cx="7.5" cy="7.5" r="1.4" fill="#5e4518" opacity="0.6"/></pattern>`;
    default:
      return '';
  }
}

function dressSvg({ length, formality, hex, pattern }, i) {
  const pid = `p${i}`;
  const cid = `c${i}`;
  const l = (length + 1) / 2;
  const f = (formality + 1) / 2;
  const cx = 150;
  const top = 72;
  const waistY = 150;
  const hemY = lerp(212, 382, l);
  const bodiceW = lerp(40, 34, f);
  const ww = lerp(44, 27, f);
  const hw = Math.min(136, ww + 12 + (hemY - waistY) * lerp(0.16, 0.44, f));
  const neck = lerp(10, 34, f);
  const sag = lerp(6, 16, f);
  const stroke = mix(hex, '#000000', 0.4);
  const outline = lightness(hex) > 85 ? '#b9b2a4' : stroke;

  const bodice = `M ${cx - bodiceW} ${top}
    Q ${cx - bodiceW / 2} ${top - 2} ${cx} ${top + neck}
    Q ${cx + bodiceW / 2} ${top - 2} ${cx + bodiceW} ${top}
    L ${cx + bodiceW + 6} ${top + 22}
    Q ${cx + ww + 4} ${waistY - 30} ${cx + ww} ${waistY}
    L ${cx - ww} ${waistY}
    Q ${cx - ww - 4} ${waistY - 30} ${cx - bodiceW - 6} ${top + 22} Z`;
  const skirt = `M ${cx - ww} ${waistY - 1}
    L ${cx + ww} ${waistY - 1}
    Q ${cx + ww + (hw - ww) * 0.35} ${lerp(waistY, hemY, 0.55)} ${cx + hw} ${hemY}
    Q ${cx} ${hemY + sag} ${cx - hw} ${hemY}
    Q ${cx - ww - (hw - ww) * 0.35} ${lerp(waistY, hemY, 0.55)} ${cx - ww} ${waistY - 1} Z`;
  const shape = `<path d="${bodice}"/><path d="${skirt}"/>`;

  const folds = [];
  const n = Math.round(lerp(1, 4, f));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const x0 = cx - ww + 2 * ww * t;
    const x1 = cx - hw + 2 * hw * t;
    folds.push(`<path d="M ${r1(x0)} ${waistY + 6} Q ${r1(lerp(x0, x1, 0.4))} ${r1(lerp(waistY, hemY, 0.6))} ${r1(x1)} ${r1(hemY + sag * (1 - Math.abs(2 * t - 1)) - 6)}" fill="none" stroke="${stroke}" stroke-width="1.6" opacity="0.35"/>`);
  }

  const belt = formality > 0.05
    ? `<rect x="${cx - ww - 1}" y="${waistY - 7}" width="${2 * ww + 2}" height="9" rx="2" fill="${stroke}" opacity="${r1(lerp(0.5, 0.85, f))}"/>`
    : '';
  const sheen = formality > 0.15
    ? `<path d="M ${cx - hw * 0.45} ${waistY + 20} Q ${cx - hw * 0.62} ${lerp(waistY, hemY, 0.6)} ${cx - hw * 0.62} ${hemY - 14}" fill="none" stroke="#ffffff" stroke-width="${r1(lerp(4, 9, f))}" stroke-linecap="round" opacity="${r1(lerp(0.1, 0.3, f))}"/>`
    : '';
  const straps = `<path d="M ${cx - bodiceW + 6} ${top + 1} L ${cx - 9} 40 M ${cx + bodiceW - 6} ${top + 1} L ${cx + 9} 40" stroke="${outline}" stroke-width="${r1(lerp(5, 2.5, f))}" fill="none" stroke-linecap="round"/>`;
  const hanger = `<path d="M ${cx} 40 L ${cx} 26 Q ${cx} 16 ${cx + 9} 16 Q ${cx + 17} 17 ${cx + 15} 26" fill="none" stroke="#8a8478" stroke-width="3" stroke-linecap="round"/>
    <path d="M ${cx - 46} 52 L ${cx} 38 L ${cx + 46} 52" fill="none" stroke="#8a8478" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  const def = pattern ? patternDef(pattern, hex, pid) : '';
  const overlay = pattern ? `<g fill="url(#${pid})" clip-path="url(#${cid})"><rect width="300" height="400"/></g>` : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 300 400">
  <defs>${def}<clipPath id="${cid}">${shape}</clipPath></defs>
  <rect x="2" y="2" width="296" height="396" rx="26" fill="${CARD}"/>
  ${hanger}${straps}
  <g fill="${hex}" stroke="${outline}" stroke-width="2.5" stroke-linejoin="round">${shape}</g>
  ${overlay}${folds.join('')}${belt}${sheen}
  <g fill="none" stroke="${outline}" stroke-width="2.5" stroke-linejoin="round">${shape}</g>
</svg>`;
  return svg.replace(/\s+/g, ' ').replace(/> </g, '><');
}

const START = '/* DRESSES_START */';
const END = '/* DRESSES_END */';

const entries = DRESSES.map((d, i) => {
  const colour = 1 - (2 * lightness(d.hex)) / 100;
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(dressSvg(d, i)).toString('base64');
  return `  { name: ${JSON.stringify(d.name)}, length: ${d.length}, formality: ${d.formality}, colour: ${colour.toFixed(2)}, dataUri: "${uri}" }`;
});
const block = `${START}\n// Generated by data/make_dresses.js, do not edit by hand.\nconst DRESSES = [\n${entries.join(',\n')}\n];\n${END}`;

const src = readFileSync(modulePath, 'utf8');
const startIdx = src.indexOf(START);
const endIdx = src.indexOf(END);
if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  throw new Error('DRESSES sentinels not found in dress-cloud.js');
}
writeFileSync(modulePath, src.slice(0, startIdx) + block + src.slice(endIdx + END.length));
console.log(`wrote DRESSES block to ${modulePath} (${DRESSES.length} dresses)`);

// `--preview <file.html>` also writes a contact sheet for eyeballing the drawings.
const previewIdx = process.argv.indexOf('--preview');
if (previewIdx !== -1) {
  const out = resolve(process.argv[previewIdx + 1]);
  const cards = DRESSES.map((d, i) => `<figure>${dressSvg(d, i).replace('width="600" height="800"', 'width="150" height="200"')}<figcaption>${d.name}</figcaption></figure>`);
  writeFileSync(out, `<body style="background:#0a0e1a;color:#ddd;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:12px">${cards.join('')}</body>`);
  console.log(`wrote ${out}`);
}
