import { isProject, type Project } from "./project";

/** A project file the user opened or saved, with the content it had then, for its thumbnail. */
export type RecentProject = { path: string; openedAt: number; project: Project };

export const MAX_RECENT_PROJECTS = 8;
// Windows paths ignore case.
const samePath = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

export const forgetProject = (recents: RecentProject[], path: string) =>
  recents.filter(entry => !samePath(entry.path, path));

export const rememberProject = (recents: RecentProject[], project: Project, path: string, openedAt: number) =>
  [{ path, openedAt, project }, ...forgetProject(recents, path)].slice(0, MAX_RECENT_PROJECTS);

const isRecentProject = (value: unknown): value is RecentProject => {
  const entry = value as RecentProject | null;
  return typeof entry?.path === "string" && Number.isFinite(entry.openedAt) && isProject(entry.project);
};

export const readRecentProjects = (stored: unknown): RecentProject[] =>
  Array.isArray(stored) ? stored.filter(isRecentProject).slice(0, MAX_RECENT_PROJECTS) : [];
