import { estimateRectSize, warpRgbaData } from "./perspective_math.mjs";

const DEFAULT_CROP = () => ({ x: 0, y: 0, w: 1, h: 1, dirty: false });
const DEFAULT_QUAD = () => [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.08 },
  { x: 0.92, y: 0.92 },
  { x: 0.08, y: 0.92 },
];
const MIN_CROP_SPAN = 0.05;
const HANDLE_HIT_RADIUS_PX = 18;

function clamp01(val) {
  return Math.max(0, Math.min(1, val));
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Không đọc được ảnh ${file.name}.`));
    };
    img.src = url;
  });
}

export class ImageRegionEditor {
  constructor(canvas, onChange = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onChange = onChange;

    this.stateByFile = new WeakMap();
    this.imageByFile = new WeakMap();
    this.activeFile = null;
    this.activeImg = null;
    this.mode = "crop"; // "crop" | "quad"
    this.drawRect = { x: 0, y: 0, w: 1, h: 1 };
    this.dragState = null;
    this.loadToken = 0;

    this.bindEvents();
  }

  getState(file) {
    let st = this.stateByFile.get(file);
    if (!st) {
      st = { crop: DEFAULT_CROP(), quad: DEFAULT_QUAD() };
      this.stateByFile.set(file, st);
    }
    return st;
  }

  async ensureImage(file) {
    let img = this.imageByFile.get(file);
    if (!img) {
      img = await loadImageFromFile(file);
      this.imageByFile.set(file, img);
    }
    return img;
  }

  async setTarget(file, mode) {
    this.mode = mode === "quad" ? "quad" : "crop";
    this.activeFile = file || null;
    const token = ++this.loadToken;
    if (!file) {
      this.activeImg = null;
      this.render();
      return;
    }
    const img = await this.ensureImage(file);
    if (token !== this.loadToken) return;
    this.activeImg = img;
    this.render();
  }

  setMode(mode) {
    this.mode = mode === "quad" ? "quad" : "crop";
    this.dragState = null;
    this.render();
  }

  resetActive() {
    if (!this.activeFile) return;
    const st = this.getState(this.activeFile);
    if (this.mode === "quad") {
      st.quad = DEFAULT_QUAD();
    } else {
      st.crop = DEFAULT_CROP();
    }
    this.render();
    this.onChange();
  }

  isCropped(file) {
    if (!file) return false;
    const { crop } = this.getState(file);
    return (
      crop.dirty &&
      (crop.x > 0.002 || crop.y > 0.002 || crop.w < 0.996 || crop.h < 0.996)
    );
  }

  async exportCroppedFile(file) {
    if (!this.isCropped(file)) return file;
    const img = await this.ensureImage(file);
    const { crop } = this.getState(file);
    const sx = Math.max(0, Math.round(crop.x * img.naturalWidth));
    const sy = Math.max(0, Math.round(crop.y * img.naturalHeight));
    const sw = Math.max(8, Math.min(img.naturalWidth - sx, Math.round(crop.w * img.naturalWidth)));
    const sh = Math.max(8, Math.min(img.naturalHeight - sy, Math.round(crop.h * img.naturalHeight)));

    const outCanvas = document.createElement("canvas");
    outCanvas.width = sw;
    outCanvas.height = sh;
    outCanvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Không tạo được ảnh sau khi cắt.");
    const stem = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${stem}_cropped.png`, { type: "image/png" });
  }

  async exportWarpedCanvas(file) {
    const img = await this.ensureImage(file);
    const { quad } = this.getState(file);

    // Cap working source dimension to keep CPU bilinear warp responsive
    const maxSrcEdge = 1600;
    const srcScale = Math.min(1, maxSrcEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const srcW = Math.max(16, Math.round(img.naturalWidth * srcScale));
    const srcH = Math.max(16, Math.round(img.naturalHeight * srcScale));

    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    const srcCtx = srcCanvas.getContext("2d");
    srcCtx.drawImage(img, 0, 0, srcW, srcH);
    const srcImageData = srcCtx.getImageData(0, 0, srcW, srcH);

    const pxCorners = quad.map((pt) => ({
      x: pt.x * (srcW - 1),
      y: pt.y * (srcH - 1),
    }));
    const { width: dstW, height: dstH } = estimateRectSize(pxCorners, 1536);
    const warpedBytes = warpRgbaData(srcImageData.data, srcW, srcH, pxCorners, dstW, dstH);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = dstW;
    outCanvas.height = dstH;
    const outCtx = outCanvas.getContext("2d");
    outCtx.putImageData(new ImageData(warpedBytes, dstW, dstH), 0, 0);
    return outCanvas;
  }

  toNormCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = ((clientX - rect.left) / Math.max(1, rect.width)) * this.canvas.width;
    const cy = ((clientY - rect.top) / Math.max(1, rect.height)) * this.canvas.height;
    return {
      cx,
      cy,
      nx: clamp01((cx - this.drawRect.x) / Math.max(1, this.drawRect.w)),
      ny: clamp01((cy - this.drawRect.y) / Math.max(1, this.drawRect.h)),
    };
  }

  normToCanvas(pt) {
    return {
      x: this.drawRect.x + pt.x * this.drawRect.w,
      y: this.drawRect.y + pt.y * this.drawRect.h,
    };
  }

  getCropHandlePoints(crop) {
    return {
      tl: { x: crop.x, y: crop.y },
      tr: { x: crop.x + crop.w, y: crop.y },
      br: { x: crop.x + crop.w, y: crop.y + crop.h },
      bl: { x: crop.x, y: crop.y + crop.h },
    };
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (e) => {
      if (!this.activeFile || !this.activeImg) return;
      const { cx, cy, nx, ny } = this.toNormCoords(e.clientX, e.clientY);
      const st = this.getState(this.activeFile);

      if (this.mode === "quad") {
        let bestIdx = -1;
        let bestDist = HANDLE_HIT_RADIUS_PX * (this.canvas.width / Math.max(1, this.canvas.clientWidth));
        st.quad.forEach((pt, idx) => {
          const cp = this.normToCanvas(pt);
          const d = Math.hypot(cx - cp.x, cy - cp.y);
          if (d <= bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        });
        if (bestIdx >= 0) {
          this.dragState = { type: "quad-pt", idx: bestIdx };
          this.canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      const handles = this.getCropHandlePoints(st.crop);
      const hitLimit = HANDLE_HIT_RADIUS_PX * (this.canvas.width / Math.max(1, this.canvas.clientWidth));
      let bestKey = null;
      let bestDist = hitLimit;
      Object.entries(handles).forEach(([key, pt]) => {
        const cp = this.normToCanvas(pt);
        const d = Math.hypot(cx - cp.x, cy - cp.y);
        if (d <= bestDist) {
          bestDist = d;
          bestKey = key;
        }
      });

      if (bestKey) {
        this.dragState = { type: "crop-corner", key: bestKey, startCrop: { ...st.crop } };
        this.canvas.setPointerCapture(e.pointerId);
      } else if (
        nx >= st.crop.x &&
        nx <= st.crop.x + st.crop.w &&
        ny >= st.crop.y &&
        ny <= st.crop.y + st.crop.h
      ) {
        this.dragState = {
          type: "crop-move",
          startNx: nx,
          startNy: ny,
          startCrop: { ...st.crop },
        };
        this.canvas.setPointerCapture(e.pointerId);
      }
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.dragState || !this.activeFile) return;
      const { nx, ny } = this.toNormCoords(e.clientX, e.clientY);
      const st = this.getState(this.activeFile);

      if (this.dragState.type === "quad-pt") {
        st.quad[this.dragState.idx] = { x: nx, y: ny };
        this.render();
        this.onChange();
        return;
      }

      if (this.dragState.type === "crop-move") {
        const dx = nx - this.dragState.startNx;
        const dy = ny - this.dragState.startNy;
        const { w, h } = this.dragState.startCrop;
        st.crop = {
          x: Math.max(0, Math.min(1 - w, this.dragState.startCrop.x + dx)),
          y: Math.max(0, Math.min(1 - h, this.dragState.startCrop.y + dy)),
          w,
          h,
          dirty: true,
        };
        this.render();
        this.onChange();
        return;
      }

      if (this.dragState.type === "crop-corner") {
        const s = this.dragState.startCrop;
        let left = s.x;
        let top = s.y;
        let right = s.x + s.w;
        let bottom = s.y + s.h;
        const key = this.dragState.key;

        if (key.includes("l")) left = Math.min(nx, right - MIN_CROP_SPAN);
        if (key.includes("r")) right = Math.max(nx, left + MIN_CROP_SPAN);
        if (key.includes("t")) top = Math.min(ny, bottom - MIN_CROP_SPAN);
        if (key.includes("b")) bottom = Math.max(ny, top + MIN_CROP_SPAN);

        st.crop = {
          x: clamp01(left),
          y: clamp01(top),
          w: Math.max(MIN_CROP_SPAN, right - left),
          h: Math.max(MIN_CROP_SPAN, bottom - top),
          dirty: true,
        };
        this.render();
        this.onChange();
      }
    });

    const endDrag = (e) => {
      if (!this.dragState) return;
      this.dragState = null;
      if (this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
  }

  render() {
    const cssWidth = Math.max(280, this.canvas.parentElement?.clientWidth || 420);
    const cssHeight = 270;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.activeFile || !this.activeImg) return;

    const pad = 12 * dpr;
    const availW = this.canvas.width - pad * 2;
    const availH = this.canvas.height - pad * 2;
    const scale = Math.min(availW / this.activeImg.naturalWidth, availH / this.activeImg.naturalHeight);
    const drawW = this.activeImg.naturalWidth * scale;
    const drawH = this.activeImg.naturalHeight * scale;
    const drawX = (this.canvas.width - drawW) / 2;
    const drawY = (this.canvas.height - drawH) / 2;
    this.drawRect = { x: drawX, y: drawY, w: drawW, h: drawH };

    ctx.drawImage(this.activeImg, drawX, drawY, drawW, drawH);

    const st = this.getState(this.activeFile);
    if (this.mode === "quad") {
      const pts = st.quad.map((pt) => this.normToCanvas(pt));
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.48)";
      ctx.beginPath();
      ctx.rect(drawX, drawY, drawW, drawH);
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill("evenodd");

      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.stroke();

      pts.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = "#2563eb";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${10 * dpr}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(idx + 1), p.x, p.y);
      });
      ctx.restore();
      return;
    }

    // Crop mode overlay
    const cx = drawX + st.crop.x * drawW;
    const cy = drawY + st.crop.y * drawH;
    const cw = st.crop.w * drawW;
    const ch = st.crop.h * drawH;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.48)";
    ctx.beginPath();
    ctx.rect(drawX, drawY, drawW, drawH);
    ctx.rect(cx, cy, cw, ch);
    ctx.fill("evenodd");

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 * dpr;
    ctx.strokeRect(cx, cy, cw, ch);

    const handles = [
      { x: cx, y: cy },
      { x: cx + cw, y: cy },
      { x: cx + cw, y: cy + ch },
      { x: cx, y: cy + ch },
    ];
    handles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "#2563eb";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
    });
    ctx.restore();
  }
}
