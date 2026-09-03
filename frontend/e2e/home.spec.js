import { test, expect } from "./helpers/auth.js";

const frota = [
  {
    id: 1,
    placa: "ABC1D23",
    motorista: "João Silva",
    modelo: "FH 540",
    marca: "Volvo",
    km_atual: 50000,
  },
  {
    id: 2,
    placa: "XYZ9Z99",
    motorista: "Maria Souza",
    modelo: "Actros",
    marca: "Mercedes",
    km_atual: 32000,
  },
];

test.describe("Home — busca de caminhões", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/reports/overview**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            totalCaminhoes: 2,
            totalGastos: 1500,
            totalManutencoes: 3,
          },
        }),
      });
    });

    await page.route("**/api/caminhoes**", async (route) => {
      const url = route.request().url();
      if (url.includes("/search")) {
        return route.fallback();
      }
      if (route.request().method() !== "GET") {
        return route.continue();
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: frota,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 2,
            itemsPerPage: 10,
          },
        }),
      });
    });

    await page.route("**/api/caminhoes/search**", async (route) => {
      const url = new URL(route.request().url());
      const term = (url.searchParams.get("term") || "").toUpperCase();
      const data = frota.filter(
        (c) =>
          c.placa.includes(term) ||
          c.motorista.toUpperCase().includes(term) ||
          c.modelo.toUpperCase().includes(term),
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data, total: data.length }),
      });
    });
  });

  test("lista frota recente no dashboard", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frota recente" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "ABC1D23" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "XYZ9Z99" })).toBeVisible();
  });

  test("navbar mostra itens principais e esconde CT-e sem feature fiscal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Menu principal" });
    await expect(nav.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Alertas" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Pneus" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Usuários" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Empresa" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Auditoria" })).toBeVisible();
    await expect(nav.getByRole("button", { name: /CT-e/ })).toHaveCount(0);
  });

  test("busca por placa filtra resultados", async ({ page }) => {
    await page.goto("/");

    const searchInput = page.getByPlaceholder(
      "Buscar por placa, motorista ou modelo...",
    );

    const searchRequest = page.waitForRequest((req) =>
      req.url().includes("/api/caminhoes/search"),
    );

    await searchInput.fill("ABC1");
    await searchRequest;
    await page.waitForTimeout(400);

    await expect(
      page.getByRole("heading", { name: "Resultados da busca" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "ABC1D23" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "XYZ9Z99" })).toHaveCount(0);
  });

  test("limpar busca restaura lista completa", async ({ page }) => {
    await page.goto("/");

    await page
      .getByPlaceholder("Buscar por placa, motorista ou modelo...")
      .fill("ABC1");
    await page.waitForRequest((req) =>
      req.url().includes("/api/caminhoes/search"),
    );

    await page.getByRole("button", { name: "Limpar busca" }).click();

    await expect(page.getByRole("heading", { name: "Frota recente" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "XYZ9Z99" })).toBeVisible();
  });
});
