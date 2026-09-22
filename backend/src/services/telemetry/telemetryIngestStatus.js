const status = {
  lastDeviceSeen: null,
  lastIngestionSuccess: null,
  lastIngestionError: null,
};

export function noteTelemetrySeen(deviceId) {
  if (deviceId == null) return;
  status.lastDeviceSeen = Number(deviceId);
}

export function noteTelemetrySuccess({ deviceId, eventId }) {
  noteTelemetrySeen(deviceId);
  status.lastIngestionSuccess = {
    deviceId: Number(deviceId),
    eventId: eventId ?? null,
    at: new Date().toISOString(),
  };
  status.lastIngestionError = null;
}

export function noteTelemetryFailure({ deviceId, eventId, message }) {
  noteTelemetrySeen(deviceId);
  status.lastIngestionError = {
    deviceId: deviceId == null ? null : Number(deviceId),
    eventId: eventId ?? null,
    at: new Date().toISOString(),
    message: String(message || "falha").slice(0, 200),
  };
}

export function readTelemetryIngestStatus() {
  return {
    lastDeviceSeen: status.lastDeviceSeen,
    lastIngestionSuccess: status.lastIngestionSuccess
      ? { ...status.lastIngestionSuccess }
      : null,
    lastIngestionError: status.lastIngestionError
      ? { ...status.lastIngestionError }
      : null,
  };
}
