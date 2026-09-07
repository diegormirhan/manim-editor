import { expect, test } from "vitest";
import { initialProject, validateProject } from "./project";
import { addElement } from "./catalog";

test("adding an element preserves the original and adds no animation", () => {
  const p = initialProject();
  const q = addElement(p, "mathTex");
  expect(Object.keys(p.scene.elements)).toHaveLength(1);
  expect(Object.keys(q.scene.elements)).toHaveLength(2);
  expect(q.scene.animations).toBeUndefined();
  expect(validateProject(q)).toBeNull();
});
test("rejects unsupported fields and invalid appearance times", () => {
  const p = initialProject();
  p.scene.elements["equation-1"].appearsAtMs = 3000;
  expect(validateProject(p)).toContain("ends");
  expect(validateProject({ ...initialProject(), code: "bad" })).not.toBeNull();
});
test("rejects non-finite numbers the bounded schema cannot catch", () => {
  // Bounded fields fail their own range rule; unbounded coordinates need the explicit check.
  const bounded = initialProject();
  bounded.scene.elements["equation-1"].scale = Number.NaN;
  expect(validateProject(bounded)).not.toBeNull();
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const p = initialProject();
    p.scene.elements["equation-1"].position[1] = value;
    expect(validateProject(p), String(value)).toContain("finite");
  }
});
