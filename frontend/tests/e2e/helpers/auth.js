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
  await page.waitForURL('**/index.html', { timeout: 25000 });
}

/**
 * Fast auth: set localStorage then navigate to index.html.
 * Token is fetched from the live API once and reused.
 * Use for tests that need a specific role's dashboard tab.
 */
async function loginViaStorage(page, email, password, role, beforeNavigate = null) {
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

  // Proxy all in-page Railway API requests through Playwright's Node.js layer.
  // This bypasses browser CORS restrictions when the frontend is served from
  // localhost (e.g. in CI via python3 http.server). The token is already valid —
  // only the browser's same-origin policy blocks the request, not the server.
  //
  // The try-catch guards against "Target page, context or browser has been closed"
  // which fires when a test ends and the page is torn down while a routed request
  // is still in-flight. Those stragglers are safe to silently drop.
  await page.route(`${apiBase}/**`, async route => {
    try {
      const response = await route.fetch();
      await route.fulfill({ response });
    } catch (err) {
      const msg = `${err}`;
      // Page/context was torn down while the request was in-flight — safe to drop.
      if (msg.includes('closed') || msg.includes('destroyed')) return;
      // For any other error (e.g. Railway unreachable) abort the browser request
      // cleanly so the in-page fetch() rejects immediately rather than hanging.
      await route.abort('failed').catch(() => {});
    }
  });

  // Optional hook: runs after the proxy is registered but BEFORE page.goto.
  // Callers can use this to register additional routes (e.g. API stubs) that
  // need LIFO precedence over the proxy without losing it to a re-navigation.
  if (beforeNavigate) await beforeNavigate();

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
