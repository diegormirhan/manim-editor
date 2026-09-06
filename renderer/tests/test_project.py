import ast
import copy
import json
from pathlib import Path
import tempfile
import unittest

from renderer.manim_renderer.project import load_project, save_project, validate_project
from renderer.manim_renderer.scene_compiler import compile_project


ROOT = Path(__file__).resolve().parents[2]


class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.project = json.loads((ROOT / 'examples/equation.json').read_text())

    def test_save_and_load_preserve_project(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'project.json'
            save_project(self.project, path)
            self.assertEqual(load_project(path), self.project)

    def test_invalid_save_preserves_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'project.json'
            save_project(self.project, path)
            original = path.read_bytes()
            self.project['schemaVersion'] = 99
            with self.assertRaises(ValueError):
                save_project(self.project, path)
            self.assertEqual(path.read_bytes(), original)

    def test_rejects_unknown_fields_and_kinds(self):
        for key, value in [('kind', 'python'), ('code', 'print(1)')]:
            with self.subTest(key=key):
                project = copy.deepcopy(self.project)
                project['scene']['elements']['equation-1'][key] = value
                with self.assertRaises(ValueError):
                    validate_project(project)

    def test_rejects_appearance_after_scene(self):
        self.project['scene']['elements']['equation-1']['appearsAtMs'] = 9000
        with self.assertRaisesRegex(ValueError, 'equation-1'):
            compile_project(self.project)

    def test_compiler_is_deterministic_and_does_not_mutate(self):
        original = copy.deepcopy(self.project)
        first = compile_project(self.project)
        self.assertEqual(first, compile_project(self.project))
        self.assertEqual(original, self.project)
        ast.parse(first)
        self.assertIn('self.add(element_0)', first)
        self.assertNotIn('self.play', first)
        self.assertIn('self.wait((45 + 1e-6) / 15)', first)

    def test_latex_cannot_escape_python_literal(self):
        latex = '\"\n); __import__(\"os\").system(\"bad\") # \\alpha'
        self.project['scene']['elements']['equation-1']['latex'] = latex
        tree = ast.parse(compile_project(self.project))
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)]
        math_call = next(node for node in calls if isinstance(node.func, ast.Name) and node.func.id == 'MathTex')
        self.assertEqual(ast.literal_eval(math_call.args[0]), latex)
        self.assertFalse(any(isinstance(node.func, ast.Name) and node.func.id == '__import__' for node in calls))

    def test_appearance_times_are_sorted(self):
        elements = self.project['scene']['elements']
        elements['equation-1']['appearsAtMs'] = 2000
        elements['earlier'] = {**elements['equation-1'], 'appearsAtMs': 500}
        source = compile_project(self.project)
        self.assertLess(source.index('self.add(element_0)'), source.index('self.add(element_1)'))
        self.assertIn('self.wait((8 + 1e-6) / 15)', source)
        self.assertIn('self.wait((22 + 1e-6) / 15)', source)

    def test_rejects_nonfinite_numbers(self):
        self.project['scene']['elements']['equation-1']['position'][0] = float('nan')
        with self.assertRaises(ValueError):
            compile_project(self.project)


if __name__ == '__main__':
    unittest.main()
