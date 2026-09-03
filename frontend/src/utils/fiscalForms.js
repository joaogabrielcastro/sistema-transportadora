// frontend/src/utils/fiscalForms.js
//
// Helpers puros compartilhados pelos formulários fiscais de transporte
// (CT-e / MDF-e). Só lógica de UX: espelham a obrigatoriedade condicional que o
// backend (fiscalSchema.js / CteService.js / MdfeService.js) já aplica como
// fonte de verdade — aqui é só para habilitar/desabilitar campos e botões e
// mostrar mensagens antes de chamar a API.

/** Remove tudo que não for dígito. */
export function somenteDigitos(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Valida o dígito verificador (módulo 11) de uma chave de acesso de 44 dígitos
 * de documento fiscal eletrônico (NF-e 55, CT-e 57, MDF-e 58). Mesma conta do
 * backend (`chaveAcessoValida` em utils/fiscalDocs.js) — usada no item 1.2 para
 * validar a chave da NF-e transportada ANTES de enviar.
 * @param {string} chave
 * @returns {boolean}
 */
export function chave44Valida(chave) {
  const c = somenteDigitos(chave);
  if (!/^\d{44}$/.test(c)) return false;
  const corpo = c.substring(0, 43);
  const dvInformado = parseInt(c.charAt(43), 10);
  let peso = 2;
  let soma = 0;
  for (let i = corpo.length - 1; i >= 0; i--) {
    soma += parseInt(corpo.charAt(i), 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dvCalculado = resto < 2 ? 0 : 11 - resto;
  return dvCalculado === dvInformado;
}

/**
 * CRT do emitente: 1 = Simples Nacional, 2 = SN excesso de sublimite,
 * 3 = Regime Normal, 4 = MEI. Para o grupo IBS/CBS do CT-e, 1, 2 e 4 são
 * tratados como Simples Nacional (dispensados do grupo). Mesma regra de
 * `regimeSimplesNacional` no CteService.
 * @param {number|string|null|undefined} crt
 */
export function regimeSimplesNacional(crt) {
  const n = crt == null || crt === "" ? null : Number(crt);
  return n === 1 || n === 2 || n === 4;
}

/** Mesma data do CteService: IBS/CBS obrigatório para CRT 3 a partir daqui. */
export const IBSCBS_OBRIGATORIO_DESDE = new Date("2026-01-05T00:00:00Z");

/**
 * O grupo imp.IBSCBS do CT-e só é exibido/exigido quando a empresa emitente tem
 * CRT cadastrado, NÃO é Simples Nacional (CRT 3 — Regime Normal) e a data de
 * emissão é >= 05/01/2026. Quando o CRT não está cadastrado, a emissão é
 * bloqueada em outra checagem (`empresaFiscalSemCrt`) e este grupo não aparece.
 * @param {number|string|null|undefined} crt
 * @param {Date|string|number} [dtEmissao]
 */
export function exigeGrupoIbsCbs(crt, dtEmissao = new Date()) {
  if (crt == null || crt === "") return false;
  if (regimeSimplesNacional(crt)) return false;
  const emissao = dtEmissao instanceof Date ? dtEmissao : new Date(dtEmissao);
  if (Number.isNaN(emissao.getTime()) || emissao < IBSCBS_OBRIGATORIO_DESDE) {
    return false;
  }
  return true;
}

/**
 * A empresa fiscal (CNPJ emissor) está sem CRT — bloqueia a emissão de CT-e na
 * tela, com mensagem clara, sem oferecer edição aqui (o cadastro de empresa
 * fiscal é outra área do sistema).
 * @param {{crt?: number|string|null}|null|undefined} empresa
 */
export function empresaFiscalSemCrt(empresa) {
  return !empresa || empresa.crt == null || empresa.crt === "";
}

/**
 * Resolve a empresa fiscal emissora "ativa" a partir da lista devolvida por
 * GET /fiscal/empresas (ordenada por ativo desc, razão social asc no backend):
 * a primeira ativa, ou a primeira da lista, ou null.
 * @param {Array<{ativo?: boolean}>} lista
 */
export function resolverEmpresaFiscalAtiva(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return null;
  return lista.find((e) => e && e.ativo !== false) ?? lista[0] ?? null;
}

/**
 * infDoc do CT-e (item 1.2): os grupos infNFe (modelo 55) e infNF (01/1B) são
 * exclusivos — não pode haver documento 'nfe' e 'nf' no mesmo CT-e. Espelha o
 * superRefine de `emitirCteSchema`. `tipos` é a lista de `tipo` de cada
 * documento (inclui o da chave legada, quando informada).
 * @param {Array<string>} tipos
 */
export function tiposDocumentoConflitantes(tipos) {
  const set = new Set((tipos || []).filter(Boolean));
  return set.has("nfe") && set.has("nf");
}

/**
 * Um documento infDoc está preenchido o suficiente para contar na exigência de
 * ">= 1 documento": 'nfe' precisa de chave de 44 dígitos válida; 'nf' e 'outros'
 * precisam de número.
 * @param {{tipo?: string, chave?: string, numero?: string}} doc
 */
export function documentoInfDocValido(doc) {
  if (!doc) return false;
  if (doc.tipo === "nfe") return chave44Valida(doc.chave);
  if (doc.tipo === "nf" || doc.tipo === "outros") {
    return String(doc.numero ?? "").trim().length > 0;
  }
  return false;
}

/**
 * Grupo ICMSUFFim / DIFAL do CT-e (item 1.3 / PARTE 4.3): a seção só aparece — e
 * o backend só exige o grupo — quando as TRÊS condições valem ao mesmo tempo:
 *  - operação interestadual: `ufIni` e `ufFim` informados e diferentes;
 *  - tomador não contribuinte de ICMS: `tomadorIndIe` === 9;
 *  - tomador diferente do remetente (comparando só os dígitos do CNPJ/CPF).
 * Espelha `validarIcmsUfFimCte` no CteService. Qualquer condição falsa (ou dados
 * insuficientes para avaliá-la) esconde a seção.
 * @param {{ufIni?: string, ufFim?: string, tomadorIndIe?: number|string,
 *          tomadorDoc?: string, remetenteDoc?: string}} args
 */
export function mostrarDifalCte({
  ufIni,
  ufFim,
  tomadorIndIe,
  tomadorDoc,
  remetenteDoc,
} = {}) {
  const ini = ufIni ? String(ufIni).trim().toUpperCase() : "";
  const fim = ufFim ? String(ufFim).trim().toUpperCase() : "";
  if (!ini || !fim || ini === fim) return false;
  if (Number(tomadorIndIe) !== 9) return false;
  const tDoc = somenteDigitos(tomadorDoc);
  const rDoc = somenteDigitos(remetenteDoc);
  if (tDoc && rDoc && tDoc === rDoc) return false;
  return true;
}

/**
 * Grupos infANTT (2.2), prodPred (2.4) e o bloqueio de seguro (2.1) do MDF-e só
 * são exigidos quando o emitente se declara prestador de serviço de transporte:
 * tipo_emitente 1 (prestador) ou 3 (prestador CT-e globalizado). Ausente ou 2
 * (carga própria / frota própria) não exige. Mesma regra de `exigeGruposAntt`
 * no MdfeService.
 * @param {number|string|null|undefined} tipoEmitente
 */
export function mdfeExigeGruposAntt(tipoEmitente) {
  const n =
    tipoEmitente == null || tipoEmitente === "" ? null : Number(tipoEmitente);
  return n === 1 || n === 3;
}
