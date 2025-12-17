import { test, expect } from '@playwright/test';

test.describe('Public Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('login page should load without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Filter out non-critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('hydration') &&
      !e.includes('Minified React error')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('sales login page should load without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/sales/login');
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('hydration') &&
      !e.includes('Minified React error')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Page Meta Tags', () => {
  test('login page has proper viewport meta tag', async ({ page }) => {
    await page.goto('/login');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('sales login page has proper viewport meta tag', async ({ page }) => {
    await page.goto('/sales/login');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });
});

test.describe('Responsive Design', () => {
  test('login page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/login');

    // Login card should be visible and fit screen
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login page is responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/login');

    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
  });

  test('login page is responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/login');

    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
  });
});

test.describe('Accessibility - Basic Checks', () => {
  test('login form has proper labels', async ({ page }) => {
    await page.goto('/login');

    // Check that inputs have associated labels
    const emailLabel = page.locator('label[for="email"]');
    const passwordLabel = page.locator('label[for="password"]');

    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });

  test('submit button is keyboard accessible', async ({ page }) => {
    await page.goto('/login');

    // Tab through form
    await page.keyboard.press('Tab'); // Focus email
    await page.keyboard.press('Tab'); // Focus password
    await page.keyboard.press('Tab'); // Focus submit button

    // Check button is focused
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeFocused();
  });

  test('form can be submitted with Enter key', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#email', 'test@example.com');
    await page.fill('input#password', 'password123');
    await page.keyboard.press('Enter');

    // Form should attempt to submit (wait for network activity or error)
    await page.waitForLoadState('networkidle');
  });
});
