import { validateProject, type Project } from "../domain/project";
import equation from "../../examples/equation.json";
import officialDemo from "../../examples/official-demo.json";
import calculusArea from "../../examples/calculus-area.json";
import shapeMotion from "../../examples/shape-motion.json";

function bundled(key: string, label: string, project: unknown) {
  const error = validateProject(project);
  if (error) throw new Error(`The ${label} example is invalid: ${error}`);
  return { key, label, project: project as Project };
}

export const examples = [
  bundled("official-demo", "Parabola · transformation demo", officialDemo),
  bundled("calculus-area", "Area under the curve", calculusArea),
  bundled("shape-motion", "Shapes and motion", shapeMotion),
  bundled("equation", "First equation", equation),
];
