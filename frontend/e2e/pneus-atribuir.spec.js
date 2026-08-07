import { test, expect } from "./helpers/auth.js";

const posicoes = [
  { id: 1, nome_posicao: "Dianteiro Esquerdo" },
  { id: 2, nome_posicao: "Dianteiro Direito" },
  { id: 3, nome_posicao: "Eixo 2 - Externo Esquerdo" },
  { id: 4, nome_posicao: "Eixo 2 - Interno Esquerdo" },
  { id: 5, nome_posicao: "Eixo 2 - Externo Direito" },
  { id: 6, nome_posicao: "Eixo 2 - Interno Direito" },
];

test.describe("Instalar pneus", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/caminhoes**", async (route) => {
      if (route.request().method() === "GET") {
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
                modelo: "FH",
                km_atual: 29530,
                qtd_pneus: 6,
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
        return;
      }
      await route.continue();
    });

    await page.route("**/api/posicoes-pneus**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: posicoes }),
      });
    });

    await page.route("**/api/status-pneus**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, nome_status: "Em uso" }],
        }),
      });
    });

    await page.route("**/api/pneus/in-stock**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 10, marca: "Bridgestone", modelo: "R269" }],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 1,
            itemsPerPage: 200,
          },
        }),
      });
    });

    await page.route("**/api/pneus/bulk", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [{ id: 99 }] }),
      });
    });
  });

  test("cadastra pneu novo e seleciona posição no diagrama", async ({ page }) => {
    await page.goto("/pneus/atribuir");

    await expect(
      page.getByRole("heading", { name: /instalar pneus no caminhão/i }),
    ).toBeVisible();

    await page.getByLabel("Caminhão").click();
    await page.getByRole("option", { name: /ABC1D23/ }).click();
    await expect(page.getByText("Eixo dianteiro")).toBeVisible();

    await page
      .getByRole("button", { name: "Pneu novo", exact: true })
      .click();
    await page.getByPlaceholder("Ex: Michelin").fill("Michelin");
    await page.getByPlaceholder("Ex: XZY-123").fill("XZY-123");

    await page.getByTitle("Dianteiro Esquerdo").click();

    await expect(page.getByText(/posição: dianteiro esquerdo/i)).toBeVisible();

    const bulkRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/api/pneus/bulk") && req.method() === "POST",
    );

    await page.getByRole("button", { name: /instalar 1 pneu/i }).click();

    const req = await bulkRequest;
    const body = req.postDataJSON();
    expect(body.pneus).toHaveLength(1);
    expect(body.pneus[0].marca).toBe("Michelin");
    expect(body.pneus[0].posicao_id).toBe(1);
  });

  test("permite adicionar segundo pneu na lista", async ({ page }) => {
    await page.goto("/pneus/atribuir");
    await page.getByRole("button", { name: /adicionar outro pneu/i }).click();
    await expect(page.getByRole("button", { name: /^Pneu 2/ })).toBeVisible();
  });
});
