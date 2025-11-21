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

  const truckData = {
    placa: generatePlate(),
    numero_cavalo: "1234",
    motorista: "Motorista Teste Playwright",
    qtd_pneus: "6",
    km_atual: "50000",
    carreta1: "10",
    placa_carreta1: "CAR1T23",
  };

  test("Full flow: Register Truck, Add Expense, Add Tire, Verify Details", async ({
    page,
  }) => {
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
      await expect(
        page.getByText(`${parseInt(truckData.km_atual).toLocaleString()} km`)
      ).toBeVisible();
    });

    // 4. Add Expense (Gasto)
    await test.step("Add an expense for the truck", async () => {
      await page.goto("/manutencao-gastos");

      // Select "Gasto" (default)
      await page.selectOption('select[name="tipo"]', "gasto");

      // Select the truck (we need to find the option value or label)
      // Since the select options are loaded dynamically, we might need to wait.
      // We can select by label which contains the plate.
      await page.locator('select[name="caminhao_id"]').click();
      // Playwright selectOption can select by label
      await page.selectOption('select[name="caminhao_id"]', {
        label: `${truckData.placa} - KM: ${parseInt(
          truckData.km_atual
        ).toLocaleString("pt-BR")}`,
      });

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

      // Verify in the list below
      await page.fill(
        'input[placeholder*="Filtrar por placa"]',
        truckData.placa
      );
      await expect(page.getByText("Teste automatizado de gasto")).toBeVisible();
      await expect(page.getByText("R$ 500,00")).toBeVisible();
    });

    // 5. Add Tire (Pneu)
    await test.step("Add a tire for the truck", async () => {
      await page.goto("/pneus");

      await page.selectOption('select[name="caminhao_id"]', {
        label: `${truckData.placa} - KM: ${parseInt(
          truckData.km_atual
        ).toLocaleString("pt-BR")}`,
      });

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
      await page.fill(
        'input[placeholder*="Filtrar por placa"]',
        truckData.placa
      );
      await expect(page.getByText("PneuTest X100")).toBeVisible();
    });

    // 6. Delete Truck (Cleanup)
    await test.step("Delete the truck", async () => {
      // First we need to delete dependencies (Expense and Tire) or use the cascade delete if implemented.
      // The Home.jsx has `removeWithCascade` and a modal that warns about dependencies.
      // If `removeWithCascade` handles it, we can just delete.
      // Let's try to delete from Home.

      await page.goto("/");
      await page.fill('input[placeholder*="Buscar"]', truckData.placa);
      await page.click('button:has-text("Buscar")');

      // Click delete button (trash icon)
      // The delete button is in the card.
      await page
        .locator(".group")
        .filter({ hasText: truckData.placa })
        .locator("button")
        .nth(1)
        .click(); // Assuming 2nd button is delete (1st is edit)

      // Check for modal
      await expect(
        page.getByText(
          `Tem certeza que deseja excluir o caminhão ${truckData.placa}?`
        )
      ).toBeVisible();

      // If there are dependencies, the modal might say "Não é possível excluir...".
      // But `Home.jsx` logic says: `if (temDependencias) ... setErrorMessage`.
      // Wait, `handleOpenDeleteModal` checks dependencies.
      // If dependencies exist, it shows error message INSTEAD of opening the confirmation modal?
      // Let's check `Home.jsx` again.
      /*
      if (temDependencias) {
        let mensagemDependencias = ...
        setErrorMessage(mensagemDependencias);
        return;
      }
      */
      // Ah, so we CANNOT delete if there are dependencies via the UI if that check is strict.
      // However, the user might have implemented cascade delete in the backend but the frontend blocks it?
      // Or maybe `removeWithCascade` is only called if `handleOpenDeleteModal` proceeds.

      // If the frontend blocks deletion, we should delete the expense and tire first.

      // Delete Expense
      await page.goto("/manutencao-gastos");
      await page.fill(
        'input[placeholder*="Filtrar por placa"]',
        truckData.placa
      );
      // Click "Excluir" on the first row
      page.on("dialog", (dialog) => dialog.accept()); // Handle window.confirm
      await page.click('button:has-text("Excluir")');
      await expect(
        page.getByText("Registro excluído com sucesso!")
      ).toBeVisible();

      // Delete Tire
      await page.goto("/pneus");
      await page.fill(
        'input[placeholder*="Filtrar por placa"]',
        truckData.placa
      );
      page.on("dialog", (dialog) => dialog.accept());
      await page.click('button:has-text("Excluir")');
      await expect(page.getByText("Pneu excluído com sucesso!")).toBeVisible();

      // Now Delete Truck
      await page.goto("/");
      await page.fill('input[placeholder*="Buscar"]', truckData.placa);
      await page.click('button:has-text("Buscar")');

      await page
        .locator(".group")
        .filter({ hasText: truckData.placa })
        .locator("button")
        .nth(1)
        .click();

      // Now the modal should appear
      await expect(
        page.getByText(
          `Tem certeza que deseja excluir o caminhão ${truckData.placa}?`
        )
      ).toBeVisible();
      await page.click('button:has-text("Excluir")');

      await expect(
        page.getByText(`Caminhão ${truckData.placa} excluído com sucesso!`)
      ).toBeVisible();
    });
  });
});
