/**
 * Jest config for STAGE environment tests.
 *
 * Runs live HTTP tests against the Stage API — no DB mocking.
 * Requires STAGE_API_URL and STAGE_ADMIN_EMAIL/PASSWORD env vars.
 *
 * Usage:
 *   STAGE_API_URL=https://insuredesk-stage.up.railway.app \
 *   STAGE_ADMIN_EMAIL=admin@insuredesk.com \
 *   STAGE_ADMIN_PASSWORD=Admin@123 \
 *   npx jest --config jest.config.stage.js
 *
 * Or use the npm script:
 *   npm run test:stage
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/stage/**/*.stage.test.js'],
  collectCoverage: false,   // no coverage for live API tests
  testTimeout: 30000,       // live API can be slow on Railway cold start
  verbose: true,
  // Give each test file its own worker to prevent token conflicts
  maxWorkers: 1,
};
