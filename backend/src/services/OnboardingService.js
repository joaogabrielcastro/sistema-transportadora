import prisma from "../lib/prisma.js";
import { TenantService } from "./TenantService.js";

export class OnboardingService {
  static async getStatus(tenantId) {
    const tid = Number(tenantId);
    const tenant = await prisma.tenants.findUnique({
      where: { id: tid },
      select: {
        onboarding_completed_at: true,
        nome: true,
      },
    });

    const [caminhoes, motoristas, pneus, gastos, docs] = await Promise.all([
      prisma.caminhoes.count({ where: { tenant_id: tid } }),
      prisma.motoristas.count({ where: { tenant_id: tid } }),
      prisma.pneus.count({ where: { tenant_id: tid } }),
      prisma.gastos.count({ where: { tenant_id: tid } }),
      prisma.caminhao_documentos.count({ where: { tenant_id: tid } }),
    ]);

    const steps = [
      {
        id: "frota",
        title: "Cadastre o primeiro veículo",
        done: caminhoes > 0,
        href: "/cadastro-caminhao",
      },
      {
        id: "motorista",
        title: "Cadastre um motorista",
        done: motoristas > 0,
        href: "/motoristas",
      },
      {
        id: "pneu",
        title: "Registre pneus (estoque ou instalação)",
        done: pneus > 0,
        href: "/pneus/estoque",
      },
      {
        id: "gasto",
        title: "Lance o primeiro gasto ou manutenção",
        done: gastos > 0,
        href: "/manutencao-gastos",
      },
      {
        id: "doc",
        title: "Anexe um documento com validade",
        done: docs > 0,
        href: caminhoes > 0 ? "/" : "/cadastro-caminhao",
      },
    ];

    const completed = steps.filter((s) => s.done).length;
    return {
      completedAt: tenant?.onboarding_completed_at || null,
      dismissed: Boolean(tenant?.onboarding_completed_at),
      progress: { completed, total: steps.length },
      steps,
    };
  }

  static async complete(tenantId) {
    await prisma.tenants.update({
      where: { id: Number(tenantId) },
      data: { onboarding_completed_at: new Date() },
    });
    return this.getStatus(tenantId);
  }

  static async updateSettings(tenantId, body = {}) {
    return TenantService.updateSettings(tenantId, body);
  }
}
