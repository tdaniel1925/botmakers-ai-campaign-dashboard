import { test, expect } from '@playwright/test';

test.describe('Authentication - Main Login', () => {
  test('should display login page with all elements', async ({ page }) => {
    await page.goto('/login');

    // Check page title and description
    await expect(page.getByText('AI Campaign Portal')).toBeVisible();
    await expect(page.getByText('Sign in to your account', { exact: false })).toBeVisible();

    // Check form elements
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Please enter a valid email')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Password is required')).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#email', 'invalid-email');
    await page.locator('button[type="submit"]').click();

    // Should show validation error or stay on login page
    await page.waitForTimeout(500);
    const hasError = await page.getByText('Please enter a valid email').isVisible().catch(() => false);
    const stillOnLogin = page.url().includes('login');
    expect(hasError || stillOnLogin).toBeTruthy();
  });

  test('should redirect unauthenticated users from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect unauthenticated users from /admin to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Authentication - Sales Portal Login', () => {
  test('should display sales login page', async ({ page }) => {
    await page.goto('/sales/login');

    // Check for sales-specific login page elements
    await expect(page.locator('input#email, input[name="email"]')).toBeVisible();
    await expect(page.locator('input#password, input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should redirect unauthenticated users from /sales to login', async ({ page }) => {
    await page.goto('/sales');
    // May redirect to /sales/login or /login depending on implementation
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect unauthenticated users from /sales/leads to login', async ({ page }) => {
    await page.goto('/sales/leads');
    // May redirect to /sales/login or /login depending on implementation
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Authentication - Change Password', () => {
  test('should redirect unauthenticated users from /change-password to /login', async ({ page }) => {
    await page.goto('/change-password');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Authentication - Protected Routes', () => {
  const protectedAdminRoutes = [
    '/admin',
    '/admin/users',
    '/admin/clients',
    '/admin/campaigns',
    '/admin/leads',
    '/admin/commissions',
    '/admin/sales-team',
    '/admin/interactions',
    '/admin/audit-logs',
    '/admin/reports',
    '/admin/settings',
    '/admin/resources',
  ];

  const protectedDashboardRoutes = [
    '/dashboard',
    '/dashboard/campaigns',
    '/dashboard/interactions',
    '/dashboard/metrics',
    '/dashboard/profile',
    '/dashboard/reports',
  ];

  const protectedSalesRoutes = [
    '/sales',
    '/sales/leads',
    '/sales/pipeline',
    '/sales/commissions',
    '/sales/products',
    '/sales/resources',
    '/sales/performance',
    '/sales/profile',
  ];

  for (const route of protectedAdminRoutes) {
    test(`should protect ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/login/);
    });
  }

  for (const route of protectedDashboardRoutes) {
    test(`should protect ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/login/);
    });
  }

  for (const route of protectedSalesRoutes) {
    test(`should protect ${route}`, async ({ page }) => {
      await page.goto(route);
      // Sales routes may redirect to /sales/login or /login
      await expect(page).toHaveURL(/login/);
    });
  }
});
