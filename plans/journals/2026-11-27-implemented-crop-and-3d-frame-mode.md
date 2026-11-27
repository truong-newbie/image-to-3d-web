---
title: Implemented Crop and 3D Frame Mode
date: 2026-11-27
summary: Completed Phase 1-2 and automated checks for Crop and 4-corner 3D Frame mode on feat
---

# Implemented Crop and 3D Frame Mode

## Summary

Implemented museum artifact crop (for glass display cases) and 4-corner perspective-corrected 3D framed artwork mode (`Tranh 3D`) in `web_app/frontend/` on branch `feat`.

## Completed

- Phase 1: Implemented homography math (`web_app/frontend/perspective_math.mjs`), Three.js framed artwork builder (`web_app/frontend/frame_builder.js`), `Studio.loadObject()` (`web_app/frontend/studio.js`), and unit tests (`tests/perspective_math.test.mjs`).
- Phase 2: Implemented `ImageRegionEditor` (`web_app/frontend/image_editor.js`) supporting rectangular Crop mode and 4-corner Quad mode, plus UI/CSS/workflow integration in `index.html`, `styles.css`, and `app.js`.
- Phase 3 (partial): Documented both features in `web_app/README.md` and verified all unit tests (`8/8` passing), JS syntax checks (`node --check`), and Python syntax checks (`py_compile`).

## Remaining Manual Verification

- Live browser verification at `http://localhost:5500` with `baotang3.jpg` (offline `Tranh 3D` + GLB/STL export) and `baotang2.jpg` (Crop + Colab GPU L4 `POST /jobs`).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
