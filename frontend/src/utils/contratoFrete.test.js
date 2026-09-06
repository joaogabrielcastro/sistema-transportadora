import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ciotRegistradoNoContrato,
  labelStatusCiot,
  labelStatusContrato,
  numeroCiotDoContrato,
} from "./contratoFrete.js";

describe("contrato vs CIOT na UI", () => {
  it("não trata o id do contrato como número de CIOT", () => {
    const contrato = {
      id: 123,
      status: "em_andamento",
      ciot: {
        status: "registrado",
        numero: "987654321",
        codigo_identificacao_operacao: "987654321",
      },
    };
    assert.equal(numeroCiotDoContrato(contrato), "987654321");
    assert.notEqual(numeroCiotDoContrato(contrato), String(contrato.id));
    assert.equal(ciotRegistradoNoContrato(contrato), true);
    assert.equal(labelStatusContrato(contrato.status), "Em andamento");
    assert.equal(labelStatusCiot(contrato.ciot.status), "Registrado");
  });

  it("contrato sem CIOT aparece como não registrado", () => {
    const contrato = { id: 1, status: "ativo", ciot: null };
    assert.equal(numeroCiotDoContrato(contrato), "");
    assert.equal(ciotRegistradoNoContrato(contrato), false);
    assert.equal(labelStatusCiot("nao_registrado"), "Não registrado");
  });
});
