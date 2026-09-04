import { test, expect } from "./helpers/auth.js";

test.describe("Contrato de frete (CIOT)", () => {
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

    await page.route("**/api/fiscal/ciot**", async (route) => {
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
              rntrc: "123456789",
              ativo: true,
              certificado_senha_set: true,
            },
          ],
        }),
      });
    });
    await page.route("**/api/fiscal/mdfe**", async (route) => {
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
    await page.route("**/api/motoristas**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  test("tela de contrato de frete abre com a feature fiscal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/fiscal/ciot");
    await expect(
      page.getByRole("heading", { name: "CIOT — Contrato de frete", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Contrato de frete" })).toBeVisible();
    await expect(page.getByRole("button", { name: "1. Operação" })).toBeVisible();
    await expect(page.getByRole("button", { name: "2. Contrato" })).toBeVisible();
    await expect(page.getByRole("button", { name: "3. Viagem e carga" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "4. Frota e pagamento" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  });
});
