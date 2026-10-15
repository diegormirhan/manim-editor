from .graphs import compile_area, compile_axes, compile_bar_chart, compile_function_graph

# Elements drawn from others compile after them: graphs read their axes, areas their graph, annotations their target.
DEPENDENCY_ORDER = {"functionGraph": 1, "areaUnderGraph": 2, "brace": 3, "surroundingRectangle": 3}
DIRECTIONS = {"down": "DOWN", "up": "UP", "left": "LEFT", "right": "RIGHT"}


def compile_text(element, variable):
    kind, size = element["kind"], f"font_size={element.get('fontSize', 48)!r}"
    if kind == "text":
        expression = f"Text({element['text']!r}, {size})"
    elif kind in ("mathTex", "tex"):
        expression = f"{'MathTex' if kind == 'mathTex' else 'Tex'}({element['latex']!r}, {size})"
    elif kind == "decimalNumber":
        expression = f"DecimalNumber({element['value']!r}, num_decimal_places={element.get('decimals', 2)!r}, {size})"
    elif kind == "bulletedList":
        expression = f"BulletedList({', '.join(repr(item) for item in element['items'])}, {size})"
    elif kind == "matrix":
        expression = f"Matrix({element['rows']!r})"
    else:
        expression = f"Code(code_string={element['code']!r}, language={element.get('language', 'python')!r})"
    return [f"{variable} = {expression}", f"{variable}.move_to({element['position']!r})"]


def compile_shape(element, variable):
    kind = element["kind"]
    if "end" in element:
        constructor = {"line": "Line", "dashedLine": "DashedLine", "arrow": "Arrow", "doubleArrow": "DoubleArrow"}[kind]
        return [f"{variable} = {constructor}(start={element['position']!r}, end={element['end']!r}, buff=0)"]
    if kind == "circle":
        expression = f"Circle(radius={element['radius']!r})"
    elif kind == "dot":
        expression = f"Dot(radius={element['radius']!r})"
    elif kind == "rectangle":
        expression = f"Rectangle(width={element['width']!r}, height={element['height']!r})"
    elif kind == "roundedRectangle":
        expression = (f"RoundedRectangle(corner_radius={element.get('cornerRadius', 0.5)!r}, "
                      f"width={element['width']!r}, height={element['height']!r})")
    elif kind == "ellipse":
        expression = f"Ellipse(width={element['width']!r}, height={element['height']!r})"
    elif kind == "square":
        expression = f"Square(side_length={element['size']!r})"
    elif kind == "regularPolygon":
        expression = f"RegularPolygon(n={element['sides']!r}, radius={element['size']!r} / 2)"
    elif kind == "star":
        expression = f"Star(n={element['points']!r}, outer_radius={element['radius']!r})"
    elif kind == "annulus":
        expression = f"Annulus(inner_radius={element['innerRadius']!r}, outer_radius={element['radius']!r})"
    elif kind in ("arc", "sector"):
        expression = (f"{'Arc' if kind == 'arc' else 'Sector'}(radius={element['radius']!r}, "
                      f"start_angle=np.deg2rad({element.get('startDegrees', 0)!r}), "
                      f"angle=np.deg2rad({element['angleDegrees']!r}))")
    else:
        expression = f"Triangle().scale({element['size']!r} / 2)"
    return [f"{variable} = {expression}", f"{variable}.move_to({element['position']!r})"]


def compile_annotation(element, variable, target):
    if element["kind"] == "surroundingRectangle":
        return [f"{variable} = SurroundingRectangle({target}, buff={element.get('buff', 0.1)!r})"]
    direction = DIRECTIONS[element.get("direction", "down")]
    if element.get("label"):
        return [f"{variable} = BraceLabel({target}, {element['label']!r}, brace_direction={direction})"]
    return [f"{variable} = Brace({target}, direction={direction})"]


SHAPES = ("circle", "rectangle", "roundedRectangle", "ellipse", "line", "dashedLine", "arrow", "doubleArrow", "dot",
          "square", "triangle", "regularPolygon", "star", "annulus", "arc", "sector")
COMPILERS = {
    **dict.fromkeys(("mathTex", "tex", "text", "decimalNumber", "bulletedList", "matrix", "code"), compile_text),
    **dict.fromkeys(SHAPES, compile_shape),
    **dict.fromkeys(("axes", "numberPlane", "numberLine"), compile_axes),
    "barChart": compile_bar_chart,
}


def compile_element(element, variable, variables=None, elements=None):
    kind, names = element["kind"], variables or {}
    if kind == "functionGraph":
        statements = compile_function_graph(element, variable, names.get(element.get("axesId")))
    elif kind == "areaUnderGraph":
        graph = (elements or {})[element["graphId"]]
        statements = compile_area(element, variable, names[element["graphId"]], names[graph["axesId"]])
    elif kind in ("brace", "surroundingRectangle"):
        statements = compile_annotation(element, variable, names[element["targetId"]])
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
