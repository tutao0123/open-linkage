// Traces the outer contour of a horse silhouette PNG, stylizes proportions,
// and emits a point array matching the viewBox 30 20 500 455.
// Usage: node scripts/trace-horse.js [input.png]
const fs = require("fs");
const { PNG } = require("pngjs");

const input = process.argv[2] || `${__dirname}/horse-ref.png`;
const png = PNG.sync.read(fs.readFileSync(input));
const W = png.width, H = png.height;
const rgb = new Array(W * H);
let opaqueCount = 0;
for (let i = 0; i < W * H; i++) {
  if (png.data[i * 4 + 3] >= 128) opaqueCount++;
  rgb[i] = 0.299 * png.data[i * 4] + 0.587 * png.data[i * 4 + 1] + 0.114 * png.data[i * 4 + 2];
}
// if the image uses transparency, the subject is the opaque region; otherwise dark pixels
const useAlpha = opaqueCount > 0 && opaqueCount < W * H * 0.98;
const mask = useAlpha
  ? (i) => png.data[i * 4 + 3] >= 128
  : (i) => rgb[i] < 128;
const dark = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask(y * W + x);

// largest connected component
const seen = new Uint8Array(W * H);
let best = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const id = y * W + x;
    if (!dark(x, y) || seen[id]) continue;
    const comp = [];
    const stack = [[x, y]];
    seen[id] = 1;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      comp.push([cx, cy]);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nx = cx + dx, ny = cy + dy;
        const nid = ny * W + nx;
        if (dark(nx, ny) && !seen[nid]) {
          seen[nid] = 1;
          stack.push([nx, ny]);
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
}
// Moore-neighbor boundary trace on the component's pixel set
const inComp = new Uint8Array(W * H);
for (const [x, y] of best) inComp[y * W + x] = 1;
const px = (x, y) => x >= 0 && y >= 0 && x < W && y < H && inComp[y * W + x];
let start = best.reduce((a, b) => (b[1] < a[1] || (b[1] === a[1] && b[0] < a[0]) ? b : a));
const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
let contour = [start];
let cur = start;
let dir = 0; // entered moving right
for (let guard = 0; guard < 200000; guard++) {
  let found = null;
  for (let k = 1; k <= 8; k++) {
    const d = (dir + 6 + k) % 8; // start from backtrack direction
    const nx = cur[0] + DIRS[d][0], ny = cur[1] + DIRS[d][1];
    if (px(nx, ny)) { found = [nx, ny, d]; break; }
  }
  if (!found) break;
  const [nx, ny, d] = found;
  if (nx === start[0] && ny === start[1]) break;
  contour.push([nx, ny]);
  cur = [nx, ny];
  dir = d;
}

// Ramer-Douglas-Peucker (closed: split at extremes)
function rdp(points, eps) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j <= i + 1) continue;
    const A = points[i], B = points[j];
    let maxD = -1, maxI = -1;
    for (let k = i + 1; k < j; k++) {
      const P = points[k];
      const num = Math.abs((B[0]-A[0])*(A[1]-P[1]) - (A[0]-P[0])*(B[1]-A[1]));
      const d = num / Math.hypot(B[0]-A[0], B[1]-A[1]);
      if (d > maxD) { maxD = d; maxI = k; }
    }
    if (maxD > eps) {
      keep[maxI] = 1;
      stack.push([i, maxI], [maxI, j]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
// split closed contour at leftmost/rightmost extremes so RDP chords are never degenerate
let li = 0, ri = 0;
for (let i = 1; i < contour.length; i++) {
  if (contour[i][0] < contour[li][0]) li = i;
  if (contour[i][0] > contour[ri][0]) ri = i;
}
const a = Math.min(li, ri), b = Math.max(li, ri);
const half1 = contour.slice(a, b + 1);
const half2 = contour.slice(b).concat(contour.slice(0, a + 1));
let simple = rdp(half1, 1.1).concat(rdp(half2, 1.1).slice(1, -1));
if (simple.length > 110) {
  // thin further by arc-length decimation
  const per = Math.ceil(simple.length / 100);
  simple = simple.filter((_, i) => i % per === 0 || i === simple.length - 1);
}
// Chaikin corner-cutting to remove pixel jaggies, then uniform arc-length resample
function chaikin(points, iterations) {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    pts = next;
  }
  return pts;
}
function resampleClosed(points, n) {
  const loop = [...points, points[0]];
  const cum = [0];
  for (let i = 1; i < loop.length; i++) cum.push(cum[i - 1] + Math.hypot(loop[i][0] - loop[i-1][0], loop[i][1] - loop[i-1][1]));
  const total = cum[cum.length - 1];
  const out = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (seg < cum.length - 1 && cum[seg] < target) seg++;
    const a = loop[seg - 1], b = loop[seg];
    const r = (target - cum[seg - 1]) / ((cum[seg] - cum[seg - 1]) || 1);
    out.push([a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]);
  }
  return out;
}
// density-weighted resampling: more points at high-curvature spots (ears, muzzle,
// hooves) and in the head/belly regions the reader's eye focuses on
function resampleDensity(points, n) {
  const m = points.length;
  const cs = [];
  for (let i = 0; i < m; i++) {
    const a = points[(i - 1 + m) % m], b = points[i], c = points[(i + 1) % m];
    const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    const turn = l1 && l2 ? Math.acos(Math.max(-1, Math.min(1, (v1[0]*v2[0]+v1[1]*v2[1])/(l1*l2)))) : 0;
    cs.push(turn);
  }
  const xs2 = points.map(p=>p[0]), ys2 = points.map(p=>p[1]);
  const bx0=Math.min(...xs2), bx1=Math.max(...xs2), by0=Math.min(...ys2), by1=Math.max(...ys2);
  const bw2=bx1-bx0, bh2=by1-by0;
  const weight = (i) => {
    const [x, y] = points[i];
    const head = x > bx0 + bw2*0.68 && y < by0 + bh2*0.55 ? 9 : 0;   // ears, muzzle, jaw
    const muzzle = x > bx0 + bw2*0.88 && y < by0 + bh2*0.42 ? 7 : 0; // nose tip and lips
    const belly = y > by0 + bh2*0.5 && y < by0 + bh2*0.88 && x > bx0 + bw2*0.12 && x < bx0 + bw2*0.72 ? 2.2 : 0;
    return 1 + 5*cs[i] + head + muzzle + belly;
  };
  const cumW = [0];
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    const seg = Math.hypot(points[j][0]-points[i][0], points[j][1]-points[i][1]);
    cumW.push(cumW[i] + seg * 0.5 * (weight(i) + weight(j)));
  }
  const total = cumW[m];
  const out = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (seg < m && cumW[seg] < target) seg++;
    const a = points[seg - 1], b = points[seg % m];
    const span = cumW[seg] - cumW[seg - 1] || 1;
    const r = (target - cumW[seg - 1]) / span;
    out.push([a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]);
  }
  return out;
}
simple = resampleDensity(chaikin(simple, 2), 300);
const N0 = simple.length;

// ---- cute transform + fit ----
const xs = simple.map(p => p[0]), ys = simple.map(p => p[1]);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);
const cfg = {
  bodyX: 1,           // horizontal compress (shorter, rounder body)
  squashY: 1,         // mild vertical squash of body
  legCompress: 1,     // extra compression below bellyLine (short legs)
  headScale: 1,       // enlarge head region (chibi)
  ground: 458,        // target baseline
  topY: 40,           // target min y after fit
  boxX0: 40, boxX1: 510,
};
const bw = maxX - minX, bh = maxY - minY;
const bellyFrac = 0.62; // legs start ~62% down the silhouette
const bellyY = minY + bh * bellyFrac;
// head region: top-right quadrant of silhouette
const headCx = minX + bw * 0.82, headCy = minY + bh * 0.18;

const out = [];
for (let i = 0; i < N0; i++) {
  let [x, y] = simple[i];
  const sy = y < bellyY ? cfg.squashY : cfg.squashY * cfg.legCompress;
  const cx = (minX + maxX) / 2;
  x = cx + (x - cx) * cfg.bodyX;
  y = bellyY + (y - bellyY) * sy;
  // head enlargement around head center, blended by distance
  const hd = Math.hypot(x - headCx, y - headCy);
  const hf = Math.max(0, 1 - hd / (bw * 0.25));
  const hs = 1 + (cfg.headScale - 1) * hf * hf;
  x = headCx + (x - headCx) * hs;
  y = headCy + (y - headCy) * hs;
  out.push({ x, y });
}
// fit: baseline on ground, scale to fill height, center horizontally
const tXs = out.map(p => p.x), tYs = out.map(p => p.y);
const tW = Math.max(...tXs) - Math.min(...tXs);
const tH = Math.max(...tYs) - Math.min(...tYs);
const s = Math.min((cfg.ground - cfg.topY) / tH, (cfg.boxX1 - cfg.boxX0) / tW);
const ox = (cfg.boxX0 + cfg.boxX1) / 2;
const cxo = (Math.min(...tXs) + Math.max(...tXs)) / 2;
const oy = Math.max(...tYs);
const final = out.map(p => ({
  x: Math.round(ox + (p.x - cxo) * s),
  y: Math.round(cfg.ground - (oy - p.y) * s),
}));

// verify closed & no dup
const dedup = [final[0]];
for (let i = 1; i < final.length; i++) {
  const p = final[i], q = dedup[dedup.length - 1];
  if (p.x !== q.x || p.y !== q.y) dedup.push(p);
}
console.error(`component ${best.length}px, contour ${contour.length}, simplified ${simple.length}, final ${dedup.length} pts`);
console.log(dedup.map(p => `  { x: ${p.x}, y: ${p.y} },`).join("\n"));
