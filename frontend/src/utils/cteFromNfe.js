/** Aplica NF-e parseada no estado do formulário de CT-e. */

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function pessoaToParticipante(p, fallback = {}) {
  const base = {
    cnpj_cpf: "",
    ie: "",
    razao_social: "",
    nome_fantasia: "",
    fone: "",
    email: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    codigo_municipio: "",
    nome_municipio: "",
    uf: "",
    cep: "",
    ...fallback,
  };
  if (!p) return base;
  return {
    ...base,
    cnpj_cpf: digits(p.cnpj_cpf),
    ie: p.ie ? String(p.ie) : base.ie,
    razao_social: p.razao_social ? String(p.razao_social) : base.razao_social,
    nome_fantasia: p.nome_fantasia ? String(p.nome_fantasia) : base.nome_fantasia,
    fone: p.fone ? String(p.fone) : base.fone,
    email: p.email ? String(p.email) : base.email,
    logradouro: p.logradouro ? String(p.logradouro) : base.logradouro,
    numero: p.numero ? String(p.numero) : base.numero,
    complemento: p.complemento ? String(p.complemento) : base.complemento,
    bairro: p.bairro ? String(p.bairro) : base.bairro,
    codigo_municipio: p.codigo_municipio
      ? String(p.codigo_municipio)
      : base.codigo_municipio,
    nome_municipio: p.nome_municipio
      ? String(p.nome_municipio)
      : base.nome_municipio,
    uf: p.uf ? String(p.uf).toUpperCase().slice(0, 2) : base.uf,
    cep: p.cep ? digits(p.cep) : base.cep,
  };
}

function novoDocumentoNfe(chave) {
  return {
    tipo: "nfe",
    chave: digits(chave),
    numero: "",
    serie: "",
    data_emissao: "",
    valor: "",
  };
}

export function mergeDocumentosCte(atuais, chaves) {
  const papel = (atuais || []).filter(
    (d) => d.tipo === "nf" && String(d.numero || "").trim(),
  );
  if (papel.length) {
    return { documentos: atuais, conflitoPapel: true };
  }
  const seen = new Set();
  const out = [];
  for (const d of atuais || []) {
    if (d.tipo !== "nfe") continue;
    const ch = digits(d.chave);
    if (ch.length !== 44) continue;
    if (seen.has(ch)) continue;
    seen.add(ch);
    out.push({ ...d, chave: ch });
  }
  for (const raw of chaves) {
    const ch = digits(raw);
    if (ch.length !== 44 || seen.has(ch)) continue;
    seen.add(ch);
    out.push(novoDocumentoNfe(ch));
  }
  return {
    documentos: out.length ? out : [novoDocumentoNfe("")],
    conflitoPapel: false,
  };
}

export function resumoCargaDasNfes(notas) {
  const list = Array.isArray(notas) ? notas : [];
  let valor = 0;
  let peso = 0;
  const produtos = [];
  for (const n of list) {
    const v = Number(n.valor_total);
    if (Number.isFinite(v)) valor += v;
    const p = Number(n.peso_bruto || n.peso_liquido);
    if (Number.isFinite(p)) peso += p;
    if (n.produto_predominante) produtos.push(n.produto_predominante);
  }
  return {
    valor_carga: valor > 0 ? Math.round(valor * 100) / 100 : null,
    peso: peso > 0 ? Math.round(peso * 1000) / 1000 : null,
    produto_predominante: produtos[0] || null,
  };
}

export function matchCaminhaoPorPlacas(caminhoes, placas) {
  const wanted = (Array.isArray(placas) ? placas : [])
    .map((p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
  for (const placa of wanted) {
    const hit = (caminhoes || []).find(
      (c) =>
        String(c.placa || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "") === placa,
    );
    if (hit) return hit;
  }
  return null;
}

export function matchClientePorCnpj(clientes, cnpj) {
  const doc = digits(cnpj);
  if (doc.length < 11) return null;
  return (clientes || []).find(
    (c) => digits(c.cnpj_cpf) === doc,
  ) || null;
}

/**
 * Preenche o CT-e a partir das NF-e de carga. Não copia CFOP da mercadoria
 * (o CFOP do CT-e é de transporte, ex.: 5353/6353).
 */
export function aplicarNfesCte({
  notas,
  documentosAtuais,
  clientes,
  caminhoes,
} = {}) {
  const list = Array.isArray(notas) ? notas : [];
  const chaves = list
    .map((n) => n.chave_acesso)
    .filter((ch) => digits(ch).length === 44);
  const merge = mergeDocumentosCte(documentosAtuais, chaves);
  const resumo = resumoCargaDasNfes(list);
  const primeira = list[0] || {};
  const remetente = primeira.remetente
    ? pessoaToParticipante(primeira.remetente)
    : null;
  const destinatario = primeira.destinatario
    ? pessoaToParticipante(primeira.destinatario)
    : null;
  const cliente =
    matchClientePorCnpj(clientes, destinatario?.cnpj_cpf) ||
    matchClientePorCnpj(clientes, remetente?.cnpj_cpf);
  const placas = list.flatMap((n) => [
    n.placa_sugerida,
    ...(Array.isArray(n.placas_sugeridas) ? n.placas_sugeridas : []),
  ]);
  const caminhao = matchCaminhaoPorPlacas(caminhoes, placas);

  const formPatch = {};
  if (resumo.valor_carga != null) formPatch.valor_carga = String(resumo.valor_carga);
  if (resumo.peso != null) formPatch.peso = String(resumo.peso);
  if (resumo.produto_predominante) {
    formPatch.produto_predominante = resumo.produto_predominante;
  }
  if (remetente?.uf) formPatch.uf_ini = remetente.uf;
  if (destinatario?.uf) formPatch.uf_fim = destinatario.uf;
  if (cliente) formPatch.cliente_id = String(cliente.id);
  if (caminhao) formPatch.caminhao_id = String(caminhao.id);
  if (chaves.length) formPatch.chave_nfe_referenciada = "";

  let clienteParaCriar = null;
  if (!cliente) {
    if (destinatario?.razao_social && digits(destinatario.cnpj_cpf).length >= 11) {
      clienteParaCriar = destinatario;
    } else if (
      remetente?.razao_social &&
      digits(remetente.cnpj_cpf).length >= 11
    ) {
      clienteParaCriar = remetente;
    }
  }

  return {
    conflitoPapel: merge.conflitoPapel,
    documentos: merge.documentos,
    formPatch,
    remetente,
    destinatario,
    clienteParaCriar,
    quantidades:
      resumo.peso != null
        ? [
            {
              codigo_unidade: "01",
              tipo_medida: "PESO BRUTO",
              quantidade: String(resumo.peso),
            },
          ]
        : null,
  };
}

export { pessoaToParticipante };
