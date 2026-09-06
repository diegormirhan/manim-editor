import type { Element, Project } from "./project";

export const elementLabels = {
  mathTex: "Equação", text: "Texto", circle: "Círculo",
  rectangle: "Retângulo", line: "Linha", arrow: "Seta", axes: "Eixos", functionGraph: "Gráfico",
  dot: "Ponto", square: "Quadrado", triangle: "Triângulo", numberPlane: "Plano cartesiano",
} satisfies Record<Element["kind"], string>;

export function createElement(kind: Element["kind"]): Element {
  const common = { position: [0, 0, 0] as [number, number, number], appearsAtMs: 0 };
  switch (kind) {
    case "mathTex": return { ...common, kind, latex: "x^2" };
    case "text": return { ...common, kind, text: "Seu texto" };
    case "circle": return { ...common, kind, radius: 1, color: "#58C4DD" };
    case "rectangle": return { ...common, kind, width: 3, height: 2, color: "#83C167" };
    case "line": case "arrow": return { ...common, kind, end: [2, 0, 0], color: "#FFFF00" };
    case "axes": return { ...common, kind, xRange: [-5, 5], yRange: [-3, 3], color: "#FFFFFF" };
    case "functionGraph": return { ...common, kind, expression: "x^2", xRange: [-3, 3], color: "#58C4DD" };
    case "dot": return { ...common, kind, radius: 0.08, color: "#FFFF00" };
    case "square": return { ...common, kind, size: 2, color: "#83C167" };
    case "triangle": return { ...common, kind, size: 2, color: "#FC6255" };
    case "numberPlane": return { ...common, kind, xRange: [-5, 5], yRange: [-3, 3], color: "#586C89" };
  }
}

export function addElement(project: Project, kind: Element["kind"]): Project {
  return { ...project, scene: { ...project.scene, elements: {
    ...project.scene.elements, [crypto.randomUUID()]: createElement(kind),
  } } };
}

export function elementSummary(element: Element): string {
  if (element.kind === "mathTex") return element.latex || "Equação vazia";
  if (element.kind === "text") return element.text || "Texto vazio";
  if (element.kind === "functionGraph") return element.expression;
  return elementLabels[element.kind];
}

export function positionWarning(element: Element): string | null {
  const position = element.kind === "line" || element.kind === "arrow"
    ? element.position.map((v, i) => (v + element.end[i]) / 2) : element.position;
  return Math.abs(position[0]) > 64 / 9 || Math.abs(position[1]) > 4
    ? "Centro fora da câmera. Área visível: X de −7,11 a 7,11; Y de −4 a 4."
    : null;
}
