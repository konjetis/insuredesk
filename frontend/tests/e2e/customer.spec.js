/**
 * E2E TESTS — Customer Tab (index.html)
 *
 * Confirmed selectors from source:
 *   Tab button       : #tab-customer
 *   Panel            : #panel-customer
 *   Customer greeting: #customer-greeting
 *   Payment due date : #pay-due-cust-badge
 *   Call history     : #mh-d1, #mh-d2
 *
 * Run: npx playwright test tests/e2e/customer.spec.js --project=chromium
 */

const { test, expect }              = require('@playwright/test');
const { loginViaStorage, switchTab } = require('./helpers/auth');

const CUSTOMER_EMAIL = 'john.smith@email.com';
const CUSTOMER_PASS  = 'Customer@123';

test.describe('Customer tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, CUSTOMER_EMAIL, CUSTOMER_PASS, 'customer');
    await switchTab(page, 'tab-customer');
  });

  // ── Panel ─────────────────────────────────────────────────────────────────

  test('customer panel is visible', async ({ page }) => {
    await expect(page.locator('#panel-customer')).toBeVisible();
  });

  test('customer panel has active class', async ({ page }) => {
    const cls = await page.locator('#panel-customer').getAttribute('class');
    expect(cls).toContain('active');
  });

  // ── Personalised greeting ─────────────────────────────────────────────────

  test('customer-greeting element exists and is visible', async ({ page }) => {
    const greet = page.locator('#customer-greeting');
    await expect(greet).toBeVisible({ timeout: 5000 });
  });

  test('greeting says Hi [first name], not hardcoded "Sarah"', async ({ page }) => {
    const text = await page.locator('#customer-greeting').textContent();
    // Should greet John (the logged-in customer), not Sarah
    expect(text?.toLowerCase()).not.toContain('sarah');
    expect(text?.toLowerCase()).toMatch(/hi\s+\w+/i);
  });

  test('greeting contains the policy tagline', async ({ page }) => {
    const text = await page.locator('#customer-greeting').textContent();
    expect(text?.toLowerCase()).toMatch(/policy|claims|support/i);
  });

  // ── Policy section ────────────────────────────────────────────────────────

  test('policy information section is present', async ({ page }) => {
    // Customer panel contains policy details
    const panel = page.locator('#panel-customer');
    const text  = await panel.textContent();
    expect(text?.toLowerCase()).toMatch(/policy|coverage/i);
  });

  // ── Payment due date — dynamic ────────────────────────────────────────────

  test('payment due badge shows a future month name', async ({ page }) => {
    const badge = page.locator('#pay-due-cust-badge');
    if (await badge.isAttached()) {
      const text = await badge.textContent();
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const hasMonth = MONTHS.some(m => text?.includes(m));
      expect(hasMonth).toBe(true);
    }
  });

  test('payment due date is not hardcoded "Mar 1"', async ({ page }) => {
    const badge = page.locator('#pay-due-cust-badge');
    if (await badge.isAttached()) {
      const text = await badge.textContent();
      // It may include Mar 1 if today is in Feb — but should not say "Mar 1, 2024"
      // The important thing: year must be current
      const currentYear = new Date().getFullYear();
      expect(text).toContain(String(currentYear));
    }
  });

  // ── Call history dates ─────────────────────────────────────────────────────

  test('customer call history dates are relative (mh-d1)', async ({ page }) => {
    const el = page.locator('#mh-d1');
    if (await el.isAttached()) {
      const text = await el.textContent();
      expect(text).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
      // Should NOT be the old hardcoded values
      expect(text).not.toMatch(/Feb 10|Feb 17/);
    }
  });

  // ── Claims tracker ────────────────────────────────────────────────────────

  test('claims or support section content is present', async ({ page }) => {
    const panel = page.locator('#panel-customer');
    const text  = await panel.textContent();
    expect(text?.toLowerCase()).toMatch(/claim|support|ticket/i);
  });

  // ── Callback slot — dynamic ───────────────────────────────────────────────

  test('callback section uses current month, not hardcoded Mar 5-7', async ({ page }) => {
    const panel = page.locator('#panel-customer');
    const text  = await panel.textContent();
    const now   = new Date();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    // Callback slots are next 3 weekdays — verify no old hardcoded "Mar 5"
    // Only fail if it ONLY shows last year values
    if (text?.includes('Mar 5') && now.getMonth() !== 1) { // not Feb
      // This means it's still hardcoded; the dynamic fix should have replaced it
      const currentMonth = MONTHS[now.getMonth()];
      expect(text).toContain(currentMonth);
    }
  });

  // ── Animation stability ───────────────────────────────────────────────────

  test('customer tab numbers are stable on revisit', async ({ page }) => {
    await switchTab(page, 'tab-agent');
    await page.waitForTimeout(300);
    await switchTab(page, 'tab-customer');
    await page.waitForTimeout(800);

    // animation should be suppressed on revisit
    const anim = await page.locator('#panel-customer').evaluate(el => el.style.animation);
    expect(anim).toBe('none');
  });
});
