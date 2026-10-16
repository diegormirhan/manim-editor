from .elements.catalog import DEPENDENCY_ORDER, compile_element
from .project import validate_project
from .timeline import ENTRANCES, FPS, compile_animation, frame_at, layer_of, leaf_clips, lifetimes


def _by_appearance(scene: dict) -> list[tuple[str, dict]]:
    # The sort is stable, so simultaneous elements keep their order in the file.
    return sorted(scene["elements"].items(), key=lambda item: item[1]["appearsAtMs"])


def element_variables(scene: dict) -> dict[str, str]:
    """Each element's name in the scene's Python."""
    return {identifier: f"element_{i}" for i, (identifier, _) in enumerate(_by_appearance(scene))}


def _frames(clip: dict) -> tuple[int, int]:
    return frame_at(clip["startMs"]), frame_at(clip["startMs"] + clip["durationMs"])


def _stretches(clips: list[dict]) -> list[tuple[int, int, list[dict]]]:
    """Animations chained by overlapping in time; each stretch becomes one play."""
    stretches = []
    for clip in sorted(clips, key=lambda clip: _frames(clip)[0]):
        start, end = _frames(clip)
        if stretches and start < stretches[-1][1]:
            stretches[-1] = (stretches[-1][0], max(stretches[-1][1], end), [*stretches[-1][2], clip])
        else:
            stretches.append((start, end, [clip]))
    return stretches


def _play(stretch, scene: dict, variables: dict[str, str]) -> tuple[list[str], list[str]]:
    """The animations of one play, and the changes to the scene part-way through it."""
    start, end, clips = stretch
    spans, length, parts, changes = lifetimes(scene), end - start, [], []
    for clip in clips:
        first, last = _frames(clip)
        source = variables[clip["targetId"]]
        animation = compile_animation(clip, source, variables)
        if clip["kind"] == "transform" and last < end:
            # The destination takes over as the transform ends, so the rest of the play can animate it.
            destination = variables[clip["destinationId"]]
            animation = f"Transform({source}, {destination})"
            changes.append(f"at({last - start} / {length}, Replace({source}, {destination}))")
        if (first, last) == (start, end):
            parts.append(animation)
            continue
        entering = clip["kind"] not in ENTRANCES and frame_at(spans[clip["targetId"]][0]) > start
        parts.append(f"between({first - start} / {length}, {last - start} / {length}, {animation}"
                     f"{', entering=True' if entering else ''})")
    return parts, changes


def _plan(project: dict, layer: int | None = None) -> tuple[list[str], list[int]]:
    """The scene's statements, and the grid frames of each play or wait in the order Manim renders them.

    With `layer`, every other layer's objects still play their part but are drawn transparent, so the layer can be
    rendered on its own and line up with the others in a video editor.
    """
    validate_project(project)
    scene = project["scene"]
    elements, variables = _by_appearance(scene), element_variables(scene)
    order = {identifier: i for i, identifier in enumerate(scene["elements"])}
    leaves = leaf_clips(scene)
    entrances = {clip["targetId"] for clip in leaves if clip["kind"] in ENTRANCES}
    hidden = {clip["destinationId"] for clip in leaves if clip["kind"] == "transform"}
    statements, events, segments = [], [], []
    for identifier, element in sorted(elements, key=lambda item: DEPENDENCY_ORDER.get(item[1]["kind"], 0)):
        statements.extend(compile_element(element, variables[identifier], variables, scene["elements"]))
        if layer_of(scene, identifier):
            statements.append(f"{variables[identifier]}.set_z_index({layer_of(scene, identifier)})")
        if identifier not in entrances and identifier not in hidden:
            events.append((frame_at(element["appearsAtMs"]), 1, order[identifier], identifier))
        if "disappearsAtMs" in element and element["disappearsAtMs"] < scene["durationMs"]:
            events.append((frame_at(element["disappearsAtMs"]), 0, order[identifier], identifier))
    others = [variables[identifier] for identifier in scene["elements"] if layer is not None and layer_of(scene, identifier) != layer]
    if others:
        # A scene updater runs after each frame's animations, so nothing an animation does can show them again.
        statements += [f"hidden = [{', '.join(others)}]", "for mobject in hidden: mobject.set_opacity(0)",
                       "self.add_updater(lambda dt: [mobject.set_opacity(0) for mobject in hidden])"]
    # That updater would make Manim redraw each wait, which renders one frame more than a frozen wait.
    frozen = ", frozen_frame=True" if others else ""
    for index, stretch in enumerate(_stretches(leaves)):
        events.append((stretch[0], 2, index, stretch))
    current = 0
    ordered, folded = sorted(events, key=lambda event: event[:3]), set()
    for index, (start, event_kind, _, payload) in enumerate(ordered):
        if index in folded:
            continue
        if start > current:
            statements.append(f"self.wait(({start - current} + 1e-6) / {FPS}{frozen})")
            segments.append(start - current)
        if event_kind < 2:
            statements.append(f"self.{'remove' if event_kind == 0 else 'add'}({variables[payload]})")
            current = max(current, start)
            continue
        end = payload[1]
        parts, changes = _play(payload, scene, variables)
        # Elements that enter or leave while it plays change the scene inside the same play.
        for later, (frame, kind, _, identifier) in enumerate(ordered[index + 1:], index + 1):
            if kind < 2 and start < frame < end:
                folded.add(later)
                changes.append(f"at({frame - start} / {end - start}, {'Add' if kind else 'Remove'}({variables[identifier]}))")
        statements.append(f"self.play({', '.join([*parts, *changes])}, run_time=({end - start} - 1e-6) / {FPS})")
        segments.append(end - start)
        current = end
    remaining = frame_at(scene["durationMs"]) - current
    if remaining:
        statements.append(f"self.wait(({remaining} + 1e-6) / {FPS}{frozen})")
        segments.append(remaining)
    return statements, segments


def segment_frames(project: dict) -> list[int]:
    return _plan(project)[1]


# Written into the scene only when a play changes the scene part-way through.
MID_PLAY_CHANGES = '''
class Remove(Add):
    """Takes mobjects off the scene part-way through an animation; the counterpart of Manim's Add."""

    def _setup_scene(self, scene):
        scene.remove(self.mobject)
        # Scene.remove leaves the per-frame repaint list alone, unlike Scene.add.
        scene.restructure_mobjects(to_remove=[self.mobject], mobject_list_name="moving_mobjects")


class Replace(Add):
    """Swaps a transformed mobject for its destination the moment the transform ends."""

    def __init__(self, source, destination):
        super().__init__(destination)
        self.source = source

    def _setup_scene(self, scene):
        Remove(self.source)._setup_scene(scene)
        super()._setup_scene(scene)


def at(fraction, change):
    """A change to the scene part-way through the animation it plays with."""
    return Succession(Wait(run_time=fraction), change, Wait(run_time=1 - fraction))


def between(start, end, animation, entering=False):
    """Plays `animation` from `start` to `end`, as fractions of the play it belongs to.

    A play shows every mobject it animates from its first frame, so one that enters part-way through
    stays out of the play's group until then.
    """
    animation = prepare_animation(animation)
    animation.run_time = end - start
    parts = [Wait(run_time=start)] if start else []
    parts.append(animation)
    if end < 1:
        parts.append(Wait(run_time=1 - end))
    return Succession(*parts, group=Group() if entering else None)

'''


def compile_project(project: dict, fps: int = FPS, layer: int | None = None) -> str:
    """Readable Manim source. Timing stays on the 15 fps grid, so `fps` must be a multiple of it."""
    statements, _ = _plan(project, layer)
    background = project["scene"].get("background")
    mid_play = any(" at(" in statement or "between(" in statement for statement in statements)
    header = ("import numpy as np\nfrom manim import *\n"
              + ("from manim.animation.animation import prepare_animation\n" if mid_play else "") + "\n"
              f"config.frame_rate = {fps}\nconfig.frame_width = 128 / 9\nconfig.frame_height = 8\n"
              + (f'config.background_color = "{background}"\n' if background else "") + "\n"
              + (MID_PLAY_CHANGES + "\n" if mid_play else "")
              + "# Frame-aligned intervals avoid cumulative rounding drift.\n"
              "class EditorScene(Scene):\n    def construct(self):\n")
    return header + "".join(f"        {statement}\n" for statement in statements)
