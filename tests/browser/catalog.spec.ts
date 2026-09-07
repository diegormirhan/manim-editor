import { test, expect, type Page } from "@playwright/test";

const renderButton = (page: Page) => page.getByRole("button", { name: "Render", exact: true });

test("adds each new library element and keeps the project renderable", async ({ page }) => {
  await page.goto("/");
  for (const label of ["Ellipse", "Polygon", "Arc", "Number line", "Number plane"]) {
    await page.getByLabel(`Add ${label}`).click();
    await expect(renderButton(page), label).toBeEnabled();
  }
  await expect(page.getByRole("status")).toContainText("Ready to create.");
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("6 elements");
});

test("the library groups its kinds and keeps derived kinds behind their source", async ({ page }) => {
  await page.goto("/");
  for (const group of ["Text", "Shapes", "Coordinates", "Graphs"])
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
  await expect(renderButton(page)).toBeEnabled();
});

test("rotation and opacity are editable on any element", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Add Polygon").click();
  await page.getByLabel("Number of sides").fill("8");
  await page.getByLabel("Rotation (degrees)").fill("45");
  await page.getByLabel("Opacity").fill("0.5");
  await expect(page.getByLabel("Select polygon 2")).toHaveText("8 sides");
  await expect(renderButton(page)).toBeEnabled();
  await page.getByLabel("Opacity").fill("3");
  await expect(renderButton(page)).toBeDisabled();
});

test("every bundled example opens and stays renderable", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  for (const label of ["Parabola · transformation demo", "Area under the curve", "Shapes and motion"]) {
    await page.getByLabel("Open example").selectOption({ label });
    await expect(page.getByRole("status"), label).toContainText("Click Render");
    await expect(renderButton(page), label).toBeEnabled();
  }
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("5 elements");
});
