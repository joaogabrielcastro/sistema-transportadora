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

test.describe("Painel e frota", () => {
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
            gastosValor: 1500,
            manutencoesValor: 0,
            frotaPorTipo: [{ tipo: "truck", count: 2 }],
            comMotorista: 2,
            semMotorista: 0,
          },
        }),
      });
    });

    await page.route("**/api/reports/cost-per-km-trend**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            months: [
              { month: "2026-08", totalCost: 800, costPerKm: 1.2 },
              { month: "2026-09", totalCost: 700, costPerKm: 1.1 },
            ],
          },
        }),
      });
    });

    await page.route(
      (url) =>
        url.pathname.includes("/api/reports/cost-per-km") &&
        !url.pathname.includes("trend"),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              items: [{ placa: "ABC1D23", totalCost: 1500 }],
              entries: [],
              stats: {
                grandTotal: 1500,
                totalKm: 0,
                avgCostPerKm: 0,
                truckCount: 1,
                entryCount: 0,
              },
            },
          }),
        });
      },
    );

    await page.route("**/api/ops/alerts**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            counts: { total: 2, critical: 1, high: 1, medium: 0 },
            alerts: [
              {
                id: "cnh-1",
                type: "cnh_expired",
                severity: "critical",
                title: "CNH vencida: João Silva",
                message: "Vencida há 3 dia(s)",
                entity: "motorista",
                href: "/motoristas",
              },
              {
                id: "doc-1",
                type: "doc_expiring",
                severity: "high",
                title: "Documento a vencer: CRLV.pdf",
                message: "Placa ABC1D23 · vence em 5 dia(s)",
                entity: "documento",
                href: "/caminhao/ABC1D23",
              },
            ],
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

  test("painel mostra indicadores, pendências e custos", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: /E2E/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Pendências da operação/ })).toBeVisible();
    await expect(page.getByText("CNH vencida: João Silva")).toBeVisible();
    await expect(page.getByText("Custo por km")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Custo mensal da operação" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Veículos que mais custam" })).toBeVisible();
    // A lista completa da frota fica em /frota (o painel só resume).
    await expect(page.getByRole("link", { name: /Veículos/ }).first()).toBeVisible();
  });

  test("pendência leva à tela de solução", async ({ page }) => {
    await page.route("**/api/motoristas**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) }),
    );
    await page.goto("/");
    await page.getByRole("link", { name: /CNH vencida: João Silva/ }).click();
    await expect(page).toHaveURL(/\/motoristas$/);
  });

  test("navbar mostra itens principais e esconde fiscal sem a feature", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Menu principal" });
    await expect(nav.getByRole("link", { name: /Painel/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Veículos" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Pneus" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Usuários" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Configurações" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Auditoria" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "CT-e" })).toHaveCount(0);
  });

  test("busca por placa filtra a lista de veículos", async ({ page }) => {
    await page.goto("/frota");
    const searchInput = page.getByPlaceholder("Buscar placa, motorista ou modelo…");
    const searchRequest = page.waitForRequest((req) =>
      req.url().includes("/api/caminhoes/search"),
    );
    await searchInput.fill("ABC1");
    await searchRequest;

    await expect(page.getByText(/1 resultado\(s\)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "ABC1D23" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "XYZ9Z99" })).toHaveCount(0);
  });

  test("limpar busca restaura lista completa", async ({ page }) => {
    await page.goto("/frota");
    const searchInput = page.getByPlaceholder("Buscar placa, motorista ou modelo…");
    await searchInput.fill("ABC1");
    await page.waitForRequest((req) => req.url().includes("/api/caminhoes/search"));
    await expect(page.getByRole("link", { name: "XYZ9Z99" })).toHaveCount(0);
    await searchInput.fill("");

    await expect(page.getByRole("link", { name: "XYZ9Z99" }).first()).toBeVisible();
  });

  test("preserva busca e filtro na URL", async ({ page }) => {
    await page.goto("/frota");
    await page.getByPlaceholder("Buscar placa, motorista ou modelo…").fill("ABC1");
    await page.waitForRequest((req) => req.url().includes("/api/caminhoes/search"));
    await page.getByRole("button", { name: "Trucks" }).click();

    await expect(page).toHaveURL(/busca=ABC1/);
    await expect(page).toHaveURL(/tipo=truck/);
  });

  test("links antigos do painel com busca abrem a lista de veículos", async ({ page }) => {
    await page.goto("/?busca=ABC1&tipo=truck");
    await expect(page).toHaveURL(/\/frota\?busca=ABC1&tipo=truck/);
  });

  test("busca rápida (Ctrl+K) encontra veículo e abre o detalhe", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Busca rápida" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Termo de busca" }).fill("ABC1");
    await expect(dialog.getByRole("option", { name: /ABC1D23/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/caminhao\/ABC1D23$/);
  });

  test("menu móvel abre e fecha sem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar menu" }).first().click();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
