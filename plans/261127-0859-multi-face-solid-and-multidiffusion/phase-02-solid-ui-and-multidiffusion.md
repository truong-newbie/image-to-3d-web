---
phase: 2
title: "Phase 2: Multi-Face Solid UI & Multidiffusion Option"
status: completed
priority: P1
effort: "1.5h"
dependencies: [1]
---

# Phase 2: Multi-Face Solid UI & Multidiffusion Option

## Overview

Mở rộng giao diện quy trình 0đ GPU trong `index.html`, `styles.css`, `app.js` để hỗ trợ chọn kiểu khối (`Tranh đóng khung`, `Khối chóp 4 mặt`, `Khối hộp / Bia 3D`) và thanh chỉnh tỷ lệ đỉnh/chiều sâu; đồng thời bổ sung tùy chọn `multi_algo` (`multidiffusion` / `stochastic`) và mẹo chụp góc chéo cho nhánh TRELLIS multi-view.

## Requirements

- [x] Trong `#workflowBox` (`web_app/frontend/index.html`), tổ chức rõ 2 nhánh chính:
  - `trellis`: Vật thể 3D (TRELLIS — cần Colab) + dùng Crop bỏ vỏ tủ kính.
  - `frame`: Tạo khối 3D từ ảnh phẳng (0đ GPU — không cần Colab), kèm nhóm chọn mẫu khối `#solidPresetBox`:
    - `frame`: Tranh / Phù điêu đóng khung (dùng ảnh đang chọn)
    - `pyramid`: Khối chóp 4 mặt (ghép tối đa 4 ảnh quanh khối)
    - `box`: Khối hộp / Bia 3D (ghép tối đa 4 ảnh quanh khối)
- [x] Khi chọn `pyramid` hoặc `box`, hiển thị hộp điều chỉnh gọn (`#solidParamsBox`): thanh trượt `Độ thu đỉnh (%)` (với chóp: mặc định ~`4%`, khoảng `0%–75%`) và `Độ sâu khối (%)` (mặc định `100%` cho chóp vuông đáy, `35%` cho bia/hộp chữ nhật).
- [x] Nhắc người dùng khi dùng `pyramid`/`box` với nhiều ảnh: tối đa 4 ảnh đầu (`selectedFiles.slice(0, 4)`) tương ứng 4 mặt `Trước → Phải → Sau → Trái`, bấm từng thumbnail để kéo 4 góc từng mặt trước khi bấm nút tạo khối; nếu có > 4 ảnh sẽ thông báo rõ chỉ lấy 4 ảnh đầu.
- [x] Trong `app.js`, hàm xử lý offline mới (`createOfflineSolidModel`) nắn phối cảnh tuần tự các ảnh cần dùng (hiển thị tiến độ `Đang nắn mặt i/N...`), dựng group qua `buildFramedArtwork` hoặc `buildSolidFromCanvases`, rồi nạp vào `studio.loadObject(...)`.
- [x] Hướng A nhỏ: trong `#modeBox` (hiển thị khi `workflowType === "trellis"` và `selectedFiles.length >= 2`), thêm lựa chọn `#multiAlgoBox` (`processMode === "multi_view"`): `stochastic` (Nhanh — mặc định) vs `multidiffusion` (Đồng đều nhiều góc — chậm hơn) kèm dòng gợi ý chụp góc chéo ~45° thấy 2 mặt kề nhau; `submitAndPollJob()` gửi kèm `multi_algo` trong `FormData` lên `POST /jobs`.

## Implementation Steps

1. Cập nhật `web_app/frontend/index.html`:
   - Cập nhật nhãn radio `workflowType="frame"` thành "Khối 3D từ ảnh phẳng (0đ GPU)" và thêm `#solidPresetBox` + `#solidParamsBox` (chỉ hiện khi `workflowType === "frame"`).
   - Bổ sung `#multiAlgoBox` (radio `name="multiAlgo"` giá trị `stochastic` / `multidiffusion`) và câu nhắc chụp góc chéo 45° bên dưới `#modeBox`.
2. Cập nhật `web_app/frontend/styles.css`:
   - Thêm style gọn nhẹ cho `.solid-preset-row`, `.solid-params-box`, `.range-field`, `.capture-tip` ăn khớp bảng màu hiện có.
3. Cập nhật `web_app/frontend/app.js`:
   - Import `buildSolidFromCanvases` từ `./solid_builder.js`.
   - Thêm `getSolidPreset()`, `getMultiAlgo()`, `syncSolidControls()` đồng bộ hiển thị `#solidPresetBox`, `#solidParamsBox`, `#multiAlgoBox` và cập nhật chữ trên `#processBtn` / `#regionEditorHint`.
   - Thay `createFramedModel()` bằng `createOfflineSolidModel()` xử lý cả `frame` (1 ảnh đang chọn), `pyramid` và `box` (1–4 ảnh đầu).
   - Cập nhật `submitAndPollJob(api, filesToSend, label, resultIdx, multiAlgo)` để gắn `fd.append("multi_algo", multiAlgo)` khi chạy multi-view.

## Files to Create / Modify

- Modify: `web_app/frontend/index.html`
- Modify: `web_app/frontend/styles.css`
- Modify: `web_app/frontend/app.js`

## Todo

- [x] Thêm UI chọn mẫu khối 3D + thông số đỉnh/chiều sâu và UI chọn `multi_algo` trong `index.html`
- [x] Bổ sung CSS trong `styles.css`
- [x] Kết nối luồng `buildSolidFromCanvases` và `fd.append("multi_algo", ...)` trong `app.js`

## Success Criteria

- Chọn `Khối chóp 4 mặt` + 1..4 ảnh → nắn 4 góc từng ảnh → hiển thị đúng khối chóp 4 mặt 3D trên Studio, chỉnh mm và xuất được `.GLB` / `.STL`.
- Chọn `TRELLIS` + nhiều ảnh (`multi_view`) gửi đúng trường `multi_algo` (`stochastic` hoặc `multidiffusion`) trong payload `POST /jobs`.
- `node --check web_app/frontend/app.js` pass không lỗi.
