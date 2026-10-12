import { expect, test } from "vitest";
import { createElement } from "./catalog";
import { initialProject, type Project } from "./project";
import { moveElement } from "./placement";

function sceneWith(elements: Project["scene"]["elements"], animations: Project["scene"]["animations"] = []): Project {
  const project = initialProject();
  project.scene = { durationMs: 6000, elements, animations };
  return project;
}

test("dragging an element moves its position by the drag, to the hundredth", () => {
  const project = sceneWith({ a: { ...createElement("circle"), position: [1, -1, 0] } });
  const moved = moveElement(project, "a", 0, [0.5, 1 / 3]);
  expect(moved.scene.elements.a).toMatchObject({ position: [1.5, -0.67, 0] });
  expect(project.scene.elements.a).toMatchObject({ position: [1, -1, 0] });
});

test("a line moves both of its ends", () => {
  const moved = moveElement(sceneWith({ l: createElement("line") }), "l", 0, [1, 2]);
  expect(moved.scene.elements.l).toMatchObject({ position: [1, 2, 0], end: [3, 2, 0] });
});

test("after a Move animation the drag changes where that move ends", () => {
  const project = sceneWith({ a: createElement("circle") }, [
    { kind: "moveTo", targetId: "a", startMs: 0, durationMs: 1000, destination: [2, 0, 0] },
    { kind: "parallel", startMs: 2000, durationMs: 1000, clips: [
      { kind: "moveTo", targetId: "a", startMs: 2000, durationMs: 1000, destination: [3, 0, 0] },
      { kind: "indicate", targetId: "a", startMs: 2000, durationMs: 1000 },
    ] },
  ]);
  const later = moveElement(project, "a", 4000, [0, 1]);
  expect(later.scene.animations![1]).toMatchObject({ clips: [{ destination: [3, 1, 0] }, { kind: "indicate" }] });
  expect(later.scene.elements.a).toMatchObject({ position: [0, 0, 0] });
  expect(moveElement(project, "a", 1000, [0, 1]).scene.animations![0]).toMatchObject({ destination: [2, 1, 0] });
  // Until a move ends, the element still answers for where it starts.
  expect(moveElement(project, "a", 500, [0, 1]).scene.elements.a).toMatchObject({ position: [0, 1, 0] });
});

test("an area follows its graph and does not move on its own", () => {
  const project = sceneWith({ area: { kind: "areaUnderGraph", graphId: "g", xRange: [0, 1], position: [0, 0, 0], appearsAtMs: 0 } });
  expect(moveElement(project, "area", 0, [1, 1])).toBe(project);
  expect(moveElement(project, "missing", 0, [1, 1])).toBe(project);
});
