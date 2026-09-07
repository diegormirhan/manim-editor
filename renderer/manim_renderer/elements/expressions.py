"""Restricted mathematical notation for function graphs.

Input is parsed into a closed node vocabulary; generated Python is rebuilt from
that vocabulary, so no user text ever reaches the emitted source.
"""

import math
import re

FUNCTIONS = {
    "sin": ("np.sin", math.sin),
    "cos": ("np.cos", math.cos),
    "tan": ("np.tan", math.tan),
    "sqrt": ("np.sqrt", math.sqrt),
    "abs": ("np.abs", abs),
    "exp": ("np.exp", math.exp),
    "ln": ("np.log", math.log),
    "log": ("np.log10", math.log10),
}
CONSTANTS = {"pi": ("np.pi", math.pi), "e": ("np.e", math.e)}
OPERATORS = {"+": "+", "-": "-", "*": "*", "/": "/", "^": "**"}
PRESETS = ("x^2", "(x - 2)^2 + 1", "sin(x)", "cos(x)", "sqrt(x)", "x", "x^3", "1/x", "exp(x)", "ln(x)", "abs(x)")
SAMPLES = 65

TOKEN = re.compile(r"\s*(?:(?P<number>\d+(?:\.\d+)?|\.\d+)|(?P<name>[A-Za-z]+)|(?P<symbol>[-+*/^()]))")


class ExpressionError(ValueError):
    """Carries the 1-based column so the inspector can point at the input."""

    def __init__(self, message, column):
        super().__init__(f"{message} (column {column})")
        self.column = column


def tokenize(text):
    tokens, position = [], 0
    while position < len(text):
        match = TOKEN.match(text, position)
        if not match:
            raise ExpressionError(f"Unsupported symbol {text[position]!r}", position + 1)
        kind = match.lastgroup
        tokens.append((kind, match.group(kind), match.start(kind) + 1))
        position = match.end()
    tokens.append(("end", "", len(text) + 1))
    return tokens


class Parser:
    def __init__(self, text):
        self.tokens = tokenize(text)
        self.index = 0

    @property
    def current(self):
        return self.tokens[self.index]

    def take(self):
        token = self.current
        self.index += 1
        return token

    def accept(self, value):
        if self.current[0] == "symbol" and self.current[1] == value:
            self.index += 1
            return True
        return False

    def expect(self, value):
        if not self.accept(value):
            raise ExpressionError(f"Expected {value!r}", self.current[2])

    def parse(self):
        node = self.sum()
        if self.current[0] != "end":
            raise ExpressionError("Unexpected content after the expression", self.current[2])
        return node

    def sum(self):
        node = self.product()
        while self.current[0] == "symbol" and self.current[1] in "+-":
            node = ("bin", self.take()[1], node, self.product())
        return node

    def product(self):
        node = self.unary()
        while True:
            if self.current[0] == "symbol" and self.current[1] in "*/":
                node = ("bin", self.take()[1], node, self.unary())
            elif self.starts_factor():
                # Implicit multiplication keeps `2x` and `3(x + 1)` readable.
                node = ("bin", "*", node, self.unary())
            else:
                return node

    def starts_factor(self):
        kind, value, _ = self.current
        return kind in ("number", "name") or (kind == "symbol" and value == "(")

    def unary(self):
        if self.accept("-"):
            return ("neg", self.unary())
        self.accept("+")
        return self.power()

    def power(self):
        node = self.primary()
        if self.accept("^"):
            return ("bin", "^", node, self.unary())
        return node

    def primary(self):
        kind, value, column = self.take()
        if kind == "number":
            return ("num", float(value))
        if kind == "symbol" and value == "(":
            node = self.sum()
            self.expect(")")
            return node
        if kind == "name":
            if value == "x":
                return ("x",)
            if value in CONSTANTS:
                return ("const", value)
            if value in FUNCTIONS:
                self.expect("(")
                node = self.sum()
                self.expect(")")
                return ("call", value, node)
            raise ExpressionError(f"Unknown function or symbol {value!r}", column)
        raise ExpressionError("Incomplete expression", column)


def parse(text):
    if not text or not text.strip():
        raise ExpressionError("Enter an expression in x", 1)
    return Parser(text).parse()


def to_python(node):
    tag = node[0]
    if tag == "num":
        return repr(node[1])
    if tag == "x":
        return "x"
    if tag == "const":
        return CONSTANTS[node[1]][0]
    if tag == "call":
        return f"{FUNCTIONS[node[1]][0]}({to_python(node[2])})"
    if tag == "neg":
        return f"(-{to_python(node[1])})"
    return f"({to_python(node[2])} {OPERATORS[node[1]]} {to_python(node[3])})"


def evaluate(node, x):
    tag = node[0]
    try:
        if tag == "num":
            return node[1]
        if tag == "x":
            return x
        if tag == "const":
            return CONSTANTS[node[1]][1]
        if tag == "call":
            return float(FUNCTIONS[node[1]][1](evaluate(node[2], x)))
        if tag == "neg":
            return -evaluate(node[1], x)
        left, right = evaluate(node[2], x), evaluate(node[3], x)
        if node[1] == "+":
            return left + right
        if node[1] == "-":
            return left - right
        if node[1] == "*":
            return left * right
        if node[1] == "/":
            return left / right
        result = left ** right
        # Negative bases with fractional exponents are complex; treat as undefined.
        return math.nan if isinstance(result, complex) else float(result)
    except (ValueError, ZeroDivisionError, OverflowError):
        return math.nan


def samples(node, x_range):
    low, high = x_range
    step = (high - low) / (SAMPLES - 1)
    return [evaluate(node, low + step * index) for index in range(SAMPLES)]


def compile_expression(text):
    return to_python(parse(text))


def check_expression(text, x_range):
    """Raise when the graph would be undefined anywhere in the plotted range."""
    node = parse(text)
    if any(not math.isfinite(value) for value in samples(node, x_range)):
        raise ValueError(f"The function {text!r} is not defined throughout the selected X range.")
    return node
