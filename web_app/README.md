# TRELLIS Image-to-3D Web App

Ứng dụng web tối giản gồm:
- **Backend (`backend/server.py`)**: FastAPI chạy trên Google Colab (GPU L4), hỗ trợ **1 ảnh** và **nhiều ảnh** (`run_multi_image`), xuất 4 định dạng `.glb`, `.stl` (Z-up), `.obj`, `.ply`, kèm scale kích thước theo `height_mm`.
- **Frontend (`frontend/`)**: HTML/CSS/JS thuần + `<model-viewer>`, hỗ trợ 2 chế độ nhiều ảnh (**Gộp nhiều góc → 1 mô hình 3D** và **Chuyển hàng loạt → mỗi ảnh 1 file 3D**).

## 1. Chạy thử nhanh (Local + Colab L4)

### Backend trên Colab L4
1. Upload `colab_backend.ipynb` lên Google Colab, chọn **Runtime → Change runtime type → L4 GPU**.
2. Chạy lần lượt **Cell 1 → Cell 2 → Cell 3** (Colab sẽ clone trực tiếp từ repo `https://github.com/truong-newbie/image-to-3d-web.git` và chạy `web_app/backend/server.py`).
3. Copy link `https://xxxx.trycloudflare.com` ở cuối Cell 3.

### Frontend trên máy bạn
```sh
cd web_app/frontend
python -m http.server 5500
```
Mở `http://localhost:5500`, dán link API vào ô **Link Colab API** → **Kiểm tra** → chọn 1 hoặc nhiều ảnh → **Process**.

## 2. Đưa giao diện Web lên Internet (miễn phí)

Thư mục `web_app/frontend` là web tĩnh thuần, có thể đưa lên Internet miễn phí bằng **Cloudflare Pages** hoặc **Vercel**:

- **Cách nhanh nhất (Cloudflare Pages — kéo thả không cần Git):**
  1. Vào [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages → Create → Pages → Upload assets**.
  2. Đặt tên dự án rồi kéo thả toàn bộ thư mục `web_app/frontend` lên → bấm **Deploy site**.
  3. Bạn sẽ có link công khai `https://ten-cua-ban.pages.dev`.

- **Chia sẻ cho người khác không cần tự dán link API:**
  - Sau khi dán link API Colab vào web, bấm nút **Copy link chia sẻ** trên thanh công cụ để lấy link dạng `https://ten-cua-ban.pages.dev/?api=https://xxxx.trycloudflare.com`. Người mở link đó sẽ tự động kết nối luôn.
  - *(Lưu ý: mỗi lần bật lại Colab, `trycloudflare.com` sẽ cấp link mới; nếu muốn link API cố định vĩnh viễn và chạy 24/7 kể cả khi tắt Colab thì cần đưa `backend/server.py` lên cloud GPU như Modal / RunPod / VPS có GPU NVIDIA ≥ 24GB VRAM).*
