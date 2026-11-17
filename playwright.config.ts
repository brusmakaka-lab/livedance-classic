import { defineConfig, chromium } from "@playwright/test";
import { existsSync } from "node:fs";
const executable =
  process.env.LIVEDANCE_BROWSER ||
  (existsSync(chromium.executablePath())
    ? chromium.executablePath()
    : undefined);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  expect: { timeout: 25000 },
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          process.env.LIVEDANCE_E2E_REPORT ?? "docs/v0610/e2e-results.json",
      },
    ],
  ],
  use: {
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:5542",
          localStorage: [
            {
              name: "LiveDance.integration.v05",
              value: JSON.stringify({
                enabled: process.env.LIVEDANCE_RENDERER === "integrated",
              }),
            },
          ],
        },
      ],
    },
    baseURL: "http://127.0.0.1:5542",
    viewport: { width: 1440, height: 1080 },
    headless: true,
    channel: executable ? undefined : "msedge",
    launchOptions: {
      executablePath: executable,
      args: [
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/server.mjs",
    url: "http://127.0.0.1:5542/health",
    reuseExistingServer: false,
    env: { LIVEDANCE_DATA_DIR: "temp/e2e-music", LIVEDANCE_SKIN_DIR: "temp/e2e-skins" },
    timeout: 15000,
  },
});
