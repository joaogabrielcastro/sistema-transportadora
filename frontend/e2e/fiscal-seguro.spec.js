import { test, expect } from "./helpers/auth.js";

test.describe("Fiscal seguro / averbação", () => {
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

    await page.route("**/api/fiscal/seguro/config**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            provider: "atm",
            ambiente: "homologacao",
            automatico: false,
            ativo: false,
            usuario_set: false,
            senha_set: true,
            status_integracao: "inactive",
          },
        }),
      });
    });
  });

  test("tela de seguro abre em homologação sem expor senha", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/fiscal/seguro");
    await expect(
      page.getByRole("heading", { name: "Seguro / Averbação", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Homologação")).toBeVisible();
    await expect(page.getByRole("button", { name: "Testar conexão" })).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    const senha = await page.locator("input[type='password']").inputValue();
    expect(senha).toBe("");
  });
});
