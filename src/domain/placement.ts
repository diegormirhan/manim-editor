import { SHARED_PROPERTIES } from "../../contracts/schema.mjs";
import type { Element, Project } from "./project";
import { leafClips } from "./timeline";
import { derivedKinds } from "./catalog";

/** Manim's camera frame in scene units, centred on the origin. */
export const FRAME = { width: 128 / 9, height: 8 };
/** Where an element on screen sits, in scene units: left, bottom, right, top. */
export type Box = [number, number, number, number];

const hundredths = (value: number) => Math.round(value * 100) / 100;

/**
 * Moves an element, as it stands at `atMs`, by `delta` scene units. Once a Move animation has
 * ended the element stands at that move's destination, so the destination moves instead.
 */
export function moveElement(project: Project, id: string, atMs: number, [dx, dy]: [number, number]): Project {
  const next = structuredClone(project), element = next.scene.elements[id];
  if (!element || derivedKinds.includes(element.kind)) return project;
  const shift = (point: [number, number, number]) => {
    point[0] = hundredths(point[0] + dx);
    point[1] = hundredths(point[1] + dy);
  };
  const move = leafClips(next.scene)
    .filter(clip => clip.kind === "moveTo" && clip.targetId === id && clip.startMs + clip.durationMs <= atMs)
    .sort((a, b) => a.startMs - b.startMs).at(-1);
  if (move) shift(move.destination!);
  else {
    shift(element.position);
    if ("end" in element) shift(element.end);
  }
  return next;
}

/** Applies `change` to an element that can be placed; a derived one follows its source instead. */
function reshape(project: Project, id: string, change: (element: Element) => Partial<Element>): Project {
  const element = project.scene.elements[id];
  if (!element || derivedKinds.includes(element.kind)) return project;
  return { ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [id]: { ...element, ...change(element) } as Element } } };
}

/** Scales an element by `factor`. Scale animations multiply what it starts with, so the change shows at every moment. */
export function scaleElement(project: Project, id: string, factor: number): Project {
  const { minimum = 0, maximum = Infinity } = SHARED_PROPERTIES.scale;
  return reshape(project, id, element => ({ scale: Math.min(maximum, Math.max(minimum, hundredths((element.scale ?? 1) * factor))) }));
}

/** Turns an element by `degrees`, counterclockwise as Manim measures them. Rotate animations add to it. */
export function rotateElement(project: Project, id: string, degrees: number): Project {
  const halfTurns = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;
  return reshape(project, id, element => ({ rotationDegrees: halfTurns(Math.round((element.rotationDegrees ?? 0) + degrees)) }));
}

/**
 * Pulls a box dragged by `delta` onto the nearest alignment within `tolerance` units on each
 * axis: the frame's edges and centre, or another box's. `guides` are the lines it aligned on.
 */
export function alignDrag(box: Box, [dx, dy]: [number, number], others: Box[], tolerance: number) {
  const lines = (low: number, high: number) => [low, (low + high) / 2, high];
  const snap = (drag: number, edges: number[], targets: number[]) => {
    let best: { drag: number; at: number } | undefined;
    for (const target of targets) for (const edge of edges) {
      const snapped = target - edge;
      if (Math.abs(snapped - drag) <= tolerance && (!best || Math.abs(snapped - drag) < Math.abs(best.drag - drag))) best = { drag: snapped, at: target };
    }
    return best;
  };
  const [left, bottom, right, top] = box;
  const x = snap(dx, lines(left, right), [...lines(-FRAME.width / 2, FRAME.width / 2), ...others.flatMap(([l, , r]) => lines(l, r))]);
  const y = snap(dy, lines(bottom, top), [...lines(-FRAME.height / 2, FRAME.height / 2), ...others.flatMap(([, b, , t]) => lines(b, t))]);
  return { delta: [x?.drag ?? dx, y?.drag ?? dy] as [number, number], guides: { x: x?.at, y: y?.at } };
}
