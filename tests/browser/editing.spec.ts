import { test, expect, type Page } from "@playwright/test";
import { fileCommand, openEditor } from "./desktop-mock";

const status = (page: Page) => page.getByRole("status");
const heading = (page: Page) => page.getByRole("heading", { name: "Timeline" });
const timecode = (page: Page) => page.locator(".transport .timecode").first();

test("a new object starts at the playhead", async ({ page }) => {
  await openEditor(page);
  const playhead = page.getByRole("slider", { name: "Playhead" });
  const ruler = (await playhead.boundingBox())!;
  await page.mouse.click(ruler.x + ruler.width / 2, ruler.y + ruler.height / 2);
  await page.getByLabel("Add Circle").click();
  await expect(page.getByLabel("Appear at (s)")).toHaveValue("1.5");
  await expect(status(page)).toContainText("Circle added at 1.5 s.");
});

test("Delete removes the selected animation, not the object it animates", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Circle").click();
  await page.getByLabel("Animation type").selectOption("grow");
  await page.getByRole("button", { name: "Add animation" }).click();
  await expect(page.locator(".animation-track")).toHaveCount(1);
  // The new clip is selected, so its settings are the inspector's focus.
  await expect(page.locator(".animation-track.current")).toHaveCount(1);
  await expect(page.locator("fieldset.current")).toBeVisible();

  await page.getByLabel("Select circle 2").click();
  await expect(page.locator(".animation-track.current")).toHaveCount(0);
  await page.getByRole("button", { name: "Select grow · growfromcenter 1" }).click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".animation-track")).toHaveCount(0);
  await expect(page.getByLabel("Select circle 2")).toBeVisible();
  await expect(status(page)).toContainText("Animation removed.");
  await page.keyboard.press("Control+z");
  await expect(page.locator(".animation-track")).toHaveCount(1);
});

test("removing a transform also removes the destination it created", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Circle").click();
  await page.getByLabel("Animation type").selectOption("transform");
  await page.getByRole("button", { name: "Add animation" }).click();
  await expect(heading(page)).toContainText("3 elements");
  await page.getByRole("button", { name: "Remove animation" }).last().click();
  await expect(heading(page)).toContainText("2 elements");
  await expect(page.getByRole("button", { name: "Render", exact: true })).toBeEnabled();
});

test("an animation that cannot fit is refused with the reason", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Circle").click();
  await page.getByLabel("Animation type").selectOption("fadeIn");
  await page.getByRole("button", { name: "Add animation" }).click();
  await page.getByRole("button", { name: "Add animation" }).click();
  await expect(page.getByRole("alert")).toContainText("entrance");
  await expect(page.locator(".animation-track")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Render", exact: true })).toBeEnabled();
});

test("typing into a field undoes as one step", async ({ page }) => {
  await openEditor(page);
  const latex = page.getByLabel("LaTeX expression");
  await latex.fill("");
  await latex.pressSequentially("x+y", { delay: 30 });
  await expect(latex).toHaveValue("x+y");
  await page.keyboard.press("Control+z");
  await expect(latex).toHaveValue("a^2 + b^2 = c^2");
});

test("a new project starts empty and only asks when changes would be lost", async ({ page }) => {
  await openEditor(page);
  await fileCommand(page, "New project");
  await expect(heading(page)).toContainText("0 elements");
  await expect(page.locator(".tracks-empty")).toContainText("starts at the playhead");
  await page.getByLabel("Add Circle").click();
  await fileCommand(page, "New project");
  const dialog = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(heading(page)).toContainText("1 element");
  await fileCommand(page, "New project");
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(heading(page)).toContainText("0 elements");
});

test("unsaved work survives closing the window and waits on the projects screen", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("LaTeX expression").fill("\\int_0^1 x\\,dx");
  await page.reload();
  const card = page.getByRole("button", { name: "Continue First equation" });
  await expect(card).toContainText("Unsaved changes");
  await card.click();
  await expect(page.getByLabel("LaTeX expression")).toHaveValue("\\int_0^1 x\\,dx");
  await expect(page.locator(".save-state")).toHaveText("Unsaved");
});

test("the transport answers the keyboard", async ({ page }) => {
  await openEditor(page);
  await page.locator(".empty-preview").click();
  await page.keyboard.press("End");
  await expect(timecode(page)).toHaveText("00:00:03:00");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(timecode(page)).toHaveText("00:00:00:01");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(timecode(page)).toHaveText("00:00:01:01");
  await page.keyboard.press("ArrowLeft");
  await expect(timecode(page)).toHaveText("00:00:01:00");
});

test("the shortcut sheet opens with ? and closes with Esc", async ({ page }) => {
  await openEditor(page);
  await page.locator(".empty-preview").click();
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Cancel a render or export");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
  await expect(sheet).toBeVisible();
});

test("the timeline zooms around the pointer, keeps labels in place and follows the playhead", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Open example").selectOption({ label: "Shapes and motion" });
  const body = page.locator(".timeline-body");
  const lane = page.getByRole("slider", { name: "Playhead" });
  const label = page.locator(".track-label").first();
  const width = async () => (await lane.boundingBox())!.width;
  const fitted = await width();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "Fit the scene" })).toHaveText("2.3×");
  expect(await width()).toBeGreaterThan(fitted * 2);

  // Horizontal scrolling moves the clips under labels that stay put.
  const labelX = (await label.boundingBox())!.x;
  await body.evaluate(node => { node.scrollLeft = 400; });
  expect((await label.boundingBox())!.x).toBe(labelX);

  const box = (await body.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -400);
  await page.keyboard.up("Control");
  await expect.poll(width).toBeGreaterThan(fitted * 4);

  await page.locator(".empty-preview").click();
  await page.keyboard.press("End");
  const head = page.locator(".playhead-head");
  await expect.poll(async () => {
    const [h, b] = [(await head.boundingBox())!, (await body.boundingBox())!];
    return h.x > b.x && h.x < b.x + b.width;
  }).toBe(true);

  await page.keyboard.press("\\");
  await expect(page.getByRole("button", { name: "Fit the scene" })).toHaveText("Fit");
  await expect.poll(width).toBeCloseTo(fitted, 0);
});

test("a clip's resize grips stay inside the clip", async ({ page }) => {
  await openEditor(page, "Area under the curve");
  const clip = (await page.locator(".editable-clip.presence").first().boundingBox())!;
  for (const grip of await page.locator(".editable-clip.presence").first().locator(".clip-grip").all()) {
    expect((await grip.boundingBox())!.height).toBeLessThanOrEqual(clip.height);
  }
});

test("colour fields never rewrite the native picker, so an open picker cannot loop", async ({ page }) => {
  // Counts every write to a colour input's value, React's included (its tracker keeps the setter it saw first).
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    const counter = window as unknown as { colourWrites: number };
    counter.colourWrites = 0;
    Object.defineProperty(HTMLInputElement.prototype, "value", { ...descriptor, set(value: string) {
      if (this.type === "color") counter.colourWrites++;
      descriptor.set!.call(this, value);
    } });
  });
  const writes = () => page.evaluate(() => (window as unknown as { colourWrites: number }).colourWrites);
  const reset = () => page.evaluate(() => { (window as unknown as { colourWrites: number }).colourWrites = 0; });
  await openEditor(page, "Area under the curve");

  // The example stores #83C167; the picker holds #83c167. A re-render must leave it alone.
  await reset();
  await page.getByLabel("Project name").fill("Recoloured");
  expect(await writes()).toBe(0);

  await page.locator(".empty-preview").click();
  await page.keyboard.press("Control+,");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("tab", { name: "Scene" }).click();
  await reset();
  await settings.getByLabel("Background colour").locator("input").fill("#ff0000");
  await expect(settings).toContainText("#FF0000");
  expect(await writes()).toBe(0);
});
