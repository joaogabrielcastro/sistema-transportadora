import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  FiscalDownloadService,
  LIMITE_DOWNLOAD_LOTE,
  normalizarIdsLote,
  nomeArquivoDoc,
  resolverCaminhoAbsoluto,
} from "../../src/services/fiscal/FiscalDownloadService.js";
import { UPLOADS_ROOT } from "../../src/utils/uploadPaths.js";

/**
 * Download de CT-e/MDF-e (individual + lote). Funções puras — a resolução de
 * caminho NUNCA aceita nada do cliente e não pode escapar de UPLOADS_ROOT; a
 * normalização de ids do lote descarta lixo e o manifest lista o que ficou de
 * fora do zip.
 */

test("resolverCaminhoAbsoluto: monta o caminho sob UPLOADS_ROOT", () => {
  const abs = resolverCaminhoAbsoluto("fiscal/cte/12/ABC123.pdf");
  assert.equal(
    abs,
    path.resolve(UPLOADS_ROOT, "fiscal/cte/12/ABC123.pdf"),
  );
  assert.ok(abs.startsWith(path.resolve(UPLOADS_ROOT) + path.sep));
});

test("resolverCaminhoAbsoluto: normaliza separadores e barra inicial", () => {
  const abs = resolverCaminhoAbsoluto("\\fiscal\\mdfe\\3\\X.xml");
  assert.equal(abs, path.resolve(UPLOADS_ROOT, "fiscal/mdfe/3/X.xml"));
});

test("resolverCaminhoAbsoluto: rejeita path traversal com 404", () => {
  assert.throws(
    () => resolverCaminhoAbsoluto("fiscal/cte/../../../etc/passwd"),
    (err) => err.statusCode === 404,
  );
  assert.throws(
    () => resolverCaminhoAbsoluto("../../../../secret.env"),
    (err) => err.statusCode === 404,
  );
});

test("normalizarIdsLote: inteiros positivos, únicos, na ordem recebida", () => {
  assert.deepEqual(
    normalizarIdsLote([3, "3", 1, 1, "2", -5, 0, null, "x", 2.5]),
    [3, 1, 2],
  );
  assert.deepEqual(normalizarIdsLote("nao-array"), []);
  assert.deepEqual(normalizarIdsLote(undefined), []);
});

test("nomeArquivoDoc: usa a chave de acesso e a extensão certa", () => {
  assert.equal(
    nomeArquivoDoc({ chave_acesso: "3512345678901234567890" }, "pdf"),
    "3512345678901234567890.pdf",
  );
  assert.equal(
    nomeArquivoDoc({ chave_acesso: "3512345678901234567890" }, "xml"),
    "3512345678901234567890.xml",
  );
});

test("nomeArquivoDoc: sem chave cai no fallback por id e sanitiza", () => {
  assert.equal(nomeArquivoDoc({ id: 42 }, "pdf"), "documento-42.pdf");
  assert.equal(
    nomeArquivoDoc({ chave_acesso: "abc/../x 1", id: 7 }, "xml"),
    "abcx1.xml",
  );
});

test("montarManifest: lista arquivos pulados e ids ignorados", () => {
  const txt = FiscalDownloadService.montarManifest({
    label: "CT-e",
    pulados: ["CT-e 10/1: PDF não gravado"],
    ignorados: [999, 1000],
  });
  assert.match(txt, /Download em lote de CT-e/);
  assert.match(txt, /CT-e 10\/1: PDF não gravado/);
  assert.match(txt, /Ids ignorados.*999, 1000/);
});

test("montarManifest: sem pendências gera só o cabeçalho", () => {
  const txt = FiscalDownloadService.montarManifest({ label: "MDF-e" });
  assert.match(txt, /Download em lote de MDF-e/);
  assert.doesNotMatch(txt, /NAO incluidos/);
  assert.doesNotMatch(txt, /Ids ignorados/);
});

test("LIMITE_DOWNLOAD_LOTE é o teto documentado (300)", () => {
  assert.equal(LIMITE_DOWNLOAD_LOTE, 300);
});
