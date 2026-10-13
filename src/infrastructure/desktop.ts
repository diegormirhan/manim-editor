import { invoke, convertFileSrc, isTauri } from "@tauri-apps/api/core";
import type { Box } from "../domain/placement";
import type { Project } from "../domain/project";
import type { renderOptions } from "../domain/render-settings";
export const desktopAvailable = isTauri;
export type Operation = "save" | "saveAs" | "load" | "openRecent" | "export" | "exportVideo" | "render";
type RenderOptions = ReturnType<typeof renderOptions>;
export type RenderProgress = { event: "progress"; phase: "preparing" | "rendering"; fraction: number };
/** `path` is the document's own file, or the recent file to reopen; the desktop side only writes files the user chose. */
export async function projectAction(operation: Operation, project: Project, path?: string, options?: RenderOptions) {
  return invoke<{ path?: string; project?: Project; cancelled?: boolean }>(
    "project_action",
    { operation, project, path: path || null, options: options ?? null },
  );
}
export const cancelRender = () => invoke<boolean>("cancel_render");
export const renderProgress = () => invoke<RenderProgress | null>("render_progress");
/** Manim's frame of the project at `timeMs` from the live preview worker: a base64 PNG and the box of each element on screen. */
export const liveFrame = (project: Project, timeMs: number) =>
  invoke<{ frame: string; boxes: Record<string, Box> }>("live_frame", { project, timeMs: Math.round(timeMs) });
export const previewUrl = convertFileSrc;
