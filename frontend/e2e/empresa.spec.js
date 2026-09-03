import { test, expect } from "./helpers/auth.js";

const tenantPayload = {
  nome: "Frota Sul",
  slug: "frota-sul",
  criadoEm: "2026-01-15T00:00:00.000Z",
  alertEmail: "avisos@frota.test",
  whatsappNotifyPhone: "5548999999999",
  weeklyDigestEnabled: true,
  plan: "starter",
  subscriptionStatus: "trialing",
  billingExempt: false,
  trialEndsAt: "2026-09-16T00:00:00.000Z",
  ativo: true,
  canClose: true,
  quota: {
    unlimited: false,
    plan: "starter",
    vehicles: { used: 2, limit: 15 },
    users: { used: 1, limit: 3, pendingInvites: 0 },
  },
};

test.describe("Empresa", () => {
  test("admin vê dados, cota e só encerra após digitar o nome", async ({
    page,
  }) => {
    await page.route("**/api/tenant/close", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { closed: true, stripeCanceled: false },
        }),
      });
    });

    await page.route("**/api/tenant", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: tenantPayload }),
        });
        return;
      }
      if (method === "PATCH") {
        const body = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { ...tenantPayload, ...body, nome: body.nome || tenantPayload.nome },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/empresa");
    await expect(
      page.getByRole("heading", { name: "Empresa", exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("frota-sul")).toBeVisible();
    await expect(page.getByText("2/15")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /ver planos e pagamento/i }),
    ).toBeVisible();

    const closeButton = page.getByRole("button", { name: /encerrar empresa/i });
    await expect(closeButton).toBeDisabled();

    await page.getByLabel(/digite "frota sul" para confirmar/i).fill("Frota Sul");
    await expect(closeButton).toBeEnabled();

    await closeButton.click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText(/empresa encerrada/i),
    ).toBeVisible();
  });

  test("conta isenta não mostra encerrar", async ({ page }) => {
    await page.route("**/api/tenant", async (route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            ...tenantPayload,
            billingExempt: true,
            canClose: false,
            quota: { unlimited: true, plan: "ops" },
          },
        }),
      });
    });

    await page.goto("/empresa");
    await expect(
      page.getByText(/isentas não são encerradas/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /encerrar empresa/i }),
    ).toHaveCount(0);
  });
});
