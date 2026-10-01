import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Save,
  FolderOpen,
  Download,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  Search,
  Film,
  Moon,
  Sun,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
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

import { addElement, additionBlocked, duplicateElement, elementGroups, elementLabels } from "../domain/catalog";
import { removeElement, timecode } from "../domain/timeline";
import { ElementInspector } from "./ElementInspector";
import { AnimationInspector } from "./AnimationInspector";
import { Timeline } from "./Timeline";
import { ElementIcon } from "./ElementIcon";
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
  const [search, setSearch] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [timelineHeight, setTimelineHeight] = useState(() => Math.max(250, Math.round(window.innerHeight * 0.42)));
  const [playing, setPlaying] = useState(false);
  const lock = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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
  const duplicate = () => {
    const next = duplicateElement(project, selection);
    if (next === project) return;
    change(next);
    select(Object.keys(next.scene.elements).at(-1)!);
  };
  // The playhead is a scene time, so a shorter scene must pull it back.
  const scrub = useCallback((ms: number) => {
    const clamped = Math.min(Math.max(0, ms), project.scene.durationMs);
    setPlayheadMs(clamped);
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration)) video.currentTime = clamped / 1000;
  }, [project.scene.durationMs]);
  useEffect(() => {
    if (playheadMs > project.scene.durationMs) setPlayheadMs(project.scene.durationMs);
  }, [project.scene.durationMs, playheadMs]);
  useEffect(() => {
    const editing = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
        else if (key === "y") { event.preventDefault(); redo(); }
        else if (key === "s") { event.preventDefault(); if (!validation) action("save"); }
        else if (key === "d") { event.preventDefault(); if (!editing(event.target)) duplicate(); }
        else if (key === "enter") { event.preventDefault(); if (!validation) action("render"); }
        return;
      }
      if (editing(event.target)) return;
      if (key === "delete" && element) { event.preventDefault(); remove(); }
      else if (key === " " && video && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const togglePlay = () => {
    const player = videoRef.current;
    if (!player) return;
    if (player.paused) void player.play(); else player.pause();
  };
  const resize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY, startHeight = timelineHeight;
    document.body.style.userSelect = "none";
    const onMove = (move: PointerEvent) =>
      setTimelineHeight(Math.min(Math.max(160, startHeight - (move.clientY - startY)), window.innerHeight - 300));
    const stop = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
  };
  const elementCount = Object.keys(project.scene.elements).length;
  const previewState = video ? (rendered === serialized ? "Up to date" : "Changes not rendered") : "Not rendered yet";
  const frame = 1000 / 15;
  return (
    <main className="workspace" style={{ gridTemplateRows: `40px minmax(220px, 1fr) ${timelineHeight}px 26px` }}>
      <header className="toolbar">
        <span className="brand">manim-editor</span>
        <input className="project-name" aria-label="Project name" value={project.name}
          onChange={(e) => change({ ...project, name: e.target.value })} />
        <span className={saved === serialized ? "save-state" : "save-state dirty"}>
          {saved === serialized ? "Saved" : "Unsaved"}
        </span>
        <nav aria-label="File">
          <button className="text-button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!past.length} onClick={undo}>
            <Undo2 size={15} /><span>Undo</span></button>
          <button className="text-button" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!future.length} onClick={redo}>
            <Redo2 size={15} /><span>Redo</span></button>
          <span className="bar-divider" />
          <button className="text-button" title="Open project" aria-label="Open project" disabled={busy} onClick={() => action("load")}>
            <FolderOpen size={15} /><span>Open</span></button>
          <button className="text-button" title="Save project (Ctrl+S)" aria-label="Save project" disabled={busy || !!validation} onClick={() => action("save")}>
            <Save size={15} /><span>Save</span></button>
          <button className="text-button" title="Export Python" aria-label="Export Python" disabled={busy || !!validation} onClick={() => action("export")}>
            <Download size={15} /><span>Export Python</span></button>
          <button className="icon-button" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button className="primary" title="Render (Ctrl+Enter)" disabled={busy || !!validation} onClick={() => action("render")}>
            <Play size={13} fill="currentColor" />{busy ? "Rendering…" : "Render"}
          </button>
        </nav>
      </header>

      <section className="upper">
        <aside className="panel pool" aria-label="Object pool">
          <div className="panel-heading"><h2>Objects</h2>
            <select aria-label="Open example" value="" onChange={event => {
              const example = examples.find(item => item.key === event.target.value);
              if (!example) return;
              if (!window.confirm("Open this example? Save your project first. You can also undo this action.")) return;
              const error = validateProject(example.project);
              if (error) { setMessage(error); return; }
              change(structuredClone(example.project) as Project);
              setMessage(example.label + " opened. Click Render.");
            }}>
              <option value="">Examples…</option>
              {examples.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </div>
          <section className="library">
            <div className="search-field">
              <Search size={13} aria-hidden="true" />
              <input type="search" aria-label="Search the library" placeholder="Search objects"
                value={search} onChange={event => setSearch(event.target.value)} />
            </div>
            {elementGroups.map(group => ({ ...group, kinds: group.kinds.filter(kind =>
              elementLabels[kind].toLowerCase().includes(search.trim().toLowerCase())) }))
              .filter(group => group.kinds.length)
              .map(group => <div key={group.label} className="catalog-group">
              <h3>{group.label}</h3>
              <div className="catalog-grid">{group.kinds.map(kind => {
                const blocked = additionBlocked(project, kind);
                return <button key={kind} className="library-item" disabled={!!blocked}
                  aria-label={"Add " + elementLabels[kind]} title={blocked ?? "Add " + elementLabels[kind]}
                  onClick={() => { const next = addElement(project, kind); change(next); select(Object.keys(next.scene.elements).at(-1)!); }}>
                  <span className="thumb"><ElementIcon kind={kind} size={22} /></span><span className="name">{elementLabels[kind]}</span>
                </button>;
              })}</div>
            </div>)}
            {search.trim() && !elementGroups.some(group => group.kinds.some(kind =>
              elementLabels[kind].toLowerCase().includes(search.trim().toLowerCase()))) &&
              <p className="hint">No element matches “{search.trim()}”.</p>}
          </section>
        </aside>

        <section className="panel viewer" aria-label="Preview">
          <div className="panel-heading"><h2>Viewer</h2>
            <span className="muted">{video ? "Last render · 480p · 15 fps" : "480p · 15 fps"}</span>
            <span className={video && rendered !== serialized ? "preview-state stale" : "preview-state"}>{previewState}</span>
          </div>
          <div className="stage">
            {video ? (
              <video ref={videoRef} src={video} aria-label="Rendered video" onClick={togglePlay}
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                onTimeUpdate={event => setPlayheadMs(Math.round(event.currentTarget.currentTime * 1000))} />
            ) : (
              <div className="empty-preview">
                <Film size={32} strokeWidth={1.25} />
                <h2>Your scene starts here</h2>
                <p>{elementCount ? "Render (Ctrl+Enter) to preview the scene here, then scrub the result."
                  : "Add objects from the pool, place them in time, then Render."}</p>
              </div>
            )}
          </div>
          <div className="transport">
            <span className="timecode">{timecode(playheadMs)}</span>
            <div className="transport-keys">
              <button aria-label="Go to start" title="Start" onClick={() => scrub(0)}><SkipBack size={15} /></button>
              <button aria-label="Previous frame" title="Previous frame" onClick={() => scrub(playheadMs - frame)}><StepBack size={15} /></button>
              <button aria-label={playing ? "Pause" : "Play"} title={video ? "Play / pause (Space)" : "Render to play"} disabled={!video} onClick={togglePlay}>
                {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button>
              <button aria-label="Next frame" title="Next frame" onClick={() => scrub(playheadMs + frame)}><StepForward size={15} /></button>
              <button aria-label="Go to end" title="End" onClick={() => scrub(project.scene.durationMs)}><SkipForward size={15} /></button>
            </div>
            <span className="timecode dim">DUR {timecode(project.scene.durationMs)}</span>
          </div>
        </section>

        <aside className="panel inspector-panel" aria-label="Inspector">
          <div className="panel-heading"><h2>Inspector</h2>{element && <span className="row-actions">
            <button aria-label="Duplicate element" title="Duplicate (Ctrl+D)" onClick={duplicate}><Copy size={14} /></button>
            <button aria-label="Remove element" title="Remove (Delete)" onClick={remove}><Trash2 size={14} /></button>
          </span>}</div>
          <section className="inspector">
            {element ? <>
              <p className="inspector-title"><ElementIcon kind={element.kind} size={15} />{elementLabels[element.kind]}</p>
              <ElementInspector project={project} element={element} onChange={next => change({ ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [selection]: next } } })} />
              <AnimationInspector project={project} targetId={selection} onChange={change} />
            </> : <p className="hint">Select an object in the timeline, or add one from the pool.</p>}
          </section>
        </aside>
      </section>

      <section className="panel timeline" aria-label="Timeline">
        <div className="timeline-resizer" role="separator" aria-label="Resize timeline"
          aria-orientation="horizontal" tabIndex={0} onPointerDown={resize}
          onKeyDown={event => {
            if (event.key === "ArrowUp") setTimelineHeight(h => Math.min(h + 24, window.innerHeight - 300));
            else if (event.key === "ArrowDown") setTimelineHeight(h => Math.max(160, h - 24));
          }} />
        <div className="timeline-heading">
          <span className="timecode hot">{timecode(playheadMs)}</span>
          <h2>Timeline <span>{elementCount} {elementCount === 1 ? "element" : "elements"}</span></h2>
          <div className="history">
            <SecondsField label="Scene duration" min={100} value={project.scene.durationMs} onChange={durationMs =>
              change({ ...project, scene: { ...project.scene, durationMs } })} />
          </div>
        </div>
        <Timeline project={project} selection={selection} onSelect={select} onChange={change}
          onError={setMessage} playheadMs={playheadMs} onScrub={scrub} />
      </section>

      <footer className="statusbar">
        <p className={validation ? "status error" : "status"} role="status">
          {validation || message || "Ready to create."}
        </p>
        <span>Local rendering · Manim CE</span>
      </footer>
    </main>
  );
}
