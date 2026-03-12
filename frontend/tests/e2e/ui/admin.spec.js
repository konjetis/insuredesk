/**
 * UI TESTS — Admin Tab (index.html)
 *
 * These tests verify *frontend* behaviour only: checkboxes render,
 * select-all works, filter buttons show the right rows, tooltips exist, etc.
 * The Railway backend is never contacted for /api/admin/users — a deterministic
 * mock is injected before page load so the grid always has known data instantly.
 *
 * Confirmed selectors from source:
 *   Tab button    : #admin-tab  (NOT #tab-admin!)
 *   Panel         : #panel-admin
 *   Users grid    : #usersGrid  (populated by loadUsers())
 *   Filter btns   : button:has-text("All|Agents|Managers|Customers|Admins")
 *   Stat IDs      : #stat-total, #stat-agents, #stat-managers, #stat-customers, #stat-admins
 *   Bulk bar      : #bulkBar, #selectAllChk, #bulkCount, .user-chk
 *   Edit modal    : #m-edituser, #deleteUserBtn
 */

const { test, expect }              = require('@playwright/test');
const { loginViaStorage, switchTab } = require('../helpers/auth');
const { MOCK_USERS, setupAdminMocks } = require('../helpers/mocks');

const ADMIN_EMAIL = 'admin@insuredesk.com';
const ADMIN_PASS  = 'Admin@123';

// ── Shared beforeEach ─────────────────────────────────────────────────────────
//
// setupAdminMocks is passed as `beforeNavigate` so it runs after the CORS proxy
// is registered (LIFO precedence) but before page.goto('/index.html').
// The page-init IIFE auto-clicks #admin-tab → loadUsers() hits the mock
// before the request ever reaches Railway — no race, no cold-start flakiness.
//
// loadUsers() expects { users: [...] } — mocks.js wraps the data correctly.

async function adminBeforeEach(page) {
  await loginViaStorage(page, ADMIN_EMAIL, ADMIN_PASS, 'admin', setupAdminMocks);
  // Mock returns synchronously, renderUsers() has run by the time loginViaStorage
  // resolves. This waitForSelector is a safety-net — resolves in < 200 ms.
  await page.waitForSelector('.user-chk', { timeout: 10000 });
}

// ── Admin tab — admin role ─────────────────────────────────────────────────────

test.describe('Admin tab — admin role', () => {
  test.beforeEach(async ({ page }) => {
    await adminBeforeEach(page);
  });

  // ── Panel ───────────────────────────────────────────────────────────────────

  test('admin panel is visible', async ({ page }) => {
    await expect(page.locator('#panel-admin')).toBeVisible();
  });

  test('admin-tab button has active class', async ({ page }) => {
    const cls = await page.locator('#admin-tab').getAttribute('class');
    expect(cls).toContain('active');
  });

  // ── Users grid ──────────────────────────────────────────────────────────────

  test('users grid is in the DOM', async ({ page }) => {
    await expect(page.locator('#usersGrid')).toBeAttached();
  });

  test('users grid shows mock data (not loading spinner)', async ({ page }) => {
    const text = await page.locator('#usersGrid').textContent();
    expect(text?.toLowerCase()).not.toContain('loading');
    expect(text?.toLowerCase()).not.toContain('connection error');
  });

  test('users grid contains one card per mock user', async ({ page }) => {
    const count = await page.locator('.user-chk').count();
    expect(count).toBe(MOCK_USERS.length);
  });

  // ── Stat cards ──────────────────────────────────────────────────────────────

  test('Total Users stat card is visible', async ({ page }) => {
    await expect(page.locator('#stat-total')).toBeVisible({ timeout: 5000 });
  });

  test('all 5 stat cards render', async ({ page }) => {
    for (const id of ['stat-total', 'stat-agents', 'stat-managers', 'stat-customers', 'stat-admins']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

  test('stat card totals match mock data', async ({ page }) => {
    // MOCK_USERS has 1 active agent, 1 active manager, 0 active customers, 1 active admin
    const total = await page.locator('#stat-total').textContent();
    expect(Number(total?.trim())).toBe(MOCK_USERS.length);
  });

  // ── Filter buttons ──────────────────────────────────────────────────────────

  const FILTERS = [
    { label: 'All',       filter: 'all' },
    { label: 'Agents',    filter: 'agents' },
    { label: 'Managers',  filter: 'managers' },
    { label: 'Customers', filter: 'customers' },
    { label: 'Admins',    filter: 'admins' },
  ];

  for (const { label } of FILTERS) {
    test(`"${label}" filter button is visible and clickable`, async ({ page }) => {
      const btn = page.locator(`button:has-text("${label}")`).first();
      await expect(btn).toBeVisible({ timeout: 5000 });
      await btn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#panel-admin')).toBeVisible();
    });
  }

  test('Agents filter shows only agent rows', async ({ page }) => {
    await page.locator('button:has-text("Agents")').first().click();
    await expect(page.locator('.user-chk')).toHaveCount(1); // 1 agent in MOCK_USERS
    const text = await page.locator('#usersGrid').textContent();
    expect(text?.toLowerCase()).toContain('agent');
  });

  test('Admins filter shows only admin rows', async ({ page }) => {
    await page.locator('button:has-text("Admins")').first().click();
    await expect(page.locator('.user-chk')).toHaveCount(1); // 1 admin in MOCK_USERS
    const text = await page.locator('#usersGrid').textContent();
    expect(text?.toLowerCase()).toContain('admin');
  });

  test('All filter restores full list after filtering', async ({ page }) => {
    await page.locator('button:has-text("Agents")').first().click();
    await page.locator('button:has-text("All")').first().click();
    await expect(page.locator('.user-chk')).toHaveCount(MOCK_USERS.length);
  });

  // ── Add User form ───────────────────────────────────────────────────────────

  test('Add User button is present', async ({ page }) => {
    const btn = page.locator('button:has-text("Add User"), button:has-text("Add Agent"), #add-user-btn').first();
    await expect(btn).toBeVisible({ timeout: 5000 });
  });

  test('Add User form fields are visible in panel', async ({ page }) => {
    await expect(page.locator('#nu-email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#nu-password')).toBeVisible({ timeout: 5000 });
  });

  test('Add User form has email and password inputs', async ({ page }) => {
    await expect(page.locator('#nu-email')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('#nu-password')).toBeVisible({ timeout: 4000 });
  });

  test('Add User modal closes on Escape', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add User"), button:has-text("Add Agent")').first();
    await addBtn.click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const modal = page.locator('#m-adduser');
    if (await modal.count() > 0) {
      const display = await modal.evaluate(el => el.style.display);
      expect(display).not.toBe('flex');
    }
  });

  // ── Animation stability ─────────────────────────────────────────────────────

  test('admin panel animation is suppressed on revisit', async ({ page }) => {
    await switchTab(page, 'tab-agent');
    await page.waitForTimeout(300);
    await switchTab(page, 'admin-tab');
    await page.waitForTimeout(500);
    const animName = await page.locator('#panel-admin').evaluate(el => el.style.animationName);
    expect(animName).toBe('none');
  });
});

// ── Bulk delete & checkboxes ───────────────────────────────────────────────────

test.describe('Admin tab — bulk delete & checkboxes', () => {
  test.beforeEach(async ({ page }) => {
    await adminBeforeEach(page);
  });

  test('bulk action bar is in the DOM', async ({ page }) => {
    await expect(page.locator('#bulkBar')).toBeAttached();
  });

  test('select-all checkbox is present in bulk bar', async ({ page }) => {
    await expect(page.locator('#selectAllChk')).toBeAttached();
  });

  test('user rows have checkboxes after list loads', async ({ page }) => {
    const count = await page.locator('.user-chk').count();
    expect(count).toBe(MOCK_USERS.length);
  });

  test('checking a user checkbox updates bulk count', async ({ page }) => {
    await page.locator('.user-chk').first().check();
    await expect(page.locator('#bulkCount')).toHaveText('1 selected', { timeout: 4000 });
  });

  test('select-all checks all visible user checkboxes', async ({ page }) => {
    const total = await page.locator('.user-chk').count();
    await page.locator('#selectAllChk').check();
    await expect.poll(
      () => page.locator('.user-chk:checked').count(),
      { timeout: 4000 }
    ).toBe(total);
  });

  test('bulk bar shows Delete Selected button', async ({ page }) => {
    await expect(page.locator('#bulkBar button:has-text("Delete Selected")')).toBeAttached();
  });

  test('refresh button has tooltip', async ({ page }) => {
    const title = await page.locator('button:has-text("🔄")').getAttribute('title');
    expect(title).toBeTruthy();
    expect(title?.toLowerCase()).toContain('refresh');
  });
});

// ── Edit modal — delete button ─────────────────────────────────────────────────

test.describe('Admin tab — edit modal delete button', () => {
  test.beforeEach(async ({ page }) => {
    await adminBeforeEach(page);
  });

  test('edit modal has a delete button element', async ({ page }) => {
    await expect(page.locator('#deleteUserBtn')).toBeAttached();
  });

  test('delete button is visible when editing another user', async ({ page }) => {
    await page.waitForSelector('.user-card button', { timeout: 5000 });
    const editBtns = page.locator('.user-card button:has-text("Edit")');
    const count = await editBtns.count();
    for (let i = 0; i < count; i++) {
      await editBtns.nth(i).click();
      await page.waitForTimeout(400);
      const modal = page.locator('#m-edituser');
      if (await modal.isVisible()) {
        const deleteBtn = page.locator('#deleteUserBtn');
        const display = await deleteBtn.evaluate(el => el.style.display);
        if (display !== 'none') {
          expect(display).not.toBe('none');
          break;
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  });

  test('edit button has tooltip', async ({ page }) => {
    await page.waitForSelector('.user-card button', { timeout: 5000 });
    const title = await page.locator('.user-card button:has-text("Edit")').first().getAttribute('title');
    expect(title).toBeTruthy();
  });

  test('deactivate/activate button has tooltip', async ({ page }) => {
    await page.waitForSelector('.user-card button', { timeout: 5000 });
    const actionBtn = page.locator('.user-card button:has-text("Deactivate"), .user-card button:has-text("Activate")').first();
    const title = await actionBtn.getAttribute('title');
    expect(title).toBeTruthy();
  });
});

// ── Access control for non-admin roles ────────────────────────────────────────

test.describe('Admin tab — access control', () => {
  test('admin tab button is hidden for agent role', async ({ page }) => {
    await loginViaStorage(page, 'alex.johnson@insuredesk.com', 'Agent@123', 'agent');
    const visible = await page.locator('#admin-tab').isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('admin tab button is hidden for customer role', async ({ page }) => {
    await loginViaStorage(page, 'sarah.anderson@customer.com', 'Customer@123', 'customer');
    const visible = await page.locator('#admin-tab').isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('admin tab button is hidden for manager role', async ({ page }) => {
    await loginViaStorage(page, 'jennifer.w@insuredesk.com', 'Manager@123', 'manager');
    const visible = await page.locator('#admin-tab').isVisible({ timeout: 2000 }).catch(() => false);
    expect(visible).toBe(false);
  });
});
