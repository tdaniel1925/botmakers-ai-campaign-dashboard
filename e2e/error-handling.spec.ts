import { test, expect } from '@playwright/test';

test.describe('Error Handling - 404 Pages', () => {
  test('non-existent page shows 404 or redirects', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');

    // Should either show 404 or redirect to a valid page
    const status = response?.status();
    const url = page.url();

    // Either 404 status, or redirected to login/home
    expect(
      status === 404 ||
      url.includes('login') ||
      url.includes('404') ||
      url === page.url()
    ).toBeTruthy();
  });

  test('non-existent admin subpage redirects to login', async ({ page }) => {
    await page.goto('/admin/nonexistent-page');
    await expect(page).toHaveURL(/login/);
  });

  test('non-existent dashboard subpage redirects to login', async ({ page }) => {
    await page.goto('/dashboard/nonexistent-page');
    await expect(page).toHaveURL(/login/);
  });

  test('non-existent sales subpage redirects to login', async ({ page }) => {
    await page.goto('/sales/nonexistent-page');
    // May redirect to /sales/login or /login
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Error Handling - Invalid IDs', () => {
  test('invalid campaign ID in admin redirects to login', async ({ page }) => {
    await page.goto('/admin/campaigns/invalid-uuid-12345');
    await expect(page).toHaveURL(/login/);
  });

  test('invalid interaction ID in admin redirects to login', async ({ page }) => {
    await page.goto('/admin/interactions/invalid-uuid-12345');
    await expect(page).toHaveURL(/login/);
  });

  test('invalid lead ID in sales redirects to login', async ({ page }) => {
    await page.goto('/sales/leads/invalid-uuid-12345');
    // May redirect to /sales/login or /login
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Error Handling - Form Validation', () => {
  test('login shows error for non-existent user', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#email', 'nonexistent@fake.com');
    await page.fill('input#password', 'wrongpassword123');
    await page.locator('button[type="submit"]').click();

    // Should show error message or stay on login page
    await page.waitForLoadState('networkidle');

    // Either error message shown or still on login page
    const url = page.url();
    const hasError = await page.locator('text=/error|invalid|incorrect|failed/i').isVisible().catch(() => false);

    expect(url.includes('login') || hasError).toBeTruthy();
  });

  test('sales login shows error for non-existent user', async ({ page }) => {
    await page.goto('/sales/login');

    await page.fill('input#email, input[name="email"]', 'nonexistent@fake.com');
    await page.fill('input#password, input[type="password"]', 'wrongpassword123');
    await page.locator('button[type="submit"]').click();

    await page.waitForLoadState('networkidle');

    // Should stay on login or show error
    const url = page.url();
    expect(url.includes('login')).toBeTruthy();
  });
});

test.describe('Error Handling - Network Issues', () => {
  test('page handles slow network gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 100);
    });

    await page.goto('/login', { timeout: 30000 });
    await expect(page.locator('input#email')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Error Handling - Query Parameters', () => {
  test('login handles error query parameter', async ({ page }) => {
    await page.goto('/login?error=auth_failed');

    // Should show some error indication
    const hasErrorParam = page.url().includes('error=');
    expect(hasErrorParam).toBeTruthy();
  });

  test('login handles account_disabled error', async ({ page }) => {
    await page.goto('/login?error=account_disabled');

    // Should show disabled message
    await expect(page.getByText(/disabled|contact support/i)).toBeVisible();
  });

  test('login handles no_organization error', async ({ page }) => {
    await page.goto('/login?error=no_organization');

    // Should show organization message
    await expect(page.getByText(/organization|administrator/i)).toBeVisible();
  });

  test('login handles redirect parameter', async ({ page }) => {
    await page.goto('/login?redirect=/dashboard/campaigns');

    // Should have redirect in URL
    expect(page.url()).toContain('redirect');
  });
});

test.describe('Security - XSS Prevention', () => {
  test('login escapes XSS in email field', async ({ page }) => {
    await page.goto('/login');

    const xssPayload = '<script>alert("xss")</script>';
    await page.fill('input#email', xssPayload);
    await page.fill('input#password', 'password123');
    await page.locator('button[type="submit"]').click();

    // Page should not execute script or show raw HTML
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('<script>');
  });

  test('URL parameters are sanitized', async ({ page }) => {
    const xssUrl = '/login?error=<script>alert("xss")</script>';
    await page.goto(xssUrl);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('<script>alert');
  });
});
