import { useEffect, useRef, useState } from "react";
import type { Project } from "../domain/project";
import { elementLabels } from "../domain/catalog";
import { FRAME, alignDrag, moveElement, rotateElement, scaleElement, type Box } from "../domain/placement";

// Thin lines and small dots still get a handle about this many scene units across.
const MIN_HANDLE = 0.4;
// Below this many pixels a press is a click that selects, not a drag.
const DRAG_THRESHOLD = 3;
// An alignment pulls a dragged object from this many pixels away.
const SNAP_PX = 6;
const NUDGE = 0.1;

/** A gesture on one element: the box it started from, and how far it has moved, scaled and turned it. */
type Gesture = { id: string; box: Box; dx: number; dy: number; scale: number; turn: number; active: boolean };
type Guides = { x?: number; y?: number };
const percent = (value: number, whole: number) => `${value / whole * 100}%`;

/** Follows a press until release; `follow` runs once the pointer has travelled past the click threshold. */
function track(event: React.PointerEvent<HTMLElement>, follow: (pointer: PointerEvent, first: boolean) => void, release: () => void) {
  const target = event.currentTarget, [startX, startY] = [event.clientX, event.clientY];
  let moved = false;
  target.setPointerCapture(event.pointerId);
  const move = (pointer: PointerEvent) => {
    if (!moved && Math.hypot(pointer.clientX - startX, pointer.clientY - startY) < DRAG_THRESHOLD) return;
    follow(pointer, !moved);
    moved = true;
  };
  const end = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", end);
    target.removeEventListener("pointercancel", end);
    release();
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", end);
  target.addEventListener("pointercancel", end);
}

/**
 * A handle over each element on the stage, where Manim drew it. Pressing one selects the element
 * and dragging moves it; the selected one also scales from its corners and turns from its knob.
 * Each gesture is one undo step. Arrow keys nudge the focused handle.
 */
export function StageHandles({ project, atMs, boxes, current, selection, alignmentGuides, onSelect, onChange }: {
  project: Project; atMs: number; boxes: Record<string, Box>;
  /** Whether `boxes` already show the project as it is now. */
  current: boolean;
  selection: string; alignmentGuides: boolean; onSelect: (id: string) => void;
  /** `sameStep` folds the edit into the previous undo step. */
  onChange: (next: Project, sameStep: boolean) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [guides, setGuides] = useState<Guides>({});
  // A released handle stays where it was let go until Manim's frame shows the change.
  useEffect(() => { if (gesture && !gesture.active && current) setGesture(null); }, [gesture, current]);

  const handles = Object.entries(boxes).flatMap(([id, box]) => {
    const element = project.scene.elements[id];
    if (!element || element.kind === "areaUnderGraph") return [];
    const shown = gesture?.id === id ? gesture : undefined, [left, bottom, right, top] = box;
    const width = Math.max((right - left) * (shown?.scale ?? 1), MIN_HANDLE), height = Math.max((top - bottom) * (shown?.scale ?? 1), MIN_HANDLE);
    const x = (left + right) / 2 + (shown?.dx ?? 0), y = (bottom + top) / 2 + (shown?.dy ?? 0);
    return [{ id, box, label: elementLabels[element.kind], area: width * height, style: {
      left: percent(x - width / 2 + FRAME.width / 2, FRAME.width), top: percent(FRAME.height / 2 - y - height / 2, FRAME.height),
      width: percent(width, FRAME.width), height: percent(height, FRAME.height),
      transform: shown?.turn ? `rotate(${shown.turn}deg)` : undefined,
    } }];
  // Smaller handles come later, so they sit above the large ones they overlap, such as axes.
  }).sort((a, b) => b.area - a.area);

  const unit = () => FRAME.width / frame.current!.getBoundingClientRect().width;
  /** Where a box's centre sits on screen, in client pixels. */
  const centre = ([left, bottom, right, top]: Box) => {
    const rect = frame.current!.getBoundingClientRect();
    return [rect.left + ((left + right) / 2 + FRAME.width / 2) / FRAME.width * rect.width,
      rect.top + (FRAME.height / 2 - (bottom + top) / 2) / FRAME.height * rect.height];
  };
  const release = () => { setGuides({}); setGesture(shown => shown && { ...shown, active: false }); };
  const show = (id: string, box: Box, change: Partial<Gesture>) => setGesture({ id, box, dx: 0, dy: 0, scale: 1, turn: 0, active: true, ...change });

  const move = (event: React.PointerEvent<HTMLElement>, id: string, box: Box) => {
    if (event.button !== 0) return;
    onSelect(id);
    const origin = project, scale = unit(), [startX, startY] = [event.clientX, event.clientY];
    const others = Object.entries(boxes).filter(([other]) => other !== id).map(([, other]) => other);
    track(event, (pointer, first) => {
      let delta: [number, number] = [(pointer.clientX - startX) * scale, (startY - pointer.clientY) * scale];
      let lines: Guides = {};
      if (alignmentGuides && !pointer.altKey) ({ delta, guides: lines } = alignDrag(box, delta, others, SNAP_PX * scale));
      setGuides(lines);
      onChange(moveElement(origin, id, atMs, delta), !first);
      show(id, box, { dx: delta[0], dy: delta[1] });
    }, release);
  };
  const resize = (event: React.PointerEvent<HTMLElement>, id: string, box: Box) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    const origin = project, [x, y] = centre(box), reach = Math.hypot(event.clientX - x, event.clientY - y) || 1;
    track(event, (pointer, first) => {
      const factor = Math.hypot(pointer.clientX - x, pointer.clientY - y) / reach;
      onChange(scaleElement(origin, id, factor), !first);
      show(id, box, { scale: factor });
    }, release);
  };
  const turn = (event: React.PointerEvent<HTMLElement>, id: string, box: Box) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    const origin = project, [x, y] = centre(box), from = Math.atan2(event.clientY - y, event.clientX - x);
    track(event, (pointer, first) => {
      const free = (Math.atan2(pointer.clientY - y, pointer.clientX - x) - from) * 180 / Math.PI;
      const degrees = pointer.shiftKey ? Math.round(free / 15) * 15 : free;
      // Screen angles grow clockwise and Manim's counterclockwise.
      onChange(rotateElement(origin, id, -degrees), !first);
      show(id, box, { turn: degrees });
    }, release);
  };
  const nudge = (event: React.KeyboardEvent, id: string) => {
    const step = event.shiftKey ? NUDGE * 10 : NUDGE;
    const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] } as Record<string, [number, number]>)[event.key];
    if (!delta || event.ctrlKey || event.metaKey || event.altKey) return;
    // The arrows step through frames everywhere else.
    event.preventDefault();
    onChange(moveElement(project, id, atMs, delta), event.repeat);
  };

  return <div className="handles" ref={frame}>
    {handles.map(({ id, box, label, style }) =>
      <button key={id} type="button" style={style} aria-label={`Move ${label}`}
        className={"handle" + (id === selection ? " selected" : "") + (gesture?.active && gesture.id === id ? " dragging" : "")}
        onPointerDown={event => move(event, id, box)} onFocus={() => onSelect(id)} onKeyDown={event => nudge(event, id)}>
        {id === selection && <>
          {["nw", "ne", "sw", "se"].map(corner =>
            <span key={corner} className={"corner " + corner} aria-hidden="true" onPointerDown={event => resize(event, id, box)} />)}
          <span className="knob" aria-hidden="true" onPointerDown={event => turn(event, id, box)} />
        </>}
      </button>)}
    {guides.x !== undefined && <span className="guide vertical" style={{ left: percent(guides.x + FRAME.width / 2, FRAME.width) }} />}
    {guides.y !== undefined && <span className="guide horizontal" style={{ top: percent(FRAME.height / 2 - guides.y, FRAME.height) }} />}
  </div>;
}
