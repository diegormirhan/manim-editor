import { test, expect } from "@playwright/test";

test("properties stay reachable without scrolling past the catalog", async ({ page }) => {
  await page.goto("/");
  const library = page.locator(".library");
  const inspector = page.locator(".inspector");
  // Each pane owns its own scroll, so neither can push the other off screen.
  for (const pane of [library, inspector]) {
    await expect(pane).toBeVisible();
    await expect(pane).toHaveCSS("overflow-y", "auto");
  }
  await expect(page.getByLabel("LaTeX expression")).toBeInViewport();
});

test("the library filters by name and says when nothing matches", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("Search the library");
  await search.fill("circ");
  await expect(page.getByRole("button", { name: "Add Circle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Equation" })).toHaveCount(0);
  await search.fill("zzz");
  await expect(page.getByText("No element matches")).toBeVisible();
  await search.fill("");
  await expect(page.getByRole("button", { name: "Add Equation" })).toBeVisible();
});

test("duplicating an element adds a second track without touching animations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Select equation 1")).toBeVisible();
  await page.getByLabel("Duplicate element").click();
  await expect(page.getByLabel("Select equation 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("2 elements");
});

test("the playhead reports the time the user scrubs to", async ({ page }) => {
  await page.goto("/");
  const playhead = page.getByRole("slider", { name: "Playhead" });
  await expect(playhead).toHaveAttribute("aria-valuenow", "0");
  const lane = await playhead.boundingBox();
  await page.mouse.click(lane!.x + lane!.width / 2, lane!.y + lane!.height / 2);
  // The default scene runs 3 s, so the midpoint is 1.5 s.
  await expect(playhead).toHaveAttribute("aria-valuenow", "1.5");
  await playhead.press("ArrowLeft");
  await expect(playhead).toHaveAttribute("aria-valuenow", "1.4");
});

test("dragging a clip moves it in the project", async ({ page }) => {
  await page.goto("/");
  const clip = page.locator(".editable-clip").first();
  await expect(clip).toHaveAttribute("title", /0 s–3 s/);
  const box = (await clip.boundingBox())!;
  const y = box.y + box.height / 2;
  const lane = (await page.locator(".clip-lane").first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // A third of the lane is a third of the 3 s scene, so the clip should start at 1 s.
  await page.mouse.move(box.x + box.width / 2 + lane.width / 3, y, { steps: 10 });
  await page.mouse.up();
  await expect(clip).toHaveAttribute("title", /1 s–3 s/);
  await expect(page.getByLabel("Appear at (s)")).toHaveValue("1");
});
