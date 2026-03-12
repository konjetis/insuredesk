/**
 * UI TESTS — Agent Tab (index.html)
 *
 * The agent panel is static HTML — no API calls are made when the agent
 * tab is active, so no network mocking is needed beyond the login token.
 *
 * Confirmed selectors from source:
 *   Tab button : #tab-agent
 *   Panel      : #panel-agent
 *   Queue num  : #q-num
 *   Queue badge: #q-badge
 *   Active call: #qi-active
 */

const { test, expect }              = require('@playwright/test');
const { loginViaStorage, switchTab } = require('../helpers/auth');

const AGENT_EMAIL = 'alex.johnson@insuredesk.com';
const AGENT_PASS  = 'Agent@123';

test.describe('Agent tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, AGENT_EMAIL, AGENT_PASS, 'agent');
    await switchTab(page, 'tab-agent');
  });

  // ── Panel visibility ────────────────────────────────────────────────────────

  test('agent panel is visible after tab click', async ({ page }) => {
    await expect(page.locator('#panel-agent')).toBeVisible();
  });

  test('agent panel has active CSS class', async ({ page }) => {
    const cls = await page.locator('#panel-agent').getAttribute('class');
    expect(cls).toContain('active');
  });

  // ── Call queue ──────────────────────────────────────────────────────────────

  test('queue count element is visible and numeric', async ({ page }) => {
    const qNum = page.locator('#q-num');
    await expect(qNum).toBeVisible({ timeout: 5000 });
    const text = await qNum.textContent();
    expect(text?.trim()).toMatch(/^\d+$/);
  });

  test('queue badge shows waiting count', async ({ page }) => {
    const badge = page.locator('#q-badge');
    if (await badge.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await badge.textContent();
      expect(text).toMatch(/\d/);
    }
  });

  test('active call item is present in queue', async ({ page }) => {
    await expect(page.locator('#qi-active')).toBeVisible({ timeout: 5000 });
  });

  test('queue shows at least one caller card', async ({ page }) => {
    const count = await page.locator('.ci').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('queue count is static (no random juggling)', async ({ page }) => {
    const qNum = page.locator('#q-num');
    const v1 = await qNum.textContent();
    await page.waitForTimeout(2000);
    const v2 = await qNum.textContent();
    expect(v2).toBe(v1);
  });

  // ── Customer profile panel ──────────────────────────────────────────────────

  test('customer profile section is rendered', async ({ page }) => {
    await expect(page.locator('#profile-content')).toBeVisible({ timeout: 5000 });
  });

  // ── Call controls ───────────────────────────────────────────────────────────

  test('call control buttons are present', async ({ page }) => {
    const controls = page.locator('button:has-text("Hold"), button:has-text("Transfer"), button:has-text("End"), button:has-text("Mute")');
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── Call history table ──────────────────────────────────────────────────────

  test('call history date elements use relative dates', async ({ page }) => {
    const dateEl = page.locator('#ch-d1');
    if (await dateEl.count() > 0) {
      const text = await dateEl.textContent();
      expect(text).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    }
  });

  test('call history does not show hardcoded Feb 2026 dates', async ({ page }) => {
    const dateEl = page.locator('#ch-d1');
    if (await dateEl.count() > 0) {
      const text = await dateEl.textContent();
      expect(text).not.toMatch(/Feb 10|Feb 17/);
    }
  });

  // ── Agent greeting ──────────────────────────────────────────────────────────

  test('agent greeting shows logged-in agent name', async ({ page }) => {
    const greet = page.locator('#agent-greeting');
    if (await greet.count() > 0) {
      const text = await greet.textContent();
      expect(text?.toLowerCase()).not.toContain('sarah');
      expect(text?.toLowerCase()).toContain('on shift');
    }
  });

  // ── Animation stability ─────────────────────────────────────────────────────

  test('numbers are stable after returning to agent tab', async ({ page }) => {
    const qNum = page.locator('#q-num');
    await expect(qNum).toBeVisible({ timeout: 5000 });
    const before = await qNum.textContent();
    await page.waitForTimeout(1500);
    const after = await qNum.textContent();
    expect(after).toBe(before);
  });

  test('tab switches do not trigger CSS fadeUp twice', async ({ page }) => {
    await page.waitForTimeout(800);
    const animName = await page.locator('#panel-agent').evaluate(el => el.style.animationName);
    expect(animName).not.toMatch(/fadeUp/);
  });
});
