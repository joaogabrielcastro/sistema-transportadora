import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDuracao,
  fromLocalInput,
  historicoLinhas,
  periodoDias,
  toLocalInput,
} from "./viagens.js";
import { canSeeNavItem, NAV_SECTIONS } from "../components/layout/navConfig.js";
import { quickActionsFor } from "../components/layout/quickActions.js";

describe("viagens utils", () => {
  it("formata duração", () => {
    assert.equal(formatDuracao(35), "35 min");
    assert.equal(formatDuracao(320), "5 h 20 min");
    assert.equal(formatDuracao(60 * 52), "2 d 4 h");
    assert.equal(formatDuracao(null), "—");
  });

  it("datetime-local ida e volta mantém o instante (minuto)", () => {
    const d = new Date(2026, 10, 20, 14, 35);
    assert.equal(fromLocalInput(toLocalInput(d)), d.toISOString());
    assert.equal(fromLocalInput(""), null);
  });

  it("linhas do histórico: diferença e valor simples; ignora campos internos", () => {
    const linhas = historicoLinhas({
      destino: { de: "Santos", para: "Santos (porto)" },
      km_final: 1350,
      tipo_gasto_id: { de: 1, para: 2 },
    });
    assert.deepEqual(linhas, [
      { campo: "destino", label: "Destino", de: "Santos", para: "Santos (porto)" },
      { campo: "km_final", label: "Km final", valor: "1.350 km" },
    ]);
  });

  it("período começa à meia-noite", () => {
    const { de } = periodoDias(7, new Date(2026, 10, 28, 15, 0));
    assert.equal(new Date(de).getHours(), 0);
    assert.equal(new Date(de).getDate(), 22);
  });
});

describe("acesso ao módulo de viagens no menu", () => {
  const item = (path) => NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.path === path);
  const operador = { role: "operator", permissions: ["viagens.read", "viagens.create", "gastos.read"] };
  const motorista = { role: "operator", permissions: ["viagens.read"] };

  it("Viagens aparece com viagens.read; gastos some sem gastos.read", () => {
    assert.equal(canSeeNavItem(operador, item("/viagens")), true);
    assert.equal(canSeeNavItem(motorista, item("/viagens")), true);
    assert.equal(canSeeNavItem(motorista, item("/manutencao-gastos")), false);
    assert.equal(canSeeNavItem({ role: "operator", permissions: [] }, item("/viagens")), false);
  });

  it("atalho Nova viagem só para quem cria", () => {
    assert.equal(quickActionsFor(operador).some((a) => a.id === "viagem"), true);
    assert.equal(quickActionsFor(motorista).some((a) => a.id === "viagem"), false);
  });
});
