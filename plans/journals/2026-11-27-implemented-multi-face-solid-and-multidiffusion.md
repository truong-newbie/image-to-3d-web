---
title: Implemented Multi-Face Solid and Multidiffusion
date: 2026-11-27
summary: Implemented 0-GPU Pyramid/Box 3D solid builder with bilinear UV subdivision and TRELLIS multidiffusion UI on feat
---

# Implemented Multi-Face Solid and Multidiffusion

## Summary

Implemented browser-side 0-GPU 4-sided Pyramid & Box 3D solid builder (`solid_math.mjs`, `solid_builder.js`) plus TRELLIS `multidiffusion` option & 45-degree capture guidance on branch `feat`.

## Completed

- Phase 1: Implemented `buildFrustumSpec` with bilinear 16x16 grid subdivision (fixing affine UV diagonal shear on tapered pyramid/frustum faces) and watertight edge-matched cap fans, Three.js group assembly in `solid_builder.js`, and unit tests in `tests/solid_math.test.mjs`.
- Phase 2: Updated `index.html`, `styles.css`, and `app.js` with `frame`/`pyramid`/`box` presets, `topRatio`/`depthRatio` sliders, `requestId` race guard, and `multiAlgo` (`stochastic`/`multidiffusion`) FormData wiring.
- Phase 3 (partial): Documented both workflows in `web_app/README.md` and passed `12/12` Node unit tests, `node --check`, `py_compile`, and `code-reviewer` fixes.

## Remaining Manual Verification

- Browser test at `http://localhost:5500` with 4 museum pyramid photos (`Khá»‘i chÃ³p 4 máº·t` + `.GLB` & `.STL` export) and optional Colab `multidiffusion` check.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
