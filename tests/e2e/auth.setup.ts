import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

/**
 * Authentication setup for E2E tests
 * This runs before all tests to establish an authenticated session
 */
setup("authenticate", async ({ page }) => {
  // Navigate to login page
  await page.goto("/login");

  // Wait for the login form to be visible
  await expect(page.getByRole("heading", { name: /sign in|login/i })).toBeVisible();

  // Fill in credentials (use test credentials from environment)
  const testEmail = process.env.TEST_USER_EMAIL || "admin@example.com";
  const testPassword = process.env.TEST_USER_PASSWORD || "testpassword123";

  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/password/i).fill(testPassword);

  // Submit the form
  await page.getByRole("button", { name: /sign in|login/i }).click();

  // Wait for redirect to admin dashboard
  await page.waitForURL("/admin**", { timeout: 30000 });

  // Verify we're logged in
  await expect(page).toHaveURL(/\/admin/);

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
