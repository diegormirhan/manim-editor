import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Save,
  SaveAll,
  FolderOpen,
  FilePlus2,
  Download,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  Search,
  Film,
  Moon,
  Sun,
  Square,
  Keyboard,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  FileCode2,
  Settings as SettingsIcon,
  File as FileIcon,
  LayoutGrid,
  Settings2,
  Video,
} from "lucide-react";
import {
  emptyProject,
  isProject,
  validateProject,
  type Project,
} from "../domain/project";
import {
  cancelRender,
  desktopAvailable,
  previewUrl,
  projectAction,
  renderProgress,
  type Operation,
  type RenderProgress,
} from "../infrastructure/desktop";
import { PREVIEW_RESOLUTIONS, describeOutput, describeQuality, renderOptions, type Resolution } from "../domain/render-settings";

import { addElement, additionBlocked, duplicateElement, elementGroups, elementLabels } from "../domain/catalog";
import { frameAt, removeAnimation, removeElement, seconds, timecode } from "../domain/timeline";
import { ElementInspector } from "./ElementInspector";
import { AnimationInspector } from "./AnimationInspector";
import { Timeline } from "./Timeline";
import { ElementIcon } from "./ElementIcon";
import { SecondsField } from "./ElementInspector";
import { ConfirmDialog, ShortcutsDialog, type ConfirmRequest } from "./Dialogs";
import { Hint } from "./Hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsDialog, type SettingsTab } from "./SettingsDialog";
import { StartScreen } from "./StartScreen";
import { Splash } from "./Splash";
import { UpdateBanner } from "./UpdateBanner";
import { WindowControls } from "./WindowControls";
import { Wordmark } from "./Logo";
import { examples } from "./examples";
import { stageStyle } from "./stage";
import { useRecentProjects } from "./useRecentProjects";
import { useSettings } from "./useSettings";
import { useTheme } from "./useTheme";

const SESSION_KEY = "manim-editor-session";
const FRAME_MS = 1000 / 15;

/** The last session, so a crash or a closed window never costs the user their work. */
function recoveredSession(): { project: Project; filePath: string; saved: string } | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (!isProject(session?.project)) return null;
    return { project: session.project, filePath: String(session.filePath ?? ""), saved: String(session.saved ?? "") };
  } catch {
    return null;
  }
}

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const editing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
// Keystrokes in one field within a second of each other undo as one step.
const typingInto = (target: Element | null) =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && !["checkbox", "radio"].includes(target.type));

export function App() {
  const { theme, preference: themePreference, setPreference: setThemePreference, toggleTheme } = useTheme();
  const [settings, updateSettings] = useSettings();
  const { recents, remember, forget } = useRecentProjects();
  // The last session waits on the start screen; until the user picks something, an empty stage stands in.
  const [boot] = useState(() => {
    const session = settings.restoreSession ? recoveredSession() : null;
    const project = session?.project ?? emptyProject();
    return { project, filePath: session?.filePath ?? "", saved: session ? session.saved : JSON.stringify(project), recovered: !!session };
  });
  const [view, setView] = useState<"start" | "editor">("start");
  const [hasCurrent, setHasCurrent] = useState(boot.recovered);
  const [splash, setSplash] = useState(true);
  const endSplash = useCallback(() => setSplash(false), []);
  const [project, setProject] = useState(boot.project);
  const [filePath, setFilePath] = useState(boot.filePath);
  const [saved, setSaved] = useState(boot.saved);
  const [selection, select] = useState(() => Object.keys(boot.project.scene.elements)[0] ?? "");
  const [selectedAnimation, setSelectedAnimation] = useState<number | null>(null);
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [video, setVideo] = useState("");
  const [rendered, setRendered] = useState("");
  const [busy, setBusy] = useState<Operation | "">("");
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [timelineHeight, setTimelineHeight] = useState(() => Math.max(250, Math.round(window.innerHeight * 0.42)));
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoomLevel] = useState(1);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [previewQuality, setPreviewQuality] = useState("");
  const playNext = useRef(false);
  const answer = useRef<(confirmed: boolean) => void>(() => {});
  const lastEdit = useRef<{ target: Element | null; at: number }>({ target: null, at: 0 });
  const lock = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const element = project.scene.elements[selection];
  const serialized = JSON.stringify(project);
  const validation = validateProject(project);
  const dirty = saved !== serialized;
  const rendering = busy === "render";
  // Exports run Manim too, so they share the progress, the clock and Esc.
  const manimBusy = rendering || busy === "exportVideo";

  useEffect(() => {
    if (!project.scene.elements[selection]) select(Object.keys(project.scene.elements)[0] ?? "");
    if (selectedAnimation !== null && !project.scene.animations?.[selectedAnimation]) setSelectedAnimation(null);
  }, [project, selection, selectedAnimation]);
  useEffect(() => {
    try {
      if (settings.restoreSession) localStorage.setItem(SESSION_KEY, JSON.stringify({ project, filePath, saved }));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* storage full or blocked */ }
  }, [project, filePath, saved, settings.restoreSession]);

  const change = (next: Project) => {
    const target = document.activeElement, now = performance.now();
    const continuing = typingInto(target) && lastEdit.current.target === target && now - lastEdit.current.at < 1000;
    lastEdit.current = { target: typingInto(target) ? target : null, at: now };
    if (!continuing) setPast((p) => [...p, project]);
    setFuture([]);
    setProject(next);
  };
  const undo = () => {
    if (!past.length) return;
    lastEdit.current.target = null;
    setFuture((f) => [project, ...f]);
    setProject(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    lastEdit.current.target = null;
    setPast((p) => [...p, project]);
    setProject(future[0]);
    setFuture((f) => f.slice(1));
  };
  // A new selection starts a new undo step, even when React reuses the same field.
  const selectElement = (id: string) => { select(id); setSelectedAnimation(null); lastEdit.current.target = null; };
  const selectAnimation = (index: number, target?: string) => {
    if (target) select(target);
    setSelectedAnimation(index);
    lastEdit.current.target = null;
  };

  const ask = (request: ConfirmRequest) => new Promise<boolean>(resolve => {
    answer.current = resolve;
    setConfirmRequest(request);
  });
  const confirmDiscard = async () => !dirty || ask({
    title: "Discard unsaved changes?",
    message: `“${project.name}” has changes that are not saved to a file. They will be lost.`,
    confirm: "Discard changes",
  });
  /** Another document: its own history, file and preview, opened in the editor. */
  const adopt = (next: Project, path: string) => {
    setView("editor");
    setHasCurrent(true);
    setProject(next);
    setPast([]);
    setFuture([]);
    setFilePath(path);
    setSaved(JSON.stringify(next));
    selectElement(Object.keys(next.scene.elements)[0] ?? "");
    setPlayheadMs(0);
    setVideo("");
    setRendered("");
    setPreviewQuality("");
  };

  /** `recentPath` names the file for openRecent; every other operation works on the open document. */
  async function action(operation: Operation, recentPath = "") {
    if (lock.current) return;
    if (!desktopAvailable()) {
      setMessage("Open the desktop app with npm run desktop to open, save and render.");
      return;
    }
    const opening = operation === "load" || operation === "openRecent";
    if (opening && !await confirmDiscard()) return;
    lock.current = true;
    setBusy(operation);
    setMessage(operation === "render" ? "Rendering with Manim…" : operation === "openRecent" ? `Opening ${fileName(recentPath)}…`
      : operation === "save" && filePath ? "Saving…" : "Waiting for a file…");
    const snapshot = serialized;
    const { preview, output } = settings;
    // The preview renders at viewer quality; the video and the Python script follow the export settings.
    const options = operation === "render" ? renderOptions(preview)
      : operation === "exportVideo" ? renderOptions(output, output.format, output.transparent)
      : operation === "export" ? renderOptions(output) : undefined;
    try {
      const result = await projectAction(operation, project, operation === "openRecent" ? recentPath : filePath, options);
      if (result.cancelled) {
        setMessage(operation === "render" ? "Render cancelled. The previous preview is unchanged."
          : operation === "exportVideo" ? "Export cancelled. No video was written." : "");
        return;
      }
      if (opening && result.project && result.path) {
        const error = validateProject(result.project);
        if (error) throw Error(error);
        adopt(result.project, result.path);
        remember(result.project, result.path);
        setMessage(`Opened ${fileName(result.path)}.`);
      } else if (operation === "render" && result.path) {
        setVideo(previewUrl(result.path));
        setRendered(snapshot);
        setPreviewQuality(describeQuality(preview));
        playNext.current = settings.playAfterRender;
        setMessage("Preview updated.");
      } else if (operation === "exportVideo" && result.path) {
        setMessage(`Exported ${fileName(result.path)} · ${describeOutput(output)}.`);
      } else if (result.path) {
        if (operation !== "export") {
          setFilePath(result.path);
          setSaved(snapshot);
          remember(project, result.path);
        }
        setMessage(`${operation === "export" ? "Exported" : "Saved"} ${fileName(result.path)}.`);
      }
    } catch (error) {
      setMessage((operation === "render" ? "Render failed. " : operation === "exportVideo" ? "Export failed. "
        : operation === "openRecent" ? `Couldn't open ${fileName(recentPath)}. ` : "")
        + String(error).replace(/^Error: /, ""));
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  // A render or a file dialog in flight belongs to the current document.
  const newProject = async () => {
    if (busy || !await confirmDiscard()) return;
    adopt(emptyProject(), "");
    setMessage("New project. Add objects from the pool; each starts at the playhead.");
  };
  const openExample = async (key: string) => {
    const example = examples.find(item => item.key === key);
    if (!example || busy || !await confirmDiscard()) return;
    adopt(structuredClone(example.project), "");
    setMessage(example.label + " opened. Click Render.");
  };
  const showProjects = () => { setMessage(""); setView("start"); };
  const stopRender = () => {
    if (!manimBusy) return;
    setMessage(rendering ? "Cancelling the render…" : "Cancelling the export…");
    void cancelRender();
  };
  const setBackground = (color: string | undefined) => {
    const scene = { ...project.scene };
    if (color) scene.background = color; else delete scene.background;
    change({ ...project, scene });
  };
  const add = (kind: Project["scene"]["elements"][string]["kind"]) => {
    const next = addElement(project, kind, playheadMs);
    const id = Object.keys(next.scene.elements).at(-1)!;
    change(next);
    selectElement(id);
    setMessage(`${elementLabels[kind]} added at ${seconds(next.scene.elements[id].appearsAtMs)}.`);
  };
  const remove = () => {
    if (selectedAnimation !== null) {
      change(removeAnimation(project, selectedAnimation));
      setSelectedAnimation(null);
      setMessage("Animation removed. Ctrl+Z restores it.");
    } else if (element) {
      change(removeElement(project, selection));
      setMessage(`${elementLabels[element.kind]} removed. Ctrl+Z restores it.`);
    }
  };
  const duplicate = () => {
    const next = duplicateElement(project, selection);
    if (next === project) return;
    change(next);
    selectElement(Object.keys(next.scene.elements).at(-1)!);
  };
  // The playhead is a whole-millisecond scene time, so a shorter scene must pull it back.
  const scrub = useCallback((ms: number) => {
    const clamped = Math.round(Math.min(Math.max(0, ms), project.scene.durationMs));
    setPlayheadMs(clamped);
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration)) video.currentTime = clamped / 1000;
  }, [project.scene.durationMs]);
  useEffect(() => {
    if (playheadMs > project.scene.durationMs) setPlayheadMs(project.scene.durationMs);
  }, [project.scene.durationMs, playheadMs]);
  // At the deepest zoom about one second of the scene fills the timeline.
  const maxZoom = Math.max(1, project.scene.durationMs / 1000);
  const setZoom = useCallback((next: number) => setZoomLevel(Math.min(maxZoom, Math.max(1, next))), [maxZoom]);
  useEffect(() => { if (zoom > maxZoom) setZoomLevel(maxZoom); }, [zoom, maxZoom]);
  // Steps count whole frames, so repeated steps never drift off the frame grid.
  const step = (frames: number) => scrub((frameAt(playheadMs) + frames) * FRAME_MS);
  // timeupdate fires a few times a second; the display refresh keeps the playhead continuous.
  useEffect(() => {
    if (!playing) return;
    let frame = requestAnimationFrame(function follow() {
      const player = videoRef.current;
      if (player) setPlayheadMs(Math.round(player.currentTime * 1000));
      frame = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    if (!manimBusy) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [manimBusy]);
  // Manim reports finished segments through the desktop side; the bar follows them.
  useEffect(() => {
    setProgress(null);
    if (!manimBusy) return;
    const timer = setInterval(() => { renderProgress().then(setProgress).catch(() => {}); }, 300);
    return () => clearInterval(timer);
  }, [manimBusy]);
  const togglePlay = () => {
    const player = videoRef.current;
    if (!player) return;
    if (player.paused) void player.play(); else player.pause();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Keys typed in an open menu are the menu's: Esc closes it without cancelling Manim, arrows move through it.
      const inMenu = event.target instanceof Element && !!event.target.closest('[role="menu"]');
      if (confirmRequest || shortcutsOpen || settingsTab || inMenu) return;
      const key = event.key.toLowerCase();
      if (view === "start") {
        const command = event.ctrlKey && ({ n: newProject, o: () => action("load") } as Record<string, () => void>)[key];
        if (command) { event.preventDefault(); command(); }
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        const command = ({
          z: event.shiftKey ? redo : undo,
          y: redo,
          s: () => { if (!validation) void action(event.shiftKey ? "saveAs" : "save"); },
          o: () => void action("load"),
          n: () => void newProject(),
          e: () => { if (!validation) void action(event.shiftKey ? "exportVideo" : "export"); },
          ",": () => setSettingsTab("viewer"),
          d: () => { if (!editing(event.target)) duplicate(); },
          enter: () => { if (!validation) void action("render"); },
        } as Record<string, () => void>)[key];
        if (command) { event.preventDefault(); command(); }
        return;
      }
      if (key === "escape" && manimBusy) { event.preventDefault(); stopRender(); return; }
      if (editing(event.target) || event.defaultPrevented) return;
      if (key === "delete") { event.preventDefault(); remove(); }
      else if (key === " " && video && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); togglePlay(); }
      else if (key === "arrowleft" || key === "arrowright") {
        event.preventDefault();
        step((key === "arrowleft" ? -1 : 1) * (event.shiftKey ? 15 : 1));
      }
      else if (key === "home") { event.preventDefault(); scrub(0); }
      else if (key === "end") { event.preventDefault(); scrub(project.scene.durationMs); }
      else if (event.key === "?") { event.preventDefault(); setShortcutsOpen(true); }
      else if (event.key === "=" || event.key === "+") { event.preventDefault(); setZoom(zoom * 1.5); }
      else if (event.key === "-") { event.preventDefault(); setZoom(zoom / 1.5); }
      else if (event.key === "\\") { event.preventDefault(); setZoom(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
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
  const stale = !!video && rendered !== serialized;
  const percent = progress?.phase === "rendering" ? Math.round(progress.fraction * 100) : null;
  const previewState = rendering ? `Rendering… ${percent === null ? elapsed + " s" : percent + "%"}`
    : video ? (rendered === serialized ? "Up to date" : "Changes not rendered") : "Not rendered yet";
  const status = validation || (manimBusy
    ? `${rendering ? "Rendering" : "Exporting"} with Manim… ${percent === null ? "preparing" : percent + "%"} · ${elapsed} s · Esc cancels`
    : message) || "Ready to create.";
  const selectedBlock = selectedAnimation !== null ? project.scene.animations?.[selectedAnimation] : undefined;
  // File commands step back so Render leads the bar.
  const quiet = "text-muted-foreground hover:text-foreground";
  // The visible text can be shorter than the accessible name; the tooltip says it all.
  const toolbarButton = ({ name, text = name, tip = name, keys, icon, onClick, disabled = false }: {
    name: string; text?: string; tip?: string; keys: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean;
  }) => <Hint label={tip} keys={keys}>
    <Button variant="ghost" size="sm" className={quiet} aria-label={name} disabled={disabled} onClick={onClick}>{icon}<span className="label">{text}</span></Button>
  </Hint>;
  const themeToggle = <Hint label={theme === "dark" ? "Light mode" : "Dark mode"}>
    <Button variant="ghost" size="icon-sm" className={quiet} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  </Hint>;
  const windowControls = desktopAvailable() && <WindowControls />;
  const overlays = <>
    <ConfirmDialog request={confirmRequest} onAnswer={confirmed => { setConfirmRequest(null); answer.current(confirmed); }} />
    <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    <SettingsDialog open={settingsTab !== null} tab={settingsTab ?? "viewer"} onTab={setSettingsTab} onClose={() => setSettingsTab(null)}
      settings={settings} onSettings={updateSettings} theme={themePreference} onTheme={setThemePreference}
      background={project.scene.background} onBackground={setBackground} durationMs={project.scene.durationMs}
      exportDisabled={!!busy || !!validation} onExportVideo={() => { setSettingsTab(null); void action("exportVideo"); }} />
    {/* With session recovery on, unsaved work comes back after the restart; otherwise the update asks first. */}
    <UpdateBanner busy={manimBusy} beforeInstall={async () => settings.restoreSession || confirmDiscard()} />
    {splash && <Splash onDone={endSplash} />}
  </>;
  if (view === "start") return <>
    <StartScreen recents={recents} status={message || "Ready."} busy={!!busy}
      current={hasCurrent ? { project, filePath, dirty } : null}
      titleActions={<>{themeToggle}{windowControls}</>}
      onNew={newProject} onOpen={() => void action("load")} onContinue={() => setView("editor")}
      onOpenRecent={path => void action("openRecent", path)} onForget={forget} onExample={key => void openExample(key)} />
    {overlays}
  </>;
  return (<>
    <main className="workspace" style={{ gridTemplateRows: `44px minmax(220px, 1fr) ${timelineHeight}px 28px` }}>
      <header className="toolbar" data-tauri-drag-region="deep">
        <Hint label="All projects">
          <button className="brand" aria-label="All projects" onClick={showProjects}><Wordmark /></button>
        </Hint>
        <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />
        <Input className="project-name h-8 w-auto max-w-72 min-w-24 border-transparent bg-transparent px-2 font-medium shadow-none [field-sizing:content] hover:border-input dark:bg-transparent"
          aria-label="Project name" value={project.name} onChange={(e) => change({ ...project, name: e.target.value })} />
        <Hint label={filePath || "Not saved to a file yet"}>
          <Badge variant="outline" className={"save-state text-muted-foreground max-[980px]:hidden" + (dirty ? " dirty text-foreground" : "")}>
            {dirty && <span className="dot" />}{dirty ? "Unsaved" : filePath ? "Saved" : "New project"}
          </Badge>
        </Hint>
        <nav aria-label="File">
          {toolbarButton({ name: "Undo", keys: "Ctrl+Z", icon: <Undo2 />, onClick: undo, disabled: !past.length })}
          {toolbarButton({ name: "Redo", keys: "Ctrl+Y", icon: <Redo2 />, onClick: redo, disabled: !future.length })}
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />
          {/* A Windows-style File menu keeps the bar short enough to share its row with the window controls. */}
          <DropdownMenu>
            <Hint label="New, open and save projects">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={quiet} aria-label="File">
                  <FileIcon /><span className="label">File</span><ChevronDown className="size-3.5 opacity-60" /></Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuItem disabled={!!busy} onSelect={() => void newProject()}>
                <FilePlus2 />New project<DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem disabled={!!busy} onSelect={() => void action("load")}>
                <FolderOpen />Open…<DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem disabled={!!busy || !!validation} onSelect={() => void action("saveAs")}>
                <SaveAll />Save as…<DropdownMenuShortcut>Ctrl+Shift+S</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={showProjects}><LayoutGrid />All projects</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Hint label={filePath ? `Save to ${fileName(filePath)}` : "Save"} keys="Ctrl+S">
            <Button variant="ghost" size="sm" className={quiet} aria-label="Save project" disabled={!!busy || !!validation} onClick={() => action("save")}>
              <Save /><span className="label">Save</span></Button>
          </Hint>
          <DropdownMenu>
            <Hint label="Export a video or a Python script">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={quiet} aria-label="Export" disabled={!!busy || !!validation}>
                  <Download /><span className="label">Export</span><ChevronDown className="size-3.5 opacity-60" /></Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onSelect={() => void action("exportVideo")}>
                <Video /><span className="grid">Video…<span className="text-xs text-muted-foreground">{describeOutput(settings.output)}</span></span>
                <DropdownMenuShortcut>Ctrl+Shift+E</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void action("export")}>
                <FileCode2 />Python script…<DropdownMenuShortcut>Ctrl+E</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSettingsTab("export")}><Settings2 />Export settings…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />
          <Hint label="Settings" keys="Ctrl+,">
            <Button variant="ghost" size="icon-sm" className={quiet} aria-label="Settings" onClick={() => setSettingsTab("viewer")}>
              <SettingsIcon /></Button>
          </Hint>
          {themeToggle}
          {manimBusy
            ? <Hint label={rendering ? "Cancel the render" : "Cancel the export"} keys="Esc">
              <Button size="sm" className="ml-1.5 min-w-24 cursor-pointer font-semibold" onClick={stopRender}><Square fill="currentColor" className="size-3" />Cancel</Button>
            </Hint>
            : <Hint label="Render" keys="Ctrl+Enter">
              <Button size="sm" className="ml-1.5 min-w-24 cursor-pointer font-semibold" disabled={!!busy || !!validation} onClick={() => action("render")}>
                <Play fill="currentColor" className="size-3.5" />Render</Button>
            </Hint>}
        </nav>
        {windowControls}
      </header>

      <section className="upper">
        <aside className="panel pool" aria-label="Object pool">
          <div className="panel-heading"><h2>Objects</h2>
            <NativeSelect size="sm" aria-label="Open example" value="" disabled={!!busy} containerClassName="ml-auto"
              className="h-7 max-w-40 py-0 pr-8 pl-2.5 text-xs" onChange={event => void openExample(event.target.value)}>
              <NativeSelectOption value="">Examples…</NativeSelectOption>
              {examples.map(item => <NativeSelectOption key={item.key} value={item.key}>{item.label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <section className="library">
            <div className="search-field">
              <Search className="size-4" aria-hidden="true" />
              <Input type="search" aria-label="Search the library" placeholder="Search objects" className="h-8 pl-8"
                value={search} onChange={event => setSearch(event.target.value)} />
            </div>
            {elementGroups.map(group => ({ ...group, kinds: group.kinds.filter(kind =>
              elementLabels[kind].toLowerCase().includes(search.trim().toLowerCase())) }))
              .filter(group => group.kinds.length)
              .map(group => <div key={group.label} className="catalog-group">
              <h3>{group.label}</h3>
              <div className="catalog-grid">{group.kinds.map(kind => {
                const blocked = additionBlocked(project, kind);
                const tile = <button className="library-item" disabled={!!blocked} aria-label={"Add " + elementLabels[kind]}
                  onClick={() => add(kind)}>
                  <span className="thumb"><ElementIcon kind={kind} size={22} /></span><span className="name">{elementLabels[kind]}</span>
                </button>;
                // A disabled button takes no pointer events, so its reason hangs on a wrapper.
                return <Hint key={kind} label={blocked ?? `Add ${elementLabels[kind]} at the playhead`}>
                  {blocked ? <span className="grid">{tile}</span> : tile}
                </Hint>;
              })}</div>
            </div>)}
            {search.trim() && !elementGroups.some(group => group.kinds.some(kind =>
              elementLabels[kind].toLowerCase().includes(search.trim().toLowerCase()))) &&
              <p className="hint mt-3">No element matches “{search.trim()}”.</p>}
          </section>
        </aside>

        <section className="panel viewer" aria-label="Preview">
          <div className="panel-heading"><h2>Viewer</h2>
            <NativeSelect size="sm" aria-label="Preview quality" value={settings.preview.resolution} disabled={rendering}
              className="h-7 py-0 pr-8 pl-2.5 text-xs"
              onChange={event => updateSettings({ preview: { ...settings.preview, resolution: event.target.value as Resolution } })}>
              {PREVIEW_RESOLUTIONS.map(resolution =>
                <NativeSelectOption key={resolution} value={resolution}>{describeQuality({ ...settings.preview, resolution })}</NativeSelectOption>)}
            </NativeSelect>
            {video && previewQuality !== describeQuality(settings.preview) && <span className="muted">Last render {previewQuality}</span>}
            <Badge variant="outline" className={"preview-state" + (rendering ? " busy" : stale ? " stale" : "") + (rendering || stale ? "" : " text-muted-foreground")}>
              {(rendering || stale) && <span className="dot" />}{previewState}
            </Badge>
          </div>
          <div className="stage">
            {video ? (
              <video ref={videoRef} src={video} aria-label="Rendered video" onClick={togglePlay} loop={settings.loop}
                onLoadedMetadata={event => {
                  const player = event.currentTarget, atEnd = playheadMs >= project.scene.durationMs - FRAME_MS;
                  player.currentTime = playNext.current && atEnd ? 0 : playheadMs / 1000;
                  if (playNext.current) { playNext.current = false; void player.play(); }
                }}
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                onTimeUpdate={event => setPlayheadMs(Math.round(event.currentTarget.currentTime * 1000))} />
            ) : (
              <div className="empty-preview" style={stageStyle(project.scene.background)}>
                <span className="media"><Film className="size-5" strokeWidth={1.5} /></span>
                <h2>Your scene starts here</h2>
                <p>{rendering ? "Manim is rendering the scene. Keep editing; changes made now need another render."
                  : elementCount ? "Render (Ctrl+Enter) to preview the scene here, then scrub the result."
                  : "Add objects from the pool, place them in time, then Render."}</p>
              </div>
            )}
          </div>
          <div className="transport">
            <span className="timecode">{timecode(playheadMs)}</span>
            <div className="transport-keys">
              <Hint label="Start" keys="Home"><Button variant="ghost" size="icon-sm" aria-label="Go to start" onClick={() => scrub(0)}><SkipBack /></Button></Hint>
              <Hint label="Previous frame" keys="←"><Button variant="ghost" size="icon-sm" aria-label="Previous frame" onClick={() => step(-1)}><StepBack /></Button></Hint>
              <Hint label={playing ? "Pause" : "Play"} keys="Space">
                <Button variant="secondary" size="icon" className="mx-1 rounded-full" aria-label={playing ? "Pause" : "Play"} disabled={!video} onClick={togglePlay}>
                  {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="translate-x-px" />}</Button>
              </Hint>
              <Hint label="Next frame" keys="→"><Button variant="ghost" size="icon-sm" aria-label="Next frame" onClick={() => step(1)}><StepForward /></Button></Hint>
              <Hint label="End" keys="End"><Button variant="ghost" size="icon-sm" aria-label="Go to end" onClick={() => scrub(project.scene.durationMs)}><SkipForward /></Button></Hint>
            </div>
            <span className="timecode dim">DUR {timecode(project.scene.durationMs)}</span>
          </div>
        </section>

        <aside className="panel inspector-panel" aria-label="Inspector">
          <div className="panel-heading"><h2>Inspector</h2>{element && <span className="row-actions">
            <Hint label="Duplicate" keys="Ctrl+D">
              <Button variant="ghost" size="icon-sm" className="size-7" aria-label="Duplicate element" onClick={duplicate}><Copy /></Button>
            </Hint>
            <Hint label={selectedBlock ? "Remove the selected animation" : "Remove"} keys="Delete">
              <Button variant="ghost" size="icon-sm" className="size-7 hover:text-destructive" aria-label={selectedBlock ? "Remove animation" : "Remove element"}
                onClick={remove}><Trash2 /></Button>
            </Hint>
          </span>}</div>
          <section className="inspector">
            {element ? <>
              <p className="inspector-title"><ElementIcon kind={element.kind} size={15} />{elementLabels[element.kind]}</p>
              <ElementInspector project={project} element={element} onChange={next => change({ ...project, scene: { ...project.scene, elements: { ...project.scene.elements, [selection]: next } } })} />
              <AnimationInspector project={project} targetId={selection} onChange={change}
                focusIndex={selectedAnimation} onSelectAnimation={index => selectAnimation(index)} />
            </> : <p className="hint">Select an object in the timeline, or add one from the pool.</p>}
          </section>
        </aside>
      </section>

      <section className="panel timeline" aria-label="Timeline">
        <div className="timeline-resizer" role="separator" aria-label="Resize timeline"
          aria-orientation="horizontal" tabIndex={0} onPointerDown={resize}
          onKeyDown={event => {
            if (event.key === "ArrowUp") { event.preventDefault(); setTimelineHeight(h => Math.min(h + 24, window.innerHeight - 300)); }
            else if (event.key === "ArrowDown") { event.preventDefault(); setTimelineHeight(h => Math.max(160, h - 24)); }
          }} />
        <div className="timeline-heading">
          <span className="timecode hot">{timecode(playheadMs)}</span>
          <h2>Timeline <span>{elementCount} {elementCount === 1 ? "element" : "elements"}</span></h2>
          <ButtonGroup className="zoom-controls" aria-label="Timeline zoom">
            <Hint label="Zoom out" keys="−">
              <Button variant="outline" size="icon-sm" className="size-7" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(zoom / 1.5)}><ZoomOut /></Button>
            </Hint>
            <Hint label="Fit the whole scene" keys="\">
              <Button variant="outline" size="sm" className="zoom-level h-7 px-2" aria-label="Fit the scene" disabled={zoom <= 1} onClick={() => setZoom(1)}>
                {zoom <= 1 ? "Fit" : zoom.toFixed(1) + "×"}</Button>
            </Hint>
            <Hint label="Zoom in · Ctrl+wheel zooms at the pointer" keys="=">
              <Button variant="outline" size="icon-sm" className="size-7" aria-label="Zoom in" disabled={zoom >= maxZoom} onClick={() => setZoom(zoom * 1.5)}><ZoomIn /></Button>
            </Hint>
          </ButtonGroup>
          <div className="history">
            <SecondsField label="Scene duration" min={100} value={project.scene.durationMs} inputClassName="h-7 w-20"
              onChange={durationMs => change({ ...project, scene: { ...project.scene, durationMs } })} />
          </div>
        </div>
        <Timeline project={project} selection={selection} onSelect={selectElement} onChange={change}
          selectedAnimation={selectedAnimation}
          onSelectAnimation={(index, target) => selectAnimation(index, target)}
          onError={setMessage} playheadMs={playheadMs} onScrub={scrub} zoom={zoom} onZoom={setZoom} snapping={settings.snapping} />
      </section>

      <footer className="statusbar">
        <p className={validation ? "status error" : "status"} role="status">{status}</p>
        {manimBusy && percent !== null && <Progress value={percent} className="h-1.5 w-32" aria-label="Render progress" />}
        <span>Local rendering · Manim CE</span>
        <Hint label="Keyboard shortcuts" keys="?" side="top">
          <Button variant="ghost" size="icon-xs" aria-label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}><Keyboard /></Button>
        </Hint>
      </footer>
    </main>
    {overlays}
  </>);
}
