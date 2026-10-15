import math

FPS = 15
ENTRANCES = {"create", "write", "fadeIn", "grow", "drawBorder"}
# A clip carries exactly the extra field its kind names here.
CLIP_FIELDS = {
    "moveTo": "destination",
    "transform": "destinationId",
    "rotate": "degrees",
    "scaleTo": "factor",
    "recolor": "color",
}
ANIMATION_CLASSES = {
    "create": "Create", "write": "Write", "fadeIn": "FadeIn", "grow": "GrowFromCenter",
    "drawBorder": "DrawBorderThenFill", "fadeOut": "FadeOut", "indicate": "Indicate", "wiggle": "Wiggle",
}


def frame_at(milliseconds):
    return math.floor(milliseconds * FPS / 1000 + 0.5)


def children_of(clip):
    return clip.get("clips", []) if clip["kind"] == "parallel" else [clip]


def leaf_clips(scene):
    return [child for clip in scene.get("animations", []) for child in children_of(clip)]


def layer_of(scene, identifier):
    """An element's timeline layer: its own, or its place in the scene for files from before layers."""
    return scene["elements"][identifier].get("layer", list(scene["elements"]).index(identifier))


def lifetimes(scene):
    """When each element is on screen: a fade-out or a transform ends it, and a transform destination starts with its end."""
    spans = {key: [element["appearsAtMs"], element.get("disappearsAtMs", scene["durationMs"])]
             for key, element in scene["elements"].items()}
    for clip in leaf_clips(scene):
        end = clip["startMs"] + clip["durationMs"]
        if clip["kind"] == "transform" and clip.get("destinationId") in spans:
            spans[clip["destinationId"]][0] = end
        if clip["kind"] in ("fadeOut", "transform") and clip.get("targetId") in spans:
            spans[clip["targetId"]][1] = min(spans[clip["targetId"]][1], end)
    return spans


def check_clip_fields(clip):
    for kind, field in CLIP_FIELDS.items():
        if (clip["kind"] == kind) != (field in clip):
            raise ValueError(f"The field {field!r} belongs only to animation {kind!r}.")


def _overlapping(spans):
    spans = sorted(spans)
    return any(start < spans[index - 1][1] for index, (start, _) in enumerate(spans) if index)


def validate_timeline(scene):
    owners = set()
    for clip in leaf_clips(scene):
        if clip["kind"] != "transform":
            continue
        destination = clip.get("destinationId")
        if not destination or destination not in scene["elements"] or destination == clip.get("targetId"):
            raise ValueError("Transform requires a different, existing destination.")
        if destination in owners:
            raise ValueError("Each Transform destination belongs to exactly one transformation.")
        owners.add(destination)

    for block in scene.get("animations", []):
        start, end = block["startMs"], block["startMs"] + block["durationMs"]
        if end > scene["durationMs"]:
            raise ValueError("The animation would run past the end of the scene.")
        if frame_at(end) <= frame_at(start):
            raise ValueError("An animation must span at least one frame.")
        children = children_of(block)
        if block["kind"] == "parallel":
            if len(children) < 2 or any(child["kind"] == "parallel" for child in children):
                raise ValueError("A parallel group requires at least two animations and no nested groups.")
            if any(child["startMs"] != start or child["durationMs"] != block["durationMs"] for child in children):
                raise ValueError("Group animations must share their start time and duration.")
        elif "clips" in block:
            raise ValueError("Only parallel groups accept child animations.")

    spans, busy = lifetimes(scene), {}
    for clip in leaf_clips(scene):
        target = clip.get("targetId")
        if target not in scene["elements"]:
            raise ValueError("The animation references an element that does not exist.")
        check_clip_fields(clip)
        (alive, gone), start = spans[target], clip["startMs"]
        end = start + clip["durationMs"]
        if not alive <= start < gone:
            raise ValueError("The animation would start while its object is not on screen.")
        if end > gone:
            raise ValueError("The animation would run past the moment its object leaves the screen.")
        if clip["kind"] in ENTRANCES and (target in owners or start != alive):
            raise ValueError("An entrance plays once, starting when its object appears.")
        if clip["kind"] == "transform" and scene["elements"][clip["destinationId"]].get("disappearsAtMs", scene["durationMs"]) <= end:
            raise ValueError("The destination must remain in the scene after Transform.")
        busy.setdefault(target, []).append((start, end))
    if any(_overlapping(times) for times in busy.values()):
        raise ValueError("An object plays one animation at a time. Move one after the other.")
    layers = {}
    for identifier in scene["elements"]:
        layers.setdefault(layer_of(scene, identifier), []).append(spans[identifier])
    for layer, times in layers.items():
        if _overlapping(times):
            raise ValueError(f"Two objects on layer {layer + 1} overlap in time. Move one to another layer.")


def compile_animation(clip, variable, variables=None):
    kind = clip["kind"]
    if kind == "moveTo":
        return f"{variable}.animate.move_to({clip['destination']!r})"
    if kind == "transform":
        return f"ReplacementTransform({variable}, {variables[clip['destinationId']]})"
    if kind == "rotate":
        return f"Rotate({variable}, angle=np.deg2rad({clip['degrees']!r}))"
    if kind == "scaleTo":
        return f"{variable}.animate.scale({clip['factor']!r})"
    if kind == "recolor":
        return f"{variable}.animate.set_color({clip['color']!r})"
    return f"{ANIMATION_CLASSES[kind]}({variable})"
