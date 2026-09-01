import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";
import { normalizePlaca } from "../../utils/placa.js";
import { emitirMdfeSchema } from "../../schemas/fiscalSchema.js";
import { CteMdfeProviderClient } from "./CteMdfeProviderClient.js";
import {
  findOwnedOr404,
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

/**
 * Monta o grupo `seguros` (seg do MDF-e). Se o DTO já traz `seguros` (array
 * livre), respeita o que veio. Senão, monta uma entrada a partir dos campos
 * planos resp_seg / cnpj_seguradora / numero_apolice / numero_averbacao.
 *
 * resp_seg: 1 = emitente do MDF-e, 2 = contratante do serviço de transporte.
 * `nomeSegurador` não é coletado (não há cadastro de seguradora) — ver relatório.
 */
function montarSeguros(dto) {
  if (Array.isArray(dto.seguros) && dto.seguros.length > 0) return dto.seguros;
  if (
    dto.resp_seg == null &&
    dto.cnpj_seguradora == null &&
    dto.numero_apolice == null &&
    dto.numero_averbacao == null
  ) {
    return undefined;
  }
  return [
    {
      indicadorResponsavel: dto.resp_seg ?? undefined,
      cnpjSegurador: dto.cnpj_seguradora ?? undefined,
      numeroApolice: dto.numero_apolice ?? undefined,
      numerosAverbacao: dto.numero_averbacao ? [dto.numero_averbacao] : undefined,
    },
  ];
}

export function montarPayloadMdfe(
  dto,
  placa,
  condutores,
  reboques = [],
  chavesCteVinculados = [],
) {
  const {
    placa: _p,
    condutores: _c,
    reboques: _r,
    ...restRodoviario
  } = dto.rodoviario ?? {};
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
    valor: dto.valor ?? undefined,
    peso: dto.peso ?? undefined,
    Rodoviario: {
      ...restRodoviario,
      placa,
      condutores,
      ...(reboques.length > 0 ? { veicReboque: reboques } : {}),
    },
    seguros: montarSeguros(dto),
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
    produtoPredominante: dto.produto_predominante ?? undefined,
  };
}

/**
 * Valida os CT-e a vincular ao MDF-e: precisam ser do mesmo tenant, estar com
 * status "processado" e ainda não vinculados a outro manifesto. Devolve
 * { ids, chaves } para gravar manifesto_id e montar o payload.
 */
async function resolveCtesVinculados(tenantId, cteIds) {
  if (!Array.isArray(cteIds) || cteIds.length === 0) {
    return { ids: [], chaves: [] };
  }
  const unicos = [...new Set(cteIds.map(Number))];
  const rows = await prisma.fiscal_ctes.findMany({
    where: { id: { in: unicos }, tenant_id: Number(tenantId) },
    select: { id: true, chave_acesso: true, status: true, manifesto_id: true },
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

    const resposta = await CteMdfeProviderClient.enviarManifestoTransporte(
      montarPayloadMdfe(
        dto,
        placa,
        condutores,
        reboques,
        ctesVinculados.chaves,
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

    const [xmlPath, pdfPath] = await Promise.all([
      salvarXmlBase64("mdfe", tenantId, resposta.chave, resposta.base64Xml),
      salvarPdfBase64("mdfe", tenantId, resposta.chave, resposta.base64DAMDFe),
    ]);

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
        data_emissao: new Date(),
        xml_path: xmlPath,
        pdf_path: pdfPath,
      },
    });

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

    logger.info("MDF-e emitido", { tenantId, chave: mdfe.chave_acesso });
    return {
      ...serializePrisma(mdfe),
      base64DAMDFe: resposta.base64DAMDFe ?? null,
    };
  }

  static async encerrar(tenantId, id) {
    const mdfe = await findOwnedOr404("fiscal_mdfes", id, tenantId, "MDF-e");
    const { token } = await resolveEmpresaCteMdfe(
      tenantId,
      mdfe.fiscal_empresa_id ?? undefined,
    );

    const resposta = await CteMdfeProviderClient.encerrarManifestoTransporte(
      {
        ChaveNF: mdfe.chave_acesso,
        NumeroProtocolo: mdfe.numero_protocolo ?? undefined,
        DataEvento: new Date().toISOString(),
      },
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

    const updated = await prisma.fiscal_mdfes.update({
      where: { id: mdfe.id },
      data: {
        status: "encerrado",
        numero_protocolo: resposta?.NuProtocolo ?? mdfe.numero_protocolo,
      },
    });
    return serializePrisma(updated);
  }

  static async cancelar(tenantId, id, justificativa) {
    const mdfe = await findOwnedOr404("fiscal_mdfes", id, tenantId, "MDF-e");
    const { token } = await resolveEmpresaCteMdfe(
      tenantId,
      mdfe.fiscal_empresa_id ?? undefined,
    );

    const resposta = await CteMdfeProviderClient.cancelarNotaFiscal(
      {
        ChaveNF: mdfe.chave_acesso,
        Justificativa: justificativa,
        DataEvento: new Date().toISOString(),
      },
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
      data: { status: "cancelado" },
    });
    return serializePrisma(updated);
  }
}
