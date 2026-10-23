/**
 * Confere custo/km com números conhecidos.
 * Regra do produto: KM = último − primeiro entre ≥2 lançamentos com KM.
 * Dois gastos: km 100000 (R$0,01) e km 100200 (R$399,99) → Δ200 km, total R$400 → R$/km = 2.
 *
 *   node scripts/starter-cost-km-verify.mjs
 */
import prisma from "../src/lib/prisma.js";
import { cleanupTenant } from "../tests/helpers/dbTestFixtures.js";

const API = process.env.SMOKE_API_URL || "http://127.0.0.1:3020/api";
const stamp = Date.now().toString(36);

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function almostEqual(a, b, eps = 0.01) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

async function main() {
  let tenantId;
  try {
    const email = `costkm-${stamp}@example.test`;
    const password = `CostKm-${stamp}!`;
    const reg = await api("/auth/register", {
      method: "POST",
      body: {
        empresaNome: `CostKm ${stamp}`,
        nome: "Admin Cost",
        email,
        password,
        acceptedLegal: true,
        lid: "starter",
      },
    });
    if (reg.status !== 201) throw new Error(reg.json?.error || "register failed");
    const token = reg.json.data.token;
    tenantId = reg.json.data.user.tenantId;

    const placa = `CKM${(Date.now() % 10)}${"ABCDEFGHJKLMNPRSTUVWXYZ"[(Date.now() >> 4) % 23]}${String(Date.now() % 100).padStart(2, "0")}`;
    const truck = await api("/caminhoes", {
      method: "POST",
      token,
      body: { placa, qtd_pneus: 6, km_atual: 100000, tipo_veiculo: "truck" },
    });
    if (truck.status !== 201) throw new Error(truck.json?.error || "truck failed");
    const caminhaoId = truck.json.data.id;

    const tipos = await api("/tipos-gastos", { token });
    const tipoId = (tipos.json?.data || [])[0]?.id;
    const day0 = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);
    const day1 = new Date().toISOString().slice(0, 10);
    const g1 = await api("/gastos", {
      method: "POST",
      token,
      body: {
        caminhao_id: caminhaoId,
        tipo_gasto_id: tipoId,
        data_gasto: day0,
        valor: 0.01,
        descricao: "Marco KM inicial",
        km_registro: 100000,
      },
    });
    if (g1.status !== 201) throw new Error(JSON.stringify(g1.json));
    const g2 = await api("/gastos", {
      method: "POST",
      token,
      body: {
        caminhao_id: caminhaoId,
        tipo_gasto_id: tipoId,
        data_gasto: day1,
        valor: 399.99,
        descricao: "Abastecimento custo/km conhecido",
        km_registro: 100200,
      },
    });
    if (g2.status !== 201) throw new Error(JSON.stringify(g2.json));

    const start = new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const report = await api(
      `/reports/cost-per-km?startDate=${start}&endDate=${end}&caminhaoId=${caminhaoId}`,
      { token },
    );
    if (report.status !== 200) throw new Error(JSON.stringify(report.json));

    const payload = report.json?.data;
    const rows = Array.isArray(payload)
      ? payload
      : payload?.report || payload?.items || payload?.rows || [];
    const row =
      rows.find?.((r) => r.placa === placa) ||
      rows[0] ||
      (payload && !Array.isArray(payload) ? payload : null);

    console.log("report payload keys:", Object.keys(report.json || {}));
    console.log("row:", JSON.stringify(row, null, 2));

    const totalCost = Number(row?.totalCost ?? row?.total_cost);
    const kmDriven = Number(row?.kmDriven ?? row?.km_driven);
    const costPerKm = Number(row?.costPerKm ?? row?.cost_per_km);

    const okCost = almostEqual(totalCost, 400);
    const okKm = almostEqual(kmDriven, 200);
    const okRate = almostEqual(costPerKm, 2);

    console.log(
      `${okCost && okKm && okRate ? "OK" : "FAIL"} | custo/km esperado total=400 km=200 rate=2 — got total=${totalCost} km=${kmDriven} rate=${costPerKm}`,
    );
    if (!(okCost && okKm && okRate)) process.exitCode = 1;
  } catch (err) {
    console.error("FAIL |", err.message);
    process.exitCode = 1;
  } finally {
    if (tenantId) await cleanupTenant(tenantId).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
}

main();
