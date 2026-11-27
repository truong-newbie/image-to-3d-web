---
title: Planned Multi-Face Solid and Multidiffusion
date: 2026-11-27
summary: Scaffolded and validated 3-phase plan 261127-0859-multi-face-solid-and-multidiffusion on feat
---

# Planned Multi-Face Solid and Multidiffusion

## Summary

Created implementation plan `261127-0859-multi-face-solid-and-multidiffusion` on branch `feat` combining HÆ°á»›ng B (browser-side 0-GPU Multi-Face Pyramid/Box 3D solid builder) and HÆ°á»›ng A (`multidiffusion` selection + 45-degree multi-view capture tip for TRELLIS).

## Phases

- Phase 1: `solid_math.mjs`, `solid_builder.js`, and `tests/solid_math.test.mjs`.
- Phase 2: Offline solid preset controls (`frame` | `pyramid` | `box`) + sliders and TRELLIS `multi_algo` UI + FormData wiring in `index.html`, `styles.css`, `app.js`.
- Phase 3: `web_app/README.md` update, automated tests (`node --test`, `node --check`, `py_compile`), and live browser verification.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
