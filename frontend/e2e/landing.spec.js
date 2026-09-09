import { test, expect } from "@playwright/test";

test.describe("Site comercial", () => {
  test("home pública explica o produto e preserva LID no CTA", async ({
    page,
  }) => {
    await page.route("**/api/billing/plans**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            trialDays: 14,
            plans: [
              {
                id: "starter",
                lid: "starter",
                name: "Starter",
                tagline: "Organize a frota",
                description: "Essencial",
                priceMonthlyBrl: 199,
                priceLabel: "R$ 199",
                highlights: ["Até 8 veículos"],
                trialEligible: true,
              },
              {
                id: "fiscal",
                lid: "fiscal",
                name: "Fiscal",
                tagline: "NF-e e estoque",
                description: "NF-e",
                priceMonthlyBrl: 499,
                priceLabel: "R$ 499",
                highlights: ["Até 40 veículos"],
                popular: true,
              },
              {
                id: "complete",
                lid: "complete",
                name: "Completo",
                tagline: "Operação full",
                description: "Pacote premium",
                priceMonthlyBrl: 699,
                priceLabel: "R$ 699",
                highlights: ["Até 100 veículos"],
                bestValue: true,
              },
            ],
          },
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /mais controle/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Começar agora" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navegação comercial" }).getByRole("link", { name: "Planos" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Navegação comercial" })
      .getByRole("link", { name: "Planos" })
      .click();
    await expect(page).toHaveURL(/\/planos/);
    await expect(page.getByRole("heading", { name: /escolha o plano/i })).toBeVisible();

    await page.locator("article").filter({ hasText: "Fiscal" }).getByRole("link", { name: "Começar agora" }).click();
    await expect(page).toHaveURL(/lid=fiscal/);
  });

  test("LID inválido em /planos não quebra a página", async ({ page }) => {
    await page.goto("/planos/profissional");
    await expect(page.getByText(/não está disponível/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /escolha o plano/i })).toBeVisible();
  });

  test("planos empilham no mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/planos");
    await expect(page.getByRole("heading", { name: /starter/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Começar agora" }).first()).toBeVisible();
  });
});
