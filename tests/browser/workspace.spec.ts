import { test, expect } from "@playwright/test";
import { openEditor } from "./desktop-mock";

test("properties stay reachable without scrolling past the catalog", async ({ page }) => {
  await openEditor(page);
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
  await openEditor(page);
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
  await openEditor(page);
  await expect(page.getByLabel("Select equation 1")).toBeVisible();
  await page.getByLabel("Duplicate element").click();
  await expect(page.getByLabel("Select equation 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("2 elements");
});

test("the playhead reports the time the user scrubs to", async ({ page }) => {
  await openEditor(page);
  const playhead = page.getByRole("slider", { name: "Playhead" });
  await expect(playhead).toHaveAttribute("aria-valuenow", "0");
  const lane = await playhead.boundingBox();
  await page.mouse.click(lane!.x + lane!.width / 2, lane!.y + lane!.height / 2);
  // The default scene runs 3 s, so the midpoint is 1.5 s.
  await expect(playhead).toHaveAttribute("aria-valuenow", "1.5");
  await playhead.press("ArrowLeft");
  await expect(playhead).toHaveAttribute("aria-valuenow", "1.4");
});

test("Esc cancels a mouse drag and leaves the clip where it was", async ({ page }) => {
  await openEditor(page);
  const clip = page.locator(".editable-clip").first();
  const box = (await clip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(clip).toHaveAttribute("title", /0 s–3 s/);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("a dragged clip locks onto the playhead and says so before release", async ({ page }) => {
  await openEditor(page);
  const playhead = page.getByRole("slider", { name: "Playhead" });
  const ruler = (await playhead.boundingBox())!;
  // 1.43 s is off the 0.1 s grid, so only the magnet can produce it.
  await page.mouse.click(ruler.x + ruler.width * 1430 / 3000, ruler.y + ruler.height / 2);
  const at = Number(await playhead.getAttribute("aria-valuenow"));
  const clip = page.locator(".editable-clip").first();
  const box = (await clip.boundingBox())!;
  const lane = (await page.locator(".clip-lane").first().boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 40 + lane.width * at / 3 + 3, y, { steps: 8 });
  await expect(page.locator(".timeline-help")).toContainText("Snapped to playhead");
  await expect(page.locator(".snap-guide")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator(".snap-guide")).toHaveCount(0);
  await expect(page.getByLabel("Appear at (s)")).toHaveValue(String(Math.round(at * 1000) / 1000));
});

test("dragging a clip moves it in the project", async ({ page }) => {
  await openEditor(page);
  const clip = page.locator(".editable-clip").first();
  await expect(clip).toHaveAttribute("title", /0 s–3 s/);
  const box = (await clip.boundingBox())!;
  const y = box.y + box.height / 2;
  const lane = (await page.locator(".clip-lane").first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // A third of the lane is a third of the 3 s scene, so the clip should start at 1 s.
  await page.mouse.move(box.x + box.width / 2 + lane.width / 3, y, { steps: 10 });
  // The new span is read out while the clip is still in hand.
  await expect(page.locator(".timeline-help")).toContainText("1 s → 3 s");
  await page.mouse.up();
  await expect(clip).toHaveAttribute("title", /1 s–3 s/);
  await expect(page.getByLabel("Appear at (s)")).toHaveValue("1");
});

test("commands explain themselves and their shortcut in a tooltip", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Render", exact: true }).hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("Render");
  await expect(tip).toContainText("Ctrl");
  await expect(tip).toContainText("Enter");
  // Leave over the empty stage, where no other control has a tooltip.
  const stage = (await page.locator(".empty-preview").boundingBox())!;
  await page.mouse.move(stage.x + stage.width / 2, stage.y + 20, { steps: 4 });
  await page.mouse.move(stage.x + stage.width / 2 + 10, stage.y + 30);
  await expect(tip).toHaveCount(0);
});

test("booleans are switches that report their state", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Number line").click();
  const numbers = page.getByRole("switch", { name: "Show numbers" });
  await expect(numbers).toHaveAttribute("aria-checked", "true");
  await numbers.click();
  await expect(numbers).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Control+z");
  await expect(numbers).toHaveAttribute("aria-checked", "true");
});

test("a short animation clip keeps its duration and lets its name go", async ({ page }) => {
  await openEditor(page, "Shapes and motion");
  const clips = page.locator(".editable-clip.animation");
  for (const clip of await clips.all()) await expect(clip.locator(".clip-duration")).toBeVisible();
  const widths = await clips.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  const narrow = clips.nth(widths.indexOf(Math.min(...widths)));
  expect(Math.min(...widths)).toBeLessThan(112);
  await expect(narrow.locator(".clip-body span")).toBeHidden();
  // The name is still on the track label and in the clip's tooltip.
  await expect(narrow).toHaveAttribute("title", /^[A-Za-z]+ · /);
});

test("the object pool fades at its foot while more lies below", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await openEditor(page);
  const library = page.locator(".library");
  const hint = () => library.evaluate(node => getComputedStyle(node, "::after").opacity);
  expect(await hint()).toBe("1");
  await library.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect.poll(hint).toBe("0");
});
