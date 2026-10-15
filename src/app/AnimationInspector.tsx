import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Animation, Element, Project } from "../domain/project";
import { addAnimation, animationLabels, removeAnimation, seconds } from "../domain/timeline";
import { createElement, derivedKinds, elementLabels } from "../domain/catalog";
import { validateProject } from "../domain/project";
import { ColorInput, FieldSelect, NumberField, Option, VectorFields, ElementInspector } from "./ElementInspector";
import { AnimationIcon } from "./ElementIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MENU: { label: string; kinds: Animation["kind"][] }[] = [
  { label: "Enter", kinds: ["create", "write", "fadeIn", "grow", "drawBorder"] },
  { label: "Change", kinds: ["moveTo", "rotate", "scaleTo", "recolor", "transform"] },
  { label: "Emphasize", kinds: ["indicate", "wiggle"] },
  { label: "Exit", kinds: ["fadeOut"] },
];

/** The selected object's animations. New ones start at the playhead; the timeline sets when each plays. */
export function AnimationInspector({ project, targetId, playheadMs, onChange, focusIndex, onSelectAnimation }: {
  project: Project; targetId: string; playheadMs: number; onChange: (project: Project) => void;
  focusIndex: number | null; onSelectAnimation: (index: number) => void;
}) {
  const [problem, setProblem] = useState("");
  const list = useRef<HTMLElement>(null);
  const clips = project.scene.animations ?? [];
  useEffect(() => setProblem(""), [targetId]);
  // The selected clip's settings come into view, wherever the inspector was scrolled.
  useEffect(() => {
    if (focusIndex !== null) list.current?.querySelector(`[data-animation="${focusIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focusIndex]);
  const add = (kind: Animation["kind"]) => {
    const next = addAnimation(project, targetId, kind, playheadMs);
    // Refuse an addition that would break a valid scene, and say why next to the button.
    const error = typeof next === "string" ? next : validateProject(project) ? null : validateProject(next);
    setProblem(error ?? "");
    if (error || typeof next === "string") return;
    onChange(next);
    onSelectAnimation(clips.length);
  };
  const update = (index: number, patch: Partial<Animation>) => {
    const next = structuredClone(project);
    Object.assign(next.scene.animations![index], patch); onChange(next);
  };
  return <section className="animation-inspector" ref={list}>
    <h3>Animations</h3>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full"><Plus />Add animation<ChevronDown className="ml-auto size-3.5 opacity-60" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {MENU.map((group, index) => <DropdownMenuGroup key={group.label}>
          {index > 0 && <DropdownMenuSeparator />}
          <DropdownMenuLabel className="text-xs text-muted-foreground">{group.label}</DropdownMenuLabel>
          {group.kinds.map(kind => <DropdownMenuItem key={kind} onSelect={() => add(kind)}>
            <AnimationIcon kind={kind} size={14} />{animationLabels[kind]}</DropdownMenuItem>)}
        </DropdownMenuGroup>)}
      </DropdownMenuContent>
    </DropdownMenu>
    {problem && <p className="hint warning" role="alert">{problem}</p>}
    {clips.map((clip, index) => (clip.targetId === targetId || clip.destinationId === targetId) && <fieldset key={index}
      data-animation={index} className={index === focusIndex ? "current" : undefined} onFocus={() => onSelectAnimation(index)}
      onPointerDown={() => onSelectAnimation(index)}>
      <legend><AnimationIcon kind={clip.kind} size={13} />{animationLabels[clip.kind].split(" · ").at(-1)}
        <span className="clip-time">{seconds(clip.startMs)} → {seconds(clip.startMs + clip.durationMs)}</span></legend>
      {clip.kind === "moveTo" && <VectorFields label="Destination" value={clip.destination ?? [0, 0, 0]} onChange={destination => update(index, { destination })} />}
      {clip.kind === "rotate" && <NumberField label="Turn (degrees)" min={-1080} max={1080} step={15} value={clip.degrees ?? 90} onChange={degrees => update(index, { degrees })} />}
      {clip.kind === "scaleTo" && <NumberField label="Scale factor" min={0.05} max={10} step={0.1} value={clip.factor ?? 1.5} onChange={factor => update(index, { factor })} />}
      {clip.kind === "recolor" && <label>Final color<span className="color-field"><ColorInput value={clip.color ?? "#FC6255"} onChange={color => update(index, { color })} />
        <code>{(clip.color ?? "#FC6255").toUpperCase()}</code></span></label>}
      {clip.kind === "transform" && clip.destinationId && project.scene.elements[clip.destinationId] && <details open>
        <summary>Transform destination</summary>
        <label>Destination type<FieldSelect value={project.scene.elements[clip.destinationId].kind} onChange={event => {
          const { layer, appearsAtMs } = project.scene.elements[clip.destinationId!];
          const destination = { ...createElement(event.target.value as Element["kind"], project), layer, appearsAtMs };
          onChange({ ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [clip.destinationId!]: destination } } });
        }}>{Object.entries(elementLabels).filter(([value]) => !derivedKinds.includes(value as Element["kind"]))
          .map(([value, label]) => <Option key={value} value={value}>{label}</Option>)}</FieldSelect></label>
        <ElementInspector project={project} element={project.scene.elements[clip.destinationId]} onChange={element => onChange({
          ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [clip.destinationId!]: element } },
        })} />
      </details>}
      <div className="inline-actions">
        <Button variant="ghost" size="xs" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => onChange(removeAnimation(project, index))}>
          <Trash2 />Remove animation</Button>
      </div>
    </fieldset>)}
  </section>;
}
