const withTenant = (tenantId, where = {}) => ({
  ...where,
  tenant_id: Number(tenantId),
});

/**
 * Filtro da listagem de NF-e. Sem termo, devolve só o tenant.
 * Com termo, procura em todo o cadastro (número, série, emitente, CNPJ, chave).
 */
export function buildNotaListWhere(tenantId, termo) {
  const where = withTenant(tenantId);
  const q = String(termo || "").trim();
  if (!q) return where;

  const slash = q.match(/^([^/]+)\/(.+)$/);
  if (slash) {
    where.AND = [
      { numero: { contains: slash[1].trim(), mode: "insensitive" } },
      { serie: { contains: slash[2].trim(), mode: "insensitive" } },
    ];
    return where;
  }

  const or = [
    { numero: { contains: q, mode: "insensitive" } },
    { serie: { contains: q, mode: "insensitive" } },
    { emitente: { contains: q, mode: "insensitive" } },
    { observacao: { contains: q, mode: "insensitive" } },
    { origem: { contains: q, mode: "insensitive" } },
  ];

  const digits = q.replace(/\D/g, "");
  if (digits && digits !== q) {
    or.push({ numero: { contains: digits } });
  }
  if (digits.length >= 8) {
    or.push({ cnpj_emitente: { contains: digits } });
  }
  if (digits.length >= 20) {
    or.push({ chave_acesso: { contains: digits } });
  }

  where.OR = or;
  return where;
}

export function labelNota(nota) {
  if (!nota) return "";
  return `${nota.numero}${nota.serie ? `/${nota.serie}` : ""}`;
}
