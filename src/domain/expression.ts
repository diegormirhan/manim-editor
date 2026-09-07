// Restricted mathematical notation for function graphs. Mirrors
// renderer/manim_renderer/elements/expressions.py; contracts/expression-cases.json
// holds the fixtures both sides must agree on.

export type Node =
  | { tag: "num"; value: number }
  | { tag: "x" }
  | { tag: "const"; name: ConstantName }
  | { tag: "call"; name: FunctionName; argument: Node }
  | { tag: "neg"; operand: Node }
  | { tag: "bin"; operator: string; left: Node; right: Node };

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt,
  abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10,
};
const CONSTANTS = { pi: Math.PI, e: Math.E };
type FunctionName = keyof typeof FUNCTIONS;
type ConstantName = keyof typeof CONSTANTS;

export const EXPRESSION_PRESETS = [
  "x^2", "(x - 2)^2 + 1", "sin(x)", "cos(x)", "sqrt(x)", "x", "x^3", "1/x", "exp(x)", "ln(x)", "abs(x)",
];
const SAMPLES = 65;
const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z]+)|([-+*/^()]))/y;

type Token = { kind: "number" | "name" | "symbol" | "end"; value: string; column: number };

export class ExpressionError extends Error {
  constructor(message: string, readonly column: number) {
    super(`${message} (column ${column})`);
  }
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < text.length) {
    TOKEN.lastIndex = position;
    const match = TOKEN.exec(text);
    if (!match) throw new ExpressionError(`Unsupported symbol '${text[position]}'`, position + 1);
    const kind = match[1] !== undefined ? "number" : match[2] !== undefined ? "name" : "symbol";
    const value = match[1] ?? match[2] ?? match[3];
    tokens.push({ kind, value, column: match[0].length - value.length + position + 1 });
    position = TOKEN.lastIndex;
  }
  tokens.push({ kind: "end", value: "", column: text.length + 1 });
  return tokens;
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: Token[]) {}
  private get current() { return this.tokens[this.index]; }
  private take() { return this.tokens[this.index++]; }
  private accept(value: string) {
    if (this.current.kind === "symbol" && this.current.value === value) { this.index++; return true; }
    return false;
  }
  private expect(value: string) {
    if (!this.accept(value)) throw new ExpressionError(`Expected '${value}'`, this.current.column);
  }
  parse(): Node {
    const node = this.sum();
    if (this.current.kind !== "end") throw new ExpressionError("Unexpected content after the expression", this.current.column);
    return node;
  }
  private sum(): Node {
    let node = this.product();
    while (this.current.kind === "symbol" && "+-".includes(this.current.value))
      node = { tag: "bin", operator: this.take().value, left: node, right: this.product() };
    return node;
  }
  private product(): Node {
    let node = this.unary();
    for (;;) {
      if (this.current.kind === "symbol" && "*/".includes(this.current.value))
        node = { tag: "bin", operator: this.take().value, left: node, right: this.unary() };
      // Implicit multiplication keeps `2x` and `3(x + 1)` readable.
      else if (this.startsFactor()) node = { tag: "bin", operator: "*", left: node, right: this.unary() };
      else return node;
    }
  }
  private startsFactor() {
    const { kind, value } = this.current;
    return kind === "number" || kind === "name" || (kind === "symbol" && value === "(");
  }
  private unary(): Node {
    if (this.accept("-")) return { tag: "neg", operand: this.unary() };
    this.accept("+");
    return this.power();
  }
  private power(): Node {
    const node = this.primary();
    return this.accept("^") ? { tag: "bin", operator: "^", left: node, right: this.unary() } : node;
  }
  private primary(): Node {
    const { kind, value, column } = this.take();
    if (kind === "number") return { tag: "num", value: Number(value) };
    if (kind === "symbol" && value === "(") {
      const node = this.sum();
      this.expect(")");
      return node;
    }
    if (kind === "name") {
      if (value === "x") return { tag: "x" };
      if (value in CONSTANTS) return { tag: "const", name: value as ConstantName };
      if (value in FUNCTIONS) {
        this.expect("(");
        const argument = this.sum();
        this.expect(")");
        return { tag: "call", name: value as FunctionName, argument };
      }
      throw new ExpressionError(`Unknown function or symbol '${value}'`, column);
    }
    throw new ExpressionError("Incomplete expression", column);
  }
}

export function parseExpression(text: string): Node {
  if (!text || !text.trim()) throw new ExpressionError("Enter an expression in x", 1);
  return new Parser(tokenize(text)).parse();
}

export function evaluate(node: Node, x: number): number {
  switch (node.tag) {
    case "num": return node.value;
    case "x": return x;
    case "const": return CONSTANTS[node.name];
    case "call": return FUNCTIONS[node.name](evaluate(node.argument, x));
    case "neg": return -evaluate(node.operand, x);
    default: {
      const left = evaluate(node.left, x), right = evaluate(node.right, x);
      if (node.operator === "+") return left + right;
      if (node.operator === "-") return left - right;
      if (node.operator === "*") return left * right;
      if (node.operator === "/") return left / right;
      return left ** right;
    }
  }
}

export function samples(node: Node, [low, high]: [number, number]): number[] {
  const step = (high - low) / (SAMPLES - 1);
  return Array.from({ length: SAMPLES }, (_, index) => evaluate(node, low + step * index));
}

/** Returns the reason the graph cannot be plotted, or null when it is valid. */
export function expressionError(text: string, xRange: [number, number]): string | null {
  let node: Node;
  try {
    node = parseExpression(text);
  } catch (error) {
    return error instanceof ExpressionError ? error.message : String(error);
  }
  return samples(node, xRange).some((value) => !Number.isFinite(value))
    ? `The function '${text}' is not defined throughout the selected X range.`
    : null;
}

/** Non-blocking hint: the curve is valid but leaves the visible camera area. */
export function expressionWarning(text: string, xRange: [number, number], limit = 4.5): string | null {
  try {
    const values = samples(parseExpression(text), xRange);
    return values.some((value) => Math.abs(value) > limit)
      ? "The curve extends beyond the visible area. Reduce the X range or link it to smaller axes."
      : null;
  } catch {
    return null;
  }
}
