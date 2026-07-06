import { test, expect } from "./helpers/auth.js";

test.describe("Upload de documentos (mock API)", () => {
  test("input de PDF dispara POST multipart ao selecionar arquivo", async ({
    page,
  }) => {
    let uploadCalled = false;

    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const url = req.url();

      if (url.includes("/documentos") && req.method() === "POST") {
        uploadCalled = true;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [{ id: 99, nome_original: "crlv.pdf" }],
          }),
        });
        return;
      }

      if (url.match(/\/caminhoes\/ABC1D23\/documentos$/) && req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: [] }),
        });
        return;
      }

      if (url.match(/\/caminhoes\/ABC1D23$/) && req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: 1,
              placa: "ABC1D23",
              motorista: "Teste",
              km_atual: 1000,
              qtd_pneus: 6,
              marca: "Volvo",
              modelo: "FH",
            },
          }),
        });
        return;
      }

      if (url.includes("/gastos/") || url.includes("/checklist/") || url.includes("/pneus/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: [] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto("/caminhao/ABC1D23");
    await page.getByRole("tab", { name: "Documentos" }).click();
    await expect(page.getByRole("button", { name: /adicionar pdfs/i })).toBeVisible({
      timeout: 15_000,
    });

    const fileInput = page.locator('input[type="file"][accept*="pdf"]');
    await fileInput.setInputFiles({
      name: "crlv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
    });

    await expect.poll(() => uploadCalled, { timeout: 10_000 }).toBe(true);
  });
});
