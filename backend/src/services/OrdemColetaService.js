import fs from "node:fs";
import puppeteer from "puppeteer";
import nodemailer from "nodemailer";
import prisma from "../lib/prisma.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import { mergeTemplate } from "../utils/templateMerge.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { ORDEM_COLETA_PADRAO_HTML } from "../templates/ordemColetaPadraoHtml.js";
import { ORDEM_COLETA_CANOINHAS_HTML } from "../templates/ordemColetaCanoinhasHtml.js";

const str = (v) => {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
};

const pickTemplate = (tipo) => {
  // CANOINHAS = id legado do tipo “autorização compacta” (exemplo de cliente), não regra global
  if (tipo === "CANOINHAS") return ORDEM_COLETA_CANOINHAS_HTML;
  return ORDEM_COLETA_PADRAO_HTML;
};

const defaultAssunto = (tipo, placaLabel) => {
  const base =
    tipo === "CANOINHAS"
      ? "Autorização de coleta"
      : "Ordem de coleta";
  return `${base}${placaLabel ? ` — ${placaLabel}` : ""}`;
};

export class OrdemColetaService {
  static async mergeVars({ placa, dadosVariaveis }) {
    const now = new Date();
    const dataEmissao = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const horaEmissao = now.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });

    let caminhao = null;
    if (placa) {
      caminhao = await caminhoesModel.getByPlaca(placa);
    }

    const fromTruck = caminhao
      ? {
          placa_cavalo: str(caminhao.placa),
          motorista: str(caminhao.motorista),
          placa_carreta_1: str(caminhao.placa_carreta_1),
          placa_carreta_2: str(caminhao.placa_carreta_2),
          numero_cavalo: str(caminhao.numero_cavalo),
          numero_carreta_1: str(caminhao.numero_carreta_1),
          numero_carreta_2: str(caminhao.numero_carreta_2),
          marca_veiculo: str(caminhao.marca),
          modelo_veiculo: str(caminhao.modelo),
          ano_veiculo: str(caminhao.ano),
        }
      : {
          placa_cavalo: "",
          motorista: "",
          placa_carreta_1: "",
          placa_carreta_2: "",
          numero_cavalo: "",
          numero_carreta_1: "",
          numero_carreta_2: "",
          marca_veiculo: "",
          modelo_veiculo: "",
          ano_veiculo: "",
        };

    const fromForm = Object.fromEntries(
      Object.entries(dadosVariaveis || {}).map(([k, v]) => [k, str(v)]),
    );

    const base = {
      data_emissao: dataEmissao,
      hora_emissao: horaEmissao,
      local_coleta: "",
      endereco_completo: "",
      cidade_uf: "",
      contato_local: "",
      telefone_coleta: "",
      mercadoria: "",
      volumes: "",
      peso_bruto_estimado: "",
      numero_nf: "",
      numero_pedido: "",
      observacoes_gerais: "",
      data_coleta_prevista: "",
      horario_previsto_coleta: "",
      horario_chegada_coleta: "____:____",
      horario_saida_coleta: "____:____",
      numero_autorizacao: "",
      razao_social: "",
      cnpj: "",
      validade_ate: "",
      finalidade_coleta: "",
      cliente_endereco_linha1: "",
      cliente_endereco_linha2: "",
      fornecedor_nome: "",
      fornecedor_cnpj: "",
      fornecedor_endereco: "",
      motorista_cpf: "",
      tipo_veiculo: "",
    };

    return { ...base, ...fromTruck, ...fromForm };
  }

  static buildHtml(tipo, vars) {
    const raw = pickTemplate(tipo);
    return mergeTemplate(raw, vars);
  }

  static resolvePuppeteerExecutable() {
    const candidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome-stable",
    ]
      .map((p) => (p || "").trim())
      .filter(Boolean);

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  static async htmlToPdfBuffer(html) {
    const executablePath = OrdemColetaService.resolvePuppeteerExecutable();
    if (!executablePath) {
      const err = new Error(
        "Geração de PDF indisponível: Chromium não encontrado no servidor. Use o Dockerfile do backend ou defina PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium.",
      );
      err.statusCode = 503;
      throw err;
    }

    const launchOpts = {
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
        "--single-process",
        "--no-zygote",
      ],
    };

    let browser;
    try {
      browser = await puppeteer.launch(launchOpts);
      const page = await browser.newPage();
      await page.emulateMediaType("print");
      // HTML inline (base64/SVG): "load" é mais estável que networkidle0 em container
      await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
        timeout: 60_000,
      });
      return pdf;
    } catch (cause) {
      logger.error("Falha ao gerar PDF com Puppeteer", {
        message: cause?.message,
        executablePath,
      });
      const err = new Error(
        `Não foi possível gerar o PDF (${cause?.message || "erro no Chromium"}). Confira Chromium no container e PUPPETEER_EXECUTABLE_PATH.`,
      );
      err.statusCode = 503;
      throw err;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  static getMailTransport() {
    const host = (config.mail?.smtpHost || "").trim();
    const port = Number(config.mail?.smtpPort) || 0;
    const from = (config.mail?.mailFrom || "").trim();
    if (!host || !port || !from) return null;

    return nodemailer.createTransport({
      host,
      port,
      secure: config.mail.smtpSecure,
      auth:
        config.mail.smtpUser && config.mail.smtpPass
          ? { user: config.mail.smtpUser, pass: config.mail.smtpPass }
          : undefined,
    });
  }

  static assertMailConfigured() {
    const t = OrdemColetaService.getMailTransport();
    if (!t) {
      const err = new Error(
        "Envio por e-mail não configurado. Defina SMTP_HOST, SMTP_PORT e MAIL_FROM no servidor (e credenciais se necessário).",
      );
      err.statusCode = 503;
      throw err;
    }
    return t;
  }

  static async enviarEmailComAnexo({ to, subject, text, pdfBuffer, filename }) {
    const transport = OrdemColetaService.assertMailConfigured();
    const from = (config.mail.mailFrom || "").trim();
    await transport.sendMail({
      from,
      to,
      subject,
      text: text || "Segue em anexo o documento gerado pelo sistema.",
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  }

  static async registrarEnvio({
    tipo,
    caminhaoId,
    dados,
    emailDestinatario,
    assunto,
    enviadoEm,
    erroEnvio,
  }) {
    return prisma.ordens_coleta_envio.create({
      data: {
        tipo,
        caminhao_id: caminhaoId,
        dados,
        email_destinatario: emailDestinatario,
        assunto: assunto ?? null,
        enviado_em: enviadoEm,
        erro_envio: erroEnvio ?? null,
      },
    });
  }

  static async listarHistorico({ page, limit }) {
    const skip = (page - 1) * limit;
    const [rows, total] = await prisma.$transaction([
      prisma.ordens_coleta_envio.findMany({
        orderBy: { criado_em: "desc" },
        skip,
        take: limit,
        include: {
          caminhoes: { select: { placa: true, motorista: true } },
        },
      }),
      prisma.ordens_coleta_envio.count(),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        email_destinatario: r.email_destinatario,
        assunto: r.assunto,
        criado_em: r.criado_em,
        enviado_em: r.enviado_em,
        erro_envio: r.erro_envio,
        caminhao_placa: r.caminhoes?.placa ?? null,
        caminhao_motorista: r.caminhoes?.motorista ?? null,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  static async resolverCaminhaoId(placa) {
    if (!placa) return null;
    const c = await caminhoesModel.getByPlaca(placa);
    return c?.id ?? null;
  }

  static filenamePrefix(tipo) {
    return tipo === "CANOINHAS" ? "autorizacao_coleta_compacta" : "ordem_coleta";
  }

  static async fluxoEnviar(parsed) {
    OrdemColetaService.assertMailConfigured();

    const vars = await OrdemColetaService.mergeVars(parsed);
    const html = OrdemColetaService.buildHtml(parsed.tipo, vars);
    const pdfBuffer = await OrdemColetaService.htmlToPdfBuffer(html);
    const prefix = OrdemColetaService.filenamePrefix(parsed.tipo);
    const filename = `${prefix}_${Date.now()}.pdf`;
    const assunto =
      (parsed.assunto && String(parsed.assunto).trim()) ||
      defaultAssunto(parsed.tipo, vars.placa_cavalo || parsed.placa || null);

    const caminhaoId = await OrdemColetaService.resolverCaminhaoId(parsed.placa);
    const dadosGravar = {
      placa: parsed.placa,
      dadosVariaveis: parsed.dadosVariaveis,
      assunto_usado: assunto,
    };

    const tipoLegivel =
      parsed.tipo === "CANOINHAS" ? "Autorização compacta" : "Ordem de coleta";
    try {
      await OrdemColetaService.enviarEmailComAnexo({
        to: parsed.emailDestinatario,
        subject: assunto,
        text: `Documento em anexo (${tipoLegivel}).`,
        pdfBuffer,
        filename,
      });

      const row = await OrdemColetaService.registrarEnvio({
        tipo: parsed.tipo,
        caminhaoId,
        dados: dadosGravar,
        emailDestinatario: parsed.emailDestinatario,
        assunto,
        enviadoEm: new Date(),
        erroEnvio: null,
      });

      logger.info("Ordem de coleta enviada por e-mail", {
        id: row.id,
        tipo: parsed.tipo,
        to: parsed.emailDestinatario,
      });

      return { id: row.id, assunto, filename };
    } catch (err) {
      logger.error("Falha ao enviar ordem de coleta", { err: err?.message });

      await OrdemColetaService.registrarEnvio({
        tipo: parsed.tipo,
        caminhaoId,
        dados: dadosGravar,
        emailDestinatario: parsed.emailDestinatario,
        assunto,
        enviadoEm: null,
        erroEnvio: err?.message || String(err),
      }).catch((e) => logger.error("Falha ao registrar ordem com erro", { err: e?.message }));

      throw err;
    }
  }
}
