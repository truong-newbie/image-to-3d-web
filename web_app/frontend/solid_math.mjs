/**
 * Pure geometry helpers for multi-face 3D solids (4-sided pyramids, frustums, boxes).
 * Kept free of DOM/Three.js dependencies so Node unit tests can validate winding & UVs.
 */

export const SOLID_PRESETS = {
  pyramid: { topRatio: 0.04, depthRatio: 1.0 },
  box: { topRatio: 1.0, depthRatio: 0.35 },
};

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len <= 1e-12) return [0, 0, 0];
  return [v[0] / len || 0, v[1] / len || 0, v[2] / len || 0];
}

export function triangleNormal(a, b, c) {
  return normalize3(cross3(sub3(b, a), sub3(c, a)));
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function pushBilinearFace(positions, normals, uvs, bl, br, tr, tl, segments = 16) {
  const n = triangleNormal(bl, br, tr);
  const cols = Math.max(1, segments);
  const rows = Math.max(1, segments);

  for (let r = 0; r < rows; r += 1) {
    const v0 = r / rows;
    const v1 = (r + 1) / rows;
    const left0 = lerp3(bl, tl, v0);
    const right0 = lerp3(br, tr, v0);
    const left1 = lerp3(bl, tl, v1);
    const right1 = lerp3(br, tr, v1);
    const topCollapsed =
      Math.hypot(right1[0] - left1[0], right1[1] - left1[1], right1[2] - left1[2]) <= 1e-8;

    for (let c = 0; c < cols; c += 1) {
      const u0 = c / cols;
      const u1 = (c + 1) / cols;
      const p00 = lerp3(left0, right0, u0);
      const p10 = lerp3(left0, right0, u1);
      const p01 = lerp3(left1, right1, u0);

      if (topCollapsed) {
        pushTriangle(positions, normals, uvs, p00, p10, p01, [u0, v0], [u1, v0], [(u0 + u1) / 2, v1], n);
      } else {
        const p11 = lerp3(left1, right1, u1);
        pushTriangle(positions, normals, uvs, p00, p10, p11, [u0, v0], [u1, v0], [u1, v1], n);
        pushTriangle(positions, normals, uvs, p00, p11, p01, [u0, v0], [u1, v1], [u0, v1], n);
      }
    }
  }
}

function pushTriangle(positions, normals, uvs, a, b, c, uvA, uvB, uvC, fixedNormal = null) {
  const n = fixedNormal || triangleNormal(a, b, c);
  const verts = [a, b, c];
  const triUvs = [uvA, uvB, uvC];
  for (let i = 0; i < 3; i += 1) {
    positions.push(verts[i][0], verts[i][1], verts[i][2]);
    normals.push(n[0], n[1], n[2]);
    uvs.push(triUvs[i][0], triUvs[i][1]);
  }
}

export function computeSolidDimensions({
  primaryAspect = 1,
  topRatio = 0.04,
  depthRatio = 1.0,
  height = 0.1,
} = {}) {
  if (!Number.isFinite(primaryAspect) || primaryAspect <= 0) {
    throw new Error("Tỷ lệ khung ảnh không hợp lệ.");
  }
  if (!Number.isFinite(topRatio) || topRatio < 0 || topRatio > 1) {
    throw new Error("Độ thu đỉnh phải nằm trong khoảng 0 đến 1.");
  }
  if (!Number.isFinite(depthRatio) || depthRatio < 0.1 || depthRatio > 2.5) {
    throw new Error("Độ sâu khối phải nằm trong khoảng 0.1 đến 2.5.");
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error("Chiều cao khối phải lớn hơn 0.");
  }

  const baseWidth = Math.max(0.02, Math.min(0.24, height * primaryAspect));
  const baseDepth = baseWidth * depthRatio;
  const topWidth = baseWidth * topRatio;
  const topDepth = baseDepth * topRatio;

  return { baseWidth, baseDepth, topWidth, topDepth, height };
}

/**
 * Generates watertight vertex positions, outward normals, and per-face UVs for a
 * 4-sided pyramid/frustum/box centered at origin (Y-up).
 *
 * Returns:
 * - sides: array of 4 descriptors { key, positions, normals, uvs } ordered front(+Z), right(+X), back(-Z), left(-X)
 * - caps: { positions, normals, uvs } containing closed bottom cap and optional top cap
 */
function pushCapFan(positions, normals, uvs, center, sideEdges, flipToBottom, segments) {
  const n = flipToBottom ? [0, -1, 0] : [0, 1, 0];
  for (const [edgeStart, edgeEnd] of sideEdges) {
    for (let c = 0; c < segments; c += 1) {
      const p0 = lerp3(edgeStart, edgeEnd, c / segments);
      const p1 = lerp3(edgeStart, edgeEnd, (c + 1) / segments);
      if (flipToBottom) {
        pushTriangle(positions, normals, uvs, center, p1, p0, [0.5, 0.5], [1, 0], [0, 0], n);
      } else {
        pushTriangle(positions, normals, uvs, center, p0, p1, [0.5, 0.5], [0, 1], [1, 1], n);
      }
    }
  }
}

export function buildFrustumSpec(options = {}) {
  const { baseWidth, baseDepth, topWidth, topDepth, height } = computeSolidDimensions(options);
  const requestedSegments = Number.isInteger(options.segments) && options.segments >= 1 ? options.segments : 16;

  const bx = baseWidth / 2;
  const bz = baseDepth / 2;
  const tx = topWidth / 2;
  const tz = topDepth / 2;
  const hy = height / 2;
  const hasTopFace = tx > 1e-6 && tz > 1e-6;
  const sideSegments = Math.abs(bx - tx) < 1e-6 && Math.abs(bz - tz) < 1e-6 ? 1 : requestedSegments;

  // Each entry: [key, bottomLeft, bottomRight, topRight, topLeft] seen CCW from outside
  const sideCorners = [
    ["front", [-bx, -hy, bz], [bx, -hy, bz], [tx, hy, tz], [-tx, hy, tz]],
    ["right", [bx, -hy, bz], [bx, -hy, -bz], [tx, hy, -tz], [tx, hy, tz]],
    ["back", [bx, -hy, -bz], [-bx, -hy, -bz], [-tx, hy, -tz], [tx, hy, -tz]],
    ["left", [-bx, -hy, -bz], [-bx, -hy, bz], [-tx, hy, tz], [-tx, hy, -tz]],
  ];

  const sides = sideCorners.map(([key, bl, br, tr, tl]) => {
    const positions = [];
    const normals = [];
    const uvs = [];
    pushBilinearFace(positions, normals, uvs, bl, br, tr, tl, sideSegments);
    return { key, positions, normals, uvs };
  });

  const capPositions = [];
  const capNormals = [];
  const capUvs = [];

  // Closed bottom cap (-Y outward normal) matching lateral perimeter vertices edge-for-edge
  pushCapFan(
    capPositions,
    capNormals,
    capUvs,
    [0, -hy, 0],
    sideCorners.map(([, bl, br]) => [bl, br]),
    true,
    sideSegments
  );

  // Closed top cap (+Y outward normal) when truncated or box
  if (hasTopFace) {
    pushCapFan(
      capPositions,
      capNormals,
      capUvs,
      [0, hy, 0],
      sideCorners.map(([, , , tr, tl]) => [tl, tr]),
      false,
      sideSegments
    );
  }

  return {
    dimensions: { baseWidth, baseDepth, topWidth, topDepth, height },
    sides,
    caps: { positions: capPositions, normals: capNormals, uvs: capUvs },
  };
}
