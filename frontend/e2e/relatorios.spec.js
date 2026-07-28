import { test, expect } from "./helpers/auth.js";

test.describe("Relatórios", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/caminhoes**", async (route) => {
      if (route.request().method() !== "GET") {
        return route.continue();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            { id: 1, placa: "ABC1D23", modelo: "FH", km_atual: 50000 },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 1,
            itemsPerPage: 200,
          },
        }),
      });
    });

    await page.route("**/api/reports/cost-per-km**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            filters: { startDate: "2026-06-01", endDate: "2026-07-31" },
            stats: {
              grandTotal: 1000,
              totalKm: 5000,
              avgCostPerKm: 0.2,
              truckCount: 1,
              entryCount: 2,
            },
            items: [
              {
                caminhaoId: 1,
                placa: "ABC1D23",
                totalCost: 1000,
                kmDriven: 5000,
                costPerKm: 0.2,
                expensesCount: 2,
                kmDataInsufficient: false,
              },
            ],
            entries: [],
          },
        }),
      });
    });
  });

  test("carrega página e gera relatório de custo por KM", async ({ page }) => {
    await page.goto("/relatorios");

    await expect(
      page.getByRole("heading", { name: "Relatórios Gerenciais" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /gerar relatório/i }).click();

    await expect(
      page.getByRole("cell", { name: "ABC1D23" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("columnheader", { name: /custo \/ km/i }),
    ).toBeVisible();
  });
});
