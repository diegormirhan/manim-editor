import unittest

from renderer.manim_renderer.render_options import resolve_options, workload


class RenderOptionsTests(unittest.TestCase):
    def test_no_options_mean_the_draft_preview(self):
        self.assertEqual(resolve_options(None), {"width": 854, "height": 480, "fps": 15, "format": "mp4", "transparent": False})

    def test_a_preset_resolves_to_pixels_a_rate_and_a_container(self):
        self.assertEqual(
            resolve_options({"resolution": "2160p", "fps": 60, "format": "mov", "transparent": True}),
            {"width": 3840, "height": 2160, "fps": 60, "format": "mov", "transparent": True},
        )
        self.assertEqual(resolve_options({"resolution": "720p", "fps": 30})["width"], 1280)

    def test_transparency_needs_a_container_with_alpha(self):
        self.assertTrue(resolve_options({"format": "webm", "transparent": True})["transparent"])
        for container in ("mp4", "gif"):
            with self.assertRaises(ValueError):
                resolve_options({"format": container, "transparent": True})

    def test_anything_outside_the_contract_is_rejected(self):
        for bad in ({"resolution": "8k"}, {"fps": 24}, {"fps": 30.0}, {"fps": True}, {"format": "avi"},
                    {"transparent": "yes"}, {"resolution": "720p", "codec": "x"}, "720p", ["720p"]):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                resolve_options(bad)

    def test_a_preview_is_an_opaque_mp4_at_a_preview_size(self):
        self.assertEqual(resolve_options({"resolution": "1080p", "fps": 30}, preview=True)["height"], 1080)
        for bad in ({"resolution": "2160p"}, {"format": "webm"}, {"format": "mov", "transparent": True}):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                resolve_options(bad, preview=True)

    def test_workload_grows_with_pixels_and_frames(self):
        self.assertEqual(workload(resolve_options(None)), 1)
        self.assertEqual(workload(resolve_options({"resolution": "1080p", "fps": 60})), 1920 * 1080 * 60 / (854 * 480 * 15))
