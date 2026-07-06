import { test as base } from "@playwright/test";

const E2E_TOKEN = "e2e-test-token";
const E2E_USER = { id: 1, email: "e2e@example.com", role: "admin", nome: "E2E" };

export async function seedAuthSession(page) {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem("abrotto_auth_token", token);
      localStorage.setItem("abrotto_auth_user", JSON.stringify(user));
    },
    { token: E2E_TOKEN, user: E2E_USER },
  );
}

/** Testes que precisam de rotas protegidas com auth ligada no build. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await seedAuthSession(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
