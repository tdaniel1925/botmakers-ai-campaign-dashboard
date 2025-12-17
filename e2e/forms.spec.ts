import { test, expect } from '@playwright/test';

test.describe('Login Form Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('email field accepts valid email', async ({ page }) => {
    await page.fill('input#email', 'valid@example.com');
    const value = await page.inputValue('input#email');
    expect(value).toBe('valid@example.com');
  });

  test('email field has email type for mobile keyboards', async ({ page }) => {
    const type = await page.locator('input#email').getAttribute('type');
    expect(type).toBe('email');
  });

  test('password field is masked', async ({ page }) => {
    const type = await page.locator('input#password').getAttribute('type');
    expect(type).toBe('password');
  });

  test('password field has autocomplete attribute', async ({ page }) => {
    const autocomplete = await page.locator('input#password').getAttribute('autocomplete');
    expect(autocomplete).toBe('current-password');
  });

  test('email field has autocomplete attribute', async ({ page }) => {
    const autocomplete = await page.locator('input#email').getAttribute('autocomplete');
    expect(autocomplete).toBe('email');
  });

  test('form has novalidate or uses custom validation', async ({ page }) => {
    // Click submit and check for custom validation
    await page.locator('button[type="submit"]').click();

    // Custom validation should show - check for various validation messages
    await page.waitForTimeout(500);
    const hasValidation = await page.getByText(/valid email|required|enter/i).first().isVisible().catch(() => false);
    const buttonDisabled = await page.locator('button[type="submit"]').isDisabled().catch(() => false);

    // Either validation message shows or form is processing
    expect(hasValidation || buttonDisabled).toBeTruthy();
  });

  test('submit button shows loading state', async ({ page }) => {
    await page.fill('input#email', 'test@example.com');
    await page.fill('input#password', 'password123');

    // Start watching for loading state
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Button should be disabled or show loading
    // Wait a moment for state change
    await page.waitForTimeout(100);

    const isDisabled = await submitButton.isDisabled();
    const hasLoadingText = await page.locator('text=/signing in|loading/i').isVisible().catch(() => false);
    const hasSpinner = await page.locator('[class*="animate-spin"], [class*="spinner"]').isVisible().catch(() => false);

    expect(isDisabled || hasLoadingText || hasSpinner).toBeTruthy();
  });

  test('form prevents double submission', async ({ page }) => {
    await page.fill('input#email', 'test@example.com');
    await page.fill('input#password', 'password123');

    const submitButton = page.locator('button[type="submit"]');

    // Click multiple times rapidly
    await submitButton.click();
    await submitButton.click();
    await submitButton.click();

    // Button should be disabled after first click
    await page.waitForTimeout(100);
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBeTruthy();
  });
});

test.describe('Sales Login Form Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales/login');
  });

  test('displays login form elements', async ({ page }) => {
    await expect(page.locator('input#email, input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows validation on empty submit', async ({ page }) => {
    await page.locator('button[type="submit"]').click();

    // Should show validation or stay on page (may redirect to /login)
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).toMatch(/login/);
  });
});

test.describe('Form Input Interactions', () => {
  test('Tab navigation works through form', async ({ page }) => {
    await page.goto('/login');

    // Press tab to navigate
    await page.keyboard.press('Tab');

    // Email should be focused
    const emailFocused = await page.locator('input#email').evaluate(
      el => document.activeElement === el
    );
    expect(emailFocused).toBeTruthy();
  });

  test('Enter key submits form when in password field', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#email', 'test@example.com');
    await page.fill('input#password', 'password123');

    // Press enter in password field
    await page.locator('input#password').press('Enter');

    // Form should submit (button becomes disabled or page navigates)
    await page.waitForTimeout(100);
    const submitButton = page.locator('button[type="submit"]');
    const isDisabled = await submitButton.isDisabled();

    // Either button is disabled (submitting) or page changed
    expect(isDisabled || !page.url().includes('login')).toBeTruthy();
  });

  test('Escape key does not clear form', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#email', 'test@example.com');
    await page.keyboard.press('Escape');

    const value = await page.inputValue('input#email');
    expect(value).toBe('test@example.com');
  });
});

test.describe('Form Placeholder Text', () => {
  test('email field has placeholder', async ({ page }) => {
    await page.goto('/login');

    const placeholder = await page.locator('input#email').getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    // Placeholder could be "you@example.com" or contain "email"
    expect(placeholder?.toLowerCase()).toMatch(/email|@|example/);
  });

  test('password field has placeholder', async ({ page }) => {
    await page.goto('/login');

    const placeholder = await page.locator('input#password').getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });
});
