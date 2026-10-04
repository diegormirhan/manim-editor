import { useEffect, useState } from "react";
import type { Project } from "../domain/project";
import { forgetProject, readRecentProjects, rememberProject } from "../domain/recent-projects";

const KEY = "manim-editor-recent";

const storedRecents = () => {
  try { return readRecentProjects(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return []; }
};

/** The project files opened or saved on this computer, newest first. */
export function useRecentProjects() {
  const [recents, setRecents] = useState(storedRecents);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(recents)); } catch { /* storage blocked: the list lasts for this session */ }
  }, [recents]);
  return {
    recents,
    remember: (project: Project, path: string) => setRecents(current => rememberProject(current, project, path, Date.now())),
    forget: (path: string) => setRecents(current => forgetProject(current, path)),
  };
}
