import { test, expect } from "./helpers/auth.js";

test.describe("Empresa fiscal", () => {
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

    await page.route("**/api/fiscal/empresas**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  test("tela de empresa fiscal abre o cadastro Brasil NFe", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/fiscal/empresas");
    await expect(
      page.getByRole("heading", {
        name: "Empresa fiscal — Brasil NFe",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cadastrar empresa" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Certificado digital A1" }),
    ).toBeVisible();
  });
});
