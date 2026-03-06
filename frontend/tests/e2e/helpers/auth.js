/**
 * Shared Playwright auth helpers
 *
 * Two strategies:
 *  - loginViaUI:        real login form flow (tests login feature itself)
 *  - loginViaStorage:  injects localStorage directly then loads index.html
 *                      (fast approach for tests that need to reach a specific tab)
 */

const { expect } = require('@playwright/test');

/**
 * Real UI login through login.html.
 * Use for tests that specifically test the auth flow.
 */
async function loginViaUI(page, email, password) {
  await page.goto('/login.html');
  // Role is determined server-side from credentials — no role tab selection needed
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#loginBtn');
  await page.waitForURL('**/index.html', { timeout: 15000 });
}

/**
 * Fast auth: set localStorage then navigate to index.html.
 * Token is fetched from the live API once and reused.
 * Use for tests that need a specific role's dashboard tab.
 */
async function loginViaStorage(page, email, password, role) {
  // Fetch a real token from the API
  const apiBase = 'https://insuredesk-production.up.railway.app';
  const response = await page.request.post(`${apiBase}/api/auth/login`, {
    data: { email, password, role },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok()) {
    throw new Error(`Login API returned ${response.status()} for ${email}`);
  }

  const body = await response.json();

  // Set localStorage before navigating to the dashboard
  await page.goto('/login.html'); // load a page on same origin first
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('insuredesk_token', token);
    localStorage.setItem('insuredesk_user', JSON.stringify(user));
  }, { token: body.token, user: body.user });

  // Navigate directly to dashboard
  await page.goto('/index.html');
  // Confirm the header loaded (the portal content)
  await expect(page.locator('.header, .logo').first()).toBeVisible({ timeout: 8000 });
}

/**
 * Switch to a tab by its actual ID as found in index.html.
 * Tab IDs:  tab-agent | tab-customer | tab-manager | admin-tab
 */
async function switchTab(page, tabId) {
  const tab = page.locator(`#${tabId}`);
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(500); // let panel animation settle
}

module.exports = { loginViaUI, loginViaStorage, switchTab };
