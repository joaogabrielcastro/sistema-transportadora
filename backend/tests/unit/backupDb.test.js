import test from "node:test";
import assert from "node:assert/strict";
import {
  backupFileName,
  backupsOlderThan,
  listBackupNames,
  msUntilNextHourUtc,
  backupNameTimestamp,
} from "../../src/utils/backupDb.js";

test("backupFileName usa timestamp ISO gzip", () => {
  const name = backupFileName(new Date("2026-09-02T06:00:00.000Z"));
  assert.equal(name, "atrack-2026-09-02T06-00-00.sql.gz");
});

test("listBackupNames ignora arquivos soltos", () => {
  assert.deepEqual(
    listBackupNames(["readme.txt", "atrack-2026-09-01T06-00-00.sql.gz"]),
    ["atrack-2026-09-01T06-00-00.sql.gz"],
  );
});

test("backupsOlderThan respeita retenção em dias", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");
  const stale = backupsOlderThan(
    [
      "atrack-2026-09-01T06-00-00.sql.gz",
      "atrack-2026-09-08T06-00-00.sql.gz",
      "notes.txt",
    ],
    7,
    now,
  );
  assert.deepEqual(stale, ["atrack-2026-09-01T06-00-00.sql.gz"]);
});

test("msUntilNextHourUtc aponta para o próximo horário UTC", () => {
  const now = new Date("2026-09-02T05:00:00.000Z");
  assert.equal(msUntilNextHourUtc(6, now), 60 * 60 * 1000);
  const after = new Date("2026-09-02T06:00:01.000Z");
  assert.ok(msUntilNextHourUtc(6, after) > 23 * 60 * 60 * 1000);
});

test("backupNameTimestamp lê o nome do arquivo", () => {
  assert.equal(
    backupNameTimestamp("atrack-2026-09-02T06-00-00.sql.gz"),
    Date.parse("2026-09-02T06:00:00Z"),
  );
});
