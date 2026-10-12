"""Manim's own frame at any moment of a scene, from a process that keeps Manim loaded.

The desktop app starts this module once and writes one JSON request per line to its stdin,
{"project": ..., "timeMs": ...}. Each answer is one JSON line on stdout: {"frame": <base64 PNG>,
"boxes": {<element id>: [left, bottom, right, top]}} for the elements on screen, in scene units,
or {"error": <message>}. Loading Manim takes seconds; after that a frame takes a few hundred
milliseconds, because nothing is encoded: the scene jumps over what came before and stops the
running animation at the requested moment.
"""
import base64
import io
import json
import logging
import os
import sys
from pathlib import Path

from manim import DL, UR, tempconfig
from PIL import Image

from .desktop_bridge import TEX_BIN, render_root
from .project import validate_project
from .render_job import failure_cause, manim_environment
from .render_options import resolve_options
from .scene_compiler import compile_project, element_variables

ROOT = Path(__file__).resolve().parents[2]


class _Reached(Exception):
    """The scene has played up to the requested moment."""


def snapshot(project: dict, seconds: float) -> tuple[bytes, dict]:
    """Builds the scene, plays everything before `seconds` to its end and stops the running animation there.

    Returns the frame as a PNG and the bounding box of each element on screen.
    """
    options = resolve_options(None, preview=True)
    namespace: dict = {}
    with tempconfig({"media_dir": str(render_root(ROOT) / "live"), "pixel_width": options["width"],
                     "pixel_height": options["height"], "disable_caching": True, "write_to_movie": False,
                     "progress_bar": "none", "verbosity": "ERROR"}):
        exec(compile(compile_project(project), "scene.py", "exec"), namespace)

        class AtMoment(namespace["EditorScene"]):
            clock = 0.0
            elements: dict = {}

            def play(self, *animations, **kwargs):
                # The elements are construct()'s locals, all made before its first play or wait.
                self.elements = dict(sys._getframe(1).f_locals)
                self.compile_animation_data(*animations, **kwargs)
                self.begin_animations()
                if seconds - self.clock < self.duration:
                    self.update_to_time(max(seconds - self.clock, 0))
                    raise _Reached
                self.update_to_time(self.duration)
                for animation in self.animations:
                    animation.finish()
                    animation.clean_up_from_scene(self)
                self.clock += self.duration

            def wait(self, duration=1.0, **kwargs):
                self.elements = dict(sys._getframe(1).f_locals)
                if seconds - self.clock < duration:
                    raise _Reached
                self.clock += duration

        scene = AtMoment()
        try:
            scene.setup()
            scene.construct()
        except _Reached:
            pass
        scene.renderer.update_frame(scene)
        png = io.BytesIO()
        Image.fromarray(scene.renderer.get_frame()).save(png, format="PNG")
        drawn = {id(mobject) for mobject in scene.get_mobject_family_members()}
        mobjects = {identifier: scene.elements[name] for identifier, name in element_variables(project["scene"]).items()}
        boxes = {identifier: [float(value) for value in (*mobject.get_corner(DL)[:2], *mobject.get_corner(UR)[:2])]
                 for identifier, mobject in mobjects.items() if id(mobject) in drawn}
        return png.getvalue(), boxes


def answer(request: dict) -> dict:
    """One request, one reply. A failure is a reply too, so the worker outlives a bad equation."""
    log = io.StringIO()
    handler = logging.StreamHandler(log)
    logging.getLogger("manim").addHandler(handler)
    try:
        project = request["project"]
        validate_project(project)
        moment = min(max(float(request["timeMs"]), 0), project["scene"]["durationMs"]) / 1000
        frame, boxes = snapshot(project, moment)
        return {"frame": base64.b64encode(frame).decode("ascii"), "boxes": boxes}
    except Exception as error:  # noqa: BLE001 - every failure goes back to the editor instead of ending the worker
        return {"error": failure_cause(log.getvalue()) or str(error) or type(error).__name__}
    finally:
        logging.getLogger("manim").removeHandler(handler)


def main() -> None:
    tex = ROOT / TEX_BIN
    os.environ.update(manim_environment(tex if tex.is_dir() else None))
    # Manim prints to stdout; only answers may reach the app there.
    replies, sys.stdout = sys.stdout, sys.stderr
    for line in sys.stdin:
        if line.strip():
            print(json.dumps(answer(json.loads(line))), file=replies, flush=True)


if __name__ == "__main__":
    main()
