import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 8081;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Drives the Expo web build (react-native-web) with Playwright. Every store
 * is Zustand `persist` backed by AsyncStorage, which resolves to
 * `window.localStorage` on web — tests reset via e2e/fixtures.ts's
 * `resetApp()`, not by restarting the server, so a single worker keeps runs
 * predictable against one Metro instance.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx expo start --web --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      CI: "1",
      BROWSER: "none",
    },
  },
});
