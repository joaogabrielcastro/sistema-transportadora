import { defineConfig } from "@playwright/test";

/** Config para jornada ao vivo (Vite 5173 + API 3020). Sem webServer/build. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  use: {
    // Usar o mesmo host do CORS (localhost). 127.0.0.1 é origem diferente.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});
