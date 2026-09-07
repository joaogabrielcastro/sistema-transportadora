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
      <total>
        <ICMSTot>
          <vDesc>10.00</vDesc>
          <vFrete>25.50</vFrete>
          <vIPI>8.00</vIPI>
          <vNF>223.70</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

    const parsed = parseNfeXml(xml);
    assert.equal(parsed.numero, "595");
    assert.equal(parsed.serie, "5");
    assert.equal(parsed.emitente, "OXIDAKAR");
    assert.equal(parsed.valor_desconto, 10);
    assert.equal(parsed.valor_frete, 25.5);
    assert.equal(parsed.valor_ipi, 8);
    assert.equal(parsed.valor_total, 223.7);
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

  it("lê destinatário, peso e classifica carga (não copia CFOP para o CT-e)", () => {
    const xml = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe412608150253900001215500500000005951000005961">
      <ide><nNF>598</nNF><serie>1</serie><dhEmi>2026-08-05T15:39:29-03:00</dhEmi></ide>
      <emit>
        <CNPJ>15025390000121</CNPJ>
        <xNome>REMETENTE LTDA</xNome>
        <enderEmit><UF>PR</UF><xMun>CURITIBA</xMun><cMun>4106902</cMun></enderEmit>
      </emit>
      <dest>
        <CNPJ>11222333000181</CNPJ>
        <xNome>DESTINATARIO SA</xNome>
        <enderDest><UF>SP</UF><xMun>SAO PAULO</xMun><cMun>3550308</cMun></enderDest>
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
      <transp><vol><pesoB>12.500</pesoB><pesoL>12.000</pesoL></vol></transp>
    </infNFe>
  </NFe>
</nfeProc>`;
    const parsed = parseNfeXml(xml);
    assert.equal(parsed.uso, "carga");
    assert.equal(parsed.remetente.uf, "PR");
    assert.equal(parsed.destinatario.uf, "SP");
    assert.equal(parsed.destinatario.cnpj_cpf, "11222333000181");
    assert.equal(parsed.peso_bruto, 12.5);
    assert.equal(parsed.itens[0].cfop, "5102");
    assert.equal(parsed.data_emissao_ymd, "2026-08-05");
  });

  it("classifica NF-e de diesel como combustível e soma litros", () => {
    const xml = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe412608150253900001215500500000006061000006071">
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
      <infAdic><infCpl>PLACA ABC1D23</infCpl></infAdic>
    </infNFe>
  </NFe>
</nfeProc>`;
    const parsed = parseNfeXml(xml);
    assert.equal(parsed.uso, "combustivel");
    assert.equal(parsed.quantidade_litros, 150);
    assert.equal(parsed.preco_litro, 6.199);
    assert.equal(parsed.itens[0].codigo_anp, "210203001");
    assert.equal(parsed.placa_sugerida, "ABC1D23");
  });
});
