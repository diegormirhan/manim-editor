from .elements.catalog import compile_element
from .project import validate_project
from .timeline import ENTRANCES, FPS, children_of, compile_animation, frame_at, leaf_clips


def compile_project(project: dict) -> str:
    validate_project(project)
    scene = project["scene"]
    elements = sorted(scene["elements"].items(), key=lambda item: (item[1]["appearsAtMs"], item[0]))
    variables = {identifier: f"element_{i}" for i, (identifier, _) in enumerate(elements)}
    leaves = leaf_clips(scene)
    entrances = {clip["targetId"] for clip in leaves if clip["kind"] in ENTRANCES}
    hidden = {clip["destinationId"] for clip in leaves if clip["kind"] == "transform"}
    statements, events = [], []
    for identifier, element in sorted(elements, key=lambda item: item[1]["kind"] == "functionGraph"):
        statements.extend(compile_element(element, variables[identifier], variables))
        if identifier not in entrances and identifier not in hidden:
            events.append((frame_at(element["appearsAtMs"]), 1, identifier, None))
        if "disappearsAtMs" in element and element["disappearsAtMs"] < scene["durationMs"]:
            events.append((frame_at(element["disappearsAtMs"]), 0, identifier, None))
    for index, clip in enumerate(scene.get("animations", [])):
        events.append((frame_at(clip["startMs"]), 2, str(index), clip))
    current = 0
    for start, event_kind, identifier, clip in sorted(events):
        if start > current:
            statements.append(f"self.wait(({start - current} + 1e-6) / {FPS})")
        if clip is None:
            method = "remove" if event_kind == 0 else "add"
            statements.append(f"self.{method}({variables[identifier]})")
            current = max(current, start)
        else:
            end = frame_at(clip["startMs"] + clip["durationMs"])
            animations = [compile_animation(child, variables[child["targetId"]], variables) for child in children_of(clip)]
            animation = f"AnimationGroup({', '.join(animations)}, lag_ratio=0)" if clip["kind"] == "parallel" else animations[0]
            statements.append(f"self.play({animation}, run_time=({end - start} - 1e-6) / {FPS})")
            current = end
    remaining = frame_at(scene["durationMs"]) - current
    if remaining:
        statements.append(f"self.wait(({remaining} + 1e-6) / {FPS})")
    header = ("import numpy as np\n"
              "from manim import MathTex, Text, Circle, Rectangle, Line, Arrow, Dot, Square, Triangle, Axes, NumberPlane, FunctionGraph, Scene, Create, Write, FadeIn, FadeOut, ReplacementTransform, AnimationGroup, config\n\n"
              f"config.frame_rate = {FPS}\nconfig.frame_width = 128 / 9\nconfig.frame_height = 8\n\n"
              "# Frame-aligned intervals avoid cumulative rounding drift.\n"
              "class EditorScene(Scene):\n    def construct(self):\n")
    return header + "".join(f"        {statement}\n" for statement in statements)
