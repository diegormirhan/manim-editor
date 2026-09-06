import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: "http://127.0.0.1:1420",
    viewport: { width: 1280, height: 860 },
    launchOptions: {
      executablePath:
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
  },
});
