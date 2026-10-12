import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

/**
 * End-to-end tests (acceptance tests A–J). They run against the Vite dev server so that
 * Civilization Studio and its file API are available.
 *
 * The container ships a Chromium build in /opt/pw-browsers; when present it is used directly
 * instead of downloading a browser.
 */
const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(
  (p) => fs.existsSync(p),
);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          executablePath: process.env.CIV_CHROMIUM ?? preinstalled,
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
        },
      },
    },
  ],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
