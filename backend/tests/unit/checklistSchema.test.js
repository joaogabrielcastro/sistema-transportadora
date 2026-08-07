import test from "node:test";
import assert from "node:assert/strict";
import {
  checklistSchema,
  checklistUpdateSchema,
} from "../../src/schemas/checklistSchema.js";

function todayIso() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test("checklistSchema aceita nome_item texto livre", () => {
  const parsed = checklistSchema.parse({
    caminhao_id: 1,
    nome_item: "  Troca de óleo  ",
    data_manutencao: todayIso(),
    valor: 150,
  });
  assert.equal(parsed.nome_item, "Troca de óleo");
  assert.equal(parsed.item_id ?? null, null);
});

test("checklistSchema rejeita data futura", () => {
  assert.throws(
    () =>
      checklistSchema.parse({
        nome_item: "Filtro",
        data_manutencao: "2099-12-31",
      }),
    /futura/i,
  );
});

test("checklistSchema ainda aceita item_id legado", () => {
  const parsed = checklistSchema.parse({
    item_id: 3,
    data_manutencao: todayIso(),
  });
  assert.equal(parsed.item_id, 3);
});

test("checklistSchema aceita lembrete proxima_km e proxima_data futura", () => {
  const parsed = checklistSchema.parse({
    nome_item: "Troca de óleo",
    data_manutencao: todayIso(),
    proxima_km: 1400000,
    proxima_data: "2027-02-06",
  });
  assert.equal(parsed.proxima_km, 1400000);
  assert.equal(parsed.proxima_data, "2027-02-06");
});

test("checklistSchema trata proxima vazia como null", () => {
  const parsed = checklistSchema.parse({
    nome_item: "Filtro",
    data_manutencao: todayIso(),
    proxima_km: "",
    proxima_data: "",
  });
  assert.equal(parsed.proxima_km ?? null, null);
  assert.equal(parsed.proxima_data ?? null, null);
});

test("checklistUpdateSchema aceita só proxima_km", () => {
  const parsed = checklistUpdateSchema.parse({ proxima_km: 155000 });
  assert.equal(parsed.proxima_km, 155000);
});
