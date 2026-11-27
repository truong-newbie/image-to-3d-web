import * as THREE from "three";
import { buildFrustumSpec, SOLID_PRESETS } from "./solid_math.mjs";

function makeGeometry(part) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(part.normals, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(part.uvs, 2));
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

function sampleEdgeColor(canvas) {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0x3b352e;
    const w = canvas.width;
    const h = canvas.height;
    const points = [
      [Math.floor(w * 0.5), Math.max(0, h - 2)],
      [Math.floor(w * 0.2), Math.floor(h * 0.8)],
      [Math.floor(w * 0.8), Math.floor(h * 0.8)],
    ];
    let r = 0;
    let g = 0;
    let b = 0;
    for (const [x, y] of points) {
      const px = ctx.getImageData(x, y, 1, 1).data;
      r += px[0];
      g += px[1];
      b += px[2];
    }
    const n = points.length;
    return (
      (Math.round((r / n) * 0.65) << 16) |
      (Math.round((g / n) * 0.65) << 8) |
      Math.round((b / n) * 0.65)
    );
  } catch {
    return 0x3b352e;
  }
}

/**
 * Builds a closed 3D solid group (4-sided pyramid, frustum, or rectangular box/stele)
 * from 1..4 warped canvases (`front`, `right`, `back`, `left`).
 * Missing faces cycle cleanly through the provided canvases.
 */
export function buildSolidFromCanvases(
  sourceCanvases,
  { preset = "pyramid", topRatio, depthRatio } = {}
) {
  const canvases = (sourceCanvases || []).filter(
    (c) => c && c.width > 0 && c.height > 0
  );
  if (canvases.length === 0) {
    throw new Error("Cần ít nhất 1 ảnh hợp lệ để dựng khối 3D.");
  }

  const defaults = SOLID_PRESETS[preset] || SOLID_PRESETS.pyramid;
  const resolvedTopRatio = Number.isFinite(topRatio) ? topRatio : defaults.topRatio;
  const resolvedDepthRatio = Number.isFinite(depthRatio) ? depthRatio : defaults.depthRatio;

  const primary = canvases[0];
  const primaryAspect = primary.width / primary.height;
  const spec = buildFrustumSpec({
    primaryAspect,
    topRatio: resolvedTopRatio,
    depthRatio: resolvedDepthRatio,
  });

  const group = new THREE.Group();

  spec.sides.forEach((sidePart, idx) => {
    const faceCanvas = canvases[idx % canvases.length];
    const texture = new THREE.CanvasTexture(faceCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.72,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(makeGeometry(sidePart), material);
    mesh.name = `solid_${sidePart.key}`;
    group.add(mesh);
  });

  const capMaterial = new THREE.MeshStandardMaterial({
    color: sampleEdgeColor(primary),
    roughness: 0.85,
    metalness: 0.05,
  });
  const capMesh = new THREE.Mesh(makeGeometry(spec.caps), capMaterial);
  capMesh.name = "solid_caps";
  group.add(capMesh);

  return group;
}
