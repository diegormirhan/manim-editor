# Project Guidance

## Product authority

Read `PRODUCT.md` and the relevant document under `docs/architecture` before changing architecture or behavior. Treat the versioned project JSON as the only editable source of truth. Generated Python is output, never input.

## Required skills

- Use `.agents/skills/grill-me` while challenging product scope or unresolved decisions.
- Use `.agents/skills/impeccable` for interface design, UX review, and frontend polish.
- Use `.agents/skills/apple-design` for interaction behavior, motion, hierarchy, and accessibility.
- Use `.agents/skills/clean-code` whenever code is written, changed, or reviewed.

Read a skill's complete `SKILL.md` before applying it.

## Engineering rules

- Use React, TypeScript, and Vite inside Tauri.
- Keep domain behavior independent from React, Tauri, and Manim.
- Add features through focused element or animation modules. Do not centralize unrelated behavior in broad managers or utility modules.
- Do not duplicate validation rules or property definitions across layers when they can be generated from the shared project schema.
- Default to test-driven development for behavior changes.
- Keep comments rare, short, and in English. Comments explain non-obvious reasons, not what the code already says.
- Do not add a plugin system, arbitrary Python execution, cloud rendering, or speculative extension points during the MVP.

