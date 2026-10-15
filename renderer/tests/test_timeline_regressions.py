import unittest
from renderer.manim_renderer.project import validate_project
from renderer.manim_renderer.scene_compiler import compile_project, segment_frames


def scene():
    return {"schemaVersion": 1, "name": "Regression", "scene": {"durationMs": 6000, "elements": {
        "a": {"kind": "circle", "radius": 1, "position": [0, 0, 0], "appearsAtMs": 0},
        "b": {"kind": "circle", "radius": 2, "position": [2, 0, 0], "appearsAtMs": 0},
    }, "animations": []}}


class TimelineRegressions(unittest.TestCase):
    def test_elements_enter_and_leave_in_the_middle_of_another_animation(self):
        p = scene()
        p["scene"]["animations"] = [dict(kind="indicate", targetId="a", startMs=1000, durationMs=2000)]
        p["scene"]["elements"]["b"].update(appearsAtMs=1400, disappearsAtMs=2600)
        source = compile_project(p)
        # 1.4 s is 6 frames into the 30-frame Indicate, and 2.6 s is 24.
        self.assertIn("self.play(Indicate(element_0), at(6 / 30, Add(element_1)), at(24 / 30, Remove(element_1)), "
                      "run_time=(30 - 1e-6) / 15)", source)
        self.assertIn("class Remove(Add):", source)
        # Changes inside a play add no segment of their own.
        self.assertEqual(segment_frames(p), [15, 30, 45])
        self.assertNotIn("class Remove", compile_project(scene()))

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

    def test_higher_layers_draw_on_top(self):
        p = scene()
        p["scene"]["elements"]["a"]["layer"] = 3
        p["scene"]["elements"]["b"]["layer"] = 0
        source = compile_project(p)
        self.assertIn("element_0.set_z_index(3)", source)
        self.assertNotIn("element_1.set_z_index", source)
        # Files from before layers keep their element order as layers.
        del p["scene"]["elements"]["a"]["layer"], p["scene"]["elements"]["b"]["layer"]
        self.assertIn("element_1.set_z_index(1)", compile_project(p))

    def test_objects_on_one_layer_take_turns(self):
        p = scene()
        p["scene"]["elements"]["a"].update(layer=0, disappearsAtMs=3000)
        p["scene"]["elements"]["b"].update(layer=0, appearsAtMs=2000)
        with self.assertRaisesRegex(ValueError, "layer 1"):
            validate_project(p)
        p["scene"]["elements"]["b"]["appearsAtMs"] = 3000
        validate_project(p)

    def test_animations_of_different_objects_overlap_freely(self):
        p = scene()
        p["scene"]["elements"]["b"]["appearsAtMs"] = 500
        p["scene"]["animations"] = [
            dict(kind="indicate", targetId="a", startMs=0, durationMs=2000),
            dict(kind="create", targetId="b", startMs=500, durationMs=1000),
            dict(kind="moveTo", targetId="b", startMs=1500, durationMs=1000, destination=[1, 0, 0])]
        source = compile_project(p)
        # One play covers the chain; each animation runs in its own share of it.
        self.assertIn("self.play(between(0 / 38, 30 / 38, Indicate(element_0)), between(8 / 38, 23 / 38, Create(element_1)), "
                      "between(23 / 38, 38 / 38, element_1.animate.move_to([1, 0, 0]), entering=True), "
                      "run_time=(38 - 1e-6) / 15)", source)
        self.assertEqual(segment_frames(p), [38, 52])
        p["scene"]["animations"][2]["startMs"] = 1000
        with self.assertRaisesRegex(ValueError, "one animation at a time"):
            validate_project(p)

    def test_a_transform_hands_over_before_the_play_ends(self):
        p = scene()
        p["scene"]["elements"]["c"] = {"kind": "dot", "radius": 0.1, "position": [-3, 0, 0], "appearsAtMs": 0}
        p["scene"]["animations"] = [
            dict(kind="transform", targetId="a", destinationId="b", startMs=0, durationMs=1000),
            dict(kind="wiggle", targetId="c", startMs=500, durationMs=2000),
            dict(kind="indicate", targetId="b", startMs=1000, durationMs=1000)]
        source = compile_project(p)
        self.assertIn("between(0 / 38, 15 / 38, Transform(element_0, element_1))", source)
        self.assertIn("at(15 / 38, Replace(element_0, element_1))", source)
        self.assertIn("between(15 / 38, 30 / 38, Indicate(element_1), entering=True)", source)

    def test_the_output_rate_is_configurable_while_timing_stays_on_the_grid(self):
        p = scene()
        p["scene"]["animations"] = [dict(kind="fadeIn", targetId="a", startMs=0, durationMs=1000)]
        source = compile_project(p, fps=60)
        self.assertIn("config.frame_rate = 60", source)
        # Waits and run times still count 15 fps grid frames, which 60 fps divides exactly.
        self.assertIn("run_time=(15 - 1e-6) / 15", source)
        self.assertEqual(segment_frames(p), [15, 75])

    def test_the_scene_background_is_written_only_when_chosen(self):
        p = scene()
        self.assertNotIn("background_color", compile_project(p))
        p["scene"]["background"] = "#FFFFFF"
        self.assertIn('config.background_color = "#FFFFFF"', compile_project(p))

    def test_parallel_entrances_are_not_added_before_play(self):
        p = scene()
        p["scene"]["animations"] = [dict(kind="parallel", startMs=0, durationMs=1000, clips=[
            dict(kind="create", targetId="a", startMs=0, durationMs=1000),
            dict(kind="fadeIn", targetId="b", startMs=0, durationMs=1000)])]
        source = compile_project(p)
        self.assertNotIn("self.add(", source)
        p["scene"]["animations"][0]["clips"][1]["targetId"] = "a"
        with self.assertRaises(ValueError): validate_project(p)

    def test_parallel_cannot_bypass_lifecycle(self):
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
