from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from renderer.manim_renderer.project import load_project
from renderer.manim_renderer.render_job import failure_cause, render_project, render_timeout, rendered_fraction, RenderError
from renderer.manim_renderer.render_options import resolve_options


ROOT = Path(__file__).resolve().parents[2]
POPEN = 'renderer.manim_renderer.render_job.subprocess.Popen'


class FakeManim:
    """Stands in for the Manim process: each poll that times out starts one more segment."""

    def __init__(self, command, returncode=0, ticks=0, artifact=True, hang=False, **options):
        self.command, self.options = command, options
        self.returncode, self.ticks, self.artifact, self.hang = returncode, ticks, artifact, hang
        self.killed = False
        self.media = Path(options['cwd']) / 'media/videos/scene/480p15'

    def wait(self, timeout=None):
        if self.hang and not self.killed:
            raise subprocess.TimeoutExpired('manim', timeout)
        if self.ticks:
            partials = self.media / 'partial_movie_files/EditorScene'
            partials.mkdir(parents=True, exist_ok=True)
            (partials / f'uncached_{len(list(partials.iterdir())):05}.mp4').write_bytes(b'segment')
            self.ticks -= 1
            raise subprocess.TimeoutExpired('manim', timeout)
        if self.artifact and self.returncode == 0:
            extension = self.command[self.command.index('--format') + 1]
            self.media.mkdir(parents=True, exist_ok=True)
            (self.media / f'preview.{extension}').write_bytes(b'video fixture')
        return self.returncode

    def kill(self):
        self.killed = True


def manim(**behaviour):
    def start(command, **options):
        process = FakeManim(command, **behaviour, **options)
        start.process = process
        return process
    return start


class RenderJobTests(unittest.TestCase):
    def setUp(self):
        self.project = load_project(ROOT / 'examples/equation.json')

    def test_invalid_project_creates_no_job(self):
        with tempfile.TemporaryDirectory() as directory:
            self.project['schemaVersion'] = 99
            with self.assertRaises(ValueError):
                render_project(self.project, Path(directory))
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_failure_keeps_diagnostics_and_previous_video(self):
        with tempfile.TemporaryDirectory() as directory, patch(POPEN, manim(returncode=1)):
            root = Path(directory)
            previous = root / 'previous.mp4'
            previous.write_bytes(b'previous render')
            with self.assertRaises(RenderError):
                render_project(self.project, root)
            self.assertEqual(previous.read_bytes(), b'previous render')
            self.assertEqual(len(list(root.glob('*/scene.py'))), 1)
            self.assertEqual(len(list(root.glob('*/render.log'))), 1)

    def test_failure_cause_names_the_latex_error_or_the_exception(self):
        latex = ("[10/04/26 08:01:59] ERROR    LaTeX compilation error: Missing } inserted.    tex_file_writing.py:320\n"
                 "ValueError: latex error converting to dvi. See log output above or the log file: x.log\n")
        self.assertEqual(failure_cause(latex), "LaTeX error: Missing } inserted. Check the equation's LaTeX.")
        crash = "Traceback (most recent call last):\n  ...\nZeroDivisionError: division by zero\n"
        self.assertEqual(failure_cause(crash), "ZeroDivisionError: division by zero")
        self.assertIsNone(failure_cause("Manim Community v0.21.0\n"))

    def test_success_requires_nonempty_artifact(self):
        with tempfile.TemporaryDirectory() as directory, patch(POPEN, manim(artifact=False)):
            with self.assertRaisesRegex(RenderError, 'video'):
                render_project(self.project, Path(directory))

    def test_timeout_stops_manim_and_reports_log_location(self):
        start = manim(hang=True)
        with tempfile.TemporaryDirectory() as directory, patch(POPEN, start), \
                patch('renderer.manim_renderer.render_job.render_timeout', return_value=0):
            with self.assertRaisesRegex(RenderError, 'render.log'):
                render_project(self.project, Path(directory))
        self.assertTrue(start.process.killed)

    def test_timeout_grows_with_the_scene_and_the_workload(self):
        short = render_timeout(self.project)
        long_scene = {'scene': {'durationMs': 120_000}}
        self.assertGreater(short, self.project['scene']['durationMs'] / 1000)
        self.assertGreater(render_timeout(long_scene), short * 4)
        ultra = resolve_options({'resolution': '2160p', 'fps': 60})
        self.assertGreater(render_timeout(self.project, ultra), short * 20)

    def test_render_uses_argument_list_and_isolated_directory(self):
        start = manim()
        with tempfile.TemporaryDirectory() as directory, patch(POPEN, start):
            result = render_project(self.project, Path(directory))
            self.assertTrue(result.is_file())
        command = start.process.command
        self.assertIsInstance(command, list)
        self.assertIn('--disable_caching', command)
        for flag, value in (('--resolution', '854,480'), ('--frame_rate', '15'), ('--format', 'mp4')):
            self.assertEqual(command[command.index(flag) + 1], value)
        self.assertNotIn('--transparent', command)
        self.assertFalse(start.process.options.get('shell', False))

    def test_export_options_reach_manim_and_name_the_artifact(self):
        start = manim()
        options = resolve_options({'resolution': '1080p', 'fps': 60, 'format': 'mov', 'transparent': True})
        with tempfile.TemporaryDirectory() as directory, patch(POPEN, start):
            result = render_project(self.project, Path(directory), options=options)
            self.assertEqual(result.name, 'preview.mov')
            self.assertIn('config.frame_rate = 60', (result.parents[4] / 'scene.py').read_text())
        command = start.process.command
        self.assertEqual(command[command.index('--resolution') + 1], '1920,1080')
        self.assertIn('--transparent', command)

    def test_progress_reports_preparation_then_finished_segments(self):
        self.project['scene']['animations'] = [{'kind': 'write', 'targetId': 'equation-1', 'startMs': 0, 'durationMs': 1000}]
        events = []
        with tempfile.TemporaryDirectory() as directory, patch(POPEN, manim(ticks=2)):
            render_project(self.project, Path(directory), on_progress=lambda phase, done: events.append((phase, round(done, 3))))
        # The Write is 15 of 45 grid frames; the closing wait is the second segment.
        self.assertEqual(events, [('rendering', 0.0), ('rendering', 0.333)])

    def test_a_segment_counts_once_its_successor_starts(self):
        self.assertEqual(rendered_fraction([15, 75], 0), 0)
        self.assertEqual(rendered_fraction([15, 75], 1), 0)
        self.assertEqual(rendered_fraction([15, 75], 2), 15 / 90)
        self.assertEqual(rendered_fraction([], 3), 0)


if __name__ == '__main__':
    unittest.main()
