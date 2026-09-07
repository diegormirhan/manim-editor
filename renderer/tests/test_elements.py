import ast
import json
from pathlib import Path
import unittest

from renderer.manim_renderer.project import validate_project
from renderer.manim_renderer.scene_compiler import compile_project
from renderer.manim_renderer.timeline import ANIMATION_CLASSES, CLIP_FIELDS

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "contracts/project.schema.json").read_text(encoding="utf-8"))
CONTRACT_KINDS = [key for key in SCHEMA["$defs"] if key != "animation"]

NEW_ELEMENTS = {
    "ellipse": dict(width=3, height=2),
    "regularPolygon": dict(sides=6, size=2),
    "arc": dict(radius=1.5, angleDegrees=180, startDegrees=30),
    "numberLine": dict(xRange=[-4, 4], includeNumbers=True),
}
EXPECTED_CONSTRUCTORS = {
    "ellipse": "Ellipse(width=3, height=2)",
    "regularPolygon": "RegularPolygon(n=6, radius=2 / 2)",
    "arc": "Arc(radius=1.5, start_angle=np.deg2rad(30), angle=np.deg2rad(180))",
    "numberLine": "NumberLine(x_range=[-4, 4], length=8, include_numbers=True)",
}


def sample(element):
    return {"schemaVersion": 1, "name": "Elements", "scene": {
        "durationMs": 4000,
        "elements": {"a": {"position": [0, 0, 0], "appearsAtMs": 0, **element}},
    }}


def graph_scene():
    return {"schemaVersion": 1, "name": "Area", "scene": {"durationMs": 4000, "elements": {
        "axes": {"kind": "axes", "position": [0, 0, 0], "appearsAtMs": 0, "xRange": [-4, 4], "yRange": [-2, 6]},
        "graph": {"kind": "functionGraph", "position": [0, 0, 0], "appearsAtMs": 0,
                  "expression": "x^2", "xRange": [-2, 2], "axesId": "axes"},
        "area": {"kind": "areaUnderGraph", "position": [0, 0, 0], "appearsAtMs": 0,
                 "graphId": "graph", "xRange": [0, 2], "opacity": 0.4},
    }}}


class ElementTests(unittest.TestCase):
    def test_every_contract_kind_has_a_compiler(self):
        compiled = set()
        for kind in CONTRACT_KINDS:
            if kind in ("functionGraph", "areaUnderGraph"):
                compiled.add(kind)
                continue
            source = compile_project(sample({"kind": kind, **NEW_ELEMENTS.get(kind, {}), **{
                "mathTex": dict(latex="x^2"), "text": dict(text="Olá"), "circle": dict(radius=1),
                "dot": dict(radius=0.1), "rectangle": dict(width=2, height=1), "square": dict(size=2),
                "triangle": dict(size=2), "line": dict(end=[2, 1, 0]), "arrow": dict(end=[2, 1, 0]),
                "axes": dict(xRange=[-3, 3], yRange=[-2, 2]), "numberPlane": dict(xRange=[-3, 3], yRange=[-2, 2]),
            }.get(kind, {})}))
            ast.parse(source)
            compiled.add(kind)
        self.assertEqual(compiled, set(CONTRACT_KINDS))

    def test_new_shapes_use_their_manim_constructors(self):
        for kind, properties in NEW_ELEMENTS.items():
            with self.subTest(kind=kind):
                source = compile_project(sample({"kind": kind, **properties}))
                self.assertIn(EXPECTED_CONSTRUCTORS[kind], source)

    def test_rotation_and_opacity_are_emitted_only_when_they_change_the_object(self):
        plain = compile_project(sample({"kind": "circle", "radius": 1}))
        self.assertNotIn(".rotate(", plain)
        self.assertNotIn(".set_opacity(", plain)
        styled = compile_project(sample({"kind": "circle", "radius": 1, "rotationDegrees": 45, "opacity": 0.5}))
        self.assertIn("element_0.rotate(np.deg2rad(45))", styled)
        self.assertIn("element_0.set_opacity(0.5)", styled)

    def test_area_compiles_after_its_graph_and_axes(self):
        source = compile_project(graph_scene())
        names = {"axes": "element_1", "graph": "element_2", "area": "element_0"}
        self.assertIn(f"{names['area']} = {names['axes']}.get_area({names['graph']}, x_range=[0, 2])", source)
        self.assertLess(source.index(f"{names['graph']} = "), source.index(".get_area("))

    def test_area_requires_a_linked_graph_inside_its_range(self):
        project = graph_scene()
        del project["scene"]["elements"]["graph"]["axesId"]
        with self.assertRaisesRegex(ValueError, "axes"):
            validate_project(project)
        project = graph_scene()
        project["scene"]["elements"]["area"]["xRange"] = [-3, 2]
        with self.assertRaisesRegex(ValueError, "range"):
            validate_project(project)


class AnimationTests(unittest.TestCase):
    def scene(self, clip):
        return {"schemaVersion": 1, "name": "Animations", "scene": {"durationMs": 6000, "elements": {
            "a": {"kind": "circle", "radius": 1, "position": [0, 0, 0], "appearsAtMs": 0},
        }, "animations": [clip]}}

    def test_every_contract_animation_kind_compiles(self):
        kinds = set(SCHEMA["$defs"]["animation"]["properties"]["kind"]["enum"])
        self.assertEqual(kinds - {"parallel"}, set(ANIMATION_CLASSES) | set(CLIP_FIELDS))
        extras = {"moveTo": dict(destination=[1, 0, 0]), "rotate": dict(degrees=90),
                  "scaleTo": dict(factor=2), "recolor": dict(color="#ff0000")}
        for kind in kinds - {"parallel", "transform"}:
            with self.subTest(kind=kind):
                start = 0 if kind in ("create", "write", "fadeIn", "grow", "drawBorder") else 1000
                source = compile_project(self.scene(
                    dict(kind=kind, targetId="a", startMs=start, durationMs=1000, **extras.get(kind, {}))))
                ast.parse(source)

    def test_motion_clips_emit_their_manim_call(self):
        for clip, expected in [
            (dict(kind="rotate", degrees=90), "Rotate(element_0, angle=np.deg2rad(90))"),
            (dict(kind="scaleTo", factor=2), "element_0.animate.scale(2)"),
            (dict(kind="recolor", color="#ff0000"), "element_0.animate.set_color('#ff0000')"),
            (dict(kind="grow"), "GrowFromCenter(element_0)"),
            (dict(kind="drawBorder"), "DrawBorderThenFill(element_0)"),
            (dict(kind="indicate"), "Indicate(element_0)"),
            (dict(kind="wiggle"), "Wiggle(element_0)"),
        ]:
            with self.subTest(kind=clip["kind"]):
                start = 0 if clip["kind"] in ("grow", "drawBorder") else 1000
                source = compile_project(self.scene({**clip, "targetId": "a", "startMs": start, "durationMs": 1000}))
                self.assertIn(expected, source)

    def test_extra_fields_belong_to_exactly_one_kind(self):
        for kind, field in CLIP_FIELDS.items():
            with self.subTest(kind=kind):
                # Transform names its missing destination through a dedicated message.
                expected = "destination" if kind == "transform" else field
                with self.assertRaisesRegex(ValueError, expected):
                    validate_project(self.scene(dict(kind=kind, targetId="a", startMs=1000, durationMs=1000)))
                with self.assertRaisesRegex(ValueError, field):
                    validate_project(self.scene(
                        dict(kind="fadeOut", targetId="a", startMs=1000, durationMs=1000, **{field: "x"})))


if __name__ == "__main__":
    unittest.main()
