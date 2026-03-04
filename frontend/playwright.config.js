// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * InsureDesk Playwright E2E Configuration
 *
 * Serve the frontend locally with a simple static server before running:
 *   npx serve frontend -l 3001
 *
 * Or set BASE_URL to point at a live deployment:
 *   BASE_URL=https://your-railway-app.up.railway.app npx playwright test
 *
 * Full run:   npx playwright test
 * UI mode:    npx playwright test --ui
 * Headed:     npx playwright test --headed
 * One file:   npx playwright test tests/e2e/login.spec.js
 * Report:     npx playwright show-report
 */

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
