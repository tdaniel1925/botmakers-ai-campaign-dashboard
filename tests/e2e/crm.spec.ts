import { test, expect } from "@playwright/test";

test.describe("CRM Contacts", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("should load CRM page", async ({ page }) => {
    await page.goto("/admin/crm");

    // Should see the page header
    await expect(page.getByRole("heading", { name: /contacts|crm/i })).toBeVisible();
  });

  test("should have filter options", async ({ page }) => {
    await page.goto("/admin/crm");

    // Should have client filter
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("should show add contact button", async ({ page }) => {
    await page.goto("/admin/crm");

    // Should have button to add contact
    await expect(page.getByRole("link", { name: /add|new|create/i })).toBeVisible();
  });

  test("should navigate to new contact form", async ({ page }) => {
    await page.goto("/admin/crm");

    // Click add contact button
    await page.getByRole("link", { name: /add|new/i }).click();

    // Should be on new contact page
    await expect(page).toHaveURL(/\/admin\/crm\/new/);
  });

  test("should show import button", async ({ page }) => {
    await page.goto("/admin/crm");

    // Should have import button
    await expect(page.getByRole("link", { name: /import/i })).toBeVisible();
  });

  test("should navigate to import page", async ({ page }) => {
    await page.goto("/admin/crm");

    // Click import button
    await page.getByRole("link", { name: /import/i }).click();

    // Should be on import page
    await expect(page).toHaveURL(/\/admin\/crm\/import/);
  });
});

test.describe("CRM Contact Form", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("should load new contact form", async ({ page }) => {
    await page.goto("/admin/crm/new");

    // Should see form fields
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/phone/i)).toBeVisible();
  });

  test("should validate required fields", async ({ page }) => {
    await page.goto("/admin/crm/new");

    // Try to submit empty form
    await page.getByRole("button", { name: /save|create/i }).click();

    // Should show validation error
    await expect(page.getByText(/required/i)).toBeVisible();
  });

  test("should have client selection", async ({ page }) => {
    await page.goto("/admin/crm/new");

    // Should have client dropdown
    await expect(page.getByLabel(/client/i)).toBeVisible();
  });
});

test.describe("CRM Import", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("should load import page", async ({ page }) => {
    await page.goto("/admin/crm/import");

    // Should see import header
    await expect(page.getByRole("heading", { name: /import/i })).toBeVisible();
  });

  test("should show file upload area", async ({ page }) => {
    await page.goto("/admin/crm/import");

    // Should have file input or upload area
    await expect(page.getByText(/csv|upload|drop/i)).toBeVisible();
  });

  test("should show sample format", async ({ page }) => {
    await page.goto("/admin/crm/import");

    // Should show expected columns
    await expect(page.getByText(/phone|name|email/i)).toBeVisible();
  });
});
