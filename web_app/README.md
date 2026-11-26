# TRELLIS Image-to-3D Web App

Ứng dụng web tối giản gồm:
- **Backend (`backend/server.py`)**: FastAPI chạy trên Google Colab (GPU L4), hỗ trợ **1 ảnh** và **nhiều ảnh** (`run_multi_image`), xuất 4 định dạng `.glb`, `.stl` (Z-up), `.obj`, `.ply`, kèm scale kích thước theo `height_mm`.
- **Frontend (`frontend/`)**: HTML/CSS/JS thuần + Three.js Studio, hỗ trợ 2 chế độ nhiều ảnh (**Gộp nhiều góc → 1 mô hình 3D** và **Chuyển hàng loạt → mỗi ảnh 1 file 3D**), chỉnh kích thước, di chuyển, xoay, co giãn, hoàn tác/làm lại và xuất GLB/STL đã sửa.

## 1. Chạy thử nhanh (Local + Colab L4)

### Backend trên Colab L4
1. Mở [notebook Colab mới](https://colab.research.google.com/drive/1ib6fQUhcnrAMB4Sw5LTjteyt1aAGy4X0) hoặc [bản mới nhất từ GitHub](https://colab.research.google.com/github/truong-newbie/image-to-3d-web/blob/main/web_app/colab_backend.ipynb), chọn **Runtime → Change runtime type → L4 GPU**. File `colab_backend.ipynb` trong repo là bản nguồn; notebook Drive là bản sao hiện tại.
2. Chạy **Cell 1 → Cell 2 → Cell 3**. Colab clone `truong-newbie/image-to-3d-web`, in mã commit đang chạy và khởi động `web_app/backend/server.py`. Nếu `git pull` lỗi, Cell 3 dừng và báo lỗi.
3. Copy link `https://xxxx.trycloudflare.com` ở cuối Cell 3. Cell này kết thúc sau khi tunnel sẵn sàng; backend tiếp tục chạy trong phiên Colab.
4. Chạy **Cell 4** để thử một ảnh, nhiều góc, chế độ hàng loạt và tải GLB/STL/OBJ/PLY. Bước này chạy model thật nên có thể mất vài phút.

### Frontend trên máy bạn
```sh
cd web_app/frontend
python -m http.server 5500
```
Mở `http://localhost:5500`, dán link `https://xxxx.trycloudflare.com` **do Cell 3 in ra** vào ô **Link API từ Cell 3** → **Kiểm tra** → chọn 1 hoặc nhiều ảnh → **Process**. Link trang notebook `colab.research.google.com/drive/...` không phải link API. Colab phải đang chạy để tạo mô hình mới; nút **Thử mẫu 3D** và **Mở GLB từ máy** dùng được mà không cần Colab.

### Chỉnh sửa trong Studio

- Chọn **Di chuyển / Xoay / Co giãn**, rồi kéo các trục màu trên mô hình. Dùng **Hoàn tác / Làm lại** hoặc Ctrl+Z / Ctrl+Y.
- Nhập rộng, cao, sâu theo mm; bật **Giữ tỷ lệ** để đổi đều ba chiều. Mô hình TRELLIS được đặt cao 100 mm lúc mở vì model không biết kích thước thật của vật thể trong ảnh.
- **Xuất GLB đã sửa** giữ vật liệu và texture, dùng đơn vị mét theo glTF. **Xuất STL đã sửa** dùng mm và trục Z hướng lên để đưa vào phần mềm in 3D. Các nút ở phần **Tải file gốc từ Colab** lấy bản chưa chỉnh.
- Việc chỉnh sửa diễn ra trong trình duyệt. Hãy xuất file trước khi đóng trang hoặc tạo một mô hình mới.

API nhận tối đa 12 ảnh mỗi mô hình, 10 MB và 20 megapixel mỗi ảnh; tối đa 8 job chờ. Kết quả của job đã hoàn thành được giữ 1 giờ rồi xóa tự động. Nếu muốn kiểm tra riêng API sau khi Cell 3 chạy, dùng `/content/miniconda3/envs/trellis/bin/python /content/TRELLIS/web_app/smoke_test.py --full` ngay trong máy Colab.

## 2. Đưa giao diện Web lên Internet (miễn phí)

Thư mục `web_app/frontend` là web tĩnh thuần, có thể đưa lên Internet miễn phí bằng **Cloudflare Pages** hoặc **Vercel**:

- **Cách nhanh nhất (Cloudflare Pages — kéo thả không cần Git):**
  1. Vào [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages → Create → Pages → Upload assets**.
  2. Đặt tên dự án rồi kéo thả toàn bộ thư mục `web_app/frontend` lên → bấm **Deploy site**.
  3. Bạn sẽ có link công khai `https://ten-cua-ban.pages.dev`.

- **Chia sẻ cho người khác không cần tự dán link API:**
  - Sau khi dán link API Colab vào web, bấm nút **Copy link chia sẻ** trên thanh công cụ để lấy link dạng `https://ten-cua-ban.pages.dev/?api=https://xxxx.trycloudflare.com`. Người mở link đó sẽ tự động kết nối luôn.
  - *(Lưu ý: mỗi lần bật lại Colab, `trycloudflare.com` sẽ cấp link mới. Colab và Quick Tunnel phù hợp để thử nghiệm; nếu cần dịch vụ luôn sẵn sàng, cần chuyển backend sang máy chủ GPU và dùng địa chỉ API ổn định.)*
