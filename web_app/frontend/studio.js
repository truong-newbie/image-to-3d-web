import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { dimensionsMm, scaleForDimension } from "./studio_math.mjs";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) return;
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose();
    });
  });
}

// Older TRELLIS exports omitted metallicFactor. glTF then defaults to fully metallic.
function repairLegacyTrellisMaterial(gltf) {
  const materials = gltf.parser?.json?.materials;
  if (materials?.length !== 1) return;
  const pbr = materials[0].pbrMetallicRoughness;
  if (!pbr?.baseColorTexture || pbr.metallicFactor !== undefined || pbr.metallicRoughnessTexture || pbr.roughnessFactor !== 1) return;

  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => {
      if (material?.isMeshStandardMaterial && material.metalness === 1) {
        material.metalness = 0;
        material.needsUpdate = true;
      }
    });
  });
}

export class Studio {
  constructor(container, onChange = () => {}) {
    this.container = container;
    this.onChange = onChange;
    this.model = null;
    this.baseSize = null;
    this.name = "model";
    this.history = [];
    this.historyIndex = -1;
    this.loadToken = 0;
    this.autoRotate = false;
    this.mode = "translate";
    this.loader = new GLTFLoader();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.0001, 1000);
    this.camera.position.set(0.18, 0.14, 0.22);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xa5b4c8, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(0.3, 0.5, 0.4);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.9);
    fillLight.position.set(-0.3, 0.1, -0.2);
    this.scene.add(fillLight);

    const grid = new THREE.GridHelper(1, 100, 0x94a3b8, 0xcbd5e1);
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    this.scene.add(grid);
    this.scene.add(new THREE.AxesHelper(0.15));

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.target.set(0, 0.05, 0);
    this.orbit.update();

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setMode(this.mode);
    this.gizmo.setSize(0.8);
    this.scene.add(this.gizmo.getHelper());
    this.gizmo.addEventListener("dragging-changed", (event) => {
      this.orbit.enabled = !event.value;
      this.orbit.autoRotate = this.autoRotate && !event.value;
    });
    this.gizmo.addEventListener("objectChange", () => this.onChange());
    this.gizmo.addEventListener("mouseUp", () => this.pushHistory());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.orbit.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  hasModel() {
    return this.model !== null;
  }

  clear() {
    this.loadToken += 1;
    this.removeCurrent();
    this.onChange();
  }

  removeCurrent() {
    if (this.model) {
      this.gizmo.detach();
      this.scene.remove(this.model);
      disposeObject(this.model);
    }
    this.model = null;
    this.baseSize = null;
    this.history = [];
    this.historyIndex = -1;
  }

  async loadFromUrl(url, options = {}) {
    const token = ++this.loadToken;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Không tải được GLB (HTTP ${response.status}).`);
    const buffer = await response.arrayBuffer();
    if (token !== this.loadToken) return false;
    return this.parseBuffer(buffer, token, options);
  }

  async loadFromFile(file) {
    const token = ++this.loadToken;
    const buffer = await file.arrayBuffer();
    if (token !== this.loadToken) return false;
    return this.parseBuffer(buffer, token, { name: file.name });
  }

  async parseBuffer(buffer, token, options) {
    const gltf = await this.loader.parseAsync(buffer, "");
    if (token !== this.loadToken) {
      disposeObject(gltf.scene);
      return false;
    }
    repairLegacyTrellisMaterial(gltf);
    this.setContent(gltf.scene, options);
    return true;
  }

  loadSample() {
    this.loadToken += 1;
    const sample = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x4679d8, roughness: 0.55 }),
    );
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.016, 32),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 }),
    );
    top.position.y = 0.058;
    sample.add(body, top);
    this.setContent(sample, { name: "mau-thu" });
  }

  setContent(content, { name = "model", initialHeightMm = null } = {}) {
    this.removeCurrent();
    const bounds = new THREE.Box3().setFromObject(content);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.x + size.y + size.z) || Math.min(size.x, size.y, size.z) <= 0) {
      disposeObject(content);
      throw new Error("GLB không có mô hình 3D với kích thước hợp lệ.");
    }
    const center = bounds.getCenter(new THREE.Vector3());
    content.position.sub(center);
    this.baseSize = [size.x, size.y, size.z];
    this.model = new THREE.Group();
    this.model.add(content);
    this.name = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_") || "model";

    if (initialHeightMm !== null) {
      const scale = (Number(initialHeightMm) / 1000) / size.y;
      if (!Number.isFinite(scale) || scale <= 0) {
        this.removeCurrent();
        throw new Error("Chiều cao ban đầu không hợp lệ.");
      }
      this.model.scale.setScalar(scale);
    }
    this.model.position.y = (size.y * this.model.scale.y) / 2;
    this.scene.add(this.model);
    this.gizmo.attach(this.model);
    this.fitView();
    this.history = [this.captureTransform()];
    this.historyIndex = 0;
    this.onChange();
  }

  fitView() {
    if (!this.model) return;
    const bounds = new THREE.Box3().setFromObject(this.model);
    const center = bounds.getCenter(new THREE.Vector3());
    const largest = Math.max(...bounds.getSize(new THREE.Vector3()).toArray(), 0.02);
    const distance = largest * 2.7;
    this.camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.7, distance));
    this.camera.near = Math.max(0.0001, largest / 1000);
    this.camera.far = Math.max(100, largest * 100);
    this.camera.updateProjectionMatrix();
    this.orbit.target.copy(center);
    this.orbit.minDistance = largest * 0.25;
    this.orbit.maxDistance = largest * 30;
    this.orbit.update();
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    this.orbit.autoRotate = enabled;
  }

  setMode(mode) {
    if (!["translate", "rotate", "scale"].includes(mode)) return;
    this.mode = mode;
    this.gizmo.setMode(mode);
    this.onChange();
  }

  getDimensionsMm() {
    return this.model ? dimensionsMm(this.baseSize, this.model.scale.toArray()) : null;
  }

  setDimension(axis, targetMm, locked) {
    if (!this.model) return;
    const oldHeight = this.getDimensionsMm()[1] / 1000;
    const wasOnGround = Math.abs(this.model.position.y - oldHeight / 2) < 0.00001;
    const next = scaleForDimension(this.baseSize, this.model.scale.toArray(), axis, targetMm, locked);
    this.model.scale.fromArray(next);
    if (wasOnGround) this.model.position.y = this.getDimensionsMm()[1] / 2000;
    this.pushHistory();
  }

  captureTransform() {
    return {
      position: this.model.position.toArray(),
      quaternion: this.model.quaternion.toArray(),
      scale: this.model.scale.toArray(),
    };
  }

  applyTransform(state) {
    this.model.position.fromArray(state.position);
    this.model.quaternion.fromArray(state.quaternion);
    this.model.scale.fromArray(state.scale);
    this.model.updateMatrixWorld(true);
    this.onChange();
  }

  pushHistory() {
    if (!this.model) return;
    const state = this.captureTransform();
    if (JSON.stringify(state) === JSON.stringify(this.history[this.historyIndex])) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(state);
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.onChange();
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1;
  }

  undo() {
    if (!this.canUndo()) return;
    this.historyIndex -= 1;
    this.applyTransform(this.history[this.historyIndex]);
  }

  redo() {
    if (!this.canRedo()) return;
    this.historyIndex += 1;
    this.applyTransform(this.history[this.historyIndex]);
  }

  getProjectState() {
    if (!this.model) return null;
    return {
      history: this.history.map((state) => ({
        position: [...state.position],
        quaternion: [...state.quaternion],
        scale: [...state.scale],
      })),
      historyIndex: this.historyIndex,
    };
  }

  restoreProjectState(state) {
    if (!this.model || !state?.history?.length) return;
    this.history = state.history;
    this.historyIndex = Math.max(0, Math.min(state.historyIndex, this.history.length - 1));
    this.applyTransform(this.history[this.historyIndex]);
  }

  async exportGlb() {
    if (!this.model) return;
    const exportScene = new THREE.Scene();
    exportScene.add(this.model.clone(true));
    const data = await new GLTFExporter().parseAsync(exportScene, { binary: true });
    downloadBlob(new Blob([data], { type: "model/gltf-binary" }), `${this.name}_edited.glb`);
  }

  exportStl() {
    if (!this.model) return;
    const exportRoot = new THREE.Group();
    exportRoot.add(this.model.clone(true));
    exportRoot.rotation.x = Math.PI / 2;
    exportRoot.scale.setScalar(1000);
    exportRoot.updateMatrixWorld(true);
    const data = new STLExporter().parse(exportRoot, { binary: true });
    downloadBlob(new Blob([data], { type: "model/stl" }), `${this.name}_edited_mm.stl`);
  }
}
