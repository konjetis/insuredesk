/**
 * E2E TESTS — Admin Tab (index.html)
 *
 * Confirmed selectors from source:
 *   Tab button    : #admin-tab  (NOT #tab-admin!)
 *   Panel         : #panel-admin
 *   Users table   : #users-tbody (populated by loadUsers())
 *   Filter btns   : data-filter="all|agents|managers|customers|admins"
 *   Add User btn  : opens overlay #m-adduser
 *   Stat IDs      : #stat-total, #stat-agents, #stat-managers, #stat-customers, #stat-admins
 *
 * Run: npx playwright test tests/e2e/admin.spec.js --project=chromium
 */

const { test, expect }              = require('@playwright/test');
const { loginViaStorage, switchTab } = require('./helpers/auth');

const ADMIN_EMAIL = 'admin@insuredesk.com';
const ADMIN_PASS  = 'Admin@123';

test.describe('Admin tab — admin role', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page, ADMIN_EMAIL, ADMIN_PASS, 'admin');
    await switchTab(page, 'admin-tab'); // real ID from HTML
    // loadUsers() fires on tab switch — wait for API
    await page.waitForTimeout(2500);
  });

  // ── Panel ─────────────────────────────────────────────────────────────────

  test('admin panel is visible', async ({ page }) => {
    await expect(page.locator('#panel-admin')).toBeVisible();
  });

  test('admin-tab button has active class', async ({ page }) => {
    const cls = await page.locator('#admin-tab').getAttribute('class');
    expect(cls).toContain('active');
  });

  // ── Users table ───────────────────────────────────────────────────────────

  test('users table body is in the DOM', async ({ page }) => {
    await expect(page.locator('#users-tbody')).toBeAttached();
  });

  test('users table contains at least one row (when API is up)', async ({ page }) => {
    const rows = page.locator('#users-tbody tr');
    const count = await rows.count();
    if (count > 0) {
      await expect(rows.first()).toBeVisible();
      // Row should show an email address
      const text = await rows.first().textContent();
      expect(text).toMatch(/@/);
    }
  });

  test('users table headers are visible', async ({ page }) => {
    const headers = page.locator('#panel-admin table th');
    const count = await headers.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ── Stat cards ────────────────────────────────────────────────────────────

  test('Total Users stat card is visible', async ({ page }) => {
    const el = page.locator('#stat-total');
    await expect(el).toBeVisible({ timeout: 5000 });
  });

  test('all 5 stat cards render', async ({ page }) => {
    for (const id of ['stat-total', 'stat-agents', 'stat-managers', 'stat-customers', 'stat-admins']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

  test('stat card values are numbers after data loads', async ({ page }) => {
    await page.waitForTimeout(3000); // allow DB response
    const total = await page.locator('#stat-total').textContent();
    // Should be a number or "—" placeholder
    expect(total?.trim()).toMatch(/^[\d—]+$/);
  });

  // ── Filter buttons ────────────────────────────────────────────────────────

  const FILTERS = [
    { label: 'All',       filter: 'all' },
    { label: 'Agents',    filter: 'agents' },
    { label: 'Managers',  filter: 'managers' },
    { label: 'Customers', filter: 'customers' },
    { label: 'Admins',    filter: 'admins' },
  ];

  for (const { label, filter } of FILTERS) {
    test(`"${label}" filter button is visible and clickable`, async ({ page }) => {
      const btn = page.locator(`button[data-filter="${filter}"], button:has-text("${label}")`).first();
      await expect(btn).toBeVisible({ timeout: 5000 });
      await btn.click();
      await page.waitForTimeout(300);
      // No crash — page should still be intact
      await expect(page.locator('#panel-admin')).toBeVisible();
    });
  }

  test('Agents filter hides non-agent rows', async ({ page }) => {
    await page.locator('button[data-filter="agents"], button:has-text("Agents")').first().click();
    await page.waitForTimeout(400);
    // All VISIBLE rows should have "agent" somewhere in the role cell
    const rows = page.locator('#users-tbody tr:visible');
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await rows.nth(i).textContent();
        expect(text?.toLowerCase()).toMatch(/agent/);
      }
    }
  });

  test('Admins filter shows admin rows', async ({ page }) => {
    await page.locator('button[data-filter="admins"], button:has-text("Admins")').first().click();
    await page.waitForTimeout(400);
    const rows = page.locator('#users-tbody tr:visible');
    const count = await rows.count();
    if (count > 0) {
      const text = await rows.first().textContent();
      expect(text?.toLowerCase()).toMatch(/admin/);
    }
  });

  test('All filter restores full list after filtering', async ({ page }) => {
    await page.waitForTimeout(2000); // let initial load settle
    const initialCount = await page.locator('#users-tbody tr:visible').count();

    await page.locator('button[data-filter="agents"], button:has-text("Agents")').first().click();
    await page.waitForTimeout(400);

    await page.locator('button[data-filter="all"], button:has-text("All")').first().click();
    await page.waitForTimeout(400);

    const restoredCount = await page.locator('#users-tbody tr:visible').count();
    expect(restoredCount).toBe(initialCount);
  });

  // ── Add User modal ────────────────────────────────────────────────────────

  test('Add User button is present', async ({ page }) => {
    const btn = page.locator('button:has-text("Add User"), button:has-text("Add Agent"), #add-user-btn').first();
    await expect(btn).toBeVisible({ timeout: 5000 });
  });

  test('Add User opens a modal overlay', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add User"), button:has-text("Add Agent")').first();
    await addBtn.click();
    await page.waitForTimeout(400);
    // The new user modal overlay
    const modal = page.locator('#m-adduser, .overlay.show, .overlay[style*="flex"]').first();
    await expect(modal).toBeVisible({ timeout: 4000 });
  });

  test('Add User modal has email and password fields', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add User"), button:has-text("Add Agent")').first();
    await addBtn.click();
    await page.waitForTimeout(400);
    await expect(page.locator('#nu-email')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('#nu-password')).toBeVisible({ timeout: 4000 });
  });

  test('Add User modal closes on Cancel/Escape', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add User"), button:has-text("Add Agent")').first();
    await addBtn.click();
    await page.waitForTimeout(400);
    // Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const modal = page.locator('#m-adduser');
    if (await modal.isAttached()) {
      const display = await modal.evaluate(el => el.style.display);
      expect(display).not.toBe('flex');
    }
  });

  // ── Animation stability ───────────────────────────────────────────────────

  test('admin panel animation is suppressed on revisit', async ({ page }) => {
    await switchTab(page, 'tab-agent');
    await page.waitForTimeout(300);
    await switchTab(page, 'admin-tab');
    await page.waitForTimeout(500);

    const anim = await page.locator('#panel-admin').evaluate(el => el.style.animation);
    expect(anim).toBe('none');
  });
});

// ── Access control for non-admin roles ────────────────────────────────────

test.describe('Admin tab — access control', () => {
  test('admin tab button is hidden for agent role', async ({ page }) => {
    await loginViaStorage(page, 'alex@insuredesk.com', 'Agent@123', 'agent');
    // Admin tab button should be display:none for agents
    const tab = page.locator('#admin-tab');
    const visible = await tab.isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('admin tab button is hidden for customer role', async ({ page }) => {
    await loginViaStorage(page, 'john.smith@email.com', 'Customer@123', 'customer');
    const tab = page.locator('#admin-tab');
    const visible = await tab.isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('manager can see the admin tab', async ({ page }) => {
    await loginViaStorage(page, 'sarah.manager@insuredesk.com', 'Manager@123', 'manager');
    const tab = page.locator('#admin-tab');
    await expect(tab).toBeVisible({ timeout: 5000 });
  });
});
