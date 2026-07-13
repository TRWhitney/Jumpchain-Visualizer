import { expect, test } from "@playwright/test";

test("loads the primary application shell at the root route", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Home · Jumpchain Visualizer");
  await expect(page.locator("#root")).toBeAttached();
  await expect(
    page.getByRole("heading", { name: "What would you like to do?" }),
  ).toBeVisible();
});
