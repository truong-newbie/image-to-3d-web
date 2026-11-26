import os

# Must be set before importing trellis modules
os.environ.setdefault("ATTN_BACKEND", "xformers")
os.environ.setdefault("SPCONV_ALGO", "native")

import io
import queue
import sys
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import torch
import trimesh
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image

TRELLIS_ROOT = Path(__file__).resolve().parents[2]
if str(TRELLIS_ROOT) not in sys.path:
    sys.path.insert(0, str(TRELLIS_ROOT))

from trellis.pipelines import TrellisImageTo3DPipeline  # noqa: E402
from trellis.utils import postprocessing_utils  # noqa: E402

MODEL_ID = os.environ.get("TRELLIS_MODEL_ID", "microsoft/TRELLIS-image-large")
OUTPUT_ROOT = Path(os.environ.get("TRELLIS_OUTPUT_DIR", str(TRELLIS_ROOT / "api_outputs")))
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

ALLOWED_FORMATS = {"glb", "stl", "obj", "ply"}
MEDIA_TYPES = {
    "glb": "model/gltf-binary",
    "stl": "model/stl",
    "obj": "text/plain; charset=utf-8",
    "ply": "application/octet-stream",
}
MAX_MULTI_IMAGES = 12

pipeline: Optional[TrellisImageTo3DPipeline] = None
job_queue: "queue.Queue[dict]" = queue.Queue()
jobs: Dict[str, dict] = {}
jobs_lock = threading.Lock()


def _update_job(job_id: str, **fields) -> None:
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id].update(fields)


def _process_single_job(task: dict) -> None:
    job_id = task["job_id"]
    job_dir = Path(task["job_dir"])
    image_count = task["image_count"]
    multi_algo = task["multi_algo"]
    simplify = task["simplify"]
    texture_size = task["texture_size"]
    seed = task["seed"]

    images = [Image.open(job_dir / f"input_{idx}.png") for idx in range(image_count)]

    if image_count == 1:
        _update_job(job_id, status="processing", step="Đang tạo cấu trúc 3D từ ảnh...")
        outputs = pipeline.run(images[0], seed=seed)
    else:
        _update_job(
            job_id,
            status="processing",
            step=f"Đang gộp {image_count} góc ảnh thành 3D ({multi_algo})...",
        )
        outputs = pipeline.run_multi_image(images, seed=seed, mode=multi_algo)

    torch.cuda.empty_cache()

    _update_job(job_id, step="Đang xuất lưới 3D và texture...")
    mesh = postprocessing_utils.to_glb(
        outputs["gaussian"][0],
        outputs["mesh"][0],
        simplify=simplify,
        texture_size=texture_size,
        verbose=False,
    )

    # 1. GLB (Y-up, có màu/texture để xem trên web & mở Blender)
    mesh.export(str(job_dir / "model.glb"))

    # 2. STL (xoay sang Z-up chuẩn phần mềm in 3D)
    stl_mesh = trimesh.Trimesh(vertices=mesh.vertices.copy(), faces=mesh.faces.copy())
    stl_mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    stl_mesh.export(str(job_dir / "model.stl"))

    # 3. OBJ (mesh đơn tự chứa, không cần file .mtl đi kèm)
    obj_mesh = trimesh.Trimesh(vertices=mesh.vertices.copy(), faces=mesh.faces.copy())
    obj_mesh.export(str(job_dir / "model.obj"))

    # 4. PLY (3D Gaussian nguyên bản)
    outputs["gaussian"][0].save_ply(str(job_dir / "model.ply"))

    del outputs
    torch.cuda.empty_cache()

    # mesh.extents trong Y-up: [X=Rộng, Y=Cao, Z=Sâu]
    extents = [round(float(v), 5) for v in mesh.extents]
    _update_job(
        job_id,
        status="done",
        step="Hoàn tất!",
        extents_xyz=extents,
        vertices=int(len(mesh.vertices)),
        faces=int(len(mesh.faces)),
        finished_at=time.time(),
    )


def _worker_loop() -> None:
    while True:
        task = job_queue.get()
        job_id = task["job_id"]
        try:
            _process_single_job(task)
        except Exception as exc:
            torch.cuda.empty_cache()
            _update_job(
                job_id,
                status="error",
                step="Xử lý thất bại",
                error=str(exc),
                finished_at=time.time(),
            )
        finally:
            job_queue.task_done()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global pipeline
    pipeline = TrellisImageTo3DPipeline.from_pretrained(MODEL_ID)
    pipeline.cuda()
    worker = threading.Thread(target=_worker_loop, daemon=True)
    worker.start()
    yield


app = FastAPI(title="TRELLIS Image-to-3D API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.get("/health")
def health() -> dict:
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    return {
        "status": "ok",
        "model_loaded": pipeline is not None,
        "gpu": gpu_name,
        "queue_size": job_queue.qsize(),
    }


@app.post("/jobs")
async def create_job(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    multi_algo: str = Form("stochastic"),
    simplify: float = Form(0.95),
    texture_size: int = Form(1024),
    seed: int = Form(1),
) -> dict:
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model chưa tải xong, vui lòng đợi thêm.")

    uploads: List[UploadFile] = []
    if files:
        uploads.extend(files)
    if file is not None:
        uploads.append(file)

    if not uploads:
        raise HTTPException(status_code=400, detail="Chưa có file ảnh nào được gửi lên.")
    if len(uploads) > MAX_MULTI_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Chỉ hỗ trợ tối đa {MAX_MULTI_IMAGES} ảnh cho mỗi mô hình.",
        )

    algo = multi_algo.strip().lower()
    if algo not in ("stochastic", "multidiffusion"):
        algo = "stochastic"

    parsed_images: List[Image.Image] = []
    for idx, up in enumerate(uploads):
        raw_bytes = await up.read()
        try:
            img = Image.open(io.BytesIO(raw_bytes))
            img.verify()
            img = Image.open(io.BytesIO(raw_bytes))
            parsed_images.append(img)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"File ảnh thứ {idx + 1} ({up.filename}) không hợp lệ: {exc}",
            ) from exc

    job_id = uuid.uuid4().hex[:10]
    job_dir = OUTPUT_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    for idx, img in enumerate(parsed_images):
        img.save(job_dir / f"input_{idx}.png", format="PNG")

    simplify_clamped = max(0.5, min(0.98, float(simplify)))
    tex_size = int(texture_size) if int(texture_size) in (512, 1024, 2048) else 1024

    with jobs_lock:
        jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "mode": "multi_view" if len(parsed_images) > 1 else "single",
            "image_count": len(parsed_images),
            "step": "Đang chờ trong hàng đợi...",
            "error": None,
            "extents_xyz": None,
            "vertices": None,
            "faces": None,
            "created_at": time.time(),
            "finished_at": None,
        }

    job_queue.put(
        {
            "job_id": job_id,
            "job_dir": str(job_dir),
            "image_count": len(parsed_images),
            "multi_algo": algo,
            "simplify": simplify_clamped,
            "texture_size": tex_size,
            "seed": int(seed),
        }
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "mode": "multi_view" if len(parsed_images) > 1 else "single",
        "image_count": len(parsed_images),
    }


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Không tìm thấy job.")
        result = dict(job)

    if result["status"] == "done":
        result["downloads"] = {
            fmt: f"/jobs/{job_id}/download/{fmt}" for fmt in ("glb", "stl", "obj", "ply")
        }
    return result


@app.get("/jobs/{job_id}/download/{fmt}")
def download_model(
    job_id: str,
    fmt: str,
    height_mm: float = Query(0.0, ge=0.0, le=10000.0),
) -> FileResponse:
    fmt = fmt.lower().strip()
    if fmt not in ALLOWED_FORMATS:
        raise HTTPException(status_code=400, detail="Định dạng không hỗ trợ (chỉ glb, stl, obj, ply).")

    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy job.")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail="Mô hình chưa xử lý xong.")

    job_dir = OUTPUT_ROOT / job_id
    src_path = job_dir / f"model.{fmt}"
    if not src_path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy file đầu ra.")

    # PLY là 3D Gaussian splats nên trả nguyên bản
    if height_mm <= 0 or fmt == "ply":
        return FileResponse(
            path=str(src_path),
            media_type=MEDIA_TYPES[fmt],
            filename=f"trellis_{job_id}.{fmt}",
        )

    size_tag = f"{height_mm:g}".replace(".", "_")
    scaled_path = job_dir / f"model_{size_tag}mm.{fmt}"
    if not scaled_path.exists():
        loaded = trimesh.load(str(src_path))
        if isinstance(loaded, trimesh.Scene):
            bounds = loaded.bounds
            cur_height = float(bounds[1][1] - bounds[0][1])
        elif fmt == "stl":
            # STL đã xoay sang Z-up nên chiều cao là trục Z (index 2)
            cur_height = float(loaded.extents[2])
        else:
            # GLB/OBJ dùng Y-up nên chiều cao là trục Y (index 1)
            cur_height = float(loaded.extents[1])

        if cur_height <= 0:
            raise HTTPException(status_code=500, detail="Kích thước lưới không hợp lệ.")
        loaded.apply_scale(height_mm / cur_height)
        loaded.export(str(scaled_path))

    return FileResponse(
        path=str(scaled_path),
        media_type=MEDIA_TYPES[fmt],
        filename=f"trellis_{job_id}_{size_tag}mm.{fmt}",
    )
