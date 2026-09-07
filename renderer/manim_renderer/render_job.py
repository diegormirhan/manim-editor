import argparse
import os
from pathlib import Path
import subprocess
import sys
import uuid

from .project import load_project, save_project
from .scene_compiler import compile_project


class RenderError(RuntimeError):
    pass


def render_timeout(project: dict) -> float:
    """Manim needs several seconds of work per second of output, so scale with the scene."""
    return 60 + project["scene"]["durationMs"] / 1000 * 20


def render_project(project: dict, output_root: Path, *, tex_bin: Path | None = None) -> Path:
    source = compile_project(project)
    environment = os.environ.copy()
    if tex_bin is not None:
        tex_bin = tex_bin.resolve(strict=True)
        environment["PATH"] = str(tex_bin) + os.pathsep + environment.get("PATH", "")
    environment["shell_escape"] = "f"
    environment["openin_any"] = "p"
    environment["openout_any"] = "p"
    job = output_root.resolve() / uuid.uuid4().hex
    job.mkdir(parents=True)
    save_project(project, job / "project.json")
    (job / "scene.py").write_text(source, encoding="utf-8")
    command = [
        sys.executable, "-m", "manim", "render",
        "--renderer", "cairo", "-ql", "--disable_caching",
        "--media_dir", str(job / "media"),
        "-o", "preview", str(job / "scene.py"), "EditorScene",
    ]
    log_path = job / "render.log"
    try:
        with log_path.open("w", encoding="utf-8") as log:
            result = subprocess.run(
                command, cwd=job, env=environment, stdout=log,
                stderr=subprocess.STDOUT, timeout=render_timeout(project),
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RenderError(f"Render could not complete; see {log_path}: {error}") from error
    if result.returncode != 0:
        raise RenderError(f"Manim exited with {result.returncode}; see {log_path}")
    videos = list((job / "media/videos").rglob("preview.mp4"))
    if len(videos) != 1 or videos[0].stat().st_size == 0:
        raise RenderError(f"Manim produced no unique nonempty video; see {log_path}")
    return videos[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a trusted local editor project.")
    parser.add_argument("project", type=Path)
    parser.add_argument("--output-root", type=Path, default=Path("work/renders"))
    parser.add_argument("--tex-bin", type=Path)
    arguments = parser.parse_args()
    try:
        artifact = render_project(
            load_project(arguments.project),
            arguments.output_root,
            tex_bin=arguments.tex_bin,
        )
    except (ValueError, OSError, RenderError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(artifact)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

