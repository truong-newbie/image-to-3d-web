import { Studio } from "./studio.js";

const STORAGE_KEY = "trellis_api_url";
const MAX_IMAGES = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const apiUrlInput = document.getElementById("apiUrlInput");
const checkServerBtn = document.getElementById("checkServerBtn");
const copyShareBtn = document.getElementById("copyShareBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

const dropzone = document.getElementById("dropzone");
const imageInput = document.getElementById("imageInput");
const dropzonePlaceholder = document.getElementById("dropzonePlaceholder");
const thumbGrid = document.getElementById("thumbGrid");
const imageActions = document.getElementById("imageActions");
const addMoreBtn = document.getElementById("addMoreBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const fileInfo = document.getElementById("fileInfo");
const modeBox = document.getElementById("modeBox");

const processBtn = document.getElementById("processBtn");
const progressBox = document.getElementById("progressBox");
const progressText = document.getElementById("progressText");
const errorBox = document.getElementById("errorBox");

const batchTabs = document.getElementById("batchTabs");
const studioCanvas = document.getElementById("studioCanvas");
const viewerEmpty = document.getElementById("viewerEmpty");
const autoRotateToggle = document.getElementById("autoRotateToggle");
const resultSection = document.getElementById("resultSection");
const meshStats = document.getElementById("meshStats");
const studioToolbar = document.getElementById("studioToolbar");
const toolButtons = document.querySelectorAll("[data-tool]");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const fitViewBtn = document.getElementById("fitViewBtn");
const openGlbBtn = document.getElementById("openGlbBtn");
const openGlbInput = document.getElementById("openGlbInput");
const sampleBtn = document.getElementById("sampleBtn");
const widthMmInput = document.getElementById("widthMmInput");
const heightMmInput = document.getElementById("heightMmInput");
const depthMmInput = document.getElementById("depthMmInput");
const dimensionInputs = [widthMmInput, heightMmInput, depthMmInput];
const lockRatioInput = document.getElementById("lockRatioInput");
const exportGlbBtn = document.getElementById("exportGlbBtn");
const exportStlBtn = document.getElementById("exportStlBtn");
const originalDownloads = document.getElementById("originalDownloads");
const downloadBtns = document.querySelectorAll(".btn-download");

let selectedFiles = [];
let previewUrls = [];
let batchResults = []; // [{ label, job_id, status, step, extents_xyz, vertices, faces, error }]
let activeResultIndex = -1;
let isProcessing = false;
let selectionToken = 0;
const studio = new Studio(studioCanvas, updateStudioPanel);

function getApiBase() {
  return apiUrlInput.value.trim().replace(/\/+$/, "");
}

function isNotebookLink(url) {
  try {
    return new URL(url).hostname === "colab.research.google.com";
  } catch {
    return false;
  }
}

function getSelectedMode() {
  const checked = document.querySelector('input[name="processMode"]:checked');
  return checked ? checked.value : "multi_view";
}

function setStatus(state, text) {
  statusDot.className = "dot" + (state ? ` ${state}` : "");
  statusText.textContent = text;
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function updateProcessBtnState() {
  const api = getApiBase();
  processBtn.disabled = isProcessing || selectedFiles.length === 0 || !api || isNotebookLink(api);
}

function renderThumbnails() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
  thumbGrid.innerHTML = "";

  if (selectedFiles.length === 0) {
    thumbGrid.classList.add("hidden");
    thumbGrid.classList.remove("single");
    dropzonePlaceholder.classList.remove("hidden");
    imageActions.classList.add("hidden");
    fileInfo.classList.add("hidden");
    modeBox.classList.add("hidden");
    updateProcessBtnState();
    return;
  }

  dropzonePlaceholder.classList.add("hidden");
  thumbGrid.classList.remove("hidden");
  thumbGrid.classList.toggle("single", selectedFiles.length === 1);
  imageActions.classList.remove("hidden");
  modeBox.classList.toggle("hidden", selectedFiles.length < 2);

  let totalKb = 0;
  selectedFiles.forEach((file, idx) => {
    totalKb += file.size / 1024;
    const url = URL.createObjectURL(file);
    previewUrls.push(url);

    const item = document.createElement("div");
    item.className = "thumb-item";

    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "thumb-remove";
    removeBtn.title = "Xóa ảnh này";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedFiles.splice(idx, 1);
      renderThumbnails();
    });

    item.appendChild(img);
    item.appendChild(removeBtn);
    thumbGrid.appendChild(item);
  });

  if (selectedFiles.length === 1) {
    fileInfo.textContent = `Đã chọn: ${selectedFiles[0].name} (${totalKb.toFixed(1)} KB)`;
  } else {
    fileInfo.textContent = `Đã chọn ${selectedFiles.length} ảnh (tổng ${totalKb.toFixed(1)} KB)`;
  }
  fileInfo.classList.remove("hidden");
  updateProcessBtnState();
}

function addFiles(fileList) {
  const incoming = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
  if (incoming.length === 0) {
    showError("Vui lòng chọn file ảnh (PNG, JPG, WEBP).");
    return;
  }
  const oversized = incoming.find((f) => f.size > MAX_FILE_BYTES);
  if (oversized) {
    showError(`Ảnh ${oversized.name} vượt quá giới hạn 10 MB.`);
    return;
  }
  hideError();
  const spaceLeft = MAX_IMAGES - selectedFiles.length;
  if (spaceLeft <= 0) {
    showError(`Chỉ hỗ trợ tối đa ${MAX_IMAGES} ảnh.`);
    return;
  }
  selectedFiles.push(...incoming.slice(0, spaceLeft));
  if (incoming.length > spaceLeft) {
    showError(`Đã lấy ${spaceLeft} ảnh đầu tiên (giới hạn tối đa ${MAX_IMAGES} ảnh).`);
  }
  renderThumbnails();
}

async function checkServer() {
  const api = getApiBase();
  if (!api) {
    setStatus("offline", "Chưa nhập link API");
    return false;
  }
  if (isNotebookLink(api)) {
    setStatus("offline", "Cần link API từ Cell 3");
    showError("Hãy chạy Cell 3 trong Colab rồi dán link https://...trycloudflare.com, không dán link trang notebook.");
    return false;
  }
  localStorage.setItem(STORAGE_KEY, api);
  setStatus("", "Đang kiểm tra...");

  try {
    const res = await fetch(`${api}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.model_loaded) {
      setStatus("online", `Sẵn sàng (${data.gpu})`);
      return true;
    }
    setStatus("", `Đang tải model trên ${data.gpu}...`);
    return false;
  } catch (err) {
    setStatus("offline", "Không kết nối được server");
    return false;
  }
}

function updateStudioPanel() {
  const dimensions = studio.getDimensionsMm();
  studioToolbar.classList.toggle("hidden", !dimensions);
  if (!dimensions) return;
  dimensionInputs.forEach((input, axis) => {
    if (document.activeElement !== input) input.value = dimensions[axis].toFixed(1);
  });
  undoBtn.disabled = !studio.canUndo();
  redoBtn.disabled = !studio.canRedo();
  toolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === studio.mode);
  });
}

function renderBatchTabs() {
  if (batchResults.length <= 1) {
    batchTabs.classList.add("hidden");
    batchTabs.innerHTML = "";
    return;
  }
  batchTabs.classList.remove("hidden");
  batchTabs.innerHTML = "";

  batchResults.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "batch-tab" + (idx === activeResultIndex ? " active" : "") + (item.status === "error" ? " error" : "");
    const icon = item.status === "done" ? "✅" : item.status === "error" ? "❌" : "⏳";
    btn.textContent = `${icon} ${item.label}`;
    btn.disabled = item.status !== "done";
    btn.addEventListener("click", () => selectResult(idx));
    batchTabs.appendChild(btn);
  });
}

async function selectResult(idx) {
  const item = batchResults[idx];
  if (!item || item.status !== "done") return;
  if (activeResultIndex >= 0 && studio.hasModel()) {
    batchResults[activeResultIndex].editorState = studio.getProjectState();
  }
  activeResultIndex = idx;
  const requestId = ++selectionToken;
  renderBatchTabs();
  studio.clear();
  viewerEmpty.textContent = "Đang mở mô hình trong Studio...";
  viewerEmpty.classList.remove("hidden");
  resultSection.classList.add("hidden");

  const api = item.api || getApiBase();
  try {
    const loaded = await studio.loadFromUrl(`${api}/jobs/${item.job_id}/download/glb`, {
      name: item.label,
      initialHeightMm: 100,
    });
    if (!loaded || requestId !== selectionToken) return;
    if (item.editorState) studio.restoreProjectState(item.editorState);
    viewerEmpty.classList.add("hidden");
    resultSection.classList.remove("hidden");
    originalDownloads.classList.remove("hidden");
    meshStats.textContent = `${item.label} • ${item.vertices.toLocaleString()} đỉnh • ${item.faces.toLocaleString()} mặt`;
    updateStudioPanel();
  } catch (error) {
    if (requestId !== selectionToken) return;
    viewerEmpty.textContent = "Không mở được GLB. Hãy kiểm tra API hoặc tải lại mô hình.";
    showError(error.message || "Không mở được mô hình 3D.");
  }
}

function leaveCurrentResult() {
  if (activeResultIndex >= 0 && studio.hasModel()) {
    batchResults[activeResultIndex].editorState = studio.getProjectState();
  }
  activeResultIndex = -1;
  renderBatchTabs();
}

async function openLocalGlb(file) {
  leaveCurrentResult();
  const requestId = ++selectionToken;
  studio.clear();
  viewerEmpty.textContent = "Đang mở file GLB...";
  viewerEmpty.classList.remove("hidden");
  resultSection.classList.add("hidden");
  try {
    const loaded = await studio.loadFromFile(file);
    if (!loaded || requestId !== selectionToken) return;
    viewerEmpty.classList.add("hidden");
    resultSection.classList.remove("hidden");
    originalDownloads.classList.add("hidden");
    meshStats.textContent = `File từ máy: ${file.name}`;
    updateStudioPanel();
  } catch (error) {
    if (requestId !== selectionToken) return;
    viewerEmpty.textContent = "Không mở được file GLB.";
    showError(error.message || "File GLB không hợp lệ.");
  }
}

function openSample() {
  leaveCurrentResult();
  selectionToken += 1;
  studio.loadSample();
  viewerEmpty.classList.add("hidden");
  resultSection.classList.remove("hidden");
  originalDownloads.classList.add("hidden");
  meshStats.textContent = "Mẫu thử 3D • không cần kết nối Colab";
  updateStudioPanel();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitAndPollJob(api, filesToSend, label, resultIdx) {
  const fd = new FormData();
  filesToSend.forEach((f) => fd.append("files", f));

  const createRes = await fetch(`${api}/jobs`, { method: "POST", body: fd });
  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData.detail || `Lỗi tạo job (HTTP ${createRes.status})`);
  }

  const { job_id } = await createRes.json();
  batchResults[resultIdx].job_id = job_id;
  batchResults[resultIdx].api = api;

  while (true) {
    await sleep(1500);
    const pollRes = await fetch(`${api}/jobs/${job_id}`);
    if (!pollRes.ok) throw new Error(`Lỗi kiểm tra tiến độ (HTTP ${pollRes.status})`);
    const job = await pollRes.json();

    batchResults[resultIdx].status = job.status;
    batchResults[resultIdx].step = job.step;
    progressText.textContent =
      batchResults.length > 1
        ? `[${label}] ${job.step || "Đang xử lý..."}`
        : job.step || "Đang xử lý...";

    if (job.status === "done") {
      batchResults[resultIdx].extents_xyz = job.extents_xyz;
      batchResults[resultIdx].vertices = job.vertices;
      batchResults[resultIdx].faces = job.faces;
      if (activeResultIndex === -1) {
        selectResult(resultIdx);
      } else {
        renderBatchTabs();
      }
      return;
    }

    if (job.status === "error") {
      batchResults[resultIdx].error = job.error || "Xử lý thất bại";
      renderBatchTabs();
      throw new Error(batchResults[resultIdx].error);
    }
  }
}

async function startProcess() {
  const api = getApiBase();
  if (!api || selectedFiles.length === 0 || isProcessing) return;
  if (isNotebookLink(api)) {
    showError("Hãy dán link API https://...trycloudflare.com từ Cell 3, không dán link notebook Colab.");
    return;
  }

  localStorage.setItem(STORAGE_KEY, api);
  hideError();
  isProcessing = true;
  updateProcessBtnState();

  const mode = selectedFiles.length === 1 ? "single" : getSelectedMode();
  selectionToken += 1;
  studio.clear();
  batchResults = [];
  activeResultIndex = -1;
  resultSection.classList.add("hidden");
  viewerEmpty.textContent = "Mô hình 3D sẽ hiển thị tại đây sau khi xử lý xong";
  viewerEmpty.classList.remove("hidden");

  progressBox.classList.remove("hidden");
  progressText.textContent = "Đang tải ảnh lên Colab...";

  try {
    if (mode === "batch") {
      batchResults = selectedFiles.map((f, i) => ({
        label: `Ảnh ${i + 1}`,
        job_id: null,
        status: "queued",
        step: "Đang chờ...",
      }));
      renderBatchTabs();

      const errors = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        try {
          await submitAndPollJob(api, [selectedFiles[i]], `Ảnh ${i + 1}`, i);
        } catch (err) {
          errors.push(`Ảnh ${i + 1}: ${err.message}`);
        }
      }
      if (errors.length > 0) {
        showError(errors.join(" | "));
      }
    } else {
      const label = selectedFiles.length > 1 ? `Gộp ${selectedFiles.length} ảnh` : selectedFiles[0].name;
      batchResults = [{ label, job_id: null, status: "queued", step: "Đang chờ..." }];
      renderBatchTabs();
      await submitAndPollJob(api, selectedFiles, label, 0);
    }
  } catch (err) {
    showError(err.message || "Có lỗi xảy ra khi xử lý.");
  } finally {
    isProcessing = false;
    progressBox.classList.add("hidden");
    updateProcessBtnState();
  }
}

function downloadFormat(fmt) {
  const item = batchResults[activeResultIndex];
  if (!item || !item.job_id) return;
  const api = item.api || getApiBase();
  const url = `${api}/jobs/${item.job_id}/download/${fmt}`;

  const a = document.createElement("a");
  a.href = url;
  a.download = `trellis_${item.job_id}.${fmt}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Event listeners
apiUrlInput.addEventListener("input", updateProcessBtnState);
checkServerBtn.addEventListener("click", checkServer);
copyShareBtn.addEventListener("click", async () => {
  const api = getApiBase();
  if (!api || isNotebookLink(api)) return showError("Hãy nhập link API từ Cell 3 trước khi copy link chia sẻ.");
  const shareUrl = `${window.location.origin}${window.location.pathname}?api=${encodeURIComponent(api)}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    const oldText = copyShareBtn.textContent;
    copyShareBtn.textContent = "Đã copy!";
    setTimeout(() => {
      copyShareBtn.textContent = oldText;
    }, 1500);
  } catch {
    prompt("Copy link chia sẻ bên dưới:", shareUrl);
  }
});

imageInput.addEventListener("change", (e) => {
  addFiles(e.target.files);
  imageInput.value = "";
});
addMoreBtn.addEventListener("click", () => imageInput.click());
clearAllBtn.addEventListener("click", () => {
  selectedFiles = [];
  renderThumbnails();
});
processBtn.addEventListener("click", startProcess);
openGlbBtn.addEventListener("click", () => openGlbInput.click());
openGlbInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) openLocalGlb(file);
  openGlbInput.value = "";
});
sampleBtn.addEventListener("click", openSample);
toolButtons.forEach((button) => {
  button.addEventListener("click", () => studio.setMode(button.dataset.tool));
});
undoBtn.addEventListener("click", () => studio.undo());
redoBtn.addEventListener("click", () => studio.redo());
fitViewBtn.addEventListener("click", () => studio.fitView());
dimensionInputs.forEach((input) => {
  input.addEventListener("change", () => {
    try {
      studio.setDimension(Number(input.dataset.axis), Number(input.value), lockRatioInput.checked);
      hideError();
    } catch (error) {
      showError(error.message);
      input.value = studio.getDimensionsMm()[Number(input.dataset.axis)].toFixed(1);
    }
    updateStudioPanel();
  });
});
exportGlbBtn.addEventListener("click", async () => {
  try {
    await studio.exportGlb();
  } catch (error) {
    showError(`Không xuất được GLB: ${error.message}`);
  }
});
exportStlBtn.addEventListener("click", () => {
  try {
    studio.exportStl();
  } catch (error) {
    showError(`Không xuất được STL: ${error.message}`);
  }
});
autoRotateToggle.addEventListener("change", (event) => {
  studio.setAutoRotate(event.target.checked);
});
window.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) studio.redo();
    else studio.undo();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    studio.redo();
  } else if (studio.hasModel() && !event.ctrlKey && !event.metaKey) {
    const shortcuts = { w: "translate", e: "rotate", r: "scale" };
    const mode = shortcuts[event.key.toLowerCase()];
    if (mode) studio.setMode(mode);
  }
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) {
    addFiles(e.dataTransfer.files);
  }
});

downloadBtns.forEach((btn) => {
  btn.addEventListener("click", () => downloadFormat(btn.dataset.fmt));
});

// Ưu tiên ?api= trên URL, sau đó tới localStorage
const urlParamApi = new URLSearchParams(window.location.search).get("api");
const initialApi = urlParamApi || localStorage.getItem(STORAGE_KEY) || "";
if (initialApi) {
  apiUrlInput.value = initialApi;
  updateProcessBtnState();
  checkServer();
}
