import prisma from "../lib/prisma.js";

const DOC_WARN_DAYS = 30;
const CNH_WARN_DAYS = 30;
const PNEU_WARN_PCT = 20;
/** Alerta quando faltam até este KM para a próxima manutenção. */
const MANUT_KM_WARN = 1000;
const MANUT_DATE_WARN_DAYS = 30;

function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return Math.round((d - n) / (24 * 60 * 60 * 1000));
}

export class AlertsService {
  /**
   * Alertas operacionais do tenant (docs, CNH, pneus, próxima manutenção).
   */
  static async listForTenant(tenantId, { now = new Date() } = {}) {
    const tid = Number(tenantId);
    const warnDoc = new Date(now);
    warnDoc.setDate(warnDoc.getDate() + DOC_WARN_DAYS);
    const warnCnh = new Date(now);
    warnCnh.setDate(warnCnh.getDate() + CNH_WARN_DAYS);

    const [docs, motoristas, pneus, manutencoes] = await Promise.all([
      prisma.caminhao_documentos.findMany({
        where: {
          tenant_id: tid,
          validade_em: { not: null, lte: warnDoc },
        },
        include: {
          caminhoes: { select: { id: true, placa: true } },
        },
        orderBy: { validade_em: "asc" },
        take: 100,
      }),
      prisma.motoristas.findMany({
        where: {
          tenant_id: tid,
          ativo: true,
          cnh_validade: { not: null, lte: warnCnh },
        },
        orderBy: { cnh_validade: "asc" },
        take: 50,
      }),
      prisma.pneus.findMany({
        where: {
          tenant_id: tid,
          caminhao_id: { not: null },
          vida_util_km: { not: null, gt: 0 },
          km_instalacao: { not: null },
        },
        include: {
          caminhoes: { select: { id: true, placa: true, km_atual: true } },
          posicoes_pneus: { select: { nome_posicao: true } },
        },
        take: 200,
      }),
      prisma.checklist.findMany({
        where: {
          tenant_id: tid,
          OR: [{ proxima_km: { not: null } }, { proxima_data: { not: null } }],
        },
        include: {
          caminhoes: { select: { id: true, placa: true, km_atual: true } },
          itens_checklist: { select: { nome_item: true } },
        },
        orderBy: { data_manutencao: "desc" },
        take: 300,
      }),
    ]);

    const alerts = [];

    for (const doc of docs) {
      const days = daysUntil(doc.validade_em, now);
      alerts.push({
        id: `doc-${doc.id}`,
        type: days != null && days < 0 ? "doc_expired" : "doc_expiring",
        severity: days != null && days < 0 ? "critical" : days <= 7 ? "high" : "medium",
        title:
          days != null && days < 0
            ? `Documento vencido: ${doc.nome_original}`
            : `Documento a vencer: ${doc.nome_original}`,
        message: `Placa ${doc.caminhoes?.placa || "—"}${
          doc.tipo_documento ? ` · ${doc.tipo_documento}` : ""
        } · ${
          days != null && days < 0
            ? `vencido há ${Math.abs(days)} dia(s)`
            : `vence em ${days} dia(s)`
        }`,
        entity: "documento",
        entityId: doc.id,
        placa: doc.caminhoes?.placa || null,
        daysRemaining: days,
        href: doc.caminhoes?.placa
          ? `/caminhao/${doc.caminhoes.placa}`
          : "/documentos",
      });
    }

    for (const m of motoristas) {
      const days = daysUntil(m.cnh_validade, now);
      alerts.push({
        id: `cnh-${m.id}`,
        type: days != null && days < 0 ? "cnh_expired" : "cnh_expiring",
        severity: days != null && days < 0 ? "critical" : days <= 7 ? "high" : "medium",
        title:
          days != null && days < 0
            ? `CNH vencida: ${m.nome}`
            : `CNH a vencer: ${m.nome}`,
        message:
          days != null && days < 0
            ? `Vencida há ${Math.abs(days)} dia(s)`
            : `Vence em ${days} dia(s)`,
        entity: "motorista",
        entityId: m.id,
        daysRemaining: days,
        href: "/motoristas",
      });
    }

    for (const p of pneus) {
      const kmAtual = Number(p.caminhoes?.km_atual || 0);
      const kmInst = Number(p.km_instalacao || 0);
      const vida = Number(p.vida_util_km || 0);
      if (!vida) continue;
      const rodado = Math.max(0, kmAtual - kmInst);
      const restante = vida - rodado;
      const pct = Math.max(0, Math.min(100, (restante / vida) * 100));
      if (pct > PNEU_WARN_PCT) continue;
      alerts.push({
        id: `pneu-${p.id}`,
        type: restante <= 0 ? "pneu_exhausted" : "pneu_low",
        severity: restante <= 0 ? "critical" : "high",
        title: `Pneu com vida útil baixa`,
        message: `Placa ${p.caminhoes?.placa || "—"} · ${
          p.posicoes_pneus?.nome_posicao || "posição"
        } · ${pct.toFixed(0)}% restante (${Math.max(0, restante)} km)`,
        entity: "pneu",
        entityId: p.id,
        placa: p.caminhoes?.placa || null,
        percentRemaining: pct,
        href: "/pneus",
      });
    }

    // Último lembrete por caminhão + item (evita alertas duplicados de trocas antigas).
    const latestManutByKey = new Map();
    for (const c of manutencoes) {
      const key = `${c.caminhao_id ?? "x"}:${c.item_id ?? c.id}`;
      if (!latestManutByKey.has(key)) latestManutByKey.set(key, c);
    }

    for (const c of latestManutByKey.values()) {
      const itemNome = c.itens_checklist?.nome_item || "Manutenção";
      const placa = c.caminhoes?.placa || "—";
      const kmAtual = Number(c.caminhoes?.km_atual || 0);

      if (c.proxima_km != null) {
        const alvo = Number(c.proxima_km);
        const restante = alvo - kmAtual;
        if (restante <= MANUT_KM_WARN) {
          const overdue = restante <= 0;
          alerts.push({
            id: `manut-km-${c.id}`,
            type: overdue ? "manut_km_due" : "manut_km_soon",
            severity: overdue ? "critical" : restante <= 200 ? "high" : "medium",
            title: overdue
              ? `Manutenção vencida (KM): ${itemNome}`
              : `Manutenção próxima (KM): ${itemNome}`,
            message: overdue
              ? `Placa ${placa} · passou ${Math.abs(restante).toLocaleString("pt-BR")} km do lembrete (${alvo.toLocaleString("pt-BR")} km)`
              : `Placa ${placa} · faltam ${restante.toLocaleString("pt-BR")} km para ${alvo.toLocaleString("pt-BR")} km`,
            entity: "checklist",
            entityId: c.id,
            placa: c.caminhoes?.placa || null,
            href: "/manutencao-gastos",
          });
        }
      }

      if (c.proxima_data) {
        const days = daysUntil(c.proxima_data, now);
        if (days != null && days <= MANUT_DATE_WARN_DAYS) {
          const overdue = days < 0;
          alerts.push({
            id: `manut-data-${c.id}`,
            type: overdue ? "manut_date_due" : "manut_date_soon",
            severity: overdue ? "critical" : days <= 7 ? "high" : "medium",
            title: overdue
              ? `Manutenção vencida (data): ${itemNome}`
              : `Manutenção próxima (data): ${itemNome}`,
            message: overdue
              ? `Placa ${placa} · vencida há ${Math.abs(days)} dia(s)`
              : `Placa ${placa} · em ${days} dia(s)`,
            entity: "checklist",
            entityId: c.id,
            placa: c.caminhoes?.placa || null,
            daysRemaining: days,
            href: "/manutencao-gastos",
          });
        }
      }
    }

    const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort(
      (a, b) =>
        (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9),
    );

    return {
      generatedAt: now.toISOString(),
      counts: {
        total: alerts.length,
        critical: alerts.filter((a) => a.severity === "critical").length,
        high: alerts.filter((a) => a.severity === "high").length,
        medium: alerts.filter((a) => a.severity === "medium").length,
      },
      alerts,
    };
  }

  static async documentsCockpit(tenantId, { now = new Date() } = {}) {
    const tid = Number(tenantId);
    const docs = await prisma.caminhao_documentos.findMany({
      where: { tenant_id: tid },
      include: {
        caminhoes: { select: { id: true, placa: true } },
      },
      orderBy: [{ validade_em: "asc" }, { criado_em: "desc" }],
      take: 500,
    });

    const items = docs.map((doc) => {
      const days = daysUntil(doc.validade_em, now);
      let status = "ok";
      if (doc.validade_em == null) status = "sem_validade";
      else if (days < 0) status = "vencido";
      else if (days <= 7) status = "critico";
      else if (days <= 30) status = "atencao";
      return {
        id: doc.id,
        nome_original: doc.nome_original,
        tipo_documento: doc.tipo_documento,
        validade_em: doc.validade_em,
        observacao: doc.observacao,
        criado_em: doc.criado_em,
        placa: doc.caminhoes?.placa || null,
        caminhao_id: doc.caminhao_id,
        daysRemaining: days,
        status,
      };
    });

    return {
      items,
      summary: {
        total: items.length,
        vencidos: items.filter((i) => i.status === "vencido").length,
        criticos: items.filter((i) => i.status === "critico").length,
        atencao: items.filter((i) => i.status === "atencao").length,
        semValidade: items.filter((i) => i.status === "sem_validade").length,
      },
    };
  }
}
