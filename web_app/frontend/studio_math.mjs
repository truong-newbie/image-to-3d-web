export const MILLIMETERS_PER_METER = 1000;

export function dimensionsMm(baseSize, scale) {
  return baseSize.map((size, axis) => size * Math.abs(scale[axis]) * MILLIMETERS_PER_METER);
}

export function scaleForDimension(baseSize, scale, axis, targetMm, locked) {
  if (!Number.isInteger(axis) || axis < 0 || axis > 2) {
    throw new Error("Trục kích thước không hợp lệ.");
  }
  const target = Number(targetMm);
  if (!Number.isFinite(target) || target <= 0 || target > 10000) {
    throw new Error("Kích thước phải lớn hơn 0 và không quá 10.000 mm.");
  }
  const currentMm = dimensionsMm(baseSize, scale)[axis];
  if (!Number.isFinite(currentMm) || currentMm <= 0) {
    throw new Error("Mô hình không có kích thước hợp lệ ở trục này.");
  }
  const factor = target / currentMm;
  const next = [...scale];
  if (locked) {
    return next.map((value) => value * factor);
  }
  next[axis] *= factor;
  return next;
}
