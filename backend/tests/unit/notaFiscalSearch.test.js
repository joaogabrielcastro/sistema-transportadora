import test from "node:test";
import assert from "node:assert/strict";
import { buildNotaListWhere } from "../../src/utils/notaFiscalSearch.js";

test("buildNotaListWhere sem termo filtra só o tenant", () => {
  assert.deepEqual(buildNotaListWhere(7, "  "), { tenant_id: 7 });
});

test("buildNotaListWhere procura número em todo o cadastro", () => {
  const where = buildNotaListWhere(3, "435");
  assert.equal(where.tenant_id, 3);
  assert.ok(
    where.OR.some(
      (clause) => clause.numero?.contains === "435",
    ),
  );
  assert.equal(
    where.OR.some((clause) => clause.chave_acesso),
    false,
  );
});

test("buildNotaListWhere aceita número/série", () => {
  const where = buildNotaListWhere(3, "435/1");
  assert.deepEqual(where.AND, [
    { numero: { contains: "435", mode: "insensitive" } },
    { serie: { contains: "1", mode: "insensitive" } },
  ]);
});

test("buildNotaListWhere só usa a chave quando o termo é longo", () => {
  const where = buildNotaListWhere(3, "35260100000000000000550010000004351000000000");
  assert.ok(where.OR.some((clause) => clause.chave_acesso?.contains));
});
