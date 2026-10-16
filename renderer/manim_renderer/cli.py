"""The editor's command line, for scripts and AI agents: check a project, look at a frame, render it, export its Python.

`guide` explains how a project is put together and `schema` prints its exact format. Each command takes a project
file, or `-` to read the project from standard input, and exits with 1 and the reason on stderr when it fails.
"""
import argparse
import json
import os
from pathlib import Path
import sys

from .desktop_bridge import TEX_BIN, publish, render_root
from .project import validate_project
from .render_job import RenderError, manim_environment, render_project
from .render_options import CONTRACT, resolve_options
from .scene_compiler import compile_project
from .timeline import layer_of, leaf_clips
from .video_editor_export import export_for_video_editors

ROOT = Path(__file__).resolve().parents[2]


def read_project(source: str) -> dict:
    # Windows tools such as PowerShell 5 start UTF-8 with a byte order mark.
    text = sys.stdin.buffer.read().decode("utf-8-sig") if source == "-" else Path(source).read_text(encoding="utf-8-sig")
    try:
        project = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(f"Not valid JSON: {error}") from error
    validate_project(project)
    return project


def tex_bin() -> Path | None:
    return ROOT / TEX_BIN if (ROOT / TEX_BIN).is_dir() else None


def kinds(schema: dict) -> str:
    """Each element kind and the fields it adds, read from the schema so the guide never drifts from it."""
    definitions = {kind: definition for kind, definition in schema["$defs"].items() if kind != "animation"}
    shared = set.intersection(*(set(definition["properties"]) for definition in definitions.values()))
    shared_list = ", ".join(sorted(shared - {"kind"}))
    lines = ["", "## Element kinds", "", f"Every element takes {shared_list}. Each kind adds:", ""]
    for kind, definition in definitions.items():
        own = [name for name in definition["properties"] if name not in shared]
        fields = ", ".join(f"`{name}`" + ("" if name in definition["required"] else " (optional)") for name in own)
        lines.append(f"- `{kind}`: {fields or 'nothing more'}")
    return "\n".join(lines) + "\n"


def check(arguments) -> str:
    scene = read_project(arguments.project)["scene"]
    layers = {layer_of(scene, identifier) for identifier in scene["elements"]}
    return (f"Valid: {len(scene['elements'])} elements on {len(layers)} layers, "
            f"{len(leaf_clips(scene))} animations, {scene['durationMs'] / 1000:g} s.")


def python(arguments) -> str:
    source = compile_project(read_project(arguments.project), fps=arguments.fps)
    if not arguments.output:
        return source.rstrip("\n")
    Path(arguments.output).write_text(source, encoding="utf-8")
    return arguments.output


def frame(arguments) -> str:
    project = read_project(arguments.project)
    os.environ.update(manim_environment(tex_bin()))
    # Manim loads only for the commands that draw.
    from .live_frame import snapshot
    image, boxes = snapshot(project, min(max(arguments.at, 0), project["scene"]["durationMs"] / 1000))
    Path(arguments.output).write_bytes(image)
    return json.dumps({"image": arguments.output, "boxes": boxes})


def progress(phase: str, fraction: float) -> None:
    print(f"{phase} {fraction:.0%}", file=sys.stderr, flush=True)


def render(arguments) -> str:
    project = read_project(arguments.project)
    options = resolve_options({"resolution": arguments.resolution, "fps": arguments.fps,
                               "format": Path(arguments.output).suffix.lstrip(".").lower() or "mp4",
                               "transparent": arguments.transparent})
    video = render_project(project, render_root(ROOT), tex_bin=tex_bin(), options=options, on_progress=progress)
    publish(video, Path(arguments.output))
    return arguments.output


def timeline(arguments) -> str:
    project = read_project(arguments.project)
    options = resolve_options({"resolution": arguments.resolution, "fps": arguments.fps, "format": "mov", "transparent": True})
    files = export_for_video_editors(project, Path(arguments.output), render_root(ROOT), options=options,
                                     tex_bin=tex_bin(), on_progress=progress)
    return "\n".join(map(str, files))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="manim-editor-cli", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("guide", help="how projects are built, for people and agents")
    commands.add_parser("schema", help="the project's JSON schema")
    command = commands.add_parser("check", help="validate a project and summarise it")
    command.add_argument("project")
    command = commands.add_parser("frame", help="Manim's frame at a moment, as PNG; prints where each element sits")
    command.add_argument("project")
    command.add_argument("--at", type=float, default=0, help="seconds from the start")
    command.add_argument("-o", "--output", default="frame.png")
    command = commands.add_parser("python", help="the scene as readable Manim Python")
    command.add_argument("project")
    command.add_argument("-o", "--output", help="a .py file; standard output without it")
    command.add_argument("--fps", type=int, choices=CONTRACT["frameRates"], default=CONTRACT["gridFps"])
    command = commands.add_parser("render", help="render the video with Manim; the extension picks the format")
    command.add_argument("project")
    command.add_argument("-o", "--output", default="scene.mp4", help="a .mp4, .webm, .gif or .mov file")
    command.add_argument("--resolution", choices=list(CONTRACT["resolutions"]), default="1080p")
    command.add_argument("--fps", type=int, choices=CONTRACT["frameRates"], default=30)
    command.add_argument("--transparent", action="store_true", help="WebM or MOV only")
    command = commands.add_parser("timeline", help="a folder for Premiere, DaVinci Resolve, Final Cut Pro or VEGAS: "
                                  "a transparent video per layer, timeline.xml and timeline.fcpxml")
    command.add_argument("project")
    command.add_argument("-o", "--output", default="timeline", help="the folder to write")
    command.add_argument("--resolution", choices=list(CONTRACT["resolutions"]), default="1080p")
    command.add_argument("--fps", type=int, choices=CONTRACT["frameRates"], default=30)
    arguments = parser.parse_args(argv)
    schema = ROOT / "contracts/project.schema.json"
    try:
        if arguments.command == "schema":
            print(schema.read_text(encoding="utf-8"), end="")
        elif arguments.command == "guide":
            print((ROOT / "docs/automation.md").read_text(encoding="utf-8") + kinds(json.loads(schema.read_text(encoding="utf-8"))), end="")
        else:
            print({"check": check, "python": python, "frame": frame, "render": render, "timeline": timeline}[arguments.command](arguments))
        return 0
    except (ValueError, OSError, RenderError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
