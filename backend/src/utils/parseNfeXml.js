/**
 * Extrai textos de tags XML NF-e sem dependência externa.
 * Lida com namespaces (nfe:, etc.) e CDATA básico.
 */

function stripNs(tag) {
  return String(tag || "").replace(/^.*:/, "");
}

function textOf(xml, tagNames) {
  const names = Array.isArray(tagNames) ? tagNames : [tagNames];
  for (const name of names) {
    const re = new RegExp(
      `<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`,
      "i",
    );
    const m = xml.match(re);
    if (m) {
      return m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]+>/g, "")
        .trim();
    }
  }
  return "";
}

function allBlocks(xml, tagName) {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tagName}>`,
    "gi",
  );
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {string} xmlContent
 */
export function parseNfeXml(xmlContent) {
  let xml = String(xmlContent || "").replace(/^\uFEFF/, "");

  // Arquivo PDF enviado por engano no campo XML
  if (xml.startsWith("%PDF") || xml.includes("%PDF-")) {
    const err = new Error(
      "O arquivo enviado parece ser um PDF. Selecione o XML da NF-e (não o DANFE em PDF).",
    );
    err.statusCode = 400;
    throw err;
  }

  const xmlLower = xml.toLowerCase();
  if (!xmlLower.includes("infnfe") && !xmlLower.includes("<nfe")) {
    const err = new Error(
      "Arquivo XML não parece ser uma NF-e válida. Use o XML baixado da SEFAZ ou do emissor (não o PDF).",
    );
    err.statusCode = 400;
    throw err;
  }

  const chaveMatch =
    xml.match(/Id=["']NFe(\d{44})["']/i) ||
    xml.match(/Id=["']NFe(\d+)["']/i) ||
    xml.match(/<(?:[\w-]+:)?chNFe>(\d{44})</i) ||
    xml.match(/<(?:[\w-]+:)?chNFe>(\d+)</i);
  const chaveRaw = chaveMatch
    ? chaveMatch[1]
    : digits(textOf(xml, "chNFe")) || "";
  const chave_acesso = chaveRaw ? chaveRaw.replace(/\D/g, "").slice(0, 44) : null;

  const ide = allBlocks(xml, "ide")[0] || xml;
  const emit = allBlocks(xml, "emit")[0] || "";
  const total = allBlocks(xml, "total")[0] || xml;

  const numero = textOf(ide, "nNF") || textOf(xml, "nNF");
  const serie = textOf(ide, "serie") || textOf(xml, "serie") || null;
  const dataRaw =
    textOf(ide, "dhEmi") || textOf(ide, "dEmi") || textOf(xml, "dhEmi");
  const emitente =
    textOf(emit, "xNome") || textOf(xml, "xNome") || null;
  const cnpj_emitente =
    digits(textOf(emit, "CNPJ") || textOf(emit, "CPF")) || null;
  const valor_total =
    toNumber(textOf(total, "vNF")) ||
    toNumber(textOf(xml, "vNF"));

  if (!numero) {
    const err = new Error("Não foi possível ler o número da NF-e no XML");
    err.statusCode = 400;
    throw err;
  }

  const dets = allBlocks(xml, "det");
  const itens = dets.map((det, index) => {
    const prod = allBlocks(det, "prod")[0] || det;
    const codigo = textOf(prod, "cProd") || null;
    const descricao = textOf(prod, "xProd") || `Item ${index + 1}`;
    const unidade = textOf(prod, "uCom") || textOf(prod, "uTrib") || "UN";
    const ncm = textOf(prod, "NCM") || null;
    const quantidade =
      toNumber(textOf(prod, "qCom")) ||
      toNumber(textOf(prod, "qTrib")) ||
      0;
    const valor_unitario =
      toNumber(textOf(prod, "vUnCom")) ||
      toNumber(textOf(prod, "vUnTrib"));
    const valor_total_item = toNumber(textOf(prod, "vProd"));

    return {
      codigo,
      descricao: descricao.slice(0, 500),
      unidade: (unidade || "UN").slice(0, 20),
      ncm: ncm ? ncm.slice(0, 20) : null,
      quantidade,
      valor_unitario,
      valor_total: valor_total_item,
    };
  });

  if (!itens.length) {
    const err = new Error("NF-e sem itens de produto");
    err.statusCode = 400;
    throw err;
  }

  return {
    chave_acesso: chave_acesso ? chave_acesso.slice(0, 44) : null,
    numero: String(numero).slice(0, 20),
    serie: serie ? String(serie).slice(0, 10) : null,
    emitente: emitente ? emitente.slice(0, 255) : null,
    cnpj_emitente: cnpj_emitente ? cnpj_emitente.slice(0, 18) : null,
    data_emissao: parseDate(dataRaw),
    valor_total,
    itens,
  };
}

export { stripNs };
