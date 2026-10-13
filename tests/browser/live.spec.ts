import { test, expect, type Page } from "@playwright/test";
import { liveFrameCalls, mockDesktop, openEditor } from "./desktop-mock";

const frame = (page: Page) => page.getByRole("img", { name: "Manim's frame at the playhead" });
const previewState = (page: Page) => page.locator(".preview-state");
const lastCall = async (page: Page) => (await liveFrameCalls(page)).at(-1);

test("the live preview shows Manim's frame at the playhead and follows scrubbing and edits", async ({ page }) => {
  await mockDesktop(page, { live: {} });
  await openEditor(page, "Area under the curve");
  await expect(frame(page)).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(previewState(page)).toHaveText("Live preview");
  expect(await lastCall(page)).toEqual({ timeMs: 0, name: "Area under a curve" });

  const ruler = (await page.getByRole("slider", { name: "Playhead" }).boundingBox())!;
  await page.mouse.click(ruler.x + ruler.width / 2, ruler.y + ruler.height / 2);
  await expect.poll(async () => (await lastCall(page))!.timeMs).toBeGreaterThan(5000);

  await page.getByLabel("Project name").fill("Live check");
  await expect.poll(async () => (await lastCall(page))!.name).toBe("Live check");
});

test("an up-to-date render takes over from the live frame until the next edit", async ({ page }) => {
  await mockDesktop(page, { live: {} });
  await openEditor(page);
  await expect(frame(page)).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(previewState(page)).toHaveText("Up to date");
  // Play renders and then plays; editing and dragging work on a paused scene.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(frame(page)).toHaveCount(0);
  await expect(page.getByLabel("Rendered video")).toBeVisible();

  await page.getByLabel("LaTeX expression").fill("e^{i\\pi} + 1 = 0");
  await expect(frame(page)).toBeVisible();
  await expect(previewState(page)).toHaveText("Live preview");
  // Play still has the rendered video underneath.
  await expect(page.getByLabel("Rendered video")).toBeHidden();
  await expect(page.getByRole("button", { name: "Play" })).toBeEnabled();
});

test("a frame Manim cannot draw says why and keeps the last good one", async ({ page }) => {
  // Only the unfinished fraction fails: in the request's JSON its LaTeX ends right after the open brace.
  await mockDesktop(page, { live: { failOn: '\\\\frac{1}{"' } });
  await openEditor(page);
  await expect(frame(page)).toBeVisible();
  await page.getByLabel("LaTeX expression").fill("\\frac{1}{");
  await expect(page.locator(".live-error")).toHaveText("LaTeX error: Missing } inserted. Check the equation's LaTeX.");
  await expect(frame(page)).toBeVisible();
  await page.getByLabel("LaTeX expression").fill("\\frac{1}{2}");
  await expect(page.locator(".live-error")).toHaveCount(0);
});

test("an object moves where it is dragged on the stage, in one undo step", async ({ page }) => {
  await mockDesktop(page, { live: {} });
  await openEditor(page);
  const handle = page.getByRole("button", { name: "Move Equation" });
  const canvas = (await page.locator(".canvas").boundingBox())!;
  const box = (await handle.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + canvas.width / 8, y, { steps: 4 });
  // A quarter of the frame's width and an eighth of its height: 128/9 ÷ 4 and 8 ÷ 8 scene units.
  await page.mouse.move(x + canvas.width / 4, y - canvas.height / 8, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByLabel("Position X")).toHaveValue("3.56");
  await expect(page.getByLabel("Position Y")).toHaveValue("1");
  await expect(handle).toHaveClass(/selected/);

  await page.keyboard.press("Control+z");
  await expect(page.getByLabel("Position X")).toHaveValue("0");
  await expect(page.getByLabel("Position Y")).toHaveValue("0");
});

test("objects over an up-to-date render can be dragged too, and the live frame takes over", async ({ page }) => {
  await mockDesktop(page, { live: {} });
  await openEditor(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(previewState(page)).toHaveText("Up to date");
  // Play renders and then plays; editing and dragging work on a paused scene.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const box = (await page.getByRole("button", { name: "Move Equation" }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(frame(page)).toBeVisible();
  await expect(previewState(page)).toHaveText("Live preview");
});

/** Presses at the middle of `target`, moves by (dx, dy) pixels and, unless `hold`, lets go. */
async function dragBy(page: Page, target: { x: number; y: number; width: number; height: number }, dx: number, dy: number, hold = false) {
  const [x, y] = [target.x + target.width / 2, target.y + target.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  if (!hold) await page.mouse.up();
}

test("a dragged object snaps onto the frame's centre and shows the guide, unless guides are off", async ({ page }) => {
  await mockDesktop(page, { live: {} });
  await openEditor(page);
  const handle = page.getByRole("button", { name: "Move Equation" });
  await dragBy(page, (await handle.boundingBox())!, 4, 40, true);
  await expect(page.locator(".guide.vertical")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".guide")).toHaveCount(0);
  await expect(page.getByLabel("Position X")).toHaveValue("0");

  await page.keyboard.press("Control+,");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("tab", { name: "Editor" }).click();
  await settings.getByRole("switch", { name: "Alignment guides" }).click();
  await page.keyboard.press("Escape");
  await dragBy(page, (await handle.boundingBox())!, 4, 0);
  await expect(page.getByLabel("Position X")).not.toHaveValue("0");
});

test("the selected object turns from its knob and scales from a corner", async ({ page }) => {
  await mockDesktop(page, { live: {} });
  await openEditor(page);
  await page.getByRole("button", { name: "Move Equation" }).click();
  const handle = page.locator(".handle.selected");
  const box = (await handle.boundingBox())!;
  const knob = (await handle.locator(".knob").boundingBox())!;
  // From straight above the centre to straight right of it: a quarter turn clockwise on screen.
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 1.5, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Number(await page.getByLabel("Rotation (degrees)").inputValue())).toBeCloseTo(-90, -1);

  // Once Manim's frame shows the turn, the handle is an upright box again.
  await expect(handle).not.toHaveAttribute("style", /rotate/);
  await dragBy(page, (await handle.locator(".corner.se").boundingBox())!, box.width / 2, box.height / 2);
  await expect.poll(async () => Number(await page.getByLabel("Scale", { exact: true }).inputValue())).toBeCloseTo(2, 0);
});

test("arrow keys nudge the focused object instead of stepping frames", async ({ page }) => {
  await mockDesktop(page, { live: {} });
  await openEditor(page);
  await page.getByRole("button", { name: "Move Equation" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(page.getByLabel("Position X")).toHaveValue("0.1");
  await expect(page.getByLabel("Position Y")).toHaveValue("1");
  await expect(page.locator(".transport .timecode").first()).toHaveText("00:00:00:00");
});

test("the live preview can be switched off", async ({ page }) => {
  await mockDesktop(page, { live: {} });
  await openEditor(page);
  await expect(frame(page)).toBeVisible();
  await page.locator(".stage").click();
  await page.keyboard.press("Control+,");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("switch", { name: "Live preview" }).click();
  await page.keyboard.press("Escape");
  await expect(frame(page)).toHaveCount(0);
  await expect(previewState(page)).toHaveText("Not rendered yet");
  const sent = (await liveFrameCalls(page)).length;
  await page.getByLabel("LaTeX expression").fill("x^3");
  await page.waitForTimeout(200);
  expect((await liveFrameCalls(page)).length).toBe(sent);
});
