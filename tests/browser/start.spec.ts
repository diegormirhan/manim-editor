import { test, expect, type Page } from "@playwright/test";
import { desktopCalls, fileCommand, mockDesktop, pluginCalls } from "./desktop-mock";
import officialDemo from "../../examples/official-demo.json" with { type: "json" };

const status = (page: Page) => page.getByRole("status");
const projects = (page: Page) => page.getByRole("heading", { name: "Projects" });
const update = { version: "2.1.0", currentVersion: "2.0.0", body: "## Projects screen and signed updates\n- Details", size: 400e6 };

test("the app opens on the projects screen after its launch animation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".splash")).toHaveCount(1);
  await expect(page.locator(".splash")).toHaveCount(0);
  await expect(projects(page)).toBeVisible();
  await expect(page.getByText("Projects you open or save appear here.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open example/ })).toHaveCount(4);
  await expect(page.locator(".workspace")).toHaveCount(0);
});

test("a key skips the launch animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.locator(".splash").waitFor();
  await page.keyboard.press("Space");
  await expect(page.locator(".splash")).toHaveCount(0, { timeout: 600 });
});

test("an example opens in the editor, and the logo returns to the projects with it first", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open example Area under the curve" }).click();
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("5 elements");
  await page.getByLabel("Add Circle").click();
  await page.getByRole("button", { name: "All projects" }).click();
  const current = page.getByRole("button", { name: "Continue Area under a curve" });
  await expect(current).toContainText("Unsaved changes");
  await current.click();
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("6 elements");
});

test("opening another project from the projects screen asks before unsaved work is lost", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open example First equation" }).click();
  await page.getByLabel("LaTeX expression").fill("x^3");
  await fileCommand(page, "All projects");
  await page.getByRole("button", { name: "Open example Shapes and motion" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(projects(page)).toBeVisible();
  await page.getByRole("button", { name: "New project" }).click();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("0 elements");
});

test("files opened or saved become recent projects that reopen without a dialog", async ({ page }) => {
  await mockDesktop(page, { openProject: officialDemo });
  await page.goto("/");
  await page.getByRole("button", { name: "Open…" }).click();
  await expect(status(page)).toContainText("Opened opened.json.");
  await page.getByRole("button", { name: "Save project" }).click();
  await fileCommand(page, "Save as…");
  await page.getByRole("button", { name: "All projects" }).click();

  // The open document leads; the file it was saved from is listed once, under it.
  await expect(page.getByRole("button", { name: `Continue ${officialDemo.name}` })).toContainText("copy.json");
  const recent = page.getByRole("button", { name: `Open ${officialDemo.name}` });
  await expect(recent).toHaveCount(1);
  await expect(recent).toContainText("opened.json");
  await recent.click();
  await expect(status(page)).toContainText("Opened opened.json.");
  const opens = (await desktopCalls(page)).filter(call => ["load", "openRecent"].includes(call.args.operation!));
  expect(opens.map(call => [call.args.operation, call.args.path ?? null])).toEqual([["load", null], ["openRecent", "C:\\Projects\\opened.json"]]);

  await page.reload();
  await page.getByRole("button", { name: `Remove ${officialDemo.name} from recent projects` }).click();
  await expect(page.getByRole("button", { name: `Open ${officialDemo.name}` })).toHaveCount(0);
});

test("a recent file that moved says so and can be removed from the list", async ({ page }) => {
  await page.addInitScript(project => localStorage.setItem("manim-editor-recent",
    JSON.stringify([{ path: "D:\\Old\\missing.json", openedAt: Date.now() - 864e5, project }])), officialDemo);
  await mockDesktop(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: `Open ${officialDemo.name}` })).toContainText("Opened yesterday");
  await page.getByRole("button", { name: `Open ${officialDemo.name}` }).click();
  await expect(status(page)).toHaveText("Couldn't open missing.json. The project file was moved, renamed or deleted.");
  await expect(projects(page)).toBeVisible();
  await page.getByRole("button", { name: `Remove ${officialDemo.name} from recent projects` }).click();
  await expect(page.getByText("Projects you open or save appear here.")).toBeVisible();
});

test("the title bar drags the window and its buttons minimize, maximize and close it", async ({ page }) => {
  await mockDesktop(page);
  await page.goto("/");
  await expect(page.locator(".projects-screen .toolbar")).toHaveAttribute("data-tauri-drag-region", "deep");
  await page.getByRole("button", { name: "Minimize" }).click();
  await page.getByRole("button", { name: "Maximize" }).click();
  await page.getByRole("button", { name: "Open example First equation" }).click();
  await expect(page.locator(".workspace .toolbar")).toHaveAttribute("data-tauri-drag-region", "deep");
  await page.getByRole("button", { name: "Close" }).click();
  expect((await pluginCalls(page)).filter(cmd => cmd.startsWith("plugin:window|") && !cmd.endsWith("is_maximized")))
    .toEqual(["plugin:window|minimize", "plugin:window|toggle_maximize", "plugin:window|close"]);
});

test("the browser build has no window controls of its own", async ({ page }) => {
  await page.goto("/");
  await expect(projects(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Minimize" })).toHaveCount(0);
});

test("a newer release drops in from the top, downloads with progress, and Later puts it away", async ({ page }) => {
  await mockDesktop(page, { update });
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Update" });
  await expect(banner).toContainText("manim-editor 2.1.0 is available");
  await expect(banner).toContainText("You have 2.0.0. Projects screen and signed updates");
  await banner.getByRole("button", { name: "Later" }).click();
  await expect(banner).toHaveCount(0);

  await page.reload();
  await banner.getByRole("button", { name: "Update and restart" }).click();
  await expect(banner).toContainText("Downloading… 25% · 100 MB of 400 MB");
  await expect(banner.getByRole("progressbar", { name: "Update download" })).toBeVisible();
  expect(await pluginCalls(page)).toContain("plugin:updater|download_and_install");
});

test("installing an update over unsaved work asks first when sessions are not restored", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("manim-editor-settings", JSON.stringify({ restoreSession: false })));
  await mockDesktop(page, { update });
  await page.goto("/");
  await page.getByRole("button", { name: "Open example First equation" }).click();
  await page.getByLabel("LaTeX expression").fill("x^3");
  await page.getByRole("button", { name: "Update and restart" }).click();
  await page.getByRole("alertdialog", { name: "Discard unsaved changes?" }).getByRole("button", { name: "Cancel" }).click();
  expect(await pluginCalls(page)).not.toContain("plugin:updater|download_and_install");
});

test("no update, no banner", async ({ page }) => {
  await mockDesktop(page);
  await page.goto("/");
  await expect.poll(() => pluginCalls(page)).toContain("plugin:updater|check");
  await expect(page.getByRole("region", { name: "Update" })).toHaveCount(0);
});
