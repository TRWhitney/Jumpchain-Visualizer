import { expect, test } from "./support/fixtures";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { shouldCaptureReviewArtifacts } from "./support/reviewArtifacts";

test(
  "loads the primary application shell at the root route",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Home · Jumpchain Visualizer");
    await expect(page.locator("#root")).toBeAttached();
    await expect(
      page.getByRole("heading", { name: "What would you like to do?" }),
    ).toBeVisible();

    const editorRecents = page.getByRole("region", {
      name: "Editor workspaces",
    });
    const chainRecents = page.getByRole("region", { name: "Chains" });
    await expect(
      editorRecents.locator(".app-recent-work.is-empty"),
    ).toHaveCount(1);
    await expect(editorRecents).toContainText("No Editor workspaces here.");
    await expect(editorRecents).toContainText(
      "Go to the Editor and create or import one to begin!",
    );
    await expect(chainRecents.locator(".app-recent-work.is-empty")).toHaveCount(
      1,
    );
    await expect(chainRecents).toContainText("No chains here.");
    await expect(chainRecents).toContainText(
      "Go to Chain Tracker and start a new one to begin!",
    );
    const editorBox = await editorRecents
      .locator(".app-recent-work.is-empty")
      .boundingBox();
    const chainBox = await chainRecents
      .locator(".app-recent-work.is-empty")
      .boundingBox();
    expect(editorBox).not.toBeNull();
    expect(chainBox).not.toBeNull();
    expect(editorBox!.height).toBeGreaterThanOrEqual(56);
    expect(chainBox!.height).toBe(editorBox!.height);

    if (shouldCaptureReviewArtifacts(testInfo)) {
      const screenshot = await page.screenshot({ animations: "disabled" });
      await testInfo.attach("home-empty-recent-cards", {
        body: screenshot,
        contentType: "image/png",
      });
      await writeFile(
        join(
          process.cwd(),
          "artifacts",
          "application-visual",
          "home-empty-recent-cards.png",
        ),
        screenshot,
      );
    }
  },
);

test("Home empty cards disappear when their first records are created", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Editor" }).click();
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await expect(
    page
      .getByRole("region", { name: "Editor workspaces" })
      .locator(".app-recent-work.is-empty"),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Chains" })
      .locator(".app-recent-work.is-empty"),
  ).toHaveCount(1);

  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  await page.getByPlaceholder("Chain name").fill("First Chain");
  await page.getByRole("button", { name: "Start Chain" }).click();
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await expect(
    page
      .getByRole("region", { name: "Chains" })
      .locator(".app-recent-work.is-empty"),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Chains" })).toContainText(
    "First Chain",
  );
});
