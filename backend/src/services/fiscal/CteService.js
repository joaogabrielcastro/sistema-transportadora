import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";
import { emitirCteSchema } from "../../schemas/fiscalSchema.js";
import { somenteDigitos } from "../../utils/fiscalDocs.js";
import { decryptSecret } from "../../utils/fiscalCrypto.js";
import { CteMdfeProviderClient } from "./CteMdfeProviderClient.js";
import {
  assertTenantFk,
  extrairNumeroProtocolo,
  findOwnedOr404,
  montarGrupoSeguro,
  montarPayloadCancelamento,
  resolveEmpresaCteMdfe,
  salvarPdfBase64,
  salvarXmlBase64,
} from "./fiscalShared.js";

const MODELO_DOCUMENTO_CTE = "57";

// Grupo imp.IBSCBS do CT-e 4.0 (Reforma Tributária) passou a ser exigido em
// produção pela SEFAZ a partir desta data para emitentes fora do Simples
// Nacional. Emissões anteriores a ela seguem sem o grupo.
const IBSCBS_OBRIGATORIO_DESDE = new Date("2026-01-05T00:00:00Z");

function badRequest(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

// `extrairNumeroProtocolo` foi movida para fiscalShared.js (PARTE 3) para o
// MdfeService reaproveitar a mesma lógica na emissão. Reexportada aqui para não
// quebrar quem já a importava de CteService.
export { extrairNumeroProtocolo };

/**
 * CRT do emitente: 1 = Simples Nacional, 2 = SN excesso de sublimite,
 * 3 = Regime Normal, 4 = MEI. Para efeito do grupo IBS/CBS do CT-e, 1, 2 e 4
 * são tratados como Simples Nacional (dispensados do grupo); só o regime normal
 * (CRT 3) exige o grupo IBS/CBS.
 */
export function regimeSimplesNacional(crt) {
  return crt === 1 || crt === 2 || crt === 4;
}

/**
 * Bloqueia a emissão com erro claro (400) quando a empresa emissora está sem
 * CRT cadastrado — nunca deixa quebrar/crashar montando payload sem o campo.
 */
export function assertEmpresaCrt(empresa) {
  if (empresa?.crt == null) {
    throw badRequest(
      "A empresa fiscal (CNPJ emissor) está sem CRT (Código de Regime " +
        "Tributário) cadastrado — informe o CRT em Empresas fiscais antes de " +
        "emitir CT-e.",
    );
  }
}

/**
 * Exige o grupo imp.IBSCBS quando o emitente NÃO é Simples Nacional e a data de
 * emissão é >= 05/01/2026. Não lança para Simples Nacional nem para emissões
 * anteriores à data — obrigatoriedade nova, só para emissão nova daqui pra frente.
 */
export function validarImpostoCte(dto, empresa, dtEmissao) {
  if (regimeSimplesNacional(empresa?.crt)) return;
  const emissao = new Date(dtEmissao);
  if (Number.isNaN(emissao.getTime()) || emissao < IBSCBS_OBRIGATORIO_DESDE) {
    return;
  }
  const ibs = dto.ibscbs ?? {};
  const temValor =
    ibs.base != null ||
    ibs.cbs_valor != null ||
    ibs.ibs_uf_valor != null ||
    ibs.ibs_mun_valor != null ||
    ibs.valor_total != null;
  if (!ibs.cst || !temValor) {
    throw badRequest(
      "Grupo IBS/CBS (imp.IBSCBS) é obrigatório para emitente fora do Simples " +
        "Nacional desde 05/01/2026 — informe ibscbs.cst e os valores de IBS/CBS.",
    );
  }
}

/**
 * Grupo ICMSUFFim / DIFAL (item 1.3). Exige o grupo `difal` preenchido quando,
 * e SOMENTE quando, as três condições valem ao mesmo tempo:
 *  - operação interestadual: uf_ini e uf_fim informados e diferentes;
 *  - tomador não contribuinte de ICMS: tomador_ind_ie === 9;
 *  - tomador diferente do remetente (comparando CNPJ/CPF só-dígitos).
 * Qualquer condição falsa (inclusive dados insuficientes para avaliá-la) NÃO
 * dispara a exigência — obrigatoriedade nova, só para a emissão nova. CT-e já
 * emitidos não passam por aqui.
 */
export function validarIcmsUfFimCte(dto) {
  const ufIni = dto.uf_ini ? String(dto.uf_ini).toUpperCase() : null;
  const ufFim = dto.uf_fim ? String(dto.uf_fim).toUpperCase() : null;
  if (!ufIni || !ufFim || ufIni === ufFim) return;
  if (dto.tomador_ind_ie !== 9) return;
  const tomadorDoc = somenteDigitos(dto.tomador?.cpf_cnpj);
  const remetenteDoc = somenteDigitos(dto.remetente?.cnpj_cpf);
  if (tomadorDoc && remetenteDoc && tomadorDoc === remetenteDoc) return;
  const d = dto.difal ?? {};
  const temValor =
    d.vbc_uf_fim != null ||
    d.v_icms_uf_fim != null ||
    d.p_icms_uf_fim != null ||
    d.v_icms_uf_ini != null;
  if (!temValor) {
    throw badRequest(
      "Grupo ICMSUFFim (partilha do ICMS / DIFAL) é obrigatório: operação " +
        "interestadual com tomador não contribuinte de ICMS e diferente do " +
        "remetente — informe difal.vbc_uf_fim, difal.p_icms_uf_fim e os valores " +
        "de ICMS para a UF de fim e de início.",
    );
  }
}

/**
 * Normaliza os documentos transportados (grupo infDoc). Funde a
 * `chave_nfe_referenciada` legada (conta como 1 documento 'nfe') com o array
 * `documentos[]`. Exige >= 1 documento — obrigatoriedade nova, cobrada só na
 * emissão nova (o campo legado continua satisfazendo a regra).
 *
 * @returns {Array<{tipo:string,chave_acesso:string|null,numero:string|null,serie:string|null,data_emissao:string|null,valor:number|null}>}
 */
export function normalizarDocumentosCte(dto) {
  const docs = [];
  if (dto.chave_nfe_referenciada) {
    docs.push({ tipo: "nfe", chave_acesso: dto.chave_nfe_referenciada });
  }
  if (Array.isArray(dto.documentos)) {
    for (const d of dto.documentos) {
      docs.push({
        tipo: d.tipo,
        chave_acesso: d.chave ?? null,
        numero: d.numero ?? null,
        serie: d.serie ?? null,
        data_emissao: d.data_emissao ?? null,
        valor: d.valor ?? null,
      });
    }
  }
  if (docs.length === 0) {
    throw badRequest(
      "Informe ao menos um documento transportado (grupo infDoc) antes de " +
        "emitir o CT-e.",
    );
  }
  return docs.map((d) => ({
    tipo: d.tipo,
    chave_acesso: d.chave_acesso ?? null,
    numero: d.numero ?? null,
    serie: d.serie ?? null,
    data_emissao: d.data_emissao ?? null,
    valor: d.valor ?? null,
  }));
}

/**
 * Monta o bloco `Emit` (emit.CRT / emit.IE) do CT-e a partir da empresa
 * emissora. Retorna undefined quando não há empresa (chamadas de teste do
 * payload puro que passam só 2 argumentos).
 */
export function montarEmit(empresa) {
  if (!empresa) return undefined;
  const emit = {};
  if (empresa.crt != null) emit.CRT = empresa.crt;
  if (empresa.inscricao_estadual) emit.IE = empresa.inscricao_estadual;
  return Object.keys(emit).length > 0 ? emit : undefined;
}

/**
 * Monta o grupo `seg` (seguro da carga) do CT-e — item 1.6. Traduz o objeto
 * `seg` aninhado do DTO para os nomes de campo que `montarGrupoSeguro`
 * (compartilhado com o MDF-e) espera. Opcional: sem `seg`, devolve undefined.
 */
export function montarSegCte(dto) {
  const seg = dto.seg;
  if (seg == null || typeof seg !== "object") return undefined;
  return montarGrupoSeguro({
    seguros: seg.seguros,
    resp_seg: seg.responsavel,
    cnpj_seguradora: seg.cnpj_seguradora,
    numero_apolice: seg.numero_apolice,
    numero_averbacao: seg.numero_averbacao,
  });
}

/**
 * Normaliza o grupo `autXML` (item 1.1): terceiros autorizados a baixar o XML.
 * Aceita cada item como string ("12345678000199") ou objeto ({ cnpj_cpf }).
 * Puramente opcional — sem `aut_xml`, devolve `[]`; NENHUMA exigência de
 * preenchimento (o CT-e é emitido normalmente com 0 autorizados).
 *
 * @returns {Array<{cnpj_cpf: string|null}>}
 */
export function normalizarAutXmlCte(dto) {
  const itens = Array.isArray(dto.aut_xml) ? dto.aut_xml : [];
  return itens
    .map((item) => {
      if (item == null) return null;
      if (typeof item === "string") {
        const doc = somenteDigitos(item);
        return doc ? { cnpj_cpf: doc } : null;
      }
      const doc = somenteDigitos(item.cnpj_cpf);
      return { cnpj_cpf: doc || null };
    })
    .filter((linha) => linha != null && linha.cnpj_cpf != null);
}

/**
 * Monta o grupo `autXML` do payload do provedor. Vazio => undefined (não altera
 * o payload atual de quem não usa o grupo).
 *
 * OBS: o nome do campo no JSON do provedor NÃO foi confirmado em sandbox (ver
 * relatório) — enviado como `AutXML: [{ CnpjCpf }]`, conservador.
 */
export function montarAutXmlCte(dto) {
  const linhas = normalizarAutXmlCte(dto);
  if (linhas.length === 0) return undefined;
  return linhas.map((l) => ({ CnpjCpf: l.cnpj_cpf }));
}

/**
 * Colunas de contingência (1.2), preparação de split payment (1.3) e do grupo
 * infTribFed (1.4) a persistir em fiscal_ctes. Todos os campos são opcionais e
 * não bloqueiam emissão. As colunas Json (`inf_solic_nff`, `pagamento_antecipado`)
 * só entram quando há valor — mesmo cuidado de `colunasRntrcSnapshot` no CIOT
 * (não gravar null cru em campo Json).
 */
export function colunasContingenciaTribFed(dto) {
  const cont = dto.contingencia ?? {};
  const tribFed = dto.trib_fed ?? {};
  const cols = {
    dh_contingencia: cont.dh_contingencia
      ? new Date(cont.dh_contingencia)
      : null,
    justificativa_contingencia: cont.justificativa ?? null,
    pis_valor: tribFed.pis_valor ?? null,
    cofins_valor: tribFed.cofins_valor ?? null,
    ir_valor: tribFed.ir_valor ?? null,
    inss_valor: tribFed.inss_valor ?? null,
    csll_valor: tribFed.csll_valor ?? null,
  };
  if (cont.inf_solic_nff != null) cols.inf_solic_nff = cont.inf_solic_nff;
  if (dto.pagamento_antecipado != null) {
    cols.pagamento_antecipado = dto.pagamento_antecipado;
  }
  return cols;
}

/**
 * Monta o grupo `infRespTec` (responsável técnico pelo sistema emissor) — item
 * 1.4 — a partir da empresa fiscal. Retorna undefined quando não há empresa ou
 * quando o CNPJ do responsável técnico não está cadastrado (nesse caso a
 * emissão NÃO é bloqueada; o aviso é registrado em log no `emitir`).
 *
 * `empresa.resp_tec_csrt` aqui já deve vir DECIFRADO (o `emitir` passa uma cópia
 * da empresa com o segredo aberto); o hash do CSRT, se o provedor exigir, é
 * responsabilidade do integrador — não foi confirmado em sandbox.
 */
export function montarInfRespTec(empresa) {
  if (!empresa?.resp_tec_cnpj) return undefined;
  const info = {
    CNPJ: empresa.resp_tec_cnpj,
    xContato: empresa.resp_tec_contato ?? undefined,
    email: empresa.resp_tec_email ?? undefined,
    fone: empresa.resp_tec_fone ?? undefined,
    idCSRT: empresa.resp_tec_id_csrt ?? undefined,
    CSRT: empresa.resp_tec_csrt ?? undefined,
  };
  return info;
}

/**
 * Monta o bloco `Imposto` do CT-e. Quando nenhum campo estruturado novo
 * (dto.icms / dto.ibscbs) veio, devolve exatamente `dto.imposto ?? undefined`
 * (preserva o payload atual). Quando veio, mescla ICMS / IBSCBS sobre o objeto
 * livre `imposto`, sem descartar o que o chamador já enviou.
 */
export function montarImpCte(dto) {
  const icms = dto.icms ?? {};
  const ibs = dto.ibscbs ?? {};
  const difal = dto.difal ?? {};
  const tribFed = dto.trib_fed ?? {};
  const temIcms = Object.values(icms).some((v) => v != null);
  const temIbscbs = Object.values(ibs).some((v) => v != null);
  const temDifal = Object.values(difal).some((v) => v != null);
  const temTribFed = Object.values(tribFed).some((v) => v != null);
  if (!temIcms && !temIbscbs && !temDifal && !temTribFed) {
    return dto.imposto ?? undefined;
  }

  const imp = { ...(dto.imposto ?? {}) };
  if (temDifal) {
    // Grupo Difal do provedor (o que a SEFAZ chama ICMSUFFim / partilha do ICMS
    // para a UF de destino). Nomes CONFIRMADOS no payload real do provedor.
    // `PercentualPartilhaICMS` só entra quando o DTO trouxe `difal.p_partilha_icms`.
    imp.Difal = {
      ...(imp.Difal ?? {}),
      BaseCalculoUfDestino: difal.vbc_uf_fim ?? undefined,
      PercentualFCPUfDestino: difal.p_fcp_uf_fim ?? undefined,
      AliquotaICMSUfDestino: difal.p_icms_uf_fim ?? undefined,
      AliquotaInterestadual: difal.p_icms_inter ?? undefined,
      PercentualPartilhaICMS: difal.p_partilha_icms ?? undefined,
      ValorFCPUfDestino: difal.v_fcp_uf_fim ?? undefined,
      ValorICMSUfDestino: difal.v_icms_uf_fim ?? undefined,
      ValorICMSUfInicio: difal.v_icms_uf_ini ?? undefined,
    };
  }
  if (temIcms) {
    // Grupo Imposto.ICMS — nomes CONFIRMADOS no payload real do provedor.
    // `AliquotaOutraUF` / `ValorICMSOutraUF` só entram quando o DTO os traz.
    imp.ICMS = {
      ...(imp.ICMS ?? {}),
      CST: icms.cst ?? undefined,
      BaseCalculo: icms.base ?? undefined,
      Aliquota: icms.aliquota ?? undefined,
      Valor: icms.valor ?? undefined,
      PercentualReducaoBaseCalculo: icms.reducao_base ?? undefined,
      AliquotaOutraUF: icms.aliquota_outra_uf ?? undefined,
      ValorICMSOutraUF: icms.valor_outra_uf ?? undefined,
    };
  }
  if (temIbscbs) {
    // Grupo Imposto.IBSCBS — o provedor NÃO pede valor calculado (nada de
    // ibs_uf_valor / cbs_valor / valor_total) nem CST separado nesse grupo: só
    // o código de classificação tributária, a base de cálculo, as alíquotas de
    // IBS (UF e município) e CBS e os percentuais de redução / diferimento. Os
    // valores calculados de IBS/CBS continuam persistidos nas colunas de
    // fiscal_ctes para consulta interna, mas não vão no payload. Cada chave só
    // entra quando tem valor. Nomes CONFIRMADOS no payload real do provedor.
    imp.IBSCBS = {
      ...(imp.IBSCBS ?? {}),
      CodClassificacaoTributaria: ibs.c_class_trib ?? undefined,
      BaseCalculo: ibs.base ?? undefined,
      AliquotaIBSUF: ibs.ibs_uf_aliquota ?? undefined,
      AliquotaIBSMun: ibs.ibs_mun_aliquota ?? undefined,
      AliquotaCBS: ibs.cbs_aliquota ?? undefined,
      PercentualReducaoIBS: ibs.percentual_reducao_ibs ?? undefined,
      PercentualReducaoCBS: ibs.percentual_reducao_cbs ?? undefined,
      PercentualDiferimento: ibs.percentual_diferimento ?? undefined,
    };
  }
  if (temTribFed) {
    // Grupo Imposto.TributosFederal do CT-e (1.4 / 0.8): totalizadores de
    // tributos federais. O CT-e não tem CST/base/alíquota de PIS/COFINS (isso é
    // da NF-e) — não modelar. Nenhum cálculo: passthrough puro. Cada chave só
    // entra quando tem valor, para o payload de quem só informa PIS/COFINS não
    // mudar. Nomes CONFIRMADOS no payload real do provedor.
    const tributosFederal = { ...(imp.TributosFederal ?? {}) };
    const totFed = [
      ["ValorPis", tribFed.pis_valor],
      ["ValorCofins", tribFed.cofins_valor],
      ["ValorIr", tribFed.ir_valor],
      ["ValorInss", tribFed.inss_valor],
      ["ValorCsll", tribFed.csll_valor],
    ];
    for (const [chave, valor] of totFed) {
      if (valor != null) tributosFederal[chave] = valor;
    }
    imp.TributosFederal = tributosFederal;
  }
  return imp;
}

/** Valores das colunas novas (imp / infCarga / ide.toma) a persistir em fiscal_ctes. */
function colunasImpostoCarga(dto) {
  const icms = dto.icms ?? {};
  const ibs = dto.ibscbs ?? {};
  const carga = dto.carga ?? {};
  const difal = dto.difal ?? {};
  const seg = dto.seg ?? {};
  return {
    toma: dto.toma ?? null,
    seg_responsavel: seg.responsavel ?? null,
    seg_cnpj_seguradora: seg.cnpj_seguradora ?? null,
    seg_numero_apolice: seg.numero_apolice ?? null,
    seg_numero_averbacao: seg.numero_averbacao ?? null,
    seg_nome_seguradora: seg.nome_seguradora ?? null,
    uf_ini: dto.uf_ini ? String(dto.uf_ini).toUpperCase() : null,
    uf_fim: dto.uf_fim ? String(dto.uf_fim).toUpperCase() : null,
    tomador_ind_ie: dto.tomador_ind_ie ?? null,
    difal_vbc_uf_fim: difal.vbc_uf_fim ?? null,
    difal_p_fcp_uf_fim: difal.p_fcp_uf_fim ?? null,
    difal_p_icms_uf_fim: difal.p_icms_uf_fim ?? null,
    difal_p_icms_inter: difal.p_icms_inter ?? null,
    difal_v_fcp_uf_fim: difal.v_fcp_uf_fim ?? null,
    difal_v_icms_uf_fim: difal.v_icms_uf_fim ?? null,
    difal_v_icms_uf_ini: difal.v_icms_uf_ini ?? null,
    icms_uf_fim_percentual_partilha: difal.p_partilha_icms ?? null,
    icms_cst: icms.cst ?? null,
    icms_base: icms.base ?? null,
    icms_aliquota: icms.aliquota ?? null,
    icms_valor: icms.valor ?? null,
    icms_reducao_base: icms.reducao_base ?? null,
    icms_aliquota_outra_uf: icms.aliquota_outra_uf ?? null,
    icms_valor_outra_uf: icms.valor_outra_uf ?? null,
    ibscbs_cst: ibs.cst ?? null,
    ibscbs_c_class_trib: ibs.c_class_trib ?? null,
    ibscbs_base: ibs.base ?? null,
    ibs_uf_valor: ibs.ibs_uf_valor ?? null,
    ibs_mun_valor: ibs.ibs_mun_valor ?? null,
    cbs_valor: ibs.cbs_valor ?? null,
    ibscbs_valor_total: ibs.valor_total ?? null,
    ibs_uf_aliquota: ibs.ibs_uf_aliquota ?? null,
    ibs_mun_aliquota: ibs.ibs_mun_aliquota ?? null,
    cbs_aliquota: ibs.cbs_aliquota ?? null,
    ibscbs_percentual_reducao_ibs: ibs.percentual_reducao_ibs ?? null,
    ibscbs_percentual_reducao_cbs: ibs.percentual_reducao_cbs ?? null,
    ibscbs_percentual_diferimento: ibs.percentual_diferimento ?? null,
    valor_carga: carga.valor_carga ?? null,
    produto_predominante: carga.produto_predominante ?? null,
    outras_caracteristicas: carga.outras_caracteristicas ?? null,
  };
}

/**
 * Monta o bloco Carga: repassa o que veio no DTO e acrescenta os documentos
 * transportados em `Documentos[]` — a `chave_nfe_referenciada` legada e cada
 * item de `documentos[]` (grupo infDoc). Campos planos do infCarga
 * (valor_carga / produto_predominante / outras_caracteristicas) e o grupo
 * `quantidades` (infQ) já fluem pelo spread de `dto.carga`.
 */
export function montarCarga(dto) {
  const base = dto.carga ? { ...dto.carga } : undefined;
  const extras = [];
  if (dto.chave_nfe_referenciada) {
    extras.push({ chave: dto.chave_nfe_referenciada });
  }
  if (Array.isArray(dto.documentos)) {
    for (const d of dto.documentos) {
      if (d.tipo === "nfe" && d.chave) {
        extras.push({ chave: d.chave });
      } else if (d.tipo === "nf") {
        extras.push({
          numero: d.numero ?? undefined,
          serie: d.serie ?? undefined,
          dataEmissao: d.data_emissao ?? undefined,
          valor: d.valor ?? undefined,
        });
      } else {
        extras.push({ ...d });
      }
    }
  }
  if (extras.length === 0) return base;
  const carga = base ?? {};
  const documentos = Array.isArray(carga.documentos)
    ? [...carga.documentos, ...extras]
    : [...extras];
  return { ...carga, documentos };
}

/**
 * Monta o bloco `Servico` (grupo vPrest). Repassa `dto.servico` como está e, se
 * vieram `componentes` (grupo vPrest.Comp da SEFAZ), os traduz para
 * `Componentes[]` sem descartar nada que o chamador já enviou. Sem componentes,
 * devolve exatamente `dto.servico ?? undefined` (preserva o payload atual).
 *
 * PARTE 4: o nome do grupo no payload do provedor é `Servico.Componentes`
 * (descritivo), não a abreviação `Comp` do XSD da SEFAZ. As chaves internas de
 * cada item também são as descritivas do provedor — `{ Nome, Valor }` (palavra
 * inteira, sem o prefixo `x`/`v` do XSD) — formato CONFIRMADO no payload real do
 * provedor.
 */
export function montarServico(dto) {
  const servico = dto.servico ?? undefined;
  const componentes = Array.isArray(servico?.componentes)
    ? servico.componentes
    : [];
  if (componentes.length === 0) return servico;
  const { componentes: _c, ...rest } = servico;
  return {
    ...rest,
    Componentes: componentes.map((c) => ({
      Nome: c.nome,
      Valor: c.valor ?? undefined,
    })),
  };
}

/**
 * Traduz o DTO para o payload do provedor. `chaveReferenciada` é a chave de
 * acesso do CT-e original (Complemento/Substituto), quando aplicável.
 *
 * OBS: o nome exato do campo do CT-e referenciado no JSON do provedor NÃO foi
 * confirmado em sandbox (ver relatório) — enviado como `ChaveCteReferenciado`.
 */
export function montarPayloadCte(dto, chaveReferenciada, empresa) {
  return {
    ModeloDocumento: MODELO_DOCUMENTO_CTE,
    TipoAmbiente: config.fiscal.ambiente,
    TipoCte: dto.tipo_cte,
    // Chave do CT-e original. Mantido o campo genérico (nome exato do provedor
    // ainda não confirmado em sandbox) + os grupos explícitos infCteComp (tipo
    // 1) e infCteSub (tipo 3, com indAlteraToma) — item 1.5.
    ChaveCteReferenciado: chaveReferenciada ?? undefined,
    infCteComp:
      dto.tipo_cte === "1" && chaveReferenciada
        ? { chave: chaveReferenciada }
        : undefined,
    infCteSub:
      dto.tipo_cte === "3" && chaveReferenciada
        ? {
            chave: chaveReferenciada,
            indAlteraToma: dto.ind_alt_toma === true ? 1 : undefined,
          }
        : undefined,
    Cfop: dto.cfop,
    NaturezaOperacao: dto.natureza_operacao,
    DtEmissao: dto.dt_emissao,
    UFIni: dto.uf_ini ?? undefined,
    UFFim: dto.uf_fim ?? undefined,
    Emit: montarEmit(empresa),
    infRespTec: montarInfRespTec(empresa),
    Modal: dto.modal ?? undefined,
    Carga: montarCarga(dto),
    Imposto: montarImpCte(dto),
    Servico: montarServico(dto),
    Seg: montarSegCte(dto),
    // autXML (1.1): terceiros autorizados a baixar o XML. Nome do campo no JSON
    // do provedor não confirmado em sandbox — enviado conservador (ver relatório).
    AutXML: montarAutXmlCte(dto),
    // Contingência (1.2): dhCont / xJust / infSolicNFF. infSolicNFF é repassado
    // como veio (estrutura pendente do XSD oficial).
    DhCont: dto.contingencia?.dh_contingencia ?? undefined,
    XJust: dto.contingencia?.justificativa ?? undefined,
    infSolicNFF: dto.contingencia?.inf_solic_nff ?? undefined,
    // Preparação split payment / pagamento antecipado (1.3) — passthrough puro.
    PagamentoAntecipado: dto.pagamento_antecipado ?? undefined,
    Toma: dto.toma ?? undefined,
    Tomador: dto.tomador,
    Destinatario: dto.destinatario ?? undefined,
    Remetente: dto.remetente ?? undefined,
    Expedidor: dto.expedidor ?? undefined,
    Recebedor: dto.recebedor ?? undefined,
  };
}

/**
 * Extrai os participantes tipados do DTO (rem / dest / exped / receb / toma)
 * para gravar em fiscal_cte_participantes. Ignora papéis ausentes. O campo
 * `endereco` aninhado é achatado nas colunas da tabela. Itens 1.2 e 0.7 — o
 * Tomador é gravado como participante completo e independente (não um
 * indicador); seu documento chega no campo `cpf_cnpj` (os demais usam
 * `cnpj_cpf`).
 */
export function normalizarParticipantesCte(dto) {
  const PAPEIS = [
    ["remetente", "rem"],
    ["destinatario", "dest"],
    ["expedidor", "exped"],
    ["recebedor", "receb"],
    ["tomador", "toma"],
  ];
  const linhas = [];
  for (const [campo, papel] of PAPEIS) {
    const p = dto[campo];
    if (p == null || typeof p !== "object") continue;
    const e = p.endereco ?? {};
    linhas.push({
      papel,
      cnpj_cpf: p.cnpj_cpf ?? p.cpf_cnpj ?? null,
      ie: p.ie ?? null,
      razao_social: p.razao_social ?? null,
      nome_fantasia: p.nome_fantasia ?? null,
      fone: p.fone ?? null,
      email: p.email ?? null,
      logradouro: e.logradouro ?? null,
      numero: e.numero ?? null,
      complemento: e.complemento ?? null,
      bairro: e.bairro ?? null,
      codigo_municipio: e.codigo_municipio ?? null,
      nome_municipio: e.nome_municipio ?? null,
      uf: e.uf ?? null,
      cep: e.cep ?? null,
      codigo_pais: e.codigo_pais ?? null,
      nome_pais: e.nome_pais ?? null,
    });
  }
  return linhas;
}

export class CteService {
  static async list(tenantId, { status } = {}) {
    const where = { tenant_id: Number(tenantId) };
    if (status) where.status = String(status);
    const rows = await prisma.fiscal_ctes.findMany({
      where,
      orderBy: { criado_em: "desc" },
    });
    return serializePrisma(rows);
  }

  static async getById(tenantId, id) {
    const row = await findOwnedOr404("fiscal_ctes", id, tenantId, "CT-e");
    const [
      documentos,
      cargaQuantidades,
      componentesFrete,
      participantes,
      autXml,
    ] = await Promise.all([
      prisma.fiscal_cte_documentos.findMany({
        where: { cte_id: row.id },
        orderBy: { id: "asc" },
      }),
      prisma.fiscal_cte_carga_quantidades.findMany({
        where: { cte_id: row.id },
        orderBy: { id: "asc" },
      }),
      prisma.fiscal_cte_componentes_frete.findMany({
        where: { cte_id: row.id },
        orderBy: { id: "asc" },
      }),
      prisma.fiscal_cte_participantes.findMany({
        where: { cte_id: row.id },
        orderBy: { id: "asc" },
      }),
      prisma.fiscal_cte_aut_xml.findMany({
        where: { cte_id: row.id },
        orderBy: { id: "asc" },
      }),
    ]);
    return {
      ...serializePrisma(row),
      documentos: serializePrisma(documentos),
      carga_quantidades: serializePrisma(cargaQuantidades),
      componentes_frete: serializePrisma(componentesFrete),
      participantes: serializePrisma(participantes),
      aut_xml: serializePrisma(autXml),
    };
  }

  static async emitir(tenantId, body) {
    const dto = emitirCteSchema.parse(body);

    const cliente = await findOwnedOr404(
      "fiscal_clientes",
      dto.cliente_id,
      tenantId,
      "Cliente",
    );
    const caminhaoId = await assertTenantFk(
      "caminhoes",
      dto.caminhao_id,
      tenantId,
      "Caminhão",
      { optional: true },
    );
    const motoristaId = await assertTenantFk(
      "motoristas",
      dto.motorista_id,
      tenantId,
      "Motorista",
      { optional: true },
    );

    // Complemento (1) / Substituto (3): confirma o CT-e original no mesmo tenant.
    let chaveReferenciada;
    let cteReferenciadoId = null;
    if (dto.tipo_cte === "1" || dto.tipo_cte === "3") {
      const original = await findOwnedOr404(
        "fiscal_ctes",
        dto.cte_referenciado_id,
        tenantId,
        "CT-e referenciado",
      );
      if (original.status !== "processado") {
        throw badRequest(
          "O CT-e referenciado precisa estar com status \"processado\" para receber Complemento ou Substituto.",
        );
      }
      chaveReferenciada = original.chave_acesso;
      cteReferenciadoId = original.id;
    }

    if (dto.tomador.cpf_cnpj !== cliente.cnpj_cpf) {
      throw badRequest(
        "O CNPJ/CPF do tomador não corresponde ao cliente vinculado (cliente_id).",
      );
    }

    const { empresa, token } = await resolveEmpresaCteMdfe(
      tenantId,
      dto.fiscal_empresa_id,
    );

    // Validações que precisam rodar ANTES da chamada irreversível ao provedor:
    // CRT da empresa emissora (1.4), >= 1 documento infDoc (1.2) e grupo
    // IBS/CBS quando o emitente não é Simples Nacional (1.1).
    assertEmpresaCrt(empresa);
    const documentos = normalizarDocumentosCte(dto);
    validarImpostoCte(dto, empresa, dto.dt_emissao);
    validarIcmsUfFimCte(dto);

    // infRespTec (1.4): repassa os dados do responsável técnico cadastrados na
    // empresa fiscal, com o CSRT decifrado. A falta desses dados NÃO bloqueia a
    // emissão — só registra aviso, até a exigência ser confirmada em sandbox.
    if (!empresa.resp_tec_cnpj) {
      logger.warn(
        "CT-e emitido sem infRespTec: empresa fiscal sem responsável técnico cadastrado",
        { tenantId, fiscalEmpresaId: empresa.id },
      );
    }
    const empresaComRespTec = {
      ...empresa,
      resp_tec_csrt: decryptSecret(empresa.resp_tec_csrt),
    };

    const resposta = await CteMdfeProviderClient.enviarConhecimentoTransporte(
      montarPayloadCte(dto, chaveReferenciada, empresaComRespTec),
      token,
    );

    // status === 2 => rejeitado pelo provedor (mesmo contrato do jwsoft).
    if (resposta?.status === 2) {
      throw badRequest("Provedor de CT-e/MDF-e rejeitou a emissão do CT-e", {
        erros: resposta.erros ?? [],
      });
    }
    if (!resposta?.chave) {
      throw badRequest(
        "Provedor de CT-e/MDF-e não retornou a chave de acesso do CT-e",
        { resposta },
      );
    }

    // A partir daqui o CT-e já foi emitido de verdade na SEFAZ (irreversível).
    // O registro local precisa existir ANTES de qualquer passo que possa falhar
    // (gravação de arquivo em disco); caso contrário a emissão real ficaria sem
    // rastro e uma nova tentativa geraria um documento duplicado.
    const cte = await prisma.fiscal_ctes.create({
      data: {
        tenant_id: Number(tenantId),
        fiscal_empresa_id: empresa.id,
        cliente_id: cliente.id,
        caminhao_id: caminhaoId,
        motorista_id: motoristaId,
        cte_referenciado_id: cteReferenciadoId,
        cte_referenciado_chave: chaveReferenciada ?? null,
        ind_alt_toma: dto.ind_alt_toma ?? null,
        chave_acesso: resposta.chave,
        status: "processado",
        numero: resposta.numero != null ? String(resposta.numero) : null,
        serie: resposta.serie != null ? String(resposta.serie) : null,
        numero_protocolo: extrairNumeroProtocolo(resposta),
        data_emissao: new Date(),
        valor_frete: dto.servico?.valor_prestacao ?? null,
        ...colunasImpostoCarga(dto),
        ...colunasContingenciaTribFed(dto),
      },
    });

    // CT-e já emitido com sucesso — uma falha ao gravar/registrar o XML/PDF não
    // invalida o documento. Loga e segue, sem transformar erro de disco em erro
    // de emissão para o usuário; os arquivos podem ser reobtidos depois.
    let cteComArquivos = cte;
    try {
      const [xmlPath, pdfPath] = await Promise.all([
        salvarXmlBase64("cte", tenantId, resposta.chave, resposta.base64Xml),
        salvarPdfBase64("cte", tenantId, resposta.chave, resposta.base64DACTe),
      ]);
      if (xmlPath || pdfPath) {
        cteComArquivos = await prisma.fiscal_ctes.update({
          where: { id: cte.id },
          data: { xml_path: xmlPath, pdf_path: pdfPath },
        });
      }
    } catch (err) {
      logger.error("Falha ao gravar XML/PDF do CT-e recém-emitido", {
        tenantId,
        cteId: cte.id,
        chave: resposta.chave,
        message: err.message,
      });
    }

    // CT-e já emitido — gravar os filhos infDoc / infQ é best-effort: uma falha
    // aqui não invalida o documento, só registra para reconciliação.
    try {
      if (documentos.length > 0) {
        await prisma.fiscal_cte_documentos.createMany({
          data: documentos.map((d) => ({
            tenant_id: Number(tenantId),
            cte_id: cte.id,
            tipo: d.tipo,
            chave_acesso: d.chave_acesso,
            numero: d.numero,
            serie: d.serie,
            data_emissao: d.data_emissao ? new Date(d.data_emissao) : null,
            valor: d.valor,
          })),
        });
      }
      const quantidades = Array.isArray(dto.carga?.quantidades)
        ? dto.carga.quantidades
        : [];
      if (quantidades.length > 0) {
        await prisma.fiscal_cte_carga_quantidades.createMany({
          data: quantidades.map((q) => ({
            tenant_id: Number(tenantId),
            cte_id: cte.id,
            codigo_unidade: q.codigo_unidade ?? null,
            tipo_medida: q.tipo_medida ?? null,
            quantidade: q.quantidade ?? null,
          })),
        });
      }
      const componentes = Array.isArray(dto.servico?.componentes)
        ? dto.servico.componentes
        : [];
      if (componentes.length > 0) {
        await prisma.fiscal_cte_componentes_frete.createMany({
          data: componentes.map((c) => ({
            tenant_id: Number(tenantId),
            cte_id: cte.id,
            nome: c.nome,
            valor: c.valor ?? null,
          })),
        });
      }
      // autXML (1.1): 0..N terceiros autorizados a baixar o XML. Sem itens, nada
      // é gravado — o CT-e continua válido com 0 autorizados.
      const autXml = normalizarAutXmlCte(dto);
      if (autXml.length > 0) {
        await prisma.fiscal_cte_aut_xml.createMany({
          data: autXml.map((a) => ({
            tenant_id: Number(tenantId),
            cte_id: cte.id,
            cnpj_cpf: a.cnpj_cpf,
          })),
        });
      }
      const participantes = normalizarParticipantesCte(dto);
      if (participantes.length > 0) {
        await prisma.fiscal_cte_participantes.createMany({
          data: participantes.map((p) => ({
            tenant_id: Number(tenantId),
            cte_id: cte.id,
            ...p,
          })),
        });
      }
    } catch (err) {
      logger.error("Falha ao gravar infDoc/infQ/Comp/participantes/autXML do CT-e recém-emitido", {
        tenantId,
        cteId: cte.id,
        message: err.message,
      });
    }

    logger.info("CT-e emitido", { tenantId, chave: cteComArquivos.chave_acesso });
    return {
      ...serializePrisma(cteComArquivos),
      base64DACTe: resposta.base64DACTe ?? null,
    };
  }

  static async cancelar(tenantId, id, justificativa) {
    const cte = await findOwnedOr404("fiscal_ctes", id, tenantId, "CT-e");

    // Usa a empresa fiscal registrada na emissão do CT-e; se a linha for antiga
    // e não tiver fiscal_empresa_id, cai na resolução da única empresa ativa.
    const { empresa, token } = await resolveEmpresaCteMdfe(
      tenantId,
      cte.fiscal_empresa_id ?? undefined,
    );

    // Cancelamento genérico (0.6): mesmo corpo do MDF-e. Usa o protocolo de
    // autorização gravado na emissão (PARTE 3); CT-e antigos sem protocolo
    // persistido vão com `undefined` e o provedor resolve pela chave.
    const resposta = await CteMdfeProviderClient.cancelarNotaFiscal(
      montarPayloadCancelamento({
        chave: cte.chave_acesso,
        justificativa,
        protocolo: cte.numero_protocolo ?? undefined,
        cnpjRemetente: empresa.cnpj,
      }),
      token,
    );

    if (resposta?.Status === 3) {
      throw badRequest(
        resposta.Error ??
          "Provedor de CT-e/MDF-e rejeitou o cancelamento do CT-e",
      );
    }
    // Status === 2 => aguardando SEFAZ; mantém status atual até nova tentativa.
    if (resposta?.Status === 2) {
      return serializePrisma(cte);
    }

    const updated = await prisma.fiscal_ctes.update({
      where: { id: cte.id },
      data: { status: "cancelado" },
    });
    return serializePrisma(updated);
  }

  /** Vincula (ou desvincula) o CT-e a um MDF-e do mesmo tenant. */
  static async vincularManifesto(tenantId, id, manifestoId) {
    const cte = await findOwnedOr404("fiscal_ctes", id, tenantId, "CT-e");
    const linkId =
      manifestoId == null
        ? null
        : await assertTenantFk(
            "fiscal_mdfes",
            manifestoId,
            tenantId,
            "MDF-e",
          );
    const updated = await prisma.fiscal_ctes.update({
      where: { id: cte.id },
      data: { manifesto_id: linkId },
    });
    return serializePrisma(updated);
  }
}
