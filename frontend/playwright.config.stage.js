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

// Branch alias URL — always resolves to the latest deploy of the 'develop' branch on Vercel.
// Do NOT use a hash-based deployment URL here (e.g. insuredesk-abc123-...) because those
// point to a fixed snapshot and won't reflect new commits pushed to develop.
const STAGE_URL = process.env.STAGE_URL || 'https://insuredesk-git-develop-konjetis-projects.vercel.app';

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
