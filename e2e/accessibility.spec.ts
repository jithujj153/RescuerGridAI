import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility", () => {
  test("homepage has no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("#main-content");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude(".map-container__map") // Google Maps manages its own a11y
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (critical.length > 0) {
      const summary = critical.map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`
      );
      console.log("A11y violations:", summary);
    }

    expect(critical).toHaveLength(0);
  });

  test("page has a valid lang attribute", async ({ page }) => {
    await page.goto("/");
    const lang = await page.getAttribute("html", "lang");
    expect(lang).toBe("en");
  });

  test("all images have alt text", async ({ page }) => {
    await page.goto("/");
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt).toBeTruthy();
    }
  });

  test("interactive elements are keyboard accessible", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByText("Skip to main content");
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });

  test("buttons have accessible labels", async ({ page }) => {
    await page.goto("/");

    const buttons = page.locator("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute("aria-label");
      const textContent = await button.textContent();
      const hasLabel = (ariaLabel && ariaLabel.length > 0) || (textContent && textContent.trim().length > 0);
      expect(hasLabel).toBe(true);
    }
  });
});
