import * as THREE from "three";

/**
 * Builds a 3D framed artwork group (backplate + raised border rails + textured front canvas).
 * Oriented Y-up in meters; Studio scales height to initialHeightMm on attach.
 */
export function buildFramedArtwork(
  sourceCanvas,
  { frameColor = 0x4a3728, borderRatio = 0.065, backDepth = 0.008, railProtrude = 0.004 } = {}
) {
  if (!sourceCanvas || sourceCanvas.width <= 0 || sourceCanvas.height <= 0) {
    throw new Error("Ảnh tranh đầu vào không hợp lệ.");
  }

  const aspect = sourceCanvas.width / sourceCanvas.height;
  const artHeight = 0.088;
  const artWidth = Math.max(0.015, artHeight * aspect);
  const border = Math.max(0.0035, Math.min(artWidth, artHeight) * borderRatio);
  const totalWidth = artWidth + border * 2;
  const totalHeight = artHeight + border * 2;
  const railDepth = backDepth + railProtrude;
  const railCenterZ = -backDepth + railDepth / 2;

  const group = new THREE.Group();
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.55,
    metalness: 0.08,
  });

  // Solid backplate (z in [-backDepth, 0])
  const backplate = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth, totalHeight, backDepth),
    frameMaterial
  );
  backplate.position.z = -backDepth / 2;
  group.add(backplate);

  // Four raised border rails so STL exports retain a tangible frame lip
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(totalWidth, border, railDepth), frameMaterial);
  topRail.position.set(0, (artHeight + border) / 2, railCenterZ);

  const bottomRail = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth, border, railDepth),
    frameMaterial
  );
  bottomRail.position.set(0, -(artHeight + border) / 2, railCenterZ);

  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(border, artHeight, railDepth), frameMaterial);
  leftRail.position.set(-(artWidth + border) / 2, 0, railCenterZ);

  const rightRail = new THREE.Mesh(new THREE.BoxGeometry(border, artHeight, railDepth), frameMaterial);
  rightRail.position.set((artWidth + border) / 2, 0, railCenterZ);

  group.add(topRail, bottomRail, leftRail, rightRail);

  // Front artwork canvas slightly ahead of backplate to avoid z-fighting
  const texture = new THREE.CanvasTexture(sourceCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const artworkMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.72,
    metalness: 0.02,
  });
  const artworkPlane = new THREE.Mesh(new THREE.PlaneGeometry(artWidth, artHeight), artworkMaterial);
  artworkPlane.position.z = 0.0003;
  group.add(artworkPlane);

  return group;
}
