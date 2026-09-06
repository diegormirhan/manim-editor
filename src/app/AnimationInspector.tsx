import { useState } from "react";
import type { Animation, Element, Project } from "../domain/project";
import { animationLabels, childrenOf, isEntrance } from "../domain/timeline";
import { createElement, elementLabels } from "../domain/catalog";
import { retimeAnimation } from "../domain/clip-editing";
import { SecondsField, VectorFields, ElementInspector } from "./ElementInspector";

export function AnimationInspector({ project, targetId, onChange }: {
  project: Project; targetId: string; onChange: (project: Project) => void;
}) {
  const [kind, setKind] = useState<Animation["kind"]>("fadeIn");
  const [partner, setPartner] = useState("");
  const clips = project.scene.animations ?? [];
  const replace = (animations: Animation[]) => onChange({ ...project, scene: { ...project.scene, animations } });
  const add = () => {
    const next = structuredClone(project), element = next.scene.elements[targetId];
    const lastEnd = Math.max(0, ...clips.map(clip => clip.startMs + clip.durationMs));
    const startMs = isEntrance(kind) ? element.appearsAtMs : Math.max(element.appearsAtMs, lastEnd);
    let clip: Animation = { kind, targetId, startMs, durationMs: 1000 };
    if (kind === "moveTo") clip.destination = [2, 0, 0];
    if (kind === "transform") {
      const destinationId = crypto.randomUUID();
      next.scene.elements[destinationId] = { ...structuredClone(element), color: "#FC6255" };
      delete next.scene.elements[destinationId].disappearsAtMs;
      clip.destinationId = destinationId;
    }
    if (kind === "parallel") {
      const other = next.scene.elements[partner];
      if (!other || partner === targetId) return;
      const start = Math.max(startMs, other.appearsAtMs);
      element.appearsAtMs = start; other.appearsAtMs = start;
      clip = { kind, startMs: start, durationMs: 1000, clips: [targetId, partner].map(id => ({
        kind: "fadeIn", targetId: id, startMs: start, durationMs: 1000,
      })) as [Animation, Animation] };
    }
    next.scene.animations = [...clips, clip];
    onChange(next);
  };
  const updateChild = (index: number, childIndex: number, patch: Partial<Animation>) => {
    const next = structuredClone(project), block = next.scene.animations![index];
    Object.assign(childrenOf(block)[childIndex], patch); onChange(next);
  };
  return <section className="animation-inspector">
    <h3>Animações do elemento</h3>
    <label>Tipo de animação<select value={kind} onChange={event => setKind(event.target.value as Animation["kind"])}>
      {Object.entries(animationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {kind === "parallel" && <label>Segundo elemento<select value={partner} onChange={event => setPartner(event.target.value)}>
      <option value="">Selecione um elemento</option>{Object.entries(project.scene.elements).filter(([id]) => id !== targetId).map(([id, item]) =>
        <option key={id} value={id}>{elementLabels[item.kind]} · {id.slice(0, 8)}</option>)}
    </select></label>}
    <button className="subtle" disabled={kind === "parallel" && (!partner || partner === targetId)} onClick={add}>Adicionar animação</button>
    <p className="hint">Entradas substituem a aparição instantânea. Grupos compartilham o mesmo intervalo.</p>
    {clips.map((block, index) => childrenOf(block).some(clip => clip.targetId === targetId || clip.destinationId === targetId) && <fieldset key={index}>
      <legend>{animationLabels[block.kind]}</legend>
      <SecondsField label="Início" value={block.startMs} onChange={start => onChange(retimeAnimation(project, index, start, block.durationMs))} />
      <SecondsField label="Duração da animação" min={100} value={block.durationMs} onChange={duration => onChange(retimeAnimation(project, index, block.startMs, duration))} />
      {childrenOf(block).map((clip, childIndex) => <div key={childIndex} className="animation-child">
        {block.kind === "parallel" && <label>Animação do membro {childIndex + 1}<select value={clip.kind} onChange={event => updateChild(index, childIndex, { kind: event.target.value as Animation["kind"] })}>
          {["create", "write", "fadeIn", "fadeOut"].map(value => <option key={value} value={value}>{animationLabels[value as Animation["kind"]]}</option>)}
        </select></label>}
        {clip.kind === "moveTo" && <VectorFields label="Destino" value={clip.destination ?? [0, 0, 0]} onChange={destination => updateChild(index, childIndex, { destination })} />}
        {clip.kind === "transform" && clip.destinationId && project.scene.elements[clip.destinationId] && <details open>
          <summary>Destino da transformação</summary>
          <label>Tipo do destino<select value={project.scene.elements[clip.destinationId].kind} onChange={event => {
            const destination = createElement(event.target.value as Element["kind"]);
            onChange({ ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [clip.destinationId!]: destination } } });
          }}>{Object.entries(elementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <ElementInspector project={project} timing={false} element={project.scene.elements[clip.destinationId]} onChange={element => onChange({
            ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [clip.destinationId!]: element } },
          })} />
        </details>}
      </div>)}
      <button className="subtle" onClick={() => replace(clips.filter((_, i) => i !== index))}>Remover animação</button>
    </fieldset>)}
  </section>;
}
