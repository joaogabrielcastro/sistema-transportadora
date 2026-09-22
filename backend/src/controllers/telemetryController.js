import { telemetryIngestSchema } from "../schemas/telemetrySchema.js";
import { acceptTelemetryIngest } from "../services/telemetry/telemetryIngest.js";
import { catchAsync } from "../utils/catchAsync.js";

export const telemetryController = {
  ingest: catchAsync(async (req, res) => {
    const event = telemetryIngestSchema.parse(req.body);
    const result = await acceptTelemetryIngest({
      authorization: req.get("authorization"),
      event,
    });

    res.status(result.duplicate ? 200 : 202).json({
      success: true,
      data: {
        status: result.duplicate ? "duplicate" : "queued",
        duplicate: result.duplicate,
        event_id: result.eventId,
      },
    });
  }),
};
