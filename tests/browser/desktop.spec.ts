import { test, expect, type Page } from "@playwright/test";
import { desktopCalls, fileCommand, mockDesktop, openEditor } from "./desktop-mock";
import officialDemo from "../../examples/official-demo.json" with { type: "json" };

const renderButton = (page: Page) => page.getByRole("button", { name: "Render", exact: true });
const status = (page: Page) => page.getByRole("status");
const previewState = (page: Page) => page.locator(".preview-state");

test("a render reports its elapsed time and Esc cancels it without inventing a preview", async ({ page }) => {
  await mockDesktop(page, { renderMs: 60_000 });
  await openEditor(page);
  await renderButton(page).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await expect(status(page)).toContainText("Rendering with Manim…");
  await expect(previewState(page)).toContainText("Rendering…");
  // The render belongs to this document, so switching documents waits for it.
  await expect(page.getByLabel("Open example")).toBeDisabled();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "New project" })).toHaveAttribute("aria-disabled", "true");
  // Esc closes the menu and leaves the render running.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(status(page)).toContainText("Rendering with Manim…");
  // Editing stays possible while Manim works.
  await page.getByLabel("LaTeX expression").fill("e^{i\\pi} + 1 = 0");
  await page.keyboard.press("Escape");
  await expect(status(page)).toContainText("Render cancelled");
  await expect(renderButton(page)).toBeEnabled();
  await expect(page.locator("video")).toHaveCount(0);
  expect((await desktopCalls(page)).map(call => call.cmd)).toEqual(["project_action", "cancel_render"]);
});

test("a finished render plays, the playhead follows it, and edits mark it stale", async ({ page }) => {
  await mockDesktop(page);
  await openEditor(page);
  await renderButton(page).click();
  await expect(status(page)).toContainText("Preview updated.");
  await expect(previewState(page)).toHaveText("Up to date");
  const video = page.getByLabel("Rendered video");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThan(0);

  const playhead = page.getByRole("slider", { name: "Playhead" });
  const ruler = (await playhead.boundingBox())!;
  await page.mouse.click(ruler.x + ruler.width / 2, ruler.y + ruler.height / 2);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeCloseTo(1.5, 1);

  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(async () => Number(await playhead.getAttribute("aria-valuenow")), { timeout: 5000 }).toBeGreaterThan(1.7);
  await page.getByRole("button", { name: "Pause" }).click();

  await page.getByLabel("LaTeX expression").fill("x^3");
  await expect(previewState(page)).toHaveText("Changes not rendered");
});

test("a failed render says why and keeps the editor usable", async ({ page }) => {
  await mockDesktop(page, { renderError: "LaTeX error: Missing } inserted. Check the equation's LaTeX. Full log: C:\\renders\\render.log" });
  await openEditor(page);
  await renderButton(page).click();
  await expect(status(page)).toContainText("Render failed. LaTeX error: Missing } inserted.");
  await expect(renderButton(page)).toBeEnabled();
});

test("save asks for a file once, then saves in place; save as picks a new file", async ({ page }) => {
  await mockDesktop(page);
  await openEditor(page);
  await expect(page.locator(".save-state")).toHaveText("New project");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(status(page)).toContainText("Saved first.json.");
  await expect(page.locator(".save-state")).toHaveText("Saved");

  await page.getByLabel("Project name").fill("Pythagoras");
  await expect(page.locator(".save-state")).toHaveText("Unsaved");
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-state")).toHaveText("Saved");

  await fileCommand(page, "Save as…");
  await expect(status(page)).toContainText("Saved copy.json.");
  await page.getByRole("button", { name: "Save project" }).click();
  const saves = (await desktopCalls(page)).map(call => [call.args.operation, call.args.path ?? null]);
  expect(saves).toEqual([
    ["save", null],
    ["save", "C:\\Projects\\first.json"],
    ["saveAs", "C:\\Projects\\first.json"],
    ["save", "C:\\Projects\\copy.json"],
  ]);
});

test("opening a project over unsaved changes asks first and starts a fresh history", async ({ page }) => {
  await mockDesktop(page, { openProject: officialDemo });
  await openEditor(page);
  await page.getByLabel("LaTeX expression").fill("x^2");
  await fileCommand(page, "Open…");
  const dialog = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect(await desktopCalls(page)).toHaveLength(0);

  await fileCommand(page, "Open…");
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(status(page)).toContainText("Opened opened.json.");
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("5 elements");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(page.locator(".save-state")).toHaveText("Saved");
});

test("export writes Python and leaves the document's save state alone", async ({ page }) => {
  await mockDesktop(page);
  await openEditor(page);
  await page.locator(".empty-preview").click();
  await page.keyboard.press("Control+e");
  await expect(status(page)).toContainText("Exported scene.py.");
  await expect(page.locator(".save-state")).toHaveText("New project");
});
