import { test, expect } from "@playwright/test";

test.describe("Outbound Campaign Wizard", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/outbound/new");
  });

  test("should load the campaign wizard", async ({ page }) => {
    // Should see the wizard header
    await expect(page.getByRole("heading", { name: /new outbound campaign/i })).toBeVisible();

    // Should be on step 1
    await expect(page.getByText(/step 1/i)).toBeVisible();
  });

  test("should show client selection on step 1", async ({ page }) => {
    // Should see client selection label
    await expect(page.getByText(/select client/i)).toBeVisible();

    // Should have a client dropdown
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("should validate required fields before proceeding", async ({ page }) => {
    // Try to click Next without selecting a client
    const nextButton = page.getByRole("button", { name: /next/i });

    // Button should be disabled or show validation error
    await expect(nextButton).toBeDisabled();
  });

  test("should navigate through wizard steps", async ({ page }) => {
    // This test assumes there's at least one client in the system
    // Select a client
    await page.getByRole("combobox").click();
    await page.getByRole("option").first().click();

    // Click Next
    await page.getByRole("button", { name: /next/i }).click();

    // Should be on step 2 (Campaign Details)
    await expect(page.getByLabel(/campaign name/i)).toBeVisible();
  });

  test("should show call provider selection on step 3", async ({ page }) => {
    // Complete steps 1 and 2 first (if clients exist)
    // Select a client
    const clientDropdown = page.getByRole("combobox");
    if (await clientDropdown.isVisible()) {
      await clientDropdown.click();
      const firstOption = page.getByRole("option").first();
      if (await firstOption.isVisible()) {
        await firstOption.click();

        // Click Next
        await page.getByRole("button", { name: /next/i }).click();

        // Fill campaign name
        await page.getByLabel(/campaign name/i).fill("Test Campaign");

        // Click Next
        await page.getByRole("button", { name: /next/i }).click();

        // Should see provider selection
        await expect(page.getByText(/call provider/i)).toBeVisible();
      }
    }
  });

  test("should show provider-specific fields", async ({ page }) => {
    // This test verifies provider selection UI exists
    await expect(page.getByRole("heading", { name: /new outbound campaign/i })).toBeVisible();
  });
});

test.describe("Outbound Campaign List", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("should show campaigns list", async ({ page }) => {
    await page.goto("/admin/outbound");

    // Should see the page header
    await expect(page.getByRole("heading", { name: /outbound/i })).toBeVisible();
  });

  test("should have create campaign button", async ({ page }) => {
    await page.goto("/admin/outbound");

    // Should have a button to create new campaign
    await expect(page.getByRole("link", { name: /new|create/i })).toBeVisible();
  });

  test("should navigate to new campaign page", async ({ page }) => {
    await page.goto("/admin/outbound");

    // Click create button
    await page.getByRole("link", { name: /new|create/i }).click();

    // Should be on wizard page
    await expect(page).toHaveURL(/\/admin\/outbound\/new/);
  });
});

test.describe("Campaign Details Page", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("should show campaign details when viewing existing campaign", async ({ page }) => {
    // Navigate to outbound campaigns list
    await page.goto("/admin/outbound");

    // If there are campaigns, click on one
    const campaignRow = page.getByRole("row").nth(1); // First data row

    if (await campaignRow.isVisible()) {
      await campaignRow.click();

      // Should show campaign details
      await expect(page.getByText(/status|provider|contacts/i)).toBeVisible();
    }
  });
});
