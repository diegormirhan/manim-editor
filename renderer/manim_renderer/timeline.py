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


def lifetimes(scene):
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


def validate_timeline(scene):
    clips = sorted(scene.get("animations", []), key=lambda clip: clip["startMs"])
    leaves = leaf_clips(scene)
    owners = {}
    for clip in leaves:
        if clip["kind"] != "transform":
            continue
        destination = clip.get("destinationId")
        if not destination or destination not in scene["elements"] or destination == clip.get("targetId"):
            raise ValueError("Transform requires a different, existing destination.")
        if destination in owners:
            raise ValueError("Each Transform destination belongs to exactly one transformation.")
        owners[destination] = clip

    available = {key: element["appearsAtMs"] for key, element in scene["elements"].items() if key not in owners}
    entered, removed = set(), set()
    previous_end = 0
    for block in clips:
        start, end = block["startMs"], block["startMs"] + block["durationMs"]
        if start < previous_end or end > scene["durationMs"]:
            raise ValueError("Animations must be sequential and end within the scene.")
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
        touched, pending = set(), []
        for clip in children:
            target = clip.get("targetId")
            element = scene["elements"].get(target)
            if element is None:
                raise ValueError("The animation references an element that does not exist.")
            if target in touched:
                raise ValueError("An element cannot have two animations in the same group.")
            touched.add(target)
            if target in removed or target not in available or start < available[target]:
                raise ValueError("The element is not available at this time.")
            if end > element.get("disappearsAtMs", scene["durationMs"]):
                raise ValueError("The animation extends beyond the element's end.")
            if clip["kind"] in ENTRANCES:
                if target in entered or target in owners or start != available[target]:
                    raise ValueError("An entrance must start with its element and occur only once.")
                entered.add(target)
            check_clip_fields(clip)
            if clip["kind"] == "transform":
                destination = clip["destinationId"]
                if destination in available or destination in removed or destination in touched:
                    raise ValueError("The Transform destination must be hidden.")
                if scene["elements"][destination].get("disappearsAtMs", scene["durationMs"]) <= end:
                    raise ValueError("The destination must remain in the scene after Transform.")
                touched.add(destination)
                pending.append((destination, end))
                removed.add(target)
            if clip["kind"] == "fadeOut":
                removed.add(target)
        available.update(pending)
        for identifier, item in scene["elements"].items():
            times = [item.get("disappearsAtMs", scene["durationMs"])]
            if identifier not in owners:
                times.append(item["appearsAtMs"])
            if any(start < time < end for time in times):
                raise ValueError("An element appears or disappears during another animation: adjust its timing or use a parallel group.")
        previous_end = end


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
