import crypto from "node:crypto";
import fs from "node:fs/promises";
import prisma from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import {
  decryptSecret,
  encryptSecret,
  secretIsSet,
} from "../../utils/fiscalCrypto.js";
import { UPLOADS_ROOT, resolverPathNaRaiz } from "../../utils/uploadPaths.js";
import { CTE_STATUS } from "../fiscal/fiscalStatus.js";
import { salvarSeguroConfigSchema } from "../../schemas/averbacaoSchema.js";
import { createAverbacaoProvider } from "./createAverbacaoProvider.js";
import { enqueueAverbacaoJob } from "../../queues/averbacaoJobQueue.js";
import {
  AVERBACAO_AMBIENTE,
  AVERBACAO_OPERACAO,
  AVERBACAO_STATUS,
  AVERBACAO_TIPO,
  decidirEnvioAverbacao,
  mapAtmResponse,
  podeCancelar,
  podeReprocessar,
  publicAverbacao,
  sanitizeForLog,
} from "./averbacaoStatus.js";

const TEST_CONNECTION_COOLDOWN_MS = 10_000;
const lastTestByTenant = new Map();

function httpError(statusCode, message, extra) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (extra) err.details = extra;
  return err;
}

function xmlSha256(xml) {
  return crypto.createHash("sha256").update(String(xml || ""), "utf8").digest("hex");
}

function publicConfig(row) {
  if (!row) {
    return {
      provider: "atm",
      ambiente: AVERBACAO_AMBIENTE.HOMOLOGACAO,
      automatico: false,
      ativo: false,
      seguradora: null,
      numero_apolice: null,
      tipo_cobertura: null,
      codigo_atm: null,
      usuario_set: false,
      senha_set: false,
      status_integracao: "inactive",
      ultima_validacao_em: null,
      ultima_validacao_erro: null,
    };
  }
  const {
    usuario_encrypted: _u,
    senha_encrypted: _s,
    ...rest
  } = row;
  return {
    ...serializePrisma(rest),
    usuario_set: secretIsSet(row.usuario_encrypted),
    senha_set: secretIsSet(row.senha_encrypted),
  };
}

async function loadConfig(tenantId) {
  return prisma.fiscal_seguro_config.findUnique({
    where: { tenant_id: Number(tenantId) },
  });
}

function credentialsFromConfig(cfg) {
  return {
    usuario: decryptSecret(cfg.usuario_encrypted) || "",
    senha: decryptSecret(cfg.senha_encrypted) || "",
    codigoAtm: cfg.codigo_atm || "",
    ambiente: cfg.ambiente,
  };
}

function assertConfigPronta(cfg, { requireAtivo = true } = {}) {
  if (!cfg) {
    throw httpError(400, "Averbação de seguro não está configurada neste tenant.");
  }
  if (requireAtivo && !cfg.ativo) {
    throw httpError(400, "Averbação de seguro está desativada neste tenant.");
  }
  if (!secretIsSet(cfg.usuario_encrypted) || !secretIsSet(cfg.senha_encrypted) || !cfg.codigo_atm) {
    throw httpError(
      400,
      "Credenciais da averbadora incompletas (usuário, senha e código AT&M).",
    );
  }
}

async function lerXmlDocumento(relPath) {
  if (!relPath) {
    throw httpError(
      409,
      "XML protocolado na SEFAZ ainda não está gravado — não é possível averbar.",
    );
  }
  const abs = resolverPathNaRaiz(UPLOADS_ROOT, relPath, "XML fiscal não encontrado");
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    throw httpError(409, "XML fiscal não encontrado em disco — baixe o XML e tente de novo.");
  }
}

async function updateOwnedAverbacao(id, tenantId, data) {
  const result = await prisma.fiscal_averbacoes.updateMany({
    where: { id: Number(id), tenant_id: Number(tenantId) },
    data,
  });
  if (result.count === 0) {
    throw httpError(404, "Averbação não encontrada.");
  }
  return prisma.fiscal_averbacoes.findFirst({
    where: { id: Number(id), tenant_id: Number(tenantId) },
  });
}

function logOp(message, meta) {
  logger.info(message, sanitizeForLog(meta));
}

export class AverbacaoService {
  static publicConfig(row) {
    return publicConfig(row);
  }

  static publicAverbacao(row) {
    return publicAverbacao(row);
  }

  static async getConfig(tenantId) {
    const row = await loadConfig(tenantId);
    return publicConfig(row);
  }

  static async saveConfig(tenantId, body) {
    const dto = salvarSeguroConfigSchema.parse(body);
    const existing = await loadConfig(tenantId);

    if (dto.ambiente === AVERBACAO_AMBIENTE.PRODUCAO && existing?.ambiente === AVERBACAO_AMBIENTE.HOMOLOGACAO) {
      logOp("Averbação: tenant migrando homologação → produção", {
        tenantId: Number(tenantId),
        provider: dto.provider,
      });
    }

    const data = {
      provider: dto.provider,
      ambiente: dto.ambiente,
      automatico: dto.automatico ?? existing?.automatico ?? false,
      ativo: dto.ativo ?? existing?.ativo ?? false,
      seguradora: dto.seguradora === undefined ? existing?.seguradora ?? null : dto.seguradora,
      numero_apolice:
        dto.numero_apolice === undefined ? existing?.numero_apolice ?? null : dto.numero_apolice,
      tipo_cobertura:
        dto.tipo_cobertura === undefined ? existing?.tipo_cobertura ?? null : dto.tipo_cobertura,
      codigo_atm: dto.codigo_atm === undefined ? existing?.codigo_atm ?? null : dto.codigo_atm,
      status_integracao: existing?.status_integracao || "inactive",
    };

    if (dto.usuario) data.usuario_encrypted = encryptSecret(dto.usuario);
    if (dto.senha) data.senha_encrypted = encryptSecret(dto.senha);

    const row = existing
      ? await prisma.fiscal_seguro_config.update({
          where: { tenant_id: Number(tenantId) },
          data,
        })
      : await prisma.fiscal_seguro_config.create({
          data: { tenant_id: Number(tenantId), ...data },
        });

    logOp("Averbação: configuração salva", {
      tenantId: Number(tenantId),
      provider: row.provider,
      ambiente: row.ambiente,
      automatico: row.automatico,
      ativo: row.ativo,
    });
    return publicConfig(row);
  }

  static async testarConexao(tenantId) {
    const now = Date.now();
    const last = lastTestByTenant.get(Number(tenantId)) || 0;
    if (now - last < TEST_CONNECTION_COOLDOWN_MS) {
      throw httpError(429, "Aguarde alguns segundos antes de testar a conexão de novo.");
    }
    lastTestByTenant.set(Number(tenantId), now);

    const cfg = await loadConfig(tenantId);
    assertConfigPronta(cfg, { requireAtivo: false });
    const provider = createAverbacaoProvider(cfg.provider, credentialsFromConfig(cfg));
    const result = await provider.testarConexao();

    const ok = Boolean(result?.ok);
    await prisma.fiscal_seguro_config.update({
      where: { tenant_id: Number(tenantId) },
      data: {
        status_integracao: ok ? "ok" : "error",
        ultima_validacao_em: new Date(),
        ultima_validacao_erro: ok ? null : (result?.message || "Falha na autenticação").slice(0, 500),
      },
    });

    logOp("Averbação: teste de conexão", {
      tenantId: Number(tenantId),
      provider: cfg.provider,
      ambiente: cfg.ambiente,
      ok,
      httpStatus: result?.httpStatus ?? null,
    });

    return {
      ok,
      message: ok
        ? "Conexão autenticada com a averbadora."
        : result?.message || "Falha ao autenticar na averbadora.",
      ambiente: cfg.ambiente,
      provider: cfg.provider,
    };
  }

  static async buscarPorDocumento(tenantId, { cteId, mdfeId } = {}) {
    if (!cteId && !mdfeId) return null;
    const row = await prisma.fiscal_averbacoes.findFirst({
      where: {
        tenant_id: Number(tenantId),
        ...(cteId ? { cte_id: Number(cteId) } : { mdfe_id: Number(mdfeId) }),
      },
      orderBy: { id: "desc" },
    });
    return publicAverbacao(row);
  }

  static async getById(tenantId, id) {
    const row = await prisma.fiscal_averbacoes.findFirst({
      where: { id: Number(id), tenant_id: Number(tenantId) },
    });
    if (!row) throw httpError(404, "Averbação não encontrada.");
    return publicAverbacao(row);
  }

  /**
   * Chamado após CT-e/MDF-e autorizado. Não lança para o caller da emissão.
   */
  static async agendarAposAutorizacao({ tenantId, tipo, documentoId }) {
    const cfg = await loadConfig(tenantId);
    if (!cfg?.ativo || !cfg.automatico) {
      logOp("Averbação automática desligada — ignorando", {
        tenantId: Number(tenantId),
        tipo,
        documentoId,
      });
      return null;
    }
    return this.solicitar(tenantId, {
      cte_id: tipo === AVERBACAO_TIPO.CTE ? documentoId : undefined,
      mdfe_id: tipo === AVERBACAO_TIPO.MDFE ? documentoId : undefined,
    });
  }

  static async agendarCancelamento({ tenantId, tipo, documentoId }) {
    const cfg = await loadConfig(tenantId);
    if (!cfg?.ativo) return null;
    const existing = await prisma.fiscal_averbacoes.findFirst({
      where: {
        tenant_id: Number(tenantId),
        ...(tipo === AVERBACAO_TIPO.CTE
          ? { cte_id: Number(documentoId) }
          : { mdfe_id: Number(documentoId) }),
      },
    });
    if (!existing || !podeCancelar(existing)) return existing ? publicAverbacao(existing) : null;

    const updated = await updateOwnedAverbacao(existing.id, tenantId, {
      operacao: AVERBACAO_OPERACAO.CANCELAR,
      status: AVERBACAO_STATUS.PENDING,
      retryable: true,
      error_code: null,
      error_message: null,
    });
    await enqueueAverbacaoJob(updated.id, Number(tenantId));
    logOp("Averbação: cancelamento enfileirado", {
      tenantId: Number(tenantId),
      averbacaoId: updated.id,
      tipo,
      documentoId,
    });
    return publicAverbacao(updated);
  }

  static async solicitar(tenantId, { cte_id, mdfe_id } = {}) {
    const cfg = await loadConfig(tenantId);
    assertConfigPronta(cfg);

    const tipo = cte_id ? AVERBACAO_TIPO.CTE : AVERBACAO_TIPO.MDFE;
    const table = tipo === AVERBACAO_TIPO.CTE ? "fiscal_ctes" : "fiscal_mdfes";
    const id = Number(cte_id || mdfe_id);
    const doc = await prisma[table].findFirst({
      where: { id, tenant_id: Number(tenantId) },
    });
    if (!doc) {
      throw httpError(404, tipo === AVERBACAO_TIPO.CTE ? "CT-e não encontrado." : "MDF-e não encontrado.");
    }
    if (doc.status !== CTE_STATUS.PROCESSADO && doc.status !== "encerrado") {
      throw httpError(
        400,
        "Só é possível averbar documento autorizado na SEFAZ (status processado).",
      );
    }
    if (!doc.chave_acesso) {
      throw httpError(400, "Documento sem chave de acesso — aguarde a autorização da SEFAZ.");
    }

    const existing = await prisma.fiscal_averbacoes.findFirst({
      where: {
        tenant_id: Number(tenantId),
        provider: cfg.provider,
        tipo_documento: tipo,
        chave_acesso: doc.chave_acesso,
      },
    });

    const decision = decidirEnvioAverbacao(existing);
    if (decision.action === "skip_already_averbed") {
      return publicAverbacao(existing);
    }
    if (decision.action === "skip_in_flight") {
      return publicAverbacao(existing);
    }
    if (decision.action === "skip_cancelled") {
      return publicAverbacao(existing);
    }
    if (decision.action === "skip_rejected") {
      throw httpError(
        409,
        "Averbação rejeitada pela averbadora. Corrija os dados e use reprocessar.",
        { averbacao: publicAverbacao(existing) },
      );
    }

    const operacao =
      tipo === AVERBACAO_TIPO.MDFE
        ? AVERBACAO_OPERACAO.DECLARAR
        : AVERBACAO_OPERACAO.AVERBAR;

    const data = {
      tenant_id: Number(tenantId),
      cte_id: tipo === AVERBACAO_TIPO.CTE ? doc.id : null,
      mdfe_id: tipo === AVERBACAO_TIPO.MDFE ? doc.id : null,
      tipo_documento: tipo,
      operacao,
      provider: cfg.provider,
      ambiente: cfg.ambiente,
      chave_acesso: doc.chave_acesso,
      seguradora: cfg.seguradora,
      numero_apolice: cfg.numero_apolice,
      status: AVERBACAO_STATUS.PENDING,
      retryable: true,
      request_meta: {
        xml_path: doc.xml_path || null,
        xml_presente: Boolean(doc.xml_path),
      },
    };

    let row;
    if (existing) {
      row = await updateOwnedAverbacao(existing.id, tenantId, {
        ...data,
        error_code: null,
        error_message: null,
      });
    } else {
      try {
        row = await prisma.fiscal_averbacoes.create({ data });
      } catch (err) {
        if (err?.code === "P2002") {
          const raced = await prisma.fiscal_averbacoes.findFirst({
            where: {
              tenant_id: Number(tenantId),
              provider: cfg.provider,
              tipo_documento: tipo,
              chave_acesso: doc.chave_acesso,
            },
          });
          if (raced) return publicAverbacao(raced);
        }
        throw err;
      }
    }

    await enqueueAverbacaoJob(row.id, Number(tenantId));
    logOp("Averbação enfileirada", {
      tenantId: Number(tenantId),
      averbacaoId: row.id,
      cteId: row.cte_id,
      mdfeId: row.mdfe_id,
      provider: row.provider,
      chave: row.chave_acesso,
    });
    return publicAverbacao(row);
  }

  static async reprocessar(tenantId, id) {
    const row = await prisma.fiscal_averbacoes.findFirst({
      where: { id: Number(id), tenant_id: Number(tenantId) },
    });
    if (!row) throw httpError(404, "Averbação não encontrada.");
    if (!podeReprocessar(row)) {
      throw httpError(
        409,
        `Não é possível reprocessar averbação com status "${row.status}".`,
      );
    }
    const updated = await updateOwnedAverbacao(row.id, tenantId, {
      status: AVERBACAO_STATUS.PENDING,
      retryable: true,
      error_code: null,
      error_message: null,
    });
    await enqueueAverbacaoJob(updated.id, Number(tenantId));
    logOp("Averbação reprocessamento enfileirado", {
      tenantId: Number(tenantId),
      averbacaoId: updated.id,
      provider: updated.provider,
    });
    return publicAverbacao(updated);
  }

  static async cancelar(tenantId, id) {
    const row = await prisma.fiscal_averbacoes.findFirst({
      where: { id: Number(id), tenant_id: Number(tenantId) },
    });
    if (!row) throw httpError(404, "Averbação não encontrada.");
    if (!podeCancelar(row)) {
      throw httpError(
        409,
        "Só é possível cancelar uma averbação já averbada. É necessário o XML de cancelamento protocolado na SEFAZ.",
      );
    }
    const updated = await updateOwnedAverbacao(row.id, tenantId, {
      operacao: AVERBACAO_OPERACAO.CANCELAR,
      status: AVERBACAO_STATUS.PENDING,
      retryable: true,
    });
    await enqueueAverbacaoJob(updated.id, Number(tenantId));
    return publicAverbacao(updated);
  }

  static async consultar(tenantId, id) {
    const row = await prisma.fiscal_averbacoes.findFirst({
      where: { id: Number(id), tenant_id: Number(tenantId) },
    });
    if (!row) throw httpError(404, "Averbação não encontrada.");
    if (
      row.status === AVERBACAO_STATUS.AVERBED ||
      row.status === AVERBACAO_STATUS.CANCELLED
    ) {
      return publicAverbacao(row);
    }
    if (podeReprocessar(row) || row.status === AVERBACAO_STATUS.PROCESSING) {
      await enqueueAverbacaoJob(row.id, Number(tenantId));
    }
    const fresh = await prisma.fiscal_averbacoes.findFirst({
      where: { id: row.id, tenant_id: Number(tenantId) },
    });
    return publicAverbacao(fresh);
  }

  /**
   * Processa um job (BullMQ / memória). Lança só em falha retryable.
   */
  static async processarPorId(averbacaoId, tenantId) {
    const row = await prisma.fiscal_averbacoes.findFirst({
      where: { id: Number(averbacaoId), tenant_id: Number(tenantId) },
    });
    if (!row) {
      logger.warn("Averbação job: registro inexistente", {
        averbacaoId,
        tenantId,
      });
      return null;
    }

    const decision = decidirEnvioAverbacao(row);
    if (
      decision.action === "skip_already_averbed" ||
      decision.action === "skip_cancelled" ||
      decision.action === "skip_in_flight" ||
      decision.action === "skip_rejected"
    ) {
      logOp("Averbação job ignorado (idempotência)", {
        tenantId,
        averbacaoId: row.id,
        action: decision.action,
        status: row.status,
      });
      return publicAverbacao(row);
    }

    const claimed = await prisma.fiscal_averbacoes.updateMany({
      where: {
        id: row.id,
        tenant_id: Number(tenantId),
        status: { in: [AVERBACAO_STATUS.PENDING, AVERBACAO_STATUS.ERROR, AVERBACAO_STATUS.PROCESSING] },
      },
      data: {
        status: AVERBACAO_STATUS.PROCESSING,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 0) {
      const current = await prisma.fiscal_averbacoes.findFirst({
        where: { id: row.id, tenant_id: Number(tenantId) },
      });
      return publicAverbacao(current);
    }

    const cfg = await loadConfig(tenantId);
    assertConfigPronta(cfg, { requireAtivo: false });
    if (cfg.ambiente !== row.ambiente) {
      throw httpError(
        409,
        "Ambiente da configuração divergiu do ambiente gravado na averbação — recuse o reenvio cruzado.",
      );
    }

    const table = row.tipo_documento === AVERBACAO_TIPO.CTE ? "fiscal_ctes" : "fiscal_mdfes";
    const doc = await prisma[table].findFirst({
      where: {
        id: row.tipo_documento === AVERBACAO_TIPO.CTE ? row.cte_id : row.mdfe_id,
        tenant_id: Number(tenantId),
      },
    });
    if (!doc) {
      await this.#persistResult(row.id, tenantId, {
        status: AVERBACAO_STATUS.ERROR,
        retryable: false,
        error_code: "cte_missing",
        error_message: "Documento fiscal vinculado não existe mais.",
      });
      return this.getById(tenantId, row.id);
    }

    let xml;
    try {
      xml = await lerXmlDocumento(doc.xml_path);
    } catch (err) {
      const retryable = err.statusCode === 409;
      await this.#persistResult(row.id, tenantId, {
        status: AVERBACAO_STATUS.ERROR,
        retryable,
        error_code: "xml_missing",
        error_message: err.message,
      });
      if (retryable) throw err;
      return this.getById(tenantId, row.id);
    }

    const provider = createAverbacaoProvider(cfg.provider, credentialsFromConfig(cfg));
    const envio = { xml, tipoDocumento: row.tipo_documento };
    const started = Date.now();

    let raw;
    try {
      if (row.operacao === AVERBACAO_OPERACAO.CANCELAR) {
        raw = await provider.cancelar(envio);
      } else if (row.status === AVERBACAO_STATUS.AVERBED) {
        raw = await provider.consultar(envio);
      } else {
        raw = await provider.averbar(envio);
      }
    } catch (err) {
      await this.#persistResult(row.id, tenantId, {
        status: AVERBACAO_STATUS.ERROR,
        retryable: true,
        error_code: err.timeout ? "timeout" : "provider",
        error_message: err.message,
      });
      throw err;
    }

    const mapped = mapAtmResponse({
      response: raw.response,
      httpStatus: raw.httpStatus,
      operacao: row.operacao,
      timeout: raw.timeout,
      network: raw.network,
    });

    const responseSafe = sanitizeForLog(raw.response);
    await this.#persistResult(row.id, tenantId, {
      status: mapped.status,
      retryable: mapped.retryable,
      error_code: mapped.errorCode,
      error_message: mapped.errorMessage,
      protocolo: mapped.extracted?.protocolo ?? null,
      numero_averbacao: mapped.extracted?.numeroAverbacao ?? null,
      seguradora: mapped.extracted?.nomeSeguradora || cfg.seguradora,
      numero_apolice: mapped.extracted?.numApolice || cfg.numero_apolice,
      averbed_at:
        mapped.status === AVERBACAO_STATUS.AVERBED
          ? mapped.extracted?.dh
            ? new Date(mapped.extracted.dh)
            : new Date()
          : undefined,
      cancelled_at:
        mapped.status === AVERBACAO_STATUS.CANCELLED ? new Date() : undefined,
      request_meta: {
        xml_sha256: xmlSha256(xml),
        xml_chars: xml.length,
        ambiente: row.ambiente,
        provider: row.provider,
        elapsed_ms: Date.now() - started,
      },
      response_data: responseSafe,
    });

    logOp("Averbação processada", {
      tenantId,
      averbacaoId: row.id,
      cteId: row.cte_id,
      mdfeId: row.mdfe_id,
      provider: row.provider,
      operacao: row.operacao,
      status: mapped.status,
      httpStatus: raw.httpStatus,
      errorCode: mapped.errorCode,
      protocolo: mapped.extracted?.protocolo || null,
    });

    if (mapped.retryable && mapped.status === AVERBACAO_STATUS.ERROR) {
      throw httpError(503, mapped.errorMessage || "Falha temporária na averbadora.");
    }
    return this.getById(tenantId, row.id);
  }

  static async #persistResult(id, tenantId, data) {
    const payload = { ...data };
    if (payload.averbed_at === undefined) delete payload.averbed_at;
    if (payload.cancelled_at === undefined) delete payload.cancelled_at;
    await prisma.fiscal_averbacoes.updateMany({
      where: { id: Number(id), tenant_id: Number(tenantId) },
      data: payload,
    });
  }
}
