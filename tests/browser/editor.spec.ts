import { test, expect } from "@playwright/test";

test("edits, validates, adds and undoes without pretending to render in browser", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sua cena começa aqui" }),
  ).toBeVisible();
  await page.getByLabel("Expressão LaTeX").fill("x^2 + 1");
  await expect(page.getByLabel("Selecionar equação 1")).toHaveText("x^2 + 1");
  await page.getByLabel("Aparecer em (ms)").fill("9000");
  await expect(
    page.getByRole("button", { name: "Renderizar", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Aparecer em (ms)").fill("0");
  await page.getByRole("button", { name: "Adicionar Equação" }).click();
  await expect(page.getByLabel("Selecionar equação 2")).toBeVisible();
  await page.getByLabel("Desfazer").click();
  await expect(page.getByLabel("Selecionar equação 2")).toHaveCount(0);
  await page.getByRole("button", { name: "Renderizar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("versão desktop");
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
