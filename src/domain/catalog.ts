import type { Element, Project } from "./project";

export const elementLabels = {
  mathTex: "Equation", text: "Text", circle: "Circle", dot: "Dot",
  ellipse: "Ellipse", rectangle: "Rectangle", square: "Square", triangle: "Triangle",
  regularPolygon: "Polygon", arc: "Arc", line: "Line", arrow: "Arrow",
  axes: "Axes", numberPlane: "Number plane", numberLine: "Number line",
  functionGraph: "Graph", areaUnderGraph: "Area under graph",
} satisfies Record<Element["kind"], string>;

/** Library sections; every contract kind belongs to exactly one. */
export const elementGroups: { label: string; kinds: Element["kind"][] }[] = [
  { label: "Text", kinds: ["mathTex", "text"] },
  { label: "Shapes", kinds: ["circle", "dot", "ellipse", "rectangle", "square", "triangle", "regularPolygon", "arc", "line", "arrow"] },
  { label: "Coordinates", kinds: ["axes", "numberPlane", "numberLine"] },
  { label: "Graphs", kinds: ["functionGraph", "areaUnderGraph"] },
];

/** Kinds that reference another element and cannot be created on their own. */
export const derivedKinds: Element["kind"][] = ["areaUnderGraph"];

export const plottableGraphs = (project: Project) =>
  Object.entries(project.scene.elements).filter(
    ([, item]) => item.kind === "functionGraph" && item.axesId !== undefined,
  );

export function additionBlocked(project: Project, kind: Element["kind"]): string | null {
  if (kind !== "areaUnderGraph") return null;
  return plottableGraphs(project).length ? null : "Create axes and a linked graph before adding an area.";
}

export function createElement(kind: Element["kind"], project?: Project): Element {
  const common = { position: [0, 0, 0] as [number, number, number], appearsAtMs: 0 };
  switch (kind) {
    case "mathTex": return { ...common, kind, latex: "x^2" };
    case "text": return { ...common, kind, text: "Your text" };
    case "circle": return { ...common, kind, radius: 1, color: "#58C4DD" };
    case "dot": return { ...common, kind, radius: 0.08, color: "#FFFF00" };
    case "ellipse": return { ...common, kind, width: 3, height: 2, color: "#58C4DD" };
    case "rectangle": return { ...common, kind, width: 3, height: 2, color: "#83C167" };
    case "square": return { ...common, kind, size: 2, color: "#83C167" };
    case "triangle": return { ...common, kind, size: 2, color: "#FC6255" };
    case "regularPolygon": return { ...common, kind, sides: 6, size: 2, color: "#FC6255" };
    case "arc": return { ...common, kind, radius: 1.5, angleDegrees: 180, startDegrees: 0, color: "#FFFF00" };
    case "line": case "arrow": return { ...common, kind, end: [2, 0, 0], color: "#FFFF00" };
    case "axes": return { ...common, kind, xRange: [-5, 5], yRange: [-3, 3], color: "#FFFFFF" };
    case "numberPlane": return { ...common, kind, xRange: [-5, 5], yRange: [-3, 3], color: "#586C89" };
    case "numberLine": return { ...common, kind, xRange: [-5, 5], includeNumbers: true, color: "#FFFFFF" };
    case "functionGraph": return { ...common, kind, expression: "x^2", xRange: [-2, 2], color: "#58C4DD" };
    case "areaUnderGraph": {
      const [id, graph] = plottableGraphs(project ?? { scene: { elements: {} } } as Project)[0] ?? [];
      const xRange = graph && graph.kind === "functionGraph" ? graph.xRange : [-1, 1];
      return { ...common, kind, graphId: id ?? "", xRange: [...xRange] as [number, number], color: "#58C4DD", opacity: 0.4 };
    }
  }
}

export function addElement(project: Project, kind: Element["kind"]): Project {
  return { ...project, scene: { ...project.scene, elements: {
    ...project.scene.elements, [crypto.randomUUID()]: createElement(kind, project),
  } } };
}

export function elementSummary(element: Element): string {
  if (element.kind === "mathTex") return element.latex || "Empty equation";
  if (element.kind === "text") return element.text || "Empty text";
  if (element.kind === "functionGraph") return element.expression;
  if (element.kind === "regularPolygon") return `${element.sides} sides`;
  return elementLabels[element.kind];
}

export function positionWarning(element: Element): string | null {
  if (element.kind === "areaUnderGraph") return null;
  const position = element.kind === "line" || element.kind === "arrow"
    ? element.position.map((v, i) => (v + element.end[i]) / 2) : element.position;
  return Math.abs(position[0]) > 64 / 9 || Math.abs(position[1]) > 4
    ? "Center outside the camera. Visible area: X −7.11 to 7.11; Y −4 to 4."
    : null;
}
