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

  test("lembrete de próxima troca aparece na manutenção", async ({ page }) => {
    let postedBody = null;
    await page.route("**/api/checklist", async (route) => {
      if (route.request().method() === "POST") {
        postedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { id: 99, ...postedBody },
          }),
        });
        return;
      }
      return route.continue();
    });

    await page.goto("/manutencao-gastos");

    await page.getByLabel("Tipo de Registro").selectOption("manutencao");
    await expect(page.getByText("Caminhão, KM e data")).toBeVisible();
    await expect(page.getByText("Serviço e oficina")).toBeVisible();
    await expect(
      page.getByText("Próxima manutenção e observações"),
    ).toBeVisible();
    await expect(page.getByLabel("Próxima troca (KM)")).toBeVisible();
    await expect(page.getByLabel("Próxima troca (data)")).toBeVisible();

    await page.getByLabel("Caminhão").click();
    await page.getByRole("option", { name: /ABC1D23/ }).click();

    await page.getByLabel("Serviço realizado").fill("Troca de óleo");
    await expect(page.getByLabel("Próxima troca (KM)")).toHaveValue("60000");
    await expect(page.getByLabel("Próxima troca (data)")).not.toHaveValue("");

    await page.getByLabel("Valor (R$)").fill("350");
    await page.getByRole("button", { name: "Cadastrar Registro" }).click();

    await expect.poll(() => postedBody).not.toBeNull();
    expect(postedBody.nome_item).toBe("Troca de óleo");
    expect(postedBody.proxima_km).toBe(60000);
    expect(postedBody.proxima_data).toBeTruthy();
  });
});
