import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";
import { normalizePlaca } from "../../utils/placa.js";
import {
  emitirMdfeSchema,
  encerrarMdfeSchema,
} from "../../schemas/fiscalSchema.js";
import { CteMdfeProviderClient } from "./CteMdfeProviderClient.js";
import {
  EVENTO_PRIMEIRO_SEQUENCIAL,
  extrairNumeroProtocolo,
  findOwnedOr404,
  montarGrupoSeguro,
  montarPayloadCancelamento,
  resolveEmpresaCteMdfe,
  salvarPdfBase64,
  salvarXmlBase64,
} from "./fiscalShared.js";

const MODALIDADE_RODOVIARIO = 1;

function badRequest(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

async function resolvePlaca(tenantId, dto) {
  if (dto.caminhao_id != null) {
    const row = await prisma.caminhoes.findFirst({
      where: { id: Number(dto.caminhao_id), tenant_id: Number(tenantId) },
      select: { id: true, placa: true, tipo_veiculo: true },
    });
    if (!row) throw badRequest("Caminhão não encontrado neste tenant");
    return {
      caminhaoId: row.id,
      placa: row.placa,
      tipoVeiculo: row.tipo_veiculo ?? null,
    };
  }
  if (dto.rodoviario?.placa) {
    return { caminhaoId: null, placa: dto.rodoviario.placa, tipoVeiculo: null };
  }
  throw badRequest("Informe caminhao_id ou rodoviario.placa");
}

// Campos de fiscal_veiculo_dados obrigatórios para montar o grupo veicReboque
// (sem eles a SEFAZ rejeita o MDF-e com a rejeição 523).
const CAMPOS_REBOQUE_OBRIGATORIOS = [
  ["tara_kg", "tara (kg)"],
  ["cap_kg", "capacidade de carga (kg)"],
  ["tipo_carroceria", "tipo de carroceria"],
];

// Teto de reboques por veículo tracionado aceito pela SEFAZ (ex.: rodotrem = 3).
const MAX_REBOQUES = 3;

function assertLimiteReboques(quantidade, origem) {
  if (quantidade > MAX_REBOQUES) {
    throw badRequest(
      `O MDF-e admite no máximo ${MAX_REBOQUES} reboques (ex.: rodotrem); ` +
        `${origem} tem ${quantidade}.`,
    );
  }
}

/**
 * Monta uma entrada do grupo veicReboque no formato do provedor a partir dos
 * campos snake_case (vindos de fiscal_veiculo_dados ou do array manual do DTO).
 */
function montarVeicReboque({
  placa,
  renavam,
  tara_kg,
  cap_kg,
  cap_m3,
  tipo_carroceria,
  uf,
}) {
  return {
    placa: normalizePlaca(placa) ?? placa ?? undefined,
    RENAVAM: renavam ?? undefined,
    tara: tara_kg != null ? Number(tara_kg) : undefined,
    capKG: cap_kg != null ? Number(cap_kg) : undefined,
    capM3: cap_m3 != null ? Number(cap_m3) : undefined,
    tpCarroceria: tipo_carroceria ?? undefined,
    uf: uf ? String(uf).toUpperCase() : undefined,
  };
}

/**
 * Resolve os reboques (grupo veicReboque do MDF-e) do veículo tracionado.
 *
 * Caminho principal: se o caminhão resolvido é um cavalo mecânico
 * (tipo_veiculo === "cavalo"), consulta vinculos_composicao (ativos e dentro da
 * vigência inicio_em/fim_em na data de emissão, ordenados por "ordem"), pega as
 * carretas acopladas e monta o grupo a partir de caminhoes + fiscal_veiculo_dados.
 *
 * Fallback: rodoviario.reboques[] informado manualmente, para cavalos que ainda
 * não têm vínculo cadastrado.
 *
 * Lança erro de validação amigável (400) ANTES de chamar o provedor quando:
 *  - o cavalo não tem nenhum reboque (nem vinculado, nem manual);
 *  - uma carreta vinculada está sem os campos fiscais obrigatórios
 *    (tara_kg, cap_kg, tipo_carroceria) em fiscal_veiculo_dados.
 *
 * Veículo rígido ("truck") ou carreta sozinha não exige reboque.
 *
 * @returns {Promise<Array<object>>} entradas já no formato do provedor (pode ser [])
 */
export async function resolveReboques(
  tenantId,
  { caminhaoId, tipoVeiculo },
  dto,
  dataEmissao,
) {
  const manuais = Array.isArray(dto.rodoviario?.reboques)
    ? dto.rodoviario.reboques
    : [];
  const ehCavalo = tipoVeiculo === "cavalo";

  // Rígido ou carreta sozinha: SEFAZ não exige reboque. Se mesmo assim vieram
  // reboques manuais no payload, respeitamos.
  if (!ehCavalo) {
    assertLimiteReboques(manuais.length, "o payload");
    return manuais.map(montarVeicReboque);
  }

  // Cavalo mecânico: o caminho principal é o vínculo cadastrado.
  if (caminhaoId != null) {
    const ref = dataEmissao ? new Date(dataEmissao) : new Date();
    const vinculos = await prisma.vinculos_composicao.findMany({
      where: {
        tenant_id: Number(tenantId),
        cavalo_id: Number(caminhaoId),
        ativo: true,
        inicio_em: { lte: ref },
        OR: [{ fim_em: null }, { fim_em: { gte: ref } }],
      },
      orderBy: { ordem: "asc" },
    });

    if (vinculos.length > 0) {
      assertLimiteReboques(vinculos.length, "a composição do cavalo");
      const carretaIds = vinculos.map((v) => v.carreta_id);
      const [carretas, dados] = await Promise.all([
        prisma.caminhoes.findMany({
          where: { id: { in: carretaIds }, tenant_id: Number(tenantId) },
          select: { id: true, placa: true },
        }),
        prisma.fiscal_veiculo_dados.findMany({
          where: { caminhao_id: { in: carretaIds } },
        }),
      ]);
      const placaPorId = new Map(carretas.map((c) => [c.id, c.placa]));
      const dadosPorId = new Map(dados.map((d) => [d.caminhao_id, d]));

      const pendencias = [];
      const reboques = vinculos.map((v) => {
        const placa = placaPorId.get(v.carreta_id);
        const d = dadosPorId.get(v.carreta_id) ?? {};
        if (!placa) {
          pendencias.push(`carreta #${v.carreta_id}: não encontrada neste tenant`);
        } else {
          const ausentes = CAMPOS_REBOQUE_OBRIGATORIOS.filter(
            ([campo]) => d[campo] == null,
          ).map(([, rotulo]) => rotulo);
          if (ausentes.length > 0) {
            pendencias.push(`${placa}: faltam ${ausentes.join(", ")}`);
          }
        }
        return montarVeicReboque({
          placa,
          renavam: d.renavam,
          tara_kg: d.tara_kg,
          cap_kg: d.cap_kg,
          cap_m3: d.cap_m3,
          tipo_carroceria: d.tipo_carroceria,
          uf: d.uf,
        });
      });

      if (pendencias.length > 0) {
        throw badRequest(
          "Reboque(s) vinculado(s) sem os dados fiscais obrigatórios para o " +
            "MDF-e. Preencha tara (kg), capacidade de carga (kg) e tipo de " +
            "carroceria em Dados fiscais do veículo para: " +
            pendencias.join("; "),
        );
      }
      return reboques;
    }
  }

  // Cavalo sem vínculo ativo: aceita o fallback manual, se informado.
  if (manuais.length > 0) {
    assertLimiteReboques(manuais.length, "o payload");
    return manuais.map(montarVeicReboque);
  }

  throw badRequest(
    "Cavalo mecânico precisa de ao menos um reboque vinculado ou informado " +
      "manualmente: vincule uma carreta (vinculos_composicao) ou envie " +
      "rodoviario.reboques[] no payload.",
  );
}

async function resolveCondutores(tenantId, dto) {
  if (dto.motorista_id != null) {
    const row = await prisma.motoristas.findFirst({
      where: { id: Number(dto.motorista_id), tenant_id: Number(tenantId) },
      select: { id: true, nome: true, cpf: true },
    });
    if (!row) throw badRequest("Motorista não encontrado neste tenant");
    if (!row.cpf) {
      throw badRequest(
        "Motorista informado não possui CPF cadastrado, obrigatório para o MDF-e",
      );
    }
    return {
      motoristaId: row.id,
      condutores: [{ nome: row.nome, cpf: String(row.cpf).replace(/\D/g, "") }],
    };
  }
  if (Array.isArray(dto.rodoviario?.condutores) && dto.rodoviario.condutores.length > 0) {
    return { motoristaId: null, condutores: dto.rodoviario.condutores };
  }
  throw badRequest("Informe motorista_id ou rodoviario.condutores");
}

// Grupo `seguros` (seg do MDF-e): montagem movida para fiscalShared.js
// (montarGrupoSeguro) no item 1.6, para o CteService reaproveitar. Comportamento
// para o MDF-e inalterado.

// ---------------------------------------------------------------------
// Grupos seg / infANTT / tot / prodPred / ide (itens 2.1 a 2.5)
// ---------------------------------------------------------------------

/**
 * Os grupos infANTT (2.2) e prodPred (2.4) só são exigidos quando `tipo_emitente`
 * vier EXPLICITAMENTE 1 (prestador de serviço de transporte) ou 3 (prestador
 * CT-e globalizado).
 *
 * `tipo_emitente` ausente NÃO dispara a exigência: antes desta mudança o fluxo
 * de emissão de MDF-e de frota própria podia não mandar o campo, e uma empresa
 * de frota própria sem RNTRC cadastrado emitia normalmente — a nova regra vale
 * só para quem se declara prestador. `tipo_emitente === 2` (carga própria)
 * também não exige.
 */
export function exigeGruposAntt(dto) {
  return dto.tipo_emitente === 1 || dto.tipo_emitente === 3;
}

/**
 * Grupo seg (2.1): exige o responsável pelo seguro na emissão nova, exceto
 * quando o DTO já traz `seguros[]` explícito. MDF-e já emitidos não são
 * afetados — a checagem roda só na emissão nova.
 */
export function assertSeguroMdfe(dto) {
  if (Array.isArray(dto.seguros) && dto.seguros.length > 0) return;
  if (dto.resp_seg == null) {
    throw badRequest(
      "Informe o responsável pelo seguro da carga (grupo seg) para emitir o " +
        "MDF-e: resp_seg = 1 (emitente do MDF-e) ou 2 (contratante do serviço).",
    );
  }
}

/**
 * Grupo infANTT (2.2): quando o emitente se declara prestador (tipo_emitente
 * 1 ou 3), exige um RNTRC — informado em `inf_antt.rntrc` ou já cadastrado na
 * empresa fiscal emissora. Frota própria / tipo_emitente ausente não exige.
 */
export function validarInfAnttMdfe(dto, empresa) {
  if (!exigeGruposAntt(dto)) return;
  const rntrc = dto.inf_antt?.rntrc || empresa?.rntrc;
  if (!rntrc) {
    throw badRequest(
      "MDF-e de prestador de serviço de transporte exige RNTRC (grupo " +
        "infANTT) — cadastre o RNTRC da empresa fiscal ou informe inf_antt.rntrc.",
    );
  }
}

/**
 * infMunDescarga (2.1): quando o DTO traz `municipios_descarga`, cada CT-e
 * informado (tipo 'cte') precisa também estar vinculado ao MDF-e via `cte_ids`
 * — a chave tem de estar entre `chavesCteVinculadas`. NF-e/MDF-e não são
 * checados. Só roda quando o campo novo é usado; MDF-e sem ele não é afetado.
 */
export function validarMunicipiosDescarga(dto, chavesCteVinculadas = []) {
  if (
    !Array.isArray(dto.municipios_descarga) ||
    dto.municipios_descarga.length === 0
  ) {
    return;
  }
  const permitidas = new Set(chavesCteVinculadas);
  const orfas = [];
  for (const m of dto.municipios_descarga) {
    for (const d of m.documentos ?? []) {
      if (d.tipo === "cte" && d.chave && !permitidas.has(d.chave)) {
        orfas.push(d.chave);
      }
    }
  }
  if (orfas.length > 0) {
    throw badRequest(
      "infMunDescarga (2.1): CT-e informado em município de descarga sem " +
        "vínculo com este MDF-e — envie a chave também em cte_ids: " +
        orfas.join(", "),
    );
  }
}

/** Grupo prodPred (2.4): mesmo critério do infANTT (só prestador 1 ou 3). */
export function validarProdPredMdfe(dto) {
  if (!exigeGruposAntt(dto)) return;
  const temProdPred =
    Boolean(dto.prod_pred?.descricao) ||
    (dto.produto_predominante != null &&
      Object.keys(dto.produto_predominante).length > 0);
  if (!temProdPred) {
    throw badRequest(
      "MDF-e de prestador de serviço de transporte exige o produto " +
        "predominante (grupo prodPred) — informe prod_pred.descricao.",
    );
  }
}

/**
 * Grupo tot (2.3): totais calculados a partir dos CT-e vinculados. O peso não
 * é persistido nos CT-e — `qCarga` fica indefinido aqui e é resolvido na
 * emissão com fallback para `dto.peso`.
 */
export function calcularTotMdfe(ctes) {
  const lista = Array.isArray(ctes) ? ctes : [];
  const vCarga = lista.reduce(
    (soma, c) =>
      soma + (Number(c.valor_frete ?? c.valor_carga ?? 0) || 0),
    0,
  );
  return {
    qCTe: lista.length,
    vCarga: vCarga || undefined,
    qCarga: undefined,
  };
}

/** Valores das colunas novas (seg / infANTT / tot / prodPred / ide) a persistir. */
function colunasMdfeExtras(dto, tot) {
  const base = {
    seg_responsavel: dto.resp_seg ?? null,
    seg_cnpj_seguradora: dto.cnpj_seguradora ?? null,
    seg_numero_apolice: dto.numero_apolice ?? null,
    seg_numero_averbacao: dto.numero_averbacao ?? null,
    seg_nome_seguradora: dto.nome_seguradora ?? null,
    antt_rntrc: dto.inf_antt?.rntrc ?? null,
    antt_ciot: dto.inf_antt?.ciot ?? null,
    // infANTT bancário / PIX (0.1)
    antt_cod_banco: dto.inf_antt?.cod_banco ?? null,
    antt_cod_agencia: dto.inf_antt?.cod_agencia ?? null,
    antt_cnpj_inst_pagamento: dto.inf_antt?.cnpj_instituicao_pagamento ?? null,
    antt_pix: dto.inf_antt?.pix ?? null,
    tot_qcte: tot?.qCTe ?? null,
    tot_valor_carga: tot?.vCarga ?? null,
    tot_peso_bruto: tot?.qCarga ?? dto.peso ?? null,
    prod_pred_descricao: dto.prod_pred?.descricao ?? null,
    prod_pred_ncm: dto.prod_pred?.ncm ?? null,
    prod_pred_tp_carga: dto.prod_pred?.tp_carga ?? null,
    // prodPred: c_ean + infLotacao (0.3)
    prod_pred_c_ean: dto.prod_pred?.c_ean ?? null,
    prod_pred_lotacao_carrega_cep:
      dto.prod_pred?.inf_lotacao?.carrega?.cep ?? null,
    prod_pred_lotacao_carrega_lat:
      dto.prod_pred?.inf_lotacao?.carrega?.latitude ?? null,
    prod_pred_lotacao_carrega_long:
      dto.prod_pred?.inf_lotacao?.carrega?.longitude ?? null,
    prod_pred_lotacao_descarrega_cep:
      dto.prod_pred?.inf_lotacao?.descarrega?.cep ?? null,
    prod_pred_lotacao_descarrega_lat:
      dto.prod_pred?.inf_lotacao?.descarrega?.latitude ?? null,
    prod_pred_lotacao_descarrega_long:
      dto.prod_pred?.inf_lotacao?.descarrega?.longitude ?? null,
    ide_uf_ini: dto.ide?.uf_ini ?? dto.uf_carregamento ?? null,
    ide_uf_fim: dto.ide?.uf_fim ?? dto.uf_descarregamento ?? null,
    ide_dh_ini_viagem: dto.ide?.dh_ini_viagem
      ? new Date(dto.ide.dh_ini_viagem)
      : null,
    ide_tp_transp: dto.ide?.tp_transp ?? null,
    ide_modal: dto.ide?.modal ?? null,
  };
  // JSONB: só inclui a chave quando há valor (evita null cru em campo Json).
  if (dto.inf_antt?.vale_pedagio != null) {
    base.antt_vale_pedagio = dto.inf_antt.vale_pedagio;
  }
  return base;
}

/**
 * Colunas do evento de cancelamento estruturado do MDF-e (2.3), a partir da
 * justificativa usada e da resposta do provedor. Função pura.
 */
export function colunasCancelamentoMdfe(justificativa, resposta) {
  return {
    status: "cancelado",
    cancelado_em: new Date(),
    cancelado_justificativa: justificativa ?? null,
    cancelado_protocolo: resposta?.NuProtocolo ?? null,
  };
}

/**
 * Corpo do encerramento de MDF-e (0.5). CONFIRMADO com o payload real do
 * provedor: SÓ `tipoAmbiente`, `chave`, `protocolo`, `numeroSequencial` — nada
 * de UF / município / data manual. Função pura.
 */
export function montarPayloadEncerrarMdfe(mdfe) {
  return {
    tipoAmbiente: config.fiscal.ambiente,
    chave: mdfe?.chave_acesso ?? undefined,
    protocolo: mdfe?.numero_protocolo ?? undefined,
    numeroSequencial: EVENTO_PRIMEIRO_SEQUENCIAL,
  };
}

/**
 * Normaliza `dto.seguros[]` (0.2) para linhas de `fiscal_mdfe_seguros`. Aceita
 * tanto o shape do provedor (indicadorResponsavel / cnpjSegurador / numeroApolice
 * / numerosAverbacao / nomeSegurador) quanto o snake_case da nossa API. Cada
 * seguro carrega 0..N números de averbação. Devolve `[]` quando não há
 * `dto.seguros` — nesse caso as colunas singulares fiscal_mdfes.seg_* seguem
 * como fallback de 1 seguro (comportamento atual). Função pura.
 */
export function normalizarSegurosMdfe(dto) {
  const lista = Array.isArray(dto?.seguros) ? dto.seguros : [];
  return lista
    .filter((s) => s != null && typeof s === "object")
    .map((s) => {
      const averbacoes = Array.isArray(s.numeros_averbacao)
        ? s.numeros_averbacao
        : Array.isArray(s.numerosAverbacao)
          ? s.numerosAverbacao
          : s.numero_averbacao
            ? [s.numero_averbacao]
            : [];
      return {
        responsavel: s.responsavel ?? s.indicadorResponsavel ?? null,
        cnpj_seguradora: s.cnpj_seguradora ?? s.cnpjSegurador ?? null,
        numero_apolice: s.numero_apolice ?? s.numeroApolice ?? null,
        nome_seguradora: s.nome_seguradora ?? s.nomeSegurador ?? null,
        numeros_averbacao: averbacoes
          .map((n) => (n == null ? null : String(n)))
          .filter((n) => n != null && n !== ""),
      };
    });
}

/**
 * Grupo `pagamentos[]` do MDF-e (0.1). Monta uma entrada com `infoBancaria` a
 * partir de inf_antt.{cod_banco,cod_agencia,cnpj_instituicao_pagamento,pix}.
 * Devolve `undefined` quando nenhum dos campos bancários tem valor — nesse caso
 * o payload NÃO ganha a chave `pagamentos` (comportamento atual preservado).
 * Função pura.
 */
export function montarPagamentosMdfe(dto) {
  const a = dto?.inf_antt ?? {};
  const infoBancaria = {
    codBanco: a.cod_banco ?? undefined,
    codAgencia: a.cod_agencia ?? undefined,
    cnpjInstituicaoPagamento: a.cnpj_instituicao_pagamento ?? undefined,
    pix: a.pix ?? undefined,
  };
  const temAlgum = Object.values(infoBancaria).some((v) => v != null);
  return temAlgum ? [{ infoBancaria }] : undefined;
}

/**
 * Grupo `infLotacao` do prodPred do MDF-e (0.3): CEP + latitude/longitude do
 * local de carregamento e de descarregamento. Devolve `undefined` quando nada
 * foi informado. Função pura.
 */
export function montarInfLotacaoMdfe(infLotacao) {
  if (infLotacao == null || typeof infLotacao !== "object") return undefined;
  const local = (l) => {
    if (l == null || typeof l !== "object") return undefined;
    const grp = {};
    if (l.cep != null) grp.cep = l.cep;
    if (l.latitude != null) grp.latitude = l.latitude;
    if (l.longitude != null) grp.longitude = l.longitude;
    return Object.keys(grp).length > 0 ? grp : undefined;
  };
  const localCarrega = local(infLotacao.carrega);
  const localDescarrega = local(infLotacao.descarrega);
  if (!localCarrega && !localDescarrega) return undefined;
  return {
    ...(localCarrega ? { localCarrega } : {}),
    ...(localDescarrega ? { localDescarrega } : {}),
  };
}

export function montarPayloadMdfe(
  dto,
  placa,
  condutores,
  reboques = [],
  chavesCteVinculados = [],
  tot,
) {
  const {
    placa: _p,
    condutores: _c,
    reboques: _r,
    ...restRodoviario
  } = dto.rodoviario ?? {};

  const infANTT =
    dto.inf_antt && Object.keys(dto.inf_antt).length > 0
      ? {
          RNTRC: dto.inf_antt.rntrc ?? undefined,
          infCIOT: dto.inf_antt.ciot ?? undefined,
          valePedagio: dto.inf_antt.vale_pedagio ?? undefined,
        }
      : undefined;

  // Grupo pagamentos[] (0.1) — CONFIRMADO no payload real do provedor. Os dados
  // bancários / PIX da instituição de pagamento vão como `infoBancaria` DENTRO
  // de `pagamentos[]`, não no infANTT. Só entra quando algum campo tem valor.
  // Campos do provedor: codBanco / codAgencia / cnpjInstituicaoPagamento / pix.
  const pagamentos = montarPagamentosMdfe(dto);

  const prodPred = dto.prod_pred
    ? {
        xProd: dto.prod_pred.descricao ?? undefined,
        NCM: dto.prod_pred.ncm ?? undefined,
        tpCarga: dto.prod_pred.tp_carga ?? undefined,
        // c_ean / infLotacao (0.3) — CONFIRMADO no payload real do provedor.
        cEan: dto.prod_pred.c_ean ?? undefined,
        infLotacao: montarInfLotacaoMdfe(dto.prod_pred.inf_lotacao),
      }
    : (dto.produto_predominante ?? undefined);

  const infMunCarrega = Array.isArray(dto.municipios_carrega)
    ? dto.municipios_carrega.map((m) => ({
        cMunCarrega: m.codigo_municipio,
        xMunCarrega: m.nome_municipio ?? undefined,
      }))
    : undefined;

  // infMunDescarga (2.1): documentos vinculados agrupados por município de
  // descarga. Só entra no payload quando o DTO traz `municipios_descarga`;
  // senão, segue a lista plana `documentosVinculados` (comportamento atual).
  const infMunDescarga = Array.isArray(dto.municipios_descarga)
    ? dto.municipios_descarga.map((m) => {
        const docs = Array.isArray(m.documentos) ? m.documentos : [];
        const infCTe = docs
          .filter((d) => d.tipo === "cte" && d.chave)
          .map((d) => ({ chCTe: d.chave }));
        const infNFe = docs
          .filter((d) => d.tipo === "nfe" && d.chave)
          .map((d) => ({ chNFe: d.chave }));
        const infMDFeTransp = docs
          .filter((d) => d.tipo === "mdfe" && d.chave)
          .map((d) => ({ chMDFe: d.chave }));
        return {
          cMunDescarga: m.codigo_municipio,
          xMunDescarga: m.nome_municipio ?? undefined,
          ...(infCTe.length > 0 ? { infCTe } : {}),
          ...(infNFe.length > 0 ? { infNFe } : {}),
          ...(infMDFeTransp.length > 0 ? { infMDFeTransp } : {}),
        };
      })
    : undefined;

  const ide =
    dto.ide && Object.keys(dto.ide).length > 0
      ? {
          UFIni: dto.ide.uf_ini ?? undefined,
          UFFim: dto.ide.uf_fim ?? undefined,
          dhIniViagem: dto.ide.dh_ini_viagem ?? undefined,
          tpTransp: dto.ide.tp_transp ?? undefined,
          modal: dto.ide.modal ?? undefined,
        }
      : undefined;

  return {
    serie: dto.serie ?? undefined,
    numero: dto.numero ?? undefined,
    codigo: dto.codigo ?? undefined,
    tipoAmbiente: config.fiscal.ambiente,
    tipoEmitente: dto.tipo_emitente ?? undefined,
    DataEmissao: dto.data_emissao,
    ufCarregamento: dto.uf_carregamento,
    ufDescarregamento: dto.uf_descarregamento,
    modalidade: dto.modalidade ?? MODALIDADE_RODOVIARIO,
    // tot (2.3): quando há CT-e vinculados, os totais calculados têm precedência
    // sobre valor/peso informados manualmente; sem vínculo, mantém o DTO.
    valor: (tot?.vCarga ?? dto.valor) ?? undefined,
    peso: (tot?.qCarga ?? dto.peso) ?? undefined,
    Rodoviario: {
      ...restRodoviario,
      placa,
      condutores,
      ...(reboques.length > 0 ? { veicReboque: reboques } : {}),
    },
    infANTT,
    ...(pagamentos ? { pagamentos } : {}),
    ide,
    ...(infMunCarrega && infMunCarrega.length > 0 ? { infMunCarrega } : {}),
    ...(infMunDescarga && infMunDescarga.length > 0 ? { infMunDescarga } : {}),
    tot: tot
      ? {
          qCTe: tot.qCTe,
          vCarga: tot.vCarga ?? undefined,
          qCarga: tot.qCarga ?? undefined,
        }
      : undefined,
    seguros: montarGrupoSeguro(dto),
    carregamentos: dto.carregamentos ?? undefined,
    descarregamentos: dto.descarregamentos ?? undefined,
    // Chaves dos CT-e vinculados a este MDF-e. O agrupamento por município de
    // descarga (infMunDescarga) do provedor NÃO foi confirmado em sandbox —
    // enviado como lista de chaves em `documentosVinculados`. Ver relatório.
    documentosVinculados:
      chavesCteVinculados.length > 0
        ? chavesCteVinculados.map((chaveDfe) => ({ chaveDfe }))
        : undefined,
    percursoUfs: dto.percurso_ufs ?? undefined,
    produtoPredominante: prodPred,
  };
}

/**
 * Valida os CT-e a vincular ao MDF-e: precisam ser do mesmo tenant, estar com
 * status "processado" e ainda não vinculados a outro manifesto. Devolve
 * { ids, chaves } para gravar manifesto_id e montar o payload.
 */
async function resolveCtesVinculados(tenantId, cteIds) {
  if (!Array.isArray(cteIds) || cteIds.length === 0) {
    return { ids: [], chaves: [], ctes: [] };
  }
  const unicos = [...new Set(cteIds.map(Number))];
  const rows = await prisma.fiscal_ctes.findMany({
    where: { id: { in: unicos }, tenant_id: Number(tenantId) },
    select: {
      id: true,
      chave_acesso: true,
      status: true,
      manifesto_id: true,
      valor_frete: true,
      valor_carga: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const problemas = [];
  for (const id of unicos) {
    const row = byId.get(id);
    if (!row) {
      problemas.push(`CT-e #${id}: não encontrado neste tenant`);
    } else if (row.status !== "processado") {
      problemas.push(`CT-e #${id}: status "${row.status}" (esperado "processado")`);
    } else if (row.manifesto_id != null) {
      problemas.push(`CT-e #${id}: já vinculado ao MDF-e #${row.manifesto_id}`);
    } else if (!row.chave_acesso) {
      problemas.push(`CT-e #${id}: sem chave de acesso`);
    }
  }
  if (problemas.length > 0) {
    throw badRequest(
      "Não foi possível vincular os CT-e informados: " + problemas.join("; "),
    );
  }
  return {
    ids: unicos,
    chaves: unicos.map((id) => byId.get(id).chave_acesso),
    ctes: unicos.map((id) => byId.get(id)),
  };
}

export class MdfeService {
  static async list(tenantId, { status } = {}) {
    const where = { tenant_id: Number(tenantId) };
    if (status) where.status = String(status);
    const rows = await prisma.fiscal_mdfes.findMany({
      where,
      orderBy: { criado_em: "desc" },
    });
    return serializePrisma(rows);
  }

  static async getById(tenantId, id) {
    const row = await findOwnedOr404("fiscal_mdfes", id, tenantId, "MDF-e");
    return serializePrisma(row);
  }

  static async emitir(tenantId, body) {
    const dto = emitirMdfeSchema.parse(body);
    const { caminhaoId, placa, tipoVeiculo } = await resolvePlaca(tenantId, dto);
    const { motoristaId, condutores } = await resolveCondutores(tenantId, dto);
    const reboques = await resolveReboques(
      tenantId,
      { caminhaoId, tipoVeiculo },
      dto,
      dto.data_emissao,
    );
    const ctesVinculados = await resolveCtesVinculados(tenantId, dto.cte_ids);
    const { empresa, token } = await resolveEmpresaCteMdfe(
      tenantId,
      dto.fiscal_empresa_id,
    );

    // Validações que precisam rodar ANTES da chamada irreversível ao provedor:
    // seguro_responsavel (2.1); infANTT (2.2) e prodPred (2.4) quando não é
    // frota própria. tot (2.3) é calculado dos CT-e vinculados.
    assertSeguroMdfe(dto);
    validarInfAnttMdfe(dto, empresa);
    validarProdPredMdfe(dto);
    validarMunicipiosDescarga(dto, ctesVinculados.chaves);
    const tot =
      ctesVinculados.ids.length > 0
        ? calcularTotMdfe(ctesVinculados.ctes)
        : undefined;

    const resposta = await CteMdfeProviderClient.enviarManifestoTransporte(
      montarPayloadMdfe(
        dto,
        placa,
        condutores,
        reboques,
        ctesVinculados.chaves,
        tot,
      ),
      token,
    );

    // status === 3 => rejeitado (mesmo contrato do jwsoft).
    if (resposta?.status === 3) {
      throw badRequest("Provedor de CT-e/MDF-e rejeitou a emissão do MDF-e", {
        erros: resposta.Error ? [resposta.Error] : [],
      });
    }
    if (!resposta?.chave) {
      throw badRequest(
        "Provedor de CT-e/MDF-e não retornou a chave de acesso do MDF-e",
        { resposta },
      );
    }

    // A partir daqui o MDF-e já foi emitido de verdade na SEFAZ (irreversível).
    // O registro local precisa existir ANTES de qualquer passo que possa falhar
    // (gravação de arquivo em disco); caso contrário a emissão real ficaria sem
    // rastro e uma nova tentativa geraria um documento duplicado.
    const mdfe = await prisma.fiscal_mdfes.create({
      data: {
        tenant_id: Number(tenantId),
        fiscal_empresa_id: empresa.id,
        caminhao_id: caminhaoId,
        motorista_id: motoristaId,
        chave_acesso: resposta.chave,
        numero: resposta.numero != null ? String(resposta.numero) : null,
        serie: dto.serie ?? null,
        status: "processado",
        // PARTE 3: grava o protocolo de autorização já na emissão (mesmo fix do
        // CT-e). Antes só o encerramento gravava, via NuProtocolo; o
        // cancelamento de MDF-e recém-emitido ia sem NumeroProtocolo e o
        // provedor tinha de resolver pela chave. MDF-e antigos seguem com NULL.
        numero_protocolo: extrairNumeroProtocolo(resposta),
        data_emissao: new Date(),
        ...colunasMdfeExtras(dto, tot),
      },
    });

    // MDF-e já emitido com sucesso — uma falha ao gravar/registrar o XML/PDF não
    // invalida o manifesto. Loga e segue, sem transformar erro de disco em erro
    // de emissão para o usuário; os arquivos podem ser reobtidos depois.
    let mdfeComArquivos = mdfe;
    try {
      const [xmlPath, pdfPath] = await Promise.all([
        salvarXmlBase64("mdfe", tenantId, resposta.chave, resposta.base64Xml),
        salvarPdfBase64("mdfe", tenantId, resposta.chave, resposta.base64DAMDFe),
      ]);
      if (xmlPath || pdfPath) {
        mdfeComArquivos = await prisma.fiscal_mdfes.update({
          where: { id: mdfe.id },
          data: { xml_path: xmlPath, pdf_path: pdfPath },
        });
      }
    } catch (err) {
      logger.error("Falha ao gravar XML/PDF do MDF-e recém-emitido", {
        tenantId,
        mdfeId: mdfe.id,
        chave: resposta.chave,
        message: err.message,
      });
    }

    // Municípios de carregamento (infMunCarrega, item 2.5). Best-effort — MDF-e
    // já emitido; uma falha aqui não invalida o manifesto.
    if (Array.isArray(dto.municipios_carrega) && dto.municipios_carrega.length > 0) {
      try {
        await prisma.fiscal_mdfe_municipios_carrega.createMany({
          data: dto.municipios_carrega.map((m) => ({
            tenant_id: Number(tenantId),
            mdfe_id: mdfe.id,
            codigo_municipio: m.codigo_municipio ?? null,
            nome_municipio: m.nome_municipio ?? null,
          })),
        });
      } catch (err) {
        logger.error("Falha ao gravar municípios de carregamento do MDF-e", {
          tenantId,
          mdfeId: mdfe.id,
          message: err.message,
        });
      }
    }

    // Municípios de descarga (infMunDescarga, item 2.1). Best-effort — MDF-e já
    // emitido. Uma linha por documento; município sem documentos vira 1 linha.
    if (
      Array.isArray(dto.municipios_descarga) &&
      dto.municipios_descarga.length > 0
    ) {
      try {
        const linhas = [];
        for (const m of dto.municipios_descarga) {
          const docs = Array.isArray(m.documentos) ? m.documentos : [];
          if (docs.length === 0) {
            linhas.push({
              tenant_id: Number(tenantId),
              mdfe_id: mdfe.id,
              codigo_municipio: m.codigo_municipio ?? null,
              nome_municipio: m.nome_municipio ?? null,
              tipo: null,
              chave_acesso: null,
            });
          }
          for (const d of docs) {
            linhas.push({
              tenant_id: Number(tenantId),
              mdfe_id: mdfe.id,
              codigo_municipio: m.codigo_municipio ?? null,
              nome_municipio: m.nome_municipio ?? null,
              tipo: d.tipo ?? null,
              chave_acesso: d.chave ?? null,
            });
          }
        }
        if (linhas.length > 0) {
          await prisma.fiscal_mdfe_documentos_descarga.createMany({
            data: linhas,
          });
        }
      } catch (err) {
        logger.error("Falha ao gravar infMunDescarga do MDF-e", {
          tenantId,
          mdfeId: mdfe.id,
          message: err.message,
        });
      }
    }

    // Seguros como lista (0.2). Best-effort — MDF-e já emitido. Só grava quando
    // o DTO trouxe `seguros[]`; sem ele, as colunas singulares seg_* já
    // preenchidas por colunasMdfeExtras seguem como o único registro do seguro.
    const segurosLista = normalizarSegurosMdfe(dto);
    if (segurosLista.length > 0) {
      try {
        await prisma.fiscal_mdfe_seguros.createMany({
          data: segurosLista.map((s) => ({
            tenant_id: Number(tenantId),
            mdfe_id: mdfe.id,
            responsavel: s.responsavel,
            cnpj_seguradora: s.cnpj_seguradora,
            numero_apolice: s.numero_apolice,
            nome_seguradora: s.nome_seguradora,
            numeros_averbacao: s.numeros_averbacao,
          })),
        });
      } catch (err) {
        logger.error("Falha ao gravar seguros (lista) do MDF-e", {
          tenantId,
          mdfeId: mdfe.id,
          message: err.message,
        });
      }
    }

    // Vincula os CT-e informados a este MDF-e. Já emitido com sucesso — uma
    // falha aqui não invalida o manifesto, só registra para reconciliação.
    if (ctesVinculados.ids.length > 0) {
      try {
        await prisma.fiscal_ctes.updateMany({
          where: {
            id: { in: ctesVinculados.ids },
            tenant_id: Number(tenantId),
            manifesto_id: null,
          },
          data: { manifesto_id: mdfe.id },
        });
      } catch (err) {
        logger.error("Falha ao vincular CT-e ao MDF-e recém-emitido", {
          tenantId,
          mdfeId: mdfe.id,
          cteIds: ctesVinculados.ids,
          message: err.message,
        });
      }
    }

    logger.info("MDF-e emitido", { tenantId, chave: mdfeComArquivos.chave_acesso });
    return {
      ...serializePrisma(mdfeComArquivos),
      base64DAMDFe: resposta.base64DAMDFe ?? null,
    };
  }

  /**
   * Pré-visualização (somente leitura) dos reboques que entrarão no MDF-e para
   * um veículo numa data, pela MESMA resolução usada na emissão
   * (`resolveReboques`). Não emite nada. Os erros de validação amigáveis (400)
   * viram `aviso` em vez de estourar, para o formulário mostrar a pendência
   * antes de tentar emitir.
   */
  static async previewReboques(tenantId, { caminhao_id, data_emissao } = {}) {
    const dto = {
      caminhao_id: caminhao_id != null ? Number(caminhao_id) : null,
      rodoviario: {},
    };
    const { caminhaoId, placa, tipoVeiculo } = await resolvePlaca(tenantId, dto);
    const ref = data_emissao || new Date().toISOString();
    try {
      const reboques = await resolveReboques(
        tenantId,
        { caminhaoId, tipoVeiculo },
        dto,
        ref,
      );
      return { placa, tipo_veiculo: tipoVeiculo, reboques, aviso: null };
    } catch (err) {
      if (err.statusCode === 400) {
        return {
          placa,
          tipo_veiculo: tipoVeiculo,
          reboques: [],
          aviso: err.message,
        };
      }
      throw err;
    }
  }

  static async encerrar(tenantId, id, body) {
    // O schema ainda aceita uf / município / data (compatibilidade), mas o
    // payload real do provedor (0.5) NÃO os usa. O que vier é só persistido nas
    // colunas encerrado_* para consulta.
    const dados = encerrarMdfeSchema.parse(body) ?? {};
    const mdfe = await findOwnedOr404("fiscal_mdfes", id, tenantId, "MDF-e");
    const { token } = await resolveEmpresaCteMdfe(
      tenantId,
      mdfe.fiscal_empresa_id ?? undefined,
    );

    const resposta = await CteMdfeProviderClient.encerrarManifestoTransporte(
      montarPayloadEncerrarMdfe(mdfe),
      token,
    );

    if (resposta?.Status === 3) {
      throw badRequest(
        resposta.Error ??
          "Provedor de CT-e/MDF-e rejeitou o encerramento do MDF-e",
      );
    }
    if (resposta?.Status === 2) {
      return serializePrisma(mdfe);
    }

    const protocolo = resposta?.NuProtocolo ?? mdfe.numero_protocolo ?? null;
    const updated = await prisma.fiscal_mdfes.update({
      where: { id: mdfe.id },
      data: {
        status: "encerrado",
        numero_protocolo: protocolo,
        encerrado_em: new Date(),
        encerrado_uf: dados.uf ?? null,
        encerrado_codigo_municipio: dados.codigo_municipio ?? null,
        encerrado_nome_municipio: dados.nome_municipio ?? null,
        encerrado_protocolo: protocolo,
      },
    });
    return serializePrisma(updated);
  }

  static async cancelar(tenantId, id, justificativa) {
    const mdfe = await findOwnedOr404("fiscal_mdfes", id, tenantId, "MDF-e");
    const { empresa, token } = await resolveEmpresaCteMdfe(
      tenantId,
      mdfe.fiscal_empresa_id ?? undefined,
    );

    const resposta = await CteMdfeProviderClient.cancelarNotaFiscal(
      montarPayloadCancelamento({
        chave: mdfe.chave_acesso,
        justificativa,
        protocolo: mdfe.numero_protocolo,
        cnpjRemetente: empresa.cnpj,
      }),
      token,
    );

    if (resposta?.Status === 3) {
      throw badRequest(
        resposta.Error ??
          "Provedor de CT-e/MDF-e rejeitou o cancelamento do MDF-e",
      );
    }
    if (resposta?.Status === 2) {
      return serializePrisma(mdfe);
    }

    const updated = await prisma.fiscal_mdfes.update({
      where: { id: mdfe.id },
      data: colunasCancelamentoMdfe(justificativa, resposta),
    });
    return serializePrisma(updated);
  }
}
