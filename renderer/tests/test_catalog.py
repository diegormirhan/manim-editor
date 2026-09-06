import ast
import copy
import unittest

from renderer.manim_renderer.project import validate_project
from renderer.manim_renderer.scene_compiler import compile_project


def sample():
    return {"schemaVersion": 1, "name": "Catalog", "scene": {
        "durationMs": 6000,
        "elements": {"a": {"kind": "circle", "radius": 1, "position": [0, 0, 0], "appearsAtMs": 0}},
        "animations": [{"kind": "create", "targetId": "a", "startMs": 0, "durationMs": 1000}],
    }}


class CatalogTests(unittest.TestCase):
    def test_every_element_compiles_to_valid_python(self):
        for properties in [dict(kind="text", text="A 'quote'\nOlá"), dict(kind="circle", radius=1),
                           dict(kind="rectangle", width=2, height=1), dict(kind="line", end=[2, 1, 0]),
                           dict(kind="arrow", end=[2, 1, 0])]:
            with self.subTest(kind=properties["kind"]):
                p = sample()
                p["scene"]["elements"]["a"] = {**properties, "position": [0, 0, 0], "appearsAtMs": 0}
                ast.parse(compile_project(p))

    def test_entrance_replaces_static_add_and_move_and_exit_compile(self):
        p = sample()
        p["scene"]["animations"] += [
            dict(kind="moveTo", targetId="a", startMs=1500, durationMs=1000, destination=[2, 0, 0]),
            dict(kind="fadeOut", targetId="a", startMs=3000, durationMs=1000)]
        original = copy.deepcopy(p)
        source = compile_project(p)
        self.assertNotIn("self.add(element_0)", source)
        self.assertIn("Create(element_0)", source)
        self.assertIn("element_0.animate.move_to([2, 0, 0])", source)
        self.assertIn("FadeOut(element_0)", source)
        self.assertEqual(p, original)

    def test_rejects_invalid_animation_lifecycles(self):
        for clip in [dict(kind="moveTo", targetId="missing", startMs=1000, durationMs=1000, destination=[0, 0, 0]),
                     dict(kind="fadeOut", targetId="a", startMs=500, durationMs=1000),
                     dict(kind="write", targetId="a", startMs=2000, durationMs=1000),
                     dict(kind="fadeOut", targetId="a", startMs=5500, durationMs=1000)]:
            p = sample()
            p["scene"]["animations"].append(clip)
            with self.subTest(clip=clip), self.assertRaises(ValueError):
                validate_project(p)

    def test_rejects_static_appearance_inside_animation(self):
        p = sample()
        p["scene"]["elements"]["b"] = {**p["scene"]["elements"]["a"], "appearsAtMs": 500}
        with self.assertRaises(ValueError):
            validate_project(p)

    def test_rejects_animation_after_exit(self):
        p = sample()
        p["scene"]["animations"] += [dict(kind="fadeOut", targetId="a", startMs=1000, durationMs=500),
            dict(kind="moveTo", targetId="a", startMs=2000, durationMs=1000, destination=[1, 0, 0])]
        with self.assertRaises(ValueError):
            validate_project(p)

    def test_restricted_function_graph_never_emits_user_python(self):
        p = sample()
        p["scene"]["elements"]["a"] = {"kind": "functionGraph", "expression": "sin(x)", "xRange": [-4, 4],
                                          "position": [0, 0, 0], "appearsAtMs": 0}
        source = compile_project(p)
        ast.parse(source)
        self.assertIn("np.sin(x)", source)
        p["scene"]["elements"]["a"]["expression"] = "__import__('os')"
        with self.assertRaises(ValueError):
            compile_project(p)

    def test_transform_uses_hidden_destination_definition(self):
        p = sample()
        p["scene"]["elements"]["b"] = {"kind": "circle", "radius": 2, "position": [1, 0, 0], "appearsAtMs": 0}
        p["scene"]["animations"] = [
            {"kind": "transform", "targetId": "a", "destinationId": "b", "startMs": 0, "durationMs": 1000}
        ]
        source = compile_project(p)
        self.assertIn("Transform(element_0, element_1)", source)

    def test_parallel_group_compiles_as_explicit_animation_group(self):
        p = sample()
        p["scene"]["elements"]["b"] = {"kind": "circle", "radius": 1, "position": [1, 0, 0], "appearsAtMs": 0}
        p["scene"]["animations"] = [{"kind": "parallel", "startMs": 0, "durationMs": 1000, "clips": [
            {"kind": "create", "targetId": "a", "startMs": 0, "durationMs": 1000},
            {"kind": "fadeIn", "targetId": "b", "startMs": 0, "durationMs": 1000}]}]
        self.assertIn("AnimationGroup(Create(element_0), FadeIn(element_1), lag_ratio=0)", compile_project(p))
