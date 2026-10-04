import json
from pathlib import Path

CONTRACT = json.loads((Path(__file__).resolve().parents[2] / "contracts/render-options.json").read_text(encoding="utf-8"))
GRID_FPS = CONTRACT["gridFps"]
DEFAULTS = {"resolution": "480p", "fps": GRID_FPS, "format": "mp4", "transparent": False}
_DRAFT = CONTRACT["resolutions"]["480p"]


def resolve_options(options: dict | None = None, *, preview: bool = False) -> dict:
    """Checks render options from the editor and resolves them to pixels, a frame rate and a container.

    A preview always plays inside the editor, so it is an opaque MP4 at a preview size.
    """
    if options is None:
        options = {}
    if not isinstance(options, dict) or set(options) - set(DEFAULTS):
        raise ValueError("Render options accept only resolution, fps, format and transparent.")
    chosen = {**DEFAULTS, **options}
    resolution, fps, container, transparent = chosen["resolution"], chosen["fps"], chosen["format"], chosen["transparent"]
    if resolution not in CONTRACT["resolutions"] or (preview and resolution not in CONTRACT["previewResolutions"]):
        raise ValueError(f"Unsupported resolution: {resolution!r}.")
    if type(fps) is not int or fps not in CONTRACT["frameRates"]:
        raise ValueError(f"Unsupported frame rate: {fps!r}.")
    if container not in CONTRACT["formats"] or (preview and container != "mp4"):
        raise ValueError(f"Unsupported format: {container!r}.")
    if type(transparent) is not bool or (transparent and (preview or not CONTRACT["formats"][container]["transparency"])):
        raise ValueError("A transparent background needs WebM or MOV.")
    size = CONTRACT["resolutions"][resolution]
    return {"width": size["width"], "height": size["height"], "fps": fps, "format": container, "transparent": transparent}


def workload(options: dict) -> float:
    """Pixels per second relative to the draft preview, which the render timeout scales by."""
    return options["width"] * options["height"] * options["fps"] / (_DRAFT["width"] * _DRAFT["height"] * GRID_FPS)
