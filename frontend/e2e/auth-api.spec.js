import { test, expect } from "@playwright/test";

test.describe("Auth JWT", () => {
  test("rota protegida redireciona para /login quando não autenticado", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("após login, requisições à API incluem Bearer JWT", async ({ page }) => {
    const fakeToken = "e2e-jwt-token";

    await page.route("**/api/**", async (route) => {
      const url = route.request().url();

      if (url.includes("/auth/login")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              token: fakeToken,
              user: { id: 1, email: "test@example.com", role: "admin" },
            },
          }),
        });
        return;
      }

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

    await page.goto("/login");
    await page.getByLabel("E-mail").fill("test@example.com");
    await page.getByLabel("Senha").fill("senha-segura");

    const apiRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/api/") && !req.url().includes("/auth/login"),
    );

    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL("/");

    const req = await apiRequest;
    expect(req.headers()["authorization"]).toBe(`Bearer ${fakeToken}`);
  });
});
