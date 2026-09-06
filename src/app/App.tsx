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

import { addElement, elementLabels, elementSummary, positionWarning } from "../domain/catalog";
import { removeElement, animationLabels } from "../domain/timeline";
import { ElementInspector } from "./ElementInspector";
import { AnimationInspector } from "./AnimationInspector";
import { Timeline } from "./Timeline";
import { SecondsField } from "./ElementInspector";
import { useTheme } from "./useTheme";
import demo from "../../examples/official-demo.json";

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
        "Abra a versão desktop com npm run desktop para salvar e renderizar.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage(
      operation === "render"
        ? "Renderizando com Manim…"
        : "Aguardando arquivo…",
    );
    const snapshot = serialized;
    try {
      const result = await projectAction(operation, project);
      if (result.cancelled) {
        setMessage("Operação cancelada.");
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
        operation === "render" ? "Preview atualizado." : "Arquivo pronto.",
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
          aria-label="Nome do projeto"
          value={project.name}
          onChange={(e) => change({ ...project, name: e.target.value })}
        />
        <span className="save-state">
          {saved === serialized ? "Salvo" : "Não salvo"}
        </span>
        <nav aria-label="Arquivo">
          <button aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} title={theme === "dark" ? "Modo claro" : "Modo escuro"} onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            title="Abrir projeto"
            aria-label="Abrir projeto"
            disabled={busy}
            onClick={() => action("load")}
          >
            <FolderOpen size={18} />
          </button>
          <button
            title="Salvar projeto"
            aria-label="Salvar projeto"
            disabled={busy || !!validation}
            onClick={() => action("save")}
          >
            <Save size={18} />
          </button>
          <button
            title="Exportar Python"
            aria-label="Exportar Python"
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
            {busy ? "Processando…" : "Renderizar"}
          </button>
        </nav>
      </header>
      <aside className="sidebar">
        <section className="library">
          <div className="section-heading"><h2>Biblioteca</h2><button title="Abrir demonstração" aria-label="Abrir demonstração" onClick={() => {
            if (!window.confirm("Abrir a demonstração? Salve seu projeto antes. Você também pode desfazer esta ação.")) return;
            const error = validateProject(demo); if (error) { setMessage(error); return; }
            change(structuredClone(demo) as unknown as Project); setMessage("Demonstração aberta. Clique em Renderizar.");
          }}><Film size={17} /></button></div>
          <div className="catalog-grid">{(Object.keys(elementLabels) as Element["kind"][]).map(kind => <button
            key={kind} className="library-item" aria-label={"Adicionar " + elementLabels[kind]}
            onClick={() => { const next = addElement(project, kind); change(next); select(Object.keys(next.scene.elements).at(-1)!); }}>
            <Plus size={16} /><span>{elementLabels[kind]}</span>
          </button>)}</div>
        </section>
        <section className="inspector">
          <div className="section-heading"><h2>Propriedades</h2>{element && <button aria-label="Remover elemento" onClick={remove}><Trash2 size={16} /></button>}</div>
          {element ? <>
            <ElementInspector project={project} element={element} onChange={next => change({ ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [selection]: next } } })} />
            <AnimationInspector project={project} targetId={selection} onChange={change} />
          </> : <p className="hint">Adicione ou selecione um elemento para editar.</p>}
        </section>
        <div className="local-note">Renderização local · Manim CE</div>
      </aside>
      <section className="preview-panel" aria-label="Pré-visualização">
        <div className="preview-heading">
          <h2>Pré-visualização</h2>
          <span>
            {video
              ? rendered === serialized
                ? "Atualizado"
                : "Alterações não renderizadas"
              : "Nenhum render"}
          </span>
        </div>
        <div className="stage">
          {video ? (
            <video controls src={video} aria-label="Vídeo renderizado" />
          ) : (
            <div className="empty-preview">
              <Film size={36} strokeWidth={1} />
              <h2>Sua cena começa aqui</h2>
              <p>Adicione elementos e clique em Renderizar.</p>
            </div>
          )}
        </div>
        <div className="preview-footer">
          <span>Preview · 480p / 15 fps</span>
          <span>{(project.scene.durationMs / 1000).toFixed(1)} s</span>
        </div>
        <p className={validation ? "status error" : "status"} role="status">
          {validation || message || "Pronto para criar."}
        </p>
      </section>
      <section className="timeline" aria-label="Timeline">
        <div className="timeline-heading">
          <h2>
            Timeline{" "}
            <span>{Object.keys(project.scene.elements).length} elementos</span>
          </h2>
          <div className="history">
            <button
              aria-label="Desfazer"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
            <button
              aria-label="Refazer"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={17} />
            </button>
            <SecondsField label="Duração da cena" min={100} value={project.scene.durationMs} onChange={durationMs =>
              change({ ...project, scene: { ...project.scene, durationMs } })} />
          </div>
        </div>
        <Timeline project={project} selection={selection} onSelect={select} onChange={change} onError={setMessage} />
      </section>
    </main>
  );
}
