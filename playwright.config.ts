import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: 0,
  use: {
    baseURL: "http://localhost:3211",
    viewport: { width: 390, height: 844 }, // mobile-first
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
    },
  },
  webServer: {
    command: "npm run dev -- --port 3211",
    url: "http://localhost:3211",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { MOCK_GEMINI: "1", MOCK_BOOKS: "1" },
  },
});
