// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * InsureDesk — Stage Playwright Config
 *
 * Points all E2E tests at the Stage Vercel frontend.
 * The loginViaStorage helper calls the Railway backend directly.
 * Run AFTER confirming the backend Stage tests pass.
 *
 * Usage:
 *   npx playwright test --config playwright.config.stage.js --project=chromium-stage
 *
 * Override URL if needed:
 *   STAGE_URL=https://your-custom.vercel.app npx playwright test --config playwright.config.stage.js
 */

const STAGE_URL = process.env.STAGE_URL || 'https://insuredesk-5ssw082eq-konjetis-projects.vercel.app';

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
