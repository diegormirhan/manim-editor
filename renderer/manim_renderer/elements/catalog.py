from .graphs import compile_area, compile_axes, compile_function_graph


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
    elif kind == "ellipse":
        expression = f"Ellipse(width={element['width']!r}, height={element['height']!r})"
    elif kind == "square":
        expression = f"Square(side_length={element['size']!r})"
    elif kind == "regularPolygon":
        expression = f"RegularPolygon(n={element['sides']!r}, radius={element['size']!r} / 2)"
    elif kind == "arc":
        expression = (f"Arc(radius={element['radius']!r}, "
                      f"start_angle=np.deg2rad({element.get('startDegrees', 0)!r}), "
                      f"angle=np.deg2rad({element['angleDegrees']!r}))")
    else:
        expression = f"Triangle().scale({element['size']!r} / 2)"
    return [f"{variable} = {expression}", f"{variable}.move_to({element['position']!r})"]


SHAPES = ("circle", "rectangle", "ellipse", "line", "arrow", "dot", "square", "triangle", "regularPolygon", "arc")
COMPILERS = {
    "mathTex": compile_text, "text": compile_text,
    **dict.fromkeys(SHAPES, compile_shape),
    **dict.fromkeys(("axes", "numberPlane", "numberLine"), compile_axes),
}


def compile_element(element, variable, variables=None, elements=None):
    kind, names = element["kind"], variables or {}
    if kind == "functionGraph":
        statements = compile_function_graph(element, variable, names.get(element.get("axesId")))
    elif kind == "areaUnderGraph":
        graph = (elements or {})[element["graphId"]]
        statements = compile_area(element, variable, names[element["graphId"]], names[graph["axesId"]])
    else:
        statements = COMPILERS[kind](element, variable)
    if "color" in element:
        statements.append(f"{variable}.set_color({element['color']!r})")
    if element.get("scale", 1) != 1:
        statements.append(f"{variable}.scale({element['scale']!r})")
    if element.get("rotationDegrees", 0):
        statements.append(f"{variable}.rotate(np.deg2rad({element['rotationDegrees']!r}))")
    if element.get("opacity", 1) != 1:
        statements.append(f"{variable}.set_opacity({element['opacity']!r})")
    return statements
