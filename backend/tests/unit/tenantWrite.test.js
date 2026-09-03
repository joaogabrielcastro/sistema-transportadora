import test from "node:test";
import assert from "node:assert/strict";
import {
  notFoundError,
  updateOneInTenant,
  deleteOneInTenant,
} from "../../src/utils/tenantWrite.js";

test("notFoundError usa 404", () => {
  assert.throws(
    () => notFoundError("Gasto não encontrado"),
    (err) => err.statusCode === 404 && err.message === "Gasto não encontrado",
  );
});

test("updateOneInTenant exige tenant_id no where", async () => {
  let captured;
  const delegate = {
    updateMany: async (args) => {
      captured = args;
      return { count: 1 };
    },
  };
  await updateOneInTenant(delegate, 9, 42, { valor: 10 }, "não achou");
  assert.deepEqual(captured.where, { id: 42, tenant_id: 9 });
  assert.deepEqual(captured.data, { valor: 10 });
});

test("updateOneInTenant lança 404 se count=0", async () => {
  const delegate = { updateMany: async () => ({ count: 0 }) };
  await assert.rejects(
    () => updateOneInTenant(delegate, 1, 2, {}, "Gasto não encontrado"),
    (err) => err.statusCode === 404,
  );
});

test("deleteOneInTenant exige tenant_id no where", async () => {
  let captured;
  const delegate = {
    deleteMany: async (args) => {
      captured = args;
      return { count: 1 };
    },
  };
  await deleteOneInTenant(delegate, 3, 7, "não achou");
  assert.deepEqual(captured.where, { id: 7, tenant_id: 3 });
});
