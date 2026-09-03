import test from "node:test";
import assert from "node:assert/strict";
import { LEGAL_VERSION, legalContactLabel } from "./legal.js";

test("LEGAL_VERSION segue AAAA-MM-DD", () => {
  assert.match(LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("legalContactLabel tem fallback sem e-mail", () => {
  assert.ok(legalContactLabel().length > 8);
});
