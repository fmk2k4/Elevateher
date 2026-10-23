import { defineConfig, devices } from "@playwright/test";

const RUN_LIVE = !!process.env.RUN_E2E;
const SHELL_FILE = "file:///D:/Hackathon/Elevateher/Elevateher/scratch/ussd_simulator.html";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ignoreHTTPSErrors: true,
    headless: true,
    actionTimeout: 8_000,
    navigationTimeout: 10_000,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "health",
      testMatch: /01-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:8000",
      },
    },
    {
      name: "dashboard",
      testMatch: /(02|03|04|05|06|10|11|15)-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3001",
      },
    },
    {
      name: "web",
      testMatch: /(07|08|10|11|12|13|14|16|17)-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
      },
    },
    {
      name: "simulator",
      testMatch: /09-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: SHELL_FILE,
      },
    },
  ],
});
