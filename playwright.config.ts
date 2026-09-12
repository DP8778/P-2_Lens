import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  expect: { timeout: 15_000 },
  use: { baseURL: process.env.PW_BASE_URL ?? "http://localhost:3000", trace: "on-first-retry" },
  webServer: process.env.PW_MANAGED_SERVER
    ? undefined
    : {
        command: "node node_modules/next/dist/bin/next start",
        url: "http://localhost:3000/cs-CZ/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
