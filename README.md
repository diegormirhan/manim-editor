# manim-editor

Working title for a Windows desktop editor that lets people create Manim Community Edition videos without writing Python line by line.

## Current status

Stages 1–2 implemented: validated JSON persistence, deterministic MathTex-to-Python compilation, and local Manim rendering. Thirteen unit tests pass. A real three-second equation video was rendered and inspected. Desktop UI and offline installer validation are pending.

## Render the example

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-render.txt
.\.venv\Scripts\python.exe -m renderer.manim_renderer.render_job examples/equation.json --tex-bin work/runtime/tex/TinyTeX/bin/windows
```

The TeX path above is the locally prepared TinyTeX environment, not a dependency included in source control. Install a TeX distribution with `latex`, `dvisvgm`, and the Manim template packages before reproducing this on another machine. Each invocation creates an isolated folder under `work/renders` with the project snapshot, generated source, log, and video. The command prints the successful video path.

This development runner uses a blocking Python subprocess with a 120-second timeout. Tauri process ownership, streaming progress, cancellation of the complete process tree, and clean-machine offline installation are future integration work.

## Run stage 1 (PowerShell, from this directory)

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s renderer/tests -v
.\.venv\Scripts\python.exe -m renderer.manim_renderer.cli examples/equation.json
```

The CLI prints generated Python. It does not execute Manim. The example contains a static equation visible for three seconds.

The current development contract supports one scene, MathTex content, position, appearance time, and scene duration. `contracts/project.schema.json` is authoritative for implemented fields; architecture examples describe later capabilities. Unsupported fields are rejected instead of silently ignored.

Python string escaping is tested; arbitrary LaTeX is not sandboxed by this compiler. The rendering integration must configure and assess TeX execution before accepting untrusted projects.

## Documentation

- [Product context](PRODUCT.md)
- [System architecture](ARCHITECTURE.md)
- [Domain model](docs/architecture/domain-model.md)
- [Rendering pipeline](docs/architecture/rendering-pipeline.md)
- [Interface architecture](docs/architecture/interface-architecture.md)
- [Architecture decisions](docs/architecture/decisions.md)
- [MVP boundaries](docs/architecture/mvp-scope.md)

## Local skills

Project-specific copies live in `.agents/skills`:

- `grill-me`
- `impeccable`
- `apple-design`
- `clean-code`
