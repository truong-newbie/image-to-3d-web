---
phase: 1
title: "Phase 1: Solid Geometry Math & Three.js Builder"
status: completed
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 1: Solid Geometry Math & Three.js Builder

## Overview

Xây dựng module toán hình học thuần (`solid_math.mjs`) và bộ dựng mesh Three.js (`solid_builder.js`) để ghép 1–4 ảnh đã nắn phẳng thành khối chóp 4 mặt (chóp nhọn hoặc chóp cụt) và khối hộp / bia đá 3D kín khối.

## Requirements

- [x] `web_app/frontend/solid_math.mjs` tính vị trí đỉnh, pháp tuyến hướng ra ngoài và tọa độ UV `[0, 1]` chuẩn cho từng mặt bên độc lập (không dùng chung UV giữa các mặt để mỗi mặt gắn texture riêng).
- [x] Hỗ trợ thống nhất qua một hàm tham số `buildFrustumFacesSpec({ baseWidth, baseDepth, topWidth, topDepth, height })`:
  - `topRatio = 0` → chóp nhọn 4 tam giác bên + mặt đáy kín (pháp tuyến hướng xuống `-Y`).
  - `0 < topRatio < 1` → chóp cụt 4 hình thang bên + mặt đỉnh kín (`+Y`) + mặt đáy kín (`-Y`).
  - `topRatio = 1` → khối hộp chữ nhật / bia 3D 4 mặt hông + đỉnh + đáy kín.
- [x] `web_app/frontend/solid_builder.js` nhận danh sách `sourceCanvases` (1–4 canvas) + tùy chọn `preset` (`"pyramid"` | `"box"`), `topRatio`, `depthRatio`, tạo `THREE.Group` với `CanvasTexture` (`SRGBColorSpace`) cho 4 mặt bên (`front`, `right`, `back`, `left`), tự xoay vòng `canvases[i % canvases.length]` khi có ít hơn 4 ảnh, và gắn cap đỉnh/đáy bằng màu tối trung tính/lấy mẫu từ viền ảnh để `.STL` xuất ra là khối kín.
- [x] Extension trace: Định nghĩa hợp đồng chung `buildOfflineModel(type, canvases, options)` hoặc thống nhất chữ ký đầu vào với `Studio.loadObject(group, { name, initialHeightMm })`, giúp sau này thêm khối chóp tam giác (3 mặt) hay lăng trụ chỉ cần thêm cấu hình số cạnh `sides` trong `solid_math.mjs` mà không đổi `app.js` hay `studio.js`.

## Implementation Steps

1. Tạo `web_app/frontend/solid_math.mjs`:
   - Chuẩn hóa kích thước cơ sở theo tỷ lệ ảnh chính (`primaryAspect = width / height`) và kiểm tra biên hợp lệ (`topRatio` trong `[0, 1]`, `depthRatio` trong `[0.1, 2.0]`).
   - Sinh 4 mặt bên theo thứ tự ngược chiều kim đồng hồ từ trên xuống: `front (+Z)`, `right (+X)`, `back (-Z)`, `left (-X)` sao cho vector pháp tuyến luôn hướng ra ngoài (`dot(normal, outwardDir) > 0`), UV ánh xạ đáy ảnh `(u=0..1, v=0)` khớp đáy khối và đỉnh ảnh `(v=1)` khớp đỉnh khối.
   - Sinh tam giác nắp đáy (và nắp đỉnh khi `topRatio > 0`) đúng chiều để `STLExporter` cho khối kín.
2. Tạo `web_app/frontend/solid_builder.js`:
   - Chuyển từng mặt từ `solid_math.mjs` sang `THREE.BufferGeometry`, áp dụng `THREE.CanvasTexture` (`colorSpace = THREE.SRGBColorSpace`) cho 4 mặt bên và `MeshStandardMaterial` màu đồng/đá trung tính cho nắp đỉnh/đáy.
   - Trả về `THREE.Group` sẵn sàng truyền thẳng vào `studio.loadObject(...)`.
3. Tạo `tests/solid_math.test.mjs` để kiểm thử đầy đủ hình chóp nhọn, chóp cụt, khối hộp, chiều pháp tuyến và phạm vi UV.

## Files to Create / Modify

- Create: `web_app/frontend/solid_math.mjs`
- Create: `web_app/frontend/solid_builder.js`
- Create: `tests/solid_math.test.mjs`

## Todo

- [x] Cài đặt `web_app/frontend/solid_math.mjs`
- [x] Cài đặt `web_app/frontend/solid_builder.js`
- [x] Viết unit test `tests/solid_math.test.mjs`

## Success Criteria

- `node --test tests/solid_math.test.mjs` pass 100% các test case cho chóp nhọn, chóp cụt, hộp và UV/pháp tuyến.
- `node --check web_app/frontend/solid_math.mjs web_app/frontend/solid_builder.js` không có lỗi.
