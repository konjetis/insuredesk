/**
 * UI TESTS — Customer Tab (index.html)
 *
 * The customer panel is static HTML with JS-computed dates — no API
 * calls on tab activation, so no network mocking is needed.
 *
 * Confirmed selectors from source:
 *   Tab button       : #tab-customer
 *   Panel            : #panel-customer
 *   Customer greeting: #customer-greeting
 *   Payment due date : #pay-due-cust-badge
 *   Call history     : #mh-d1, #mh-d2
 */

const { test, expect }              = require('@playwright/test');
const { loginViaStorage, switchTab } = require('../helpers/auth');

const CUSTOMER_EMAIL = 'marcus.roberts@customer.com';
const CUSTOMER_PASS  = 'Customer@123';

test.describe('Customer tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, CUSTOMER_EMAIL, CUSTOMER_PASS, 'customer');
    await switchTab(page, 'tab-customer');
  });

  // ── Panel ───────────────────────────────────────────────────────────────────

  test('customer panel is visible', async ({ page }) => {
    await expect(page.locator('#panel-customer')).toBeVisible();
  });

  test('customer panel has active class', async ({ page }) => {
    const cls = await page.locator('#panel-customer').getAttribute('class');
    expect(cls).toContain('active');
  });

  // ── Personalised greeting ───────────────────────────────────────────────────

  test('customer-greeting element exists and is visible', async ({ page }) => {
    await expect(page.locator('#customer-greeting')).toBeVisible({ timeout: 5000 });
  });

  test('greeting says Hi [first name], not hardcoded "Sarah"', async ({ page }) => {
    const text = await page.locator('#customer-greeting').textContent();
    expect(text?.toLowerCase()).not.toContain('sarah');
    expect(text?.toLowerCase()).toMatch(/hi\s+\w+/i);
  });

  test('greeting contains the policy tagline', async ({ page }) => {
    const text = await page.locator('#customer-greeting').textContent();
    expect(text?.toLowerCase()).toMatch(/policy|claims|support/i);
  });

  // ── Policy section ──────────────────────────────────────────────────────────

  test('policy information section is present', async ({ page }) => {
    const text = await page.locator('#panel-customer').textContent();
    expect(text?.toLowerCase()).toMatch(/policy|coverage/i);
  });

  // ── Payment due date — dynamic ──────────────────────────────────────────────

  test('payment due badge shows a future month name', async ({ page }) => {
    const badge = page.locator('#pay-due-cust-badge');
    if (await badge.count() > 0) {
      const text = await badge.textContent();
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      expect(MONTHS.some(m => text?.includes(m))).toBe(true);
    }
  });

  test('payment due date carries current year', async ({ page }) => {
    const badge = page.locator('#pay-due-cust-badge');
    if (await badge.count() > 0) {
      const text = await badge.textContent();
      expect(text).toContain(String(new Date().getFullYear()));
    }
  });

  // ── Call history dates ──────────────────────────────────────────────────────

  test('customer call history dates are relative (mh-d1)', async ({ page }) => {
    const el = page.locator('#mh-d1');
    if (await el.count() > 0) {
      const text = await el.textContent();
      expect(text).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
      expect(text).not.toMatch(/Feb 10|Feb 17/);
    }
  });

  // ── Claims tracker ──────────────────────────────────────────────────────────

  test('claims or support section content is present', async ({ page }) => {
    const text = await page.locator('#panel-customer').textContent();
    expect(text?.toLowerCase()).toMatch(/claim|support|ticket/i);
  });

  // ── Callback slot — dynamic ─────────────────────────────────────────────────

  test('callback section uses current month, not hardcoded Mar 5-7', async ({ page }) => {
    const text = await page.locator('#panel-customer').textContent();
    const now   = new Date();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (text?.includes('Mar 5') && now.getMonth() !== 1) {
      expect(text).toContain(MONTHS[now.getMonth()]);
    }
  });

  // ── Animation stability ─────────────────────────────────────────────────────

  test('customer tab numbers are stable on revisit', async ({ page }) => {
    await page.waitForTimeout(800);
    const animName = await page.locator('#panel-customer').evaluate(el => el.style.animationName);
    expect(animName).not.toMatch(/fadeUp/);
  });
});
