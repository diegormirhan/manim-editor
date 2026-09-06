EXPRESSIONS = {
    "x^2": "x**2", "(x - 2)^2 + 1": "(x - 2)**2 + 1",
    "sin(x)": "np.sin(x)", "cos(x)": "np.cos(x)", "sqrt(x)": "np.sqrt(x)",
    "x": "x", "x^3": "x**3",
}


def compile_axes(element, variable):
    constructor = "NumberPlane" if element["kind"] == "numberPlane" else "Axes"
    x_range, y_range = element["xRange"], element["yRange"]
    x_length = element.get("xLength", x_range[1] - x_range[0])
    y_length = element.get("yLength", y_range[1] - y_range[0])
    return [
        f"{variable} = {constructor}(x_range={x_range!r}, y_range={y_range!r}, x_length={x_length!r}, y_length={y_length!r}, tips=False)",
        f"{variable}.shift(np.array({element['position']!r}) - {variable}.c2p(0, 0))",
    ]


def compile_function_graph(element, variable, axes_variable=None):
    expression = EXPRESSIONS[element["expression"]]
    function = f"lambda x: {expression}"
    x_range = element["xRange"]
    if axes_variable:
        construction = f"{axes_variable}.plot({function}, x_range={x_range!r}, use_smoothing=False)"
    else:
        construction = f"FunctionGraph({function}, x_range={x_range!r}, use_smoothing=False)"
    return [f"{variable} = {construction}", f"{variable}.shift({element['position']!r})"]
