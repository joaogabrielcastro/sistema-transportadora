import { parseNfeXml, classificarNfe, normalizePlaca } from "../utils/parseNfeXml.js";
import prisma from "../lib/prisma.js";
import { GastoService } from "./GastoService.js";
import { resolveCombustivelTipoId } from "../utils/tiposGastos.js";
import { normalizeDatesForDb } from "../utils/dates.js";

function badRequest(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  throw err;
}

function xmlFromUpload(file) {
  if (!file?.buffer) {
    badRequest("Envie o arquivo XML da NF-e.");
  }
  return file.buffer.toString("utf8");
}

export function lerXmls(files) {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  if (!list.length) badRequest("Envie ao menos um arquivo XML da NF-e.");
  return list.map((file) => {
    const parsed = parseNfeXml(xmlFromUpload(file));
    return {
      ...parsed,
      arquivo: file.originalname || null,
    };
  });
}

export function lerXmlsParaCte(files) {
  const notas = lerXmls(files);
  const carga = notas.filter((n) => n.uso !== "combustivel");
  const combustivel = notas.filter((n) => n.uso === "combustivel");
  if (!carga.length) {
    badRequest(
      "Este XML parece nota de combustível. Lance o abastecimento em Manutenção e gastos (Importar XML do posto).",
      { uso: "combustivel" },
    );
  }
  return {
    notas: carga,
    ignoradas_combustivel: combustivel.map((n) => ({
      numero: n.numero,
      chave_acesso: n.chave_acesso,
      arquivo: n.arquivo,
    })),
  };
}

async function resolveCaminhaoPorPlaca(tenantId, parsed, caminhaoIdInformado) {
  if (caminhaoIdInformado) {
    const byId = await prisma.caminhoes.findFirst({
      where: { id: Number(caminhaoIdInformado), tenant_id: Number(tenantId) },
      select: { id: true, placa: true },
    });
    if (!byId) badRequest("Caminhão informado não foi encontrado.");
    return byId;
  }

  const placas = [
    parsed.placa_sugerida,
    ...(Array.isArray(parsed.placas_sugeridas) ? parsed.placas_sugeridas : []),
  ]
    .map(normalizePlaca)
    .filter(Boolean);

  if (!placas.length) return null;

  const frota = await prisma.caminhoes.findMany({
    where: { tenant_id: Number(tenantId) },
    select: { id: true, placa: true },
  });
  for (const placa of [...new Set(placas)]) {
    const hit = frota.find((c) => normalizePlaca(c.placa) === placa);
    if (hit) return hit;
  }
  return null;
}

function dataGastoIso(parsed) {
  if (
    parsed?.data_emissao_ymd &&
    /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_emissao_ymd)
  ) {
    return parsed.data_emissao_ymd;
  }
  const d = parsed.data_emissao ? new Date(parsed.data_emissao) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export class CombustivelNfeService {
  static preview(xmlContent) {
    const parsed = parseNfeXml(xmlContent);
    if (classificarNfe(parsed) !== "combustivel") {
      badRequest(
        "Este XML não parece uma NF-e de combustível (diesel, gasolina, etanol). Use Notas / Estoque para peças ou o CT-e para a nota da carga.",
      );
    }
    return parsed;
  }

  static async importar(tenantId, xmlContent, { caminhao_id } = {}) {
    const parsed = this.preview(xmlContent);
    const litros = parsed.quantidade_litros;
    if (!litros) {
      badRequest("Não foi possível ler a quantidade em litros no XML.");
    }
    const valor = Number(parsed.valor_total);
    if (!Number.isFinite(valor) || valor <= 0) {
      badRequest("Não foi possível ler o valor total da NF-e de combustível.");
    }

    const tipoId = await resolveCombustivelTipoId();
    if (!tipoId) {
      badRequest("Cadastre o tipo de gasto Combustível antes de importar o XML.");
    }

    if (parsed.chave_acesso) {
      const dup = await prisma.gastos.findFirst({
        where: {
          tenant_id: Number(tenantId),
          detalhes: {
            path: ["chave_nfe"],
            equals: parsed.chave_acesso,
          },
        },
        select: { id: true },
      });
      if (dup) {
        const err = new Error(
          `Esta NF-e de combustível já foi lançada (gasto #${dup.id}).`,
        );
        err.statusCode = 409;
        throw err;
      }
    }

    const caminhao = await resolveCaminhaoPorPlaca(
      tenantId,
      parsed,
      caminhao_id,
    );
    if (!caminhao) {
      badRequest(
        "Informe o caminhão. A placa não veio no XML ou não está cadastrada na frota.",
        { placas_sugeridas: parsed.placas_sugeridas || [] },
      );
    }

    const posto = parsed.emitente || parsed.remetente?.razao_social || "";
    return GastoService.createWithCaminhaoUpdate(
      tenantId,
      normalizeDatesForDb({
        caminhao_id: caminhao.id,
        tipo_gasto_id: tipoId,
        data_gasto: dataGastoIso(parsed),
        valor,
        quantidade_combustivel: litros,
        descricao: `NF-e ${parsed.numero}${parsed.serie ? `/${parsed.serie}` : ""}${
          posto ? ` — ${posto}` : ""
        }`.slice(0, 500),
        status_pagamento: "pago",
        detalhes: {
          posto: posto.slice(0, 120),
          preco_litro: parsed.preco_litro ?? "",
          chave_nfe: parsed.chave_acesso || "",
        },
      }),
    );
  }
}
