// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * InsureDesk Playwright E2E Configuration
 *
 * App structure:
 *   /login.html  — login page  (email=#email, pwd=#password, btn=#loginBtn)
 *   /index.html  — dashboard   (tabs: #tab-agent, #tab-customer, #tab-manager, #admin-tab)
 *
 * Serve the frontend locally before running tests:
 *   npx serve ~/Downloads/insuredesk/frontend -l 3001
 *
 * Or point at the live Railway deployment:
 *   BASE_URL=https://insuredesk-production.up.railway.app npx playwright test
 *
 * Full run (Chromium only, fastest):
 *   npx playwright test --project=chromium
 *
 * All browsers:   npx playwright test
 * UI mode:        npx playwright test --ui
 * Headed:         npx playwright test --headed --project=chromium
 * Single file:    npx playwright test tests/e2e/login.spec.js --project=chromium
 * View report:    npx playwright show-report
 */

module.exports = defineConfig({
  testDir: './tests/e2e',
  // Generous timeout — login + redirect takes ~3-5s against Railway API
  timeout: 45_000,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // run serially to avoid Railway rate-limiting

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    // LOCAL: serve frontend with: npx serve frontend -l 3001
    // LIVE:  export BASE_URL=https://insuredesk-production.up.railway.app
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 12_000,
    navigationTimeout: 20_000,
    // Don't reuse auth state between tests — each test manages its own session
    storageState: undefined,
  },

  projects: [
    // Default: Chromium (fastest, fewest flakes)
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
