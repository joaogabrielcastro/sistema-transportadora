import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Envio WhatsApp via API compatível com Meta Cloud / Twilio-like HTTP.
 * Configure WHATSAPP_API_URL + WHATSAPP_TOKEN (+ opcional WHATSAPP_FROM).
 */
export class WhatsAppService {
  static isConfigured() {
    return Boolean(
      config.whatsapp?.apiUrl && config.whatsapp?.token,
    );
  }

  /**
   * @param {{ to: string, body: string }} opts
   */
  static async sendText({ to, body }) {
    if (!this.isConfigured()) {
      const err = new Error(
        "WhatsApp não configurado. Defina WHATSAPP_API_URL e WHATSAPP_TOKEN.",
      );
      err.statusCode = 503;
      throw err;
    }

    const phone = String(to || "").replace(/\D/g, "");
    if (phone.length < 10) {
      const err = new Error("Número WhatsApp inválido");
      err.statusCode = 400;
      throw err;
    }

    const url = config.whatsapp.apiUrl;
    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: String(body).slice(0, 4000) },
      ...(config.whatsapp.from ? { from: config.whatsapp.from } : {}),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("WhatsApp envio falhou", {
        status: res.status,
        body: text.slice(0, 300),
      });
      const err = new Error(
        `Falha ao enviar WhatsApp (${res.status}). Verifique a configuração.`,
      );
      err.statusCode = 502;
      throw err;
    }

    return { ok: true };
  }
}
