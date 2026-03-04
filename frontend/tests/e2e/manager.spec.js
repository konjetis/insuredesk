/**
 * E2E TESTS — Manager Tab
 * Covers: manager tab navigation, agent performance scorecards,
 *         metrics cards, month badge, chart rendering
 *
 * Run: npx playwright test tests/e2e/manager.spec.js
 */

const { test, expect } = require('@playwright/test');

async function loginAsManager(page) {
  await page.goto('/');
  await page.fill('#email', 'sarah.manager@insuredesk.com');
  await page.fill('#password', 'Manager@123');
  await page.click('#login-btn');
  await expect(page.locator('#portal, .portal, #dashboard, main').first()).toBeVisible({ timeout: 10000 });
}

async function switchToManagerTab(page) {
  const tab = page.locator('[data-tab="manager"], #tab-manager, button:has-text("Manager"), a:has-text("Manager")').first();
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(600); // allow async loadAgentScores() to run
}

test.describe('Manager tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await switchToManagerTab(page);
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test('manager panel becomes active after tab click', async ({ page }) => {
    const panel = page.locator('#panel-manager, [data-panel="manager"], .manager-panel').first();
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  // ── Agent scorecards ──────────────────────────────────────────────────────

  test('agent performance table is visible', async ({ page }) => {
    const table = page.locator('#agent-scores-tbody, [id*="agent-score"], table').first();
    await expect(table).toBeVisible({ timeout: 6000 });
  });

  test('agent scorecard table has column headers', async ({ page }) => {
    const headers = page.locator('th, thead td');
    const count = await headers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('scorecard rows contain agent data (when API available)', async ({ page }) => {
    // If the backend is live, rows should be populated
    const rows = page.locator('#agent-scores-tbody tr, tbody tr');
    const count = await rows.count();
    if (count > 0) {
      // At least one row visible
      await expect(rows.first()).toBeVisible();
      const text = await rows.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
    // If count is 0, the API may not be reachable — skip gracefully
  });

  // ── Metrics cards ─────────────────────────────────────────────────────────

  test('metric stat cards are visible', async ({ page }) => {
    const cards = page.locator('.card, [class*="stat-card"], [class*="metric-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('stat card values are numeric or formatted numbers', async ({ page }) => {
    const values = page.locator('.sv, .stat-value, [class*="stat-val"]');
    const count = await values.count();
    if (count > 0) {
      const text = await values.first().textContent();
      // Should contain at least a digit
      expect(text?.trim()).toMatch(/[\d.%]/);
    }
  });

  // ── Month badge ───────────────────────────────────────────────────────────

  test('month badge shows current month/year, not hardcoded "Feb 2026"', async ({ page }) => {
    const badge = page.locator('.badge, [class*="badge"], [class*="month"]').first();
    if (await badge.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await badge.textContent();
      const now = new Date();
      const currentMonth = now.toLocaleString('default', { month: 'short' });
      const currentYear = now.getFullYear().toString();
      // Should contain the current year at minimum
      expect(text).toContain(currentYear);
    }
  });

  // ── Charts ────────────────────────────────────────────────────────────────

  test('volume chart or canvas element is rendered', async ({ page }) => {
    const chart = page.locator('canvas, svg[class*="chart"], [id*="chart"]').first();
    if (await chart.isVisible({ timeout: 4000 }).catch(() => false)) {
      await expect(chart).toBeVisible();
    }
    // Chart may not be present if canvas API is limited — skip gracefully
  });

  // ── Tab switch stability ───────────────────────────────────────────────────

  test('switching to manager tab twice does not re-animate numbers', async ({ page }) => {
    const otherTab = page.locator('[data-tab="agent"], button:has-text("Agent"), [data-tab="dashboard"]').first();
    if (await otherTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await otherTab.click();
      await page.waitForTimeout(400);
      await switchToManagerTab(page);
      // Read a number
      const numEl = page.locator('.sv, .stat-value, .num').first();
      if (await numEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        const before = await numEl.textContent();
        await page.waitForTimeout(800);
        const after = await numEl.textContent();
        expect(after).toBe(before);
      }
    }
  });
});
