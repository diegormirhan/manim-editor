# Implementation progress

## Part 1 — JSON and scene compiler

- Implemented the first versioned JSON Schema and a three-second equation example.
- Added schema and timeline validation, including non-finite number rejection.
- Added validated loading and atomic replacement when saving projects.
- Added a focused MathTex compiler and a deterministic scene compiler.
- Added a CLI that prints generated Python without executing it.
- Created a project-local Python environment with jsonschema 4.26.0.
- Ran eight unit tests successfully and exercised the CLI with the example project.

The tests check persistence, preservation of an existing file after invalid input, unsupported fields and kinds, timeline bounds, deterministic output, input immutability, literal escaping, ordering, and non-finite numbers. Syntax is checked with Python's AST parser. These are compiler tests, not evidence of rendered pixels.

## Next part

Validate real Manim rendering and the required local runtime with this equation before connecting the React/Tauri editor. Node 24.18.1 and Python 3.14.6 were detected. Cargo was not available in the current shell PATH; the desktop build toolchain still needs checking. Python compatibility with Manim also remains to be checked before choosing the rendering runtime.

The offline installer remains a release requirement and has not been implemented or tested.

## Part 2 — Real local rendering

- Installed Manim Community 0.21.0 in the project environment on Python 3.14.6.
- Prepared TinyTeX v2026.09 under `work/runtime/tex`, with no permanent PATH change.
- The first real render failed because `dvisvgm` was absent; added it using this local distribution's package tool and repeated successfully.
- Added a development render runner with isolated job folders, immutable snapshots, logs, explicit Cairo rendering, and no cached animation reuse.
- Added five runner tests covering invalid input, failure preservation, missing artifacts, invocation boundaries, and timeout diagnostics. All 13 tests pass.
- Inspected the rendered equation: centered, white on black, fully visible.
- ffprobe verified H.264, 854×480, 15 fps, 45 frames, and exactly 3 seconds.

TinyTeX download: 246,897,183 bytes. Extracted distribution after adding dvisvgm: 560,484,503 bytes. These are TeX-only development sizes, not final installer sizes.

Sources: https://github.com/rstudio/tinytex-releases/releases/tag/v2026.09 and https://docs.manim.community/en/stable/installation/uv.html. The dvisvgm package was obtained through tlmgr's configured repository; tlmgr reported unavailable GPG verification. A verified, pinned distribution manifest and redistribution license inventory are still required for release.

Limits: the render ran on the development machine with system FFmpeg available. This does not prove clean-machine installation, offline independence, or complete TeX sandboxing. The development runner disables TeX shell escape and restricts TeX file access, but only trusted local sample projects have been exercised. A subprocess timeout is tested; process-tree cancellation remains for the Rust integration.

Next implementation milestone: React/Tauri shell with the equation inspector and preview connected to this verified rendering path.

## Part 3 — Element catalog and frame-aligned timeline

- Expanded the versioned contract with Text, Circle, Rectangle, Line, and Arrow elements.
- Added a focused catalog module with defaults, immutable add/remove operations, and camera-bound warnings.
- Added Create, Write, FadeIn, FadeOut, and MoveTo clips with explicit sequential lifecycle validation.
- Added animation controls to the inspector and a second visual lane for animation clips.
- Aligned waits and animation durations to 15 fps frames, avoiding cumulative millisecond rounding drift.
- Added 5 Python compiler tests and 4 frontend domain tests for catalog defaults, geometry warnings, lifecycle errors, and immutable deletion.
- Added `examples/catalog-animation.json` and completed a real Manim render with text, circle, arrow, movement, and fades.
- Build, 6 frontend tests, 18 Python tests, and the browser workflow pass.

Current limits: timeline clips are sequential, not draggable; new objects still appear without automatic animation; function graphs, axes, Transform, parallel groups, and offline packaging remain future milestones.

## Part 4 — Axes and restricted function graphs

- Added `axes` and `functionGraph` element kinds to the shared schema and generated TypeScript contract.
- Function expressions are an allowlist (`x^2`, `sin(x)`, `sqrt(x)`); arbitrary Python is rejected.
- Added Manim adapters and a renderable axes/graph example.
- Added coverage for graph compilation and injection rejection.

The next milestone is explicit parallel groups and Transform lifecycle. Graph properties are currently edited through project data; richer graph-specific inspector controls will follow with the next UI pass.

## Part 5 — Transform and explicit parallel groups

- Added `transform` clips with a separate destination element definition.
- Added `parallel` clips with child animations that share start and end boundaries.
- Compiler emits Manim `Transform` and `AnimationGroup` calls; validation rejects mismatched group timing and missing targets.
- Added regression coverage for Transform and parallel compilation.

The core MVP scene model is now broad enough for the official graph demonstration. Remaining production work is packaging the offline Windows runtime, richer graph/animation inspector affordances, drag/resize timeline editing, and a full end-to-end demo export.

## Part 6 — MVP completion pass

- Added graph-specific inspector controls for function choice and X range.
- Added the official parabola scene fixture with axes, graph, equation, annotation, Transform, MoveTo, and FadeOut.
- Added a reproducible offline runtime packaging script at `scripts/package-offline.ps1`.

The package script is a development payload, not yet a signed installer: clean-machine installation, dependency licenses, and installer UI still require manual release validation.

## Part 7 — Timeline interaction, theme, and demo workflow

- Added pointer and keyboard clip editing with 100 ms snapping, edge handles, boundary clamping, validation before commit, and one-step undo integration.
- Added seconds-based controls in the inspector and scene duration field while keeping milliseconds in the persisted contract.
- Added persistent dark/light theme switching with reduced-motion-safe existing interactions.
- Added inspector controls for graph axes, expressions, scale, text size, element lifetime, and advanced shape geometry.
- Added a button to load the official demonstration project directly in the editor.
- Reworked the renderer around explicit lifetimes, hidden Transform destinations, source replacement, axis-linked plots, NumberPlane, Dot, Square, and Triangle.
- The official demonstration renders successfully with the updated compiler.

The remaining release validation is operational: drag clips in the desktop window, inspect the full demonstration, package the offline payload on a clean Windows machine, measure it, and verify dependency redistribution licenses before signing an installer.
