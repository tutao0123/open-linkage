// Renders a target curve from src/lib/sketch-linkage.ts to a PNG for visual review.
// Usage: node scripts/render-curve.js [curveName] [out.png]
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const curveName = process.argv[2] || "TROJAN_HORSE_TARGET_CURVE";
const outFile = process.argv[3] || path.join(__dirname, "curve-preview.png");

const src = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "sketch-linkage.ts"),
  "utf8"
);
const start = src.indexOf(`export const ${curveName}`);
if (start < 0) throw new Error(`curve ${curveName} not found`);
const eq = src.indexOf("=", start);
const open = src.indexOf("[", eq);
let depth = 0;
let end = -1;
for (let i = open; i < src.length; i++) {
  if (src[i] === "[") depth++;
  if (src[i] === "]") {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
const body = src.slice(open, end + 1);
const pts = [...body.matchAll(/\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+)\s*\}/g)].map(
  (m) => ({ x: +m[1], y: +m[2] })
);
if (!pts.length) throw new Error("no points parsed");

// PNG encoding
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const S = 2; // scale
const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);
const W = Math.ceil((maxX - minX + 1) * S) + 20;
const H = Math.ceil((maxY - minY + 1) * S) + 20;
const px = (p) => Math.round((p.x - minX) * S) + 10;
const py = (p) => Math.round((p.y - minY) * S) + 10;

const img = Buffer.alloc(W * H * 3, 0xff);
function put(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
}

// even-odd scanline fill
for (let y = 0; y < H; y++) {
  const yc = (y + 0.5) / S + minY - 5 / S;
  const xs2 = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a.y === b.y) continue;
    const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
    if (yc >= lo && yc < hi) {
      xs2.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  xs2.sort((m, n) => m - n);
  for (let k = 0; k + 1 < xs2.length; k += 2) {
    const x0 = Math.round((xs2[k] - minX) * S) + 10;
    const x1 = Math.round((xs2[k + 1] - minX) * S) + 10;
    for (let x = x0; x <= x1; x++) put(x, y, 30, 30, 30);
  }
}
// outline
for (let i = 0; i < pts.length; i++) {
  const a = pts[i], b = pts[(i + 1) % pts.length];
  let x0 = px(a), y0 = py(a), x1 = px(b), y1 = py(b);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(x0, y0, 200, 40, 40);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(outFile, png);
console.log(`${curveName}: ${pts.length} pts, bounds x[${minX},${maxX}] y[${minY},${maxY}] -> ${outFile} (${W}x${H})`);
