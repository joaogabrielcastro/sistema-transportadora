const viteEnv =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function safeContactUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["https:", "mailto:"].includes(url.protocol) ? value : "";
  } catch {
    return "";
  }
}

const configuredUrl = safeContactUrl(viteEnv.VITE_SALES_CONTACT_URL);
const salesEmail = String(
  viteEnv.VITE_SALES_EMAIL || "jwsoftware8@gmail.com",
).trim();

export const SALES_CONTACT_URL =
  configuredUrl ||
  (salesEmail
    ? `mailto:${encodeURIComponent(salesEmail)}?subject=${encodeURIComponent("Demonstração do ATrack")}`
    : "");

export const SALES_CONTACT_ENABLED = Boolean(SALES_CONTACT_URL);

/**
 * Preços de referência do add-on Telemetria (fora dos LIDs públicos).
 * Implantação de rastreador / chip / instalação ficam fora da mensalidade.
 */
export const TELEMETRY_ADDON = Object.freeze({
  fromPerVehicleBrl: 39,
  tiers: Object.freeze([
    {
      id: "basic",
      name: "Basic",
      seatLimit: 10,
      priceMonthlyBrl: 149,
      tagline: "Frota pequena / piloto",
    },
    {
      id: "advanced",
      name: "Advanced",
      seatLimit: 50,
      priceMonthlyBrl: 449,
      tagline: "Mais rastreadores",
    },
  ]),
});
