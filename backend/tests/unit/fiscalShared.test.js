import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Cobre a gravação em disco de XML/PDF de documentos fiscais
 * (salvarArquivoBase64 / salvarXmlBase64 / salvarPdfBase64 de fiscalShared.js).
 *
 * UPLOADS_ROOT é resolvido de process.env.UPLOADS_DIR no import do módulo, então
 * apontamos para um diretório temporário ANTES do import dinâmico — nada é
 * escrito no uploads/ real.
 */

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "fiscal-shared-test-"));
process.env.UPLOADS_DIR = TMP_ROOT;

const { salvarXmlBase64, salvarPdfBase64 } = await import(
  "../../src/services/fiscal/fiscalShared.js"
);

after(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

describe("fiscalShared — gravação de XML/PDF", () => {
  it("sanitiza o nome do arquivo: ../, barras e espaços não escapam do diretório do tenant", async () => {
    const rel = await salvarXmlBase64(
      "cte",
      42,
      "../../../etc/passwd",
      b64("<x/>"),
    );

    assert.ok(rel.startsWith("fiscal/cte/42/"), `rel inesperado: ${rel}`);
    const base = rel.slice("fiscal/cte/42/".length);
    // Só [0-9A-Za-z_-] sobrevivem: sem separadores, sem "..".
    assert.doesNotMatch(base, /[\\/]/);
    assert.doesNotMatch(base, /\.\./);
    assert.equal(base, "etcpasswd.xml");

    // O arquivo real ficou DENTRO do diretório do tenant.
    const abs = path.resolve(TMP_ROOT, rel);
    const tenantDir = path.resolve(TMP_ROOT, "fiscal", "cte", "42");
    assert.equal(abs, path.join(tenantDir, "etcpasswd.xml"));
    assert.ok(abs.startsWith(tenantDir + path.sep));
    assert.ok(fs.existsSync(abs));
    // Nada foi criado subindo na árvore.
    assert.equal(fs.existsSync(path.join(TMP_ROOT, "etc")), false);
    assert.equal(fs.existsSync(path.join(TMP_ROOT, "fiscal", "cte", "passwd")), false);
  });

  it("grava XML como texto utf8 e PDF como binário puro", async () => {
    const xmlStr = '<?xml version="1.0"?><cte><obs>ção € çá</obs></cte>';
    const relXml = await salvarXmlBase64("cte", 7, "CHAVEXML", b64(xmlStr));
    const lidoXml = await fsp.readFile(path.resolve(TMP_ROOT, relXml), "utf8");
    assert.equal(lidoXml, xmlStr);

    // PDF: bytes que NÃO formam utf8 válido têm que sobreviver intactos.
    const pdfBytes = Buffer.from([
      0x25, 0x50, 0x44, 0x46, 0xde, 0xad, 0xbe, 0xef, 0x00, 0xff,
    ]);
    const pdfB64 = pdfBytes.toString("base64");
    const relPdf = await salvarPdfBase64("cte", 7, "CHAVEPDF", pdfB64);
    const lidoPdf = await fsp.readFile(path.resolve(TMP_ROOT, relPdf));
    assert.deepEqual(lidoPdf, pdfBytes);

    // O mesmo conteúdo binário gravado pela via XML seria corrompido
    // (buf.toString("utf8") troca bytes inválidos por U+FFFD) — documenta a
    // diferença intencional de tratamento entre xml (texto) e pdf (binário).
    const relComoXml = await salvarXmlBase64("cte", 7, "CHAVEPDFVIAXML", pdfB64);
    const comoXml = await fsp.readFile(path.resolve(TMP_ROOT, relComoXml));
    assert.notDeepEqual(comoXml, pdfBytes);
  });

  it("caminho relativo devolvido sempre usa / (inclusive rodando no Windows)", async () => {
    const rel = await salvarPdfBase64("mdfe", 3, "ABC123", b64("pdf"));
    assert.equal(rel, "fiscal/mdfe/3/ABC123.pdf");
    assert.doesNotMatch(rel, /\\/);
  });

  it("base64 vazio/undefined/null retorna null sem escrever nada", async () => {
    const dir = path.join(TMP_ROOT, "fiscal", "cte", "999");
    for (const vazio of ["", undefined, null]) {
      assert.equal(await salvarXmlBase64("cte", 999, "CHAVE", vazio), null);
      assert.equal(await salvarPdfBase64("cte", 999, "CHAVE", vazio), null);
    }
    // Nem o diretório do tenant chegou a ser criado.
    assert.equal(fs.existsSync(dir), false);
  });

  it("isola arquivos entre tenants diferentes com a mesma chave", async () => {
    const chave = "MESMACHAVE";
    const relA = await salvarXmlBase64("cte", 100, chave, b64("conteudo-100"));
    const relB = await salvarXmlBase64("cte", 200, chave, b64("conteudo-200"));

    assert.equal(relA, "fiscal/cte/100/MESMACHAVE.xml");
    assert.equal(relB, "fiscal/cte/200/MESMACHAVE.xml");
    assert.notEqual(relA, relB);

    assert.equal(
      await fsp.readFile(path.resolve(TMP_ROOT, relA), "utf8"),
      "conteudo-100",
    );
    assert.equal(
      await fsp.readFile(path.resolve(TMP_ROOT, relB), "utf8"),
      "conteudo-200",
    );
  });
});
