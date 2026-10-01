import { useRef, useState, type PointerEvent, type KeyboardEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import type { Element, Project } from "../domain/project";
import { editClip, type ClipTarget, type ClipGesture } from "../domain/clip-editing";
import { validateProject } from "../domain/project";
import { animationLabels, childrenOf, lifetimes, rulerTicks, seconds } from "../domain/timeline";
import { elementLabels, elementSummary, positionWarning } from "../domain/catalog";
import { AnimationIcon, ElementIcon } from "./ElementIcon";

// Clip colour follows what the object is, so a glance at the timeline reads the scene.
const toneOf = (kind: Element["kind"]) =>
  kind === "mathTex" ? "tex" : kind === "text" ? "text" : kind === "functionGraph" || kind === "areaUnderGraph" ? "graph"
  : kind === "axes" || kind === "numberPlane" || kind === "numberLine" ? "coords" : "shape";

type TimelineProps = {
  project: Project; selection: string; onSelect: (id: string) => void;
  onChange: (project: Project) => void; onError: (message: string) => void;
  playheadMs: number; onScrub: (ms: number) => void;
};
type Drag = { original: Project; target: ClipTarget; mode: ClipGesture; x: number; width: number; next: Project; moved: boolean };
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
    }} onPointerMove={onMove} onPointerUp={onFinish} onPointerCancel={onCancel}
    onKeyDown={event => { if (event.key === "Escape") { onCancel(); event.stopPropagation(); } }}>
    {!readOnly && <button className="clip-grip start" data-gesture="start" aria-label={"Adjust start of " + name} onKeyDown={event => onKey(event, "start")} />}
    <button className="clip-body" data-gesture="move" aria-label={"Select " + name.toLowerCase()} onClick={onSelect}
      onKeyDown={event => !readOnly && onKey(event, event.shiftKey ? "end" : "move")}>
      {icon}<span>{label}</span>
    </button>
    <span className="clip-duration" aria-hidden="true">{readOnly && <Lock size={10} />}{seconds(end - start)}</span>
    {!readOnly && <button className="clip-grip end" data-gesture="end" aria-label={"Adjust end of " + name} onKeyDown={event => onKey(event, "end")} />}
  </div>;
}

export function Timeline({ project, selection, onSelect, onChange, onError, playheadMs, onScrub }: TimelineProps) {
  const drag = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [hint, setHint] = useState<{ text: string; invalid?: boolean }>({ text: "" });
  const active = draft ?? project;
  const spans = lifetimes(active.scene);
  const cancel = () => { drag.current = null; setDraft(null); setHint({ text: "" }); };
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
    current.next = editClip(current.original, current.target, current.mode, pixels / current.width * project.scene.durationMs);
    setDraft(current.next);
    const error = validateProject(current.next);
    setHint(error ? { text: error, invalid: true } : { text: "Release to apply · Esc to cancel" });
  };
  const propsFor = (target: ClipTarget, selectedId: string) => ({
    onBegin: (event: PointerEvent<HTMLDivElement>, mode: ClipGesture) => {
      event.preventDefault(); onSelect(selectedId);
      drag.current = { original: project, target, mode, x: event.clientX,
        width: event.currentTarget.parentElement!.getBoundingClientRect().width, next: project, moved: false };
    }, onMove: move, onFinish: finish, onCancel: cancel, onSelect: () => onSelect(selectedId),
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
  const ticks = rulerTicks(active.scene.durationMs);
  const trackOf = Object.fromEntries(Object.keys(active.scene.elements).map((id, index) => [id, index + 1]));
  return <div className="timeline-editor">
    <p className={"timeline-help" + (hint.invalid ? " invalid" : "") + (hint.text ? "" : " idle")} aria-live="polite" title={hint.text || undefined}>
      {hint.text || "Drag to move · Drag edges to resize · Arrows: 0.1 s · Esc: cancel"}</p>
    <div className="timeline-body">
    <div className="ruler"><span className="ruler-corner">Tracks</span>
      <div className="ruler-times" role="slider" tabIndex={0} aria-label="Playhead"
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
        {ticks.minors.map(ms => <i key={"m" + ms} className="tick" style={{ left: ms / active.scene.durationMs * 100 + "%" }} />)}
        {ticks.majors.map(ms => <i key={"M" + ms} className="tick major" style={{ left: ms / active.scene.durationMs * 100 + "%" }} />)}
        {ticks.majors.map(ms => <span key={"l" + ms} style={{ left: ms / active.scene.durationMs * 100 + "%" }}>{seconds(ms)}</span>)}
      </div>
    </div>
    <div className="tracks">
      <div className="track-section">Objects</div>
      {Object.entries(active.scene.elements).map(([id, element], index) => {
        const [start, end] = spans[id];
        const name = elementLabels[element.kind] + " " + (index + 1);
        const owned = start !== element.appearsAtMs || end !== (element.disappearsAtMs ?? active.scene.durationMs);
        return <div className={"track" + (id === selection ? " selected" : "") + (index % 2 ? " alt" : "")} key={id}>
          <button className="track-label" onClick={() => onSelect(id)} title={name}>
            <span className="track-id">V{index + 1}</span><ElementIcon kind={element.kind} size={13} /><span>{elementLabels[element.kind]}</span></button>
          <div className="clip-lane"><Clip start={start} end={end} duration={active.scene.durationMs} name={name} tone={toneOf(element.kind)}
            label={elementSummary(element) + (positionWarning(element) ? " · Outside the camera" : "")} readOnly={owned}
            {...propsFor({ type: "element", id }, id)} /></div>
        </div>;
      })}
      {(active.scene.animations ?? []).length > 0 && <div className="track-section">Animations</div>}
      {(active.scene.animations ?? []).map((block, index) => {
        const target = childrenOf(block)[0]?.targetId ?? "";
        const name = animationLabels[block.kind] + " " + (index + 1);
        const targets = childrenOf(block).map(child => elementSummary(active.scene.elements[child.targetId!] ?? active.scene.elements[target])).join(" + ");
        const touchesSelection = childrenOf(block).some(child => child.targetId === selection);
        const manimName = animationLabels[block.kind].split(" · ").at(-1)!;
        const targetTracks = childrenOf(block).map(child => "V" + trackOf[child.targetId!]).join(" ");
        return <div className={"track animation-track" + (touchesSelection ? " selected" : "") + (index % 2 ? " alt" : "")} key={"animation-" + index}>
          <button className="track-label" onClick={() => onSelect(target)} title={targets}>
            <span className="track-id">A{index + 1}</span><span className="track-name">{manimName}</span><span className="track-target">→ {targetTracks}</span></button>
          <div className="clip-lane"><Clip start={block.startMs} end={block.startMs + block.durationMs} duration={active.scene.durationMs}
            name={name} label={manimName} animation icon={<AnimationIcon kind={block.kind} />}
            {...propsFor({ type: "animation", index }, target)} /></div>
        </div>;
      })}
    </div>
    <div className="playhead-layer" aria-hidden="true">
      <div className="playhead" style={{ left: playheadPercent + "%" }} />
    </div>
    </div>
  </div>;
}
