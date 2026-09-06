import json
from pathlib import Path
import tempfile

from jsonschema import Draft202012Validator
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
        raise ValueError("A cena precisa ocupar pelo menos um frame (67 ms).")
    for element_id, element in scene["elements"].items():
        if element["appearsAtMs"] >= scene["durationMs"]:
            raise ValueError(f"elements/{element_id}/appearsAtMs: must precede scene end")
        if frame_at(element["appearsAtMs"]) >= frame_at(scene["durationMs"]):
            raise ValueError("O elemento deve aparecer antes do último frame.")
        if element["kind"] in ("line", "arrow") and element["position"] == element["end"]:
            raise ValueError("Linha e seta precisam de pontos distintos.")
        end = element.get("disappearsAtMs", scene["durationMs"])
        if end > scene["durationMs"] or frame_at(end) <= frame_at(element["appearsAtMs"]):
            raise ValueError("O fim do elemento deve ser posterior ao início e estar dentro da cena.")
        for key in ("xRange", "yRange"):
            if key in element:
                low, high = element[key]
                if low >= high or low < -100 or high > 100 or high - low < 0.1:
                    raise ValueError("Intervalo dos eixos inválido: use mínimo menor que máximo, entre −100 e 100.")
        if element["kind"] == "functionGraph":
            if element["expression"] == "sqrt(x)" and element["xRange"][0] < 0:
                raise ValueError("A raiz quadrada exige X inicial maior ou igual a zero.")
            if "axesId" in element:
                axes = scene["elements"].get(element["axesId"])
                if not axes or axes["kind"] not in ("axes", "numberPlane"):
                    raise ValueError("Selecione eixos existentes para o gráfico.")
                if axes.get("scale", 1) != 1:
                    raise ValueError("Ajuste largura e altura dos eixos vinculados, mantendo escala em 1.")
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
