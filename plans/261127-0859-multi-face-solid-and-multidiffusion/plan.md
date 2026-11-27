---
title: "Multi-Face Solid Builder & TRELLIS Multidiffusion Option"
description: "Bổ sung chế độ dựng Khối chóp 4 mặt / Khối hộp 3D trên trình duyệt (0đ GPU) cho hiện vật đa diện và mở tùy chọn multidiffusion + mẹo chụp góc chéo cho TRELLIS multi-view."
status: in-progress
priority: P1
effort: "4h"
branch: feat
tags: [frontend, threejs, pyramid-3d, multi-view, museum]
created: 2026-11-27
---

# Multi-Face Solid Builder & TRELLIS Multidiffusion Option

## Overview

Giải quyết triệt để tình trạng chụp 4 mặt thẳng của khối chóp / hộp / bia đá bảo tàng bị TRELLIS làm bẹp thành 1 mặt phẳng (Hướng B + Hướng A nhỏ):
- **Hướng B (Chính — 0đ GPU trên trình duyệt):** Tái sử dụng bộ kéo 4 góc + nắn phối cảnh đã có để dán tối đa 4 ảnh mặt bên lên **Khối chóp 4 mặt** (chóp nhọn / chóp cụt) hoặc **Khối hộp / Bia 3D** kín khối, xuất `.GLB` (giữ nét hoa văn) và `.STL` (kín đáy để in 3D).
- **Hướng A (Bổ sung nhẹ cho TRELLIS multi-view):** Mở lựa chọn `multi_algo` (`multidiffusion` / `stochastic`) từ UI gửi lên `POST /jobs` (backend đã hỗ trợ sẵn) và hiển thị mẹo chụp góc chéo ~45° thấy 2 mặt kề nhau.

## Goals

| # | Goal | Priority |
|---|---|---|
| 1 | Dựng khối chóp 4 mặt và khối hộp/bia 3D kín khối từ 1–4 ảnh đã nắn 4 góc, xuất được GLB & STL | P1 |
| 2 | Hỗ trợ chọn `multidiffusion` vs `stochastic` và mẹo chụp góc chéo trong luồng TRELLIS nhiều ảnh | P1 |
| 3 | Bao phủ test toán hình học khối (`solid_math.mjs`), kiểm tra cú pháp và cập nhật `web_app/README.md` | P2 |

## Scope & Constraints

- Giữ nguyên kiến trúc thuần `HTML/CSS/Vanilla JS` + `three@0.180.0` trong `web_app/frontend/`, không thêm `npm`/bundler.
- Không sửa `trellis/` và không cần sửa `web_app/backend/server.py` (do `server.py` đã nhận `multi_algo` qua `Form`).
- Không tích hợp DUSt3R / VGGT / COLMAP trên Colab để tránh quá tải VRAM L4 và lỗi khớp khi ảnh vuông góc 90° ít vùng chồng lấn.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Phase 1: Solid Geometry Math & Three.js Builder](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Multi-Face Solid UI & Multidiffusion Option](./phase-02-solid-ui-and-multidiffusion.md) | Pending |
| 3 | [Phase 3: Docs, Tests & Verification](./phase-03-docs-and-verification.md) | Pending |

## Success Criteria

- [ ] 4 ảnh chụp thẳng 4 mặt khối chóp sau khi nắn 4 góc dựng thành khối chóp 4 mặt kín đáy trong Studio 3D (không còn bị bẹp 1 mặt) và xuất được `.GLB`, `.STL`.
- [ ] Nếu chỉ có 1–3 ảnh, hệ thống vẫn tự lấp đầy các mặt còn lại thành khối 3D kín hợp lệ.
- [ ] Luồng TRELLIS ≥ 2 ảnh ở chế độ `multi_view` cho phép chọn `stochastic` hoặc `multidiffusion` và gửi đúng `multi_algo` tới `POST /jobs`.
- [ ] Toàn bộ `node --test`, `node --check`, `py_compile` pass không lỗi.

<!-- slug: multi-face-solid-and-multidiffusion -->
