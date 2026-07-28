import test from "node:test";
import assert from "node:assert/strict";
import { createUserSchema, updateUserSchema } from "../../src/schemas/userSchema.js";

test("createUserSchema aceita operator e admin", () => {
  const u = createUserSchema.parse({
    email: "op@empresa.com",
    nome: "Operador",
    password: "Senha1234",
    role: "operator",
  });
  assert.equal(u.role, "operator");
});

test("createUserSchema rejeita role inválida", () => {
  assert.throws(() =>
    createUserSchema.parse({
      email: "x@empresa.com",
      nome: "X",
      password: "Senha1234",
      role: "superadmin",
    }),
  );
});

test("updateUserSchema exige ao menos um campo", () => {
  assert.throws(() => updateUserSchema.parse({}));
  const ok = updateUserSchema.parse({ role: "admin", ativo: true });
  assert.equal(ok.role, "admin");
});
