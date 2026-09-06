import { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import type { Project } from "../domain/project";
import { editClip, type ClipTarget, type ClipGesture } from "../domain/clip-editing";
import { validateProject } from "../domain/project";
import { animationLabels, childrenOf, lifetimes, seconds } from "../domain/timeline";
import { elementLabels, elementSummary, positionWarning } from "../domain/catalog";

type TimelineProps = {
  project: Project; selection: string; onSelect: (id: string) => void;
  onChange: (project: Project) => void; onError: (message: string) => void;
};
type Drag = { original: Project; target: ClipTarget; mode: ClipGesture; x: number; width: number; next: Project; moved: boolean };
type ClipProps = {
  start: number; end: number; duration: number; label: string; name: string; animation?: boolean; readOnly?: boolean;
  onBegin: (event: PointerEvent<HTMLDivElement>, mode: ClipGesture) => void;
  onMove: (event: PointerEvent<HTMLDivElement>) => void; onFinish: () => void; onCancel: () => void;
  onKey: (event: KeyboardEvent, mode: ClipGesture) => void; onSelect: () => void;
};

function Clip({ start, end, duration, label, name, animation, readOnly, onBegin, onMove, onFinish, onCancel, onKey, onSelect }: ClipProps) {
  const left = Math.max(0, Math.min(100, start / duration * 100));
  const width = Math.max(0.2, Math.min(100 - left, (end - start) / duration * 100));
  return <div className={"editable-clip " + (animation ? "animation" : "presence")} style={{ left: left + "%", width: width + "%" }}
    title={label + " · " + seconds(start) + "–" + seconds(end) + (readOnly ? " · Intervalo definido pela animação" : "")}
    onPointerDown={event => {
      if (readOnly || event.button !== 0) return;
      const mode = (event.target as HTMLElement).closest<HTMLElement>("[data-gesture]")?.dataset.gesture as ClipGesture ?? "move";
      event.currentTarget.setPointerCapture(event.pointerId); onBegin(event, mode);
    }} onPointerMove={onMove} onPointerUp={onFinish} onPointerCancel={onCancel}
    onKeyDown={event => { if (event.key === "Escape") { onCancel(); event.stopPropagation(); } }}>
    {!readOnly && <button className="clip-grip start" data-gesture="start" aria-label={"Ajustar início de " + name} onKeyDown={event => onKey(event, "start")} />}
    <button className="clip-body" data-gesture="move" aria-label={"Selecionar " + name.toLowerCase()} onClick={onSelect}
      onKeyDown={event => !readOnly && onKey(event, event.shiftKey ? "end" : "move")}>
      <span>{label}</span>
    </button>
    {!readOnly && <button className="clip-grip end" data-gesture="end" aria-label={"Ajustar fim de " + name} onKeyDown={event => onKey(event, "end")} />}
  </div>;
}

export function Timeline({ project, selection, onSelect, onChange, onError }: TimelineProps) {
  const drag = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [hint, setHint] = useState("");
  const active = draft ?? project;
  const spans = lifetimes(active.scene);
  const cancel = () => { drag.current = null; setDraft(null); setHint(""); };
  const commit = (next: Project) => {
    const error = validateProject(next);
    if (error) { onError(error + " O clipe permaneceu na posição anterior."); return; }
    if (JSON.stringify(next) !== JSON.stringify(project)) onChange(next);
  };
  const finish = () => {
    const current = drag.current;
    if (current?.moved) {
      if (JSON.stringify(current.original) !== JSON.stringify(project)) onError("O projeto mudou durante o gesto. Tente novamente.");
      else commit(current.next);
    }
    cancel();
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const pixels = event.clientX - current.x;
    if (!current.moved && Math.abs(pixels) < 3) return;
    current.moved = true;
    current.next = editClip(current.original, current.target, current.mode, pixels / current.width * project.scene.durationMs);
    setDraft(current.next);
    setHint(validateProject(current.next) ?? "Solte para aplicar · Esc cancela");
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
  return <div className="timeline-editor">
    <p className="timeline-help" aria-live="polite">{hint || "Arraste para mover · Puxe as bordas para ajustar · Setas: 0,1 s · Esc: cancelar"}</p>
    <div className="ruler"><span>Elementos / animações</span><div>{[0, 1, 2, 3, 4].map(i => <span key={i}>{seconds(active.scene.durationMs * i / 4)}</span>)}</div></div>
    <div className="tracks">
      {Object.entries(active.scene.elements).map(([id, element], index) => {
        const [start, end] = spans[id];
        const name = elementLabels[element.kind] + " " + (index + 1);
        const owned = start !== element.appearsAtMs || end !== (element.disappearsAtMs ?? active.scene.durationMs);
        return <div className={"track " + (id === selection ? "selected" : "")} key={id}>
          <button className="track-label" onClick={() => onSelect(id)} title={name}>{name}</button>
          <div className="clip-lane"><Clip start={start} end={end} duration={active.scene.durationMs} name={name}
            label={elementSummary(element) + (positionWarning(element) ? " · Fora da câmera" : "")} readOnly={owned}
            {...propsFor({ type: "element", id }, id)} /></div>
        </div>;
      })}
      {(active.scene.animations ?? []).map((block, index) => {
        const target = childrenOf(block)[0]?.targetId ?? "";
        const name = animationLabels[block.kind] + " " + (index + 1);
        const targets = childrenOf(block).map(child => elementSummary(active.scene.elements[child.targetId!] ?? active.scene.elements[target])).join(" + ");
        return <div className="track animation-track" key={"animation-" + index}>
          <button className="track-label" onClick={() => onSelect(target)} title={targets}>{name}</button>
          <div className="clip-lane"><Clip start={block.startMs} end={block.startMs + block.durationMs} duration={active.scene.durationMs}
            name={name} label={animationLabels[block.kind] + " · " + seconds(block.durationMs)} animation
            {...propsFor({ type: "animation", index }, target)} /></div>
        </div>;
      })}
    </div>
  </div>;
}
