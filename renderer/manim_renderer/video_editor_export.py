"""The scene as a timeline for video editors: one transparent ProRes 4444 video per layer, and two timelines that place
them on tracks at their times. FCP7 XML opens in Premiere Pro, DaVinci Resolve and VEGAS Pro; FCPXML in Final Cut Pro
and DaVinci Resolve. The animations arrive baked into the videos.
"""
from pathlib import Path
from typing import Callable
from urllib.parse import quote
from xml.sax.saxutils import escape, quoteattr

from .render_job import render_project
from .timeline import layer_of, lifetimes


def layer_spans(project: dict) -> dict[int, tuple[int, int]]:
    """Each layer's first appearance and last exit, in milliseconds."""
    scene, spans = project["scene"], {}
    for identifier, (start, end) in lifetimes(project["scene"]).items():
        layer = layer_of(scene, identifier)
        first, last = spans.get(layer, (start, end))
        spans[layer] = (min(first, start), max(last, end))
    return dict(sorted(spans.items()))


def timelines(project: dict, media: dict[int, Path], *, fps: int, width: int, height: int) -> tuple[str, str]:
    """FCP7 XML and FCPXML for layer videos that each last the whole scene."""
    name, total = project["name"], round(project["scene"]["durationMs"] * fps / 1000)
    frames = {layer: (round(start * fps / 1000), round(end * fps / 1000)) for layer, (start, end) in layer_spans(project).items()}
    rate = f"<rate><timebase>{fps}</timebase><ntsc>FALSE</ntsc></rate>"
    size = f"<samplecharacteristics>{rate}<width>{width}</width><height>{height}</height></samplecharacteristics>"
    tracks = "".join(
        f'<track><clipitem id="clipitem-{layer + 1}"><name>V{layer + 1}</name><duration>{total}</duration>{rate}'
        f"<start>{start}</start><end>{end}</end><in>{start}</in><out>{end}</out>"
        f'<file id="file-{layer + 1}"><name>{escape(path.name)}</name>'
        f"<pathurl>file://localhost/{quote(path.as_posix())}</pathurl>{rate}<duration>{total}</duration>"
        f"<media><video>{size}</video></media></file></clipitem></track>"
        for layer, (start, end) in frames.items() for path in [media[layer]])
    xmeml = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4">'
             f'<sequence id="sequence-1"><name>{escape(name)}</name><duration>{total}</duration>{rate}'
             f"<media><video><format>{size}</format>{tracks}</video></media></sequence></xmeml>\n")
    time = lambda count: f"{count}/{fps}s"
    assets = "".join(
        f'<asset id="r{layer + 2}" name="V{layer + 1}" start="0s" duration="{time(total)}" hasVideo="1" format="r1">'
        f'<media-rep kind="original-media" src={quoteattr(media[layer].resolve().as_uri())}/></asset>' for layer in frames)
    clips = "".join(
        f'<asset-clip ref="r{layer + 2}" lane="{layer + 1}" name="V{layer + 1}" offset="{time(start)}" '
        f'start="{time(start)}" duration="{time(end - start)}"/>' for layer, (start, end) in frames.items())
    fcpxml = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10"><resources>'
              f'<format id="r1" frameDuration="1/{fps}s" width="{width}" height="{height}"/>{assets}</resources>'
              f"<library><event name=\"manim-editor\"><project name={quoteattr(name)}>"
              f'<sequence format="r1" duration="{time(total)}" tcStart="0s"><spine>'
              f'<gap name="Gap" offset="0s" start="0s" duration="{time(total)}">{clips}</gap>'
              "</spine></sequence></project></event></library></fcpxml>\n")
    return xmeml, fcpxml


def to_prores(source: Path, destination: Path) -> None:
    """ProRes 4444 keeps the alpha channel and opens in every one of those editors, unlike QuickTime Animation."""
    import av
    with av.open(str(source)) as video_in, av.open(str(destination), "w") as video_out:
        stream_in = video_in.streams.video[0]
        stream = video_out.add_stream("prores_ks", rate=stream_in.average_rate)
        stream.width, stream.height, stream.pix_fmt = stream_in.width, stream_in.height, "yuva444p10le"
        stream.options = {"profile": "4", "vendor": "apl0"}
        for frame in video_in.decode(stream_in):
            video_out.mux(stream.encode(frame.reformat(format="yuva444p10le")))
        video_out.mux(stream.encode(None))


def export_for_video_editors(project: dict, folder: Path, render_root: Path, *, options: dict, tex_bin: Path | None = None,
                             on_progress: Callable[[str, float], None] | None = None) -> list[Path]:
    """Renders every layer into `folder` and writes both timelines beside the videos; returns the files written."""
    folder.mkdir(parents=True, exist_ok=True)
    layers, media = list(layer_spans(project)), {}
    for index, layer in enumerate(layers):
        def progress(phase: str, fraction: float, index=index) -> None:
            if on_progress:
                on_progress(phase, (index + fraction) / len(layers))
        video = render_project(project, render_root, tex_bin=tex_bin, layer=layer, on_progress=progress,
                               options={**options, "format": "mov", "transparent": True})
        media[layer] = folder / f"V{layer + 1}.mov"
        to_prores(video, media[layer])
    xmeml, fcpxml = timelines(project, media, fps=options["fps"], width=options["width"], height=options["height"])
    (folder / "timeline.xml").write_text(xmeml, encoding="utf-8")
    (folder / "timeline.fcpxml").write_text(fcpxml, encoding="utf-8")
    return [*media.values(), folder / "timeline.xml", folder / "timeline.fcpxml"]
