/**
 * Centralized API mock data and route-setup helpers.
 *
 * All fake API responses used by UI tests live here so that:
 *   - test data is defined in one place
 *   - adding a new endpoint mock is a one-line change
 *   - spec files stay focused on UI behaviour, not data plumbing
 *
 * Usage (pass as the `beforeNavigate` callback in loginViaStorage):
 *
 *   const { setupAdminMocks } = require('../helpers/mocks');
 *
 *   await loginViaStorage(page, EMAIL, PASS, 'admin', setupAdminMocks);
 *
 * The callback runs AFTER the CORS proxy is registered (so mock gets LIFO
 * precedence) but BEFORE page.goto('/index.html'), so the very first
 * in-page API call hits the mock — never Railway.
 */

// ── Admin — user management ──────────────────────────────────────────────────

const MOCK_USERS = [
  { id: 2, full_name: 'Alice Agent',    email: 'alice@insuredesk.com',  role: 'agent',    is_active: true,  last_login: null },
  { id: 3, full_name: 'Bob Manager',    email: 'bob@insuredesk.com',    role: 'manager',  is_active: true,  last_login: null },
  { id: 4, full_name: 'Carol Customer', email: 'carol@insuredesk.com',  role: 'customer', is_active: false, last_login: null },
  { id: 5, full_name: 'Sam Admin',      email: 'sam@insuredesk.com',    role: 'admin',    is_active: true,  last_login: null },
];

// ── Manager — agent performance scorecards ───────────────────────────────────

const MOCK_AGENT_SCORES = [
  { full_name: 'Alice Agent',   calls_handled: 48, avg_handle_time: 210, first_call_resolution: 88, csat_score: 4.5 },
  { full_name: 'Charlie Agent', calls_handled: 32, avg_handle_time: 285, first_call_resolution: 74, csat_score: 3.9 },
];

// ── Route setup helpers ──────────────────────────────────────────────────────

/**
 * Mock all API endpoints used by the Admin tab.
 * Pass as `beforeNavigate` to loginViaStorage.
 *
 * NOTE: loadUsers() expects { users: [...] } — NOT a bare array.
 */
async function setupAdminMocks(page) {
  await page.route(/\/api\/admin\/users/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ users: MOCK_USERS }),
    })
  );
}

/**
 * Mock all API endpoints used by the Manager tab.
 * Pass as `beforeNavigate` to loginViaStorage.
 *
 * loadAgentScores() expects { agents: [...] }.
 */
async function setupManagerMocks(page) {
  await page.route(/\/api\/admin\/agents/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agents: MOCK_AGENT_SCORES }),
    })
  );
}

module.exports = { MOCK_USERS, MOCK_AGENT_SCORES, setupAdminMocks, setupManagerMocks };
