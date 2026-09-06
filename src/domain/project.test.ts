import { expect, test } from "vitest";
import { initialProject, addEquation, validateProject } from "./project";
test("adding an equation preserves the original and adds no animation", () => {
  const p = initialProject();
  const q = addEquation(p);
  expect(Object.keys(p.scene.elements)).toHaveLength(1);
  expect(Object.keys(q.scene.elements)).toHaveLength(2);
  expect(validateProject(q)).toBeNull();
});
test("rejects unsupported fields and invalid appearance times", () => {
  const p = initialProject();
  p.scene.elements["equation-1"].appearsAtMs = 3000;
  expect(validateProject(p)).toContain("fim");
  expect(validateProject({ ...initialProject(), code: "bad" })).not.toBeNull();
});
