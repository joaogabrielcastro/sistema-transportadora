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
    assert.equal(parsed.itens[0].valor_unitario, 14.3);
    assert.equal(parsed.itens[0].valor_total, 200.2);
    assert.ok(parsed.chave_acesso?.startsWith("4126"));
    assert.equal(parsed.placa_sugerida, null);
  });

  it("usa valor unitário líquido após desconto", () => {
    const xml = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe412608150253900001215500500000005951000005961">
      <ide><nNF>597</nNF><serie>1</serie><dhEmi>2026-08-05T15:39:29-03:00</dhEmi></ide>
      <emit><CNPJ>15025390000121</CNPJ><xNome>FLORENCA</xNome></emit>
      <det nItem="1">
        <prod>
          <cProd>5801516883</cProd>
          <xProd>ELEM. FILTRO COMBU</xProd>
          <uCom>PC</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>1218.84</vUnCom>
          <vProd>1218.84</vProd>
          <vDesc>365.65</vDesc>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>4039OF</cProd>
          <xProd>OLEO TRANSMISSAO</xProd>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>72.00</vUnCom>
          <vProd>144.00</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>1062.19</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;
    const parsed = parseNfeXml(xml);
    assert.equal(parsed.itens[0].valor_desconto, 365.65);
    assert.equal(parsed.itens[0].valor_total, 853.19);
    assert.equal(parsed.itens[0].valor_unitario, 853.19);
    assert.equal(parsed.itens[0].valor_unitario_bruto, 1218.84);
    assert.equal(parsed.itens[1].valor_unitario, 72);
    assert.equal(parsed.itens[1].valor_total, 144);
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
