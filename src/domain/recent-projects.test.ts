import { describe, expect, it } from "vitest";
import { emptyProject, initialProject } from "./project";
import { forgetProject, readRecentProjects, rememberProject, MAX_RECENT_PROJECTS } from "./recent-projects";

const named = (name: string) => ({ ...emptyProject(), name });

describe("recent projects", () => {
  it("puts the latest project first and keeps one entry per file, whatever the path's case", () => {
    const first = rememberProject([], named("Draft"), "C:\\Projects\\draft.json", 1);
    const second = rememberProject(first, named("Other"), "C:\\Projects\\other.json", 2);
    const reopened = rememberProject(second, named("Draft v2"), "c:\\projects\\DRAFT.json", 3);
    expect(reopened.map(entry => [entry.project.name, entry.openedAt])).toEqual([["Draft v2", 3], ["Other", 2]]);
  });

  it("keeps only the most recent projects", () => {
    let recents = rememberProject([], named("0"), "C:\\p0.json", 0);
    for (let index = 1; index <= MAX_RECENT_PROJECTS; index++) recents = rememberProject(recents, named(String(index)), `C:\\p${index}.json`, index);
    expect(recents).toHaveLength(MAX_RECENT_PROJECTS);
    expect(recents.at(-1)!.project.name).toBe("1");
  });

  it("forgets a file on request", () => {
    const recents = rememberProject(rememberProject([], named("A"), "C:\\a.json", 1), named("B"), "C:\\b.json", 2);
    expect(forgetProject(recents, "C:\\A.json").map(entry => entry.path)).toEqual(["C:\\b.json"]);
  });

  it("reads stored entries and drops anything that is not a valid project", () => {
    const valid = { path: "C:\\equation.json", openedAt: 5, project: initialProject() };
    const stored = [valid, { path: "C:\\broken.json", openedAt: 4, project: { name: "No scene" } }, "junk", { openedAt: 3, project: initialProject() }];
    expect(readRecentProjects(stored)).toEqual([valid]);
    expect(readRecentProjects("not a list")).toEqual([]);
  });
});
