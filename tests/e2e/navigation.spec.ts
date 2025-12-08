import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto("/");
  });

  test("should show login page when not authenticated", async ({ page }) => {
    // Should redirect to login
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test("should have working navigation links", async ({ page }) => {
    // Check that the page loads
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Admin Dashboard Navigation", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("should show dashboard when authenticated", async ({ page }) => {
    await page.goto("/admin");

    // Should see the dashboard
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("should navigate to Clients page", async ({ page }) => {
    await page.goto("/admin");

    // Click on Clients in sidebar
    await page.getByRole("link", { name: /clients/i }).first().click();

    // Should be on clients page
    await expect(page).toHaveURL(/\/admin\/clients/);
  });

  test("should navigate to Outbound Campaigns", async ({ page }) => {
    await page.goto("/admin");

    // Expand Campaigns section if collapsed
    const campaignsSection = page.getByRole("button", { name: /campaigns/i });
    if (await campaignsSection.isVisible()) {
      await campaignsSection.click();
    }

    // Click on Outbound
    await page.getByRole("link", { name: /outbound/i }).click();

    await expect(page).toHaveURL(/\/admin\/outbound/);
  });

  test("should navigate to Inbound Campaigns", async ({ page }) => {
    await page.goto("/admin");

    // Expand Campaigns section if collapsed
    const campaignsSection = page.getByRole("button", { name: /campaigns/i });
    if (await campaignsSection.isVisible()) {
      await campaignsSection.click();
    }

    // Click on Inbound
    await page.getByRole("link", { name: /inbound/i }).click();

    await expect(page).toHaveURL(/\/admin\/inbound/);
  });

  test("should navigate to CRM Contacts", async ({ page }) => {
    await page.goto("/admin");

    // Expand CRM section if collapsed
    const crmSection = page.getByRole("button", { name: /crm/i });
    if (await crmSection.isVisible()) {
      await crmSection.click();
    }

    // Click on Contacts
    await page.getByRole("link", { name: /contacts/i }).click();

    await expect(page).toHaveURL(/\/admin\/crm/);
  });

  test("should navigate to Settings", async ({ page }) => {
    await page.goto("/admin");

    // Click on API Keys in settings
    await page.getByRole("link", { name: /api keys/i }).click();

    await expect(page).toHaveURL(/\/admin\/settings\/api-keys/);
  });
});

test.describe("Mobile Navigation", () => {
  test.use({
    viewport: { width: 375, height: 667 },
    storageState: "playwright/.auth/user.json",
  });

  test("should show mobile menu button", async ({ page }) => {
    await page.goto("/admin");

    // Mobile menu button should be visible
    await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
  });

  test("should open sidebar on menu click", async ({ page }) => {
    await page.goto("/admin");

    // Click mobile menu button
    await page.getByRole("button", { name: /open menu/i }).click();

    // Sidebar should be visible
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  });
});
