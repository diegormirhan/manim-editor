import ast
import json
import math
from pathlib import Path
import unittest

from renderer.manim_renderer.elements.expressions import (
    PRESETS, ExpressionError, check_expression, compile_expression, evaluate, parse,
)

ROOT = Path(__file__).resolve().parents[2]
CASES = json.loads((ROOT / "contracts/expression-cases.json").read_text(encoding="utf-8"))


class ExpressionTests(unittest.TestCase):
    def test_shared_fixtures_compile_to_the_agreed_python(self):
        for case in CASES["valid"]:
            with self.subTest(text=case["text"]):
                self.assertEqual(compile_expression(case["text"]), case["python"])

    def test_generated_python_only_uses_approved_names(self):
        approved = {"x", "np"}
        for case in CASES["valid"]:
            tree = ast.parse(case["python"], mode="eval")
            names = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
            self.assertLessEqual(names, approved, case["text"])

    def test_rejected_fixtures_report_a_column(self):
        for text in CASES["rejected"]:
            with self.subTest(text=text), self.assertRaises(ExpressionError) as caught:
                parse(text)
            self.assertGreater(caught.exception.column, 0)

    def test_domain_fixtures_agree_on_where_the_curve_is_defined(self):
        for case in CASES["domains"]:
            with self.subTest(text=case["text"], x_range=case["xRange"]):
                if case["defined"]:
                    check_expression(case["text"], case["xRange"])
                else:
                    with self.assertRaises(ValueError):
                        check_expression(case["text"], case["xRange"])

    def test_presets_stay_inside_the_grammar(self):
        for text in PRESETS:
            with self.subTest(text=text):
                compile_expression(text)

    def test_precedence_and_associativity(self):
        at = lambda text, x: evaluate(parse(text), x)
        self.assertEqual(at("1 + 2*3", 0), 7)
        self.assertEqual(at("2^3^2", 0), 512)
        self.assertEqual(at("-x^2", 3), -9)
        self.assertEqual(at("(-x)^2", 3), 9)
        self.assertEqual(at("2x", 4), 8)
        self.assertEqual(at("10 - 3 - 2", 0), 5)

    def test_undefined_values_become_nan_instead_of_raising(self):
        self.assertTrue(math.isnan(evaluate(parse("1/x"), 0)))
        self.assertTrue(math.isnan(evaluate(parse("sqrt(x)"), -1)))
        self.assertTrue(math.isnan(evaluate(parse("x^0.5"), -4)))


if __name__ == "__main__":
    unittest.main()
