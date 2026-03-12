// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * InsureDesk — Stage Playwright Config
 *
 * Two test suites, one config:
 *
 *   ui-stage          tests/e2e/ui/          — UI behaviour tests
 *                                               All Railway data calls are mocked.
 *                                               Only the login token fetch hits Railway.
 *                                               Fast, deterministic, zero flakiness from DB state.
 *
 *   integration-stage tests/e2e/integration/ — API contract & auth flow tests
 *                                               Hit Railway for real to verify the backend.
 *                                               Run serially; need Railway to be warm.
 *
 * Run everything:
 *   npx playwright test --config playwright.config.stage.js
 *
 * Run only UI tests (no Railway warm-up required beyond login):
 *   npx playwright test --config playwright.config.stage.js --project=ui-stage
 *
 * Run only integration tests:
 *   npx playwright test --config playwright.config.stage.js --project=integration-stage
 *
 * Override the frontend URL:
 *   STAGE_BASE_URL=https://your-deploy.vercel.app npx playwright test --config playwright.config.stage.js
 *   STAGE_URL=http://localhost:3000                (legacy / CI local-server)
 */

const STAGE_URL = process.env.STAGE_BASE_URL || process.env.STAGE_URL || 'https://insuredesk-git-develop-konjetis-projects.vercel.app';

module.exports = defineConfig({
  // testDir is overridden per-project below — this is just a fallback.
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 2,
  workers: 1,   // serial — shared Railway login endpoint, avoid rate-limiting

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
    // ── UI tests — mocked backend data, fast & deterministic ─────────────────
    {
      name: 'ui-stage',
      testDir: './tests/e2e/ui',
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Integration tests — real Railway calls, verify API contracts ──────────
    {
      name: 'integration-stage',
      testDir: './tests/e2e/integration',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
