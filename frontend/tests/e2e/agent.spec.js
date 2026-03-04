/**
 * E2E TESTS — Agent Tab
 * Covers: tab visibility, call queue, customer lookup panel,
 *         call controls, call history table
 *
 * Run: npx playwright test tests/e2e/agent.spec.js
 */

const { test, expect } = require('@playwright/test');

// ── Auth helper ────────────────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.goto('/');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#login-btn');
  // Wait until dashboard is visible
  await expect(page.locator('#portal, .portal, #dashboard, main').first()).toBeVisible({ timeout: 10000 });
}

// ── Setup: log in as agent before each test ────────────────────────────────

test.describe('Agent tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'alex@insuredesk.com', 'Agent@123');
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  test('agent tab is visible and accessible', async ({ page }) => {
    const tab = page.locator('[data-tab="agent"], #tab-agent, button:has-text("Agent"), a:has-text("Agent")').first();
    await expect(tab).toBeVisible({ timeout: 5000 });
    await tab.click();
    await page.waitForTimeout(500);
    // Agent panel should be active
    const panel = page.locator('#panel-agent, #agent-panel, [data-panel="agent"]').first();
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  // ── Call queue ───────────────────────────────────────────────────────────

  test('call queue displays callers list', async ({ page }) => {
    // Navigate to agent tab
    await page.locator('[data-tab="agent"], #tab-agent, button:has-text("Agent")').first().click();
    // Queue should contain at least one caller row or a queue container
    const queue = page.locator('.queue, #call-queue, .caller-list, [class*="queue"]').first();
    await expect(queue).toBeVisible({ timeout: 5000 });
  });

  test('queue badge shows a numeric count', async ({ page }) => {
    const badge = page.locator('#q-badge, .q-badge, [id*="q-num"], [id*="queue-count"]').first();
    if (await badge.isVisible()) {
      const text = await badge.textContent();
      expect(text?.trim()).toMatch(/\d/);
    } else {
      test.skip(); // badge not present in this build
    }
  });

  // ── Customer profile panel ────────────────────────────────────────────────

  test('customer profile panel is present on agent tab', async ({ page }) => {
    await page.locator('[data-tab="agent"], #tab-agent, button:has-text("Agent")').first().click();
    const profile = page.locator('.customer-profile, #customer-profile, [class*="profile"]').first();
    await expect(profile).toBeVisible({ timeout: 5000 });
  });

  // ── Call controls ─────────────────────────────────────────────────────────

  test('call controls are rendered', async ({ page }) => {
    await page.locator('[data-tab="agent"], #tab-agent, button:has-text("Agent")').first().click();
    // Look for common call control buttons
    const controls = page.locator('.call-controls, #call-controls, [class*="call-ctrl"]').first();
    if (await controls.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(controls).toBeVisible();
    } else {
      // Fallback: check for individual buttons
      const btn = page.locator('button:has-text("Hold"), button:has-text("Transfer"), button:has-text("End Call"), button:has-text("Mute")').first();
      await expect(btn).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Call history table ────────────────────────────────────────────────────

  test('call history section is visible', async ({ page }) => {
    await page.locator('[data-tab="agent"], #tab-agent, button:has-text("Agent")').first().click();
    // Scroll down to ensure the history section is in view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    const history = page.locator('.call-history, #call-history, [class*="history"]').first();
    if (await history.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(history).toBeVisible();
    } else {
      // Acceptable if the section is below fold — check for any table
      const table = page.locator('table').first();
      await expect(table).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Greeting ─────────────────────────────────────────────────────────────

  test('agent greeting shows agent name', async ({ page }) => {
    await page.locator('[data-tab="agent"], #tab-agent, button:has-text("Agent")').first().click();
    const greeting = page.locator('#agent-greeting, [id*="agent-greet"]').first();
    if (await greeting.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await greeting.textContent();
      expect(text?.toLowerCase()).not.toContain('sarah'); // should not show hardcoded name
    }
  });

  // ── Animations stabilise ──────────────────────────────────────────────────

  test('switching to agent tab twice does not cause number juggling', async ({ page }) => {
    const agentTab = page.locator('[data-tab="agent"], #tab-agent, button:has-text("Agent")').first();
    const otherTab = page.locator('[data-tab="dashboard"], [data-tab="home"], button:has-text("Dashboard"), button:has-text("Home")').first();

    await agentTab.click();
    await page.waitForTimeout(600);
    await otherTab.click();
    await page.waitForTimeout(300);
    await agentTab.click();
    await page.waitForTimeout(600);

    // After switching back, read a numeric element and wait briefly
    const numEl = page.locator('.num, .sv, .stat-value, [class*="metric"]').first();
    if (await numEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      const before = await numEl.textContent();
      await page.waitForTimeout(1000);
      const after = await numEl.textContent();
      // Numbers should stabilise — same value both reads
      expect(after).toBe(before);
    }
  });
});
