import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Animation, Element, Project } from "../domain/project";
import { animationLabels, childrenOf, isEntrance, leafClips, removeAnimation } from "../domain/timeline";
import { createElement, derivedKinds, elementLabels } from "../domain/catalog";
import { retimeAnimation } from "../domain/clip-editing";
import { validateProject } from "../domain/project";
import { ColorInput, FieldSelect, NumberField, Option, SecondsField, VectorFields, ElementInspector } from "./ElementInspector";
import { AnimationIcon } from "./ElementIcon";
import { Button } from "@/components/ui/button";

export function AnimationInspector({ project, targetId, onChange, focusIndex, onSelectAnimation }: {
  project: Project; targetId: string; onChange: (project: Project) => void;
  focusIndex: number | null; onSelectAnimation: (index: number) => void;
}) {
  const [kind, setKind] = useState<Animation["kind"]>("fadeIn");
  const [partner, setPartner] = useState("");
  const [problem, setProblem] = useState("");
  const list = useRef<HTMLElement>(null);
  const clips = project.scene.animations ?? [];
  useEffect(() => setProblem(""), [kind, partner, targetId]);
  // The selected clip's settings come into view, wherever the inspector was scrolled.
  useEffect(() => {
    if (focusIndex !== null) list.current?.querySelector(`[data-animation="${focusIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focusIndex]);
  const add = () => {
    if (isEntrance(kind) && leafClips(project.scene).some(clip => clip.targetId === targetId && isEntrance(clip.kind))) {
      setProblem("This object already has an entrance animation. Remove it first, or choose another kind.");
      return;
    }
    const next = structuredClone(project), element = next.scene.elements[targetId];
    const lastEnd = Math.max(0, ...clips.map(clip => clip.startMs + clip.durationMs));
    const startMs = isEntrance(kind) ? element.appearsAtMs : Math.max(element.appearsAtMs, lastEnd);
    // A shorter clip that fits beats a default second that breaks the scene.
    const durationMs = Math.max(100, Math.min(1000, (element.disappearsAtMs ?? project.scene.durationMs) - startMs));
    let clip: Animation = { kind, targetId, startMs, durationMs };
    if (kind === "moveTo") clip.destination = [2, 0, 0];
    if (kind === "rotate") clip.degrees = 90;
    if (kind === "scaleTo") clip.factor = 1.5;
    if (kind === "recolor") clip.color = "#FC6255";
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
      clip = { kind, startMs: start, durationMs, clips: [targetId, partner].map(id => ({
        kind: "fadeIn", targetId: id, startMs: start, durationMs,
      })) as [Animation, Animation] };
    }
    next.scene.animations = [...clips, clip];
    // Refuse an addition that would break a valid scene, and say why next to the button.
    const error = validateProject(next);
    if (error && !validateProject(project)) { setProblem(error); return; }
    onChange(next);
    onSelectAnimation(clips.length);
  };
  const updateChild = (index: number, childIndex: number, patch: Partial<Animation>) => {
    const next = structuredClone(project), block = next.scene.animations![index];
    Object.assign(childrenOf(block)[childIndex], patch); onChange(next);
  };
  return <section className="animation-inspector" ref={list}>
    <h3>Element animations</h3>
    <label>Animation type<FieldSelect value={kind} onChange={event => setKind(event.target.value as Animation["kind"])}>
      {Object.entries(animationLabels).map(([value, label]) => <Option key={value} value={value}>{label}</Option>)}
    </FieldSelect></label>
    {kind === "parallel" && <label>Second element<FieldSelect value={partner} onChange={event => setPartner(event.target.value)}>
      <Option value="">Select an element</Option>{Object.entries(project.scene.elements).filter(([id]) => id !== targetId).map(([id, item]) =>
        <Option key={id} value={id}>{elementLabels[item.kind]} · {id.slice(0, 8)}</Option>)}
    </FieldSelect></label>}
    <div className="inline-actions">
      <Button variant="secondary" size="sm" className="w-full" disabled={kind === "parallel" && (!partner || partner === targetId)} onClick={add}>
        <Plus />Add animation</Button>
    </div>
    <p className={problem ? "hint warning" : "hint"} role={problem ? "alert" : undefined}>
      {problem || "Entrance animations replace instant appearance. Group members share the same time span."}</p>
    {clips.map((block, index) => childrenOf(block).some(clip => clip.targetId === targetId || clip.destinationId === targetId) && <fieldset key={index}
      data-animation={index} className={index === focusIndex ? "current" : undefined} onFocus={() => onSelectAnimation(index)}>
      <legend><AnimationIcon kind={block.kind} size={13} />{animationLabels[block.kind]}</legend>
      <SecondsField label="Start" value={block.startMs} onChange={start => onChange(retimeAnimation(project, index, start, block.durationMs))} />
      <SecondsField label="Animation duration" min={100} value={block.durationMs} onChange={duration => onChange(retimeAnimation(project, index, block.startMs, duration))} />
      {childrenOf(block).map((clip, childIndex) => <div key={childIndex} className="animation-child">
        {block.kind === "parallel" && <label>Member animation {childIndex + 1}<FieldSelect value={clip.kind} onChange={event => updateChild(index, childIndex, { kind: event.target.value as Animation["kind"] })}>
          {["create", "write", "fadeIn", "grow", "drawBorder", "fadeOut", "indicate", "wiggle"].map(value => <Option key={value} value={value}>{animationLabels[value as Animation["kind"]]}</Option>)}
        </FieldSelect></label>}
        {clip.kind === "moveTo" && <VectorFields label="Destination" value={clip.destination ?? [0, 0, 0]} onChange={destination => updateChild(index, childIndex, { destination })} />}
        {clip.kind === "rotate" && <NumberField label="Turn (degrees)" min={-1080} max={1080} step={15} value={clip.degrees ?? 90} onChange={degrees => updateChild(index, childIndex, { degrees })} />}
        {clip.kind === "scaleTo" && <NumberField label="Scale factor" min={0.05} max={10} step={0.1} value={clip.factor ?? 1.5} onChange={factor => updateChild(index, childIndex, { factor })} />}
        {clip.kind === "recolor" && <label>Final color<span className="color-field"><ColorInput value={clip.color ?? "#FC6255"} onChange={color => updateChild(index, childIndex, { color })} />
          <code>{(clip.color ?? "#FC6255").toUpperCase()}</code></span></label>}
        {clip.kind === "transform" && clip.destinationId && project.scene.elements[clip.destinationId] && <details open>
          <summary>Transform destination</summary>
          <label>Destination type<FieldSelect value={project.scene.elements[clip.destinationId].kind} onChange={event => {
            const destination = createElement(event.target.value as Element["kind"]);
            onChange({ ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [clip.destinationId!]: destination } } });
          }}>{Object.entries(elementLabels).filter(([value]) => !derivedKinds.includes(value as Element["kind"]))
            .map(([value, label]) => <Option key={value} value={value}>{label}</Option>)}</FieldSelect></label>
          <ElementInspector project={project} timing={false} element={project.scene.elements[clip.destinationId]} onChange={element => onChange({
            ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [clip.destinationId!]: element } },
          })} />
        </details>}
      </div>)}
      <div className="inline-actions">
        <Button variant="ghost" size="xs" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => onChange(removeAnimation(project, index))}>
          <Trash2 />Remove animation</Button>
      </div>
    </fieldset>)}
  </section>;
}
