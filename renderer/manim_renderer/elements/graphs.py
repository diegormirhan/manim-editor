from .expressions import compile_expression

# Graphs read their axes and areas read their graph, so they compile last.
DEPENDENCY_ORDER = {"functionGraph": 1, "areaUnderGraph": 2}


def compile_axes(element, variable):
    kind = element["kind"]
    x_range = element["xRange"]
    x_length = element.get("xLength", x_range[1] - x_range[0])
    if kind == "numberLine":
        return [
            f"{variable} = NumberLine(x_range={x_range!r}, length={x_length!r}, "
            f"include_numbers={element.get('includeNumbers', False)!r})",
            f"{variable}.move_to({element['position']!r})",
        ]
    constructor = "NumberPlane" if kind == "numberPlane" else "Axes"
    y_range = element["yRange"]
    y_length = element.get("yLength", y_range[1] - y_range[0])
    return [
        f"{variable} = {constructor}(x_range={x_range!r}, y_range={y_range!r}, x_length={x_length!r}, y_length={y_length!r}, tips=False)",
        f"{variable}.shift(np.array({element['position']!r}) - {variable}.c2p(0, 0))",
    ]


def compile_function_graph(element, variable, axes_variable=None):
    function = f"lambda x: {compile_expression(element['expression'])}"
    x_range = element["xRange"]
    if axes_variable:
        construction = f"{axes_variable}.plot({function}, x_range={x_range!r}, use_smoothing=False)"
    else:
        construction = f"FunctionGraph({function}, x_range={x_range!r}, use_smoothing=False)"
    return [f"{variable} = {construction}", f"{variable}.shift({element['position']!r})"]


def compile_area(element, variable, graph_variable, axes_variable):
    return [
        f"{variable} = {axes_variable}.get_area({graph_variable}, x_range={element['xRange']!r})",
    ]
