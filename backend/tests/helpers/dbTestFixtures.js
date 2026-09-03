import assert from "node:assert/strict";
import request from "supertest";
import prisma from "../../src/lib/prisma.js";
import { hashPassword } from "../../src/utils/password.js";
import { ensureSeedTenant } from "../../src/utils/tenant.js";

const POSICAO_A = "Teste Integração - Dianteiro Esq";
const POSICAO_B = "Teste Integração - Dianteiro Dir";
const STATUS_EM_USO = "Teste Integração - Em Uso";
const TIPO_GASTO = "Teste Integração - Combustível";
const ITEM_CHECKLIST = "Teste Integração - Óleo";
const TEST_OPERATOR_EMAIL = "test-operator@abbroto.local";
const TEST_OPERATOR_PASSWORD = "TestOperator123456!";

export async function ensureTestAdmin() {
  const tenant = await ensureSeedTenant();
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD devem estar definidos nos testes");
  }

  const password_hash = await hashPassword(password);
  await prisma.users.upsert({
    where: { email },
    update: {
      password_hash,
      role: "admin",
      ativo: true,
      tenant_id: tenant.id,
    },
    create: {
      tenant_id: tenant.id,
      email,
      nome: "Admin Testes",
      role: "admin",
      password_hash,
      ativo: true,
    },
  });

  return tenant;
}

export async function loginAsAdmin(app) {
  const tenant = await ensureTestAdmin();

  const res = await request(app).post("/api/auth/login").send({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });

  assert.equal(res.status, 200, res.body?.error || "login failed");
  assert.ok(res.body.data?.token, "token ausente na resposta de login");
  assert.equal(res.body.data.user.tenantId, tenant.id);

  return {
    token: res.body.data.token,
    user: res.body.data.user,
    tenantId: tenant.id,
    authHeader: { Authorization: `Bearer ${res.body.data.token}` },
  };
}

export async function ensureTestOperator() {
  const tenant = await ensureSeedTenant();
  const password_hash = await hashPassword(TEST_OPERATOR_PASSWORD);
  await prisma.users.upsert({
    where: { email: TEST_OPERATOR_EMAIL },
    update: {
      password_hash,
      role: "operator",
      ativo: true,
      tenant_id: tenant.id,
    },
    create: {
      tenant_id: tenant.id,
      email: TEST_OPERATOR_EMAIL,
      nome: "Operador Testes",
      role: "operator",
      password_hash,
      ativo: true,
    },
  });
  return tenant;
}

export async function loginAsOperator(app) {
  await ensureTestOperator();

  const res = await request(app).post("/api/auth/login").send({
    email: TEST_OPERATOR_EMAIL,
    password: TEST_OPERATOR_PASSWORD,
  });

  assert.equal(res.status, 200, res.body?.error || "login operador failed");
  assert.ok(res.body.data?.token);

  return {
    token: res.body.data.token,
    user: res.body.data.user,
    tenantId: res.body.data.user.tenantId,
    authHeader: { Authorization: `Bearer ${res.body.data.token}` },
  };
}

/**
 * Cria um segundo tenant + admin para testes de isolamento.
 */
export async function createSecondaryTenantAdmin({
  slug = `tenant-${Date.now().toString(36)}`,
  email = `admin-${Date.now().toString(36)}@tenant-b.local`,
  password = "TenantBAdmin123!",
  nome = "Tenant B",
  features = { ordem_coleta: true, notas_estoque: false },
  billingExempt = true,
  plan = null,
  subscriptionStatus,
  trialEndsAt,
} = {}) {
  const password_hash = await hashPassword(password);
  const billed = billingExempt === false;
  const tenant = await prisma.tenants.create({
    data: {
      nome,
      slug,
      ativo: true,
      features,
      billing_exempt: billingExempt,
      plan: plan ?? (billed ? "starter" : null),
      subscription_status:
        subscriptionStatus ?? (billed ? "trialing" : "active"),
      trial_ends_at: billed
        ? trialEndsAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        : trialEndsAt ?? null,
    },
  });

  await prisma.users.create({
    data: {
      tenant_id: tenant.id,
      email: email.toLowerCase(),
      nome: "Admin Tenant B",
      role: "admin",
      password_hash,
      ativo: true,
    },
  });

  return { tenant, email: email.toLowerCase(), password };
}

export async function loginWithCredentials(app, email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  assert.equal(res.status, 200, res.body?.error || "login failed");
  return {
    token: res.body.data.token,
    user: res.body.data.user,
    tenantId: res.body.data.user.tenantId,
    authHeader: { Authorization: `Bearer ${res.body.data.token}` },
  };
}

export async function cleanupOrdemEnvios(ids = []) {
  for (const id of ids) {
    await prisma.ordens_coleta_envio.delete({ where: { id } }).catch(() => {});
  }
}

export async function createFailedOrdemEnvio(overrides = {}) {
  const tenant = await ensureSeedTenant();
  return prisma.ordens_coleta_envio.create({
    data: {
      tenant_id: tenant.id,
      tipo: "PADRAO",
      email_destinatario: "falha@test.local",
      dados: { status: "failed" },
      erro_envio: "Falha SMTP simulada",
      ...overrides,
    },
  });
}

export async function ensurePneuLookups() {
  const [posA, posB, status] = await Promise.all([
    prisma.posicoes_pneus.upsert({
      where: { nome_posicao: POSICAO_A },
      update: {},
      create: { nome_posicao: POSICAO_A },
    }),
    prisma.posicoes_pneus.upsert({
      where: { nome_posicao: POSICAO_B },
      update: {},
      create: { nome_posicao: POSICAO_B },
    }),
    prisma.status_pneus.upsert({
      where: { nome_status: STATUS_EM_USO },
      update: {},
      create: { nome_status: STATUS_EM_USO },
    }),
  ]);

  return {
    posicaoAId: posA.id,
    posicaoBId: posB.id,
    statusId: status.id,
  };
}

export async function ensureRegistroLookups() {
  const [tipoGasto, itemChecklist] = await Promise.all([
    prisma.tipos_gastos.upsert({
      where: { nome_tipo: TIPO_GASTO },
      update: {},
      create: { nome_tipo: TIPO_GASTO },
    }),
    prisma.itens_checklist.upsert({
      where: { nome_item: ITEM_CHECKLIST },
      update: {},
      create: { nome_item: ITEM_CHECKLIST },
    }),
  ]);

  return { tipoGastoId: tipoGasto.id, itemChecklistId: itemChecklist.id };
}

/** Gera placa válida (Mercosul) para testes — 7 caracteres. */
export function testPlaca(prefix = "TST") {
  const p = String(prefix)
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .padEnd(3, "X")
    .slice(0, 3);
  const seed = Date.now() % 100000;
  const digit = seed % 10;
  const letters = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const letter = letters[(seed >> 4) % letters.length];
  const tail = String(seed % 100).padStart(2, "0");
  return `${p}${digit}${letter}${tail}`;
}

export async function createCaminhaoViaApi(app, authHeader, overrides = {}) {
  const placa = overrides.placa || testPlaca();
  const res = await request(app)
    .post("/api/caminhoes")
    .set(authHeader)
    .send({
      placa,
      qtd_pneus: 6,
      km_atual: 50000,
      ...overrides,
    });

  assert.equal(res.status, 201, res.body?.error || "criar caminhão falhou");
  return { ...res.body.data, placa };
}

export async function cleanupCaminhao(caminhaoId) {
  if (!caminhaoId) return;
  await prisma.estoque_movimentos
    .deleteMany({ where: { caminhao_id: caminhaoId } })
    .catch(() => {});
  await prisma.vinculos_composicao
    .deleteMany({
      where: { OR: [{ cavalo_id: caminhaoId }, { carreta_id: caminhaoId }] },
    })
    .catch(() => {});
  await prisma.pneus.deleteMany({ where: { caminhao_id: caminhaoId } });
  await prisma.gastos.deleteMany({ where: { caminhao_id: caminhaoId } });
  await prisma.checklist.deleteMany({ where: { caminhao_id: caminhaoId } });
  await prisma.ordens_coleta_envio
    .deleteMany({ where: { caminhao_id: caminhaoId } })
    .catch(() => {});
  await prisma.caminhao_documentos
    .deleteMany({ where: { caminhao_id: caminhaoId } })
    .catch(() => {});
  await prisma.caminhoes.delete({ where: { id: caminhaoId } }).catch(() => {});
}

export async function cleanupTenant(tenantId) {
  if (!tenantId) return;
  await prisma.audit_logs.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.auth_tokens.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.estoque_movimentos.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.nota_itens
    .deleteMany({
      where: { notas_fiscais: { tenant_id: tenantId } },
    })
    .catch(() => {});
  await prisma.notas_fiscais.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.produtos.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.vinculos_composicao.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.gastos.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.checklist.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.pneus.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.ordens_coleta_envio.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.caminhao_documentos.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.caminhoes.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.motoristas.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.users.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.tenants.delete({ where: { id: tenantId } }).catch(() => {});
}

/** Preenche N veículos direto no banco (para bater teto de plano sem 15 POSTs). */
export async function seedCaminhoes(tenantId, count) {
  if (count <= 0) return [];
  const data = Array.from({ length: count }, (_, i) => ({
    tenant_id: Number(tenantId),
    placa: `Q${String(i).padStart(3, "0")}A${String(i % 100).padStart(2, "0")}`,
    qtd_pneus: 6,
    km_atual: 1000,
    tipo_veiculo: "truck",
  }));
  await prisma.caminhoes.createMany({ data });
  return data.map((row) => row.placa);
}

export async function cleanupStockPneus(ids = []) {
  for (const id of ids) {
    await prisma.pneus.delete({ where: { id } }).catch(() => {});
  }
}
