# System Architecture

## Goal

Build a Windows desktop editor that converts a visual, timeline-based project into deterministic and readable Manim Community Edition code, renders it locally, and displays the latest successful video.

## Architectural thesis

The application is an editor for a versioned domain model, not a graphical wrapper around Python strings. React edits project data. A compiler translates that data to Python. Manim owns the final pixels.

```text
User interaction
      |
      v
React editor ---- undo/redo ---- versioned project JSON
      |                                |
      | typed Tauri commands           | validation
      v                                v
Rust desktop shell -------------> render job
                                       |
                                       v
                              Python scene compiler
                                       |
                                       +--> readable scene.py
                                       |
                                       v
                                  Manim CLI
                                       |
                                       v
                             MP4 + logs + metadata
```

## Responsibilities

### React editor

- Catalogs available elements and animations.
- Edits properties through contextual inspectors.
- Owns timeline interaction, selection, undo, and redo.
- Displays project validation before starting a render.
- Shows render progress and the last successful preview.
- Never constructs Python source directly in UI components.

### Domain layer

- Defines projects, scenes, elements, groups, timeline events, and render settings.
- Applies commands such as adding an element, changing a property, or moving a timeline clip.
- Enforces invariants without depending on React, Tauri, filesystem APIs, or Manim.
- Produces deterministic state transitions suitable for unit tests and undo/redo.

### Shared contracts

- A versioned JSON Schema describes persisted project data.
- TypeScript types and validators should be generated from, or checked against, this schema.
- Python validates the same schema before compilation.
- Schema migrations are explicit and tested when a saved format changes.

### Tauri/Rust shell

- Provides narrow typed commands for opening, saving, rendering, cancelling, and revealing output.
- Owns filesystem paths and render-process lifecycle.
- Prevents the frontend from executing arbitrary shell commands.
- Streams structured render events to the frontend.
- Preserves the last successful artifact when a later render fails.
- Starts the bundled rendering runtime without relying on a system Python installation.

### Python scene compiler

- Converts validated project data into readable Manim Python.
- Keeps one focused compiler per supported element and animation kind.
- Escapes text and mathematical expressions safely.
- Does not execute arbitrary Python stored in a project.
- Emits structured diagnostics that point back to element and timeline identifiers.

### Manim adapter

- Invokes the supported Manim Community Edition version.
- Translates render settings to explicit CLI arguments.
- Normalizes process output into progress, warning, failure, cancellation, and success events.
- Keeps Manim-specific behavior outside the domain model.

## Suggested repository boundaries

```text
src/
  app/                    React composition and routing
  features/
    element-library/
    inspector/
    preview/
    timeline/
    render-status/
  domain/
    project/
    elements/
    animations/
    commands/
  infrastructure/
    persistence/
    tauri/
  generated/              Generated contract types only

src-tauri/
  src/
    commands/
    render_jobs/
    paths/

renderer/
  manim_renderer/
    cli.py
    project_loader.py
    scene_compiler.py
    elements/
    animations/
    diagnostics.py
  tests/

contracts/
  project.schema.json
```

These folders are an initial boundary map, not permission to create empty abstractions. A module should exist only when behavior requires it.

## Extending supported Manim features

An internally supported element has:

1. A stable `kind` in the project contract.
2. Validated properties and defaults.
3. Catalog metadata and a focused inspector in the frontend.
4. A Python compiler that maps the element to Manim.
5. Contract, domain, compiler, and integration tests appropriate to its behavior.

This is an internal registry, not a public plugin system. Adding a public plugin API before the internal contracts stabilize would create compatibility obligations too early.

## State and side effects

- Editing commands are pure domain operations whenever practical.
- Persistence and rendering are explicit effects at infrastructure boundaries.
- Render jobs use immutable project snapshots so editing can continue without changing an in-flight render.
- Each render receives a unique job identifier and isolated output directory.
- Only a successful render replaces the preview artifact.

## Error taxonomy

- **Validation error:** invalid project property or timeline relationship; shown near the relevant control.
- **Compilation error:** supported project data could not be translated; includes element or clip identity.
- **Dependency error:** Python, Manim, LaTeX, FFmpeg, or another runtime dependency is unavailable.
- **Render error:** Manim accepted the scene but failed while rendering.
- **Cancellation:** user intentionally stopped a render; not shown as a failure.
- **Application error:** unexpected Tauri, filesystem, or protocol failure.

## Security boundaries

- Function expressions are parsed through an allowlist; they are never passed to unrestricted `eval`.
- User text is escaped before source generation.
- Output paths are resolved under the selected project or application render directory.
- Tauri exposes only scoped commands and validated arguments.
- Arbitrary Python blocks and third-party plugins are outside the MVP.

## Testing strategy

- Domain tests cover project commands and timeline invariants without launching Tauri or Manim.
- Contract fixtures must validate identically in TypeScript and Python.
- Compiler snapshot tests compare small generated Python outputs after semantic assertions.
- Adapter tests use controlled subprocess fixtures for progress, failure, and cancellation.
- A small end-to-end suite renders representative scenes with the pinned Manim version.
- UI tests cover the critical add → configure → animate → render workflow.

## Deliberately open decisions

- Frontend state library.
- Exact bundling strategy for Python, Manim, FFmpeg, LaTeX, and native rendering dependencies; installation and rendering must work offline without preinstalled dependencies.
- Project autosave and recovery behavior.
- Exact accessibility acceptance criteria.
