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

## Part 8 — Catalog breadth, a real expression language, and wider test bases

- Generated `contracts/project.schema.json` from `contracts/schema.mjs`, so shared element properties are declared once. A contract test regenerates the schema and compares it with the committed file.
- Added `rotationDegrees` and `opacity` to every element; both are emitted only when they change the object.
- Added `ellipse`, `regularPolygon`, `arc`, `numberLine`, and `areaUnderGraph` elements. The area references a graph that is linked to axes, and the compiler orders axes before graphs before areas.
- Added `grow`, `drawBorder`, `rotate`, `scaleTo`, `recolor`, `indicate`, and `wiggle` animations. Each clip now carries exactly the extra field its kind declares, replacing the chain of per-field rules in both validators.
- Replaced the seven-value expression enum with the restricted grammar ADR-012 describes, parsed in Python and TypeScript from the same fixtures in `contracts/expression-cases.json`. A curve undefined anywhere in its plotted range is rejected; a valid curve that leaves the camera warns without blocking.
- Grouped the element library into Text, Shapes, Coordinates, and Graphs, and disabled kinds whose source element does not exist yet.
- Replaced the single demonstration button with a picker over the three bundled examples.
- Scaled the render subprocess timeout with scene duration; the previous fixed 120 s would have failed on longer scenes.

Test bases: 27 frontend unit tests across six files (catalog, clip editing, project, timeline, expression, contract), 42 Python tests across six files, and 11 browser tests across three specs. The browser suite that had been failing since the milliseconds-to-seconds inspector change now passes.

Rendered proof: `examples/calculus-area.json` produced 195 frames at exactly 13.000 s and `examples/shape-motion.json` produced 225 frames at exactly 15.000 s, both 854x480 at 15 fps, inspected frame by frame.

Current limits are unchanged where they matter for release: offline packaging on a clean Windows machine, dependency redistribution licenses, and a signed installer are still open, and drag gestures have not been exercised in the desktop window.

## English interface and portfolio documentation — September 7, 2026

- Reviewed and preserved the existing catalog expansion, generated schema, shared expression grammar, and renderer changes.
- Translated all application labels, accessible names, helper text, native messages, validation diagnostics, and bundled scene captions to English. Timeline labels use English decimal notation; singular element counts are correct.
- Updated affected assertions and added regression coverage for English timing labels and theme switching.
- Rebuilt the README in the supplied PolyRAG reference style, with truthful capability tables, architecture, setup instructions, local verification, and explicit release limitations.
- Rendered the calculus and motion projects into MP4 and GIF pairs under `docs/media`. They contain 195 and 225 frames respectively, at 854 × 480 / 15 fps, lasting exactly 13 and 15 seconds.
- Opened and rendered both projects through the real Tauri bridge. Captured dark/light screenshots from WebView2, without mocked media or fabricated UI. Reproduction scripts and provenance are documented in `docs/media/README.md`.
- Clarified which architecture sections describe targets rather than shipping behavior. The renderer timeout now documented matches the scene-dependent implementation. Expression-domain validation is a finite sample check, not a continuity proof.

Validation: 28 frontend tests, 42 Python tests, 12 browser tests, and 3 Rust integration tests pass. Production frontend and Rust desktop builds pass. The Rust suite includes an actual Manim render. This does not establish clean-machine packaging or complete accessibility conformance.
