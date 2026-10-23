/**
 * Jornada Starter ao vivo contra API+Vite locais (dados fictícios).
 * Não usa seedAuthSession mock — autentica de verdade.
 *
 *   cd frontend
 *   npx playwright test e2e/starter-live-journey.spec.js --config=playwright.live.config.js
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const stamp = Date.now().toString(36);
const EVIDENCE = join(process.cwd(), "e2e-evidence", `starter-${stamp}`);
mkdirSync(EVIDENCE, { recursive: true });

const admin = {
  empresa: `Demo Starter ${stamp}`,
  nome: "Admin Demo",
  email: `admin-demo-${stamp}@example.test`,
  password: `DemoPass-${stamp}Aa1`,
};

function mercosulPlaca() {
  const n = Date.now() % 100000;
  const digit = n % 10;
  const letters = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const letter = letters[(n >> 4) % letters.length];
  const tail = String(n % 100).padStart(2, "0");
  return `DEM${digit}${letter}${tail}`;
}

async function shot(page, name) {
  await page.screenshot({
    path: join(EVIDENCE, `${name}.png`),
    fullPage: true,
  });
}

test.describe.configure({ mode: "serial" });

test("jornada Starter: cadastro → operação → perfis", async ({ page }) => {
  test.setTimeout(180_000);
  const placa = mercosulPlaca();

  await page.goto("/register?lid=starter");
  await expect(page.getByLabel(/empresa/i).or(page.locator('input[name="empresaNome"]'))).toBeVisible();
  await page.locator('input[name="empresaNome"]').fill(admin.empresa);
  await page.locator('input[name="nome"]').fill(admin.nome);
  await page.locator('input[name="email"]').fill(admin.email);
  await page.locator('input[name="password"]').fill(admin.password);
  await page.locator('input[name="acceptedLegal"], input[type="checkbox"]').first().check();
  await shot(page, "01-register");
  const registerResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/register") &&
      res.request().method() === "POST",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: /criar conta e entrar/i }).click();
  const regRes = await registerResponse;
  expect(regRes.ok(), `register status ${regRes.status()}`).toBeTruthy();
  await page.waitForURL((url) => {
    const p = url.pathname;
    return p === "/" || p === "";
  }, { timeout: 30000 });
  await expect(
    page.getByText(/primeiros passos|frota|dashboard|caminh/i).first(),
  ).toBeVisible({ timeout: 20000 });
  await shot(page, "02-home-onboarding");

  // Veículo
  await page.goto("/cadastro-caminhao");
  await page.locator('input[name="placa"], input#placa').first().fill(placa);
  const qtd = page.locator('input[name="qtd_pneus"], input#qtd_pneus').first();
  if (await qtd.count()) await qtd.fill("6");
  const km = page.locator('input[name="km_atual"], input#km_atual').first();
  if (await km.count()) await km.fill("100000");
  await shot(page, "03-cadastro-veiculo");
  await page.getByRole("button", { name: /cadastrar veículo/i }).click();
  await page.waitForTimeout(2000);
  await shot(page, "04-apos-veiculo");

  // Motorista
  await page.goto("/motoristas");
  const addMotorista = page.getByRole("button", { name: /novo|adicionar|cadastrar/i }).first();
  if (await addMotorista.isVisible()) await addMotorista.click();
  await page.locator('input[name="nome"]').first().fill("Motorista Demo Ficticio");
  const cnh = page.locator('input[name="cnh"]').first();
  if (await cnh.count()) await cnh.fill("12345678901");
  await shot(page, "05-motorista");
  await page.getByRole("button", { name: /cadastrar motorista|salvar alterações/i }).click();
  await page.waitForTimeout(1500);
  await expect(
    page.getByText(/Motorista Demo Ficticio/i).locator("visible=true").first(),
  ).toBeVisible({ timeout: 15000 });

  // Gasto
  await page.goto("/manutencao-gastos");
  await page.waitForTimeout(1500);
  await shot(page, "06-gastos");
  const valor = page.locator('input[name="valor"]').first();
  await expect(valor).toBeVisible({ timeout: 15000 });
  await valor.fill("250.50");
  const desc = page.locator('input[name="descricao"], textarea[name="descricao"]').first();
  if (await desc.count()) await desc.fill("Abastecimento demo Starter");
  const kmReg = page.locator('input[name="km_registro"]').first();
  if (await kmReg.count()) await kmReg.fill("100200");
  await page.getByRole("button", { name: /cadastrar registro/i }).click();
  await page.waitForTimeout(2000);
  await shot(page, "07-gasto-lancado");

  // Documento via detalhe do veículo
  await page.goto(`/caminhao/${placa}`);
  await page.waitForTimeout(1000);
  const docsTab = page.getByRole("button", { name: /documentos/i }).or(page.getByText(/^Documentos$/i));
  if (await docsTab.first().isVisible()) await docsTab.first().click();
  await shot(page, "08-veiculo-documentos");

  // Relatórios
  await page.goto("/relatorios");
  await expect(page.getByText(/relat[oó]rios|custo/i).first()).toBeVisible();
  await page.getByRole("button", { name: /gerar relat[oó]rio/i }).click();
  await page.waitForTimeout(2000);
  await shot(page, "09-relatorio");

  // Usuários / perfis (admin)
  await page.goto("/usuarios");
  await expect(page.getByText(/equipe|usu[aá]rios/i).first()).toBeVisible();
  await shot(page, "10-usuarios-admin");

  // Criar operator (2º assento Starter) e validar texto sem “desenvolvimento”
  const pageText = await page.locator("body").innerText();
  expect(pageText.toLowerCase()).not.toContain("coolify");
  expect(pageText.toLowerCase()).not.toMatch(/útil em\s+desenvolvimento/);

  console.log(`EVIDENCE_DIR=${EVIDENCE}`);
  console.log(`ADMIN_EMAIL=${admin.email}`);
  console.log(`PLACA=${placa}`);
});
