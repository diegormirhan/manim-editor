import base64
import io
import unittest

from PIL import Image

from renderer.manim_renderer.live_frame import answer


def circle_drawn_over_one_second() -> dict:
    return {"schemaVersion": 1, "name": "Live", "scene": {"durationMs": 2000, "elements": {
        "ring": {"kind": "circle", "position": [0, 0, 0], "appearsAtMs": 0, "radius": 2, "color": "#FFFFFF"},
    }, "animations": [{"kind": "create", "targetId": "ring", "startMs": 0, "durationMs": 1000}]}}


def lit_pixels(reply: dict) -> int:
    image = Image.open(io.BytesIO(base64.b64decode(reply["frame"]))).convert("L")
    return sum(1 for value in image.getdata() if value > 60)


class LiveFrameTests(unittest.TestCase):
    def test_a_frame_shows_the_scene_at_that_moment(self):
        project = circle_drawn_over_one_second()
        before, halfway, after = (lit_pixels(answer({"project": project, "timeMs": ms})) for ms in (0, 500, 1500))
        self.assertLess(before, halfway)
        self.assertLess(halfway, after)

    def test_an_element_shows_only_between_its_entry_and_exit_during_another_animation(self):
        project = circle_drawn_over_one_second()
        project["scene"]["elements"]["spot"] = {"kind": "circle", "radius": 0.5, "position": [5, 0, 0], "appearsAtMs": 300,
                                                "disappearsAtMs": 700, "color": "#FFFFFF"}

        def right_side(ms: int) -> int:
            image = Image.open(io.BytesIO(base64.b64decode(answer({"project": project, "timeMs": ms})["frame"]))).convert("L")
            width, height = image.size
            return sum(1 for value in image.crop((width * 3 // 4, 0, width, height)).getdata() if value > 60)

        self.assertEqual(right_side(200), 0)
        self.assertGreater(right_side(500), 0)
        self.assertEqual(right_side(800), 0)

    def test_a_frame_says_where_each_element_on_screen_sits(self):
        project = circle_drawn_over_one_second()
        project["scene"]["elements"]["spot"] = {"kind": "circle", "radius": 0.5, "position": [5, 1, 0], "appearsAtMs": 300,
                                                "disappearsAtMs": 700, "color": "#FFFFFF"}
        before, during = (answer({"project": project, "timeMs": ms})["boxes"] for ms in (200, 1500))
        self.assertNotIn("spot", before)
        self.assertNotIn("spot", during)
        boxes = answer({"project": project, "timeMs": 500})["boxes"]
        # [left, bottom, right, top] in scene units.
        for actual, expected in zip(boxes["spot"], [4.5, 0.5, 5.5, 1.5]):
            self.assertAlmostEqual(actual, expected, places=2)
        for actual, expected in zip(during["ring"], [-2, -2, 2, 2]):
            self.assertAlmostEqual(actual, expected, places=2)

    def test_a_broken_request_explains_itself_instead_of_stopping_the_worker(self):
        reply = answer({"project": {"schemaVersion": 1, "name": "Broken"}, "timeMs": 0})
        self.assertIn("error", reply)
        self.assertNotIn("frame", reply)


if __name__ == "__main__":
    unittest.main()
