import argparse
import os
import re
from pathlib import Path
import subprocess
import sys
import time
from typing import Callable
import uuid

from .project import load_project, save_project
from .render_options import CONTRACT, resolve_options, workload
from .scene_compiler import compile_project, segment_frames

PARTIAL_SUFFIXES = {".mp4", ".mov", ".webm"}
Progress = Callable[[str, float], None]


class RenderError(RuntimeError):
    pass


def render_timeout(project: dict, options: dict | None = None) -> float:
    """Manim needs several seconds of work per second of output, more for more pixels and frames."""
    scale = max(1.0, workload(options or resolve_options(None)))
    return 60 + project["scene"]["durationMs"] / 1000 * 20 * scale


def failure_cause(log: str) -> str | None:
    """The one line of a Manim log a person can act on, if there is one."""
    latex = re.search(r"LaTeX compilation error:\s*(.+?)(?:\s{2,}\S+\.py:\d+)?$", log, re.MULTILINE)
    if latex:
        return f"LaTeX error: {latex.group(1).strip()} Check the equation's LaTeX."
    errors = re.findall(r"^(\w+(?:Error|Exception): .+)$", log, re.MULTILINE)
    return errors[-1].strip() if errors else None


def rendered_fraction(segments: list[int], started: int) -> float:
    """Manim opens a segment's partial file when it starts, so all but the newest one are finished."""
    total = sum(segments)
    return sum(segments[:max(0, started - 1)]) / total if total else 0.0


def _run(command: list[str], *, cwd: Path, env: dict, log, timeout: float, tick: Callable[[], None]) -> int:
    process = subprocess.Popen(
        command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    deadline = time.monotonic() + timeout
    while True:
        try:
            return process.wait(timeout=0.25)
        except subprocess.TimeoutExpired:
            if time.monotonic() > deadline:
                process.kill()
                process.wait()
                raise
            tick()


def render_project(project: dict, output_root: Path, *, tex_bin: Path | None = None,
                   options: dict | None = None, on_progress: Progress | None = None) -> Path:
    """Renders with resolved options (see render_options.resolve_options); the default is the draft preview."""
    options = options or resolve_options(None)
    source = compile_project(project, fps=options["fps"])
    segments = segment_frames(project)
    environment = os.environ.copy()
    if tex_bin is not None:
        tex_bin = tex_bin.resolve(strict=True)
        environment["PATH"] = str(tex_bin) + os.pathsep + environment.get("PATH", "")
    environment["shell_escape"] = "f"
    environment["openin_any"] = "p"
    environment["openout_any"] = "p"
    # A wide console keeps each log record on one line, so its cause can be found.
    environment["COLUMNS"] = "400"
    job = output_root.resolve() / uuid.uuid4().hex
    job.mkdir(parents=True)
    save_project(project, job / "project.json")
    (job / "scene.py").write_text(source, encoding="utf-8")
    command = [
        sys.executable, "-m", "manim", "render", "--renderer", "cairo", "--disable_caching",
        "--resolution", f"{options['width']},{options['height']}", "--frame_rate", str(options["fps"]),
        "--format", options["format"], *(["--transparent"] if options["transparent"] else []),
        "--media_dir", str(job / "media"), "-o", "preview", str(job / "scene.py"), "EditorScene",
    ]
    reported = [None]

    def report() -> None:
        partials = [path for path in (job / "media/videos").rglob("partial_movie_files/*/*") if path.suffix in PARTIAL_SUFFIXES]
        state = ("rendering", rendered_fraction(segments, len(partials))) if partials else ("preparing", 0.0)
        if on_progress and state != reported[0]:
            reported[0] = state
            on_progress(*state)

    log_path = job / "render.log"
    try:
        with log_path.open("w", encoding="utf-8") as log:
            returncode = _run(command, cwd=job, env=environment, log=log, timeout=render_timeout(project, options), tick=report)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RenderError(f"Render could not complete; see {log_path}: {error}") from error
    if returncode != 0:
        cause = failure_cause(log_path.read_text(encoding="utf-8", errors="replace"))
        raise RenderError(f"{cause or f'Manim exited with {returncode}.'} Full log: {log_path}")
    videos = list((job / "media/videos").rglob(f"preview.{options['format']}"))
    if len(videos) != 1 or videos[0].stat().st_size == 0:
        raise RenderError(f"Manim produced no unique nonempty video; see {log_path}")
    return videos[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a trusted local editor project.")
    parser.add_argument("project", type=Path)
    parser.add_argument("--output-root", type=Path, default=Path("work/renders"))
    parser.add_argument("--tex-bin", type=Path)
    parser.add_argument("--resolution", choices=list(CONTRACT["resolutions"]), default="480p")
    parser.add_argument("--fps", type=int, choices=CONTRACT["frameRates"], default=CONTRACT["gridFps"])
    parser.add_argument("--format", choices=list(CONTRACT["formats"]), default="mp4")
    parser.add_argument("--transparent", action="store_true")
    arguments = parser.parse_args()
    try:
        options = resolve_options({"resolution": arguments.resolution, "fps": arguments.fps,
                                   "format": arguments.format, "transparent": arguments.transparent})
        artifact = render_project(
            load_project(arguments.project),
            arguments.output_root,
            tex_bin=arguments.tex_bin,
            options=options,
        )
    except (ValueError, OSError, RenderError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(artifact)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
