import { defineConfig } from "@playwright/test";

const previewCommand =
  process.env.CI === "true"
    ? "npm run preview -- --host 127.0.0.1 --port 4173"
    : "npm run build && npm run preview -- --host 127.0.0.1 --port 4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: previewCommand,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
