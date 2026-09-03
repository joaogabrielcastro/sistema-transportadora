import test from "node:test";
import assert from "node:assert/strict";
import { slugifyTenantName } from "../../src/services/AuthService.js";
import { registerSchema } from "../../src/schemas/authSchema.js";

test("slugifyTenantName normaliza acentos e espaços", () => {
  assert.equal(slugifyTenantName("Transportes São Paulo Ltda"), "transportes-sao-paulo-ltda");
  assert.equal(slugifyTenantName("  ABC  "), "abc");
  assert.equal(slugifyTenantName("@@@"), "empresa");
});

test("registerSchema exige senha mínima e e-mail", () => {
  assert.throws(() =>
    registerSchema.parse({
      empresaNome: "Empresa X",
      email: "x",
      password: "123",
    }),
  );

  const ok = registerSchema.parse({
    empresaNome: "Empresa X",
    email: "admin@empresa.com",
    password: "SenhaSegura1",
    nome: "João",
    acceptedLegal: true,
  });
  assert.equal(ok.empresaNome, "Empresa X");
});

test("registerSchema exige aceite dos termos", () => {
  assert.throws(() =>
    registerSchema.parse({
      empresaNome: "Empresa X",
      email: "admin@empresa.com",
      password: "SenhaSegura1",
    }),
  );
  assert.throws(() =>
    registerSchema.parse({
      empresaNome: "Empresa X",
      email: "admin@empresa.com",
      password: "SenhaSegura1",
      acceptedLegal: false,
    }),
  );
});
