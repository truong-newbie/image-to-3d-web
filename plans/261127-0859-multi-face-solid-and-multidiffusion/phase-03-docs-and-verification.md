---
phase: 3
title: "Phase 3: Docs, Tests & Verification"
status: in_progress
priority: P2
effort: "1h"
dependencies: [1, 2]
---

# Phase 3: Docs, Tests & Verification

## Overview

Cập nhật tài liệu hướng dẫn trong `web_app/README.md`, chạy toàn bộ bộ test & kiểm tra cú pháp tự động và kiểm thử giao diện trực tiếp trên trình duyệt với bộ ảnh khối chóp thực tế.

## Requirements

- [x] `web_app/README.md` bổ sung hướng dẫn dùng chế độ `Khối chóp 4 mặt` / `Khối hộp 3D` (thứ tự 4 ảnh quanh hiện vật, kéo 4 góc từng mặt, xuất GLB/STL 0đ GPU) và hướng dẫn chụp góc chéo 45° + chọn `multidiffusion` khi dùng TRELLIS nhiều ảnh.
- [x] Toàn bộ unit test và kiểm tra cú pháp JS/Python đều pass.
- [ ] Kiểm thử giao diện thực tế tại `http://localhost:5500` với 4 ảnh khối chóp: tạo được khối chóp 4 mặt trên Studio 3D và tải xuống `.GLB` + `.STL` thành công.

## Implementation Steps

1. Cập nhật `web_app/README.md` bổ sung phần sử dụng cho Khối chóp / Hộp 3D và mẹo chụp + `multidiffusion`.
2. Chạy toàn bộ test tự động:
   - `node --test tests/studio_math.test.mjs tests/perspective_math.test.mjs tests/solid_math.test.mjs`
   - `node --check web_app/frontend/app.js web_app/frontend/studio.js web_app/frontend/image_editor.js web_app/frontend/frame_builder.js web_app/frontend/perspective_math.mjs web_app/frontend/solid_math.mjs web_app/frontend/solid_builder.js`
   - `python -m py_compile web_app/backend/server.py web_app/smoke_test.py`
3. Chạy `python -m http.server 5500 -d web_app/frontend` và kiểm tra UI trực tiếp trên trình duyệt (kèm test xuất `.GLB` & `.STL` cho khối chóp 4 mặt).

## Files to Create / Modify

- Modify: `web_app/README.md`

## Todo

- [x] Cập nhật `web_app/README.md`
- [x] Chạy toàn bộ automated checks (`node --test`, `node --check`, `py_compile`)
- [ ] Kiểm tra giao diện thực tế trên trình duyệt (`http://localhost:5500`)

## Success Criteria

- Tất cả unit test và syntax check đều pass (exit code 0).
- Kiểm thử trình duyệt xác nhận khối chóp 4 mặt hiển thị đúng 4 mặt có texture, khép kín đáy, và xuất `.GLB` / `.STL` không báo lỗi.
