import { expect, test } from "vitest";
import { animationLabels, appearanceTime, clipFields, isEntrance, lifetimes, removeAnimation, rulerTicks, seconds, timecode } from "./timeline";
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

test("timecode counts whole seconds and 15 fps frames", () => {
  expect(timecode(0)).toBe("00:00:00:00");
  expect(timecode(7220)).toBe("00:00:07:03");
  expect(timecode(12000)).toBe("00:00:12:00");
  expect(timecode(61_000)).toBe("00:01:01:00");
});

test("ruler steps land on round seconds and keep at most twelve labelled marks", () => {
  const short = rulerTicks(3000);
  expect(short.majors).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000]);
  expect(short.minors.every((ms) => ms % 100 === 0)).toBe(true);
  const demo = rulerTicks(12000);
  expect(demo.majors).toHaveLength(13);
  expect(demo.majors.every((ms) => ms % 1000 === 0)).toBe(true);
  expect(rulerTicks(10000).majors).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]);
  expect(rulerTicks(45000).majors.every((ms) => ms % 5000 === 0)).toBe(true);
  for (const ms of rulerTicks(12000).minors) expect(demo.majors).not.toContain(ms);
});

test("a new element appears at the playhead but never inside a running animation", () => {
  const p = twoCircles();
  p.scene.animations = [{ kind: "indicate", targetId: "a", startMs: 1000, durationMs: 1000 }];
  expect(appearanceTime(p.scene, 437)).toBe(400);
  expect(appearanceTime(p.scene, 1500)).toBe(2000);
  expect(appearanceTime(p.scene, 1000)).toBe(1000);
  expect(appearanceTime(p.scene, -50)).toBe(0);
  // The scene must still show the element for at least one frame.
  expect(appearanceTime(p.scene, 6000)).toBe(5900);
  p.scene.animations = [{ kind: "indicate", targetId: "a", startMs: 5000, durationMs: 1000 }];
  expect(appearanceTime(p.scene, 5600)).toBe(5000);
});

test("removing a transform also removes the destination it created", () => {
  const p = twoCircles();
  p.scene.elements.c = createElement("circle");
  p.scene.animations = [
    { kind: "fadeIn", targetId: "c", startMs: 0, durationMs: 500 },
    { kind: "transform", targetId: "a", destinationId: "b", startMs: 1000, durationMs: 1000 },
    { kind: "indicate", targetId: "b", startMs: 3000, durationMs: 1000 },
  ];
  const next = removeAnimation(p, 1);
  expect(Object.keys(next.scene.elements)).toEqual(["a", "c"]);
  expect(next.scene.animations).toEqual([p.scene.animations[0]]);
  expect(validateProject(next)).toBeNull();
  expect(p.scene.animations).toHaveLength(3);
  expect(removeAnimation(p, 0).scene.elements).toEqual(p.scene.elements);
});

test("zoomed rulers label the visible span, not the whole scene", () => {
  const whole = rulerTicks(45_000);
  expect(whole.majors.every((ms) => ms % 5000 === 0)).toBe(true);
  // A tenth of the scene in view: marks every 0.5 s across the full scene.
  const zoomed = rulerTicks(45_000, 4500);
  expect(zoomed.majors.slice(0, 3)).toEqual([0, 500, 1000]);
  expect(zoomed.majors.at(-1)).toBe(45_000);
});
