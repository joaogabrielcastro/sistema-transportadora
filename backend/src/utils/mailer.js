import nodemailer from "nodemailer";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

function mailSettings(mail) {
  return mail || config.mail;
}

export function resolvedMailFrom(mail) {
  const m = mailSettings(mail);
  return String(m.mailFrom || m.smtpUser || "").trim();
}

export function isMailConfigured(mail) {
  const m = mailSettings(mail);
  const host = String(m.smtpHost || "").trim();
  const port = Number(m.smtpPort) || 0;
  return Boolean(host && port && resolvedMailFrom(m));
}

export function getMailTransport(mail) {
  if (!isMailConfigured(mail)) return null;

  const m = mailSettings(mail);
  const port = Number(m.smtpPort) || 0;
  return nodemailer.createTransport({
    host: String(m.smtpHost || "").trim(),
    port,
    secure: Boolean(m.smtpSecure),
    requireTLS: !m.smtpSecure && port === 587,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 25_000,
    auth:
      m.smtpUser && m.smtpPass
        ? { user: m.smtpUser, pass: m.smtpPass }
        : undefined,
  });
}

export function assertMailConfigured(mail) {
  const transport = getMailTransport(mail);
  if (!transport) {
    const err = new Error(
      "Envio por e-mail não configurado. Defina SMTP_HOST, SMTP_PORT e MAIL_FROM (ou SMTP_USER) no servidor.",
    );
    err.statusCode = 503;
    err.code = "MAIL_NOT_CONFIGURED";
    throw err;
  }
  return transport;
}

export async function sendMail({
  to,
  subject,
  text,
  html,
  attachments,
} = {}) {
  const transport = assertMailConfigured();
  const from = resolvedMailFrom();
  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

/**
 * Confere o SMTP uma vez (boot). Não lança — só registra o resultado.
 */
export async function verifyMailOnBoot() {
  if (!isMailConfigured()) {
    logger.warn(
      "SMTP não configurado — recuperação de senha, convite e e-mail de ordem de coleta ficam indisponíveis.",
    );
    return { configured: false, ok: false };
  }

  const transport = getMailTransport();
  try {
    await transport.verify();
    logger.info("SMTP verificado com sucesso", {
      host: config.mail.smtpHost,
      port: config.mail.smtpPort,
    });
    return { configured: true, ok: true };
  } catch (err) {
    logger.warn("SMTP configurado, mas a verificação falhou", {
      error: err?.message || String(err),
    });
    return { configured: true, ok: false, error: err?.message || String(err) };
  }
}
