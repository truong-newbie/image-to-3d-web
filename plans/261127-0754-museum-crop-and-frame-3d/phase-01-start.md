---
phase: 1
title: "Phase 1: Perspective Math & Frame Builder"
status: completed
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 1: Perspective Math & Frame Builder

## Overview

Xây dựng lõi toán học nắn phẳng phối cảnh 4 góc (thuần JS có unit test), bộ dựng khung tranh 3D bằng Three.js, và mở rộng điểm nối `Studio.loadObject()` trong `web_app/frontend/studio.js`.

## Requirements

- [x] Tính chính xác ma trận homography 3×3 từ 4 điểm nguồn `(tl, tr, br, bl)` sang hình chữ nhật đích, kiểm tra đầu vào hợp lệ (không thẳng hàng/tự cắt, kích thước > 0).
- [x] Ước lượng tỷ lệ `width : height` hợp lý từ 4 góc ảnh để khung tranh không bị méo tỷ lệ khi nắn từ góc chụp nghiêng.
- [x] Dựng `THREE.Group` khung tranh gồm tấm nền, 4 thanh viền nổi (để xuất `.STL` vẫn có gờ khung), và mặt tranh dùng `THREE.CanvasTexture` với `THREE.SRGBColorSpace` (để xuất `.GLB` sắc nét).
- [x] Thêm `Studio.loadObject(object3D, options)` dùng lại `setContent()` mà không phá vỡ `loadFromUrl()`, `loadFromFile()`, `loadSample()`.

## Implementation Steps

1. Tạo `web_app/frontend/perspective_math.mjs`:
   - `estimateRectSize(corners, maxEdge = 1536)`: tính chiều rộng/cao đầu ra từ trung bình cặp cạnh đối diện của 4 điểm `(tl, tr, br, bl)` và kẹp cạnh dài tối đa `maxEdge`.
   - `computeHomography(srcCorners, dstWidth, dstHeight)`: giải hệ tuyến tính 8×8 (Gaussian elimination có partial pivoting) trả về ma trận 3×3 ánh xạ từ tọa độ ảnh đích `(u, v)` ngược về ảnh nguồn `(x, y)` (inverse mapping tránh lỗ hổng pixel).
   - `warpRgbaData(srcData, srcW, srcH, corners, dstW, dstH)`: nội suy song tuyến (bilinear) trên `Uint8ClampedArray` để chạy được cả trên Node test lẫn Canvas browser `ImageData`.
2. Tạo `tests/perspective_math.test.mjs` test:
   - Ánh xạ đơn vị (4 góc trùng ảnh chữ nhật) giữ nguyên kích thước & pixel.
   - Ánh xạ ảnh nghiêng/hình thang về đúng 4 góc đích và giữ nguyên màu vùng đặc.
   - Từ chối 4 điểm suy biến (thẳng hàng / diện tích ~0) với lỗi rõ ràng.
3. Cập nhật `web_app/frontend/studio.js`:
   - Thêm method `loadObject(object3D, options = {})` (tăng `this.loadToken`, gọi `this.setContent(object3D, options)`).
4. Tạo `web_app/frontend/frame_builder.js`:
   - `buildFramedArtwork(sourceCanvas, options)`: dựng `THREE.Group` chuẩn Y-up cao mặc định `0.1` m (100 mm), tỷ lệ ngang đúng theo `sourceCanvas.width / sourceCanvas.height`, gồm tấm lưng (`backplate`), 4 thanh viền khung nổi cao hơn mặt tranh (`frameMaterial`), và mặt phẳng ảnh phía trước (`artworkMaterial` với `map.colorSpace = THREE.SRGBColorSpace`).

## Files to Create / Modify

- Create: `web_app/frontend/perspective_math.mjs`
- Create: `web_app/frontend/frame_builder.js`
- Create: `tests/perspective_math.test.mjs`
- Modify: `web_app/frontend/studio.js`

## Todo

- [x] Viết `perspective_math.mjs` với `estimateRectSize`, `computeHomography`, `warpRgbaData`
- [x] Viết unit test `tests/perspective_math.test.mjs` và chạy `node --test`
- [x] Thêm `loadObject(object3D, options)` vào `web_app/frontend/studio.js`
- [x] Viết `web_app/frontend/frame_builder.js` tạo khung tranh 3D cho cả GLB và STL

## Verification

```powershell
node --test tests/studio_math.test.mjs tests/perspective_math.test.mjs
node --check web_app/frontend/perspective_math.mjs web_app/frontend/frame_builder.js web_app/frontend/studio.js
```
