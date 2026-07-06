import { test, expect } from "./helpers/auth.js";

test.describe("Ordem de coleta", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/caminhoes**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, placa: "ABC1D23", motorista: "João" }],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 1,
            itemsPerPage: 200,
          },
        }),
      });
    });

    await page.route("**/api/ordem-coleta/historico**", async (route) => {
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
            itemsPerPage: 20,
          },
        }),
      });
    });
  });

  test("pré-visualização envia POST e exibe HTML", async ({ page }) => {
    let previewCalled = false;

    await page.route("**/api/ordem-coleta/preview", async (route) => {
      previewCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { html: "<div>Prévia ordem teste</div>" },
        }),
      });
    });

    await page.goto("/ordem-coleta");
    await page.getByRole("button", { name: /pré-visualizar html/i }).click();

    await expect.poll(() => previewCalled).toBe(true);
  });
});
