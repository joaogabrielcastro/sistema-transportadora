import test from "node:test";
import assert from "node:assert/strict";
import { encerrarMdfeSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * MDF-e — encerramento estruturado (item 2.2). O schema passou a aceitar
 * UF / município / data do encerramento, mas continua compatível com corpo
 * vazio ou ausente (comportamento atual). Schema puro — sem banco.
 */

test("corpo ausente (undefined) continua válido", () => {
  assert.equal(encerrarMdfeSchema.parse(undefined), undefined);
});

test("corpo vazio continua válido", () => {
  assert.deepEqual(encerrarMdfeSchema.parse({}), {});
});

test("aceita UF / município / data de encerramento", () => {
  const ok = encerrarMdfeSchema.parse({
    uf: "MG",
    codigo_municipio: "3106200",
    nome_municipio: "Belo Horizonte",
    data_encerramento: "2026-09-02T18:00:00-03:00",
  });
  assert.equal(ok.uf, "MG");
  assert.equal(ok.codigo_municipio, "3106200");
});

test("rejeita UF com tamanho != 2", () => {
  assert.throws(() => encerrarMdfeSchema.parse({ uf: "MGG" }));
});

test("rejeita data de encerramento inválida", () => {
  assert.throws(() =>
    encerrarMdfeSchema.parse({ data_encerramento: "ontem" }),
  );
});
