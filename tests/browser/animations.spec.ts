import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./desktop-mock";

const playButton = (page: Page) => page.getByRole("button", { name: "Play", exact: true });

test("an unparseable expression names its column and blocks rendering", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Graph").click();
  const field = page.getByLabel("f(x) expression");
  await field.fill("2 +");
  await expect(page.getByRole("status")).toContainText("column");
  await expect(playButton(page)).toBeDisabled();
  await field.fill("__import__('os')");
  await expect(playButton(page)).toBeDisabled();
  await field.fill("sin(2x)/2");
  await expect(playButton(page)).toBeEnabled();
});

test("a curve undefined inside its range is rejected, not silently plotted", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Graph").click();
  await page.getByLabel("f(x) expression").fill("sqrt(x)");
  await expect(page.getByRole("status")).toContainText("is not defined");
  await page.getByLabel("X minimum").fill("0");
  await expect(playButton(page)).toBeEnabled();
});

const motionClips = [
  { item: "Rotate · Rotate", field: "Turn (degrees)", value: "90" },
  { item: "Scale · Scale", field: "Scale factor", value: "1.5" },
  { item: "Recolor · SetColor", field: "Final color", value: "#fc6255" },
] as const;

/** Adds an animation to the selected object from the inspector's menu. */
async function addAnimation(page: Page, item: string) {
  await page.getByRole("button", { name: "Add animation" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

for (const { item, field, value } of motionClips) {
  test(`${item} adds its own field and a clip inside its object's clip`, async ({ page }) => {
    await openEditor(page);
    await page.getByLabel("Add Circle").click();
    await addAnimation(page, item);
    await expect(page.getByLabel(field)).toHaveValue(value);
    await expect(page.locator("[data-layer='1'] .editable-clip.animation")).toHaveCount(1);
    await expect(playButton(page)).toBeEnabled();
  });
}

test("an entrance replaces the instantaneous appearance and carries it when moved", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Circle").click();
  await addAnimation(page, "Grow · GrowFromCenter");
  const grow = page.getByRole("button", { name: "Select grow of circle 2" });
  await expect(grow).toBeVisible();
  await expect(playButton(page)).toBeEnabled();
  // Moving an entrance carries the element it introduces, so the project stays valid.
  await grow.focus();
  for (let step = 0; step < 10; step++) await page.keyboard.press("ArrowRight");
  await expect(page.locator(".editable-clip", { has: page.getByRole("button", { name: "Select circle 2" }) }))
    .toHaveAttribute("title", /1 s–3 s/);
  await expect(page.locator("fieldset.current .clip-time")).toHaveText("1 s → 2 s");
  await expect(playButton(page)).toBeEnabled();
});
