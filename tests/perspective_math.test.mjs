import test from "node:test";
import assert from "node:assert/strict";
import {
  applyHomography,
  computeInverseHomography,
  estimateRectSize,
  validateQuadCorners,
  warpRgbaData,
} from "../web_app/frontend/perspective_math.mjs";

test("estimateRectSize preserves aspect ratio and clamps maxEdge", () => {
  const size = estimateRectSize(
    [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 1000 },
      { x: 0, y: 1000 },
    ],
    1000
  );
  assert.deepEqual(size, { width: 1000, height: 500 });
});

test("computeInverseHomography maps all 4 corners accurately", () => {
  const corners = [
    { x: 10, y: 20 },
    { x: 110, y: 30 },
    { x: 105, y: 180 },
    { x: 5, y: 165 },
  ];
  const h = computeInverseHomography(corners, 100, 150);
  const mapped = [
    applyHomography(h, 0, 0),
    applyHomography(h, 99, 0),
    applyHomography(h, 99, 149),
    applyHomography(h, 0, 149),
  ];
  corners.forEach((expected, i) => {
    assert.ok(Math.abs(mapped[i].x - expected.x) < 1e-6);
    assert.ok(Math.abs(mapped[i].y - expected.y) < 1e-6);
  });
});

test("warpRgbaData extracts uniform region color cleanly", () => {
  const srcW = 20;
  const srcH = 20;
  const src = new Uint8ClampedArray(srcW * srcH * 4);
  for (let y = 4; y < 16; y += 1) {
    for (let x = 5; x < 15; x += 1) {
      const idx = (y * srcW + x) * 4;
      src[idx] = 200;
      src[idx + 1] = 120;
      src[idx + 2] = 40;
      src[idx + 3] = 255;
    }
  }
  const out = warpRgbaData(
    src,
    srcW,
    srcH,
    [
      { x: 6, y: 5 },
      { x: 13, y: 5 },
      { x: 13, y: 14 },
      { x: 6, y: 14 },
    ],
    8,
    10
  );
  const centerIdx = (5 * 8 + 4) * 4;
  assert.equal(out[centerIdx], 200);
  assert.equal(out[centerIdx + 1], 120);
  assert.equal(out[centerIdx + 2], 40);
  assert.equal(out[centerIdx + 3], 255);
});

test("validateQuadCorners rejects collinear or self-intersecting quads", () => {
  assert.throws(() =>
    validateQuadCorners([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
  );
  assert.throws(() =>
    validateQuadCorners([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ])
  );
});
