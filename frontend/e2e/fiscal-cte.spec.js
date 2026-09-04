import { test, expect } from "./helpers/auth.js";

test.describe("Fiscal CT-e", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        const raw = localStorage.getItem("atrack_auth_user");
        if (!raw) return;
        const user = JSON.parse(raw);
        user.features = { ...(user.features || {}), transporte_fiscal: true };
        localStorage.setItem("atrack_auth_user", JSON.stringify(user));
      } catch {
        /* ignore */
      }
    });

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            email: "e2e@example.com",
            role: "admin",
            tenantId: 1,
            billingExempt: true,
            hasBillingAccess: true,
            subscriptionStatus: "exempt",
            permissions: [],
            features: {
              ordem_coleta: true,
              notas_estoque: true,
              transporte_fiscal: true,
            },
          },
        }),
      });
    });

    await page.route("**/api/fiscal/cte**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
    await page.route("**/api/fiscal/empresas**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              razao_social: "Transportes E2E",
              cnpj: "12345678000199",
              crt: 1,
              ativo: true,
              cte_mdfe_provider_token_set: true,
              certificado_senha_set: true,
            },
          ],
        }),
      });
    });
    await page.route("**/api/fiscal/clientes**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
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
  });

  test("tela de CT-e abre com rascunho e emissão", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/fiscal/cte");
    await expect(
      page.getByRole("heading", {
        name: "CT-e — Conhecimento de Transporte",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar rascunho" })).toBeVisible();
    await expect(page.getByRole("button", { name: "1. Operação" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  });
});
