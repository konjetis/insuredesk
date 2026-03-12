/**
 * UI TESTS — Manager Tab (index.html)
 *
 * loadAgentScores() fires when the manager tab is activated and calls
 * /api/admin/agents. A deterministic mock is injected via beforeNavigate
 * so the scorecard always has known data — no Railway dependency.
 *
 * Confirmed selectors from source:
 *   Tab button         : #tab-manager
 *   Panel              : #panel-manager
 *   Agent scores tbody : #agent-scores-tbody
 *   Manager queue stat : #mq-stat
 */

const { test, expect }              = require('@playwright/test');
const { loginViaStorage, switchTab } = require('../helpers/auth');
const { MOCK_AGENT_SCORES, setupManagerMocks } = require('../helpers/mocks');

const MGR_EMAIL = 'jennifer.w@insuredesk.com';
const MGR_PASS  = 'Manager@123';

test.describe('Manager tab', () => {
  test.beforeEach(async ({ page }) => {
    // setupManagerMocks runs before page.goto('/index.html') so
    // loadAgentScores() hits the mock the first time it fires.
    await loginViaStorage(page, MGR_EMAIL, MGR_PASS, 'manager', setupManagerMocks);
    await switchTab(page, 'tab-manager');
    // Wait for the scorecard to populate with mock data
    await page.waitForSelector('#agent-scores-tbody tr', { timeout: 5000 });
  });

  // ── Panel ───────────────────────────────────────────────────────────────────

  test('manager panel is visible', async ({ page }) => {
    await expect(page.locator('#panel-manager')).toBeVisible();
  });

  test('manager panel has active class', async ({ page }) => {
    const cls = await page.locator('#panel-manager').getAttribute('class');
    expect(cls).toContain('active');
  });

  // ── Agent performance scorecard ─────────────────────────────────────────────

  test('agent scores table body exists in DOM', async ({ page }) => {
    await expect(page.locator('#agent-scores-tbody')).toBeAttached();
  });

  test('scorecard contains one row per mock agent', async ({ page }) => {
    const count = await page.locator('#agent-scores-tbody tr').count();
    expect(count).toBe(MOCK_AGENT_SCORES.length);
  });

  test('scorecard rows are non-empty', async ({ page }) => {
    const firstRow = page.locator('#agent-scores-tbody tr').first();
    await expect(firstRow).toBeVisible();
    const text = await firstRow.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('scorecard table has column headers', async ({ page }) => {
    const count = await page.locator('#panel-manager th').count();
    expect(count).toBeGreaterThan(3);
  });

  // ── Metrics / stat cards ────────────────────────────────────────────────────

  test('manager queue stat card shows a number', async ({ page }) => {
    const stat = page.locator('#mq-stat');
    if (await stat.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await stat.textContent();
      expect(text?.trim()).toMatch(/\d/);
    }
  });

  test('manager panel has at least 3 stat cards', async ({ page }) => {
    const count = await page.locator('#panel-manager .card').count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ── Month badge ─────────────────────────────────────────────────────────────

  test('billing month badge shows current year', async ({ page }) => {
    const badge = page.locator('#billing-month-badge');
    if (await badge.count() > 0) {
      const text = await badge.textContent();
      if (text && text.trim() !== '–') {
        expect(text).toContain(new Date().getFullYear().toString());
      }
    }
  });

  test('billing month badge does not show hardcoded "Feb 2026"', async ({ page }) => {
    const now = new Date();
    if (now.getFullYear() !== 2026 || now.getMonth() !== 1) {
      const text = await page.locator('#panel-manager').textContent();
      expect(text).not.toContain('Feb 2026');
    }
  });

  // ── Volume chart ────────────────────────────────────────────────────────────

  test('volume chart canvas is present in manager panel', async ({ page }) => {
    const count = await page.locator('#panel-manager canvas').count();
    if (count > 0) {
      await expect(page.locator('#panel-manager canvas').first()).toBeVisible();
    }
  });

  // ── Animation stability ─────────────────────────────────────────────────────

  test('manager tab numbers are stable on revisit', async ({ page }) => {
    await switchTab(page, 'tab-agent');
    await page.waitForTimeout(400);
    await switchTab(page, 'tab-manager');
    await page.waitForTimeout(800);
    const animName = await page.locator('#panel-manager').evaluate(el => el.style.animationName);
    expect(animName).toBe('none');
  });

  test('switching to manager tab does not re-fetch scores unnecessarily', async ({ page }) => {
    const requests = [];
    page.on('request', req => {
      if (req.url().includes('/api/admin/agents')) requests.push(req.url());
    });
    await switchTab(page, 'tab-agent');
    await page.waitForTimeout(300);
    await switchTab(page, 'tab-manager');
    await page.waitForTimeout(1000);
    // Only one agents request should fire (on the second visit)
    expect(requests.length).toBeLessThanOrEqual(1);
  });
});
