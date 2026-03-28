import { test, expect } from "@playwright/test";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads the dashboard with header and main content", async ({ page }) => {
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText("RescueGrid AI")).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("shows ready state with empty state message", async ({ page }) => {
    await expect(page.getByText("Ready to Analyze")).toBeVisible();
    await expect(
      page.getByText("Upload a field report, photo, voice note, or news link")
    ).toBeVisible();
  });

  test("has a disabled analyze button when no input is provided", async ({
    page,
  }) => {
    const button = page.locator("#analyze-button");
    await expect(button).toBeDisabled();
  });

  test("enables analyze button when text is entered", async ({ page }) => {
    const textarea = page.locator("#report-text");
    await textarea.fill("Fire near the downtown area, heavy smoke visible");

    const button = page.locator("#analyze-button");
    await expect(button).toBeEnabled();
  });

  test("allows adding news URLs", async ({ page }) => {
    const urlInput = page.getByLabel("Add news URL");
    await urlInput.fill("https://news.example.com/wildfire-update");
    await page.getByLabel("Add URL").click();

    await expect(
      page.getByText("https://news.example.com/wildfire-update")
    ).toBeVisible();
  });

  test("rejects invalid URLs", async ({ page }) => {
    const urlInput = page.getByLabel("Add news URL");
    await urlInput.fill("not-a-valid-url");

    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("valid URL");
      await dialog.accept();
    });

    await page.getByLabel("Add URL").click();
  });

  test("shows character counter for text input", async ({ page }) => {
    const textarea = page.locator("#report-text");
    await textarea.fill("Test input");

    await expect(page.getByText("10/5000 characters")).toBeVisible();
  });

  test("has a skip-to-content link for accessibility", async ({ page }) => {
    const skipLink = page.getByText("Skip to main content");
    await expect(skipLink).toBeAttached();
  });

  test("displays system status as Live", async ({ page }) => {
    await expect(page.getByText("Live")).toBeVisible();
  });
});

test.describe("Health Endpoint", () => {
  test("returns a health check response", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body.status).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.uptime_ms).toBeGreaterThanOrEqual(0);
  });
});
