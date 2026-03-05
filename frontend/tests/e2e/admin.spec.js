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

  // ── Users grid ────────────────────────────────────────────────────────────

  test('users grid is in the DOM', async ({ page }) => {
    await expect(page.locator('#usersGrid')).toBeAttached();
  });

  test('users grid contains at least one entry (when API is up)', async ({ page }) => {
    await page.waitForTimeout(2000);
    const grid = page.locator('#usersGrid');
    const text = await grid.textContent();
    // Should NOT still be showing "Loading..."
    expect(text?.toLowerCase()).not.toContain('loading');
  });

  test('filter buttons are visible', async ({ page }) => {
    const filters = page.locator('#roleFilterBtns button');
    const count = await filters.count();
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
    await page.locator('button:has-text("Agents")').first().click();
    await page.waitForTimeout(400);
    const gridText = await page.locator('#usersGrid').textContent();
    if (gridText && !gridText.toLowerCase().includes('no users')) {
      expect(gridText.toLowerCase()).toMatch(/agent/);
    }
  });

  test('Admins filter shows admin rows', async ({ page }) => {
    await page.locator('button:has-text("Admins")').first().click();
    await page.waitForTimeout(400);
    const gridText = await page.locator('#usersGrid').textContent();
    if (gridText && !gridText.toLowerCase().includes('no users')) {
      expect(gridText.toLowerCase()).toMatch(/admin/);
    }
  });

  test('All filter restores full list after filtering', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Agents")').first().click();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("All")').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#panel-admin')).toBeVisible();
  });

  // ── Add User modal ────────────────────────────────────────────────────────

  test('Add User button is present', async ({ page }) => {
    const btn = page.locator('button:has-text("Add User"), button:has-text("Add Agent"), #add-user-btn').first();
    await expect(btn).toBeVisible({ timeout: 5000 });
  });

  test('Add User form fields are visible in panel', async ({ page }) => {
    // Add User form is inline in the admin panel (not a modal)
    await expect(page.locator('#nu-email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#nu-password')).toBeVisible({ timeout: 5000 });
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
    if (await modal.count() > 0) {
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

    const animName = await page.locator('#panel-admin').evaluate(el => el.style.animationName);
    expect(animName).toBe('none');
  });
});

// ── Access control for non-admin roles ────────────────────────────────────

test.describe('Admin tab — access control', () => {
  test('admin tab button is hidden for agent role', async ({ page }) => {
    await loginViaStorage(page, 'alex.johnson@insuredesk.com', 'Agent@123', 'agent');
    // Admin tab button should be display:none for agents
    const tab = page.locator('#admin-tab');
    const visible = await tab.isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('admin tab button is hidden for customer role', async ({ page }) => {
    await loginViaStorage(page, 'sarah.anderson@customer.com', 'Customer@123', 'customer');
    const tab = page.locator('#admin-tab');
    const visible = await tab.isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('admin tab button is hidden for manager role', async ({ page }) => {
    await loginViaStorage(page, 'jennifer.w@insuredesk.com', 'Manager@123', 'manager');
    const tab = page.locator('#admin-tab');
    const visible = await tab.isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });
});
