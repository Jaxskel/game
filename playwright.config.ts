import { defineConfig, devices } from "@playwright/test";

// In the hosted dev environment a Chromium build is pre-installed at
// /opt/pw-browsers/chromium; use it instead of downloading a pinned build.
// Locally (or in CI after `playwright install`), the default resolution wins.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], launchOptions: { executablePath } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
