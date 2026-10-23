/**
 * Smoke da jornada Starter com duas empresas fictícias isoladas.
 * Uso (API já no ar em localhost:3020):
 *   node scripts/starter-journey-smoke.mjs
 *
 * Não envia e-mail real, não usa Stripe live, não toca em produção.
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import prisma from "../src/lib/prisma.js";
import { cleanupTenant } from "../tests/helpers/dbTestFixtures.js";

const API = process.env.SMOKE_API_URL || "http://127.0.0.1:3020/api";
const stamp = Date.now().toString(36);
const results = [];

function log(step, ok, detail = "") {
  const line = `${ok ? "OK  " : "FAIL"} | ${step}${detail ? ` — ${detail}` : ""}`;
  results.push({ step, ok, detail });
  console.log(line);
}

async function api(path, { method = "GET", token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function errDetail(json) {
  if (!json) return "";
  const parts = [json.error, ...(json.details || [])].filter(Boolean);
  return parts.join("; ");
}

/** Placa Mercosul válida (AAA1A11). */
function smokePlaca() {
  const n = Date.now() % 100000;
  const digit = n % 10;
  const letters = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const letter = letters[(n >> 4) % letters.length];
  const tail = String(n % 100).padStart(2, "0");
  return `SMK${digit}${letter}${tail}`;
}

async function registerCompany(label) {
  const email = `smoke-${label}-${stamp}@example.test`;
  const password = `SmokePass-${stamp}!`;
  const res = await api("/auth/register", {
    method: "POST",
    body: {
      empresaNome: `Transportadora Smoke ${label} ${stamp}`,
      nome: `Admin ${label}`,
      email,
      password,
      acceptedLegal: true,
      lid: "starter",
    },
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `register ${label}: ${res.status} ${res.json?.error || JSON.stringify(res.json)}`,
    );
  }
  return {
    email,
    password,
    token: res.json.data.token,
    user: res.json.data.user,
    tenantId: res.json.data.user.tenantId,
  };
}

async function main() {
  let a;
  let b;
  try {
    a = await registerCompany("A");
    log(
      "Cadastro empresa A + trial Starter",
      a.user.plan === "starter" &&
        a.user.subscriptionStatus === "trialing" &&
        a.user.hasBillingAccess === true,
      `plan=${a.user.plan} status=${a.user.subscriptionStatus} trialEnds=${a.user.trialEndsAt}`,
    );

    b = await registerCompany("B");
    log("Cadastro empresa B isolada", Boolean(b.tenantId && b.tenantId !== a.tenantId));

    const settings = await api("/tenant", {
      method: "PATCH",
      token: a.token,
      body: {
        nome: `Smoke A Config ${stamp}`,
        alertEmail: `alertas-a-${stamp}@example.test`,
      },
    });
    log(
      "Configuração da empresa A",
      settings.status === 200,
      settings.json?.error || settings.json?.data?.nome,
    );

    const opEmail = `op-a-${stamp}@example.test`;
    const opPass = `OpPass-${stamp}!`;
    const opCreate = await api("/users", {
      method: "POST",
      token: a.token,
      body: {
        email: opEmail,
        nome: "Operador Smoke",
        role: "operator",
        password: opPass,
      },
    });
    log(
      "Criar usuário operator (senha temporária / sem SMTP)",
      opCreate.status === 201,
      opCreate.json?.error,
    );
    const operatorId = opCreate.json?.data?.id;

    // Starter: máx. 2 usuários (admin + operator). Terceiro deve falhar.
    const third = await api("/users", {
      method: "POST",
      token: a.token,
      body: {
        email: `third-a-${stamp}@example.test`,
        nome: "Excede Cota",
        role: "viewer",
        password: `ThirdPass-${stamp}!`,
      },
    });
    log(
      "Limite Starter de usuários bloqueia 3º assento",
      third.status === 403,
      `status=${third.status} ${third.json?.error || ""}`,
    );

    const inviteAttempt = await api("/users/invite", {
      method: "POST",
      token: a.token,
      body: {
        email: `invite-a-${stamp}@example.test`,
        nome: "Convidado",
        role: "operator",
      },
    });
    // Sem assento livre: 403 por cota; sem SMTP com assento: 503.
    log(
      "Convite por e-mail (cota e/ou SMTP)",
      inviteAttempt.status === 201 ||
        inviteAttempt.status === 503 ||
        inviteAttempt.status === 403,
      `status=${inviteAttempt.status} ${inviteAttempt.json?.error || "ok"}`,
    );

    const onboarding1 = await api("/ops/onboarding", { token: a.token });
    const docStep = (onboarding1.json?.data?.steps || []).find((s) => s.id === "doc");
    log(
      "Onboarding: passo documento aponta para cadastro sem frota",
      docStep?.href === "/cadastro-caminhao",
      docStep?.href,
    );

    const placa = smokePlaca();
    const truck = await api("/caminhoes", {
      method: "POST",
      token: a.token,
      body: { placa, qtd_pneus: 6, km_atual: 100000, tipo_veiculo: "truck" },
    });
    log(
      "Cadastro de veículo",
      truck.status === 201,
      errDetail(truck.json) || placa,
    );
    const caminhaoId = truck.json?.data?.id;

    const onboarding2 = await api("/ops/onboarding", { token: a.token });
    const docStep2 = (onboarding2.json?.data?.steps || []).find((s) => s.id === "doc");
    log(
      "Onboarding: passo documento aponta para /documentos com frota",
      docStep2?.href === "/documentos",
      docStep2?.href,
    );

    const motorista = await api("/motoristas", {
      method: "POST",
      token: a.token,
      body: {
        nome: "Motorista Ficticio Smoke",
        cnh: "12345678900",
        cnh_categoria: "E",
        cnh_validade: "2027-12-31",
      },
    });
    log("Cadastro de motorista", motorista.status === 201, motorista.json?.error);

    const tipos = await api("/tipos-gastos", { token: a.token });
    const tipoList = Array.isArray(tipos.json?.data)
      ? tipos.json.data
      : tipos.json?.data?.items || [];
    const tipoId = tipoList[0]?.id;
    const gasto = await api("/gastos", {
      method: "POST",
      token: a.token,
      body: {
        caminhao_id: caminhaoId,
        tipo_gasto_id: tipoId,
        data_gasto: new Date().toISOString().slice(0, 10),
        valor: 350.25,
        descricao: "Abastecimento smoke Starter",
        km_registro: 100250,
      },
    });
    log(
      "Lançamento de gasto",
      gasto.status === 201,
      errDetail(gasto.json) || `tipo=${tipoId}`,
    );

    const pdfPath = join(tmpdir(), `smoke-doc-${stamp}.pdf`);
    writeFileSync(
      pdfPath,
      Buffer.from(
        "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
        "utf8",
      ),
    );
    const form = new FormData();
    const blob = new Blob([readFileSync(pdfPath)], { type: "application/pdf" });
    form.append("arquivos", blob, "crlv-smoke.pdf");
    form.append("tipo_documento", "CRLV");
    form.append("validade_em", "2027-06-30");
    const docRes = await api(`/caminhoes/${placa}/documentos`, {
      method: "POST",
      token: a.token,
      formData: form,
    });
    unlinkSync(pdfPath);
    log(
      "Anexo de documento com validade",
      docRes.status === 201 || docRes.status === 200,
      errDetail(docRes.json),
    );

    const report = await api(
      `/reports/cost-per-km?startDate=${new Date(Date.now() - 86400000 * 40).toISOString().slice(0, 10)}&endDate=${new Date().toISOString().slice(0, 10)}`,
      { token: a.token },
    );
    log(
      "Relatório custo/km",
      report.status === 200,
      report.json?.error || `rows=${(report.json?.data || []).length}`,
    );

    const opLogin = await api("/auth/login", {
      method: "POST",
      body: { email: opEmail, password: opPass },
    });
    const opToken = opLogin.json?.data?.token;
    const opCaminhoes = await api("/caminhoes", { token: opToken });
    const opUsers = await api("/users", { token: opToken });
    log(
      "Operator: lê frota e não gerencia usuários",
      opCaminhoes.status === 200 && opUsers.status === 403,
      `frota=${opCaminhoes.status} users=${opUsers.status}`,
    );

    const roleToViewer = await api(`/users/${operatorId}`, {
      method: "PATCH",
      token: a.token,
      body: { role: "viewer" },
    });
    log(
      "Admin altera operator → viewer",
      roleToViewer.status === 200,
      roleToViewer.json?.error,
    );
    const viewLogin = await api("/auth/login", {
      method: "POST",
      body: { email: opEmail, password: opPass },
    });
    const viewToken = viewLogin.json?.data?.token;
    const viewWrite = await api("/gastos", {
      method: "POST",
      token: viewToken,
      body: {
        caminhao_id: caminhaoId,
        tipo_gasto_id: tipoId,
        data_gasto: new Date().toISOString().slice(0, 10),
        valor: 10,
        descricao: "viewer não deve gravar",
      },
    });
    log(
      "Viewer: bloqueado ao gravar gasto",
      viewWrite.status === 403,
      `status=${viewWrite.status}`,
    );

    const leak = await api(`/caminhoes/${placa}`, { token: b.token });
    log(
      "Isolamento: empresa B não vê veículo de A",
      leak.status === 404 || leak.status === 403 || leak.json?.data == null,
      `status=${leak.status}`,
    );

    const listB = await api("/caminhoes", { token: b.token });
    const placasB = (listB.json?.data || []).map((c) => c.placa);
    log(
      "Isolamento: lista B sem placa de A",
      !placasB.includes(placa),
      `countB=${placasB.length}`,
    );

    // Sessão após troca de senha
    const change = await api("/auth/change-password", {
      method: "POST",
      token: a.token,
      body: {
        currentPassword: a.password,
        newPassword: `${a.password}-new`,
      },
    });
    const meOld = await api("/auth/me", { token: a.token });
    log(
      "Troca de senha invalida sessão anterior",
      change.status === 200 && meOld.status === 401,
      `change=${change.status} me=${meOld.status}`,
    );
    const loginAgain = await api("/auth/login", {
      method: "POST",
      body: { email: a.email, password: `${a.password}-new` },
    });
    a.token = loginAgain.json?.data?.token;
    a.password = `${a.password}-new`;
    log("Login com nova senha", Boolean(a.token));

    const me = await api("/auth/me", { token: a.token });
    const quota = me.json?.data?.quota;
    log(
      "Quota Starter no perfil (8 veículos / 2 usuários)",
      quota?.vehicles?.limit === 8 && quota?.users?.limit === 2,
      JSON.stringify(quota),
    );

    // Trial expirado (simulado no banco local isolado)
    await prisma.tenants.update({
      where: { id: a.tenantId },
      data: {
        trial_ends_at: new Date(Date.now() - 86400000),
        subscription_status: "trialing",
      },
    });
    const blocked = await api("/caminhoes", { token: a.token });
    log(
      "Trial expirado bloqueia operação (402)",
      blocked.status === 402,
      `status=${blocked.status}`,
    );
    // Restaura trial para cleanup útil
    await prisma.tenants.update({
      where: { id: a.tenantId },
      data: {
        trial_ends_at: new Date(Date.now() + 86400000 * 10),
        subscription_status: "trialing",
      },
    });

    const billingStatus = await api("/billing/status", { token: a.token });
    log(
      "Billing status (Stripe test depende de env)",
      billingStatus.status === 200,
      JSON.stringify({
        plan: billingStatus.json?.data?.plan,
        status: billingStatus.json?.data?.subscriptionStatus,
        stripeConfigured: billingStatus.json?.data?.stripeConfigured,
      }),
    );

    const checkout = await api("/billing/checkout-session", {
      method: "POST",
      token: a.token,
      body: { lid: "starter" },
    });
    log(
      "Checkout Stripe teste",
      checkout.status === 200 || checkout.status === 503,
      `status=${checkout.status} ${checkout.json?.error || checkout.json?.data?.url || ""}`.slice(
        0,
        120,
      ),
    );
  } catch (err) {
    log("Jornada interrompida", false, err.message);
    console.error(err);
  } finally {
    if (a?.tenantId) {
      await cleanupTenant(a.tenantId).catch((e) =>
        console.warn("cleanup A:", e.message),
      );
    }
    if (b?.tenantId) {
      await cleanupTenant(b.tenantId).catch((e) =>
        console.warn("cleanup B:", e.message),
      );
    }
    await prisma.$disconnect().catch(() => {});
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- resumo ---");
  console.log(`passou: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`- ${f.step}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main();
