import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeQr, qrToSvgPath } from "../lib/qr.ts";

test("encodeQr produces a square grid of valid QR dimensions", () => {
  const m = encodeQr("https://myvouch.fr/u/maya-okonkwo/vouch");
  assert.ok(m.length >= 21, "at least version 1");
  assert.equal(m.length % 4, 1, "size is 4*version+17");
  for (const row of m) assert.equal(row.length, m.length, "square");
});

test("encodeQr places the three finder patterns", () => {
  const m = encodeQr("https://myvouch.fr/u/maya-okonkwo/vouch");
  const n = m.length;
  // Each finder is a dark 7x7 ring; check the four outer corners are dark.
  assert.ok(m[0][0] && m[0][6] && m[6][0] && m[6][6], "top-left finder");
  assert.ok(m[0][n - 1] && m[0][n - 7] && m[6][n - 1], "top-right finder");
  assert.ok(m[n - 1][0] && m[n - 7][0] && m[n - 1][6], "bottom-left finder");
  // Finder centers are dark, the surrounding ring gap is light.
  assert.ok(m[3][3] && !m[1][1], "top-left finder structure");
});

test("encodeQr lays the timing patterns on row/column 6", () => {
  const m = encodeQr("https://myvouch.fr/u/maya-okonkwo/vouch");
  const n = m.length;
  for (let i = 8; i < n - 8; i++) {
    assert.equal(m[6][i], i % 2 === 0, `timing row at ${i}`);
    assert.equal(m[i][6], i % 2 === 0, `timing col at ${i}`);
  }
});

test("encodeQr is deterministic and grows with input length", () => {
  const a = encodeQr("hello");
  const b = encodeQr("hello");
  assert.deepEqual(a, b, "deterministic");
  const big = encodeQr("x".repeat(400));
  assert.ok(big.length > a.length, "larger payload -> larger grid");
});

test("encodeQr selects version 1 for short byte payloads", () => {
  // 10 bytes fits comfortably in version 1 (size 21) at EC level M.
  assert.equal(encodeQr("0123456789").length, 21);
});

test("qrToSvgPath emits one move-and-rect per dark module", () => {
  const m = encodeQr("hi");
  const dark = m.flat().filter(Boolean).length;
  const path = qrToSvgPath(m);
  assert.equal((path.match(/M/g) ?? []).length, dark);
  assert.ok(dark > 0);
});
