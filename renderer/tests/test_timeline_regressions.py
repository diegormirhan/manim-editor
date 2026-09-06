import unittest
from renderer.manim_renderer.project import validate_project
from renderer.manim_renderer.scene_compiler import compile_project


def scene():
    return {"schemaVersion": 1, "name": "Regression", "scene": {"durationMs": 6000, "elements": {
        "a": {"kind": "circle", "radius": 1, "position": [0, 0, 0], "appearsAtMs": 0},
        "b": {"kind": "circle", "radius": 2, "position": [2, 0, 0], "appearsAtMs": 0},
    }, "animations": []}}


class TimelineRegressions(unittest.TestCase):
    def test_transform_destination_is_hidden_and_source_is_replaced(self):
        p = scene()
        p["scene"]["animations"] = [dict(kind="transform", targetId="a", destinationId="b", startMs=1000, durationMs=1000)]
        source = compile_project(p)
        self.assertNotIn("self.add(element_1)", source)
        self.assertIn("ReplacementTransform(element_0, element_1)", source)
        p["scene"]["animations"].append(dict(kind="fadeOut", targetId="a", startMs=3000, durationMs=1000))
        with self.assertRaises(ValueError): validate_project(p)
        p["scene"]["animations"][-1]["targetId"] = "b"
        validate_project(p)

    def test_parallel_entrances_are_not_added_before_play(self):
        p = scene()
        p["scene"]["animations"] = [dict(kind="parallel", startMs=0, durationMs=1000, clips=[
            dict(kind="create", targetId="a", startMs=0, durationMs=1000),
            dict(kind="fadeIn", targetId="b", startMs=0, durationMs=1000)])]
        source = compile_project(p)
        self.assertNotIn("self.add(", source)
        p["scene"]["animations"][0]["clips"][1]["targetId"] = "a"
        with self.assertRaises(ValueError): validate_project(p)

    def test_parallel_cannot_bypass_overlap_or_lifecycle(self):
        p = scene()
        p["scene"]["animations"] = [dict(kind="fadeOut", targetId="a", startMs=0, durationMs=1000),
            dict(kind="parallel", startMs=500, durationMs=1000, clips=[
                dict(kind="fadeOut", targetId="b", startMs=500, durationMs=1000),
                dict(kind="moveTo", targetId="a", startMs=500, durationMs=1000, destination=[1, 0, 0])])]
        with self.assertRaises(ValueError): validate_project(p)
        for item in [p["scene"]["animations"][1], *p["scene"]["animations"][1]["clips"]]: item["startMs"] = 2000
        with self.assertRaises(ValueError): validate_project(p)

    def test_element_end_is_compiled_and_cannot_cut_an_animation(self):
        p = scene()
        p["scene"]["elements"]["a"]["disappearsAtMs"] = 2000
        self.assertIn("self.remove(element_0)", compile_project(p))
        p["scene"]["animations"] = [dict(kind="moveTo", targetId="a", startMs=1500, durationMs=1000, destination=[1, 0, 0])]
        with self.assertRaises(ValueError): validate_project(p)

    def test_graph_function_is_callable_and_origin_is_not_recentered(self):
        p = scene()
        p["scene"]["elements"] = {"g": dict(kind="functionGraph", expression="sin(x)", xRange=[-2, 2], position=[0, 0, 0], appearsAtMs=0)}
        source = compile_project(p)
        self.assertIn("lambda x: np.sin(x)", source)
        self.assertNotIn(".move_to(", source)
        p["scene"]["elements"]["g"]["expression"] = "sqrt(x)"
        with self.assertRaises(ValueError): validate_project(p)
