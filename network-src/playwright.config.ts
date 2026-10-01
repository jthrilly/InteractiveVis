import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  use: {
    baseURL: "http://localhost:5179",
    // Lets CI or a sandbox point at a preinstalled Chromium.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "npx vite --port 5179 --strictPort",
    url: "http://localhost:5179",
    reuseExistingServer: !process.env.CI,
  },
});
