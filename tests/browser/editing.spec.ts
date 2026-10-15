import { test, expect, type Page } from "@playwright/test";
import { fileCommand, mockDesktop, openEditor } from "./desktop-mock";

const status = (page: Page) => page.getByRole("status");
const heading = (page: Page) => page.getByRole("heading", { name: "Timeline" });
const timecode = (page: Page) => page.locator(".transport .timecode").first();
const pills = (page: Page) => page.locator(".editable-clip.animation");
/** Adds an animation to the selected object from the inspector's menu. */
async function addAnimation(page: Page, item: string) {
  await page.getByRole("button", { name: "Add animation" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("a new object starts at the playhead", async ({ page }) => {
  await openEditor(page);
  const playhead = page.getByRole("slider", { name: "Playhead" });
  const ruler = (await playhead.boundingBox())!;
  await page.mouse.click(ruler.x + ruler.width / 2, ruler.y + ruler.height / 2);
  await page.getByLabel("Add Circle").click();
  await expect(page.locator(".editable-clip.current")).toHaveAttribute("title", /1\.5 s–3 s/);
  await expect(status(page)).toContainText("Circle added at 1.5 s.");
});

test("Delete removes the selected animation, not the object it animates", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Circle").click();
  await addAnimation(page, "Grow · GrowFromCenter");
  await expect(pills(page)).toHaveCount(1);
  // The new clip is selected, so its settings are the inspector's focus.
  await expect(page.locator(".editable-clip.animation.current")).toHaveCount(1);
  await expect(page.locator("fieldset.current")).toBeVisible();

  await page.getByLabel("Select circle 2").click();
  await expect(page.locator(".editable-clip.animation.current")).toHaveCount(0);
  await page.getByRole("button", { name: "Select grow of circle 2" }).click();
  await page.keyboard.press("Delete");
  await expect(pills(page)).toHaveCount(0);
  await expect(page.getByLabel("Select circle 2")).toBeVisible();
  await expect(status(page)).toContainText("Animation removed.");
  await page.keyboard.press("Control+z");
  await expect(pills(page)).toHaveCount(1);
});

test("removing a transform also removes the destination it created", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Circle").click();
  await addAnimation(page, "Transform · Transform");
  await expect(heading(page)).toContainText("3 elements");
  await page.getByRole("button", { name: "Remove animation" }).last().click();
  await expect(heading(page)).toContainText("2 elements");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
});

test("an animation that cannot fit is refused with the reason", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Circle").click();
  await addAnimation(page, "Fade in · FadeIn");
  await addAnimation(page, "Fade in · FadeIn");
  await expect(page.getByRole("alert")).toContainText("entrance");
  await expect(pills(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
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

test("an object can enter while another object's animation plays", async ({ page }) => {
  await mockDesktop(page, { openProject: { schemaVersion: 1, name: "Overlap", scene: { durationMs: 6000, elements: {
    a: { kind: "circle", radius: 1, position: [-3, 0, 0], appearsAtMs: 0 },
    b: { kind: "circle", radius: 1, position: [3, 0, 0], appearsAtMs: 0 },
  }, animations: [{ kind: "indicate", targetId: "a", startMs: 1000, durationMs: 2000 }] } } });
  await page.goto("/");
  await page.getByRole("button", { name: "Open…" }).click();
  const grip = page.getByRole("button", { name: "Adjust start of Circle 2" });
  const lane = (await page.locator(".clip-lane").first().boundingBox())!;
  const box = (await grip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // 1.5 s of a 6 s scene: the middle of the Indicate.
  await page.mouse.move(lane.x + lane.width * 0.25, box.y + box.height / 2, { steps: 10 });
  await expect(page.locator(".timeline-help")).not.toHaveClass(/invalid/);
  await page.mouse.up();
  await expect(page.getByRole("status")).not.toContainText("went back");
  await expect(page.locator(".editable-clip", { has: page.getByRole("button", { name: "Select circle 2" }) }))
    .toHaveAttribute("title", /1\.5 s–6 s/);
});

test("dragging the playhead's line over the clips only moves the playhead", async ({ page }) => {
  await openEditor(page, "Shapes and motion");
  await page.getByLabel("Select ellipse 1").click();
  const selected = await page.locator(".editable-clip.current").getAttribute("title");
  const ruler = (await page.getByRole("slider", { name: "Playhead" }).boundingBox())!;
  await page.mouse.click(ruler.x + ruler.width * 0.2, ruler.y + ruler.height / 2);
  const line = (await page.locator(".playhead").boundingBox())!;
  const clip = (await page.locator(".editable-clip", { has: page.getByRole("button", { name: "Select arc 3" }) }).boundingBox())!;
  // Pressed where the line crosses another object's clip.
  await page.mouse.move(line.x + 0.5, clip.y + clip.height / 2);
  await page.mouse.down();
  await page.mouse.move(ruler.x + ruler.width * 0.5, clip.y + clip.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(timecode(page)).toHaveText("00:00:07:08");
  await expect(page.locator(".editable-clip.current")).toHaveAttribute("title", selected!);
  expect(await page.evaluate(() => getSelection()!.toString())).toBe("");
});

test("an object moves between layers by dragging, but not onto a layer that is busy then", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add Circle").click();
  const rowOf = (layer: number) => page.locator(`[data-layer="${layer}"]`);
  const circle = () => page.locator(".editable-clip", { has: page.getByRole("button", { name: "Select circle 2" }) });
  await expect(rowOf(1).locator(circle())).toHaveCount(1);
  const dragTo = async (layer: number) => {
    const [from, to] = [(await circle().boundingBox())!, (await rowOf(layer).boundingBox())!];
    await page.mouse.move(from.x + from.width / 2, from.y + 8);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 6 });
    await expect(rowOf(layer)).toHaveClass(/drop-target/);
    await page.mouse.up();
  };
  // The empty layer on top takes it, and keeps its time.
  await dragTo(2);
  await expect(rowOf(2).locator(circle())).toHaveCount(1);
  await expect(circle()).toHaveAttribute("title", /0 s–3 s/);
  // The equation fills the first layer for the whole scene.
  await dragTo(0);
  await expect(status(page)).toContainText("Two objects on layer 1 overlap in time.");
  await expect(rowOf(2).locator(circle())).toHaveCount(1);
});

test("animations of different objects play at the same time", async ({ page }) => {
  await openEditor(page);
  await addAnimation(page, "Write · Write");
  await page.getByLabel("Add Circle").click();
  await addAnimation(page, "Draw · Create");
  await expect(pills(page)).toHaveCount(2);
  for (const pill of await pills(page).all()) await expect(pill).toHaveAttribute("title", /0 s–1 s/);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
});
