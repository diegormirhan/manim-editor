from .elements.catalog import compile_element
from .elements.graphs import DEPENDENCY_ORDER
from .project import validate_project
from .timeline import ENTRANCES, FPS, children_of, compile_animation, frame_at, leaf_clips


def _plan(project: dict) -> tuple[list[str], list[int]]:
    """The scene's statements, and the grid frames of each play or wait in the order Manim renders them."""
    validate_project(project)
    scene = project["scene"]
    # Track order is layer order; the sort is stable, so simultaneous elements keep it.
    elements = sorted(scene["elements"].items(), key=lambda item: item[1]["appearsAtMs"])
    variables = {identifier: f"element_{i}" for i, (identifier, _) in enumerate(elements)}
    layer = {identifier: i for i, identifier in enumerate(scene["elements"])}
    leaves = leaf_clips(scene)
    entrances = {clip["targetId"] for clip in leaves if clip["kind"] in ENTRANCES}
    hidden = {clip["destinationId"] for clip in leaves if clip["kind"] == "transform"}
    statements, events, segments = [], [], []
    for identifier, element in sorted(elements, key=lambda item: DEPENDENCY_ORDER.get(item[1]["kind"], 0)):
        statements.extend(compile_element(element, variables[identifier], variables, scene["elements"]))
        if identifier not in entrances and identifier not in hidden:
            events.append((frame_at(element["appearsAtMs"]), 1, layer[identifier], identifier))
        if "disappearsAtMs" in element and element["disappearsAtMs"] < scene["durationMs"]:
            events.append((frame_at(element["disappearsAtMs"]), 0, layer[identifier], identifier))
    for index, clip in enumerate(scene.get("animations", [])):
        events.append((frame_at(clip["startMs"]), 2, index, clip))
    current = 0
    for start, event_kind, _, clip in sorted(events, key=lambda event: event[:3]):
        if start > current:
            statements.append(f"self.wait(({start - current} + 1e-6) / {FPS})")
            segments.append(start - current)
        if event_kind < 2:
            method = "remove" if event_kind == 0 else "add"
            statements.append(f"self.{method}({variables[clip]})")
            current = max(current, start)
        else:
            end = frame_at(clip["startMs"] + clip["durationMs"])
            animations = [compile_animation(child, variables[child["targetId"]], variables) for child in children_of(clip)]
            animation = f"AnimationGroup({', '.join(animations)}, lag_ratio=0)" if clip["kind"] == "parallel" else animations[0]
            statements.append(f"self.play({animation}, run_time=({end - start} - 1e-6) / {FPS})")
            segments.append(end - start)
            current = end
    remaining = frame_at(scene["durationMs"]) - current
    if remaining:
        statements.append(f"self.wait(({remaining} + 1e-6) / {FPS})")
        segments.append(remaining)
    return statements, segments


def segment_frames(project: dict) -> list[int]:
    return _plan(project)[1]


def compile_project(project: dict, fps: int = FPS) -> str:
    """Readable Manim source. Timing stays on the 15 fps grid, so `fps` must be a multiple of it."""
    statements, _ = _plan(project)
    background = project["scene"].get("background")
    header = ("import numpy as np\n"
              "from manim import (MathTex, Text, Circle, Ellipse, Rectangle, Line, Arrow, Dot, Square, Triangle,\n"
              "                   RegularPolygon, Arc, Axes, NumberPlane, NumberLine, FunctionGraph, Scene, Create, Write,\n"
              "                   FadeIn, FadeOut, GrowFromCenter, DrawBorderThenFill, Indicate, Wiggle, Rotate,\n"
              "                   ReplacementTransform, AnimationGroup, config)\n\n"
              f"config.frame_rate = {fps}\nconfig.frame_width = 128 / 9\nconfig.frame_height = 8\n"
              + (f'config.background_color = "{background}"\n' if background else "") + "\n"
              "# Frame-aligned intervals avoid cumulative rounding drift.\n"
              "class EditorScene(Scene):\n    def construct(self):\n")
    return header + "".join(f"        {statement}\n" for statement in statements)
