"""End-to-end check for the Colab API using repository sample images."""

import argparse
import json
import mimetypes
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SINGLE = ROOT / "assets/example_image/T.png"
DEFAULT_MULTI = [
    ROOT / "assets/example_multi_image/rabbit_1.png",
    ROOT / "assets/example_multi_image/rabbit_2.png",
]


def request(url, *, data=None, content_type=None):
    headers = {"Content-Type": content_type} if content_type else {}
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        return urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {url}: {detail}") from exc


def upload(api, images):
    boundary = uuid.uuid4().hex
    body = bytearray()
    for path in images:
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(
            f'Content-Disposition: form-data; name="files"; filename="{path.name}"\r\n'.encode()
        )
        body.extend(f"Content-Type: {mime}\r\n\r\n".encode())
        body.extend(path.read_bytes())
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode())
    with request(
        f"{api}/jobs",
        data=bytes(body),
        content_type=f"multipart/form-data; boundary={boundary}",
    ) as response:
        return json.load(response)["job_id"]


def wait_for_job(api, job_id, timeout):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with request(f"{api}/jobs/{job_id}") as response:
            job = json.load(response)
        if job["status"] == "done":
            return job
        if job["status"] == "error":
            raise RuntimeError(f"Job {job_id}: {job.get('error')}")
        time.sleep(2)
    raise TimeoutError(f"Job {job_id} vượt quá {timeout} giây")


def check_download(api, job_id, fmt, height_mm=None):
    query = "" if height_mm is None else "?" + urllib.parse.urlencode({"height_mm": height_mm})
    url = f"{api}/jobs/{job_id}/download/{fmt}{query}"
    with request(url) as response:
        magic = response.read(4)
    if not magic or (fmt == "glb" and magic != b"glTF") or (fmt == "ply" and magic[:3] != b"ply"):
        raise RuntimeError(f"File {fmt} của job {job_id} không hợp lệ")


def check_job(api, label, images, timeout):
    job_id = upload(api, images)
    print(f"{label}: job {job_id} đang xử lý...", flush=True)
    job = wait_for_job(api, job_id, timeout)
    for fmt in ("glb", "stl", "obj", "ply"):
        check_download(api, job_id, fmt)
    check_download(api, job_id, "stl", height_mm=100)
    print(f"{label}: OK ({job['vertices']} đỉnh, {job['faces']} mặt)", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    parser.add_argument("--full", action="store_true", help="Thử nhiều góc và hai job hàng loạt")
    parser.add_argument("--timeout", type=int, default=900)
    args = parser.parse_args()
    api = args.api.rstrip("/")

    with request(f"{api}/health") as response:
        health = json.load(response)
    if not health.get("model_loaded"):
        raise RuntimeError("Model chưa sẵn sàng")
    print(f"API sẵn sàng trên {health['gpu']}", flush=True)

    check_job(api, "Một ảnh", [DEFAULT_SINGLE], args.timeout)
    if args.full:
        check_job(api, "Hai góc thành một mô hình", DEFAULT_MULTI, args.timeout)
        for index, image in enumerate(DEFAULT_MULTI, 1):
            check_job(api, f"Hàng loạt: ảnh {index}", [image], args.timeout)
    print("Kiểm tra API hoàn tất.")


if __name__ == "__main__":
    main()
