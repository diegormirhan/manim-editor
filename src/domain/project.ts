import validate from "../generated/validate.js";
import type { ManimEditorProject, MathTex } from "../generated/project";
import { validateTimeline } from "./timeline";
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
      "Projeto inválido: " +
      (validate.errors?.[0]?.message ?? "verifique os campos.")
    );
  const scene = (project as Project).scene;
  for (const element of Object.values(scene.elements)) {
    if (element.position.some((value) => !Number.isFinite(value)))
      return "A posição precisa ser um número finito.";
    if (element.appearsAtMs >= scene.durationMs)
      return "O elemento deve aparecer antes do fim da cena.";
    const end = element.disappearsAtMs ?? scene.durationMs;
    if (end > scene.durationMs || Math.round(end * 15 / 1000) <= Math.round(element.appearsAtMs * 15 / 1000))
      return "O fim do elemento deve ser posterior ao início e estar dentro da cena.";
    if ((element.kind === "line" || element.kind === "arrow") && element.position.every((v, i) => v === element.end[i]))
      return "Linha e seta precisam de pontos distintos.";
    for (const range of [("xRange" in element ? element.xRange : undefined), ("yRange" in element ? element.yRange : undefined)])
      if (range && (range[0] >= range[1] || range[0] < -100 || range[1] > 100 || range[1] - range[0] < 0.1))
        return "Intervalo dos eixos inválido: use mínimo menor que máximo, entre −100 e 100.";
    if (element.kind === "functionGraph") {
      if (element.expression === "sqrt(x)" && element.xRange[0] < 0) return "A raiz quadrada exige X inicial maior ou igual a zero.";
      if (element.axesId) {
        const axes = scene.elements[element.axesId];
        if (!axes || !["axes", "numberPlane"].includes(axes.kind)) return "Selecione eixos existentes para o gráfico.";
        if ((axes.scale ?? 1) !== 1) return "Ajuste largura e altura dos eixos vinculados, mantendo escala em 1.";
      }
    }
  }
  return validateTimeline(scene);
}
export function addEquation(project: Project): Project {
  return {
    ...project,
    scene: {
      ...project.scene,
      elements: {
        ...project.scene.elements,
        [crypto.randomUUID()]: {
          kind: "mathTex",
          latex: "x^2",
          position: [0, 0, 0],
          appearsAtMs: 0,
        },
      },
    },
  };
}
