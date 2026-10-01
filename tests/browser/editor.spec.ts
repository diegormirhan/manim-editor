import { test, expect } from "@playwright/test";

test("English labels and singular counts survive theme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByRole("heading", { name: "Timeline" })).toContainText("1 element");
  await expect(page.locator(".ruler")).toContainText("1.5 s");
  await page.getByLabel("Switch to light mode").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByLabel("Open example")).toBeVisible();
  await page.getByLabel("Switch to dark mode").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("LaTeX expression")).toHaveValue("a^2 + b^2 = c^2");
});

test("the theme follows the system until the user picks one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Switch to light mode").click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("edits, validates, adds and undoes without pretending to render in browser", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your scene starts here" }),
  ).toBeVisible();
  await page.getByLabel("LaTeX expression").fill("x^2 + 1");
  await expect(page.getByLabel("Select equation 1")).toHaveText("x^2 + 1");
  await page.getByLabel("Appear at (s)").fill("9");
  await expect(
    page.getByRole("button", { name: "Render", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Appear at (s)").fill("0");
  await page.getByRole("button", { name: "Add Equation" }).click();
  await expect(page.getByLabel("Select equation 2")).toBeVisible();
  await page.getByLabel("Undo").click();
  await expect(page.getByLabel("Select equation 2")).toHaveCount(0);
  await page.getByRole("button", { name: "Render", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("desktop app");
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 800, height: 650 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: ".impeccable/review/compact.png",
    fullPage: true,
  });
});
