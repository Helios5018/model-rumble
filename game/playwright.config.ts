import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.RUMBLE_URL || "http://localhost:5188",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        (process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : undefined),
      args: ["--enable-webgl", "--ignore-gpu-blocklist"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "../docs/3d/browser-results.json" }],
  ],
  outputDir: "../scratchpad/playwright-results",
});
