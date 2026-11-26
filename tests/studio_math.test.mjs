import assert from "node:assert/strict";
import test from "node:test";
import { dimensionsMm, scaleForDimension } from "../web_app/frontend/studio_math.mjs";

test("dimensions use millimeters while the scene uses meters", () => {
  assert.deepEqual(dimensionsMm([0.08, 0.1, 0.06], [1, 1, 1]), [80, 100, 60]);
});

test("locked dimensions preserve proportions", () => {
  const next = scaleForDimension([0.08, 0.1, 0.06], [1, 1, 1], 1, 200, true);
  assert.deepEqual(next, [2, 2, 2]);
  assert.deepEqual(dimensionsMm([0.08, 0.1, 0.06], next), [160, 200, 120]);
});

test("unlocked dimensions change only the selected axis", () => {
  const next = scaleForDimension([0.08, 0.1, 0.06], [1, 1, 1], 0, 120, false);
  assert.deepEqual(next, [1.5, 1, 1]);
  assert.deepEqual(dimensionsMm([0.08, 0.1, 0.06], next), [120, 100, 60]);
});

test("invalid dimensions are rejected", () => {
  assert.throws(() => scaleForDimension([1, 1, 1], [1, 1, 1], 1, 0, true));
  assert.throws(() => scaleForDimension([1, 1, 1], [1, 1, 1], 1, 10001, true));
});
