// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * InsureDesk — Stage Playwright Config
 *
 * Points all E2E tests at the Stage Railway deployment.
 * Run AFTER confirming the backend Stage tests pass.
 *
 * Usage:
 *   STAGE_URL=https://insuredesk-stage.up.railway.app \
 *     npx playwright test --config playwright.config.stage.js --project=chromium
 *
 * Or use the npm script (set STAGE_URL in your shell first):
 *   npm run test:stage:e2e
 */

const STAGE_URL = process.env.STAGE_URL || 'https://insuredesk-stage.up.railway.app';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,       // Stage can have Railway cold-start delay
  retries: 2,            // flakier over real network — retry twice
  workers: 1,            // serial to avoid rate-limiting

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-stage', open: 'never' }],
    ['junit', { outputFile: 'playwright-report-stage/results.xml' }],
  ],

  use: {
    baseURL: STAGE_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium-stage',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
