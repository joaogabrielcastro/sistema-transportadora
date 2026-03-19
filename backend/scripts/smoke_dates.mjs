import { toPrismaDateTime } from "../src/utils/dates.js";

const cases = ["2026-03-19", "19/03/2026", "2026-03-19T00:00:00.000Z"];

for (const v of cases) {
  const d = toPrismaDateTime(v);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    console.error("FAIL", v, d);
    process.exitCode = 1;
  } else {
    console.log("OK", v, d.toISOString());
  }
}

