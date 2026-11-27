import assert from "node:assert/strict";
import test from "node:test";
import { buildFrustumSpec, computeSolidDimensions } from "../web_app/frontend/solid_math.mjs";

function firstNormal(part) {
  return [part.normals[0], part.normals[1], part.normals[2]];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

test("pointed pyramid has 4 triangular side faces and closed bottom cap with outward normals", () => {
  const spec = buildFrustumSpec({ primaryAspect: 0.8, topRatio: 0, depthRatio: 1.0 });
  assert.equal(spec.sides.length, 4);

  const expectedOutward = {
    front: [0, 0, 1],
    right: [1, 0, 0],
    back: [0, 0, -1],
    left: [-1, 0, 0],
  };

  for (const side of spec.sides) {
    // 16 rows x 16 cols: 15 rows of 2 tris (480) + top collapsed row of 1 tri (16) = 496 tris = 1488 verts
    assert.equal(side.positions.length, 496 * 9, `${side.key} should subdivide without degenerate tip tris`);
    assert.equal(side.uvs.length, 496 * 6);
    const n = firstNormal(side);
    assert.ok(dot3(n, expectedOutward[side.key]) > 0.3, `${side.key} normal must face outward`);
    assert.ok(n[1] > 0, `${side.key} normal on tapered pyramid should tilt +Y`);
  }

  // Bottom cap fan: 4 edges * 16 segments = 64 triangles (64 * 9 floats)
  assert.equal(spec.caps.positions.length, 64 * 9);
  assert.deepEqual(firstNormal(spec.caps), [0, -1, 0]);
});

test("truncated pyramid (frustum) emits subdivided bilinear UVs and closed top+bottom fans", () => {
  const spec = buildFrustumSpec({ primaryAspect: 1.0, topRatio: 0.08, depthRatio: 1.0, segments: 8 });
  for (const side of spec.sides) {
    // 8 x 8 cells x 2 tris x 9 floats = 1152 floats
    assert.equal(side.positions.length, 8 * 8 * 2 * 9, `${side.key} should have 8x8 subdivided quad grid`);
    for (const uv of side.uvs) {
      assert.ok(uv >= 0 && uv <= 1, "UV coordinates must remain within [0, 1]");
    }
  }
  // Verify bilinear mid-row UV=0.5 sits uniformly at horizontal midpoint x=0 rather than affine diagonal skew
  const frontMidIndices = [];
  for (let i = 0; i < spec.sides[0].uvs.length; i += 2) {
    if (Math.abs(spec.sides[0].uvs[i] - 0.5) < 1e-9 && Math.abs(spec.sides[0].uvs[i + 1] - 0.5) < 1e-9) {
      frontMidIndices.push(i / 2);
    }
  }
  assert.ok(frontMidIndices.length > 0, "Expected subdivided vertex at center UV (0.5, 0.5)");
  for (const vIdx of frontMidIndices) {
    assert.ok(Math.abs(spec.sides[0].positions[vIdx * 3]) < 1e-9, "Center UV (0.5, 0.5) must lie at x=0");
  }

  // Bottom fan (32 tris) + Top fan (32 tris) = 64 tris * 9 floats
  assert.equal(spec.caps.positions.length, 64 * 9);
  assert.deepEqual([spec.caps.normals[0], spec.caps.normals[1], spec.caps.normals[2]], [0, -1, 0]);
  const topOffset = 32 * 9;
  assert.deepEqual(
    [spec.caps.normals[topOffset], spec.caps.normals[topOffset + 1], spec.caps.normals[topOffset + 2]],
    [0, 1, 0]
  );
});

test("rectangular box preset keeps orthogonal outward normals and exact depth ratio", () => {
  const box = buildFrustumSpec({ primaryAspect: 1.0, topRatio: 1.0, depthRatio: 0.4, height: 0.1 });
  assert.ok(Math.abs(box.dimensions.baseWidth - 0.1) < 1e-9);
  assert.ok(Math.abs(box.dimensions.baseDepth - 0.04) < 1e-9);
  assert.deepEqual(firstNormal(box.sides[0]), [0, 0, 1]);
  assert.deepEqual(firstNormal(box.sides[1]), [1, 0, 0]);
  assert.deepEqual(firstNormal(box.sides[2]), [0, 0, -1]);
  assert.deepEqual(firstNormal(box.sides[3]), [-1, 0, 0]);
});

test("computeSolidDimensions clamps aspect extremes and rejects invalid inputs", () => {
  const narrow = computeSolidDimensions({ primaryAspect: 0.05, height: 0.1 });
  assert.equal(narrow.baseWidth, 0.02);

  assert.throws(() => computeSolidDimensions({ primaryAspect: 0 }));
  assert.throws(() => computeSolidDimensions({ topRatio: 1.2 }));
  assert.throws(() => computeSolidDimensions({ depthRatio: 0.05 }));
});
