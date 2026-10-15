import type { Element, Project } from "./project";
import { appearanceTime, freeLayer, layerOf, lifetimes } from "./timeline";

export const elementLabels = {
  mathTex: "Equation", tex: "LaTeX text", text: "Text", decimalNumber: "Number", bulletedList: "Bullet list",
  matrix: "Matrix", code: "Code", circle: "Circle", dot: "Dot", ellipse: "Ellipse", rectangle: "Rectangle",
  roundedRectangle: "Rounded rectangle", square: "Square", triangle: "Triangle", regularPolygon: "Polygon",
  star: "Star", annulus: "Ring", arc: "Arc", sector: "Sector", line: "Line", dashedLine: "Dashed line",
  arrow: "Arrow", doubleArrow: "Double arrow", brace: "Brace", surroundingRectangle: "Highlight box",
  axes: "Axes", numberPlane: "Number plane", numberLine: "Number line",
  functionGraph: "Graph", areaUnderGraph: "Area under graph", barChart: "Bar chart",
} satisfies Record<Element["kind"], string>;

/** Library sections; every contract kind belongs to exactly one. */
export const elementGroups: { label: string; kinds: Element["kind"][] }[] = [
  { label: "Text", kinds: ["mathTex", "tex", "text", "decimalNumber", "bulletedList", "matrix", "code"] },
  { label: "Shapes", kinds: ["circle", "dot", "ellipse", "rectangle", "roundedRectangle", "square", "triangle",
    "regularPolygon", "star", "annulus", "arc", "sector"] },
  { label: "Lines", kinds: ["line", "dashedLine", "arrow", "doubleArrow"] },
  { label: "Annotations", kinds: ["brace", "surroundingRectangle"] },
  { label: "Coordinates", kinds: ["axes", "numberPlane", "numberLine"] },
  { label: "Graphs", kinds: ["functionGraph", "areaUnderGraph", "barChart"] },
];

/** Kinds drawn from another element: they follow it, so they have no position of their own to drag. */
export const derivedKinds: Element["kind"][] = ["areaUnderGraph", "brace", "surroundingRectangle"];

export const plottableGraphs = (project: Project) =>
  Object.entries(project.scene.elements).filter(
    ([, item]) => item.kind === "functionGraph" && item.axesId !== undefined,
  );

/** Elements an annotation can point at: anything that is not itself an annotation. */
export const annotatable = (project: Project) =>
  Object.entries(project.scene.elements).filter(([, item]) => !("targetId" in item));

export function additionBlocked(project: Project, kind: Element["kind"]): string | null {
  if (kind === "areaUnderGraph" && !plottableGraphs(project).length) return "Create axes and a linked graph before adding an area.";
  if ((kind === "brace" || kind === "surroundingRectangle") && !annotatable(project).length) return "Add an object to annotate first.";
  return null;
}

/** `target` is the element an annotation points at, by default the newest one; an area takes the first linked graph. */
export function createElement(kind: Element["kind"], project?: Project, target?: string): Element {
  const common = { position: [0, 0, 0] as [number, number, number], appearsAtMs: 0 };
  const scene = project ?? { scene: { elements: {} } } as Project;
  const annotated = target ?? annotatable(scene).at(-1)?.[0] ?? "";
  switch (kind) {
    case "mathTex": return { ...common, kind, latex: "x^2" };
    case "tex": return { ...common, kind, latex: "The area is $\\frac{4}{3}$" };
    case "text": return { ...common, kind, text: "Your text" };
    case "decimalNumber": return { ...common, kind, value: 3.14, decimals: 2 };
    case "bulletedList": return { ...common, kind, items: ["First point", "Second point"] };
    case "matrix": return { ...common, kind, rows: [["1", "0"], ["0", "1"]] };
    case "code": return { ...common, kind, code: "def square(x):\n    return x * x", language: "python" };
    case "circle": return { ...common, kind, radius: 1, color: "#58C4DD" };
    case "dot": return { ...common, kind, radius: 0.08, color: "#FFFF00" };
    case "ellipse": return { ...common, kind, width: 3, height: 2, color: "#58C4DD" };
    case "rectangle": return { ...common, kind, width: 3, height: 2, color: "#83C167" };
    case "roundedRectangle": return { ...common, kind, width: 3, height: 2, cornerRadius: 0.3, color: "#83C167" };
    case "square": return { ...common, kind, size: 2, color: "#83C167" };
    case "triangle": return { ...common, kind, size: 2, color: "#FC6255" };
    case "regularPolygon": return { ...common, kind, sides: 6, size: 2, color: "#FC6255" };
    case "star": return { ...common, kind, points: 5, radius: 1, color: "#FFFF00" };
    case "annulus": return { ...common, kind, innerRadius: 0.6, radius: 1, color: "#58C4DD" };
    case "arc": return { ...common, kind, radius: 1.5, angleDegrees: 180, startDegrees: 0, color: "#FFFF00" };
    case "sector": return { ...common, kind, radius: 1.5, angleDegrees: 90, startDegrees: 0, color: "#FFFF00" };
    case "line": case "dashedLine": case "arrow": case "doubleArrow": return { ...common, kind, end: [2, 0, 0], color: "#FFFF00" };
    case "brace": return { ...common, kind, targetId: annotated, direction: "down", color: "#FFFFFF" };
    case "surroundingRectangle": return { ...common, kind, targetId: annotated, color: "#FFFF00" };
    case "axes": return { ...common, kind, xRange: [-5, 5], yRange: [-3, 3], color: "#FFFFFF" };
    case "numberPlane": return { ...common, kind, xRange: [-5, 5], yRange: [-3, 3], color: "#586C89" };
    case "numberLine": return { ...common, kind, xRange: [-5, 5], includeNumbers: true, color: "#FFFFFF" };
    case "functionGraph": return { ...common, kind, expression: "x^2", xRange: [-2, 2], color: "#58C4DD" };
    case "areaUnderGraph": {
      const [id, graph] = plottableGraphs(scene)[0] ?? [];
      const xRange = graph && graph.kind === "functionGraph" ? graph.xRange : [-1, 1];
      return { ...common, kind, graphId: id ?? "", xRange: [...xRange] as [number, number], color: "#58C4DD", opacity: 0.4 };
    }
    case "barChart": return { ...common, kind, values: [3, 5, 2, 4], labels: ["A", "B", "C", "D"] };
  }
}

/** New elements go on top: on the top layer when it is free, otherwise on a new one above it. */
const topLayer = (scene: Project["scene"]) => Math.max(0, ...Object.keys(scene.elements).map(id => layerOf(scene, id)));

export function addElement(project: Project, kind: Element["kind"], atMs = 0, target?: string): Project {
  const { scene } = project, appearsAtMs = appearanceTime(scene, atMs);
  const element = { ...createElement(kind, project, target), appearsAtMs, layer: freeLayer(scene, topLayer(scene), [appearsAtMs, scene.durationMs]) };
  return { ...project, scene: { ...scene, elements: { ...scene.elements, [crypto.randomUUID()]: element } } };
}

/** Copies an element only. Animations stay with the original, so the copy is inert. */
export function duplicateElement(project: Project, identifier: string): Project {
  const source = project.scene.elements[identifier];
  if (!source) return project;
  return { ...project, scene: { ...project.scene, elements: {
    ...project.scene.elements, [crypto.randomUUID()]: { ...structuredClone(source), layer: freeLayer(project.scene, topLayer(project.scene), lifetimes(project.scene)[identifier]) },
  } } };
}

export function elementSummary(element: Element): string {
  if (element.kind === "mathTex" || element.kind === "tex") return element.latex || "Empty equation";
  if (element.kind === "text") return element.text || "Empty text";
  if (element.kind === "functionGraph") return element.expression;
  if (element.kind === "regularPolygon") return `${element.sides} sides`;
  if (element.kind === "decimalNumber") return element.value.toFixed(element.decimals ?? 2);
  if (element.kind === "bulletedList") return element.items.join(" · ");
  if (element.kind === "matrix") return `${element.rows.length} × ${element.rows[0].length} matrix`;
  if (element.kind === "code") return element.code.split("\n")[0];
  return elementLabels[element.kind];
}

export function positionWarning(element: Element): string | null {
  if (derivedKinds.includes(element.kind)) return null;
  const position = "end" in element ? element.position.map((v, i) => (v + element.end[i]) / 2) : element.position;
  return Math.abs(position[0]) > 64 / 9 || Math.abs(position[1]) > 4
    ? "Center outside the camera. Visible area: X −7.11 to 7.11; Y −4 to 4."
    : null;
}
