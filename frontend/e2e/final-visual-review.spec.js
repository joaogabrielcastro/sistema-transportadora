import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("artifacts/visual-review");
const user = {
  id: 1, email: "admin@teste.local", nome: "Administrador Teste", role: "admin",
  tenantId: 1, tenantName: "Transportadora Horizonte", billingExempt: true,
  hasBillingAccess: true, plan: "complete", subscriptionStatus: "exempt",
  permissions: [],
  features: { ordem_coleta: true, notas_estoque: true, transporte_fiscal: true },
};
const trucks = [
  { id: 1, placa: "ABC1D23", marca: "Volvo", modelo: "FH 540", motorista: "João Silva", km_atual: 125430, qtd_pneus: 10, tipo_veiculo: "truck" },
  { id: 2, placa: "DEF4G56", marca: "Scania", modelo: "R 450", motorista: "Maria Souza", km_atual: 89320, qtd_pneus: 10, tipo_veiculo: "cavalo" },
];

async function mockApp(page) {
  await page.addInitScript(({ authUser }) => {
    localStorage.setItem("atrack_auth_token", "visual-review-token");
    localStorage.setItem("atrack_auth_user", JSON.stringify(authUser));
  }, { authUser: user });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    let data = [];
    let extra = {};
    if (pathname.endsWith("/auth/me")) data = user;
    else if (pathname.endsWith("/reports/overview")) data = { totalCaminhoes: 2, totalGastos: 8, totalManutencoes: 3, gastosValor: 12450.8, manutencoesValor: 4870, frotaPorTipo: [{ tipo: "truck", count: 1 }, { tipo: "cavalo", count: 1 }], comMotorista: 2, semMotorista: 0 };
    else if (pathname.endsWith("/reports/cost-per-km-trend")) data = { months: [{ month: "2026-08", totalCost: 7200, costPerKm: 1.42 }, { month: "2026-09", totalCost: 10120, costPerKm: 1.58 }] };
    else if (pathname.endsWith("/reports/cost-per-km")) data = { items: [{ placa: "ABC1D23", totalCost: 10200, kmDriven: 6500, costPerKm: 1.57 }], entries: [], stats: { grandTotal: 10200, totalKm: 6500, avgCostPerKm: 1.57, truckCount: 1, entryCount: 0 } };
    else if (pathname.endsWith("/ops/alerts")) data = { counts: { total: 2, critical: 1, high: 1, medium: 0 }, alerts: [{ id: "a1", severity: "critical", title: "CNH próxima do vencimento", message: "A CNH de João Silva vence em 5 dias.", href: "/motoristas" }, { id: "a2", severity: "high", title: "Manutenção programada", message: "O veículo ABC1D23 atingiu a quilometragem prevista.", href: "/manutencao" }] };
    else if (pathname.endsWith("/ops/documentos")) data = { summary: { total: 2, vencidos: 1, criticos: 0, atencao: 1 }, items: [{ id: 1, placa: "ABC1D23", nome_original: "CRLV 2026.pdf", tipo_documento: "CRLV", validade_em: "2026-09-20", status: "vencido" }, { id: 2, placa: "DEF4G56", nome_original: "Seguro.pdf", tipo_documento: "Seguro", validade_em: "2026-10-20", status: "atencao" }] };
    else if (pathname.endsWith("/motoristas")) data = [{ id: 1, nome: "João Silva", cnh: "12345678901", cnh_categoria: "E", cnh_validade: "2027-02-10", _count: { caminhoes: 1 } }, { id: 2, nome: "Maria Souza", cnh: "98765432100", cnh_categoria: "E", cnh_validade: "2028-04-18", _count: { caminhoes: 1 } }];
    else if (/\/caminhoes\/ABC1D23$/.test(pathname)) data = trucks[0];
    else if (pathname.endsWith("/caminhoes") || pathname.includes("/caminhoes/search")) { data = trucks; extra.pagination = { currentPage: 1, totalPages: 1, totalItems: 2, itemsPerPage: 20 }; }
    else if (pathname.includes("/pneus")) { data = []; extra.pagination = { currentPage: 1, totalPages: 1, totalItems: 0 }; }
    else if (pathname.includes("/users")) data = [{ ...user, ativo: true }];
    else if (pathname.includes("/fiscal/empresas")) data = [{ id: 1, cnpj: "12345678000190", razao_social: "Transportadora Horizonte Ltda", crt: 3, ativo: true, cte_mdfe_provider_token_set: true, brasil_nfe_user_token_set: true, certificado_senha_set: true }];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data, ...extra }) });
  });
}

async function capture(page, name) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name} não deve ter rolagem horizontal`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
}

test("revisão visual representativa em desktop e celular", async ({ browser }) => {
  await mkdir(outputDir, { recursive: true });
  const screens = [
    ["dashboard", "/"], ["veiculo", "/caminhao/ABC1D23"], ["motoristas", "/motoristas"],
    ["documentos", "/documentos"], ["pneus", "/pneus"], ["manutencao", "/manutencao-gastos"],
    ["relatorios", "/relatorios"], ["fiscal", "/fiscal/cte?aba=documentos"], ["administracao", "/usuarios"],
  ];
  for (const viewport of [{ label: "desktop", width: 1440, height: 900 }, { label: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await mockApp(page);
    for (const [name, url] of screens) {
      await page.goto(url);
      await capture(page, `${viewport.label}-${name}`);
    }
    await context.close();
  }
});

test("revisão visual pública e login", async ({ browser }) => {
  await mkdir(outputDir, { recursive: true });
  for (const viewport of [{ label: "desktop", width: 1440, height: 900 }, { label: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.route("**/api/public/plans**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { plans: [] } }) }));
    const publicScreens = [
      ["landing", "/"], ["login", "/login"], ["cadastro", "/register"],
      ["recuperar-senha", "/forgot-password"], ["planos", "/planos"],
      ["termos", "/termos"], ["privacidade", "/privacidade"],
    ];
    for (const [name, path] of publicScreens) {
      await page.goto(path);
      await capture(page, `${viewport.label}-${name}`);
    }
    await context.close();
  }
});
