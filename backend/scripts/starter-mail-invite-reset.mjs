/**
 * Valida convite (com 1 vaga) + recebimento no Mailpit + aceite + reset de senha.
 * Requer API com SMTP → Mailpit (1025) e UI Mailpit em :8025.
 *
 *   node scripts/starter-mail-invite-reset.mjs
 */
import prisma from "../src/lib/prisma.js";
import { cleanupTenant } from "../tests/helpers/dbTestFixtures.js";

const API = process.env.SMOKE_API_URL || "http://127.0.0.1:3020/api";
const MAILPIT = process.env.MAILPIT_URL || "http://127.0.0.1:8025";
const stamp = Date.now().toString(36);
const results = [];

function log(step, ok, detail = "") {
  console.log(`${ok ? "OK  " : "FAIL"} | ${step}${detail ? ` — ${detail}` : ""}`);
  results.push({ step, ok, detail });
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function waitForMail({ toContains, subjectContains, timeoutMs = 20000 }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${MAILPIT}/api/v1/messages`);
    const data = await res.json();
    const messages = data.messages || data || [];
    const hit = (Array.isArray(messages) ? messages : []).find((m) => {
      const to = JSON.stringify(m.To || m.to || []);
      const subject = m.Subject || m.subject || "";
      return (
        (!toContains || to.toLowerCase().includes(toContains.toLowerCase())) &&
        (!subjectContains ||
          subject.toLowerCase().includes(subjectContains.toLowerCase()))
      );
    });
    if (hit) {
      const id = hit.ID || hit.id;
      const full = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) =>
        r.json(),
      );
      return full;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function extractLink(htmlOrText, pathHint) {
  const text = String(htmlOrText || "");
  const re = new RegExp(
    `https?://[^\\s"'<>]+${pathHint.replace("/", "\\/")}[^\\s"'<>]*`,
    "i",
  );
  const m = text.match(re);
  return m?.[0] || null;
}

async function main() {
  let tenantId;
  try {
    const adminEmail = `mail-admin-${stamp}@example.test`;
    const adminPass = `MailAdmin-${stamp}!`;
    const reg = await api("/auth/register", {
      method: "POST",
      body: {
        empresaNome: `Mail Smoke ${stamp}`,
        nome: "Admin Mail",
        email: adminEmail,
        password: adminPass,
        acceptedLegal: true,
        lid: "starter",
      },
    });
    log("Cadastro admin (1/2 assentos)", reg.status === 201, reg.json?.error);
    const token = reg.json?.data?.token;
    tenantId = reg.json?.data?.user?.tenantId;

    const inviteEmail = `convidado-${stamp}@example.test`;
    const invite = await api("/users/invite", {
      method: "POST",
      token,
      body: {
        email: inviteEmail,
        nome: "Convidado Operador",
        role: "operator",
      },
    });
    log(
      "Convite com vaga disponível",
      invite.status === 201,
      invite.json?.error || invite.json?.message,
    );

    const inviteMail = await waitForMail({
      toContains: inviteEmail,
      subjectContains: "convite",
    });
    log("E-mail de convite no Mailpit", Boolean(inviteMail), inviteMail?.Subject);
    const inviteBody = `${inviteMail?.HTML || ""}\n${inviteMail?.Text || ""}`;
    const inviteLink = extractLink(inviteBody, "/convite");
    log("Link /convite presente no e-mail", Boolean(inviteLink), inviteLink);

    let inviteToken = null;
    if (inviteLink) {
      try {
        inviteToken = new URL(inviteLink).searchParams.get("token");
      } catch {
        inviteToken = null;
      }
    }
    // Fallback: token no banco se o HTML não parsear
    if (!inviteToken) {
      const row = await prisma.auth_tokens.findFirst({
        where: { email: inviteEmail, purpose: "invite", used_at: null },
        orderBy: { id: "desc" },
      });
      // Não temos o raw no DB (só hash) — precisa do e-mail.
      log(
        "Token de convite extraído do link",
        false,
        row ? "hash no DB sem raw — parse do e-mail falhou" : "sem token",
      );
    } else {
      const acceptPass = `InvitePass-${stamp}!`;
      const accept = await api("/auth/accept-invite", {
        method: "POST",
        body: {
          token: inviteToken,
          password: acceptPass,
          nome: "Convidado Operador",
          acceptedLegal: true,
        },
      });
      log("Aceite do convite", accept.status === 200 || accept.status === 201, accept.json?.error);
      const loginInvite = await api("/auth/login", {
        method: "POST",
        body: { email: inviteEmail, password: acceptPass },
      });
      log("Login do convidado", loginInvite.status === 200, loginInvite.json?.error);
    }

    // Reset de senha do admin
    const forgot = await api("/auth/forgot-password", {
      method: "POST",
      body: { email: adminEmail },
    });
    log("Pedido de recuperação de senha", forgot.status === 200, forgot.json?.message);

    const resetMail = await waitForMail({
      toContains: adminEmail,
      subjectContains: "senha",
    });
    log("E-mail de reset no Mailpit", Boolean(resetMail), resetMail?.Subject);
    const resetBody = `${resetMail?.HTML || ""}\n${resetMail?.Text || ""}`;
    const resetLink = extractLink(resetBody, "/reset-senha");
    log("Link /reset-senha presente", Boolean(resetLink), resetLink);

    let resetToken = null;
    if (resetLink) {
      try {
        resetToken = new URL(resetLink).searchParams.get("token");
      } catch {
        resetToken = null;
      }
    }
    if (resetToken) {
      const oldLoginToken = token;
      const newPass = `ResetPass-${stamp}!`;
      const reset = await api("/auth/reset-password", {
        method: "POST",
        body: { token: resetToken, password: newPass },
      });
      log("Reset de senha aplicado", reset.status === 200, reset.json?.error);

      const meOld = await api("/auth/me", { token: oldLoginToken });
      log(
        "JWT anterior invalidado após reset",
        meOld.status === 401,
        `status=${meOld.status}`,
      );

      const loginNew = await api("/auth/login", {
        method: "POST",
        body: { email: adminEmail, password: newPass },
      });
      log("Login com senha nova", loginNew.status === 200, loginNew.json?.error);
    } else {
      log("Reset de senha (token)", false, "link não encontrado no e-mail");
    }
  } catch (err) {
    log("Script interrompido", false, err.message);
    console.error(err);
  } finally {
    if (tenantId) {
      await cleanupTenant(tenantId).catch((e) => console.warn("cleanup:", e.message));
    }
    await prisma.$disconnect().catch(() => {});
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- resumo mail --- passou ${results.length - failed.length}/${results.length}`);
  if (failed.length) process.exitCode = 1;
}

main();
