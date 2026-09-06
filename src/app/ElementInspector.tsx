import type { Element, Project } from "../domain/project";
import { positionWarning, elementSummary } from "../domain/catalog";

export function NumberField({ label, value, onChange, min, step = 0.25 }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; step?: number;
}) {
  return <label>{label}<input type="number" min={min} step={step}
    value={Number.isFinite(value) ? value : ""} onChange={event => onChange(event.target.valueAsNumber)} /></label>;
}
export function SecondsField({ label, value, onChange, min = 0 }: {
  label: string; value: number; onChange: (value: number) => void; min?: number;
}) {
  return <NumberField label={label + " (s)"} value={value / 1000} min={min / 1000} step={0.1}
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
    <NumberField label={label + " mínimo"} value={value[0]} onChange={number => onChange([number, value[1]])} />
    <NumberField label={label + " máximo"} value={value[1]} onChange={number => onChange([value[0], number])} />
  </div>;
}

export function ElementInspector({ element, onChange, project, timing = true }: {
  element: Element; onChange: (element: Element) => void; project?: Project; timing?: boolean;
}) {
  const warning = positionWarning(element);
  return <>
    {element.kind === "mathTex" && <label>Expressão LaTeX<textarea spellCheck={false} value={element.latex}
      onChange={event => onChange({ ...element, latex: event.target.value })} /></label>}
    {element.kind === "text" && <label>Conteúdo do texto<textarea value={element.text}
      onChange={event => onChange({ ...element, text: event.target.value })} /></label>}
    {(element.kind === "mathTex" || element.kind === "text") && <NumberField label="Tamanho do texto" value={element.fontSize ?? 48} min={8} step={1} onChange={fontSize => onChange({ ...element, fontSize })} />}
    {(element.kind === "circle" || element.kind === "dot") && <NumberField label="Raio" min={0.01} value={element.radius} onChange={radius => onChange({ ...element, radius })} />}
    {(element.kind === "square" || element.kind === "triangle") && <NumberField label="Tamanho" min={0.05} value={element.size} onChange={size => onChange({ ...element, size })} />}
    {element.kind === "rectangle" && <div className="coordinates">
      <NumberField label="Largura" min={0.01} value={element.width} onChange={width => onChange({ ...element, width })} />
      <NumberField label="Altura" min={0.01} value={element.height} onChange={height => onChange({ ...element, height })} />
    </div>}
    {element.kind === "functionGraph" && <>
      <label>Função<select value={element.expression} onChange={event => onChange({ ...element,
        expression: event.target.value as typeof element.expression,
        xRange: event.target.value === "sqrt(x)" ? [Math.max(0, element.xRange[0]), Math.max(1, element.xRange[1])] : element.xRange,
      })}>{["x^2", "(x - 2)^2 + 1", "sin(x)", "cos(x)", "sqrt(x)", "x", "x^3"].map(expression => <option key={expression}>{expression}</option>)}</select></label>
      <RangeFields label="X" value={element.xRange} onChange={xRange => onChange({ ...element, xRange })} />
      <label>Sistema de coordenadas<select value={element.axesId ?? ""} onChange={event => {
        const next = { ...element }; if (event.target.value) next.axesId = event.target.value; else delete next.axesId; onChange(next);
      }}><option value="">Coordenadas da cena</option>{Object.entries(project?.scene.elements ?? {}).filter(([, item]) =>
        item.kind === "axes" || item.kind === "numberPlane").map(([id, item]) => <option key={id} value={id}>{elementSummary(item)} · {id.slice(0, 8)}</option>)}</select></label>
      <p className="hint">Vincule aos eixos para manter a mesma escala e origem.</p>
    </>}
    {(element.kind === "axes" || element.kind === "numberPlane") && <>
      <RangeFields label="X" value={element.xRange} onChange={xRange => onChange({ ...element, xRange })} />
      <RangeFields label="Y" value={element.yRange} onChange={yRange => onChange({ ...element, yRange })} />
      <div className="coordinates">
        <NumberField label="Largura dos eixos" min={0.1} value={element.xLength ?? element.xRange[1] - element.xRange[0]} onChange={xLength => onChange({ ...element, xLength })} />
        <NumberField label="Altura dos eixos" min={0.1} value={element.yLength ?? element.yRange[1] - element.yRange[0]} onChange={yLength => onChange({ ...element, yLength })} />
      </div><p className="hint">A posição abaixo define a origem (0, 0) dos eixos.</p>
    </>}
    <VectorFields label="Posição" value={element.position} onChange={position => onChange({ ...element, position })} />
    {(element.kind === "line" || element.kind === "arrow") && <VectorFields label="Ponto final" value={element.end} onChange={end => onChange({ ...element, end })} />}
    <p className={warning ? "hint warning" : "hint"}>{warning ?? "Unidades Manim. X: −7,11 a 7,11; Y: −4 a 4. Objetos grandes podem ser cortados."}</p>
    <button className="subtle" onClick={() => {
      if (element.kind === "line" || element.kind === "arrow") {
        const center = element.position.map((v, i) => (v + element.end[i]) / 2);
        onChange({ ...element, position: element.position.map((v, i) => v - center[i]) as typeof element.position,
          end: element.end.map((v, i) => v - center[i]) as typeof element.end });
      } else onChange({ ...element, position: [0, 0, 0] });
    }}>Centralizar elemento</button>
    <label>Cor<input type="color" value={element.color ?? "#FFFFFF"} onChange={event => onChange({ ...element, color: event.target.value })} /></label>
    <NumberField label="Escala" min={0.05} step={0.1} value={element.scale ?? 1} onChange={scale => onChange({ ...element, scale })} />
    {timing && <><h3>Tempo</h3>
      <SecondsField label="Aparecer em" value={element.appearsAtMs} onChange={appearsAtMs => onChange({ ...element, appearsAtMs })} />
      <SecondsField label="Terminar em" min={100} value={element.disappearsAtMs ?? project?.scene.durationMs ?? 3000} onChange={disappearsAtMs => onChange({ ...element, disappearsAtMs })} />
      {element.disappearsAtMs !== undefined && <button className="subtle" onClick={() => { const next = { ...element }; delete next.disappearsAtMs; onChange(next); }}>Manter até o fim da cena</button>}
      <p className="hint">Entrada e corte instantâneos. Adicione animações abaixo para transições.</p>
    </>}
  </>;
}
