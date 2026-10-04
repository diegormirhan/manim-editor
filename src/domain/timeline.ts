import type { Animation, Project } from "./project";

export const animationLabels = {
  create: "Draw · Create", write: "Write · Write", fadeIn: "Fade in · FadeIn",
  grow: "Grow · GrowFromCenter", drawBorder: "Draw border · DrawBorderThenFill",
  fadeOut: "Fade out · FadeOut", moveTo: "Move · MoveTo", rotate: "Rotate · Rotate",
  scaleTo: "Scale · Scale", recolor: "Recolor · SetColor",
  indicate: "Emphasize · Indicate", wiggle: "Wiggle · Wiggle",
  transform: "Transform · Transform", parallel: "Parallel group",
} satisfies Record<Animation["kind"], string>;
export const entranceKinds = ["create", "write", "fadeIn", "grow", "drawBorder"] as const;
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

export function validateTimeline(scene: Project["scene"]): string | null {
  if (frameAt(scene.durationMs) < 1) return "The scene must span at least one frame.";
  const owners = new Map<string, Animation>();
  for (const clip of leafClips(scene)) {
    if (clip.kind !== "transform") continue;
    if (!clip.destinationId || !scene.elements[clip.destinationId] || clip.destinationId === clip.targetId)
      return "Transform requires a different, existing destination.";
    if (owners.has(clip.destinationId)) return "Each Transform destination belongs to exactly one transformation.";
    owners.set(clip.destinationId, clip);
  }
  const available = new Map(Object.entries(scene.elements).filter(([id]) => !owners.has(id)).map(([id, item]) => [id, item.appearsAtMs]));
  const entered = new Set<string>(), removed = new Set<string>();
  let previousEnd = 0;
  for (const block of [...(scene.animations ?? [])].sort((a, b) => a.startMs - b.startMs)) {
    const start = block.startMs, end = start + block.durationMs;
    if (start < previousEnd || end > scene.durationMs) return "Animations must be sequential and end within the scene.";
    if (frameAt(end) <= frameAt(start)) return "An animation must span at least one frame.";
    const children = childrenOf(block);
    if (block.kind === "parallel") {
      if (children.length < 2 || children.some(child => child.kind === "parallel"))
        return "A parallel group requires at least two animations and no nested groups.";
      if (children.some(child => child.startMs !== start || child.durationMs !== block.durationMs))
        return "Group animations must share their start time and duration.";
    } else if (block.clips) return "Only parallel groups accept child animations.";
    const touched = new Set<string>(), pending: [string, number][] = [];
    for (const clip of children) {
      const target = clip.targetId, element = scene.elements[target ?? ""];
      if (!target || !element) return "The animation references an element that does not exist.";
      if (touched.has(target)) return "An element cannot have two animations in the same group.";
      touched.add(target);
      if (removed.has(target) || !available.has(target) || start < available.get(target)!)
        return "The element is not available at this time.";
      if (end > (element.disappearsAtMs ?? scene.durationMs)) return "The animation extends beyond the element's end.";
      if (isEntrance(clip.kind)) {
        if (entered.has(target) || owners.has(target) || start !== available.get(target))
          return "An entrance must start with its element and occur only once.";
        entered.add(target);
      }
      for (const [kind, field] of Object.entries(clipFields))
        if ((clip.kind === kind) !== (clip[field as keyof Animation] !== undefined))
          return `The field "${field}" belongs only to animation ${animationLabels[kind as Animation["kind"]]}.`;
      if (clip.kind === "transform") {
        const destination = clip.destinationId!;
        if (available.has(destination) || removed.has(destination) || touched.has(destination)) return "The Transform destination must be hidden.";
        if ((scene.elements[destination].disappearsAtMs ?? scene.durationMs) <= end) return "The destination must remain in the scene after Transform.";
        touched.add(destination); pending.push([destination, end]); removed.add(target);
      }
      if (clip.kind === "fadeOut") removed.add(target);
    }
    for (const [id, time] of pending) available.set(id, time);
    for (const [id, item] of Object.entries(scene.elements)) {
      const times = [item.disappearsAtMs ?? scene.durationMs];
      if (!owners.has(id)) times.push(item.appearsAtMs);
      if (times.some(time => start < time && time < end))
        return "An element appears or disappears during another animation: adjust its timing or use a parallel group.";
    }
    previousEnd = end;
  }
  return null;
}

/** Where an element added at `atMs` may appear: on the 100 ms grid, inside the scene, never mid-animation. */
export function appearanceTime(scene: Project["scene"], atMs: number): number {
  const latest = Math.max(0, scene.durationMs - 100);
  const time = Math.min(Math.max(0, Math.round(atMs / 100) * 100), latest);
  const block = (scene.animations ?? []).find(clip => clip.startMs < time && time < clip.startMs + clip.durationMs);
  if (!block) return time;
  const end = block.startMs + block.durationMs;
  return end <= latest ? end : block.startMs;
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

export function removeElement(project: Project, identifier: string): Project {
  const elements = { ...project.scene.elements };
  delete elements[identifier];
  const retained = (clip: Animation) => clip.targetId !== identifier && clip.destinationId !== identifier;
  const animations = (project.scene.animations ?? []).flatMap(clip => {
    if (clip.kind !== "parallel") return retained(clip) ? [clip] : [];
    const clips = childrenOf(clip).filter(retained);
    return clips.length > 1 ? [{ ...clip, clips: clips as [Animation, Animation, ...Animation[]] }] : clips;
  });
  return { ...project, scene: { ...project.scene, elements, animations } };
}
