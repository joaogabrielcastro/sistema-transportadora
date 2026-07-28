import { test, expect } from "./helpers/auth.js";

test.describe("Manutenção e Gastos", () => {
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
            {
              id: 1,
              placa: "ABC1D23",
              motorista: "João",
              km_atual: 50000,
            },
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

    await page.route("**/api/itens-checklist**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, nome_item: "Óleo do motor" }],
        }),
      });
    });

    await page.route("**/api/tipos-gastos**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, nome_tipo: "Combustível" }],
        }),
      });
    });

    await page.route("**/api/registros**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              tipo_registro: "Gasto",
              nome_tipo: "Combustível",
              placa: "ABC1D23",
              data: "2026-07-01",
              valor: 500,
              km_registro: 50000,
              descricao: "Abastecimento",
            },
            {
              id: 2,
              tipo_registro: "Manutenção",
              nome_tipo: "Óleo do motor",
              placa: "ABC1D23",
              data: "2026-07-02",
              valor: 800,
              km_registro: 50100,
              observacao: "Troca de óleo",
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 2,
            itemsPerPage: 20,
          },
        }),
      });
    });
  });

  test("lista registros de gastos e manutenção", async ({ page }) => {
    await page.goto("/manutencao-gastos");

    await expect(
      page.getByRole("heading", { name: "Manutenção e Gastos" }),
    ).toBeVisible();

    const tabela = page.getByRole("table");
    await expect(tabela.getByText("Combustível")).toBeVisible();
    await expect(tabela.getByText("Óleo do motor")).toBeVisible();
    await expect(page.getByRole("cell", { name: "ABC1D23" })).toHaveCount(2);
  });

  test("formulário de novo registro está visível", async ({ page }) => {
    await page.goto("/manutencao-gastos");
    await expect(page.getByText("Adicionar Novo Registro")).toBeVisible();
    await expect(page.getByLabel("Tipo de Registro")).toBeVisible();
    await expect(page.getByLabel("Caminhão")).toBeVisible();
  });
});
