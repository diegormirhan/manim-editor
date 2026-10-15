import type { Animation, Element, Project } from "./project";

export const animationLabels = {
  create: "Draw · Create", write: "Write · Write", fadeIn: "Fade in · FadeIn",
  grow: "Grow · GrowFromCenter", drawBorder: "Draw border · DrawBorderThenFill",
  fadeOut: "Fade out · FadeOut", moveTo: "Move · MoveTo", rotate: "Rotate · Rotate",
  scaleTo: "Scale · Scale", recolor: "Recolor · SetColor",
  indicate: "Emphasize · Indicate", wiggle: "Wiggle · Wiggle",
  transform: "Transform · Transform", parallel: "Parallel group",
} satisfies Record<Animation["kind"], string>;
const entranceKinds = ["create", "write", "fadeIn", "grow", "drawBorder"] as const;
// A clip carries exactly the extra field its kind names here.
export const clipFields = {
  moveTo: "destination", transform: "destinationId", rotate: "degrees",
  scaleTo: "factor", recolor: "color",
} as const satisfies Partial<Record<Animation["kind"], keyof Animation>>;
export const isEntrance = (kind: Animation["kind"]) => (entranceKinds as readonly string[]).includes(kind);
export const frameAt = (milliseconds: number) => Math.floor(milliseconds * 15 / 1000 + 0.5);
export const childrenOf = (clip: Animation): Animation[] => clip.kind === "parallel" ? clip.clips ?? [] : [clip];
export const leafClips = (scene: Project["scene"]) => (scene.animations ?? []).flatMap(childrenOf);
export const seconds = (ms: number) => (ms / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " s";
export function timecode(ms: number): string {
  const frames = frameAt(ms), two = (value: number) => String(value).padStart(2, "0");
  const total = Math.floor(frames / 15);
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60, frames % 15].map(two).join(":");
}

const RULER_STEPS = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000];

/** Ruler marks on round times: the smallest step that keeps twelve labelled intervals or fewer in view. */
export function rulerTicks(durationMs: number, visibleMs = durationMs): { majors: number[]; minors: number[] } {
  const step = RULER_STEPS.find(candidate => visibleMs / candidate <= 12) ?? RULER_STEPS.at(-1)!;
  const minorStep = step / (step === 200 || step === 2000 ? 4 : 5);
  const majors: number[] = [], minors: number[] = [];
  for (let ms = 0; ms <= durationMs + 1e-6; ms += minorStep) {
    const time = Math.round(ms);
    (time % step === 0 ? majors : minors).push(time);
  }
  return { majors, minors };
}

export function lifetimes(scene: Project["scene"]): Record<string, [number, number]> {
  const spans = Object.fromEntries(Object.entries(scene.elements).map(([id, element]) =>
    [id, [element.appearsAtMs, element.disappearsAtMs ?? scene.durationMs] as [number, number]]));
  for (const clip of leafClips(scene)) {
    const end = clip.startMs + clip.durationMs;
    if (clip.kind === "transform" && spans[clip.destinationId!]) spans[clip.destinationId!][0] = end;
    if (["fadeOut", "transform"].includes(clip.kind) && spans[clip.targetId!])
      spans[clip.targetId!][1] = Math.min(spans[clip.targetId!][1], end);
  }
  return spans;
}

/** An element's timeline layer: its own, or its place in the scene for files from before layers. */
export const layerOf = (scene: Project["scene"], id: string) =>
  scene.elements[id]?.layer ?? Object.keys(scene.elements).indexOf(id);

export function validateTimeline(scene: Project["scene"]): string | null {
  if (frameAt(scene.durationMs) < 1) return "The scene must span at least one frame.";
  const owners = new Set<string>();
  for (const clip of leafClips(scene)) {
    if (clip.kind !== "transform") continue;
    if (!clip.destinationId || !scene.elements[clip.destinationId] || clip.destinationId === clip.targetId)
      return "Transform requires a different, existing destination.";
    if (owners.has(clip.destinationId)) return "Each Transform destination belongs to exactly one transformation.";
    owners.add(clip.destinationId);
  }
  for (const block of scene.animations ?? []) {
    const end = block.startMs + block.durationMs;
    if (end > scene.durationMs) return "The animation would run past the end of the scene.";
    if (frameAt(end) <= frameAt(block.startMs)) return "An animation must span at least one frame.";
    const children = childrenOf(block);
    if (block.kind === "parallel") {
      if (children.length < 2 || children.some(child => child.kind === "parallel"))
        return "A parallel group requires at least two animations and no nested groups.";
      if (children.some(child => child.startMs !== block.startMs || child.durationMs !== block.durationMs))
        return "Group animations must share their start time and duration.";
    } else if (block.clips) return "Only parallel groups accept child animations.";
  }
  const spans = lifetimes(scene), busy = new Map<string, [number, number][]>();
  for (const clip of leafClips(scene)) {
    const target = clip.targetId, element = scene.elements[target ?? ""];
    if (!target || !element) return "The animation references an element that does not exist.";
    for (const [kind, field] of Object.entries(clipFields))
      if ((clip.kind === kind) !== (clip[field as keyof Animation] !== undefined))
        return `The field "${field}" belongs only to animation ${animationLabels[kind as Animation["kind"]]}.`;
    const [from, to] = spans[target], start = clip.startMs, end = start + clip.durationMs;
    if (start < from || start >= to) return "The animation would start while its object is not on screen.";
    if (end > to) return "The animation would run past the moment its object leaves the screen.";
    if (isEntrance(clip.kind) && (owners.has(target) || start !== from))
      return "An entrance plays once, starting when its object appears.";
    if (clip.kind === "transform" && (scene.elements[clip.destinationId!].disappearsAtMs ?? scene.durationMs) <= end)
      return "The destination must remain in the scene after Transform.";
    busy.set(target, [...busy.get(target) ?? [], [start, end]]);
  }
  for (const times of busy.values())
    if (overlapping(times)) return "An object plays one animation at a time. Move one after the other.";
  const layers = new Map<number, [number, number][]>();
  for (const id of Object.keys(scene.elements)) layers.set(layerOf(scene, id), [...layers.get(layerOf(scene, id)) ?? [], spans[id]]);
  for (const [layer, times] of layers)
    if (overlapping(times)) return `Two objects on layer ${layer + 1} overlap in time. Move one to another layer.`;
  return null;
}

const overlapping = (spans: [number, number][]) =>
  [...spans].sort((a, b) => a[0] - b[0]).some(([start], index, sorted) => index > 0 && start < sorted[index - 1][1]);

/** Gives every element an explicit layer and splits old parallel groups into the overlapping animations they stood for. */
export function normalizeProject(project: Project): Project {
  const next = structuredClone(project);
  Object.values(next.scene.elements).forEach((element, index) => { element.layer ??= index; });
  if (next.scene.animations) next.scene.animations = next.scene.animations.flatMap(childrenOf);
  return next;
}

/** Where an element added at `atMs` appears: on the 100 ms grid, inside the scene. */
export function appearanceTime(scene: Project["scene"], atMs: number): number {
  const latest = Math.max(0, scene.durationMs - 100);
  return Math.min(Math.max(0, Math.round(atMs / 100) * 100), latest);
}

/** `preferred` when nothing on it overlaps `span`, otherwise a new layer above all the others. */
export function freeLayer(scene: Project["scene"], preferred: number, [start, end]: [number, number]): number {
  const spans = lifetimes(scene), ids = Object.keys(scene.elements);
  const clear = ids.every(id => layerOf(scene, id) !== preferred || spans[id][1] <= start || spans[id][0] >= end);
  return clear ? preferred : Math.max(-1, ...ids.map(id => layerOf(scene, id))) + 1;
}

const NEW_ANIMATION_MS = 1000;

/**
 * Adds a `kind` animation of `targetId`: an entrance where the object appears, an exit after everything else it
 * plays, anything else at `atMs` or right after the animation playing then. It lasts a second or what room is left.
 * Returns the reason instead when it cannot fit.
 */
export function addAnimation(project: Project, targetId: string, kind: Animation["kind"], atMs: number): Project | string {
  const next = structuredClone(project), scene = next.scene, element = scene.elements[targetId];
  const [from, to] = lifetimes(scene)[targetId];
  const own = leafClips(scene).filter(clip => clip.targetId === targetId).sort((a, b) => a.startMs - b.startMs);
  if (isEntrance(kind) && own.some(clip => isEntrance(clip.kind))) return "This object already has an entrance. Remove it first, or choose another kind.";
  let start = isEntrance(kind) ? from : Math.max(from, Math.round(atMs / 100) * 100);
  if (!isEntrance(kind))
    for (const clip of own) if (start >= clip.startMs && start < clip.startMs + clip.durationMs) start = clip.startMs + clip.durationMs;
  if (kind === "fadeOut" || kind === "transform") start = Math.max(start, ...own.map(clip => clip.startMs + clip.durationMs));
  const limit = Math.min(to, ...own.map(clip => clip.startMs).filter(time => time >= start));
  if (limit - start < 100) return "There is no room for it from the playhead on. Move the playhead, or keep the object longer.";
  const clip: Animation = { kind, targetId, startMs: start, durationMs: Math.min(NEW_ANIMATION_MS, limit - start) };
  if (kind === "moveTo") clip.destination = [element.position[0] + 2, element.position[1], 0];
  if (kind === "rotate") clip.degrees = 90;
  if (kind === "scaleTo") clip.factor = 1.5;
  if (kind === "recolor") clip.color = "#FC6255";
  scene.animations = [...scene.animations ?? [], clip];
  if (kind === "transform") {
    const end = start + clip.durationMs, destinationId = crypto.randomUUID();
    // The destination takes over the object's layer, like the next clip on a track.
    const layer = freeLayer(scene, layerOf(scene, targetId), [end, scene.durationMs]);
    const destination = { ...structuredClone(element), color: "#FC6255", layer };
    delete destination.disappearsAtMs;
    scene.elements[destinationId] = destination;
    clip.destinationId = destinationId;
  }
  return next;
}

/** A Transform owns its destination, so removing the clip removes what it created. */
export function removeAnimation(project: Project, index: number): Project {
  const block = project.scene.animations?.[index];
  if (!block) return project;
  let next: Project = { ...project, scene: { ...project.scene, animations: project.scene.animations!.filter((_, i) => i !== index) } };
  for (const clip of childrenOf(block))
    if (clip.kind === "transform" && clip.destinationId) next = removeElement(next, clip.destinationId);
  return next;
}

/** Removes the element, its animations and every element built on it, such as a graph's area or a brace. */
export function removeElement(project: Project, identifier: string): Project {
  const dependent = Object.keys(project.scene.elements).find(id => dependsOn(project.scene.elements[id], identifier));
  if (dependent) return removeElement(removeElement(project, dependent), identifier);
  const elements = { ...project.scene.elements };
  delete elements[identifier];
  const animations = (project.scene.animations ?? []).flatMap(childrenOf)
    .filter(clip => clip.targetId !== identifier && clip.destinationId !== identifier);
  return { ...project, scene: { ...project.scene, elements, animations } };
}

/** Whether `element` is drawn from the element `id`: a graph on its axes, an area under its graph, a brace around it. */
export const dependsOn = (element: Element, id: string) =>
  ("axesId" in element && element.axesId === id) || ("graphId" in element && element.graphId === id)
  || ("targetId" in element && element.targetId === id);
