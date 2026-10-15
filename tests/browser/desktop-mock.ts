import type { Page } from "@playwright/test";

export type DesktopCall = { cmd: string; args: { operation?: string; path?: string | null; options?: Record<string, unknown> | null } };
export type UpdateOffer = { version: string; currentVersion: string; body?: string; size: number };

/**
 * Stands in for the Tauri runtime in the browser: it answers each command the way the
 * desktop side does and records every call. The rendered preview is a real bundled MP4.
 * Window and updater plugin calls are answered too, so the title bar and the update
 * banner behave as they do in the app.
 */
/**
 * `live` answers live preview requests with a tiny PNG and a box of ±0.5 units around each element's
 * position, and fails any whose project contains `failOn`.
 */
export type LiveOptions = { failOn?: string };

export async function mockDesktop(page: Page, options: { renderMs?: number; renderError?: string; openProject?: unknown; update?: UpdateOffer; live?: LiveOptions } = {}) {
  await page.addInitScript(({ renderMs, renderError, openProject, update, live }) => {
    const calls: unknown[] = [];
    let stopRender: (() => void) | null = null;
    let renderStarted = 0;
    let callbacks = 0;
    Object.assign(window, { __desktopCalls: calls, isTauri: true });
    Object.assign(window, { __TAURI_INTERNALS__: {
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
      transformCallback: () => ++callbacks,
      convertFileSrc: (path: string) => path,
      invoke: async (cmd: string, args: { operation?: string; path?: string | null; options?: { format?: string } | null;
        onEvent?: { onmessage: (event: unknown) => void } }) => {
        calls.push({ cmd, args: JSON.parse(JSON.stringify(args ?? {})) });
        if (cmd === "plugin:updater|check") return update ? { rid: 7, date: null, rawJson: {}, ...update } : null;
        // The real installer closes the app; here the download reports its chunks and then hangs.
        if (cmd === "plugin:updater|download_and_install") {
          args.onEvent!.onmessage({ event: "Started", data: { contentLength: update!.size } });
          args.onEvent!.onmessage({ event: "Progress", data: { chunkLength: update!.size / 4 } });
          return new Promise(() => {});
        }
        if (cmd === "plugin:window|is_maximized") return false;
        if (cmd === "launch_file") return null;
        // Without `live`, the worker never answers, as if Manim were still loading.
        if (cmd === "live_frame") {
          if (!live) return new Promise(() => {});
          const { elements } = (args as unknown as { project: { scene: { elements: Record<string, { position: number[] }> } } }).project.scene;
          await new Promise(resolve => setTimeout(resolve, 40));
          if (live.failOn && JSON.stringify(args).includes(live.failOn)) throw "LaTeX error: Missing } inserted. Check the equation's LaTeX.";
          return { frame: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            boxes: Object.fromEntries(Object.entries(elements).map(([id, { position: [x, y] }]) => [id, [x - 0.5, y - 0.5, x + 0.5, y + 0.5]])) };
        }
        if (cmd.startsWith("plugin:")) return null;
        if (cmd === "cancel_render") { stopRender?.(); return true; }
        // Progress climbs with the clock, like Manim finishing segments.
        if (cmd === "render_progress") {
          return renderStarted ? { event: "progress", phase: "rendering", fraction: Math.min(0.9, (Date.now() - renderStarted) / 2000) } : null;
        }
        switch (args.operation) {
          case "render":
          case "exportVideo": {
            if (renderError) throw renderError;
            renderStarted = Date.now();
            const cancelled = await new Promise<boolean>(resolve => {
              stopRender = () => resolve(true);
              setTimeout(() => resolve(false), renderMs);
            });
            stopRender = null;
            renderStarted = 0;
            if (cancelled) return { cancelled: true };
            return args.operation === "render" ? { path: "/docs/media/shape-motion.mp4" } : { path: "C:\\Videos\\scene." + args.options?.format };
          }
          case "load": return { project: openProject, path: "C:\\Projects\\opened.json" };
          case "openRecent":
            if (args.path!.includes("missing")) throw "The project file was moved, renamed or deleted.";
            return { project: openProject, path: args.path };
          case "save": return { path: args.path ?? "C:\\Projects\\first.json" };
          case "saveAs": return { path: "C:\\Projects\\copy.json" };
          case "export": return { path: "C:\\Projects\\scene.py" };
        }
        throw "Unknown operation.";
      },
    } });
  }, { renderMs: options.renderMs ?? 300, renderError: options.renderError ?? "", openProject: options.openProject ?? null,
    update: options.update ?? null, live: options.live ?? null });
}

/** The project commands the page sent, without the progress polling and the window and updater plugins. */
export const desktopCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __desktopCalls: DesktopCall[] }).__desktopCalls
    .filter(call => !["render_progress", "live_frame", "launch_file"].includes(call.cmd) && !call.cmd.startsWith("plugin:")));

/** The live preview requests the page sent: the playhead time and the project's name. */
export const liveFrameCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __desktopCalls: { cmd: string; args: { timeMs: number; project: { name: string } } }[] }).__desktopCalls
    .filter(call => call.cmd === "live_frame").map(call => ({ timeMs: call.args.timeMs, name: call.args.project.name })));

/** Every call to a Tauri plugin, such as the window controls and the updater. */
export const pluginCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __desktopCalls: DesktopCall[] }).__desktopCalls
    .map(call => call.cmd).filter(cmd => cmd.startsWith("plugin:") && !cmd.startsWith("plugin:event|")));

/** Starts the app and leaves the projects screen for the editor with a bundled example. */
export async function openEditor(page: Page, example = "First equation") {
  await page.goto("/");
  await page.getByRole("button", { name: `Open example ${example}` }).click();
  await page.locator(".workspace").waitFor();
}

/** Runs a command from the editor's File menu. */
export async function fileCommand(page: Page, name: "New project" | "Open…" | "Save as…" | "All projects") {
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name }).click();
}
