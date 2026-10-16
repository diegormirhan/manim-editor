from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

from renderer.manim_renderer.scene_compiler import compile_project
from renderer.manim_renderer.video_editor_export import layer_spans, timelines


def project():
    return {"schemaVersion": 1, "name": "Two layers & more", "scene": {"durationMs": 6000, "elements": {
        "a": {"kind": "circle", "radius": 1, "position": [0, 0, 0], "appearsAtMs": 0, "layer": 0, "disappearsAtMs": 4000},
        "b": {"kind": "square", "size": 1, "position": [2, 0, 0], "appearsAtMs": 1000, "layer": 1},
        "c": {"kind": "dot", "radius": 0.1, "position": [-2, 0, 0], "appearsAtMs": 4000, "layer": 0},
    }, "animations": [{"kind": "fadeIn", "targetId": "b", "startMs": 1000, "durationMs": 500}]}}


class VideoEditorExport(unittest.TestCase):
    def test_one_layer_renders_alone_with_the_whole_scene_still_timed(self):
        source = compile_project(project(), layer=1)
        self.assertIn("hidden = [element_0, element_2]", source)
        self.assertIn("self.add_updater(lambda dt: [mobject.set_opacity(0) for mobject in hidden])", source)
        # A redrawn wait would add a frame, and the layer would drift behind the others.
        self.assertIn("frozen_frame=True)", source)
        # Hidden objects still play their part in time, so every layer lines up with the others.
        self.assertIn("self.add(element_0)", source)
        self.assertNotIn("hidden", compile_project(project()))

    def test_a_layer_spans_its_objects(self):
        self.assertEqual(layer_spans(project()), {0: (0, 6000), 1: (1000, 6000)})

    def test_both_timelines_put_each_layer_on_its_own_track_at_its_time(self):
        media = {0: Path("C:/out/V1.mov"), 1: Path("C:/out/V2.mov")}
        xmeml, fcpxml = timelines(project(), media, fps=30, width=1920, height=1080)
        tracks = ET.fromstring(xmeml).findall("sequence/media/video/track")
        self.assertEqual([track.find("clipitem/name").text for track in tracks], ["V1", "V2"])
        second = tracks[1].find("clipitem")
        self.assertEqual([second.find(tag).text for tag in ("start", "end", "in", "out")], ["30", "180", "30", "180"])
        self.assertEqual(second.find("file/pathurl").text, "file://localhost/C%3A/out/V2.mov")
        root = ET.fromstring(fcpxml)
        clips = root.findall("library/event/project/sequence/spine/gap/asset-clip")
        self.assertEqual([(clip.get("lane"), clip.get("offset"), clip.get("duration")) for clip in clips],
                         [("1", "0/30s", "180/30s"), ("2", "30/30s", "150/30s")])
        self.assertEqual(root.find("library/event/project").get("name"), "Two layers & more")


if __name__ == "__main__":
    unittest.main()
