import { expect, test } from "vitest";
import { animationLabels, clipFields, isEntrance, lifetimes, seconds } from "./timeline";
import { createElement } from "./catalog";
import { initialProject, validateProject, type Animation, type Project } from "./project";

function twoCircles(): Project {
  const project = initialProject();
  project.scene.durationMs = 6000;
  project.scene.elements = { a: createElement("circle"), b: createElement("circle") };
  return project;
}

test("timeline labels use English decimal notation and seconds", () => {
  expect(seconds(750)).toBe("0.75 s");
  expect(seconds(3250)).toBe("3.25 s");
});

test("every animation kind has a label and a declared extra field or none", () => {
  const kinds = Object.keys(animationLabels) as Animation["kind"][];
  expect(kinds).toContain("grow");
  for (const [kind, field] of Object.entries(clipFields)) {
    expect(kinds).toContain(kind as Animation["kind"]);
    expect(field).toBeTruthy();
  }
});
test("new entrances start with their element; emphasis clips do not", () => {
  for (const kind of ["grow", "drawBorder"] as const) {
    expect(isEntrance(kind)).toBe(true);
    const p = twoCircles();
    p.scene.animations = [{ kind, targetId: "a", startMs: 0, durationMs: 1000 }];
    expect(validateProject(p), kind).toBeNull();
    p.scene.animations[0].startMs = 500;
    expect(validateProject(p), kind).toContain("entrance");
  }
  for (const kind of ["indicate", "wiggle"] as const) {
    expect(isEntrance(kind)).toBe(false);
    const p = twoCircles();
    p.scene.animations = [{ kind, targetId: "a", startMs: 500, durationMs: 1000 }];
    expect(validateProject(p), kind).toBeNull();
  }
});
test("a clip carries exactly the extra field its kind declares", () => {
  const complete: Record<string, Partial<Animation>> = {
    moveTo: { destination: [1, 0, 0] }, rotate: { degrees: 90 },
    scaleTo: { factor: 2 }, recolor: { color: "#ff0000" },
  };
  for (const [kind, patch] of Object.entries(complete)) {
    const p = twoCircles();
    p.scene.animations = [{ kind: kind as Animation["kind"], targetId: "a", startMs: 500, durationMs: 1000, ...patch }];
    expect(validateProject(p), kind).toBeNull();
    const missing = twoCircles();
    missing.scene.animations = [{ kind: kind as Animation["kind"], targetId: "a", startMs: 500, durationMs: 1000 }];
    expect(validateProject(missing), kind).toContain("belongs only");
    const extra = twoCircles();
    extra.scene.animations = [{ kind: "fadeOut", targetId: "a", startMs: 500, durationMs: 1000, ...patch }];
    expect(validateProject(extra), kind).toContain("belongs only");
  }
});
test("lifetimes report the span a transform destination actually occupies", () => {
  const p = twoCircles();
  p.scene.animations = [{ kind: "transform", targetId: "a", destinationId: "b", startMs: 1000, durationMs: 1000 }];
  expect(validateProject(p)).toBeNull();
  expect(lifetimes(p.scene)).toEqual({ a: [0, 2000], b: [2000, 6000] });
});
test("an emphasis clip cannot run after the element leaves", () => {
  const p = twoCircles();
  p.scene.animations = [
    { kind: "fadeOut", targetId: "a", startMs: 0, durationMs: 1000 },
    { kind: "indicate", targetId: "a", startMs: 2000, durationMs: 1000 },
  ];
  expect(validateProject(p)).toContain("available");
});
