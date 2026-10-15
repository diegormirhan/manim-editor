import { expect, test } from "vitest";
import { editClip, moveToLayer } from "./clip-editing";
import { initialProject, validateProject } from "./project";
test("dragging is immutable, snaps and shifts attached animations", () => {
  const p = initialProject();
  p.scene.animations = [{ kind: "write", targetId: "equation-1", startMs: 0, durationMs: 1000 }];
  const next = editClip(p, { type: "element", id: "equation-1" }, "move", 510);
  expect(next.scene.elements["equation-1"].appearsAtMs).toBe(500);
  expect(next.scene.animations?.[0].startMs).toBe(500);
  expect(p.scene.animations[0].startMs).toBe(0);
  expect(validateProject(next)).toBeNull();
});
test("resize creates an explicit presence end and respects minimum and boundaries", () => {
  const p = initialProject(), target = { type: "element", id: "equation-1" } as const;
  expect(editClip(p, target, "end", -5000).scene.elements["equation-1"].disappearsAtMs).toBe(100);
  expect(editClip(p, target, "start", -5000).scene.elements["equation-1"].appearsAtMs).toBe(0);
});
test("objects share a layer only when they take turns on it", () => {
  const p = initialProject();
  p.scene.elements["equation-1"] = { ...p.scene.elements["equation-1"], layer: 0, disappearsAtMs: 1000 };
  p.scene.elements.b = { ...p.scene.elements["equation-1"], appearsAtMs: 500, layer: 1 };
  delete p.scene.elements.b.disappearsAtMs;
  expect(validateProject(moveToLayer(p, "b", 0))).toContain("overlap in time");
  const later = editClip(p, { type: "element", id: "b" }, "start", 500);
  expect(validateProject(moveToLayer(later, "b", 0))).toBeNull();
  expect(p.scene.elements.b.layer).toBe(1);
});
test("dragging an end to the scene's end keeps the object until the scene ends", () => {
  const p = initialProject();
  p.scene.elements["equation-1"].disappearsAtMs = 1000;
  const next = editClip(p, { type: "element", id: "equation-1" }, "end", 5000);
  expect(next.scene.elements["equation-1"].disappearsAtMs).toBeUndefined();
});
test("an edge near a magnet lands on it exactly; farther away the grid wins", () => {
  const p = initialProject(), target = { type: "animation", index: 0 } as const;
  p.scene.durationMs = 6000;
  p.scene.animations = [{ kind: "indicate", targetId: "equation-1", startMs: 1000, durationMs: 1000 }];
  const moved = (delta: number, gesture: "move" | "start" | "end" = "move") =>
    editClip(p, target, gesture, delta, [2437], 80).scene.animations![0];
  // The start reaches 2437 ± 80: it locks on.
  expect(moved(1400).startMs).toBe(2437);
  // The end (2000) reaches 2437 first when the clip moves by about 437.
  expect(moved(460)).toMatchObject({ startMs: 1437, durationMs: 1000 });
  expect(moved(700).startMs).toBe(1700);
  expect(moved(420, "end")).toMatchObject({ startMs: 1000, durationMs: 1437 });
  expect(editClip(p, target, "move", 1400).scene.animations![0].startMs).toBe(2400);
});
