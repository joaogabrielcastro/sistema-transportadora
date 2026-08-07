import prisma from "../lib/prisma.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { AlertsService } from "./AlertsService.js";
import { WhatsAppService } from "./WhatsAppService.js";
import nodemailer from "nodemailer";

function getMailTransport() {
  if (!config.mail.smtpHost || !config.mail.smtpPort || !config.mail.mailFrom) {
    return null;
  }
  return nodemailer.createTransport({
    host: config.mail.smtpHost,
    port: config.mail.smtpPort,
    secure: config.mail.smtpSecure,
    auth:
      config.mail.smtpUser && config.mail.smtpPass
        ? { user: config.mail.smtpUser, pass: config.mail.smtpPass }
        : undefined,
  });
}

function buildDigestHtml(tenantNome, alertsPayload, overview) {
  const rows = (alertsPayload.alerts || [])
    .slice(0, 20)
    .map(
      (a) =>
        `<li><strong>[${a.severity}]</strong> ${a.title} — ${a.message}</li>`,
    )
    .join("");
  return `
    <div style="font-family:sans-serif;max-width:640px">
      <h2>Resumo semanal — ${tenantNome}</h2>
      <p>Frota: <strong>${overview.totalCaminhoes ?? 0}</strong> ·
         Alertas: <strong>${alertsPayload.counts?.total ?? 0}</strong>
         (críticos: ${alertsPayload.counts?.critical ?? 0})</p>
      ${
        rows
          ? `<h3>Principais alertas</h3><ul>${rows}</ul>`
          : "<p>Nenhum alerta crítico nesta semana. 👍</p>"
      }
      <p style="color:#64748b;font-size:12px">ATrack — Gestão de Frotas</p>
    </div>
  `;
}

export class DigestService {
  static async sendWeeklyForTenant(tenant) {
    if (!tenant.weekly_digest_enabled) return { skipped: true, reason: "disabled" };

    const alerts = await AlertsService.listForTenant(tenant.id);
    const { ReportsService } = await import("./ReportsService.js");
    const overview = await ReportsService.getOverview(tenant.id);

    const to =
      tenant.alert_email ||
      (
        await prisma.users.findFirst({
          where: { tenant_id: tenant.id, role: "admin", ativo: true },
          select: { email: true },
        })
      )?.email;

    let emailSent = false;
    const transport = getMailTransport();
    if (transport && to) {
      await transport.sendMail({
        from: config.mail.mailFrom,
        to,
        subject: `[ATrack] Resumo semanal — ${tenant.nome}`,
        html: buildDigestHtml(tenant.nome, alerts, overview),
      });
      emailSent = true;
    }

    let whatsappSent = false;
    if (
      WhatsAppService.isConfigured() &&
      tenant.whatsapp_notify_phone &&
      alerts.counts.total > 0
    ) {
      const text = `ATrack — ${tenant.nome}\nAlertas: ${alerts.counts.total} (críticos: ${alerts.counts.critical})\n` +
        alerts.alerts
          .slice(0, 5)
          .map((a) => `• ${a.title}`)
          .join("\n");
      await WhatsAppService.sendText({
        to: tenant.whatsapp_notify_phone,
        body: text,
      });
      whatsappSent = true;
    }

    await prisma.tenants.update({
      where: { id: tenant.id },
      data: { last_weekly_digest_at: new Date() },
    });

    return { emailSent, whatsappSent, alerts: alerts.counts.total };
  }

  static async runWeeklyDigestJob() {
    const tenants = await prisma.tenants.findMany({
      where: { ativo: true, weekly_digest_enabled: true },
      select: {
        id: true,
        nome: true,
        alert_email: true,
        whatsapp_notify_phone: true,
        weekly_digest_enabled: true,
        last_weekly_digest_at: true,
      },
    });

    const results = [];
    for (const t of tenants) {
      try {
        // Evita reenvio se já enviou nas últimas 6 dias
        if (t.last_weekly_digest_at) {
          const diff =
            Date.now() - new Date(t.last_weekly_digest_at).getTime();
          if (diff < 6 * 24 * 60 * 60 * 1000) {
            results.push({ tenantId: t.id, skipped: true, reason: "recent" });
            continue;
          }
        }
        const r = await this.sendWeeklyForTenant(t);
        results.push({ tenantId: t.id, ...r });
      } catch (err) {
        logger.warn("Digest semanal falhou", {
          tenantId: t.id,
          err: err?.message,
        });
        results.push({ tenantId: t.id, error: err?.message });
      }
    }
    return results;
  }
}
