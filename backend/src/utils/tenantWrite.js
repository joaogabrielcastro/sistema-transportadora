/**
 * Writes scoped to tenant_id. Prisma update/delete by PK alone cannot
 * include tenant_id unless it is part of a unique constraint.
 */

export function notFoundError(message = "Registro não encontrado") {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

export async function updateOneInTenant(
  delegate,
  tenantId,
  id,
  data,
  notFoundMessage,
) {
  const result = await delegate.updateMany({
    where: { id: Number(id), tenant_id: Number(tenantId) },
    data,
  });
  if (result.count === 0) {
    notFoundError(notFoundMessage);
  }
  return result;
}

export async function deleteOneInTenant(
  delegate,
  tenantId,
  id,
  notFoundMessage,
) {
  const result = await delegate.deleteMany({
    where: { id: Number(id), tenant_id: Number(tenantId) },
  });
  if (result.count === 0) {
    notFoundError(notFoundMessage);
  }
  return result;
}
