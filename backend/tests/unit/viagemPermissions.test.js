import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIGURABLE_PERMISSIONS,
  PERMISSIONS,
  diffPermissionsForRole,
  hasPermission,
  resolvePermissions,
} from "../../src/utils/permissions.js";
import {
  dataLocalBrasil,
  diffFields,
  sanitizeHistoricoAlteracoes,
  viagemIndicadores,
  viagemVisibility,
  assertEncerramentoValido,
} from "../../src/services/viagens/viagemRules.js";

describe("permissões de viagens", () => {
  it("perfis padrão: operador e admin completos; leitura sem escrita", () => {
    for (const role of ["admin", "operator"]) {
      const p = resolvePermissions(role);
      assert.ok(hasPermission(p, [PERMISSIONS.VIAGENS_CREATE, PERMISSIONS.VIAGENS_FINANCEIRO, PERMISSIONS.GASTOS_READ]), role);
    }
    const v = resolvePermissions("viewer");
    assert.ok(hasPermission(v, [PERMISSIONS.VIAGENS_READ, PERMISSIONS.VIAGENS_FINANCEIRO, PERMISSIONS.GASTOS_READ]));
    assert.equal(hasPermission(v, PERMISSIONS.VIAGENS_CREATE), false);
    assert.equal(hasPermission(v, PERMISSIONS.VIAGENS_DESPESAS_DELETE), false);
  });

  it("revogação com '-' retira do perfil, exceto do administrador", () => {
    const op = resolvePermissions("operator", ["-viagens.financeiro", "-gastos.read"]);
    assert.equal(hasPermission(op, PERMISSIONS.VIAGENS_FINANCEIRO), false);
    assert.equal(hasPermission(op, PERMISSIONS.GASTOS_READ), false);
    assert.ok(hasPermission(op, PERMISSIONS.FROTA_READ));
    assert.ok(!op.some((p) => p.startsWith("-")));
    const adm = resolvePermissions("admin", ["-viagens.financeiro"]);
    assert.ok(hasPermission(adm, PERMISSIONS.VIAGENS_FINANCEIRO));
  });

  it("diff grava só o que difere do perfil e preserva extras não configuráveis", () => {
    const entries = diffPermissionsForRole(
      "viewer",
      ["viagens.read", "viagens.create", "viagens.despesas.read"],
      ["cte.read", "-viagens.reports"],
    );
    assert.ok(entries.includes("cte.read"));
    assert.ok(entries.includes("viagens.create"));
    assert.ok(entries.includes("-viagens.financeiro"));
    assert.ok(entries.includes("-gastos.read"));
    assert.ok(!entries.includes("viagens.read"), "já vem do perfil");
    const eff = resolvePermissions("viewer", entries);
    for (const p of CONFIGURABLE_PERMISSIONS) {
      const want = ["viagens.read", "viagens.create", "viagens.despesas.read"].includes(p);
      assert.equal(eff.includes(p), want, p);
    }
    assert.ok(eff.includes("cte.read"));
  });
});

describe("regras de viagem", () => {
  it("indicadores: km, duração, custo por km só na finalizada", () => {
    const base = { saida_em: "2026-11-20T08:00:00Z", chegada_em: "2026-11-20T18:30:00Z", km_inicial: 1000, km_final: 1400 };
    assert.deepEqual(viagemIndicadores({ ...base, status: "finalizada" }, 1000), {
      km_percorrido: 400, duracao_min: 630, total_despesas: 1000, custo_por_km: 2.5,
    });
    assert.equal(viagemIndicadores({ ...base, status: "em_andamento", km_final: null, chegada_em: null }, 50).custo_por_km, null);
    assert.equal(viagemIndicadores({ ...base, status: "finalizada", km_final: 1000 }, 50).custo_por_km, null, "sem km rodado");
  });

  it("visibilidade e limpeza do histórico", () => {
    const sem = viagemVisibility(resolvePermissions("operator", ["-viagens.financeiro"]));
    assert.deepEqual(sem, { financeiro: false, despesas: true });
    const entry = { acao: "despesa_editada", alteracoes: { valor: { de: 10, para: 12 }, descricao: { de: "a", para: "b" } } };
    assert.deepEqual(sanitizeHistoricoAlteracoes(entry, sem), { descricao: { de: "a", para: "b" } });
    assert.equal(sanitizeHistoricoAlteracoes(entry, { financeiro: true, despesas: false }), null);
    assert.equal(sanitizeHistoricoAlteracoes({ acao: "encerrada", alteracoes: { km_final: 5, total_despesas: 9, custo_por_km: 1 } }, sem).total_despesas, undefined);
  });

  it("diff de campos compara datas pelo instante", () => {
    const d = diffFields(
      { saida_em: new Date("2026-11-20T08:00:00Z"), origem: "A", destino: "B" },
      { saida_em: new Date("2026-11-20T08:00:00.000Z"), origem: "A2" },
      ["saida_em", "origem", "destino"],
    );
    assert.deepEqual(d, { origem: { de: "A", para: "A2" } });
  });

  it("encerramento inválido e data local de Brasília", () => {
    assert.throws(() => assertEncerramentoValido({ saida_em: "2026-11-20T08:00:00Z", km_inicial: 10 }, { chegada_em: "2026-11-20T07:00:00Z" }), /antes da saída/);
    assert.throws(() => assertEncerramentoValido({ saida_em: "2026-11-20T08:00:00Z", km_inicial: 10 }, { km_final: 9 }), /menor/);
    // 01:30 UTC ainda é o dia anterior em Brasília.
    assert.equal(dataLocalBrasil("2026-11-21T01:30:00Z"), "2026-11-20");
  });
});
