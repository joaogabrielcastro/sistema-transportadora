import test from "node:test";
import assert from "node:assert/strict";
import {
  isMailConfigured,
  resolvedMailFrom,
} from "../../src/utils/mailer.js";

test("isMailConfigured exige host, porta e remetente", () => {
  assert.equal(
    isMailConfigured({ smtpHost: "", smtpPort: 0, mailFrom: "" }),
    false,
  );
  assert.equal(
    isMailConfigured({
      smtpHost: "smtp.resend.com",
      smtpPort: 587,
      mailFrom: "ATrack <a@b.c>",
    }),
    true,
  );
});

test("resolvedMailFrom cai para SMTP_USER quando MAIL_FROM vazio", () => {
  assert.equal(
    resolvedMailFrom({ mailFrom: "", smtpUser: "noreply@empresa.com" }),
    "noreply@empresa.com",
  );
  assert.equal(
    isMailConfigured({
      smtpHost: "smtp.office365.com",
      smtpPort: 587,
      mailFrom: "",
      smtpUser: "noreply@empresa.com",
    }),
    true,
  );
});
