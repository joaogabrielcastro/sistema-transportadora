import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("home carrega com branding Abbrotо", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ABroto", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: /cadastrar caminhão/i })).toBeVisible();
  });

  test("navega para ordem de coleta", async ({ page }) => {
    await page.goto("/ordem-coleta");
    await expect(
      page.getByRole("heading", { name: /ordens de coleta e autorizações/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
