import { Crosshair, InfinityIcon } from "lucide-react";
import type { Element, Project } from "../domain/project";
import { positionWarning, elementSummary, plottableGraphs } from "../domain/catalog";
import { EXPRESSION_PRESETS, expressionError, expressionWarning } from "../domain/expression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

export function NumberField({ label, value, onChange, min, max, step = 0.25, inputClassName }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; inputClassName?: string;
}) {
  return <label>{label}<Input type="number" min={min} max={max} step={step} className={cn("h-8 px-2.5 tabular-nums", inputClassName)}
    value={Number.isFinite(value) ? value : ""} onChange={event => onChange(event.target.valueAsNumber)} /></label>;
}
/**
 * The native colour picker, controlled with the lowercase hex it reports. A value it would
 * rewrite (such as #83C167) makes React set it on every render, and an open Windows picker
 * answers each write with a new change: an endless update loop.
 */
export function ColorInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return <input type="color" value={value.toLowerCase()} onChange={event => onChange(event.target.value.toUpperCase())} />;
}

export function SecondsField({ label, value, onChange, min = 0, inputClassName }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; inputClassName?: string;
}) {
  return <NumberField label={label + " (s)"} value={value / 1000} min={min / 1000} step={0.1} inputClassName={inputClassName}
    onChange={seconds => onChange(Math.round(seconds * 1000))} />;
}
export function VectorFields({ label, value, onChange }: {
  label: string; value: [number, number, number]; onChange: (value: [number, number, number]) => void;
}) {
  return <><h3>{label}</h3><div className="coordinates">{["X", "Y", "Z"].map((axis, index) =>
    <NumberField key={axis} label={label + " " + axis} value={value[index]} onChange={number => {
      const next: typeof value = [...value]; next[index] = number; onChange(next);
    }} />)}</div></>;
}
function RangeFields({ label, value, onChange }: { label: string; value: [number, number]; onChange: (value: [number, number]) => void }) {
  return <div className="coordinates">
    <NumberField label={label + " minimum"} value={value[0]} onChange={number => onChange([number, value[1]])} />
    <NumberField label={label + " maximum"} value={value[1]} onChange={number => onChange([value[0], number])} />
  </div>;
}
/** A native select in shadcn dress, full width in the inspector grid. */
export function FieldSelect(props: React.ComponentProps<typeof NativeSelect>) {
  return <NativeSelect size="sm" containerClassName="w-full" className="w-full pl-2.5" {...props} />;
}
export const Option = NativeSelectOption;

function GraphFields({ element, project, onChange }: {
  element: Extract<Element, { kind: "functionGraph" }>; project?: Project; onChange: (element: Element) => void;
}) {
  const invalid = expressionError(element.expression, element.xRange);
  // Linked graphs live in axes units, so the camera bound only applies to loose ones.
  const warning = invalid || element.axesId ? null : expressionWarning(element.expression, element.xRange);
  return <>
    <label>f(x) expression<Input spellCheck={false} list="expression-presets" value={element.expression} className="h-8 px-2.5 font-mono"
      aria-invalid={invalid ? true : undefined}
      onChange={event => onChange({ ...element, expression: event.target.value })} /></label>
    <datalist id="expression-presets">{EXPRESSION_PRESETS.map(preset => <option key={preset} value={preset} />)}</datalist>
    <p className={invalid ? "hint warning" : "hint"}>
      {invalid ?? warning ?? "Use x, numbers, + − × ÷ ^ and sin, cos, tan, sqrt, abs, exp, ln, log."}
    </p>
    <RangeFields label="X" value={element.xRange} onChange={xRange => onChange({ ...element, xRange })} />
    <label>Coordinate system<FieldSelect value={element.axesId ?? ""} onChange={event => {
      const next = { ...element }; if (event.target.value) next.axesId = event.target.value; else delete next.axesId; onChange(next);
    }}><Option value="">Scene coordinates</Option>{Object.entries(project?.scene.elements ?? {}).filter(([, item]) =>
      item.kind === "axes" || item.kind === "numberPlane").map(([id, item]) => <Option key={id} value={id}>{elementSummary(item)} · {id.slice(0, 8)}</Option>)}</FieldSelect></label>
    <p className="hint">Link to axes to share their scale and origin.</p>
  </>;
}

export function ElementInspector({ element, onChange, project, timing = true }: {
  element: Element; onChange: (element: Element) => void; project?: Project; timing?: boolean;
}) {
  const warning = positionWarning(element);
  const positioned = element.kind !== "areaUnderGraph";
  return <>
    {element.kind === "mathTex" && <label>LaTeX expression<Textarea spellCheck={false} value={element.latex} className="min-h-20 font-mono"
      onChange={event => onChange({ ...element, latex: event.target.value })} /></label>}
    {element.kind === "text" && <label>Text content<Textarea value={element.text} className="min-h-20"
      onChange={event => onChange({ ...element, text: event.target.value })} /></label>}
    {(element.kind === "mathTex" || element.kind === "text") && <NumberField label="Font size" value={element.fontSize ?? 48} min={8} max={144} step={1} onChange={fontSize => onChange({ ...element, fontSize })} />}
    {(element.kind === "circle" || element.kind === "dot" || element.kind === "arc") && <NumberField label="Radius" min={0.01} value={element.radius} onChange={radius => onChange({ ...element, radius })} />}
    {element.kind === "arc" && <div className="coordinates">
      <NumberField label="Arc angle" min={-360} max={360} step={15} value={element.angleDegrees} onChange={angleDegrees => onChange({ ...element, angleDegrees })} />
      <NumberField label="Start angle" min={-360} max={360} step={15} value={element.startDegrees ?? 0} onChange={startDegrees => onChange({ ...element, startDegrees })} />
    </div>}
    {(element.kind === "square" || element.kind === "triangle" || element.kind === "regularPolygon") && <NumberField label="Size" min={0.05} max={20} value={element.size} onChange={size => onChange({ ...element, size })} />}
    {element.kind === "regularPolygon" && <NumberField label="Number of sides" min={3} max={12} step={1} value={element.sides} onChange={sides => onChange({ ...element, sides })} />}
    {(element.kind === "rectangle" || element.kind === "ellipse") && <div className="coordinates">
      <NumberField label="Width" min={0.01} value={element.width} onChange={width => onChange({ ...element, width })} />
      <NumberField label="Height" min={0.01} value={element.height} onChange={height => onChange({ ...element, height })} />
    </div>}
    {element.kind === "functionGraph" && <GraphFields element={element} project={project} onChange={onChange} />}
    {element.kind === "areaUnderGraph" && <>
      <label>Graph<FieldSelect value={element.graphId} onChange={event => onChange({ ...element, graphId: event.target.value })}>
        {plottableGraphs(project ?? { scene: { elements: {} } } as Project).map(([id, item]) =>
          <Option key={id} value={id}>{elementSummary(item)} · {id.slice(0, 8)}</Option>)}
      </FieldSelect></label>
      <RangeFields label="X" value={element.xRange} onChange={xRange => onChange({ ...element, xRange })} />
      <p className="hint">The area follows the graph between the selected bounds.</p>
    </>}
    {(element.kind === "axes" || element.kind === "numberPlane" || element.kind === "numberLine") && <>
      <RangeFields label="X" value={element.xRange} onChange={xRange => onChange({ ...element, xRange })} />
      {element.kind !== "numberLine" && <RangeFields label="Y" value={element.yRange} onChange={yRange => onChange({ ...element, yRange })} />}
      <div className="coordinates">
        <NumberField label="Axes width" min={0.1} max={30} value={element.xLength ?? element.xRange[1] - element.xRange[0]} onChange={xLength => onChange({ ...element, xLength })} />
        {element.kind !== "numberLine" && <NumberField label="Axes height" min={0.1} max={30} value={element.yLength ?? element.yRange[1] - element.yRange[0]} onChange={yLength => onChange({ ...element, yLength })} />}
      </div>
      {element.kind === "numberLine" && <label className="switch-field">Show numbers<Switch checked={element.includeNumbers ?? false}
        onCheckedChange={includeNumbers => onChange({ ...element, includeNumbers })} /></label>}
      <p className="hint">The position below sets the axes origin (0, 0).</p>
    </>}
    {positioned && <>
      <VectorFields label="Position" value={element.position} onChange={position => onChange({ ...element, position })} />
      {(element.kind === "line" || element.kind === "arrow") && <VectorFields label="End point" value={element.end} onChange={end => onChange({ ...element, end })} />}
      <p className={warning ? "hint warning" : "hint"}>{warning ?? "Manim units. X: −7.11 to 7.11; Y: −4 to 4. Large objects may be clipped."}</p>
      <div className="inline-actions">
        <Button variant="outline" size="xs" className="h-7 px-2.5" onClick={() => {
          if (element.kind === "line" || element.kind === "arrow") {
            const center = element.position.map((v, i) => (v + element.end[i]) / 2);
            onChange({ ...element, position: element.position.map((v, i) => v - center[i]) as typeof element.position,
              end: element.end.map((v, i) => v - center[i]) as typeof element.end });
          } else onChange({ ...element, position: [0, 0, 0] });
        }}><Crosshair />Center element</Button>
      </div>
    </>}
    <h3>Appearance</h3>
    <label>Color<span className="color-field"><ColorInput value={element.color ?? "#FFFFFF"} onChange={color => onChange({ ...element, color })} />
      <code>{(element.color ?? "#FFFFFF").toUpperCase()}</code></span></label>
    <div className="coordinates">
      <NumberField label="Scale" min={0.05} max={10} step={0.1} value={element.scale ?? 1} onChange={scale => onChange({ ...element, scale })} />
      <NumberField label="Opacity" min={0} max={1} step={0.05} value={element.opacity ?? 1} onChange={opacity => onChange({ ...element, opacity })} />
    </div>
    {positioned && <NumberField label="Rotation (degrees)" min={-360} max={360} step={15} value={element.rotationDegrees ?? 0} onChange={rotationDegrees => onChange({ ...element, rotationDegrees })} />}
    {timing && <><h3>Timing</h3>
      <SecondsField label="Appear at" value={element.appearsAtMs} onChange={appearsAtMs => onChange({ ...element, appearsAtMs })} />
      <SecondsField label="End at" min={100} value={element.disappearsAtMs ?? project?.scene.durationMs ?? 3000} onChange={disappearsAtMs => onChange({ ...element, disappearsAtMs })} />
      {element.disappearsAtMs !== undefined && <div className="inline-actions">
        <Button variant="outline" size="xs" className="h-7 px-2.5" onClick={() => { const next = { ...element }; delete next.disappearsAtMs; onChange(next); }}>
          <InfinityIcon />Keep until the scene ends</Button>
      </div>}
      <p className="hint">Instant appearance and removal. Add animations below for transitions.</p>
    </>}
  </>;
}
