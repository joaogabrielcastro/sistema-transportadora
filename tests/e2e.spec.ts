import { test, expect } from "@playwright/test";

test.describe("Sistema Transportadora E2E Flow", () => {
  // Generate a random plate for this test run to avoid collisions
  const generatePlate = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const randomLetter = () =>
      letters[Math.floor(Math.random() * letters.length)];
    const randomNumber = () =>
      numbers[Math.floor(Math.random() * numbers.length)];

    // Format: ABC1D23
    return `TST${randomNumber()}${randomLetter()}${randomNumber()}${randomNumber()}`;
  };

  test("Full flow: Register Truck, Add Expense, Add Tire, Verify Details", async ({
    page,
  }, testInfo) => {
    // Generate truly unique data combining timestamp, worker index, and random
    const uniqueId = Date.now() + testInfo.workerIndex * 10000 + Math.floor(Math.random() * 1000);
    
    const truckData = {
      placa: generatePlate(),
      numero_cavalo: String(5000 + (uniqueId % 1000)),
      motorista: "Motorista Teste Playwright",
      qtd_pneus: "6",
      km_atual: "50000",
      carreta1: String((uniqueId % 90) + 10), // Ensures 10-99 range
      placa_carreta1: generatePlate(),
    };

    // Listen to console and network errors for debugging
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("Browser console error:", msg.text());
      }
    });

    page.on("requestfailed", (request) => {
      console.log("Request failed:", request.url(), request.failure()?.errorText);
    });

    // 1. Register Truck
    await test.step("Register a new truck", async () => {
      await page.goto("/cadastro-caminhao");

      await page.fill('input[name="placa"]', truckData.placa);
      await page.fill('input[name="numero_cavalo"]', truckData.numero_cavalo);
      await page.fill('input[name="motorista"]', truckData.motorista);
      await page.fill('input[name="qtd_pneus"]', truckData.qtd_pneus);
      await page.fill('input[name="km_atual"]', truckData.km_atual);

      // Optional: Add trailer info if inputs exist
      const carretaInput = page.locator('input[name="carreta_0"]');
      if (await carretaInput.isVisible()) {
        await carretaInput.fill(truckData.carreta1);
      }
      const placaCarretaInput = page.locator('input[name="placa_carreta_1"]');
      if (await placaCarretaInput.isVisible()) {
        await placaCarretaInput.fill(truckData.placa_carreta1);
      }

      await page.click('button[type="submit"]');

      // Expect success message or redirection
      await expect(
        page.getByText("Caminhão cadastrado com sucesso!")
      ).toBeVisible({ timeout: 10000 });

      // Wait for redirection to home
      await page.waitForURL("/", { timeout: 10000 });
    });

    // 2. Verify Truck on Dashboard
    await test.step("Verify truck appears on dashboard", async () => {
      await page.goto("/");
      // Search for the truck to ensure it's visible
      await page.fill('input[placeholder*="Buscar"]', truckData.placa);
      await page.click('button:has-text("Buscar")');

      await expect(page.getByText(truckData.placa)).toBeVisible();
      await expect(page.getByText(truckData.motorista)).toBeVisible();
    });

    // 3. View Truck Details
    await test.step("View truck details", async () => {
      // Click on "Ver detalhes" for the specific truck
      // We might need to be specific if multiple trucks are shown, but search should filter it.
      await page.click(`a[href="/caminhao/${truckData.placa}"]`);

      await expect(
        page.getByRole("heading", { name: `Caminhão ${truckData.placa}` })
      ).toBeVisible();
      await expect(page.getByText(truckData.motorista)).toBeVisible();
      // Use regex to match both formats (50.000 or 50,000)
      await expect(
        page.getByText(/50[.,]000 km/)
      ).toBeVisible();
    });

    // 4. Add Expense (Gasto)
    await test.step("Add an expense for the truck", async () => {
      await page.goto("/manutencao-gastos");

      // Select "Gasto" (default)
      await page.selectOption('select[name="tipo"]', "gasto");

      // Wait for the truck select to be populated (more than just "Selecione...")
      await page.waitForFunction(
        () => {
          const select = document.querySelector('select[name="caminhao_id"]') as HTMLSelectElement;
          return select && select.options.length > 1;
        },
        { timeout: 10000 }
      );

      // Select any available truck (doesn't need to be the newly registered one)
      await page.selectOption('select[name="caminhao_id"]', { index: 1 });

      // Select a type of expense (assuming "Combustível" or similar exists, or just pick the first one)
      // We'll pick the second option to avoid "Select..." if any
      const tipoSelect = page.locator('select[name="tipo_id"]');
      await tipoSelect.selectOption({ index: 1 });

      await page.fill('input[name="valor"]', "500.00");
      await page.fill(
        'input[name="data"]',
        new Date().toISOString().split("T")[0]
      );
      await page.fill(
        'textarea[name="observacao"]',
        "Teste automatizado de gasto"
      );

      await page.click('button:has-text("Cadastrar Registro")');

      await expect(
        page.getByText("Registro cadastrado com sucesso!")
      ).toBeVisible();

      // Verify in the list below (use .first() to handle multiple matches)
      await expect(page.getByText("Teste automatizado de gasto").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("R$ 500,00").first()).toBeVisible();
    });

    // 5. Add Tire (Pneu)
    await test.step("Add a tire for the truck", async () => {
      await page.goto("/pneus");

      // Wait for the truck select to be populated (more than just "Selecione...")
      await page.waitForFunction(
        () => {
          const select = document.querySelector('select[name="caminhao_id"]') as HTMLSelectElement;
          return select && select.options.length > 1;
        },
        { timeout: 10000 }
      );

      // Select any available truck (doesn't need to be the newly registered one)
      await page.selectOption('select[name="caminhao_id"]', { index: 1 });

      // Select Position (index 1)
      await page
        .locator('select[name="posicao_id"]')
        .selectOption({ index: 1 });

      // Select Status (index 1 - likely "Em uso" or similar)
      await page.locator('select[name="status_id"]').selectOption({ index: 1 });

      await page.fill('input[name="marca"]', "PneuTest");
      await page.fill('input[name="modelo"]', "X100");
      await page.fill('input[name="vida_util_km"]', "80000");
      await page.fill(
        'input[name="data_instalacao"]',
        new Date().toISOString().split("T")[0]
      );
      await page.fill('input[name="km_instalacao"]', truckData.km_atual);
      await page.fill(
        'textarea[name="observacao"]',
        "Pneu de teste automatizado"
      );

      await page.click('button:has-text("Cadastrar Pneu")');

      await expect(
        page.getByText("Pneu cadastrado com sucesso!")
      ).toBeVisible();

      // Verify in table
      await expect(page.getByText("PneuTest X100")).toBeVisible({ timeout: 10000 });
    });

    // 6. Delete Truck (Cleanup)
    await test.step("Delete the truck", async () => {
      // We only created the truck, not expense/tire for it (those were added to existing trucks)
      // So we can delete the truck directly if it has no dependencies
      
      await page.goto("/");
      await page.fill('input[placeholder*="Buscar"]', truckData.placa);
      await page.click('button:has-text("Buscar")');

      // Verify truck exists
      await expect(page.getByText(truckData.placa)).toBeVisible({ timeout: 5000 });

      // Click delete button (trash icon) - 2nd button in the group
      await page
        .locator(".group")
        .filter({ hasText: truckData.placa })
        .locator("button")
        .nth(1)
        .click();

      // Confirm deletion modal
      await expect(
        page.getByText(
          `Tem certeza que deseja excluir o caminhão ${truckData.placa}?`
        )
      ).toBeVisible();
      
      await page.click('button:has-text("Excluir")');

      // Verify success
      await expect(
        page.getByText(`Caminhão ${truckData.placa} excluído com sucesso!`)
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
