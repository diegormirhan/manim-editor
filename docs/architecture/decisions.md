# Architecture Decisions

This file records decisions already confirmed during product discovery. Each decision can later become an individual ADR if its context, alternatives, or consequences grow.

## ADR-001: Project JSON is the source of truth

**Status:** Accepted

The application saves a versioned JSON project document. React edits this model, and the renderer consumes immutable snapshots of it.

**Consequences:**

- Undo, validation, migrations, and deterministic tests operate on structured data.
- Generated code cannot become a second editable representation.
- Project schema compatibility becomes an explicit product responsibility.

## ADR-002: Python export is one-way

**Status:** Accepted

The application generates readable Python for rendering and export but never imports that generated file back into a project.

**Consequences:**

- Users may customize an exported file outside the application, but those edits are detached from the visual project.
- The compiler does not need to reverse arbitrary Python into editor state.
- Export and internal rendering must use the same compiler implementation.

## ADR-003: Existing Manim projects are not imported

**Status:** Accepted for the MVP

Only projects created by the application can be opened and edited.

**Consequences:**

- Python control flow, inheritance, user functions, plugins, and arbitrary expressions do not need reverse mapping.
- Initial adoption targets new visual projects rather than migration of existing codebases.

## ADR-004: Manim owns preview fidelity

**Status:** Accepted

The preview is the most recent Manim render. The frontend does not implement a second real-time graphics engine.

**Consequences:**

- Preview pixels match exported video behavior.
- Users explicitly render after editing.
- The interface must communicate stale preview state clearly.
- Existing Manim rendering latency is accepted rather than hidden.

## ADR-005: Elements have no implicit entrance animation

**Status:** Accepted

Adding an element makes it appear at the current playhead without creating `Write`, `Create`, or another entrance animation.

**Consequences:**

- The user retains control of animation intent.
- The timeline needs a visible representation of instantaneous appearance.
- Attaching an entrance animation later requires an explicit rule for replacing or moving the appearance event.

## ADR-006: Extensibility uses internal feature registries

**Status:** Accepted in principle

Supported elements and animations are added through cohesive internal definitions, contract entries, inspectors, compiler adapters, and tests. The MVP does not expose a public plugin API.

**Consequences:**

- Adding a supported feature should not require unrelated conditional changes across the application.
- Frontend and Python responsibilities remain explicit; cross-language work is not hidden behind a magical abstraction.
- The registry must emerge from real MVP cases and avoid speculative metadata.

## ADR-007: Frontend stack

**Status:** Accepted

Use React, TypeScript, and Vite inside the Tauri desktop shell.

**Consequences:**

- Domain and contract types can be strongly represented in the editor.
- React components remain outside the core domain model.
- A frontend state library remains an implementation decision rather than part of this ADR.

## ADR-008: Local rendering boundary

**Status:** Accepted

Tauri/Rust owns filesystem and subprocess lifecycle. Python owns project-to-Manim compilation. Manim Community Edition renders locally. Installation and rendering must work offline without preinstalled dependencies or later downloads. A large installer is acceptable.

**Consequences:**

- The frontend does not receive general shell access.
- Render progress and failures need a structured protocol.
- Windows packaging of Python, Manim, LaTeX, FFmpeg, and native dependencies is an early vertical spike and a release gate.
- The exact bundling mechanism remains undecided until that spike provides evidence.
- The spike records installer size and confirms that every bundled dependency can be redistributed under its license.

## ADR-009: Initial animation catalog

**Status:** Accepted

The MVP supports `Create`, `Write`, `FadeIn`, `FadeOut`, `Transform`, and `MoveTo`.

**Consequences:**

- The initial catalog covers creation, appearance, disappearance, transformation, and movement.
- Each animation requires a focused contract, inspector, compiler adapter, and behavioral tests.
- The catalog remains deliberately small while the element and animation extension boundaries stabilize.

## ADR-010: Transform owns a hidden destination

**Status:** Accepted

For the MVP, a `Transform` clip creates and owns its destination definition. The destination is hidden before the clip and becomes the active editable element when the transformation finishes.

**Consequences:**

- The user does not need to manage two independently visible objects for a basic transformation.
- Element lifecycle and identity changes are explicit domain behavior.
- Transforming between two elements already visible on the timeline is deferred.

## ADR-010: Timeline concurrency is explicit

**Status:** Accepted

The MVP supports sequential animation clips and explicit parallel groups. It does not support arbitrary partial overlaps.

**Consequences:**

- Parallel intent is represented in project data instead of inferred from visual clip intersection.
- The compiler maps each parallel group to one deliberate Manim concurrency construct.
- Timeline placement can reject or explain unsupported partial overlaps before rendering.
- More flexible scheduling can be introduced later through a schema migration if real use cases justify it.

## ADR-011: Official MVP demonstration

**Status:** Accepted

The primary end-to-end scenario is a 30–45 second animation that creates axes and `f(x) = x^2`, writes its equation, fades in an annotation, transforms the graph to `f(x) = (x - 2)^2 + 1`, moves the annotation, and fades it out. It includes an explicit parallel group and exports MP4 plus readable Python.

**Consequences:**

- End-to-end tests have one stable, meaningful scenario instead of synthetic isolated controls only.
- The scenario exercises mathematical content, property editing, timeline timing, transformation lifecycle, parallel execution, rendering, and export.
- The scenario is a portfolio proof, not a claim that the MVP supports all Manim use cases.

## ADR-012: Restricted mathematical expression language

**Status:** Accepted

Function-graph inputs use a documented mathematical notation such as `x^2`, `sin(x)`, and `sqrt(x)`. Python expressions, lambdas, imports, attribute access, and arbitrary calls are rejected.

**Consequences:**

- Users get a domain-appropriate input instead of needing Python syntax.
- Expressions can be validated before rendering with precise field diagnostics.
- The parser and approved function list become part of the project contract.
- Advanced Python-defined functions are outside the MVP and may require a separate, explicitly sandboxed feature later.
