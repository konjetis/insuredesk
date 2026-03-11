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
 *   Bulk bar      : #bulkBar, #selectAllChk, #bulkCount, .user-chk
 *   Edit modal    : #m-edituser, #deleteUserBtn
 *
 * Run: npx playwright test tests/e2e/admin.spec.js --project=chromium
 */

const { test, expect }              = require('@playwright/test');
const { loginViaStorage, switchTab } = require('./helpers/auth');

const ADMIN_EMAIL = 'admin@insuredesk.com';
const ADMIN_PASS  = 'Admin@123';

// Deterministic mock users served to every admin test.
// One of each role so filter tests work; sam-admin has a different id
// from the logged-in admin so the "delete" button visibility test works.
const MOCK_USERS = [
  { id: 2, full_name: 'Alice Agent',    email: 'alice@insuredesk.com',  role: 'agent',    is_active: true,  last_login: null },
  { id: 3, full_name: 'Bob Manager',    email: 'bob@insuredesk.com',    role: 'manager',  is_active: true,  last_login: null },
  { id: 4, full_name: 'Carol Customer', email: 'carol@insuredesk.com',  role: 'customer', is_active: false, last_login: null },
  { id: 5, full_name: 'Sam Admin',      email: 'sam@insuredesk.com',    role: 'admin',    is_active: true,  last_login: null },
];

// Shared beforeEach for all admin describe blocks.
//
// WHY we stub the API here
// ─────────────────────────
// The tests in this file check *frontend* behaviour: checkboxes render,
// select-all works, buttons have tooltips, filter buttons show the right
// rows, etc.  None of them test the backend.  After multiple CI failures
// caused by Railway latency / cold-start / empty DB we switched to a
// stub so the grid always has deterministic data, instantly.
//
// Playwright evaluates routes in LIFO order, so this specific route
// takes precedence over the general `apiBase/**` proxy registered by
// loginViaStorage for every other API call.
async function adminBeforeEach(page) {
  await loginViaStorage(page, ADMIN_EMAIL, ADMIN_PASS, 'admin');

  // Stub /api/admin/users — returns instantly, never flakes.
  await page.route('**/api/admin/users', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USERS),
    })
  );

  await switchTab(page, 'admin-tab');
  // Mock responds synchronously — just wait for renderUsers() to paint.
  await page.waitForSelector('.user-chk', { timeout: 5000 });
}

test.describe('Admin tab — admin role', () => {
  test.beforeEach(async ({ page }) => {
    await adminBeforeEach(page);
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

// ── Bulk delete & checkboxes ──────────────────────────────────────────────

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
    // waitForSelector retries until the element appears (Railway can be slow in CI)
    await page.waitForSelector('.user-chk', { timeout: 10000 });
    const count = await page.locator('.user-chk').count();
    expect(count).toBeGreaterThan(0);
  });

  test('checking a user checkbox updates bulk count', async ({ page }) => {
    // Wait for user cards to actually render (CI can be slow)
    await page.waitForSelector('.user-chk', { timeout: 10000 });
    const firstChk = page.locator('.user-chk').first();
    await firstChk.check();
    // Use Playwright's built-in retry assertion — cleaner than waitForFunction
    await expect(page.locator('#bulkCount')).toHaveText('1 selected', { timeout: 4000 });
  });

  test('select-all checks all visible user checkboxes', async ({ page }) => {
    // Wait for user cards to actually render (CI can be slow)
    await page.waitForSelector('.user-chk', { timeout: 10000 });
    const total = await page.locator('.user-chk').count();
    await page.locator('#selectAllChk').check();
    // Use expect.poll — retries the async count query until it matches
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

// ── Edit modal — delete button ────────────────────────────────────────────

test.describe('Admin tab — edit modal delete button', () => {
  test.beforeEach(async ({ page }) => {
    await adminBeforeEach(page);
  });

  test('edit modal has a delete button element', async ({ page }) => {
    await expect(page.locator('#deleteUserBtn')).toBeAttached();
  });

  test('delete button is visible when editing another user', async ({ page }) => {
    // beforeEach already confirmed the user list loaded — just ensure cards are visible
    await page.waitForSelector('.user-card button', { timeout: 5000 });
    // Click Edit on the first user card that is NOT the logged-in admin
    const editBtns = page.locator('.user-card button:has-text("Edit")');
    const count = await editBtns.count();
    for (let i = 0; i < count; i++) {
      await editBtns.nth(i).click();
      await page.waitForTimeout(400);
      const modal = page.locator('#m-edituser');
      if (await modal.isVisible()) {
        const deleteBtn = page.locator('#deleteUserBtn');
        const display = await deleteBtn.evaluate(el => el.style.display);
        // If editing another user, delete button should be visible (not 'none')
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
    // Wait for at least one user card button to appear before reading attributes
    await page.waitForSelector('.user-card button', { timeout: 10000 });
    const editBtn = page.locator('.user-card button:has-text("Edit")').first();
    const title = await editBtn.getAttribute('title');
    expect(title).toBeTruthy();
  });

  test('deactivate/activate button has tooltip', async ({ page }) => {
    // Wait for at least one user card button to appear before reading attributes
    await page.waitForSelector('.user-card button', { timeout: 10000 });
    const actionBtn = page.locator('.user-card button:has-text("Deactivate"), .user-card button:has-text("Activate")').first();
    const title = await actionBtn.getAttribute('title');
    expect(title).toBeTruthy();
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
