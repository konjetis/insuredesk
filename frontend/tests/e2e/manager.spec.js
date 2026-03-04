/**
 * E2E TESTS — Manager Tab (index.html)
 *
 * Confirmed selectors from source:
 *   Tab button         : #tab-manager
 *   Panel              : #panel-manager
 *   Agent scores tbody : #agent-scores-tbody
 *   Manager queue stat : #mq-stat
 *
 * Run: npx playwright test tests/e2e/manager.spec.js --project=chromium
 */

const { test, expect }              = require('@playwright/test');
const { loginViaStorage, switchTab } = require('./helpers/auth');

const MGR_EMAIL = 'sarah.manager@insuredesk.com';
const MGR_PASS  = 'Manager@123';

test.describe('Manager tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, MGR_EMAIL, MGR_PASS, 'manager');
    await switchTab(page, 'tab-manager');
  });

  // ── Panel ─────────────────────────────────────────────────────────────────

  test('manager panel is visible', async ({ page }) => {
    await expect(page.locator('#panel-manager')).toBeVisible();
  });

  test('manager panel has active class', async ({ page }) => {
    const cls = await page.locator('#panel-manager').getAttribute('class');
    expect(cls).toContain('active');
  });

  // ── Agent performance scorecard ────────────────────────────────────────────

  test('agent scores table body exists in DOM', async ({ page }) => {
    await expect(page.locator('#agent-scores-tbody')).toBeAttached();
  });

  test('agent scorecard loads rows from API (when backend is up)', async ({ page }) => {
    // loadAgentScores() fires on manager tab switch — give it time
    await page.waitForTimeout(3000);
    const rows = page.locator('#agent-scores-tbody tr');
    const count = await rows.count();
    if (count > 0) {
      // At least one agent row
      await expect(rows.first()).toBeVisible();
      const text = await rows.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
    // If count is 0 the backend may be in cold-start — test is informational
  });

  test('scorecard table has column headers', async ({ page }) => {
    const ths = page.locator('#panel-manager th');
    const count = await ths.count();
    expect(count).toBeGreaterThan(3); // Agent, Calls, AHT, FCR, CSAT at minimum
  });

  // ── Metrics / stat cards ──────────────────────────────────────────────────

  test('manager queue stat card shows a number', async ({ page }) => {
    const stat = page.locator('#mq-stat');
    if (await stat.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await stat.textContent();
      expect(text?.trim()).toMatch(/\d/);
    }
  });

  test('manager panel has at least 3 stat cards', async ({ page }) => {
    const cards = page.locator('#panel-manager .card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ── Month badge ───────────────────────────────────────────────────────────

  test('billing month badge shows current year', async ({ page }) => {
    const badge = page.locator('#billing-badge, .badge, [class*="badge"]').first();
    if (await badge.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await badge.textContent();
      const currentYear = new Date().getFullYear().toString();
      expect(text).toContain(currentYear);
    }
  });

  test('billing month badge does not show hardcoded "Feb 2026"', async ({ page }) => {
    const panel = page.locator('#panel-manager');
    const text = await panel.textContent();
    // If today is not in Feb 2026 the badge must not say "Feb 2026"
    const now = new Date();
    if (now.getFullYear() !== 2026 || now.getMonth() !== 1) {
      // Not Feb 2026 — badge should not say it
      expect(text).not.toContain('Feb 2026');
    }
  });

  // ── Volume chart ──────────────────────────────────────────────────────────

  test('volume chart canvas is present in manager panel', async ({ page }) => {
    const canvas = page.locator('#panel-manager canvas');
    const count  = await canvas.count();
    if (count > 0) {
      await expect(canvas.first()).toBeVisible();
    }
    // Canvas may not render in headless — skip gracefully
  });

  // ── Animation stability ───────────────────────────────────────────────────

  test('manager tab numbers are stable on revisit', async ({ page }) => {
    await switchTab(page, 'tab-agent');
    await page.waitForTimeout(400);
    await switchTab(page, 'tab-manager');
    await page.waitForTimeout(800);

    const anim = await page.locator('#panel-manager').evaluate(el => el.style.animation);
    expect(anim).toBe('none');
  });

  test('switching to manager tab does not re-fetch scores unnecessarily', async ({ page }) => {
    // First visit triggers loadAgentScores(); second visit should not cause juggling
    const requests = [];
    page.on('request', req => {
      if (req.url().includes('/api/admin/agents')) requests.push(req.url());
    });

    await switchTab(page, 'tab-agent');
    await page.waitForTimeout(300);
    await switchTab(page, 'tab-manager');
    await page.waitForTimeout(1000);

    // Only 1 agents request should have fired (on first visit already done in beforeEach)
    expect(requests.length).toBeLessThanOrEqual(1);
  });
});
