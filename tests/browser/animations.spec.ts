import { test, expect, type Page } from "@playwright/test";

const renderButton = (page: Page) => page.getByRole("button", { name: "Render", exact: true });

test("an unparseable expression names its column and blocks rendering", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Add Graph").click();
  const field = page.getByLabel("f(x) expression");
  await field.fill("2 +");
  await expect(page.getByRole("status")).toContainText("column");
  await expect(renderButton(page)).toBeDisabled();
  await field.fill("__import__('os')");
  await expect(renderButton(page)).toBeDisabled();
  await field.fill("sin(2x)/2");
  await expect(renderButton(page)).toBeEnabled();
});

test("a curve undefined inside its range is rejected, not silently plotted", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Add Graph").click();
  await page.getByLabel("f(x) expression").fill("sqrt(x)");
  await expect(page.getByRole("status")).toContainText("is not defined");
  await page.getByLabel("X minimum").fill("0");
  await expect(renderButton(page)).toBeEnabled();
});

const motionClips = [
  { kind: "rotate", field: "Turn (degrees)", value: "90" },
  { kind: "scaleTo", field: "Scale factor", value: "1.5" },
  { kind: "recolor", field: "Final color", value: "#fc6255" },
] as const;

for (const { kind, field, value } of motionClips) {
  test(`${kind} adds its own field and a timeline clip`, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Add Circle").click();
    await page.getByLabel("Animation type").selectOption(kind);
    await page.getByRole("button", { name: "Add animation" }).click();
    await expect(page.getByLabel(field)).toHaveValue(value);
    await expect(page.locator(".animation-track")).toHaveCount(1);
    await expect(renderButton(page)).toBeEnabled();
  });
}

test("new entrances replace the instantaneous appearance", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Add Circle").click();
  await page.getByLabel("Animation type").selectOption("grow");
  await page.getByRole("button", { name: "Add animation" }).click();
  await expect(page.getByRole("button", { name: "Select grow · growfromcenter 1" })).toBeVisible();
  await expect(renderButton(page)).toBeEnabled();
  // Moving an entrance carries the element it introduces, so the project stays valid.
  await page.getByLabel("Start (s)").fill("1");
  await expect(page.getByLabel("Appear at (s)")).toHaveValue("1");
  await expect(renderButton(page)).toBeEnabled();
});
