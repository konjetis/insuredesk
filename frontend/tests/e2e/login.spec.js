/**
 * E2E TESTS — Login Page (login.html)
 *
 * Actual element IDs confirmed from source:
 *   email field  : #email
 *   password     : #password
 *   submit btn   : #loginBtn
 *   error banner : #loginError / #loginErrorText
 *   success msg  : #loginSuccess
 *   Token stored : localStorage key "insuredesk_token"
 *   After login  : 1s delay then redirects to index.html
 *
 * Run: npx playwright test tests/e2e/login.spec.js --project=chromium
 */

const { test, expect } = require('@playwright/test');
const { loginViaStorage } = require('./helpers/auth');

// ── Shared helper ──────────────────────────────────────────────────────────

async function fillLogin(page, email, password) {
  await page.fill('#email', email);
  await page.fill('#password', password);
}

// ── Login page renders ─────────────────────────────────────────────────────

test.describe('Login page — UI rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
  });

  test('shows the login card with all required fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#loginBtn')).toBeVisible();
  });

  test('login button reads "Sign In to Dashboard"', async ({ page }) => {
    const text = await page.locator('#loginBtn').textContent();
    expect(text?.toLowerCase()).toMatch(/sign in/i);
  });

  test('password field masks input', async ({ page }) => {
    expect(await page.locator('#password').getAttribute('type')).toBe('password');
  });

  test('email field type is email', async ({ page }) => {
    expect(await page.locator('#email').getAttribute('type')).toBe('email');
  });

  test('shows InsureDesk branding', async ({ page }) => {
    await expect(page.locator('body')).toContainText('InsureDesk');
  });

  test('Forgot password link is present', async ({ page }) => {
    const link = page.locator('a:has-text("Forgot"), button:has-text("Forgot"), [href*="reset"], [href*="forgot"]').first();
    await expect(link).toBeVisible();
  });

  test('error banner is hidden on initial load', async ({ page }) => {
    await expect(page.locator('#loginError')).not.toBeVisible();
  });
});

// ── Validation ─────────────────────────────────────────────────────────────

test.describe('Login validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
  });

  test('blocks submit when email is empty', async ({ page }) => {
    await page.fill('#password', 'anything');
    await page.click('#loginBtn');
    await expect(page.locator('#loginError')).toBeVisible({ timeout: 3000 });
    const msg = await page.locator('#loginErrorText').textContent();
    expect(msg?.toLowerCase()).toMatch(/email/i);
  });

  test('blocks submit when email is malformed', async ({ page }) => {
    await page.fill('#email', 'notanemail');
    await page.fill('#password', 'anything');
    await page.click('#loginBtn');
    await expect(page.locator('#loginError')).toBeVisible({ timeout: 3000 });
    const msg = await page.locator('#loginErrorText').textContent();
    expect(msg?.toLowerCase()).toMatch(/email/i);
  });

  test('blocks submit when password is empty', async ({ page }) => {
    await page.fill('#email', 'admin@insuredesk.com');
    await page.click('#loginBtn');
    await expect(page.locator('#loginError')).toBeVisible({ timeout: 3000 });
    const msg = await page.locator('#loginErrorText').textContent();
    expect(msg?.toLowerCase()).toMatch(/password/i);
  });

  test('email field gets error-input class on empty submit', async ({ page }) => {
    await page.click('#loginBtn');
    const cls = await page.locator('#email').getAttribute('class');
    expect(cls).toContain('error-input');
  });
});

// ── Failed login ───────────────────────────────────────────────────────────

test.describe('Failed login (live API)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
  });

  test('shows error banner on wrong credentials', async ({ page }) => {
    await fillLogin(page, 'nobody@insuredesk.com', 'WrongPass@1');
    await page.click('#loginBtn');
    await expect(page.locator('#loginError')).toBeVisible({ timeout: 10000 });
    const msg = await page.locator('#loginErrorText').textContent();
    expect(msg?.trim().length).toBeGreaterThan(0);
  });

  test('stays on login.html after failed attempt', async ({ page }) => {
    await fillLogin(page, 'nobody@insuredesk.com', 'WrongPass@1');
    await page.click('#loginBtn');
    await page.waitForTimeout(4000);
    expect(page.url()).toContain('login.html');
  });

  test('button re-enables after failed login', async ({ page }) => {
    await fillLogin(page, 'nobody@insuredesk.com', 'WrongPass@1');
    await page.click('#loginBtn');
    // Wait for API response
    await page.waitForTimeout(5000);
    const disabled = await page.locator('#loginBtn').getAttribute('disabled');
    expect(disabled).toBeNull(); // button re-enabled
  });
});

// ── Successful login ───────────────────────────────────────────────────────

test.describe('Successful login (live API)', () => {
  test('admin login — API returns valid token and user object', async ({ page }) => {
    // Verify the login API contract directly — more reliable than UI redirect in CI
    const apiBase = 'https://insuredesk-production.up.railway.app';
    const response = await page.request.post(`${apiBase}/api/auth/login`, {
      data: { email: 'admin@insuredesk.com', password: 'Admin@123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.token).toBeTruthy();
    expect(body.token.length).toBeGreaterThan(20);
    expect(body.user.role).toBe('admin');
    expect(body.user.email).toBe('admin@insuredesk.com');
  });

  test('token is stored in localStorage after successful login', async ({ page }) => {
    // Use fast storage login — this test verifies token is set, not the form flow
    await loginViaStorage(page, 'admin@insuredesk.com', 'Admin@123', 'admin');
    const token = await page.evaluate(() => localStorage.getItem('insuredesk_token'));
    expect(token).not.toBeNull();
    expect(token?.length).toBeGreaterThan(20);
  });

  test('user data is stored in localStorage after login', async ({ page }) => {
    // Use fast storage login — this test verifies user object, not the form flow
    await loginViaStorage(page, 'admin@insuredesk.com', 'Admin@123', 'admin');
    const raw = await page.evaluate(() => localStorage.getItem('insuredesk_user'));
    expect(raw).not.toBeNull();
    const user = JSON.parse(raw);
    expect(user.role).toBe('admin');
  });

  test('dashboard loads correctly after admin login', async ({ page }) => {
    // Use fast storage login — this test verifies dashboard renders, not the form flow
    await loginViaStorage(page, 'admin@insuredesk.com', 'Admin@123', 'admin');
    // Header should be visible
    await expect(page.locator('.header, .logo').first()).toBeVisible({ timeout: 5000 });
    // Login button should NOT be present on the dashboard
    await expect(page.locator('#loginBtn')).not.toBeAttached();
  });
});

// ── Logout ─────────────────────────────────────────────────────────────────

test.describe('Logout', () => {
  test('logout clears localStorage and redirects to login.html', async ({ page }) => {
    // Set up session via storage — testing logout behaviour, not login form
    await loginViaStorage(page, 'admin@insuredesk.com', 'Admin@123', 'admin');

    // Open user menu and click logout
    await page.locator('.avatar, #user-avatar').first().click();
    await page.waitForTimeout(300);
    await page.locator('.logout-btn, button:has-text("Sign Out"), button:has-text("Logout")').first().click();

    // Should navigate back to login.html
    await page.waitForURL('**/login.html', { timeout: 10000 });
    expect(page.url()).toContain('login.html');

    // Token should be cleared
    const token = await page.evaluate(() => localStorage.getItem('insuredesk_token'));
    expect(token).toBeNull();
  });
});

// ── Password visibility toggle ─────────────────────────────────────────────

test.describe('Password toggle', () => {
  test('eye button toggles password visibility', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#password', 'testpass');
    expect(await page.locator('#password').getAttribute('type')).toBe('password');
    await page.locator('#pwToggle').click();
    expect(await page.locator('#password').getAttribute('type')).toBe('text');
    await page.locator('#pwToggle').click();
    expect(await page.locator('#password').getAttribute('type')).toBe('password');
  });
});
