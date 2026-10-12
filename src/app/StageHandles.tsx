import { useEffect, useState } from "react";
import type { Project } from "../domain/project";
import { elementLabels } from "../domain/catalog";
import { FRAME, moveElement } from "../domain/placement";
import type { Box } from "../infrastructure/desktop";

// Thin lines and small dots still get a handle about this many scene units across.
const MIN_HANDLE = 0.4;
// Below this many pixels a press is a click that selects, not a drag.
const DRAG_THRESHOLD = 3;
const NUDGE = 0.1;

type Drag = { id: string; box: Box; dx: number; dy: number; active: boolean };

/**
 * A handle over each element on the stage, where Manim drew it. Pressing one selects the element;
 * dragging moves it, in one undo step. Arrow keys nudge the focused handle.
 */
export function StageHandles({ project, atMs, boxes, current, selection, onSelect, onChange }: {
  project: Project; atMs: number; boxes: Record<string, Box>;
  /** Whether `boxes` already show the project as it is now. */
  current: boolean;
  selection: string; onSelect: (id: string) => void;
  /** `sameStep` folds the edit into the previous undo step. */
  onChange: (next: Project, sameStep: boolean) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  // A dropped handle stays where it was let go until Manim's frame shows the move.
  useEffect(() => { if (drag && !drag.active && current) setDrag(null); }, [drag, current]);

  const handles = Object.entries(boxes).flatMap(([id, box]) => {
    const element = project.scene.elements[id];
    if (!element || element.kind === "areaUnderGraph") return [];
    const [left, bottom, right, top] = drag?.id === id
      ? [drag.box[0] + drag.dx, drag.box[1] + drag.dy, drag.box[2] + drag.dx, drag.box[3] + drag.dy] : box;
    const width = Math.max(right - left, MIN_HANDLE), height = Math.max(top - bottom, MIN_HANDLE);
    const [x, y] = [(left + right) / 2, (bottom + top) / 2];
    return [{ id, box, label: elementLabels[element.kind], width, height, style: {
      left: `${(x - width / 2 + FRAME.width / 2) / FRAME.width * 100}%`,
      top: `${(FRAME.height / 2 - y - height / 2) / FRAME.height * 100}%`,
      width: `${width / FRAME.width * 100}%`,
      height: `${height / FRAME.height * 100}%`,
    } }];
  // Smaller handles come later, so they sit above the large ones they overlap, such as axes.
  }).sort((a, b) => b.width * b.height - a.width * a.height);

  const press = (event: React.PointerEvent<HTMLButtonElement>, id: string, box: Box) => {
    if (event.button !== 0) return;
    onSelect(id);
    const handle = event.currentTarget, frame = handle.parentElement!.getBoundingClientRect();
    const origin = project, [startX, startY] = [event.clientX, event.clientY];
    let moved = false;
    handle.setPointerCapture(event.pointerId);
    const follow = (pointer: PointerEvent) => {
      const [px, py] = [pointer.clientX - startX, pointer.clientY - startY];
      if (!moved && Math.hypot(px, py) < DRAG_THRESHOLD) return;
      const [dx, dy] = [px / frame.width * FRAME.width, -py / frame.height * FRAME.height];
      onChange(moveElement(origin, id, atMs, [dx, dy]), moved);
      moved = true;
      setDrag({ id, box, dx, dy, active: true });
    };
    const release = () => {
      handle.removeEventListener("pointermove", follow);
      handle.removeEventListener("pointerup", release);
      handle.removeEventListener("pointercancel", release);
      setDrag(drag => drag && { ...drag, active: false });
    };
    handle.addEventListener("pointermove", follow);
    handle.addEventListener("pointerup", release);
    handle.addEventListener("pointercancel", release);
  };
  const nudge = (event: React.KeyboardEvent, id: string) => {
    const step = event.shiftKey ? NUDGE * 10 : NUDGE;
    const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] } as Record<string, [number, number]>)[event.key];
    if (!delta || event.ctrlKey || event.metaKey || event.altKey) return;
    // The arrows step through frames everywhere else.
    event.preventDefault();
    onChange(moveElement(project, id, atMs, delta), event.repeat);
  };

  return <div className="handles">
    {handles.map(({ id, box, label, style }) =>
      <button key={id} type="button" style={style} aria-label={`Move ${label}`}
        className={"handle" + (id === selection ? " selected" : "") + (drag?.active && drag.id === id ? " dragging" : "")}
        onPointerDown={event => press(event, id, box)} onFocus={() => onSelect(id)} onKeyDown={event => nudge(event, id)} />)}
  </div>;
}
