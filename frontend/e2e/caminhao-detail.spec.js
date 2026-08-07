import { test, expect } from "./helpers/auth.js";

const PLACA = "ABC1D23";
const CAMINHAO = {
  id: 1,
  placa: PLACA,
  motorista: "João Silva",
  modelo: "FH 540",
  marca: "Volvo",
  km_atual: 50000,
  qtd_pneus: 6,
  status: "Operacional",
  tipo_veiculo: "truck",
};

const posicoes = [
  { id: 1, nome_posicao: "Dianteiro Esquerdo" },
  { id: 2, nome_posicao: "Dianteiro Direito" },
  { id: 3, nome_posicao: "Eixo 2 - Externo Esquerdo" },
  { id: 4, nome_posicao: "Eixo 2 - Interno Esquerdo" },
  { id: 5, nome_posicao: "Eixo 2 - Externo Direito" },
  { id: 6, nome_posicao: "Eixo 2 - Interno Direito" },
];

test.describe("Detalhe do caminhão", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/gastos/caminhao/1**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              data_gasto: "2026-07-01",
              valor: 500,
              descricao: "Abastecimento",
              tipos_gastos: { nome_tipo: "Combustível" },
            },
          ],
        }),
      });
    });

    await page.route("**/api/checklist/caminhao/1**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 2,
              data_manutencao: "2026-07-02",
              valor: 800,
              observacao: "Troca de óleo",
              itens_checklist: { nome_item: "Óleo do motor" },
            },
          ],
        }),
      });
    });

    await page.route("**/api/pneus/caminhao/1**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 10,
              marca: "Bridgestone",
              modelo: "R269",
              posicoes_pneus: { nome_posicao: "Dianteiro Esquerdo" },
            },
          ],
        }),
      });
    });

    await page.route("**/api/gastos/consumo/1**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route("**/api/posicoes-pneus**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: posicoes }),
      });
    });

    await page.route("**/api/status-pneus**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, nome_status: "Em uso" }],
        }),
      });
    });

    await page.route("**/api/pneus/in-stock**", async (route) => {
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
            itemsPerPage: 200,
          },
        }),
      });
    });

    await page.route("**/api/caminhoes**", async (route) => {
      const url = route.request().url();
      if (url.includes(`/caminhoes/${PLACA}`)) {
        return route.fallback();
      }
      if (route.request().method() !== "GET") {
        return route.continue();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [CAMINHAO],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 1,
            itemsPerPage: 200,
          },
        }),
      });
    });

    await page.route(`**/api/caminhoes/${PLACA}**`, async (route) => {
      if (route.request().method() !== "GET") {
        return route.continue();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: CAMINHAO }),
      });
    });
  });

  test("carrega resumo com placa e KM atual", async ({ page }) => {
    await page.goto(`/caminhao/${PLACA}`);

    await expect(
      page.getByRole("heading", { name: `Veículo ${PLACA}` }),
    ).toBeVisible();
    await expect(page.getByText("KM Atual")).toBeVisible();
    await expect(page.getByText(/50[.,]000\s*km/)).toBeVisible();
    await expect(page.getByText("João Silva")).toBeVisible();
  });

  test("aba Registros exibe gastos e manutenções", async ({ page }) => {
    await page.goto(`/caminhao/${PLACA}`);

    await page.getByRole("tab", { name: "Registros" }).click();

    await expect(page.getByText("Últimos Gastos")).toBeVisible();
    await expect(page.getByText("Combustível")).toBeVisible();
    await expect(page.getByText("Óleo do motor")).toBeVisible();
    await expect(page.getByText("Bridgestone")).toBeVisible();
  });

  test("modal Novo Pneu cadastra pneu no veículo", async ({ page }) => {
    await page.route("**/api/pneus", async (route) => {
      if (route.request().method() !== "POST") {
        return route.continue();
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { id: 99 } }),
      });
    });

    await page.goto(`/caminhao/${PLACA}`);
    await page.getByRole("tab", { name: "Registros" }).click();
    await page.getByRole("button", { name: "+ Novo pneu" }).click();

    await expect(page.getByRole("heading", { name: "Novo Pneu" })).toBeVisible();
    await page.getByLabel("Marca").fill("Michelin");
    await page.getByLabel("Modelo").fill("XZY-123");
    await page.getByTitle("Dianteiro Esquerdo").click();

    const createRequest = page.waitForRequest(
      (req) => req.url().includes("/api/pneus") && req.method() === "POST",
    );

    await page.getByRole("button", { name: "Cadastrar pneu" }).click();

    const req = await createRequest;
    const body = req.postDataJSON();
    expect(body.marca).toBe("Michelin");
    expect(body.modelo).toBe("XZY-123");
    expect(body.posicao_id).toBe(1);
    expect(body.caminhao_id).toBe(1);
  });
});
