import { writeFileSync } from "node:fs";

const W = 1200, H = 520;
const PAD = 20;
const PLOT_W = W - 2 * PAD, PLOT_H = H - 2 * PAD;
const GRID_N = 8;
const CELL_W = PLOT_W / GRID_N, CELL_H = PLOT_H / GRID_N;

function seedRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function gauss(rand) {
  return (rand() + rand() + rand() - 1.5) * 2;
}

function genPoints(rotateDeg, seed) {
  const rand = seedRandom(seed);
  // Apply initial 45-degree rotation to match Vega spec's raw_x/raw_y
  const cos45 = Math.cos(Math.PI / 4), sin45 = Math.sin(Math.PI / 4);
  // Then apply the theta rotation on top
  const rad = (rotateDeg * Math.PI) / 180;
  const cosT = Math.cos(rad), sinT = Math.sin(rad);
  const points = [];
  for (let i = 0; i < 300; i++) {
    const u = gauss(rand) * 2.6;
    const v = gauss(rand) * 0.4;
    // First rotation: 45 degrees to get raw_x/raw_y
    const rawX = u * cos45 - v * sin45;
    const rawY = u * sin45 + v * cos45;
    // Second rotation: apply theta
    const x = rawX * cosT - rawY * sinT;
    const y = rawX * sinT + rawY * cosT;
    points.push([x, y]);
  }
  return points;
}

function projectToPx(points) {
  return points.map(([x, y]) => [
    PAD + ((x + 6) / 12) * PLOT_W,
    H - PAD - ((y + 6) / 12) * PLOT_H,
  ]);
}

function occupiedCells(pxPoints) {
  const cells = new Set();
  for (const [px, py] of pxPoints) {
    const cx = Math.floor((px - PAD) / CELL_W);
    const cy = Math.floor((py - PAD) / CELL_H);
    if (cx >= 0 && cx < GRID_N && cy >= 0 && cy < GRID_N) {
      cells.add(`${cx},${cy}`);
    }
  }
  return cells;
}

function buildSvg(rotateDeg, label) {
  const points = genPoints(rotateDeg, 42);
  const px = projectToPx(points);
  const cells = occupiedCells(px);

  const rects = [];
  for (let cx = 0; cx < GRID_N; cx++) {
    for (let cy = 0; cy < GRID_N; cy++) {
      const occupied = cells.has(`${cx},${cy}`);
      const x = PAD + cx * CELL_W;
      const y = PAD + cy * CELL_H;
      rects.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${CELL_W.toFixed(1)}" height="${CELL_H.toFixed(1)}" ` +
          `fill="${occupied ? "#1f6feb" : "transparent"}" fill-opacity="${occupied ? 0.14 : 0}" ` +
          `stroke="#cbd5e1" stroke-dasharray="2,4" />`,
      );
    }
  }

  const dots = px
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#0d2b5c" fill-opacity="0.75" />`)
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="transparent" />
  ${rects.join("\n  ")}
  ${dots}
  <text x="24" y="${H - 24}" font-family="Inter, system-ui, sans-serif" font-size="14" fill="#64748b">${label}</text>
</svg>
`;
}

writeFileSync(
  new URL("./before.svg", import.meta.url),
  buildSvg(0, "Lopsided variance — most grid cells wasted on empty space."),
);
writeFileSync(
  new URL("./after.svg", import.meta.url),
  buildSvg(-45, "After rotation — variance spread evenly, cells carry information."),
);

console.log("wrote before.svg and after.svg");
