from .graphs import compile_axes, compile_function_graph


def compile_text(element, variable):
    constructor, content = ("MathTex", element["latex"]) if element["kind"] == "mathTex" else ("Text", element["text"])
    return [f"{variable} = {constructor}({content!r}, font_size={element.get('fontSize', 48)!r})",
            f"{variable}.move_to({element['position']!r})"]


def compile_shape(element, variable):
    kind = element["kind"]
    if kind in ("line", "arrow"):
        constructor = "Line" if kind == "line" else "Arrow"
        return [f"{variable} = {constructor}(start={element['position']!r}, end={element['end']!r}, buff=0)"]
    if kind == "circle":
        expression = f"Circle(radius={element['radius']!r})"
    elif kind == "dot":
        expression = f"Dot(radius={element['radius']!r})"
    elif kind == "rectangle":
        expression = f"Rectangle(width={element['width']!r}, height={element['height']!r})"
    elif kind == "square":
        expression = f"Square(side_length={element['size']!r})"
    else:
        expression = f"Triangle().scale({element['size']!r} / 2)"
    return [f"{variable} = {expression}", f"{variable}.move_to({element['position']!r})"]


COMPILERS = {
    "mathTex": compile_text, "text": compile_text,
    **dict.fromkeys(("circle", "rectangle", "line", "arrow", "dot", "square", "triangle"), compile_shape),
    "axes": compile_axes, "numberPlane": compile_axes,
}


def compile_element(element, variable, variables=None):
    if element["kind"] == "functionGraph":
        statements = compile_function_graph(element, variable, (variables or {}).get(element.get("axesId")))
    else:
        statements = COMPILERS[element["kind"]](element, variable)
    if "color" in element:
        statements.append(f"{variable}.set_color({element['color']!r})")
    if element.get("scale", 1) != 1:
        statements.append(f"{variable}.scale({element['scale']!r})")
    return statements
