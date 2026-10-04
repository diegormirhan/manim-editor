import { test, expect, type Page } from "@playwright/test";
import { desktopCalls, mockDesktop, openEditor } from "./desktop-mock";

const status = (page: Page) => page.getByRole("status");
const settings = (page: Page) => page.getByRole("dialog", { name: "Settings" });
const choice = (page: Page, group: string, option: string) =>
  settings(page).getByRole("radiogroup", { name: group }).getByRole("radio", { name: option, exact: true });
const lastAction = async (page: Page) => (await desktopCalls(page)).filter(call => call.cmd === "project_action").at(-1)!.args;

async function openSettings(page: Page) {
  await page.locator(".empty-preview").click();
  await page.keyboard.press("Control+,");
  await expect(settings(page)).toBeVisible();
}

test("the viewer quality chosen in settings is the quality the preview renders at", async ({ page }) => {
  await mockDesktop(page);
  await openEditor(page);
  await openSettings(page);
  await choice(page, "Preview quality", "720p").click();
  await choice(page, "Preview frame rate", "30 fps").click();
  await expect(choice(page, "Preview quality", "720p")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  const viewerQuality = page.getByRole("combobox", { name: "Preview quality" });
  await expect(viewerQuality).toHaveValue("720p");
  await expect(viewerQuality.locator("option:checked")).toHaveText("720p · 30 fps");
  await page.getByRole("button", { name: "Render", exact: true }).click();
  await expect(status(page)).toContainText("Preview updated.");
  expect((await lastAction(page)).options).toEqual({ resolution: "720p", fps: 30, format: "mp4", transparent: false });
});

test("the viewer's own selector changes the same setting", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("combobox", { name: "Preview quality" }).selectOption("1080p");
  await openSettings(page);
  await expect(choice(page, "Preview quality", "1080p")).toHaveAttribute("aria-checked", "true");
});

test("a video export follows the export settings, and transparency follows the format", async ({ page }) => {
  await mockDesktop(page);
  await openEditor(page);
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem", { name: "Export settings…" }).click();
  await expect(settings(page).getByRole("tab", { name: "Export" })).toHaveAttribute("aria-selected", "true");

  const transparent = settings(page).getByRole("switch", { name: "Transparent background" });
  await choice(page, "Quality", "4K").click();
  await choice(page, "Frame rate", "60 fps").click();
  await expect(transparent).toBeDisabled();
  await choice(page, "Format", "MOV").click();
  await transparent.click();
  await expect(transparent).toHaveAttribute("aria-checked", "true");
  await expect(settings(page)).toContainText("3840 × 2160");
  await expect(settings(page)).toContainText("with alpha");
  // The default scene runs 3 s on the 15 fps grid: 45 frames, four times over at 60 fps.
  await expect(settings(page)).toContainText("180 frames");

  await settings(page).getByRole("button", { name: "Export video…" }).click();
  await expect(status(page)).toContainText("Exported scene.mov · 2160p · 60 fps · MOV · transparent.");
  expect((await lastAction(page))).toMatchObject({ operation: "exportVideo", options: { resolution: "2160p", fps: 60, format: "mov", transparent: true } });

  // GIF has no alpha channel, so choosing it switches transparency off.
  await page.keyboard.press("Control+,");
  await settings(page).getByRole("tab", { name: "Export" }).click();
  await choice(page, "Format", "GIF").click();
  await expect(transparent).toHaveAttribute("aria-checked", "false");
  await expect(transparent).toBeDisabled();
});

test("the export menu names what it will write", async ({ page }) => {
  await mockDesktop(page);
  await openEditor(page);
  await page.getByRole("button", { name: "Export" }).click();
  const video = page.getByRole("menuitem", { name: /Video…/ });
  await expect(video).toContainText("1080p · 60 fps · MP4");
  await page.getByRole("menuitem", { name: /Python script…/ }).click();
  await expect(status(page)).toContainText("Exported scene.py.");
  expect((await lastAction(page)).options).toMatchObject({ fps: 60 });
});

test("an export reports its progress and Esc cancels it without writing a file", async ({ page }) => {
  await mockDesktop(page, { renderMs: 60_000 });
  await openEditor(page);
  await page.locator(".empty-preview").click();
  await page.keyboard.press("Control+Shift+E");
  await expect(status(page)).toContainText("Exporting with Manim…");
  await expect(status(page)).toContainText("%");
  await expect(page.getByRole("progressbar", { name: "Render progress" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(status(page)).toContainText("Export cancelled. No video was written.");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});

test("the scene background belongs to the project and undoes like any edit", async ({ page }) => {
  await openEditor(page);
  await openSettings(page);
  await settings(page).getByRole("tab", { name: "Scene" }).click();
  await settings(page).getByLabel("Background colour").locator("input").fill("#ffffff");
  await expect(settings(page)).toContainText("#FFFFFF");
  await page.keyboard.press("Escape");
  await expect(page.locator(".empty-preview")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".save-state")).toHaveText("Unsaved");
  await page.keyboard.press("Control+z");
  await expect(page.locator(".empty-preview")).toHaveCSS("background-color", "rgb(0, 0, 0)");
});

test("settings survive a reload, and the defaults are one click away", async ({ page }) => {
  await openEditor(page);
  await openSettings(page);
  const loop = settings(page).getByRole("switch", { name: "Loop playback" });
  await loop.click();
  await page.reload();
  await page.getByRole("button", { name: "Continue First equation" }).click();
  await openSettings(page);
  await expect(loop).toHaveAttribute("aria-checked", "true");
  await settings(page).getByRole("tab", { name: "Editor" }).click();
  await settings(page).getByRole("button", { name: "Restore default settings" }).click();
  await settings(page).getByRole("tab", { name: "Viewer" }).click();
  await expect(loop).toHaveAttribute("aria-checked", "false");
});

test("snapping can be turned off, and Alt brings it back for one drag", async ({ page }) => {
  await openEditor(page);
  await openSettings(page);
  await settings(page).getByRole("tab", { name: "Editor" }).click();
  await settings(page).getByRole("switch", { name: "Snap clips" }).click();
  await page.keyboard.press("Escape");

  const playhead = page.getByRole("slider", { name: "Playhead" });
  const ruler = (await playhead.boundingBox())!;
  await page.mouse.click(ruler.x + ruler.width * 1430 / 3000, ruler.y + ruler.height / 2);
  const at = Number(await playhead.getAttribute("aria-valuenow"));
  const clip = page.locator(".editable-clip").first();
  const box = (await clip.boundingBox())!;
  const lane = (await page.locator(".clip-lane").first().boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 40 + lane.width * at / 3 + 3, y, { steps: 8 });
  await expect(page.locator(".timeline-help")).not.toContainText("Snapped");
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + 40 + lane.width * at / 3 + 2, y, { steps: 2 });
  await expect(page.locator(".timeline-help")).toContainText("Snapped to playhead");
  await page.keyboard.up("Alt");
  await page.keyboard.press("Escape");
  await page.mouse.up();
});

test("unsaved work is forgotten on reload when restoring is turned off", async ({ page }) => {
  await openEditor(page);
  await openSettings(page);
  await settings(page).getByRole("tab", { name: "Editor" }).click();
  await settings(page).getByRole("switch", { name: "Restore unsaved work" }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("LaTeX expression").fill("x^3");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Open example First equation" }).click();
  await expect(page.getByLabel("LaTeX expression")).toHaveValue("a^2 + b^2 = c^2");
});

test("the theme follows the system until the user picks one, and Settings can hand it back", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Open example First equation" }).click();
  await openSettings(page);
  await settings(page).getByRole("tab", { name: "Editor" }).click();
  await choice(page, "Theme", "System").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
