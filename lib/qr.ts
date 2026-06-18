/**
 * Dependency-free QR Code generator (byte mode only, ECC level M).
 *
 * Why hand-rolled: the project deliberately ships with no runtime deps beyond
 * `better-sqlite3` + `next` (see CLAUDE.md), so we don't pull in a QR library
 * for a single feature. This is a compact port of Nayuki's reference QR Code
 * algorithm (public domain), trimmed to byte mode and EC level M, which is all
 * the share-link feature needs.
 *
 * No `next/*` import — like lib/auth/lib/i18n it stays a pure module usable from
 * both server and client and unit-testable in plain Node.
 *
 * Public API:
 *   encodeQr(text) -> boolean[][]   // row-major modules; true = dark
 *   qrToSvgPath(modules)            // SVG <path> "d" string (one path, all modules)
 */

const ECL_FORMAT_BITS = 0b00; // EC level M, per QR spec format-info table

// --- Galois field GF(2^8) arithmetic, generator 0x11D ---

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** Reed-Solomon divisor (generator polynomial) coefficients for `degree`. */
function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    for (let j = 0; j < result.length; j++) {
      result[j] ^= gfMul(divisor[j], factor);
    }
  }
  return result;
}

// --- Per-version tables for EC level M (index by version 1..40) ---
// EC codewords per block.
const ECC_PER_BLOCK_M = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26,
  26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  28, 28, 28,
];
// Number of error-correction blocks.
const NUM_BLOCKS_M = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17,
  18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
];

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver: number): number {
  return (
    Math.floor(numRawDataModules(ver) / 8) -
    ECC_PER_BLOCK_M[ver] * NUM_BLOCKS_M[ver]
  );
}

// --- Bit buffer helpers ---

function appendBits(value: number, len: number, bits: number[]): void {
  for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

// --- Module grid construction ---

function alignmentPatternPositions(ver: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

type Grid = { size: number; modules: boolean[][]; isFn: boolean[][] };

function newGrid(size: number): Grid {
  const modules = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const isFn = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  return { size, modules, isFn };
}

function setFn(g: Grid, x: number, y: number, dark: boolean): void {
  g.modules[y][x] = dark;
  g.isFn[y][x] = true;
}

function drawFinder(g: Grid, x: number, y: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && xx < g.size && yy >= 0 && yy < g.size) {
        setFn(g, xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }
}

function drawAlignment(g: Grid, x: number, y: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFn(g, x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFunctionPatterns(g: Grid, ver: number): void {
  const size = g.size;
  // Timing patterns
  for (let i = 0; i < size; i++) {
    setFn(g, 6, i, i % 2 === 0);
    setFn(g, i, 6, i % 2 === 0);
  }
  // Finder patterns + separators
  drawFinder(g, 3, 3);
  drawFinder(g, size - 4, 3);
  drawFinder(g, 3, size - 4);
  // Alignment patterns
  const align = alignmentPatternPositions(ver);
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      const skipCorner =
        (i === 0 && j === 0) ||
        (i === 0 && j === align.length - 1) ||
        (i === align.length - 1 && j === 0);
      if (!skipCorner) drawAlignment(g, align[i], align[j]);
    }
  }
  // Reserve format + version info areas (filled later).
  drawFormatBits(g, 0);
  drawVersion(g, ver);
}

function drawFormatBits(g: Grid, mask: number): void {
  const data = (ECL_FORMAT_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const size = g.size;
  for (let i = 0; i <= 5; i++) setFn(g, 8, i, ((bits >>> i) & 1) !== 0);
  setFn(g, 8, 7, ((bits >>> 6) & 1) !== 0);
  setFn(g, 8, 8, ((bits >>> 7) & 1) !== 0);
  setFn(g, 7, 8, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFn(g, 14 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 0; i < 8; i++)
    setFn(g, size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++)
    setFn(g, 8, size - 15 + i, ((bits >>> i) & 1) !== 0);
  setFn(g, 8, size - 8, true); // always-dark module
}

function drawVersion(g: Grid, ver: number): void {
  if (ver < 7) return;
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (ver << 12) | rem;
  const size = g.size;
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFn(g, a, b, bit);
    setFn(g, b, a, bit);
  }
}

function drawCodewords(g: Grid, data: number[]): void {
  const size = g.size;
  let i = 0; // bit index into data
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!g.isFn[y][x] && i < data.length * 8) {
          g.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

function applyMask(g: Grid, mask: number): void {
  const size = g.size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (g.isFn[y][x]) continue;
      let invert = false;
      switch (mask) {
        case 0:
          invert = (x + y) % 2 === 0;
          break;
        case 1:
          invert = y % 2 === 0;
          break;
        case 2:
          invert = x % 3 === 0;
          break;
        case 3:
          invert = (x + y) % 3 === 0;
          break;
        case 4:
          invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
          break;
        case 5:
          invert = ((x * y) % 2) + ((x * y) % 3) === 0;
          break;
        case 6:
          invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
          break;
        case 7:
          invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
          break;
      }
      if (invert) g.modules[y][x] = !g.modules[y][x];
    }
  }
}

function penaltyScore(g: Grid): number {
  const size = g.size;
  let result = 0;
  const mods = g.modules;
  // Rule 1: runs of 5+ same-color modules in rows/columns.
  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runLen = 0;
    for (let x = 0; x < size; x++) {
      if (mods[y][x] === runColor) {
        runLen++;
        if (runLen === 5) result += 3;
        else if (runLen > 5) result++;
      } else {
        runColor = mods[y][x];
        runLen = 1;
      }
    }
  }
  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runLen = 0;
    for (let y = 0; y < size; y++) {
      if (mods[y][x] === runColor) {
        runLen++;
        if (runLen === 5) result += 3;
        else if (runLen > 5) result++;
      } else {
        runColor = mods[y][x];
        runLen = 1;
      }
    }
  }
  // Rule 2: 2x2 blocks of same color.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = mods[y][x];
      if (
        c === mods[y][x + 1] &&
        c === mods[y + 1][x] &&
        c === mods[y + 1][x + 1]
      )
        result += 3;
    }
  }
  // Rule 3: finder-like 1:1:3:1:1 patterns in rows/columns.
  const pat = [true, false, true, true, true, false, true];
  const matchAt = (get: (i: number) => boolean, k: number): boolean => {
    for (let i = 0; i < 7; i++) if (get(k + i) !== pat[i]) return false;
    return true;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x <= size - 7; x++) {
      if (matchAt((i) => mods[y][i], x)) {
        const before = x - 4 < 0 || allLight(mods[y], x - 4, x);
        const after = x + 11 > size || allLightRow(mods[y], x + 7, x + 11);
        if (before || after) result += 40;
      }
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y <= size - 7; y++) {
      if (matchAt((i) => mods[i][x], y)) {
        const before = y - 4 < 0 || allLightCol(mods, x, y - 4, y);
        const after = y + 11 > size || allLightCol(mods, x, y + 7, y + 11);
        if (before || after) result += 40;
      }
    }
  }
  // Rule 4: proportion of dark modules.
  let dark = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (mods[y][x]) dark++;
  const total = size * size;
  const k =
    Math.floor((Math.abs(dark * 20 - total * 10) + total - 1) / total) - 1;
  result += k * 10;
  return result;
}

function allLight(row: boolean[], from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (row[i]) return false;
  return true;
}
function allLightRow(row: boolean[], from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (i < row.length && row[i]) return false;
  return true;
}
function allLightCol(
  mods: boolean[][],
  x: number,
  from: number,
  to: number,
): boolean {
  for (let i = from; i < to; i++)
    if (i >= 0 && i < mods.length && mods[i][x]) return false;
  return true;
}

function addEcc(dataCodewords: number[], ver: number): number[] {
  const numBlocks = NUM_BLOCKS_M[ver];
  const blockEccLen = ECC_PER_BLOCK_M[ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const divisor = rsDivisor(blockEccLen);
  let off = 0;
  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = dataCodewords.slice(off, off + datLen);
    off += datLen;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0); // pad slot for interleaving
    blocks.push(dat.concat(ecc));
  }

  // Interleave.
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      // Skip the padding slot in short blocks' data region.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(blocks[j][i]);
      }
    }
  }
  return result;
}

/** Encode `text` (UTF-8 byte mode) into a QR module grid. true = dark. */
export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));

  // Choose the smallest version (EC level M) that fits.
  let ver = 1;
  for (; ver <= 40; ver++) {
    const capacityBits = numDataCodewords(ver) * 8;
    const charCountBits = ver <= 9 ? 8 : 16;
    const usedBits = 4 + charCountBits + bytes.length * 8;
    if (usedBits <= capacityBits) break;
  }
  if (ver > 40) throw new Error("qr: data too long");

  // Build data bit stream.
  const bits: number[] = [];
  appendBits(0b0100, 4, bits); // byte mode indicator
  appendBits(bytes.length, ver <= 9 ? 8 : 16, bits);
  for (const b of bytes) appendBits(b, 8, bits);

  const capacityBits = numDataCodewords(ver) * 8;
  appendBits(0, Math.min(4, capacityBits - bits.length), bits); // terminator
  while (bits.length % 8 !== 0) bits.push(0); // byte-align

  // Convert to codewords, then pad with alternating bytes.
  const dataCodewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataCodewords.push(b);
  }
  for (
    let pad = 0xec;
    dataCodewords.length < numDataCodewords(ver);
    pad ^= 0xec ^ 0x11
  ) {
    dataCodewords.push(pad);
  }

  const allCodewords = addEcc(dataCodewords, ver);

  const size = ver * 4 + 17;
  const g = newGrid(size);
  drawFunctionPatterns(g, ver);
  drawCodewords(g, allCodewords);

  // Try all 8 masks, keep the lowest-penalty one.
  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(g, mask);
    drawFormatBits(g, mask);
    const score = penaltyScore(g);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    applyMask(g, mask); // undo (XOR is its own inverse)
  }
  applyMask(g, bestMask);
  drawFormatBits(g, bestMask);

  return g.modules;
}

/**
 * Build a single SVG path "d" string covering every dark module, where each
 * module is a 1×1 unit square. Pair with viewBox="0 0 size size" (plus an
 * optional quiet-zone margin) on the <svg>.
 */
export function qrToSvgPath(modules: boolean[][]): string {
  const parts: string[] = [];
  for (let y = 0; y < modules.length; y++) {
    for (let x = 0; x < modules[y].length; x++) {
      if (modules[y][x]) parts.push(`M${x},${y}h1v1h-1z`);
    }
  }
  return parts.join("");
}
