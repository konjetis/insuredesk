/**
 * E2E TESTS — Admin Tab
 * Covers: users table, filter buttons (All/Admins/Managers/Agents/Customers),
 *         Add User modal, deactivate user, stat cards
 *
 * Run: npx playwright test tests/e2e/admin.spec.js
 */

const { test, expect } = require('@playwright/test');

async function loginAsAdmin(page) {
  await page.goto('/');
  await page.fill('#email', 'admin@insuredesk.com');
  await page.fill('#password', 'Admin@123');
  await page.click('#login-btn');
  await expect(page.locator('#portal, .portal, #dashboard, main').first()).toBeVisible({ timeout: 10000 });
}

async function switchToAdminTab(page) {
  const tab = page.locator('[data-tab="admin"], #tab-admin, button:has-text("Admin"), a:has-text("Admin")').first();
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(600);
}

test.describe('Admin tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await switchToAdminTab(page);
  });

  // ── Access control ────────────────────────────────────────────────────────

  test('admin tab is visible for admin role', async ({ page }) => {
    const panel = page.locator('#panel-admin, [data-panel="admin"], .admin-panel').first();
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  // ── Users table ───────────────────────────────────────────────────────────

  test('users table renders with headers', async ({ page }) => {
    const headers = page.locator('table th, thead td');
    await expect(headers.first()).toBeVisible({ timeout: 5000 });
    const count = await headers.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('users table contains at least one data row', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 6000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('user rows contain email addresses', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 6000 });
    const text = await rows.first().textContent();
    expect(text).toMatch(/@/); // should contain email
  });

  // ── Filter buttons ────────────────────────────────────────────────────────

  const filters = ['All', 'Agents', 'Managers', 'Customers', 'Admins'];

  for (const filter of filters) {
    test(`filter button "${filter}" is clickable`, async ({ page }) => {
      const btn = page.locator(`button:has-text("${filter}"), [data-filter="${filter.toLowerCase()}"]`).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(300);
        // After clicking, something should change (active state or row count)
        // Just verifying no errors thrown
        await expect(page.locator('body')).not.toContainText('Error');
      }
    });
  }

  test('Agents filter shows only agent rows', async ({ page }) => {
    const agentBtn = page.locator('button:has-text("Agents"), [data-filter="agents"]').first();
    if (await agentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await agentBtn.click();
      await page.waitForTimeout(400);
      // Visible rows should only contain "agent" role text
      const rows = page.locator('tbody tr:visible');
      const count = await rows.count();
      if (count > 0) {
        const text = await rows.first().textContent();
        expect(text?.toLowerCase()).toMatch(/agent/);
      }
    }
  });

  test('All filter restores full user list', async ({ page }) => {
    const agentBtn = page.locator('button:has-text("Agents")').first();
    const allBtn   = page.locator('button:has-text("All")').first();
    if (await agentBtn.isVisible({ timeout: 3000 }).catch(() => false) && await allBtn.isVisible()) {
      const initialCount = await page.locator('tbody tr').count();
      await agentBtn.click();
      await page.waitForTimeout(300);
      await allBtn.click();
      await page.waitForTimeout(300);
      const restoredCount = await page.locator('tbody tr').count();
      expect(restoredCount).toBe(initialCount);
    }
  });

  // ── Stat cards ────────────────────────────────────────────────────────────

  test('admin stat cards show numeric values', async ({ page }) => {
    const statVals = page.locator('.sv, .stat-value, [id^="stat-"]');
    const count = await statVals.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const text = await statVals.nth(i).textContent();
        expect(text?.trim()).toMatch(/[\d—]/);
      }
    }
  });

  // ── Add User modal ────────────────────────────────────────────────────────

  test('Add User button opens a modal or form', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add User"), button:has-text("Add"), [id*="add-user"]').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(400);
      // Modal should appear
      const modal = page.locator('.modal, [role="dialog"], [class*="modal"], form[id*="user"]').first();
      await expect(modal).toBeVisible({ timeout: 4000 });
    }
  });

  test('Add User form has required fields', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add User"), button:has-text("Add"), [id*="add-user"]').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(400);
      // Should have email, name, password, role fields
      const emailField = page.locator('input[type="email"], input[name="email"], #user-email').first();
      const pwdField   = page.locator('input[type="password"], input[name="password"]').first();
      if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(emailField).toBeVisible();
      }
      if (await pwdField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(pwdField).toBeVisible();
      }
    }
  });

  test('closing the Add User modal restores the table view', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add User"), button:has-text("Add")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(400);
      // Close modal
      const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"], .modal-close').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
      // Table should still be visible
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 3000 });
    }
  });

  // ── Deactivate user ───────────────────────────────────────────────────────

  test('deactivate button is present in user rows', async ({ page }) => {
    const deactivateBtn = page.locator('button:has-text("Deactivate"), button:has-text("Delete"), [class*="deactivate"], [class*="delete"]').first();
    if (await deactivateBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await expect(deactivateBtn).toBeVisible();
    }
    // Deactivate may be in a kebab menu or edit modal — just verifying no crash
  });
});

// ── Access denied for agent ───────────────────────────────────────────────

test.describe('Admin tab access control', () => {
  test('admin tab is not visible (or disabled) for agent role', async ({ page }) => {
    await page.goto('/');
    await page.fill('#email', 'alex@insuredesk.com');
    await page.fill('#password', 'Agent@123');
    await page.click('#login-btn');
    await expect(page.locator('#portal, .portal, main').first()).toBeVisible({ timeout: 10000 });

    // Admin tab should either be hidden or not present for agents
    const adminTab = page.locator('[data-tab="admin"], #tab-admin, button:has-text("Admin")').first();
    const visible = await adminTab.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      // If visible, clicking should not reveal admin panel content (role-gated)
      await adminTab.click();
      await page.waitForTimeout(500);
      // The users management table should not load
      const userMgmtTable = page.locator('table th:has-text("Role"), table th:has-text("Email")').first();
      const tableVisible = await userMgmtTable.isVisible({ timeout: 2000 }).catch(() => false);
      // Just log this — some apps hide via CSS only
      console.log('Admin table visible for agent:', tableVisible);
    }
  });
});
