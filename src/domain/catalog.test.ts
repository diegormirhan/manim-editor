import { expect, test } from "vitest";
import {
  addElement, additionBlocked, createElement, derivedKinds, duplicateElement, elementLabels, positionWarning,
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
test("an object plays one animation at a time", () => {
  const p = initialProject();
  p.scene.animations = [{ kind: "write", targetId: "equation-1", startMs: 0, durationMs: 1000 }];
  expect(validateProject(p)).toBeNull();
  p.scene.animations.push({ kind: "fadeOut", targetId: "equation-1", startMs: 500, durationMs: 1000 });
  expect(validateProject(p)).toContain("one animation at a time");
});

test("annotations go around another object and leave with it", () => {
  const p = initialProject();
  expect(additionBlocked({ ...p, scene: { ...p.scene, elements: {} } }, "brace")).toContain("annotate");
  const next = addElement(p, "brace", 0, "equation-1");
  const [brace] = Object.keys(next.scene.elements).filter(id => id !== "equation-1");
  expect(next.scene.elements[brace]).toMatchObject({ targetId: "equation-1" });
  expect(validateProject(next)).toBeNull();
  expect(Object.keys(removeElement(next, "equation-1").scene.elements)).toEqual([]);
});

test("a new object goes on the top layer when it is free, otherwise on a new layer above", () => {
  const p = initialProject();
  p.scene.elements["equation-1"].layer = 2;
  const stacked = addElement(p, "circle", 0);
  expect(Object.values(stacked.scene.elements).map(element => element.layer)).toEqual([2, 3]);
  p.scene.elements["equation-1"].disappearsAtMs = 1000;
  const after = addElement(p, "circle", 1000);
  expect(Object.values(after.scene.elements).map(element => element.layer)).toEqual([2, 2]);
  expect(validateProject(after)).toBeNull();
});

test("duplicating an element copies it without inheriting its animations", () => {
  const project = initialProject();
  const [id] = Object.keys(project.scene.elements);
  const animations = project.scene.animations?.length ?? 0;
  const next = duplicateElement(project, id);
  const added = Object.keys(next.scene.elements).filter((key) => !(key in project.scene.elements));
  expect(added).toHaveLength(1);
  // The copy plays at the same time, so it sits on a layer of its own.
  expect(next.scene.elements[added[0]]).toEqual({ ...project.scene.elements[id], layer: 1 });
  expect(next.scene.animations?.length ?? 0).toBe(animations);
  expect(validateProject(next)).toBe(null);
});

test("duplicating an unknown element changes nothing", () => {
  const project = initialProject();
  expect(duplicateElement(project, "missing")).toBe(project);
});

test("a new element starts at the requested time", () => {
  const project = initialProject();
  const next = addElement(project, "circle", 1200);
  const id = Object.keys(next.scene.elements).at(-1)!;
  expect(next.scene.elements[id].appearsAtMs).toBe(1200);
  expect(validateProject(next)).toBeNull();
});
