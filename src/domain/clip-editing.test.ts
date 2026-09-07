import { expect, test } from "vitest";
import { editClip, retimeAnimation } from "./clip-editing";
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
test("parallel resize keeps children in sync; conflict stays invalid", () => {
  const p = initialProject();
  p.scene.elements.b = { ...p.scene.elements["equation-1"] };
  p.scene.animations = [{ kind: "parallel", startMs: 0, durationMs: 1000, clips: [
    { kind: "write", targetId: "equation-1", startMs: 0, durationMs: 1000 },
    { kind: "fadeIn", targetId: "b", startMs: 0, durationMs: 1000 },
  ] }];
  const next = retimeAnimation(p, 0, 500, 1500);
  expect(next.scene.animations?.[0].clips?.map(c => c.durationMs)).toEqual([1500, 1500]);
  expect(validateProject(next)).toBeNull();
  next.scene.animations!.push({ kind: "fadeOut", targetId: "b", startMs: 1500, durationMs: 1000 });
  expect(validateProject(next)).toContain("sequential");
});
