import prisma from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

export class AuditService {
  static async record({
    tenantId,
    userId,
    userEmail,
    action,
    method,
    path,
    entity,
    entityId,
    ip,
    requestId,
    summary,
  }) {
    try {
      await prisma.audit_logs.create({
        data: {
          tenant_id: tenantId != null ? Number(tenantId) : null,
          user_id:
            userId != null && Number.isFinite(Number(userId))
              ? Number(userId)
              : null,
          user_email: userEmail ? String(userEmail).slice(0, 255) : null,
          action: String(action || method || "MUTATE").slice(0, 32),
          method: String(method || "POST").slice(0, 16),
          path: String(path || "").slice(0, 500),
          entity: entity ? String(entity).slice(0, 64) : null,
          entity_id: entityId != null ? String(entityId).slice(0, 64) : null,
          ip: ip ? String(ip).slice(0, 64) : null,
          request_id: requestId ? String(requestId).slice(0, 64) : null,
          summary: summary ?? undefined,
        },
      });
    } catch (err) {
      logger.warn("Falha ao gravar audit_log", { err: err?.message });
    }
  }

  static async list(
    tenantId,
    { limit = 50, offset = 0, userEmail, action, q } = {},
  ) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = Math.max(Number(offset) || 0, 0);
    const where = { tenant_id: Number(tenantId) };
    if (userEmail && String(userEmail).trim()) {
      where.user_email = {
        contains: String(userEmail).trim(),
        mode: "insensitive",
      };
    }
    if (action && String(action).trim()) {
      where.action = String(action).trim().toUpperCase();
    }
    if (q && String(q).trim()) {
      where.path = { contains: String(q).trim(), mode: "insensitive" };
    }
    const [rows, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        orderBy: { criado_em: "desc" },
        take,
        skip,
      }),
      prisma.audit_logs.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        ...r,
        id: String(r.id),
      })),
      total,
      limit: take,
      offset: skip,
    };
  }
}
