def compile_math_tex(element: dict, variable: str) -> list[str]:
    latex = repr(element["latex"])
    position = repr(element["position"])
    return [
        f"{variable} = MathTex({latex})",
        f"{variable}.move_to({position})",
    ]

