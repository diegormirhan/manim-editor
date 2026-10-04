import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import type { Element, Project } from "../domain/project";
import { editClip, type ClipTarget, type ClipGesture } from "../domain/clip-editing";
import { validateProject } from "../domain/project";
import { animationLabels, childrenOf, lifetimes, rulerTicks, seconds } from "../domain/timeline";
import { elementLabels, elementSummary, positionWarning } from "../domain/catalog";
import { AnimationIcon, ElementIcon } from "./ElementIcon";

// Clip colour follows what the object is, so a glance at the timeline, or a project's thumbnail, reads the scene.
export const toneOf = (kind: Element["kind"]) =>
  kind === "mathTex" ? "tex" : kind === "text" ? "text" : kind === "functionGraph" || kind === "areaUnderGraph" ? "graph"
  : kind === "axes" || kind === "numberPlane" || kind === "numberLine" ? "coords" : "shape";

type TimelineProps = {
  project: Project; selection: string; onSelect: (id: string) => void;
  selectedAnimation: number | null; onSelectAnimation: (index: number, target: string) => void;
  onChange: (project: Project) => void; onError: (message: string) => void;
  playheadMs: number; onScrub: (ms: number) => void;
  zoom: number; onZoom: (zoom: number) => void;
  snapping: boolean;
};
type Magnet = { ms: number; label: string };
type Drag = {
  original: Project; target: ClipTarget; mode: ClipGesture; x: number; width: number; next: Project; moved: boolean;
  magnets: Magnet[];
};
// Edges within this many pixels of a magnet lock onto it.
const MAGNET_PX = 6;
type ClipProps = {
  start: number; end: number; duration: number; label: string; name: string; animation?: boolean; readOnly?: boolean;
  tone?: string; icon?: ReactNode;
  onBegin: (event: PointerEvent<HTMLDivElement>, mode: ClipGesture) => void;
  onMove: (event: PointerEvent<HTMLDivElement>) => void; onFinish: () => void; onCancel: () => void;
  onKey: (event: KeyboardEvent, mode: ClipGesture) => void; onSelect: () => void;
};

function Clip({ start, end, duration, label, name, animation, readOnly, tone, icon, onBegin, onMove, onFinish, onCancel, onKey, onSelect }: ClipProps) {
  const left = Math.max(0, Math.min(100, start / duration * 100));
  const width = Math.max(0.2, Math.min(100 - left, (end - start) / duration * 100));
  return <div className={"editable-clip " + (animation ? "animation" : "presence") + (readOnly ? " owned" : "")} data-tone={tone}
    style={{ left: left + "%", width: width + "%" }}
    title={label + " · " + seconds(start) + "–" + seconds(end) + (readOnly ? " · Time span defined by animation" : "")}
    onPointerDown={event => {
      if (readOnly || event.button !== 0) return;
      const mode = (event.target as HTMLElement).closest<HTMLElement>("[data-gesture]")?.dataset.gesture as ClipGesture ?? "move";
      event.currentTarget.setPointerCapture(event.pointerId); onBegin(event, mode);
      // Focus follows the grab, so Esc cancels this drag and the arrows nudge this clip.
      (event.target as HTMLElement).closest("button")?.focus({ preventScroll: true });
    }} onPointerMove={onMove} onPointerUp={onFinish} onPointerCancel={onCancel}
    onKeyDown={event => { if (event.key === "Escape") { onCancel(); event.stopPropagation(); } }}>
    {!readOnly && <button className="clip-grip start" data-gesture="start" aria-label={"Adjust start of " + name} onKeyDown={event => onKey(event, "start")} />}
    <button className="clip-body" data-gesture="move" aria-label={"Select " + name.toLowerCase()} onClick={onSelect}
      onKeyDown={event => !readOnly && onKey(event, event.shiftKey ? "end" : "move")}>
      {icon}<span>{label}</span>
    </button>
    {!animation && <span className="clip-duration" aria-hidden="true">{readOnly && <Lock size={10} />}{seconds(end - start)}</span>}
    {!readOnly && <button className="clip-grip end" data-gesture="end" aria-label={"Adjust end of " + name} onKeyDown={event => onKey(event, "end")} />}
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

/** Times a dragged clip can lock onto: the playhead, the scene bounds and every other clip's edges. */
function magnetsFor(project: Project, target: ClipTarget, playheadMs: number): Magnet[] {
  const magnets = [{ ms: playheadMs, label: "playhead" }, { ms: 0, label: "scene start" }, { ms: project.scene.durationMs, label: "scene end" }];
  for (const [id, [start, end]] of Object.entries(lifetimes(project.scene)))
    if (target.type !== "element" || target.id !== id) magnets.push({ ms: start, label: "a clip start" }, { ms: end, label: "a clip end" });
  (project.scene.animations ?? []).forEach((block, index) => {
    if (target.type !== "animation" || target.index !== index)
      magnets.push({ ms: block.startMs, label: "a clip start" }, { ms: block.startMs + block.durationMs, label: "a clip end" });
  });
  return magnets;
}

export function Timeline({ project, selection, onSelect, selectedAnimation, onSelectAnimation, onChange, onError, playheadMs, onScrub, zoom, onZoom, snapping }: TimelineProps) {
  const drag = useRef<Drag | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const times = useRef<HTMLDivElement>(null);
  const corner = useRef<HTMLSpanElement>(null);
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
  const [draft, setDraft] = useState<Project | null>(null);
  const [guide, setGuide] = useState<number | null>(null);
  const [hint, setHint] = useState<{ text: string; invalid?: boolean }>({ text: "" });
  const active = draft ?? project;
  const spans = lifetimes(active.scene);
  // A rejected gesture explains itself until the next edit, then the hint returns to idle.
  useEffect(() => { if (!drag.current) setHint(current => current.text ? { text: "" } : current); }, [project]);
  const cancel = () => { drag.current = null; setDraft(null); setGuide(null); setHint({ text: "" }); };
  // Rejections are reported where the gesture happened, not only in the preview status.
  const reject = (message: string) => { onError(message); setHint({ text: message, invalid: true }); };
  const commit = (next: Project) => {
    const error = validateProject(next);
    if (error) { reject(error + " The clip stayed in its previous position."); return; }
    if (JSON.stringify(next) !== JSON.stringify(project)) onChange(next);
  };
  const finish = () => {
    const current = drag.current;
    const kept = hint.invalid ? hint : null;
    if (current?.moved) {
      if (JSON.stringify(current.original) !== JSON.stringify(project)) reject("The project changed during the gesture. Try again.");
      else { cancel(); commit(current.next); return; }
    }
    cancel();
    if (kept) setHint(kept);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const pixels = event.clientX - current.x;
    if (!current.moved && Math.abs(pixels) < 3) return;
    current.moved = true;
    const msPerPixel = project.scene.durationMs / current.width;
    // Alt flips the snapping preference for this gesture, as in most editors.
    const magnets = snapping !== event.altKey ? current.magnets : [];
    current.next = editClip(current.original, current.target, current.mode, pixels * msPerPixel,
      magnets.map(magnet => magnet.ms), MAGNET_PX * msPerPixel);
    setDraft(current.next);
    const error = validateProject(current.next);
    const [start, end] = spanOf(current.next, current.target);
    const [before, after] = spanOf(current.original, current.target);
    const edges = [start !== before && start, end !== after && end].filter(edge => edge !== false);
    const magnet = magnets.find(item => edges.includes(item.ms));
    setGuide(magnet?.ms ?? null);
    setHint(error ? { text: error, invalid: true }
      : { text: `${seconds(start)} → ${seconds(end)} · ${seconds(end - start)}${magnet ? " · Snapped to " + magnet.label : ""} · Release to apply · Esc to cancel` });
  };
  const propsFor = (target: ClipTarget, pick: () => void) => ({
    onBegin: (event: PointerEvent<HTMLDivElement>, mode: ClipGesture) => {
      event.preventDefault(); pick();
      drag.current = { original: project, target, mode, x: event.clientX,
        width: event.currentTarget.parentElement!.getBoundingClientRect().width, next: project, moved: false,
        magnets: magnetsFor(project, target, playheadMs) };
    }, onMove: move, onFinish: finish, onCancel: cancel, onSelect: pick,
    onKey: (event: KeyboardEvent, mode: ClipGesture) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      commit(editClip(project, target, mode, event.key === "ArrowRight" ? 100 : -100));
    },
  });
  const scrubTo = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onScrub((event.clientX - box.left) / box.width * active.scene.durationMs);
  };
  const playheadPercent = Math.max(0, Math.min(100, playheadMs / active.scene.durationMs * 100));
  const trackOf = Object.fromEntries(Object.keys(active.scene.elements).map((id, index) => [id, index + 1]));
  return <div className="timeline-editor">
    <p className={"timeline-help" + (hint.invalid ? " invalid" : "") + (hint.text ? "" : " idle")} aria-live="polite" title={hint.text || undefined}>
      {hint.text || "Drag to move · Drag edges to resize · Arrows: 0.1 s · Esc: cancel"}</p>
    <div className="timeline-body" ref={scroller}
      onScroll={event => { geometry.current.scrollLeft = event.currentTarget.scrollLeft; }}>
    <div className="timeline-content" style={{ "--zoom": zoom } as CSSProperties}>
    <div className="ruler"><span className="ruler-corner" ref={corner}>Tracks</span>
      <div className="ruler-times" ref={times} role="slider" tabIndex={0} aria-label="Playhead"
        aria-valuemin={0} aria-valuemax={active.scene.durationMs / 1000}
        aria-valuenow={playheadMs / 1000} aria-valuetext={seconds(playheadMs)}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId); scrubTo(event);
        }}
        onPointerMove={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubTo(event);
        }}
        onKeyDown={event => {
          if (event.key === "ArrowLeft") { event.preventDefault(); onScrub(playheadMs - 100); }
          if (event.key === "ArrowRight") { event.preventDefault(); onScrub(playheadMs + 100); }
        }}>
        <RulerTicks durationMs={active.scene.durationMs} zoom={zoom} />
        <b className="playhead-head" style={{ left: playheadPercent + "%" }} aria-hidden="true" />
      </div>
    </div>
    <div className="tracks">
      <div className="track-section"><span>Objects</span></div>
      {!Object.keys(active.scene.elements).length && <p className="tracks-empty">
        Add an object from the pool. It starts at the playhead, {seconds(Math.min(playheadMs, Math.max(0, active.scene.durationMs - 100)))}.</p>}
      {Object.entries(active.scene.elements).map(([id, element], index) => {
        const [start, end] = spans[id];
        const name = elementLabels[element.kind] + " " + (index + 1);
        const owned = start !== element.appearsAtMs || end !== (element.disappearsAtMs ?? active.scene.durationMs);
        const current = id === selection && selectedAnimation === null;
        return <div className={"track" + (id === selection ? " selected" : "") + (current ? " current" : "") + (index % 2 ? " alt" : "")} key={id}>
          <button className="track-label" onClick={() => onSelect(id)} title={name}>
            <span className="track-id">V{index + 1}</span><ElementIcon kind={element.kind} size={13} /><span>{elementLabels[element.kind]}</span></button>
          <div className="clip-lane"><Clip start={start} end={end} duration={active.scene.durationMs} name={name} tone={toneOf(element.kind)}
            label={elementSummary(element) + (positionWarning(element) ? " · Outside the camera" : "")} readOnly={owned}
            {...propsFor({ type: "element", id }, () => onSelect(id))} /></div>
        </div>;
      })}
      {(active.scene.animations ?? []).length > 0 && <div className="track-section"><span>Animations</span></div>}
      {(active.scene.animations ?? []).map((block, index) => {
        const target = childrenOf(block)[0]?.targetId ?? "";
        const name = animationLabels[block.kind] + " " + (index + 1);
        const targets = childrenOf(block).map(child => elementSummary(active.scene.elements[child.targetId!] ?? active.scene.elements[target])).join(" + ");
        const touchesSelection = childrenOf(block).some(child => child.targetId === selection);
        const manimName = animationLabels[block.kind].split(" · ").at(-1)!;
        const targetTracks = childrenOf(block).map(child => "V" + trackOf[child.targetId!]).join(" ");
        const current = index === selectedAnimation;
        return <div className={"track animation-track" + (touchesSelection ? " selected" : "") + (current ? " current" : "") + (index % 2 ? " alt" : "")} key={"animation-" + index}>
          <button className="track-label" onClick={() => onSelectAnimation(index, target)} title={targets}>
            <span className="track-id">A{index + 1}</span><span className="track-name">{manimName}</span><span className="track-target">→ {targetTracks}</span></button>
          <div className="clip-lane"><Clip start={block.startMs} end={block.startMs + block.durationMs} duration={active.scene.durationMs}
            name={name} label={manimName + " · " + seconds(block.durationMs)} animation icon={<AnimationIcon kind={block.kind} />}
            {...propsFor({ type: "animation", index }, () => onSelectAnimation(index, target))} /></div>
        </div>;
      })}
    </div>
    <div className="playhead-layer" aria-hidden="true">
      {guide !== null && <div className="snap-guide" style={{ left: guide / active.scene.durationMs * 100 + "%" }} />}
      <div className="playhead" style={{ left: playheadPercent + "%" }} />
    </div>
    </div>
    </div>
  </div>;
}
