/**
 * Visualização por perfil (operator / viewer) em conta fictícia.
 *   npx playwright test e2e/starter-roles-live.spec.js --config=playwright.live.config.js
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const API = process.env.SMOKE_API_URL || "http://localhost:3020/api";
const stamp = Date.now().toString(36);
const EVIDENCE = join(process.cwd(), "e2e-evidence", `roles-${stamp}`);
mkdirSync(EVIDENCE, { recursive: true });

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

test("operator e viewer veem telas corretas", async ({ page }) => {
  test.setTimeout(120_000);
  const adminEmail = `roles-admin-${stamp}@example.test`;
  const adminPass = `RolesAdmin-${stamp}Aa1`;
  const reg = await api("/auth/register", {
    method: "POST",
    body: {
      empresaNome: `Roles Demo ${stamp}`,
      nome: "Admin Roles",
      email: adminEmail,
      password: adminPass,
      acceptedLegal: true,
      lid: "starter",
    },
  });
  expect(reg.status).toBe(201);
  const adminToken = reg.json.data.token;

  // Libera 2º assento: só operator (viewer = troca de role)
  const opEmail = `roles-op-${stamp}@example.test`;
  const opPass = `RolesOp-${stamp}Aa1`;
  const op = await api("/users", {
    method: "POST",
    token: adminToken,
    body: {
      email: opEmail,
      nome: "Operador Roles",
      role: "operator",
      password: opPass,
    },
  });
  expect(op.status).toBe(201);
  const opId = op.json.data.id;

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(opEmail);
  await page.locator('input[name="password"]').fill(opPass);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL("/");
  await page.screenshot({ path: join(EVIDENCE, "01-operator-home.png"), fullPage: true });
  await page.goto("/usuarios");
  await expect(page.getByText(/acesso restrito|não permite/i).first()).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE, "02-operator-usuarios-bloqueado.png"), fullPage: true });

  await api(`/users/${opId}`, {
    method: "PATCH",
    token: adminToken,
    body: { role: "viewer" },
  });

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(opEmail);
  await page.locator('input[name="password"]').fill(opPass);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL("/");
  await page.goto("/manutencao-gastos");
  await expect(page.getByText(/somente leitura/i).first()).toBeVisible();
  await page.screenshot({
    path: join(EVIDENCE, "03-viewer-gastos-readonly.png"),
    fullPage: true,
  });
  console.log(`EVIDENCE_DIR=${EVIDENCE}`);
});
