// Teste rápido da API
const testAPI = async () => {
  try {
    console.log("🔍 Testando conexão com backend...");

    // Teste 1: Health check
    const healthResponse = await fetch("http://localhost:3000/health");
    console.log(
      "✅ Health check:",
      healthResponse.status,
      await healthResponse.text()
    );

    // Teste 2: Rota raiz da API
    const rootResponse = await fetch("http://localhost:3000/");
    console.log("✅ Root API:", rootResponse.status, await rootResponse.text());

    // Teste 3: Rota caminhões
    const caminhoesResponse = await fetch(
      "http://localhost:3000/api/caminhoes"
    );
    console.log("✅ Caminhões API:", caminhoesResponse.status);

    if (caminhoesResponse.ok) {
      const data = await caminhoesResponse.json();
      console.log("📊 Dados recebidos:", data);
    } else {
      console.log("❌ Erro na rota caminhões:", await caminhoesResponse.text());
    }
  } catch (error) {
    console.error("❌ Erro de conexão:", error);
  }
};

testAPI();
