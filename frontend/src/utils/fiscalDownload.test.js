import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_DOWNLOAD_LOTE,
  arquivoDisponivel,
  estadoSelecaoTotal,
  idsDe,
  nomeArquivoDoc,
  nomeArquivoLote,
  rotuloSelecao,
  urlDownloadDoc,
  urlDownloadLote,
} from "./fiscalDownload.js";

describe("nomeArquivoDoc", () => {
  it("usa a chave de acesso e a extensão pedida", () => {
    assert.equal(nomeArquivoDoc("3512345678", "pdf"), "3512345678.pdf");
    assert.equal(nomeArquivoDoc("3512345678", "xml"), "3512345678.xml");
  });

  it("qualquer formato != pdf vira xml", () => {
    assert.equal(nomeArquivoDoc("35123", "seja-la-o-que-for"), "35123.xml");
  });

  it("sanitiza e cai no fallback quando não há chave", () => {
    assert.equal(nomeArquivoDoc("", "pdf"), "documento.pdf");
    assert.equal(nomeArquivoDoc(null, "xml"), "documento.xml");
    assert.equal(nomeArquivoDoc("ab c/../x", "pdf"), "abcx.pdf");
  });
});

describe("nomeArquivoLote", () => {
  it("monta <tipo>-lote-<data>.zip", () => {
    const d = new Date("2026-09-02T10:00:00Z");
    assert.equal(nomeArquivoLote("cte", d), "cte-lote-2026-09-02.zip");
    assert.equal(nomeArquivoLote("mdfe", d), "mdfe-lote-2026-09-02.zip");
  });

  it("tipo desconhecido cai em cte", () => {
    const d = new Date("2026-01-05T00:00:00Z");
    assert.equal(nomeArquivoLote("ciot", d), "cte-lote-2026-01-05.zip");
  });

  it("data inválida não quebra", () => {
    assert.equal(nomeArquivoLote("cte", new Date("nao-e-data")), "cte-lote-.zip");
  });
});

describe("urlDownloadDoc / urlDownloadLote", () => {
  it("individual", () => {
    assert.equal(urlDownloadDoc("cte", 7, "pdf"), "/fiscal/cte/7/pdf");
    assert.equal(urlDownloadDoc("mdfe", 9, "xml"), "/fiscal/mdfe/9/xml");
  });
  it("lote", () => {
    assert.equal(urlDownloadLote("cte"), "/fiscal/cte/download-lote");
    assert.equal(urlDownloadLote("mdfe"), "/fiscal/mdfe/download-lote");
  });
});

describe("idsDe", () => {
  it("inteiros positivos, únicos, na ordem", () => {
    assert.deepEqual(
      idsDe([{ id: 3 }, { id: "3" }, { id: 1 }, { id: 1 }, { id: 0 }, { id: -2 }, {}]),
      [3, 1],
    );
  });
  it("entrada não-array", () => {
    assert.deepEqual(idsDe(null), []);
  });
});

describe("arquivoDisponivel", () => {
  it("olha o path do formato correspondente", () => {
    const row = { pdf_path: "fiscal/cte/1/x.pdf", xml_path: null };
    assert.equal(arquivoDisponivel(row, "pdf"), true);
    assert.equal(arquivoDisponivel(row, "xml"), false);
    assert.equal(arquivoDisponivel(null, "pdf"), false);
  });
});

describe("rotuloSelecao", () => {
  it("singular/plural", () => {
    assert.equal(rotuloSelecao(1), "1 selecionado");
    assert.equal(rotuloSelecao(3), "3 selecionados");
    assert.equal(rotuloSelecao(0), "0 selecionados");
  });
});

describe("estadoSelecaoTotal", () => {
  it("none / some / all", () => {
    assert.equal(estadoSelecaoTotal(0, 0), "none");
    assert.equal(estadoSelecaoTotal(5, 0), "none");
    assert.equal(estadoSelecaoTotal(5, 2), "some");
    assert.equal(estadoSelecaoTotal(5, 5), "all");
    assert.equal(estadoSelecaoTotal(5, 9), "all");
  });
});

describe("LIMITE_DOWNLOAD_LOTE", () => {
  it("espelha o teto do backend (300)", () => {
    assert.equal(LIMITE_DOWNLOAD_LOTE, 300);
  });
});
