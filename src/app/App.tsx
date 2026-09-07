import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Play,
  Save,
  FolderOpen,
  Download,
  Undo2,
  Redo2,
  FunctionSquare,
  Trash2,
  Film,
  Moon,
  Sun,
} from "lucide-react";
import {
  initialProject,
  validateProject,
  type Project,
  type Element,
} from "../domain/project";
import {
  desktopAvailable,
  previewUrl,
  projectAction,
} from "../infrastructure/desktop";

import { addElement, additionBlocked, elementGroups, elementLabels } from "../domain/catalog";
import { removeElement, animationLabels } from "../domain/timeline";
import { ElementInspector } from "./ElementInspector";
import { AnimationInspector } from "./AnimationInspector";
import { Timeline } from "./Timeline";
import { SecondsField } from "./ElementInspector";
import { useTheme } from "./useTheme";
import officialDemo from "../../examples/official-demo.json";
import calculusArea from "../../examples/calculus-area.json";
import shapeMotion from "../../examples/shape-motion.json";

const examples: { key: string; label: string; project: unknown }[] = [
  { key: "official-demo", label: "Parabola · transformation demo", project: officialDemo },
  { key: "calculus-area", label: "Area under the curve", project: calculusArea },
  { key: "shape-motion", label: "Shapes and motion", project: shapeMotion },
];

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [project, setProject] = useState(initialProject);
  const [selection, select] = useState("equation-1");
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [video, setVideo] = useState("");
  const [rendered, setRendered] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const element = project.scene.elements[selection];
  useEffect(() => {
    if (!project.scene.elements[selection])
      select(Object.keys(project.scene.elements)[0] ?? "");
  }, [project, selection]);
  const serialized = JSON.stringify(project);
  const validation = validateProject(project);
  const change = (next: Project) => {
    setPast((p) => [...p, project]);
    setFuture([]);
    setProject(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [project, ...f]);
    setProject(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, project]);
    setProject(future[0]);
    setFuture((f) => f.slice(1));
  };
  async function action(operation: "save" | "load" | "export" | "render") {
    if (lock.current) return;
    if (!desktopAvailable()) {
      setMessage(
        "Open the desktop app with npm run desktop to save and render.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage(
      operation === "render"
        ? "Rendering with Manim…"
        : "Waiting for a file…",
    );
    const snapshot = serialized;
    try {
      const result = await projectAction(operation, project);
      if (result.cancelled) {
        setMessage("Operation cancelled.");
        return;
      }
      if (result.project) {
        const error = validateProject(result.project);
        if (error) throw Error(error);
        change(result.project);
        select(Object.keys(result.project.scene.elements)[0] ?? "");
        setSaved(JSON.stringify(result.project));
      }
      if (operation === "render" && result.path) {
        setVideo(previewUrl(result.path));
        setRendered(snapshot);
      }
      if (operation === "save") setSaved(snapshot);
      setMessage(
        operation === "render" ? "Preview updated." : "File ready.",
      );
    } catch (error) {
      setMessage(String(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const remove = () => {
    change(removeElement(project, selection));
  };
  return (
    <main className="workspace">
      <header className="toolbar">
        <div className="brand">
          <FunctionSquare size={23} />
          <strong>manim-editor</strong>
          <span className="divider" />
        </div>
        <input
          className="project-name"
          aria-label="Project name"
          value={project.name}
          onChange={(e) => change({ ...project, name: e.target.value })}
        />
        <span className="save-state">
          {saved === serialized ? "Saved" : "Unsaved"}
        </span>
        <nav aria-label="File">
          <button aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            title="Open project"
            aria-label="Open project"
            disabled={busy}
            onClick={() => action("load")}
          >
            <FolderOpen size={18} />
          </button>
          <button
            title="Save project"
            aria-label="Save project"
            disabled={busy || !!validation}
            onClick={() => action("save")}
          >
            <Save size={18} />
          </button>
          <button
            title="Export Python"
            aria-label="Export Python"
            disabled={busy || !!validation}
            onClick={() => action("export")}
          >
            <Download size={18} />
          </button>
          <button
            className="primary"
            disabled={busy || !!validation}
            onClick={() => action("render")}
          >
            <Play size={15} />
            {busy ? "Processing…" : "Render"}
          </button>
        </nav>
      </header>
      <aside className="sidebar">
        <section className="library">
          <div className="section-heading"><h2>Library</h2>
            <select aria-label="Open example" value="" onChange={event => {
              const example = examples.find(item => item.key === event.target.value);
              if (!example) return;
              if (!window.confirm("Open this example? Save your project first. You can also undo this action.")) return;
              const error = validateProject(example.project);
              if (error) { setMessage(error); return; }
              change(structuredClone(example.project) as Project);
              setMessage(example.label + " opened. Click Render.");
            }}>
              <option value="">Open example…</option>
              {examples.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </div>
          {elementGroups.map(group => <div key={group.label} className="catalog-group">
            <h3>{group.label}</h3>
            <div className="catalog-grid">{group.kinds.map(kind => {
              const blocked = additionBlocked(project, kind);
              return <button key={kind} className="library-item" disabled={!!blocked}
                aria-label={"Add " + elementLabels[kind]} title={blocked ?? elementLabels[kind]}
                onClick={() => { const next = addElement(project, kind); change(next); select(Object.keys(next.scene.elements).at(-1)!); }}>
                <Plus size={16} /><span>{elementLabels[kind]}</span>
              </button>;
            })}</div>
          </div>)}
        </section>
        <section className="inspector">
          <div className="section-heading"><h2>Properties</h2>{element && <button aria-label="Remove element" onClick={remove}><Trash2 size={16} /></button>}</div>
          {element ? <>
            <ElementInspector project={project} element={element} onChange={next => change({ ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [selection]: next } } })} />
            <AnimationInspector project={project} targetId={selection} onChange={change} />
          </> : <p className="hint">Add or select an element to edit.</p>}
        </section>
        <div className="local-note">Local rendering · Manim CE</div>
      </aside>
      <section className="preview-panel" aria-label="Preview">
        <div className="preview-heading">
          <h2>Preview</h2>
          <span>
            {video
              ? rendered === serialized
                ? "Up to date"
                : "Unrendered changes"
              : "Not rendered yet"}
          </span>
        </div>
        <div className="stage">
          {video ? (
            <video controls src={video} aria-label="Rendered video" />
          ) : (
            <div className="empty-preview">
              <Film size={36} strokeWidth={1} />
              <h2>Your scene starts here</h2>
              <p>Add elements and click Render.</p>
            </div>
          )}
        </div>
        <div className="preview-footer">
          <span>Preview · 480p / 15 fps</span>
          <span>{(project.scene.durationMs / 1000).toFixed(1)} s</span>
        </div>
        <p className={validation ? "status error" : "status"} role="status">
          {validation || message || "Ready to create."}
        </p>
      </section>
      <section className="timeline" aria-label="Timeline">
        <div className="timeline-heading">
          <h2>
            Timeline{" "}
            <span>{Object.keys(project.scene.elements).length} {Object.keys(project.scene.elements).length === 1 ? "element" : "elements"}</span>
          </h2>
          <div className="history">
            <button
              aria-label="Undo"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
            <button
              aria-label="Redo"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={17} />
            </button>
            <SecondsField label="Scene duration" min={100} value={project.scene.durationMs} onChange={durationMs =>
              change({ ...project, scene: { ...project.scene, durationMs } })} />
          </div>
        </div>
        <Timeline project={project} selection={selection} onSelect={select} onChange={change} onError={setMessage} />
      </section>
    </main>
  );
}
