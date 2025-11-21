// backend/test-endpoints.js
// Node 18+ has native fetch.

const BASE_URL = "http://localhost:3000/api";

async function runTests() {
  console.log("🚀 Iniciando testes dos endpoints...");

  try {
    // 1. Buscar um caminhão para obter um ID válido
    console.log("\n1. Buscando caminhões...");
    const caminhoesRes = await fetch(`${BASE_URL}/caminhoes`);

    if (!caminhoesRes.ok) {
      throw new Error(
        `Falha ao buscar caminhões: ${caminhoesRes.status} ${caminhoesRes.statusText}`
      );
    }

    const caminhoesData = await caminhoesRes.json();
    const caminhoes = Array.isArray(caminhoesData)
      ? caminhoesData
      : caminhoesData.data || [];

    if (caminhoes.length === 0) {
      console.warn(
        "⚠️ Nenhum caminhão encontrado para testar os endpoints dependentes."
      );
      return;
    }

    const caminhaoId = caminhoes[0].id;
    const caminhaoPlaca = caminhoes[0].placa;
    console.log(`✅ Caminhão encontrado: ID ${caminhaoId} (${caminhaoPlaca})`);

    // 2. Testar endpoint de Checklists por Caminhão
    console.log(`\n2. Testando GET /checklist/caminhao/${caminhaoId}...`);
    const checklistRes = await fetch(
      `${BASE_URL}/checklist/caminhao/${caminhaoId}`
    );
    if (checklistRes.ok) {
      const data = await checklistRes.json();
      console.log(
        `✅ Sucesso! Status: ${checklistRes.status}. Registros encontrados: ${
          Array.isArray(data) ? data.length : "Formato desconhecido"
        }`
      );
    } else {
      console.error(
        `❌ Falha! Status: ${checklistRes.status} ${checklistRes.statusText}`
      );
    }

    // 3. Testar endpoint de Pneus por Caminhão
    console.log(`\n3. Testando GET /pneus/caminhao/${caminhaoId}...`);
    const pneusRes = await fetch(`${BASE_URL}/pneus/caminhao/${caminhaoId}`);
    if (pneusRes.ok) {
      const data = await pneusRes.json();
      console.log(
        `✅ Sucesso! Status: ${pneusRes.status}. Registros encontrados: ${
          Array.isArray(data) ? data.length : "Formato desconhecido"
        }`
      );
    } else {
      console.error(
        `❌ Falha! Status: ${pneusRes.status} ${pneusRes.statusText}`
      );
    }

    // 4. Testar endpoint de Gastos por Caminhão
    console.log(`\n4. Testando GET /gastos/caminhao/${caminhaoId}...`);
    const gastosRes = await fetch(`${BASE_URL}/gastos/caminhao/${caminhaoId}`);
    if (gastosRes.ok) {
      const data = await gastosRes.json();
      console.log(
        `✅ Sucesso! Status: ${gastosRes.status}. Registros encontrados: ${
          Array.isArray(data) ? data.length : "Formato desconhecido"
        }`
      );
    } else {
      console.error(
        `❌ Falha! Status: ${gastosRes.status} ${gastosRes.statusText}`
      );
    }
  } catch (error) {
    console.error("❌ Erro fatal durante os testes:", error.message);
    if (error.cause) console.error(error.cause);
  }
}

runTests();
