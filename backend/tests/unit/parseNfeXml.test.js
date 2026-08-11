import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseNfeXml } from "../../src/utils/parseNfeXml.js";

describe("parseNfeXml", () => {
  it("extrai cabeçalho e itens de NF-e simples", () => {
    const xml = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe412608150253900001215500500000005951000005961">
      <ide><nNF>595</nNF><serie>5</serie><dhEmi>2026-08-05T15:39:29-03:00</dhEmi></ide>
      <emit><CNPJ>15025390000121</CNPJ><xNome>OXIDAKAR</xNome></emit>
      <det nItem="1">
        <prod>
          <cProd>100014</cProd>
          <xProd>OXIGENIO IND GAS</xProd>
          <NCM>28044000</NCM>
          <uCom>M3</uCom>
          <qCom>14.0000</qCom>
          <vUnCom>14.3000</vUnCom>
          <vProd>200.20</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>200.20</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

    const parsed = parseNfeXml(xml);
    assert.equal(parsed.numero, "595");
    assert.equal(parsed.serie, "5");
    assert.equal(parsed.emitente, "OXIDAKAR");
    assert.equal(parsed.itens.length, 1);
    assert.equal(parsed.itens[0].descricao, "OXIGENIO IND GAS");
    assert.equal(parsed.itens[0].quantidade, 14);
    assert.ok(parsed.chave_acesso?.startsWith("4126"));
    assert.equal(parsed.placa_sugerida, null);
  });

  it("detecta placa em infCpl", () => {
    const xml = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe412608150253900001215500500000005951000005961">
      <ide><nNF>596</nNF><serie>5</serie><dhEmi>2026-08-05T15:39:29-03:00</dhEmi></ide>
      <emit><CNPJ>15025390000121</CNPJ><xNome>OXIDAKAR</xNome></emit>
      <det nItem="1">
        <prod>
          <cProd>1</cProd>
          <xProd>FILTRO</xProd>
          <uCom>UN</uCom>
          <qCom>1</qCom>
          <vUnCom>10</vUnCom>
          <vProd>10</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>10</vNF></ICMSTot></total>
      <infAdic><infCpl>PECA PARA PLACA ABC1D23 CAMINHAO</infCpl></infAdic>
    </infNFe>
  </NFe>
</nfeProc>`;
    const parsed = parseNfeXml(xml);
    assert.equal(parsed.placa_sugerida, "ABC1D23");
    assert.ok(parsed.placas_sugeridas.includes("ABC1D23"));
  });
});
