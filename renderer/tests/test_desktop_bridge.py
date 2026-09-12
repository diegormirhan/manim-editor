import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from renderer.manim_renderer.desktop_bridge import render_root

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


if __name__ == "__main__":
    unittest.main()
