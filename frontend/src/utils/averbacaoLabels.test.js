import { test } from "node:test";
import assert from "node:assert/strict";
import {
  averbacaoIsErro,
  averbacaoIsOk,
  averbacaoPodeReprocessar,
  averbacaoProviderLabel,
  averbacaoStatusLabel,
} from "./averbacaoLabels.js";

test("rótulos de averbação", () => {
  assert.equal(averbacaoStatusLabel("averbed"), "Averbado");
  assert.equal(averbacaoStatusLabel("error"), "Erro na averbação");
  assert.equal(averbacaoProviderLabel("atm"), "AT&M");
  assert.equal(averbacaoIsOk("averbed"), true);
  assert.equal(averbacaoIsErro("rejected"), true);
  assert.equal(averbacaoPodeReprocessar("error"), true);
  assert.equal(averbacaoPodeReprocessar("averbed"), false);
});
