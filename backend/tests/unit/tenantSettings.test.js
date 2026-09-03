import test from "node:test";
import assert from "node:assert/strict";
import {
  closeAccountSchema,
  confirmNameMatches,
  updateTenantSettingsSchema,
} from "../../src/schemas/tenantSchema.js";
import { TenantService } from "../../src/services/TenantService.js";

test("confirmNameMatches ignora maiúsculas e espaços", () => {
  assert.equal(confirmNameMatches("Trans Motin", "trans motin"), true);
  assert.equal(confirmNameMatches("Trans Motin", "outra"), false);
});

test("updateTenantSettingsSchema exige ao menos um campo", () => {
  assert.throws(() => updateTenantSettingsSchema.parse({}), /ao menos um campo/);
  const ok = updateTenantSettingsSchema.parse({
    nome: "Nova Transportes",
    weeklyDigestEnabled: false,
  });
  assert.equal(ok.nome, "Nova Transportes");
});

test("closeAccountSchema exige nome de confirmação", () => {
  assert.throws(() => closeAccountSchema.parse({}), /Required|confirmName/i);
  assert.equal(
    closeAccountSchema.parse({ confirmName: "Empresa X" }).confirmName,
    "Empresa X",
  );
});

test("assertCanClose bloqueia isento, inativo e nome errado", () => {
  assert.throws(
    () =>
      TenantService.assertCanClose(
        { nome: "A", ativo: true, billing_exempt: true },
        "A",
      ),
    /isentas/,
  );
  assert.throws(
    () =>
      TenantService.assertCanClose(
        { nome: "A", ativo: false, billing_exempt: false },
        "A",
      ),
    /já está encerrada/,
  );
  assert.throws(
    () =>
      TenantService.assertCanClose(
        { nome: "Frota Sul", ativo: true, billing_exempt: false },
        "outro",
      ),
    /exatamente/,
  );
  assert.doesNotThrow(() =>
    TenantService.assertCanClose(
      { nome: "Frota Sul", ativo: true, billing_exempt: false },
      "frota sul",
    ),
  );
});
