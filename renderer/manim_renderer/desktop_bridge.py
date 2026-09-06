import json
from pathlib import Path
import sys

from .project import load_project, save_project, validate_project
from .render_job import render_project
from .scene_compiler import compile_project


def dispatch(request: dict, root: Path) -> dict:
    operation = request["operation"]
    if operation == "load":
        return {"project": load_project(Path(request["path"]))}
    project = request["project"]
    validate_project(project)
    if operation == "save":
        save_project(project, Path(request["path"]))
        return {"path": request["path"]}
    if operation == "export":
        Path(request["path"]).write_text(compile_project(project), encoding="utf-8")
        return {"path": request["path"]}
    if operation == "render":
        artifact = render_project(
            project, root / "work/renders",
            tex_bin=root / "work/runtime/tex/TinyTeX/bin/windows",
        )
        return {"path": str(artifact)}
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

