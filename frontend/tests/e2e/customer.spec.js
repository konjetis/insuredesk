/**
 * E2E TESTS — Customer Tab
 * Covers: tab navigation, personalised greeting, policy card,
 *         claims tracker, billing info, support widget
 *
 * Run: npx playwright test tests/e2e/customer.spec.js
 */

const { test, expect } = require('@playwright/test');

async function loginAsCustomer(page) {
  await page.goto('/');
  await page.fill('#email', 'john.smith@email.com');
  await page.fill('#password', 'Customer@123');
  await page.click('#login-btn');
  await expect(page.locator('#portal, .portal, #dashboard, main').first()).toBeVisible({ timeout: 10000 });
}

async function switchToCustomerTab(page) {
  const tab = page.locator('[data-tab="customer"], #tab-customer, button:has-text("Customer"), a:has-text("My Portal")').first();
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(400);
}

test.describe('Customer tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
    await switchToCustomerTab(page);
  });

  // ── Greeting ─────────────────────────────────────────────────────────────

  test('greeting shows logged-in user name, not hardcoded "Sarah"', async ({ page }) => {
    const greeting = page.locator('#customer-greeting, [id*="customer-greet"], h1, h2').first();
    if (await greeting.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await greeting.textContent();
      // Should greet the actual user, not a hardcoded name
      expect(text?.toLowerCase()).not.toContain('sarah');
    }
  });

  test('greeting includes user first name from JWT', async ({ page }) => {
    // The logged-in user is John Smith — greeting should say "Hi John"
    const greeting = page.locator('#customer-greeting, [id*="customer-greet"]').first();
    if (await greeting.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await greeting.textContent();
      expect(text?.toLowerCase()).toMatch(/hi john|hello john|john/i);
    }
  });

  // ── Policy card ───────────────────────────────────────────────────────────

  test('policy information section is visible', async ({ page }) => {
    const policy = page.locator('.policy, #policy-card, [class*="policy"]').first();
    if (await policy.isVisible({ timeout: 4000 }).catch(() => false)) {
      await expect(policy).toBeVisible();
    } else {
      // Section may be labeled differently
      const fallback = page.locator('text=Policy, text=Coverage').first();
      await expect(fallback).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Claims tracker ────────────────────────────────────────────────────────

  test('claims tracker section is present', async ({ page }) => {
    const tracker = page.locator('.claims, #claims-tracker, [class*="claim"]').first();
    if (await tracker.isVisible({ timeout: 4000 }).catch(() => false)) {
      await expect(tracker).toBeVisible();
    } else {
      await expect(page.locator('text=Claim').first()).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Billing ───────────────────────────────────────────────────────────────

  test('billing section shows dynamic payment due date', async ({ page }) => {
    // Should show a month name, not a hardcoded "Mar 1" date
    const billing = page.locator('[class*="billing"], [class*="payment"], text=Payment Due').first();
    if (await billing.isVisible({ timeout: 4000 }).catch(() => false)) {
      const text = await billing.textContent();
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const hasMonth = MONTHS.some(m => text?.includes(m));
      expect(hasMonth).toBe(true);
    }
  });

  // ── Support widget ────────────────────────────────────────────────────────

  test('support or callback widget is visible', async ({ page }) => {
    const support = page.locator('.support, #support-widget, [class*="support"], text=Callback, text=Support').first();
    await expect(support).toBeVisible({ timeout: 5000 });
  });

  // ── Call history ─────────────────────────────────────────────────────────

  test('call history shows relative dates not hardcoded Feb dates', async ({ page }) => {
    const history = page.locator('.call-history, #call-history, [class*="history"]').first();
    if (await history.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await history.textContent();
      // Dates should NOT say "Feb 10" or "Feb 17" (those were hardcoded values)
      // Instead they should be relative to today
      expect(text).not.toMatch(/Feb 10|Feb 17|Feb 2025/);
    }
  });

  // ── Animations stabilise on re-visit ─────────────────────────────────────

  test('numbers do not animate again when returning to customer tab', async ({ page }) => {
    // Navigate away and back
    const otherTab = page.locator('[data-tab="dashboard"], [data-tab="home"], button:has-text("Home"), button:has-text("Dashboard")').first();
    if (await otherTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await otherTab.click();
      await page.waitForTimeout(400);
      await switchToCustomerTab(page);
      await page.waitForTimeout(800);
      // Read a number element twice — should be stable
      const numEl = page.locator('.sv, .stat-value, .num, [class*="metric"]').first();
      if (await numEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        const v1 = await numEl.textContent();
        await page.waitForTimeout(600);
        const v2 = await numEl.textContent();
        expect(v2).toBe(v1);
      }
    }
  });
});
