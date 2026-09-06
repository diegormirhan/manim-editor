import { invoke, convertFileSrc, isTauri } from "@tauri-apps/api/core";
import type { Project } from "../domain/project";
export const desktopAvailable = isTauri;
export async function projectAction(
  operation: "save" | "load" | "export" | "render",
  project: Project,
) {
  return invoke<{ path?: string; project?: Project; cancelled?: boolean }>(
    "project_action",
    { operation, project },
  );
}
export const previewUrl = convertFileSrc;
