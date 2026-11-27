---
phase: 3
title: "Phase 3: Docs & End-to-End Verification"
status: in_progress
priority: P2
effort: "0.5h"
dependencies: [2]
---

# Phase 3: Docs & End-to-End Verification

## Overview

Cập nhật tài liệu hướng dẫn sử dụng hai tính năng mới trong `web_app/README.md` và kiểm thử toàn bộ luồng offline + Colab thực tế.

## Requirements

- [x] `web_app/README.md` ghi rõ hướng dẫn dùng **Crop** cho hiện vật trong tủ kính và chế độ **Tranh 3D** cho tranh/ảnh phẳng.
- [x] Tất cả unit test và kiểm tra cú pháp đều pass không lỗi.
- [ ] Xác nhận kịch bản test thực tế trên trình duyệt (chế độ `Tranh 3D` offline với ảnh chụp chéo góc + xuất GLB/STL) và test Crop gửi lên Colab L4 (nếu đang bật Colab).

## Implementation Steps

1. Cập nhật `web_app/README.md`:
   - Bổ sung mục hướng dẫn chọn vùng **Crop** trước khi Process khi hiện vật nằm trong tủ kính.
   - Bổ sung mục hướng dẫn chế độ **Tranh 3D** (kéo 4 góc, không cần Colab, xuất GLB/STL).
2. Chạy toàn bộ test tự động tại workspace:
   - `node --test tests/studio_math.test.mjs tests/perspective_math.test.mjs`
   - `node --check` trên tất cả file `.js` và `.mjs` trong `web_app/frontend/`
   - `python -m py_compile web_app/backend/server.py web_app/smoke_test.py`
3. Chạy `python -m http.server 5500` trong `web_app/frontend` để kiểm tra UI trực tiếp trên trình duyệt:
   - Test `baotang3.jpg` qua chế độ **Tranh 3D** → nắn 4 góc → kiểm tra khung tranh trong `Studio` → xuất `.GLB` và `.STL`.
   - Test `baotang2.jpg` qua chế độ **Crop** → kiểm tra ảnh gửi lên Colab (nếu Colab đang chạy) cho ra cuốn sách bên trong thay vì vỏ tủ kính.

## Files to Create / Modify

- Modify: `web_app/README.md`

## Todo

- [x] Cập nhật `web_app/README.md`
- [x] Chạy toàn bộ automated checks (`node --test`, `node --check`, `py_compile`)
- [ ] Kiểm tra giao diện thực tế trên trình duyệt (`http://localhost:5500`)

## Verification

```powershell
node --test tests/studio_math.test.mjs tests/perspective_math.test.mjs
node --check web_app/frontend/app.js web_app/frontend/studio.js web_app/frontend/image_editor.js web_app/frontend/frame_builder.js web_app/frontend/perspective_math.mjs
python -m py_compile web_app/backend/server.py web_app/smoke_test.py
```
