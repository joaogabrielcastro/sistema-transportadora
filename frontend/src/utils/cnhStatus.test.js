import { test } from "node:test";
import assert from "node:assert/strict";
import { cnhStatus } from "./cnhStatus.js";

const now = new Date(2026, 10, 17, 15, 0, 0);

test("cnhStatus classifica vencida, a vencer, válida e sem validade", () => {
  assert.equal(cnhStatus("2026-11-05", now).key, "vencida");
  assert.equal(cnhStatus("2026-11-05", now).days, -12);
  assert.equal(cnhStatus("2026-11-17", now).label, "Vence hoje");
  assert.equal(cnhStatus("2026-12-17T00:00:00.000Z", now).key, "a_vencer");
  assert.equal(cnhStatus("2026-12-18", now).key, "valida");
  assert.equal(cnhStatus(null, now).key, "sem_validade");
  assert.equal(cnhStatus("lixo", now).key, "sem_validade");
});
