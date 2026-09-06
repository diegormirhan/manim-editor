import { expect, test } from "vitest";
import { createElement, elementLabels, positionWarning } from "./catalog";
import { initialProject, validateProject, type Element } from "./project";
import { removeElement } from "./timeline";

test("every catalog default validates with no implicit animation", () => {
  for (const kind of Object.keys(elementLabels) as Element["kind"][]) {
    const p = initialProject(); p.scene.elements = { a: createElement(kind) };
    expect(validateProject(p)).toBeNull();
    expect(p.scene.animations).toBeUndefined();
  }
});
test("offscreen warning distinguishes center from visible content bounds", () => {
  const a = createElement("text");
  expect(positionWarning(a)).toBeNull(); a.position[1] = 10;
  expect(positionWarning(a)).toContain("fora");
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
  expect(validateProject(p)).toContain("sequenciais");
});
