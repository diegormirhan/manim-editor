import type { ReactNode } from "react";
import { FilePlus2, FolderOpen, X } from "lucide-react";
import type { Project } from "../domain/project";
import type { RecentProject } from "../domain/recent-projects";
import { lifetimes, seconds } from "../domain/timeline";
import { Button } from "@/components/ui/button";
import { Hint } from "./Hint";
import { stageStyle } from "./stage";
import { toneOf } from "./Timeline";
import { Wordmark } from "./Logo";
import { examples } from "./examples";
import { version } from "../../package.json";

const MAX_LANES = 6;
const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;
const objectCount = (project: Project) => {
  const count = Object.keys(project.scene.elements).length;
  return `${count} ${count === 1 ? "object" : "objects"}`;
};
const timeUnits: [Intl.RelativeTimeFormatUnit, number][] =
  [["year", 31_536e6], ["month", 2_592e6], ["week", 6_048e5], ["day", 864e5], ["hour", 36e5], ["minute", 6e4]];
function openedAgo(at: number) {
  const elapsed = at - Date.now();
  const [unit, size] = timeUnits.find(([, size]) => Math.abs(elapsed) >= size) ?? [];
  return unit ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(elapsed / size!), unit) : "just now";
}

/** A frame of the scene's own timeline: one bar per object, coloured by kind, on its background. */
export function ProjectThumbnail({ project }: { project: Project }) {
  const { durationMs, elements } = project.scene;
  const spans = lifetimes(project.scene);
  const lanes = Object.entries(elements).slice(0, MAX_LANES);
  return (
    <span className="project-thumb" style={stageStyle(project.scene.background)}>
      {lanes.length
        ? <span className="thumb-lanes">{lanes.map(([id, element]) => <span key={id} className="thumb-lane" style={{
            background: `var(--tone-${toneOf(element.kind)})`,
            marginLeft: percent(spans[id][0], durationMs), marginRight: percent(durationMs - spans[id][1], durationMs) }} />)}</span>
        : <span className="thumb-empty">Empty scene</span>}
      <span className="thumb-duration">{seconds(durationMs)}</span>
    </span>
  );
}

function ProjectCard({ project, title, label, details, path, onOpen, onForget }: {
  project: Project; title: string; label: string; details: ReactNode[]; path?: string; onOpen: () => void; onForget?: () => void;
}) {
  const card = <button className="project-open" aria-label={label} onClick={onOpen}>
    <ProjectThumbnail project={project} />
    <span className="project-meta">
      <span className="project-name">{title}</span>
      {details.map((detail, index) => <span key={index} className="project-detail">{detail}</span>)}
    </span>
  </button>;
  return (
    <li className="project-card">
      {path ? <Hint label={path}>{card}</Hint> : card}
      {onForget && <Hint label="Remove from recent projects">
        <Button variant="ghost" size="icon-xs" className="project-forget" aria-label={`Remove ${title} from recent projects`} onClick={onForget}><X /></Button>
      </Hint>}
    </li>
  );
}

type StartScreenProps = {
  recents: RecentProject[];
  /** The project already open in this window, offered first so returning to it is one click. */
  current: { project: Project; filePath: string; dirty: boolean } | null;
  status: string;
  busy: boolean;
  titleActions: ReactNode;
  onNew: () => void; onOpen: () => void; onContinue: () => void;
  onOpenRecent: (path: string) => void; onForget: (path: string) => void; onExample: (key: string) => void;
};

/** Where every session starts, like a video editor's project manager: recent work, then new. */
export function StartScreen({ recents, current, status, busy, titleActions, onNew, onOpen, onContinue, onOpenRecent, onForget, onExample }: StartScreenProps) {
  const others = recents.filter(entry => entry.path.toLowerCase() !== current?.filePath.toLowerCase());
  return (
    <main className="projects-screen">
      <header className="toolbar" data-tauri-drag-region="deep">
        <span className="brand"><Wordmark /></span>
        <span className="title-actions">{titleActions}</span>
      </header>
      <div className="start-body">
        <div className="start-content">
          <div className="start-head">
            <div>
              <h1>Projects</h1>
              <p>Pick up a scene where you left it, or start a new one.</p>
            </div>
            <div className="start-actions">
              <Hint label="Open a project file" keys="Ctrl+O">
                <Button variant="outline" disabled={busy} onClick={onOpen}><FolderOpen />Open…</Button>
              </Hint>
              <Hint label="Start from an empty stage" keys="Ctrl+N">
                <Button className="font-semibold" disabled={busy} onClick={onNew}><FilePlus2 />New project</Button>
              </Hint>
            </div>
          </div>

          <section className="start-section" aria-labelledby="recent-heading">
            <h2 id="recent-heading">Recent</h2>
            {current || others.length ? <ul className="project-grid">
              {current && <ProjectCard project={current.project} title={current.project.name} label={`Continue ${current.project.name}`}
                onOpen={onContinue} path={current.filePath || undefined}
                details={[current.dirty ? <><span className="dot" />Unsaved changes</> : current.filePath ? fileName(current.filePath) : "Not saved to a file",
                  "Open in this window"]} />}
              {others.map(entry => <ProjectCard key={entry.path} project={entry.project} title={entry.project.name}
                label={`Open ${entry.project.name}`} path={entry.path}
                details={[fileName(entry.path), `Opened ${openedAgo(entry.openedAt)}`]}
                onOpen={() => onOpenRecent(entry.path)} onForget={() => onForget(entry.path)} />)}
            </ul> : <p className="start-empty">Projects you open or save appear here.</p>}
          </section>

          <section className="start-section" aria-labelledby="examples-heading">
            <h2 id="examples-heading">Start from an example</h2>
            <ul className="project-grid">
              {examples.map(example => <ProjectCard key={example.key} project={example.project} title={example.label}
                label={`Open example ${example.label}`} onOpen={() => onExample(example.key)}
                details={[`${objectCount(example.project)} · ${seconds(example.project.scene.durationMs)}`]} />)}
            </ul>
          </section>
        </div>
      </div>
      <footer className="statusbar">
        <p className="status" role="status">{status}</p>
        <span>Version {version}</span>
      </footer>
    </main>
  );
}
