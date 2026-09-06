import type { Animation, Project } from "./project";
import { childrenOf, isEntrance } from "./timeline";

export type ClipTarget = { type: "element"; id: string } | { type: "animation"; index: number };
export type ClipGesture = "move" | "start" | "end";
export const SNAP_MS = 100;
export const MIN_CLIP_MS = 100;

export function retimeAnimation(project: Project, index: number, startMs: number, durationMs: number): Project {
  const next = structuredClone(project), block = next.scene.animations![index];
  const oldStart = block.startMs;
  block.startMs = startMs; block.durationMs = durationMs;
  for (const clip of childrenOf(block)) {
    clip.startMs = startMs; clip.durationMs = durationMs;
    if (isEntrance(clip.kind) && clip.targetId && next.scene.elements[clip.targetId]?.appearsAtMs === oldStart)
      next.scene.elements[clip.targetId].appearsAtMs = startMs;
  }
  return next;
}

export function editClip(project: Project, target: ClipTarget, gesture: ClipGesture, deltaMs: number): Project {
  if (!Number.isFinite(deltaMs)) return project;
  const next = structuredClone(project), scene = next.scene;
  const block = target.type === "animation" ? scene.animations?.[target.index] : undefined;
  const element = target.type === "element" ? scene.elements[target.id] : undefined;
  if (!block && !element) return project;
  const start = block?.startMs ?? element!.appearsAtMs;
  const end = block ? start + block.durationMs : element!.disappearsAtMs ?? scene.durationMs;
  const snapped = Math.round(deltaMs / SNAP_MS) * SNAP_MS;
  let newStart = start, newEnd = end;
  if (gesture === "move") {
    // Scene-ending presence clips can slide by trimming their open end.
    const openEnd = element && element.disappearsAtMs === undefined;
    const delta = Math.min(Math.max(snapped, -start), openEnd ? scene.durationMs - MIN_CLIP_MS - start : scene.durationMs - end);
    newStart += delta;
    if (!openEnd) newEnd += delta;
  } else if (gesture === "start") newStart = Math.min(end - MIN_CLIP_MS, Math.max(0, start + snapped));
  else newEnd = Math.max(start + MIN_CLIP_MS, Math.min(scene.durationMs, end + snapped));
  if (target.type === "animation") return retimeAnimation(project, target.index, newStart, newEnd - newStart);
  element!.appearsAtMs = newStart;
  if (gesture === "end" || element!.disappearsAtMs !== undefined) element!.disappearsAtMs = newEnd;
  if (newStart !== start) {
    for (const clip of scene.animations ?? []) {
      if (clip.kind === "parallel") {
        // Shared blocks move from their own lane.
        continue;
      }
      if (clip.targetId === target.id && (gesture === "move" || isEntrance(clip.kind)))
        clip.startMs += newStart - start;
    }
  }
  return next;
}
