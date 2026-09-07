import { expect, test } from "vitest";
import {
  additionBlocked, createElement, derivedKinds, elementLabels, positionWarning,
} from "./catalog";
import { initialProject, validateProject, type Element, type Project } from "./project";
import { removeElement } from "./timeline";

const standaloneKinds = (Object.keys(elementLabels) as Element["kind"][])
  .filter((kind) => !derivedKinds.includes(kind));

function withGraph(): Project {
  const project = initialProject();
  const graph = createElement("functionGraph") as Extract<Element, { kind: "functionGraph" }>;
  project.scene.elements = { axes: createElement("axes"), graph: { ...graph, axesId: "axes" } };
  return project;
}

test("every catalog default validates with no implicit animation", () => {
  for (const kind of standaloneKinds) {
    const p = initialProject();
    p.scene.elements = { a: createElement(kind) };
    expect(validateProject(p), kind).toBeNull();
    expect(p.scene.animations).toBeUndefined();
  }
});
test("derived kinds are blocked until their source exists, then validate", () => {
  const empty = initialProject();
  expect(additionBlocked(empty, "areaUnderGraph")).toContain("graph");
  const project = withGraph();
  expect(additionBlocked(project, "areaUnderGraph")).toBeNull();
  project.scene.elements.area = createElement("areaUnderGraph", project);
  expect(validateProject(project)).toBeNull();
});
test("an area cannot leave its graph range or point at a loose graph", () => {
  const project = withGraph();
  project.scene.elements.area = createElement("areaUnderGraph", project);
  (project.scene.elements.area as { xRange: [number, number] }).xRange = [-9, 3];
  expect(validateProject(project)).toContain("range");
  delete (project.scene.elements.graph as { axesId?: string }).axesId;
  expect(validateProject(project)).toContain("axes");
});
test("offscreen warning distinguishes center from visible content bounds", () => {
  const a = createElement("text");
  expect(positionWarning(a)).toBeNull();
  a.position[1] = 10;
  expect(positionWarning(a)).toContain("outside");
});
test("rotation and opacity are accepted on any element", () => {
  for (const kind of standaloneKinds) {
    const p = initialProject();
    p.scene.elements = { a: { ...createElement(kind), rotationDegrees: 45, opacity: 0.5 } };
    expect(validateProject(p), kind).toBeNull();
  }
});
test("deleting an element removes its animations and is immutable", () => {
  const p = initialProject();
  p.scene.animations = [{ kind: "write", targetId: "equation-1", startMs: 0, durationMs: 1000 }];
  const next = removeElement(p, "equation-1");
  expect(next.scene.animations).toEqual([]);
  expect(p.scene.animations).toHaveLength(1);
});
test("overlap and duplicate entrance are rejected", () => {
  const p = initialProject();
  p.scene.animations = [{ kind: "write", targetId: "equation-1", startMs: 0, durationMs: 1000 }];
  expect(validateProject(p)).toBeNull();
  p.scene.animations.push({ kind: "fadeOut", targetId: "equation-1", startMs: 500, durationMs: 1000 });
  expect(validateProject(p)).toContain("sequential");
});
