import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import json

from renderer.manim_renderer.desktop_bridge import dispatch, render_root

ROOT = Path(__file__).resolve().parents[2]


class RenderRootTests(unittest.TestCase):
    def test_a_source_checkout_keeps_renders_beside_the_project(self):
        self.assertEqual(render_root(ROOT), ROOT / "work/renders")

    def test_an_installed_build_writes_to_per_user_application_data(self):
        with tempfile.TemporaryDirectory() as directory:
            installed = Path(directory)  # no .git, like C:/Program Files/manim-editor
            with patch.dict(os.environ, {"LOCALAPPDATA": r"C:\Users\someone\AppData\Local"}):
                target = render_root(installed)
            self.assertNotIn(str(installed), str(target))
            self.assertEqual(target, Path(r"C:\Users\someone\AppData\Local/manim-editor/renders"))

    def test_it_falls_back_to_the_home_directory_without_localappdata(self):
        with tempfile.TemporaryDirectory() as directory:
            environment = {key: value for key, value in os.environ.items() if key != "LOCALAPPDATA"}
            with patch.dict(os.environ, environment, clear=True):
                target = render_root(Path(directory))
            self.assertEqual(target, Path.home() / ".manim-editor" / "renders")


class DispatchTests(unittest.TestCase):
    def setUp(self):
        self.project = json.loads((ROOT / "examples/equation.json").read_text(encoding="utf-8"))
        self.directory = tempfile.TemporaryDirectory()
        self.folder = Path(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def fake_render(self, project, output_root, **keywords):
        self.rendered = keywords
        artifact = self.folder / f"preview.{keywords['options']['format']}"
        artifact.write_bytes(b"rendered video")
        keywords["on_progress"]("rendering", 0.5)
        return artifact

    def test_a_video_export_renders_the_output_options_and_publishes_the_file(self):
        destination = self.folder / "out" / "scene.mov"
        destination.parent.mkdir()
        events = []
        request = {"operation": "exportVideo", "project": self.project, "path": str(destination),
                   "options": {"resolution": "1080p", "fps": 60, "format": "mov", "transparent": True}}
        with patch("renderer.manim_renderer.desktop_bridge.render_project", self.fake_render):
            result = dispatch(request, self.folder, emit=lambda phase, done: events.append((phase, done)))
        self.assertEqual(result, {"path": str(destination)})
        self.assertEqual(destination.read_bytes(), b"rendered video")
        self.assertEqual(self.rendered["options"]["width"], 1920)
        self.assertEqual(events, [("rendering", 0.5)])
        self.assertEqual(list(destination.parent.iterdir()), [destination])

    def test_options_are_checked_before_any_render_starts(self):
        for operation, options in (("render", {"resolution": "2160p"}), ("exportVideo", {"fps": 24}),
                                   ("exportVideo", {"format": "mp4", "transparent": True})):
            with self.subTest(operation=operation, options=options), \
                    patch("renderer.manim_renderer.desktop_bridge.render_project") as render:
                with self.assertRaises(ValueError):
                    dispatch({"operation": operation, "project": self.project, "path": str(self.folder / "x"),
                              "options": options}, self.folder)
                render.assert_not_called()

    def test_python_export_uses_the_chosen_frame_rate(self):
        destination = self.folder / "scene.py"
        dispatch({"operation": "export", "project": self.project, "path": str(destination),
                  "options": {"resolution": "720p", "fps": 30, "format": "mp4", "transparent": False}}, self.folder)
        self.assertIn("config.frame_rate = 30", destination.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
