import validate from "../generated/validate.js";
import type { ManimEditorProject, MathTex } from "../generated/project";
import { validateTimeline } from "./timeline";
import { expressionError } from "./expression";
import example from "../../examples/equation.json";

export type Project = ManimEditorProject;
export type Element = Project["scene"]["elements"][string];
export type { Animation } from "../generated/project";
export type Equation = MathTex;
export const initialProject = (): Project => {
  const candidate: unknown = structuredClone(example);
  const error = validateProject(candidate);
  if (error) throw new Error(error);
  return candidate as Project;
};

export function validateProject(project: unknown): string | null {
  if (!validate(project))
    return (
      "Invalid project: " +
      (validate.errors?.[0]?.message ?? "check the fields.")
    );
  const scene = (project as Project).scene;
  for (const element of Object.values(scene.elements)) {
    for (const value of Object.values(element))
      if ((typeof value === "number" && !Number.isFinite(value)) ||
        (Array.isArray(value) && value.some((item) => !Number.isFinite(item))))
        return "All element numbers must be finite.";
    if (element.appearsAtMs >= scene.durationMs)
      return "The element must appear before the scene ends.";
    const end = element.disappearsAtMs ?? scene.durationMs;
    if (end > scene.durationMs || Math.round(end * 15 / 1000) <= Math.round(element.appearsAtMs * 15 / 1000))
      return "The element must end after it starts and within the scene.";
    if ((element.kind === "line" || element.kind === "arrow") && element.position.every((v, i) => v === element.end[i]))
      return "Lines and arrows require distinct endpoints.";
    for (const range of [("xRange" in element ? element.xRange : undefined), ("yRange" in element ? element.yRange : undefined)])
      if (range && (range[0] >= range[1] || range[0] < -100 || range[1] > 100 || range[1] - range[0] < 0.1))
        return "Invalid axis range: the minimum must be less than the maximum, between −100 and 100.";
    if (element.kind === "functionGraph") {
      const invalid = expressionError(element.expression, element.xRange);
      if (invalid) return invalid;
      if (element.axesId) {
        const axes = scene.elements[element.axesId];
        if (!axes || !["axes", "numberPlane"].includes(axes.kind)) return "Select existing axes for the graph.";
        if ((axes.scale ?? 1) !== 1) return "Adjust linked axes width and height, keeping their scale at 1.";
      }
    }
    if (element.kind === "areaUnderGraph") {
      const graph = scene.elements[element.graphId];
      if (!graph || graph.kind !== "functionGraph") return "Select an existing graph for the area.";
      if (!graph.axesId) return "The area requires a graph linked to axes.";
      if (element.xRange[0] < graph.xRange[0] || element.xRange[1] > graph.xRange[1])
        return "The area range must stay within the graph range.";
    }
  }
  return validateTimeline(scene);
}
