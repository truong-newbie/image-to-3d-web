---
phase: 2
title: "Phase 2: Crop & 3D Frame Editor UI"
status: completed
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Crop & 3D Frame Editor UI

## Overview

Tích hợp công cụ chỉnh vùng ảnh (Crop chữ nhật cho `TRELLIS` và kéo 4 góc cho `Tranh 3D`) vào giao diện `web_app/frontend/`, giữ bố cục tối giản và nối vào `Studio` & luồng gửi `POST /jobs`.

## Requirements

- [x] Người dùng chọn được ảnh để **Crop chữ nhật** (bỏ khung tủ kính/đế gỗ) trước khi bấm **Process**; hỗ trợ từng ảnh riêng khi ở chế độ nhiều góc hoặc hàng loạt.
- [x] Khi không đụng tới Crop, ảnh gốc được giữ nguyên như cũ (không giảm chất lượng hay thay đổi kích thước ngoài ý muốn).
- [x] Chế độ **Tranh 3D (Khung tranh — không cần Colab)** hiển thị công cụ kéo 4 điểm góc trực tiếp trên ảnh, bấm **Tạo khung tranh 3D** sẽ warp ảnh → dựng khung 3D → nạp vào `Studio` ngay lập tức (nút bấm không bị disable khi chưa nhập Link API Colab).
- [x] Sau khi tạo Tranh 3D, nút **Xuất GLB đã sửa** và **Xuất STL đã sửa (mm)** hoạt động đầy đủ; phần **Tải file gốc từ Colab** tự ẩn (tương tự `Mở GLB từ máy` / `Thử mẫu 3D`).

## Implementation Steps

1. Tạo `web_app/frontend/image_editor.js` (`ImageRegionEditor` class):
   - Render ảnh đang chọn lên Canvas 2D có tỷ lệ responsive, lưu state chỉnh sửa theo từng file (`cropRect` `{x, y, w, h}` chuẩn hóa `[0..1]`, và `quadCorners` `[{x,y} x 4]` chuẩn hóa `[0..1]`).
   - Hỗ trợ con trỏ chuột & cảm ứng (`PointerEvents`) để kéo 4 góc/cạnh của khung Crop chữ nhật hoặc kéo 4 đỉnh của đa giác 4 góc (có vẽ lưới nối 4 cạnh + nhãn `1..4` cho dễ căn).
   - Cung cấp nút/hàm `reset()`, `exportCroppedFile(file)` (xuất `File` PNG/JPEG cắt đúng vùng chọn), và `exportWarpedCanvas()` (gọi `warpRgbaData` từ `perspective_math.mjs` trả về `HTMLCanvasElement` đã nắn phẳng).
2. Cập nhật `web_app/frontend/index.html` & `web_app/frontend/styles.css`:
   - Thêm lựa chọn loại xử lý chính ở Cột 1: **Vật thể 3D (TRELLIS — cần Colab)** vs **Tranh / Ảnh phẳng 3D (Khung tranh — 0đ GPU)**.
   - Thêm khu vực Canvas chỉnh vùng ảnh (thu gọn hoặc mở trực tiếp khi click thumbnail / bấm nút **Cắt vùng / Chọn 4 góc**), kèm nút **Đặt lại khung** và **Hoàn tất vùng chọn** (hoặc áp dụng trực tiếp theo thay đổi).
   - Giữ thanh `modeBox` (Gộp nhiều góc / Hàng loạt) chỉ hiện khi ở chế độ `TRELLIS` với ≥ 2 ảnh.
3. Cập nhật `web_app/frontend/app.js`:
   - Khi bấm **Process** ở chế độ `TRELLIS`: biến đổi từng `File` qua `exportCroppedFile` nếu người dùng đã chỉnh Crop, rồi gửi lên `POST /jobs` như hiện tại.
   - Khi bấm **Tạo khung tranh 3D** ở chế độ `Tranh 3D`: gọi `exportWarpedCanvas()` → `buildFramedArtwork(canvas)` → `studio.loadObject(group, { name, initialHeightMm: 100 })` → hiện `resultSection`, ẩn `originalDownloads`, cập nhật `meshStats`.
   - Cập nhật `updateProcessBtnState()` để chế độ `Tranh 3D` luôn bấm được khi đã chọn ảnh mà không cần API URL Colab.

## Files to Create / Modify

- Create: `web_app/frontend/image_editor.js`
- Modify: `web_app/frontend/index.html`
- Modify: `web_app/frontend/styles.css`
- Modify: `web_app/frontend/app.js`

## Todo

- [x] Tạo `web_app/frontend/image_editor.js` hỗ trợ Crop chữ nhật và kéo 4 góc
- [x] Cập nhật `index.html` và `styles.css` cho mode `Tranh 3D` và khung chỉnh ảnh
- [x] Nối `image_editor.js` và `frame_builder.js` vào `app.js`
- [x] Kiểm tra syntax toàn bộ file JS/MJS bằng `node --check`

## Verification

```powershell
node --check web_app/frontend/image_editor.js web_app/frontend/app.js web_app/frontend/studio.js web_app/frontend/frame_builder.js web_app/frontend/perspective_math.mjs
```
