function cross2d(a, b, c) {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function validateQuadCorners(corners) {
  if (!Array.isArray(corners) || corners.length !== 4) {
    throw new Error("Cần đúng 4 điểm góc (trên-trái, trên-phải, dưới-phải, dưới-trái).");
  }
  for (const pt of corners) {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      throw new Error("Tọa độ điểm góc không hợp lệ.");
    }
  }
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const c = cross2d(corners[i], corners[(i + 1) % 4], corners[(i + 2) % 4]);
    if (Math.abs(c) < 1e-3) {
      throw new Error("4 góc không được thẳng hàng hoặc trùng nhau.");
    }
    const curSign = c > 0 ? 1 : -1;
    if (sign === 0) sign = curSign;
    else if (sign !== curSign) {
      throw new Error("4 góc phải tạo thành tứ giác lồi (không được cắt chéo nhau).");
    }
  }
}

export function estimateRectSize(corners, maxEdge = 1536) {
  validateQuadCorners(corners);
  const [tl, tr, br, bl] = corners;
  const avgWidth = (dist(tl, tr) + dist(bl, br)) / 2;
  const avgHeight = (dist(tl, bl) + dist(tr, br)) / 2;
  if (avgWidth < 8 || avgHeight < 8) {
    throw new Error("Vùng chọn quá nhỏ, hãy kéo 4 góc rộng hơn.");
  }
  const scale = Math.min(1, maxEdge / Math.max(avgWidth, avgHeight));
  return {
    width: Math.max(8, Math.round(avgWidth * scale)),
    height: Math.max(8, Math.round(avgHeight * scale)),
  };
}

function solveLinear8x8(matrix, rhs) {
  const n = 8;
  const a = matrix.map((row, idx) => [...row, rhs[idx]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let maxVal = Math.abs(a[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      const val = Math.abs(a[r][col]);
      if (val > maxVal) {
        maxVal = val;
        pivotRow = r;
      }
    }
    if (maxVal < 1e-10) {
      throw new Error("Không tính được phép biến đổi phối cảnh từ 4 góc này.");
    }
    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
    }
    const pivot = a[col][col];
    for (let j = col; j <= n; j += 1) {
      a[col][j] /= pivot;
    }
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = a[r][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j += 1) {
        a[r][j] -= factor * a[col][j];
      }
    }
  }
  return a.map((row) => row[n]);
}

/**
 * Computes inverse homography H mapping destination rect pixels (u, v)
 * to source image coordinates (x, y).
 */
export function computeInverseHomography(srcCorners, dstWidth, dstHeight) {
  validateQuadCorners(srcCorners);
  if (!Number.isFinite(dstWidth) || !Number.isFinite(dstHeight) || dstWidth < 2 || dstHeight < 2) {
    throw new Error("Kích thước ảnh đích không hợp lệ.");
  }
  const dstCorners = [
    { x: 0, y: 0 },
    { x: dstWidth - 1, y: 0 },
    { x: dstWidth - 1, y: dstHeight - 1 },
    { x: 0, y: dstHeight - 1 },
  ];
  const matrix = [];
  const rhs = [];

  for (let i = 0; i < 4; i += 1) {
    const u = dstCorners[i].x;
    const v = dstCorners[i].y;
    const x = srcCorners[i].x;
    const y = srcCorners[i].y;
    matrix.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    rhs.push(x);
    matrix.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    rhs.push(y);
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7] = solveLinear8x8(matrix, rhs);
  return [h0, h1, h2, h3, h4, h5, h6, h7, 1];
}

export function applyHomography(h, u, v) {
  const w = h[6] * u + h[7] * v + h[8];
  return {
    x: (h[0] * u + h[1] * v + h[2]) / w,
    y: (h[3] * u + h[4] * v + h[5]) / w,
  };
}

/**
 * Warps an RGBA pixel buffer inside `srcCorners` into a flattened rectangle.
 */
export function warpRgbaData(srcData, srcWidth, srcHeight, srcCorners, dstWidth, dstHeight) {
  const h = computeInverseHomography(srcCorners, dstWidth, dstHeight);
  const out = new Uint8ClampedArray(dstWidth * dstHeight * 4);
  const maxX = srcWidth - 1;
  const maxY = srcHeight - 1;

  for (let v = 0; v < dstHeight; v += 1) {
    for (let u = 0; u < dstWidth; u += 1) {
      const denom = h[6] * u + h[7] * v + 1;
      const sx = Math.max(0, Math.min(maxX, (h[0] * u + h[1] * v + h[2]) / denom));
      const sy = Math.max(0, Math.min(maxY, (h[3] * u + h[4] * v + h[5]) / denom));

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(maxX, x0 + 1);
      const y1 = Math.min(maxY, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const i00 = (y0 * srcWidth + x0) * 4;
      const i10 = (y0 * srcWidth + x1) * 4;
      const i01 = (y1 * srcWidth + x0) * 4;
      const i11 = (y1 * srcWidth + x1) * 4;
      const dstIdx = (v * dstWidth + u) * 4;

      for (let c = 0; c < 4; c += 1) {
        out[dstIdx + c] = Math.round(
          srcData[i00 + c] * w00 +
            srcData[i10 + c] * w10 +
            srcData[i01 + c] * w01 +
            srcData[i11 + c] * w11
        );
      }
    }
  }
  return out;
}
