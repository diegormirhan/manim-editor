import json
from pathlib import Path
import tempfile

from jsonschema import Draft202012Validator
from .elements.expressions import check_expression
from .timeline import validate_timeline, frame_at


SCHEMA_PATH = Path(__file__).resolve().parents[2] / "contracts/project.schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(SCHEMA)
VALIDATOR = Draft202012Validator(SCHEMA)


def validate_project(project: dict) -> None:
    json.dumps(project, allow_nan=False)
    for error in VALIDATOR.iter_errors(project):
        path = "/".join(str(part) for part in error.absolute_path)
        raise ValueError(f"{path or '/'}: {error.message}")
    scene = project["scene"]
    if frame_at(scene["durationMs"]) < 1:
        raise ValueError("The scene must span at least one frame (67 ms).")
    for element_id, element in scene["elements"].items():
        if element["appearsAtMs"] >= scene["durationMs"]:
            raise ValueError(f"elements/{element_id}/appearsAtMs: must precede scene end")
        if frame_at(element["appearsAtMs"]) >= frame_at(scene["durationMs"]):
            raise ValueError("The element must appear before the final frame.")
        if element["kind"] in ("line", "arrow") and element["position"] == element["end"]:
            raise ValueError("Lines and arrows require distinct endpoints.")
        end = element.get("disappearsAtMs", scene["durationMs"])
        if end > scene["durationMs"] or frame_at(end) <= frame_at(element["appearsAtMs"]):
            raise ValueError("The element must end after it starts and within the scene.")
        for key in ("xRange", "yRange"):
            if key in element:
                low, high = element[key]
                if low >= high or low < -100 or high > 100 or high - low < 0.1:
                    raise ValueError("Invalid axis range: the minimum must be less than the maximum, between −100 and 100.")
        if element["kind"] == "functionGraph":
            check_expression(element["expression"], element["xRange"])
            if "axesId" in element:
                axes = scene["elements"].get(element["axesId"])
                if not axes or axes["kind"] not in ("axes", "numberPlane"):
                    raise ValueError("Select existing axes for the graph.")
                if axes.get("scale", 1) != 1:
                    raise ValueError("Adjust linked axes width and height, keeping their scale at 1.")
        if element["kind"] == "areaUnderGraph":
            graph = scene["elements"].get(element["graphId"])
            if not graph or graph["kind"] != "functionGraph":
                raise ValueError("Select an existing graph for the area.")
            if "axesId" not in graph:
                raise ValueError("The area requires a graph linked to axes.")
            if element["xRange"][0] < graph["xRange"][0] or element["xRange"][1] > graph["xRange"][1]:
                raise ValueError("The area range must stay within the graph range.")
    validate_timeline(scene)


def load_project(path: Path) -> dict:
    project = json.loads(path.read_text(encoding="utf-8"))
    validate_project(project)
    return project


def save_project(project: dict, path: Path) -> None:
    validate_project(project)
    contents = json.dumps(project, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, delete=False
    ) as temporary:
        temporary_path = Path(temporary.name)
        try:
            temporary.write(contents)
        except BaseException:
            temporary.close()
            temporary_path.unlink(missing_ok=True)
            raise
    try:
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)
