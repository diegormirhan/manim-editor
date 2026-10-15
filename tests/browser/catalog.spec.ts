import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./desktop-mock";

const playButton = (page: Page) => page.getByRole("button", { name: "Play", exact: true });

test("adds each new library element and keeps the project renderable", async ({ page }) => {
  await openEditor(page);
  const labels = ["LaTeX text", "Number", "Bullet list", "Matrix", "Code", "Ellipse", "Rounded rectangle", "Polygon", "Star",
    "Ring", "Arc", "Sector", "Dashed line", "Double arrow", "Brace", "Highlight box", "Number line", "Number plane", "Bar chart"];
  for (const label of labels) {
    await page.getByLabel(`Add ${label}`, { exact: true }).click();
    await expect(playButton(page), label).toBeEnabled();
  }
  await expect(page.getByRole("status")).toHaveText("Bar chart added at 0 s.");
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText(`${labels.length + 1} elements`);
});

test("the library groups its kinds and keeps derived kinds behind their source", async ({ page }) => {
  await openEditor(page);
  for (const group of ["Text", "Shapes", "Lines", "Annotations", "Coordinates", "Graphs"])
    await expect(page.getByRole("heading", { name: group, exact: true })).toBeVisible();

  const area = page.getByLabel("Add Area under graph");
  await expect(area).toBeDisabled();
  await page.getByLabel("Add Axes").click();
  await page.getByLabel("Add Graph").click();
  await expect(area).toBeDisabled();
  await page.getByLabel("Coordinate system").selectOption({ index: 1 });
  await expect(area).toBeEnabled();
  await area.click();
  await expect(page.getByRole("button", { name: "Select area under graph 4" })).toBeVisible();
  await expect(playButton(page)).toBeEnabled();
});

test("rotation and opacity are editable on any element", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Polygon").click();
  await page.getByLabel("Number of sides").fill("8");
  await page.getByLabel("Rotation (degrees)").fill("45");
  await page.getByLabel("Opacity").fill("0.5");
  await expect(page.getByLabel("Select polygon 2")).toHaveText("8 sides");
  await expect(playButton(page)).toBeEnabled();
  await page.getByLabel("Opacity").fill("3");
  await expect(playButton(page)).toBeDisabled();
});

test("every bundled example opens and stays renderable", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await openEditor(page);
  for (const label of ["Parabola · transformation demo", "Area under the curve", "Shapes and motion"]) {
    await page.getByLabel("Open example").selectOption({ label });
    await expect(page.getByRole("status"), label).toContainText("opened.");
    await expect(playButton(page), label).toBeEnabled();
  }
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("5 elements");
});
