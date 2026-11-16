/**
 * Catálogo de protocolos suportados / previstos.
 * Teltonika é o único com gateway ativo; demais são stubs comerciais.
 */
export const PROTOCOL_CATALOG = Object.freeze([
  {
    id: "teltonika",
    manufacturer: "Teltonika",
    status: "supported",
    transport: "tcp",
    notes: "Codec 8 / 8E via TELETONIKA_TCP_ENABLED",
  },
  {
    id: "http_json",
    manufacturer: "ATrack",
    status: "supported",
    transport: "http",
    notes: "POST /api/v1/telemetry/ingest com Authorization Device",
  },
  {
    id: "suntech",
    manufacturer: "Suntech",
    status: "planned",
    transport: "tcp",
    notes: "Adapter previsto — não implementado",
  },
  {
    id: "queclink",
    manufacturer: "Queclink",
    status: "planned",
    transport: "tcp",
    notes: "Adapter previsto — não implementado",
  },
]);

export function listSupportedProtocols() {
  return PROTOCOL_CATALOG.map((p) => ({ ...p }));
}

export function getProtocol(id) {
  return PROTOCOL_CATALOG.find((p) => p.id === id) || null;
}
