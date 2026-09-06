from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from renderer.manim_renderer.project import load_project
from renderer.manim_renderer.render_job import render_project, RenderError


ROOT = Path(__file__).resolve().parents[2]


class RenderJobTests(unittest.TestCase):
    def setUp(self):
        self.project = load_project(ROOT / 'examples/equation.json')

    def test_invalid_project_creates_no_job(self):
        with tempfile.TemporaryDirectory() as directory:
            self.project['schemaVersion'] = 99
            with self.assertRaises(ValueError):
                render_project(self.project, Path(directory))
            self.assertEqual(list(Path(directory).iterdir()), [])

    @patch('renderer.manim_renderer.render_job.subprocess.run')
    def test_failure_keeps_diagnostics_and_previous_video(self, run):
        run.return_value = subprocess.CompletedProcess([], 1)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            previous = root / 'previous.mp4'
            previous.write_bytes(b'previous render')
            with self.assertRaises(RenderError):
                render_project(self.project, root)
            self.assertEqual(previous.read_bytes(), b'previous render')
            self.assertEqual(len(list(root.glob('*/scene.py'))), 1)
            self.assertEqual(len(list(root.glob('*/render.log'))), 1)

    @patch('renderer.manim_renderer.render_job.subprocess.run')
    def test_success_requires_nonempty_artifact(self, run):
        run.return_value = subprocess.CompletedProcess([], 0)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RenderError, 'video'):
                render_project(self.project, Path(directory))

    @patch('renderer.manim_renderer.render_job.subprocess.run')
    def test_timeout_reports_log_location(self, run):
        run.side_effect = subprocess.TimeoutExpired('manim', 120)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RenderError, 'render.log'):
                render_project(self.project, Path(directory))

    @patch('renderer.manim_renderer.render_job.subprocess.run')
    def test_render_uses_argument_list_and_isolated_directory(self, run):
        def complete(command, **options):
            output = Path(options['cwd']) / 'media/videos/scene/480p15/preview.mp4'
            output.parent.mkdir(parents=True)
            output.write_bytes(b'video fixture')
            return subprocess.CompletedProcess(command, 0)

        run.side_effect = complete
        with tempfile.TemporaryDirectory() as directory:
            result = render_project(self.project, Path(directory))
            self.assertTrue(result.is_file())
            command = run.call_args.args[0]
            self.assertIsInstance(command, list)
            self.assertIn('--disable_caching', command)
            self.assertFalse(run.call_args.kwargs.get('shell', False))


if __name__ == '__main__':
    unittest.main()
