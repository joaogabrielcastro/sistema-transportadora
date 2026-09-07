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

/** Normaliza placa BR (antiga ou Mercosul). */
function normalizePlaca(placa) {
  return String(placa || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

/**
 * Extrai placas de textos livres (infAdic, observações, xPed, etc.).
 * @returns {string[]}
 */
function extractPlacasFromText(text) {
  const raw = String(text || "").toUpperCase();
  if (!raw.trim()) return [];
  const found = new Set();
  const patterns = [
    /\b([A-Z]{3}\d[A-Z]\d{2})\b/g,
    /\b([A-Z]{3}[-\s]?\d{4})\b/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(raw)) !== null) {
      const p = normalizePlaca(m[1]);
      if (p.length >= 7 && p.length <= 8) found.add(p);
    }
  }
  // "PLACA: ABC1D23" / "placa ABC1234"
  const labeled = raw.matchAll(
    /PLACA[:\s#-]*([A-Z0-9]{7,8})/g,
  );
  for (const m of labeled) {
    const p = normalizePlaca(m[1]);
    if (p.length >= 7 && p.length <= 8) found.add(p);
  }
  return [...found];
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
  const infAdic = allBlocks(xml, "infAdic")[0] || "";

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
  const valor_desconto =
    toNumber(textOf(total, "vDesc")) ||
    toNumber(textOf(xml, "vDesc"));
  const valor_frete =
    toNumber(textOf(total, "vFrete")) ||
    toNumber(textOf(xml, "vFrete"));
  const valor_ipi =
    toNumber(textOf(total, "vIPI")) ||
    toNumber(textOf(xml, "vIPI"));

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
    const valor_unitario_bruto =
      toNumber(textOf(prod, "vUnCom")) ||
      toNumber(textOf(prod, "vUnTrib"));
    const valor_prod = toNumber(textOf(prod, "vProd"));
    const valor_desconto = toNumber(textOf(prod, "vDesc")) || 0;
    const imposto = allBlocks(det, "imposto")[0] || "";
    const ipiBlock = allBlocks(imposto, "IPI")[0] || imposto;
    const valor_ipi_item = toNumber(textOf(ipiBlock, "vIPI"));
    // Custo real: (vProd - desconto) / qtd — o que a oficina pagou pela peça
    let valor_total_item = null;
    if (valor_prod != null) {
      valor_total_item =
        Math.round(Math.max(0, valor_prod - valor_desconto) * 100) / 100;
    }
    let valor_unitario = null;
    if (
      valor_total_item != null &&
      Number.isFinite(quantidade) &&
      quantidade > 0
    ) {
      valor_unitario =
        Math.round((valor_total_item / quantidade) * 10000) / 10000;
    } else if (valor_unitario_bruto != null) {
      valor_unitario = valor_unitario_bruto;
    }
    const xPed = textOf(prod, "xPed") || "";
    const cfop = textOf(prod, "CFOP") || null;
    const combBlock = allBlocks(prod, "comb")[0] || "";
    const codigo_anp = textOf(combBlock, "cANP") || textOf(prod, "cANP") || null;

    return {
      codigo,
      descricao: descricao.slice(0, 500),
      unidade: (unidade || "UN").slice(0, 20),
      ncm: ncm ? ncm.slice(0, 20) : null,
      cfop: cfop ? String(cfop).replace(/\D/g, "").slice(0, 4) : null,
      codigo_anp: codigo_anp ? String(codigo_anp).replace(/\D/g, "").slice(0, 9) : null,
      quantidade,
      valor_unitario,
      valor_unitario_bruto,
      valor_desconto: valor_desconto || null,
      valor_ipi: valor_ipi_item,
      valor_total: valor_total_item,
      _ped: xPed,
    };
  });

  if (!itens.length) {
    const err = new Error("NF-e sem itens de produto");
    err.statusCode = 400;
    throw err;
  }

  const obsText = [
    textOf(infAdic, "infCpl"),
    textOf(infAdic, "infAdFisco"),
    textOf(xml, "infCpl"),
    ...itens.map((i) => i._ped || ""),
    ...itens.map((i) => i.descricao || ""),
  ].join(" ");

  const dest = allBlocks(xml, "dest")[0] || "";
  const transp = allBlocks(xml, "transp")[0] || "";
  const veic = allBlocks(transp, "veicTransp")[0] || transp;
  const placaTransp = normalizePlaca(textOf(veic, "placa"));

  const vols = allBlocks(xml, "vol");
  let peso_bruto = 0;
  let peso_liquido = 0;
  for (const vol of vols) {
    peso_bruto += toNumber(textOf(vol, "pesoB")) || 0;
    peso_liquido += toNumber(textOf(vol, "pesoL")) || 0;
  }

  const placas_sugeridas = [
    ...extractPlacasFromText(obsText),
    ...(placaTransp.length >= 7 ? [placaTransp] : []),
  ];
  const placasUnicas = [...new Set(placas_sugeridas.filter(Boolean))];
  const itensLimpos = itens.map(({ _ped, ...rest }) => rest);

  const parsed = {
    chave_acesso: chave_acesso ? chave_acesso.slice(0, 44) : null,
    numero: String(numero).slice(0, 20),
    serie: serie ? String(serie).slice(0, 10) : null,
    emitente: emitente ? emitente.slice(0, 255) : null,
    cnpj_emitente: cnpj_emitente ? cnpj_emitente.slice(0, 18) : null,
    data_emissao: parseDate(dataRaw),
    valor_total,
    valor_desconto,
    valor_frete,
    valor_ipi,
    peso_bruto: peso_bruto || null,
    peso_liquido: peso_liquido || null,
    remetente: parsePessoaNfe(emit, "enderEmit"),
    destinatario: parsePessoaNfe(dest, "enderDest"),
    itens: itensLimpos,
    placas_sugeridas: placasUnicas,
    placa_sugerida: placasUnicas[0] || null,
  };

  parsed.uso = classificarNfe(parsed);
  parsed.produto_predominante = (itensLimpos[0]?.descricao || "").slice(0, 60) || null;
  parsed.quantidade_litros = litrosDoCombustivel(parsed);
  parsed.preco_litro = precoLitroDoCombustivel(parsed);
  const ymd = String(dataRaw || "").match(/^(\d{4}-\d{2}-\d{2})/);
  parsed.data_emissao_ymd = ymd ? ymd[1] : null;
  return parsed;
}

function parsePessoaNfe(block, enderTag) {
  if (!block) return null;
  const ender = allBlocks(block, enderTag)[0] || allBlocks(block, "ender")[0] || block;
  const doc = digits(textOf(block, "CNPJ") || textOf(block, "CPF"));
  const razao = textOf(block, "xNome");
  if (!doc && !razao) return null;
  return {
    cnpj_cpf: doc || null,
    ie: textOf(block, "IE") || null,
    razao_social: razao ? razao.slice(0, 255) : null,
    nome_fantasia: textOf(block, "xFant") || null,
    fone: digits(textOf(ender, "fone") || textOf(block, "fone")) || null,
    email: textOf(block, "email") || null,
    logradouro: textOf(ender, "xLgr") || null,
    numero: textOf(ender, "nro") || null,
    complemento: textOf(ender, "xCpl") || null,
    bairro: textOf(ender, "xBairro") || null,
    codigo_municipio: digits(textOf(ender, "cMun")) || null,
    nome_municipio: textOf(ender, "xMun") || null,
    uf: (textOf(ender, "UF") || "").toUpperCase().slice(0, 2) || null,
    cep: digits(textOf(ender, "CEP")) || null,
  };
}

const DESC_COMBUSTIVEL =
  /diesel|s-?10|s-?500|gasolina|etanol|alcool|álcool|biodiesel|\bgnv\b|oleo diesel|óleo diesel/i;

export function itemPareceCombustivel(item) {
  if (!item) return false;
  if (item.codigo_anp) return true;
  const ncm = String(item.ncm || "").replace(/\D/g, "");
  if (ncm.startsWith("2710")) return true;
  const unidade = String(item.unidade || "").toUpperCase();
  const litro = /^(L|LT|LTR|LITRO)/.test(unidade);
  return litro && DESC_COMBUSTIVEL.test(String(item.descricao || ""));
}

export function classificarNfe(parsed) {
  const itens = Array.isArray(parsed?.itens) ? parsed.itens : [];
  if (!itens.length) return "carga";
  const fuel = itens.filter(itemPareceCombustivel);
  if (fuel.length === 0) return "carga";
  if (fuel.length === itens.length || fuel.length >= Math.ceil(itens.length / 2)) {
    return "combustivel";
  }
  return "carga";
}

function litrosDoCombustivel(parsed) {
  const itens = (parsed.itens || []).filter(itemPareceCombustivel);
  const base = itens.length ? itens : parsed.uso === "combustivel" ? parsed.itens : [];
  const soma = base.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
  return soma > 0 ? Math.round(soma * 1000) / 1000 : null;
}

function precoLitroDoCombustivel(parsed) {
  const item = (parsed.itens || []).find(itemPareceCombustivel) || parsed.itens?.[0];
  const n = Number(item?.valor_unitario);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
}

export { stripNs, extractPlacasFromText, normalizePlaca, parsePessoaNfe };
