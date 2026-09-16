import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lerXmlsParaCte,
  CombustivelNfeService,
} from "../../src/services/NfeXmlService.js";

function fileFromXml(xml, name = "nfe.xml") {
  return { buffer: Buffer.from(xml, "utf8"), originalname: name };
}

const CHAVE_CARGA = "41260815025390000121550050000000595100000596";
const CHAVE_FUEL = "41260815025390000121550050000000606100000607";

const xmlCarga = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe${CHAVE_CARGA}1">
      <ide><nNF>598</nNF><serie>1</serie><dhEmi>2026-08-05T15:39:29-03:00</dhEmi></ide>
      <emit>
        <CNPJ>15025390000121</CNPJ>
        <xNome>REMETENTE LTDA</xNome>
        <enderEmit><UF>PR</UF></enderEmit>
      </emit>
      <dest>
        <CNPJ>11222333000181</CNPJ>
        <xNome>DESTINATARIO SA</xNome>
        <enderDest><UF>SP</UF></enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>SOJA</cProd>
          <xProd>SOJA EM GRAOS</xProd>
          <NCM>12019000</NCM>
          <CFOP>5102</CFOP>
          <uCom>KG</uCom>
          <qCom>12500</qCom>
          <vUnCom>1.20</vUnCom>
          <vProd>15000.00</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>15000.00</vNF></ICMSTot></total>
      <transp><vol><pesoB>12.500</pesoB></vol></transp>
    </infNFe>
  </NFe>
</nfeProc>`;

const xmlFuel = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe${CHAVE_FUEL}1">
      <ide><nNF>606</nNF><serie>1</serie><dhEmi>2026-08-06T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>00394494000103</CNPJ><xNome>POSTO TESTE</xNome></emit>
      <det nItem="1">
        <prod>
          <cProd>S10</cProd>
          <xProd>OLEO DIESEL S10</xProd>
          <NCM>27101921</NCM>
          <uCom>L</uCom>
          <qCom>150.0000</qCom>
          <vUnCom>6.1990</vUnCom>
          <vProd>929.85</vProd>
          <comb><cANP>210203001</cANP></comb>
        </prod>
      </det>
      <total><ICMSTot><vNF>929.85</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe("lerXmlsParaCte", () => {
  it("devolve NF-e de carga com participantes e peso", () => {
    const out = lerXmlsParaCte([fileFromXml(xmlCarga)]);
    assert.equal(out.notas.length, 1);
    assert.equal(out.notas[0].chave_acesso, CHAVE_CARGA);
    assert.equal(out.notas[0].destinatario.uf, "SP");
    assert.equal(out.notas[0].peso_bruto, 12.5);
    assert.equal(out.notas[0].itens[0].cfop, "5102");
    assert.equal(out.ignoradas_combustivel.length, 0);
  });

  it("rejeita XML só de combustível (abastecimento não entra no CT-e)", () => {
    assert.throws(
      () => lerXmlsParaCte([fileFromXml(xmlFuel)]),
      (err) => err.statusCode === 400 && /combustível/i.test(err.message),
    );
  });

  it("ignora combustível no lote e mantém as NF-e de carga", () => {
    const out = lerXmlsParaCte([
      fileFromXml(xmlCarga, "carga.xml"),
      fileFromXml(xmlFuel, "posto.xml"),
    ]);
    assert.equal(out.notas.length, 1);
    assert.equal(out.ignoradas_combustivel.length, 1);
    assert.equal(out.ignoradas_combustivel[0].chave_acesso, CHAVE_FUEL);
  });
});

describe("CombustivelNfeService.preview", () => {
  it("lê litros e posto da NF-e de diesel", () => {
    const parsed = CombustivelNfeService.preview(xmlFuel);
    assert.equal(parsed.uso, "combustivel");
    assert.equal(parsed.quantidade_litros, 150);
    assert.equal(parsed.emitente, "POSTO TESTE");
    assert.equal(parsed.data_emissao_ymd, "2026-08-06");
  });

  it("rejeita NF-e de carga no fluxo de combustível", () => {
    assert.throws(
      () => CombustivelNfeService.preview(xmlCarga),
      (err) => err.statusCode === 400 && /combustível/i.test(err.message),
    );
  });
});
