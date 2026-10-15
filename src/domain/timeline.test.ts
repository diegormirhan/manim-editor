import { expect, test } from "vitest";
import {
  addAnimation, animationLabels, appearanceTime, clipFields, isEntrance, lifetimes, normalizeProject, removeAnimation, rulerTicks, seconds, timecode,
} from "./timeline";
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
  expect(validateProject(p)).toContain("not on screen");
});

test("animations of different objects overlap freely", () => {
  const p = twoCircles();
  p.scene.animations = [
    { kind: "indicate", targetId: "a", startMs: 0, durationMs: 2000 },
    { kind: "fadeIn", targetId: "b", startMs: 0, durationMs: 1000 },
    { kind: "wiggle", targetId: "b", startMs: 1000, durationMs: 2000 },
  ];
  expect(validateProject(p)).toBeNull();
});

test("a new animation starts at the playhead, after what its object is already playing", () => {
  const p = twoCircles();
  p.scene.animations = [{ kind: "indicate", targetId: "a", startMs: 1000, durationMs: 1000 }];
  const added = (kind: Animation["kind"], atMs: number) => {
    const next = addAnimation(p, "a", kind, atMs);
    if (typeof next === "string") throw Error(next);
    expect(validateProject(next)).toBeNull();
    return next.scene.animations!.at(-1)!;
  };
  expect(added("wiggle", 1500)).toMatchObject({ startMs: 2000, durationMs: 1000 });
  expect(added("wiggle", 430)).toMatchObject({ startMs: 400, durationMs: 600 });
  expect(added("fadeIn", 3000)).toMatchObject({ startMs: 0, durationMs: 1000 });
  expect(added("fadeOut", 0)).toMatchObject({ startMs: 2000 });
  p.scene.animations.push({ kind: "fadeIn", targetId: "a", startMs: 0, durationMs: 500 });
  expect(addAnimation(p, "a", "grow", 0)).toContain("already has an entrance");
});

test("a transform's destination takes over its object's layer", () => {
  const p = normalizeProject(twoCircles());
  const next = addAnimation(p, "a", "transform", 1000);
  if (typeof next === "string") throw Error(next);
  const destination = next.scene.animations![0].destinationId!;
  expect(next.scene.elements[destination].layer).toBe(0);
  expect(validateProject(next)).toBeNull();
});

test("older files gain layers and lose parallel groups without changing what plays", () => {
  const p = twoCircles();
  const clips: [Animation, Animation] = [
    { kind: "fadeIn", targetId: "a", startMs: 0, durationMs: 1000 }, { kind: "create", targetId: "b", startMs: 0, durationMs: 1000 }];
  p.scene.animations = [{ kind: "parallel", startMs: 0, durationMs: 1000, clips }];
  expect(validateProject(p)).toBeNull();
  const next = normalizeProject(p);
  expect(next.scene.animations).toEqual(clips);
  expect(Object.values(next.scene.elements).map(element => element.layer)).toEqual([0, 1]);
  expect(validateProject(next)).toBeNull();
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

test("a new element appears at the playhead, even while an animation plays", () => {
  const p = twoCircles();
  p.scene.animations = [{ kind: "indicate", targetId: "a", startMs: 1000, durationMs: 1000 }];
  expect(appearanceTime(p.scene, 437)).toBe(400);
  expect(appearanceTime(p.scene, 1500)).toBe(1500);
  expect(appearanceTime(p.scene, -50)).toBe(0);
  // The scene must still show the element for at least one frame.
  expect(appearanceTime(p.scene, 6000)).toBe(5900);
});

test("an element may appear and leave while another animation plays", () => {
  const p = twoCircles();
  p.scene.animations = [{ kind: "indicate", targetId: "a", startMs: 1000, durationMs: 2000 }];
  p.scene.elements.b.appearsAtMs = 1400;
  p.scene.elements.b.disappearsAtMs = 2600;
  expect(validateProject(p)).toBeNull();
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
