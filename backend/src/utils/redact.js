import { getRequestId, getTenantIdFromContext } from "./requestContext.js";

const SENSITIVE_KEY =
  /pass|password|token|secret|authorization|smtp|certificado|senha|pfx|usertoken|base64certificate|base64xml|base64dacte|base64damdfe|bearer/i;

function isSensitiveKey(key) {
  return SENSITIVE_KEY.test(String(key || ""));
}

export function redactValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 6) return "[truncated]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      statusCode: value.statusCode,
    };
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  }
  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = redactValue(nested, depth + 1);
    }
  }
  return out;
}

export function withLogContext(meta = {}) {
  const base = {
    requestId: getRequestId(),
    tenantId: getTenantIdFromContext(),
  };
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return redactValue({ ...base, ...meta });
  }
  return redactValue({ ...base, meta });
}
