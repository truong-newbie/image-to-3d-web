"""API contract checks without downloading the TRELLIS model."""

import importlib.util
import io
import sys
import time
import types

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image


class FakeMesh:
    vertices = np.zeros((3, 3))
    faces = np.array([[0, 1, 2]])
    extents = np.array([1.0, 2.0, 3.0])

    def __init__(self, vertices=None, faces=None):
        pass

    def apply_transform(self, transform):
        pass

    def apply_scale(self, scale):
        pass

    def export(self, path):
        from pathlib import Path

        Path(path).write_bytes(b"glTF" if path.endswith(".glb") else b"mesh")


class FakeGaussian:
    def save_ply(self, path):
        from pathlib import Path

        Path(path).write_bytes(b"ply\n")


class FakePipeline:
    @classmethod
    def from_pretrained(cls, model_id):
        return cls()

    def cuda(self):
        return self

    def run(self, image, seed):
        return {"gaussian": [FakeGaussian()], "mesh": [FakeMesh()]}

    def run_multi_image(self, images, seed, mode):
        return self.run(images[0], seed)


@pytest.fixture
def api(tmp_path, monkeypatch):
    trimesh = types.ModuleType("trimesh")
    trimesh.Trimesh = FakeMesh
    trimesh.Scene = type("Scene", (), {})
    trimesh.load = lambda path: FakeMesh()
    trimesh.transformations = types.SimpleNamespace(rotation_matrix=lambda *args: None)
    pipelines = types.ModuleType("trellis.pipelines")
    pipelines.TrellisImageTo3DPipeline = FakePipeline
    utils = types.ModuleType("trellis.utils")
    utils.postprocessing_utils = types.SimpleNamespace(to_glb=lambda *args, **kwargs: FakeMesh())
    monkeypatch.setitem(sys.modules, "trimesh", trimesh)
    monkeypatch.setitem(sys.modules, "trellis.pipelines", pipelines)
    monkeypatch.setitem(sys.modules, "trellis.utils", utils)
    monkeypatch.setenv("TRELLIS_OUTPUT_DIR", str(tmp_path))

    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "web_app/backend/server.py"
    spec = importlib.util.spec_from_file_location("web_api_under_test", path)
    server = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(server)
    with TestClient(server.app) as client:
        yield client, server, tmp_path


def png_bytes():
    out = io.BytesIO()
    Image.new("RGB", (2, 2), "red").save(out, format="PNG")
    return out.getvalue()


def wait_done(client, job_id):
    for _ in range(100):
        response = client.get(f"/jobs/{job_id}")
        assert response.status_code == 200
        job = response.json()
        if job["status"] in ("done", "error"):
            return job
        time.sleep(0.01)
    pytest.fail("Job did not finish")


def test_health_single_multi_batch_and_downloads(api):
    client, _, _ = api
    assert client.get("/health").json()["model_loaded"] is True
    image = png_bytes()
    for count in (1, 2, 1, 1):
        files = [("files", (f"image_{i}.png", image, "image/png")) for i in range(count)]
        response = client.post("/jobs", files=files)
        assert response.status_code == 200
        job = wait_done(client, response.json()["job_id"])
        assert job["status"] == "done"
        assert job["image_count"] == count
        for fmt in ("glb", "stl", "obj", "ply"):
            download = client.get(job["downloads"][fmt])
            assert download.status_code == 200
            assert download.content
        assert client.get(job["downloads"]["stl"] + "?height_mm=100").status_code == 200


def test_upload_limits_and_full_queue(api, monkeypatch):
    client, server, _ = api
    image = png_bytes()
    monkeypatch.setattr(server, "MAX_UPLOAD_BYTES", 4)
    response = client.post("/jobs", files={"files": ("image.png", image, "image/png")})
    assert response.status_code == 413

    monkeypatch.setattr(server, "MAX_UPLOAD_BYTES", 10 * 1024 * 1024)
    monkeypatch.setattr(server, "MAX_IMAGE_PIXELS", 1)
    response = client.post("/jobs", files={"files": ("image.png", image, "image/png")})
    assert response.status_code == 413

    monkeypatch.setattr(server, "MAX_IMAGE_PIXELS", 20_000_000)
    monkeypatch.setattr(server.job_queue, "full", lambda: True)
    response = client.post("/jobs", files={"files": ("image.png", image, "image/png")})
    assert response.status_code == 429


def test_expired_results_are_deleted(api):
    _, server, output = api
    job_dir = output / "oldjob"
    job_dir.mkdir()
    (job_dir / "model.glb").write_bytes(b"glTF")
    server.jobs["oldjob"] = {"status": "done", "finished_at": 1.0}
    server._cleanup_expired_jobs(now=server.JOB_TTL_SECONDS + 2.0)
    assert "oldjob" not in server.jobs
    assert not job_dir.exists()
