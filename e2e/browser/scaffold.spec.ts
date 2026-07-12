import { expect, test } from "@playwright/test";

test("loads the browser application scaffold", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Jumpchain Visualizer");
  await expect(page.locator("#root")).toBeAttached();
});
