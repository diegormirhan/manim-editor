import { expect, test } from "vitest";
import {
  EXPRESSION_PRESETS, ExpressionError, evaluate, expressionError, expressionWarning, parseExpression,
} from "./expression";
import cases from "../../contracts/expression-cases.json";

test("shared fixtures parse and the presets stay inside the grammar", () => {
  for (const { text } of cases.valid) expect(() => parseExpression(text), text).not.toThrow();
  for (const text of EXPRESSION_PRESETS) expect(() => parseExpression(text), text).not.toThrow();
});
test("rejected fixtures fail with a column so the field can point at them", () => {
  for (const text of cases.rejected) {
    let error: unknown;
    try {
      parseExpression(text);
    } catch (caught) {
      error = caught;
    }
    expect(error, JSON.stringify(text)).toBeInstanceOf(ExpressionError);
    expect((error as ExpressionError).column).toBeGreaterThan(0);
  }
});
test("domain fixtures agree on where the curve is defined", () => {
  for (const { text, xRange, defined } of cases.domains)
    expect(expressionError(text, xRange as [number, number]) === null, `${text} ${xRange}`).toBe(defined);
});
test("arithmetic follows mathematical precedence and associativity", () => {
  const at = (text: string, x: number) => evaluate(parseExpression(text), x);
  expect(at("1 + 2*3", 0)).toBe(7);
  expect(at("2^3^2", 0)).toBe(512);
  expect(at("-x^2", 3)).toBe(-9);
  expect(at("(-x)^2", 3)).toBe(9);
  expect(at("2x", 4)).toBe(8);
  expect(at("2(x + 1)", 4)).toBe(10);
  expect(at("10 - 3 - 2", 0)).toBe(5);
});
test("a valid but offscreen curve warns instead of blocking", () => {
  expect(expressionError("x^3", [-10, 10])).toBeNull();
  expect(expressionWarning("x^3", [-10, 10])).toContain("visible");
  expect(expressionWarning("sin(x)", [-6, 6])).toBeNull();
});
