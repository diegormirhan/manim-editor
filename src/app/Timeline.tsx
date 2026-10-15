import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import type { Element, Project } from "../domain/project";
import { editClip, moveToLayer, type ClipTarget, type ClipGesture } from "../domain/clip-editing";
import { validateProject } from "../domain/project";
import { animationLabels, layerOf, lifetimes, rulerTicks, seconds } from "../domain/timeline";
import { elementLabels, elementSummary, positionWarning } from "../domain/catalog";
import { AnimationIcon, ElementIcon } from "./ElementIcon";

// Clip colour follows what the object is, so a glance at the timeline, or a project's thumbnail, reads the scene.
export const toneOf = (kind: Element["kind"]) =>
  ["mathTex", "tex", "decimalNumber", "matrix"].includes(kind) ? "tex"
  : ["text", "bulletedList", "code"].includes(kind) ? "text"
  : ["functionGraph", "areaUnderGraph", "barChart"].includes(kind) ? "graph"
  : ["axes", "numberPlane", "numberLine"].includes(kind) ? "coords" : "shape";

type TimelineProps = {
  project: Project; selection: string; onSelect: (id: string) => void;
  selectedAnimation: number | null; onSelectAnimation: (index: number, target: string) => void;
  onChange: (project: Project) => void; onError: (message: string) => void;
  playheadMs: number; onScrub: (ms: number) => void;
  zoom: number; onZoom: (zoom: number) => void;
  snapping: boolean;
};
type Magnet = { ms: number; label: string };
/** A row of the timeline as laid out when a drag began, so the pointer can find the layer it is over. */
type Row = { layer: number; top: number; bottom: number };
type Drag = {
  original: Project; target: ClipTarget; mode: ClipGesture; x: number; width: number; next: Project; moved: boolean;
  magnets: Magnet[]; movable: boolean; rows: Row[]; from?: Row; layer?: number;
};
// Edges within this many pixels of a magnet lock onto it.
const MAGNET_PX = 6;
type ClipProps = {
  start: number; end: number; duration: number; label: string; name: string; animation?: boolean;
  grips: { start: boolean; end: boolean }; locked?: boolean; className?: string; style?: CSSProperties;
  tone?: string; icon?: ReactNode;
  onBegin: (event: PointerEvent<HTMLDivElement>, mode: ClipGesture) => void;
  onMove: (event: PointerEvent<HTMLDivElement>) => void; onFinish: () => void; onCancel: () => void;
  onKey: (event: KeyboardEvent, mode: ClipGesture) => void; onSelect: () => void;
};

function Clip({ start, end, duration, label, name, animation, grips, locked, className = "", style, tone, icon, onBegin, onMove, onFinish, onCancel, onKey, onSelect }: ClipProps) {
  const left = Math.max(0, Math.min(100, start / duration * 100));
  const width = Math.max(0.2, Math.min(100 - left, (end - start) / duration * 100));
  return <div className={"editable-clip " + (animation ? "animation " : "presence ") + (locked ? "owned " : "") + className} data-tone={tone}
    style={{ ...style, left: left + "%", width: width + "%" }}
    title={label + " · " + seconds(start) + "–" + seconds(end) + (locked ? " · Partly timed by its animations" : "")}
    onPointerDown={event => {
      if (event.button !== 0) return;
      const mode = (event.target as HTMLElement).closest<HTMLElement>("[data-gesture]")?.dataset.gesture as ClipGesture ?? "move";
      event.currentTarget.setPointerCapture(event.pointerId); onBegin(event, mode);
      // Focus follows the grab, so Esc cancels this drag and the arrows nudge this clip.
      (event.target as HTMLElement).closest("button")?.focus({ preventScroll: true });
    }} onPointerMove={onMove} onPointerUp={onFinish} onPointerCancel={onCancel}
    onKeyDown={event => { if (event.key === "Escape") { onCancel(); event.stopPropagation(); } }}>
    {grips.start && <button className="clip-grip start" data-gesture="start" aria-label={"Adjust start of " + name} onKeyDown={event => onKey(event, "start")} />}
    <button className="clip-body" data-gesture="move" aria-label={"Select " + name.toLowerCase()} onClick={onSelect}
      onKeyDown={event => onKey(event, event.shiftKey && grips.end ? "end" : "move")}>
      {icon}<span>{label}</span>
    </button>
    <span className="clip-duration" aria-hidden="true">{locked && <Lock size={10} />}{seconds(end - start)}</span>
    {grips.end && <button className="clip-grip end" data-gesture="end" aria-label={"Adjust end of " + name} onKeyDown={event => onKey(event, "end")} />}
  </div>;
}

// Ticks only change with the scene length and the zoom, not with every playhead frame.
const RulerTicks = memo(function RulerTicks({ durationMs, zoom }: { durationMs: number; zoom: number }) {
  const ticks = rulerTicks(durationMs, durationMs / zoom);
  const at = (ms: number) => ({ left: ms / durationMs * 100 + "%" });
  return <>
    {ticks.minors.map(ms => <i key={"m" + ms} className="tick" style={at(ms)} />)}
    {ticks.majors.map(ms => <i key={"M" + ms} className="tick major" style={at(ms)} />)}
    {ticks.majors.map(ms => <span key={"l" + ms} style={at(ms)}>{seconds(ms)}</span>)}
  </>;
});

/** The span a clip occupies in a project, for the readout shown while it is dragged. */
function spanOf(project: Project, target: ClipTarget): [number, number] {
  if (target.type === "element") return lifetimes(project.scene)[target.id];
  const block = project.scene.animations![target.index];
  return [block.startMs, block.startMs + block.durationMs];
}

/** Times a dragged clip can lock onto: the playhead, the scene bounds and the edges of every clip that stays put. */
function magnetsFor(project: Project, target: ClipTarget, playheadMs: number): Magnet[] {
  const magnets = [{ ms: playheadMs, label: "playhead" }, { ms: 0, label: "scene start" }, { ms: project.scene.durationMs, label: "scene end" }];
  for (const [id, [start, end]] of Object.entries(lifetimes(project.scene)))
    if (target.type !== "element" || target.id !== id) magnets.push({ ms: start, label: "a clip start" }, { ms: end, label: "a clip end" });
  (project.scene.animations ?? []).forEach((block, index) => {
    // A dragged object carries its own animations along.
    const carried = target.type === "element" ? block.targetId === target.id : target.index === index;
    if (!carried) magnets.push({ ms: block.startMs, label: "a clip start" }, { ms: block.startMs + block.durationMs, label: "an animation end" });
  });
  return magnets;
}

/**
 * The scene as a video editor shows it: one row per layer, higher layers on top, each object a clip on its
 * layer with its animations inside it. Dragging a clip retimes it; dragging an object up or down changes its layer.
 */
export function Timeline({ project, selection, onSelect, selectedAnimation, onSelectAnimation, onChange, onError, playheadMs, onScrub, zoom, onZoom, snapping }: TimelineProps) {
  const drag = useRef<Drag | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const times = useRef<HTMLDivElement>(null);
  const corner = useRef<HTMLSpanElement>(null);
  const tracks = useRef<HTMLDivElement>(null);
  // Lane geometry as last laid out; scrollLeft is kept live because zooming out can clamp it.
  const geometry = useRef({ scrollLeft: 0, laneLeft: 0, laneWidth: 0 });
  const pointerAnchor = useRef<number | null>(null);
  const zoomed = useRef(zoom);
  const durationMs = project.scene.durationMs;
  // The time under the pointer (Ctrl+wheel) or the playhead (keys, buttons) keeps its place on screen.
  useLayoutEffect(() => {
    const node = scroller.current, lane = times.current, labels = corner.current?.offsetWidth ?? 0;
    if (!node || !lane || zoomed.current === zoom) return;
    zoomed.current = zoom;
    const before = geometry.current;
    const playheadX = before.laneLeft + playheadMs / durationMs * before.laneWidth - before.scrollLeft;
    const x = pointerAnchor.current !== null ? pointerAnchor.current - node.getBoundingClientRect().left
      : playheadX >= labels && playheadX <= node.clientWidth ? playheadX : labels + (node.clientWidth - labels) / 2;
    pointerAnchor.current = null;
    const fraction = before.laneWidth ? (x + before.scrollLeft - before.laneLeft) / before.laneWidth : 0;
    node.scrollLeft = lane.offsetLeft + fraction * lane.clientWidth - x;
  }, [zoom]);
  useLayoutEffect(() => {
    const node = scroller.current, lane = times.current;
    if (node && lane) geometry.current = { scrollLeft: node.scrollLeft, laneLeft: lane.offsetLeft, laneWidth: lane.clientWidth };
  });
  // Playback, frame steps and Home/End bring an off-screen playhead back into view.
  useEffect(() => {
    const node = scroller.current, lane = times.current, labels = corner.current?.offsetWidth ?? 0;
    if (!node || !lane || zoom === 1) return;
    const x = lane.offsetLeft + playheadMs / durationMs * lane.clientWidth;
    if (x < node.scrollLeft + labels || x > node.scrollLeft + node.clientWidth - 16)
      node.scrollLeft = x - labels - (node.clientWidth - labels) * 0.1;
  }, [playheadMs]);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      // Ctrl+wheel zooms the timeline instead of the whole window.
      event.preventDefault();
      pointerAnchor.current = event.clientX;
      onZoom(zoomed.current * Math.exp(-event.deltaY * 0.0025));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onZoom]);
  const [draft, setDraft] = useState<{ project: Project; id?: string; dy: number; layer?: number } | null>(null);
  const [guide, setGuide] = useState<number | null>(null);
  const [hint, setHint] = useState<{ text: string; invalid?: boolean }>({ text: "" });
  const active = draft?.project ?? project, scene = active.scene;
  const spans = lifetimes(scene);
  // A rejected gesture explains itself until the next edit, then the hint returns to idle.
  useEffect(() => { if (!drag.current) setHint(current => current.text ? { text: "" } : current); }, [project]);
  const cancel = () => { drag.current = null; setDraft(null); setGuide(null); setHint({ text: "" }); };
  // Rejections are reported where the gesture happened, not only in the preview status.
  const reject = (message: string) => { onError(message); setHint({ text: message, invalid: true }); };
  const commit = (next: Project) => {
    const error = validateProject(next);
    if (error) { reject(error + " The clip went back to where it was."); return; }
    if (JSON.stringify(next) !== JSON.stringify(project)) onChange(next);
  };
  /** The project a drag would leave behind: retimed, and moved to the layer under the pointer. */
  const result = (current: Drag) => current.target.type === "element" && current.layer !== undefined
    ? moveToLayer(current.next, current.target.id, current.layer) : current.next;
  const finish = () => {
    const current = drag.current;
    const kept = hint.invalid ? hint : null;
    if (current?.moved) {
      if (JSON.stringify(current.original) !== JSON.stringify(project)) reject("The project changed during the gesture. Try again.");
      else { cancel(); commit(result(current)); return; }
    }
    cancel();
    if (kept) setHint(kept);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // Below the click threshold the time stays exactly as it was, so a move between layers never retimes.
    const pixels = current.movable && Math.abs(event.clientX - current.x) >= 3 ? event.clientX - current.x : 0;
    // Above the top row is a new layer; below the bottom one, the first.
    const row = current.rows.find(item => event.clientY >= item.top && event.clientY < item.bottom)
      ?? (event.clientY < current.rows[0].top ? current.rows[0] : current.rows.at(-1)!);
    const changesLayer = !!current.from && current.mode === "move" && row.layer !== current.from.layer;
    if (!current.moved && !pixels && !changesLayer) return;
    current.moved = true;
    current.layer = changesLayer ? row.layer : undefined;
    const msPerPixel = project.scene.durationMs / current.width;
    // Alt flips the snapping preference for this gesture, as in most editors.
    const magnets = snapping !== event.altKey && pixels ? current.magnets : [];
    current.next = editClip(current.original, current.target, current.mode, pixels * msPerPixel,
      magnets.map(magnet => magnet.ms), MAGNET_PX * msPerPixel);
    const id = current.target.type === "element" ? current.target.id : undefined;
    setDraft({ project: current.next, id, dy: changesLayer ? row.top - current.from!.top : 0, layer: current.layer });
    const error = validateProject(result(current));
    const [start, end] = spanOf(current.next, current.target);
    const [before, after] = spanOf(current.original, current.target);
    const edges = [start !== before && start, end !== after && end].filter(edge => edge !== false);
    const magnet = magnets.find(item => edges.includes(item.ms));
    setGuide(magnet?.ms ?? null);
    setHint(error ? { text: error, invalid: true }
      : { text: `${seconds(start)} → ${seconds(end)} · ${seconds(end - start)}${current.layer !== undefined ? " · Layer " + (current.layer + 1) : ""}`
        + `${magnet ? " · Snapped to " + magnet.label : ""} · Release to apply · Esc to cancel` });
  };
  const propsFor = (target: ClipTarget, pick: () => void, movable = true) => ({
    onBegin: (event: PointerEvent<HTMLDivElement>, mode: ClipGesture) => {
      event.preventDefault(); pick();
      const rows = [...tracks.current!.querySelectorAll<HTMLElement>("[data-layer]")].map(row => {
        const box = row.getBoundingClientRect();
        return { layer: Number(row.dataset.layer), top: box.top, bottom: box.bottom };
      });
      const from = target.type === "element" ? rows.find(row => row.layer === layerOf(project.scene, target.id)) : undefined;
      drag.current = { original: project, target, mode, x: event.clientX, movable: movable || mode !== "move", rows, from,
        width: event.currentTarget.parentElement!.getBoundingClientRect().width, next: project, moved: false,
        magnets: magnetsFor(project, target, playheadMs) };
    }, onMove: move, onFinish: finish, onCancel: cancel, onSelect: pick,
    onKey: (event: KeyboardEvent, mode: ClipGesture) => {
      if (target.type === "element" && ["ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        commit(moveToLayer(project, target.id, layerOf(project.scene, target.id) + (event.key === "ArrowUp" ? 1 : -1)));
      }
      if (!["ArrowLeft", "ArrowRight"].includes(event.key) || (!movable && mode === "move")) return;
      event.preventDefault();
      commit(editClip(project, target, mode, event.key === "ArrowRight" ? 100 : -100));
    },
  });
  const scrubAt = (clientX: number) => {
    const box = times.current!.getBoundingClientRect();
    onScrub((clientX - box.left) / box.width * scene.durationMs);
  };
  /** Drags the playhead from the ruler or from its line; the line sits above the clips, so they stay untouched. */
  const scrubbing = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId); scrubAt(event.clientX);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubAt(event.clientX);
    },
  };
  const playheadPercent = Math.max(0, Math.min(100, playheadMs / scene.durationMs * 100));
  const ids = Object.keys(scene.elements);
  const names = Object.fromEntries(ids.map((id, index) => [id, elementLabels[scene.elements[id].kind] + " " + (index + 1)]));
  // One empty layer waits above the top one, so a clip can be dragged onto a layer of its own.
  const top = Math.max(-1, ...ids.map(id => layerOf(project.scene, id)));
  const layers = ids.length ? Array.from({ length: top + 2 }, (_, index) => top + 1 - index) : [];
  const lifted = (id: string): CSSProperties | undefined => draft?.id === id && draft.dy ? { transform: `translateY(${draft.dy}px)`, zIndex: 3 } : undefined;
  return <div className="timeline-editor">
    <p className={"timeline-help" + (hint.invalid ? " invalid" : "") + (hint.text ? "" : " idle")} aria-live="polite" title={hint.text || undefined}>
      {hint.text}</p>
    <div className="timeline-body" ref={scroller}
      onScroll={event => { geometry.current.scrollLeft = event.currentTarget.scrollLeft; }}>
    <div className="timeline-content" style={{ "--zoom": zoom } as CSSProperties}>
    <div className="ruler"><span className="ruler-corner" ref={corner}>Layers</span>
      <div className="ruler-times" ref={times} role="slider" tabIndex={0} aria-label="Playhead"
        aria-valuemin={0} aria-valuemax={scene.durationMs / 1000}
        aria-valuenow={playheadMs / 1000} aria-valuetext={seconds(playheadMs)} {...scrubbing}
        onKeyDown={event => {
          if (event.key === "ArrowLeft") { event.preventDefault(); onScrub(playheadMs - 100); }
          if (event.key === "ArrowRight") { event.preventDefault(); onScrub(playheadMs + 100); }
        }}>
        <RulerTicks durationMs={scene.durationMs} zoom={zoom} />
        <b className="playhead-head" style={{ left: playheadPercent + "%" }} aria-hidden="true" />
      </div>
    </div>
    <div className="tracks" ref={tracks}>
      {!ids.length && <p className="tracks-empty">
        Add an object from the pool. It starts at the playhead, {seconds(Math.min(playheadMs, Math.max(0, scene.durationMs - 100)))}.</p>}
      {layers.map((layer, row) => {
        const members = ids.filter(id => layerOf(project.scene, id) === layer);
        return <div className={"track" + (row % 2 ? " alt" : "") + (draft?.layer === layer ? " drop-target" : "")
          + (members.includes(selection) ? " selected" : "")} key={layer} data-layer={layer}>
          <span className="track-label" title={`Layer ${layer + 1}${layer === top + 1 ? ": drag an object here to give it a layer of its own" : ""}`}>
            <span className="track-id">V{layer + 1}</span></span>
          <div className="clip-lane">
            {members.map(id => {
              const element = scene.elements[id], [start, end] = spans[id];
              const lockedStart = start !== element.appearsAtMs, lockedEnd = end !== (element.disappearsAtMs ?? scene.durationMs);
              const current = id === selection && selectedAnimation === null;
              return <Clip key={id} start={start} end={end} duration={scene.durationMs} name={names[id]} tone={toneOf(element.kind)}
                label={elementSummary(element) + (positionWarning(element) ? " · Outside the camera" : "")}
                icon={<ElementIcon kind={element.kind} size={12} />} grips={{ start: !lockedStart, end: !lockedEnd }}
                locked={lockedStart || lockedEnd} style={lifted(id)}
                className={(id === selection ? "selected " : "") + (current ? "current " : "") + (draft?.id === id ? "dragging" : "")}
                {...propsFor({ type: "element", id }, () => onSelect(id), !lockedStart)} />;
            })}
            {(scene.animations ?? []).map((clip, index) => {
              if (!clip.targetId || !members.includes(clip.targetId)) return null;
              const manimName = animationLabels[clip.kind].split(" · ").at(-1)!;
              const name = animationLabels[clip.kind].split(" · ")[0] + " of " + names[clip.targetId];
              return <Clip key={"animation-" + index} start={clip.startMs} end={clip.startMs + clip.durationMs} duration={scene.durationMs}
                name={name} label={manimName} animation icon={<AnimationIcon kind={clip.kind} />} grips={{ start: true, end: true }}
                style={lifted(clip.targetId)} className={index === selectedAnimation ? "current" : ""}
                {...propsFor({ type: "animation", index }, () => onSelectAnimation(index, clip.targetId!))} />;
            })}
          </div>
        </div>;
      })}
    </div>
    <div className="playhead-layer" aria-hidden="true">
      {guide !== null && <div className="snap-guide" style={{ left: guide / scene.durationMs * 100 + "%" }} />}
      <div className="playhead" style={{ left: playheadPercent + "%" }} {...scrubbing} />
    </div>
    </div>
    </div>
  </div>;
}
