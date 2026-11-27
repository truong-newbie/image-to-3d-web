---
title: Museum Crop and 3D Frame Plan
date: 2026-11-27
summary: Planned client-side Crop and 4-corner 3D Frame mode on feat
---

# Museum Crop and 3D Frame Plan

## What happened
- Synced `main` and `feat` branches to `origin/main` (`0a5bef7`).
- Investigated museum artifact issues in `trellis/pipelines/trellis_image_to_3d.py` (`preprocess_image()` uses `rembg` `u2net` unless RGBA alpha is provided) and `web_app/frontend/` (`studio.js`, `app.js`, `index.html`).
- Completed `/ak-brainstorm` + `/ak-advise` alignment with the user and created validated 3-phase plan `plans/261127-0754-museum-crop-and-frame-3d/`.

## Decision
- Keep `server.py` and `colab_backend.ipynb` untouched (zero extra Colab VRAM cost).
- Implement client-side rectangular Crop (for glass display cases before `POST /jobs`) and a zero-GPU 4-corner perspective-corrected 3D Frame mode (`perspective_math.mjs` + `frame_builder.js` + `Studio.loadObject()`).

## Next steps
- Execute the plan on branch `feat` using `/ak-cook D:\Thu_muc_C\TRELLIS\plans\261127-0754-museum-crop-and-frame-3d\plan.md`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
