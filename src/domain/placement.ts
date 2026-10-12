import type { Project } from "./project";
import { leafClips } from "./timeline";

/** Manim's camera frame in scene units, centred on the origin. */
export const FRAME = { width: 128 / 9, height: 8 };

const hundredths = (value: number) => Math.round(value * 100) / 100;

/**
 * Moves an element, as it stands at `atMs`, by `delta` scene units. Once a Move animation has
 * ended the element stands at that move's destination, so the destination moves instead.
 */
export function moveElement(project: Project, id: string, atMs: number, [dx, dy]: [number, number]): Project {
  const next = structuredClone(project), element = next.scene.elements[id];
  if (!element || element.kind === "areaUnderGraph") return project;
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
    if (element.kind === "line" || element.kind === "arrow") shift(element.end);
  }
  return next;
}
