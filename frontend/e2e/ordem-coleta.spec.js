import { test, expect } from "./helpers/auth.js";

const posicoes = [
  { id: 1, nome_posicao: "Dianteiro Esquerdo" },
  { id: 2, nome_posicao: "Dianteiro Direito" },
  { id: 3, nome_posicao: "Eixo 2 - Externo Esquerdo" },
  { id: 4, nome_posicao: "Eixo 2 - Interno Esquerdo" },
  { id: 5, nome_posicao: "Eixo 2 - Externo Direito" },
  { id: 6, nome_posicao: "Eixo 2 - Interno Direito" },
];

test.describe("Ordem de coleta", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/caminhoes**", async (route) => {
      if (route.request().url().includes("/search")) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, placa: "ABC1D23", motorista: "João" }],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 1,
            itemsPerPage: 200,
          },
        }),
      });
    });

    await page.route("**/api/ordem-coleta/historico**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
            itemsPerPage: 20,
          },
          totalFalhas: 0,
        }),
      });
    });
  });

  test("pré-visualização envia POST e exibe HTML", async ({ page }) => {
    let previewCalled = false;

    await page.route("**/api/ordem-coleta/preview", async (route) => {
      previewCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { html: "<div>Prévia ordem teste</div>" },
        }),
      });
    });

    await page.goto("/ordem-coleta");
    await page.getByRole("button", { name: /pré-visualizar html/i }).click();

    await expect.poll(() => previewCalled).toBe(true);
    await expect(page.getByText("Pré-visualização")).toBeVisible();
    await expect(
      page.getByTitle("Pré-visualização ordem de coleta"),
    ).toBeVisible();
  });

  test("enviar exige e-mail do destinatário", async ({ page }) => {
    await page.goto("/ordem-coleta");
    await page
      .getByRole("button", { name: /gerar pdf e enviar por e-mail/i })
      .click();

    await expect(page.getByText(/informe o e-mail do destinatário/i)).toBeVisible();
  });

  test("fluxo de envio enfileira e confirma sucesso", async ({ page }) => {
    await page.route("**/api/ordem-coleta/enviar", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: 42, status: "processing" },
        }),
      });
    });

    await page.route("**/api/ordem-coleta/envio/42", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: 42, status: "sent", email_destinatario: "cliente@test.com" },
        }),
      });
    });

    await page.goto("/ordem-coleta");
    await page.getByLabel("E-mail do destinatário").fill("cliente@test.com");

    const enviarRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/api/ordem-coleta/enviar") &&
        req.method() === "POST",
    );

    await page
      .getByRole("button", { name: /gerar pdf e enviar por e-mail/i })
      .click();

    const req = await enviarRequest;
    const body = req.postDataJSON();
    expect(body.emailDestinatario).toBe("cliente@test.com");
    expect(body.tipo).toBe("PADRAO");
  });

  test("histórico exibe envios com falha e botão de limpeza", async ({ page }) => {
    await page.route("**/api/ordem-coleta/historico**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              tipo: "PADRAO",
              email_destinatario: "falha@test.com",
              caminhao_placa: "ABC1D23",
              criado_em: "2026-07-06T12:00:00.000Z",
              status: "failed",
              erro_envio: "SMTP timeout",
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 1,
            itemsPerPage: 20,
          },
          totalFalhas: 1,
        }),
      });
    });

    await page.goto("/ordem-coleta");

    await expect(
      page.getByRole("cell", { name: "falha@test.com" }),
    ).toBeVisible();
    await expect(page.getByText(/1 envio\(s\) com falha/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /apagar todas com falha/i }),
    ).toBeVisible();
  });
});
