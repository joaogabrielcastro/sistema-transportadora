import { test, expect } from "./helpers/auth.js";

test.describe("Smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/caminhoes**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
            itemsPerPage: 10,
          },
        }),
      });
    });

    await page.route("**/api/reports/overview**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    });
  });

  test("home carrega com branding Abbrotо", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ABroto", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /cadastrar caminhão/i }),
    ).toBeVisible();
  });

  test("navega para ordem de coleta", async ({ page }) => {
    await page.goto("/ordem-coleta");
    await expect(
      page.getByRole("heading", { name: /ordens de coleta e autorizações/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
