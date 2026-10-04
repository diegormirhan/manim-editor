import json
import os
from pathlib import Path
import shutil
import sys

from .project import load_project, save_project, validate_project
from .render_job import render_project
from .render_options import resolve_options
from .scene_compiler import compile_project


def render_root(root: Path) -> Path:
    """Where render jobs may write.

    An installed build sits under Program Files, which is read-only for a normal
    user, so renders go to the per-user application data directory instead. A
    source checkout keeps them beside the project, where the examples expect them.
    """
    if (root / ".git").is_dir():
        return root / "work/renders"
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "manim-editor" / "renders"
    return Path.home() / ".manim-editor" / "renders"


def emit_progress(phase: str, fraction: float) -> None:
    """Progress travels as newline-delimited JSON on stderr; the result stays alone on stdout."""
    print(json.dumps({"event": "progress", "phase": phase, "fraction": round(fraction, 4)}), file=sys.stderr, flush=True)


def publish(artifact: Path, destination: Path) -> None:
    """Copies beside the destination first, so a failed copy never leaves half a video under its name."""
    partial = destination.with_name(destination.name + ".partial")
    try:
        shutil.copyfile(artifact, partial)
        partial.replace(destination)
    finally:
        partial.unlink(missing_ok=True)


def dispatch(request: dict, root: Path, emit=emit_progress) -> dict:
    operation = request["operation"]
    if operation == "load":
        return {"project": load_project(Path(request["path"]))}
    project = request["project"]
    validate_project(project)
    if operation == "save":
        save_project(project, Path(request["path"]))
        return {"path": request["path"]}
    if operation == "export":
        options = resolve_options(request.get("options"))
        Path(request["path"]).write_text(compile_project(project, fps=options["fps"]), encoding="utf-8")
        return {"path": request["path"]}
    if operation in ("render", "exportVideo"):
        options = resolve_options(request.get("options"), preview=operation == "render")
        artifact = render_project(
            project, render_root(root), options=options, on_progress=emit,
            tex_bin=root / "work/runtime/tex/TinyTeX/bin/windows",
        )
        if operation == "render":
            return {"path": str(artifact)}
        publish(artifact, Path(request["path"]))
        return {"path": request["path"]}
    raise ValueError("Unsupported operation")


def main() -> int:
    try:
        request = json.load(sys.stdin)
        result = dispatch(request, Path(__file__).resolve().parents[2])
        print(json.dumps(result, ensure_ascii=True))
        return 0
    except (ValueError, OSError, RuntimeError, KeyError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
