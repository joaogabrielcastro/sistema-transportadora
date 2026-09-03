import test from "node:test";
import assert from "node:assert/strict";
import { LEGAL_VERSION } from "../../src/utils/legal.js";

test("LEGAL_VERSION segue AAAA-MM-DD", () => {
  assert.match(LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});
