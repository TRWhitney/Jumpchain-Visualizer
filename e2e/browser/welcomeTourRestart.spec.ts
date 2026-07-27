import { expect, test } from "./support/fixtures";

test("a Settings restart can keep an existing custom interface configuration", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const preference = page.getByLabel("Hide raw technical locations");
  await preference.check();
  await page.getByRole("button", { name: "Restart welcome tour" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Welcome to Jumpchain Visualizer",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exit tour" }).click();
  const keep = page.getByRole("button", {
    name: "Keep my current settings",
  });
  await expect(keep).toBeVisible();
  await keep.click();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("Hide raw technical locations")).toBeChecked();
});

test("the reduced Motion setting removes welcome-tour spotlight movement", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Accessibility" }).click();
  await page.getByLabel("Motion", { exact: true }).selectOption("reduced");
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-motion",
    "reduced",
  );
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByRole("button", { name: "Restart welcome tour" }).click();

  await page.getByRole("button", { name: "Start tour" }).click();
  const spotlight = page.locator(".welcome-tour-spotlight");
  await expect(spotlight).toBeVisible();
  await expect(spotlight).toHaveCSS("transition-duration", "0s");
});
