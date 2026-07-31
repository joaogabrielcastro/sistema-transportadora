import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatRegistros,
  formatCaminhaoRegistros,
} from "./formatRegistro.js";

test("formatRegistros mescla e ordena por data desc", () => {
  const rows = formatRegistros(
    [
      {
        id: 1,
        data_gasto: "2026-07-01",
        descricao: "a",
        tipos_gastos: { nome_tipo: "Combustível" },
        caminhoes: { placa: "ABC1D23" },
      },
    ],
    [
      {
        id: 2,
        data_manutencao: "2026-07-10",
        observacao: "b",
        itens_checklist: { nome_item: "Óleo" },
        caminhoes: { placa: "ABC1D23" },
      },
    ],
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].tipo_registro, "Manutenção");
  assert.equal(rows[1].tipo_registro, "Gasto");
  assert.equal(rows[1].nome_tipo, "Combustível");
});

test("formatRegistros empurra datas futuras para o fim", () => {
  const rows = formatRegistros(
    [],
    [
      {
        id: 1,
        data_manutencao: "2099-12-16",
        itens_checklist: { nome_item: "Lubrificação" },
        caminhoes: { placa: "RHN9C65" },
      },
      {
        id: 2,
        data_manutencao: "2026-07-30",
        itens_checklist: { nome_item: "Alternador" },
        caminhoes: { placa: "AUO5259" },
      },
    ],
  );
  assert.equal(rows[0].nome_tipo, "Alternador");
  assert.equal(rows[1].nome_tipo, "Lubrificação");
});

test("formatCaminhaoRegistros monta rows de detalhe", () => {
  const rows = formatCaminhaoRegistros(
    [{ id: 1, data_gasto: "2026-07-02", valor: 10, tipos_gastos: { nome_tipo: "Pedágio" } }],
    [{ id: 2, data_manutencao: "2026-07-03", valor: 20, itens_checklist: { nome_item: "Filtro" } }],
  );
  assert.equal(rows[0].tipo, "manutencao");
  assert.equal(rows[1].tipo, "gasto");
  assert.equal(rows[1].descricao, "Pedágio");
});
