import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("Home matches the shell proposal and exposes explicit workspace choices and recents", async ({
  page,
}) => {
  const shell = page.getByLabel("Jumpchain Visualizer application");
  await expect(shell).toBeVisible();
  await expect(
    shell.getByRole("button", { name: "Jumpchain Visualizer" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(shell.getByRole("button", { name: "Settings" })).toBeEnabled();
  await expect(shell.locator(".app-entry-grid > article")).toHaveCount(2);
  await expect(
    shell.getByRole("heading", { name: "Start a Chain" }),
  ).toBeVisible();
  await expect(
    shell.getByRole("region", { name: "Editor workspaces" }),
  ).toContainText("Example Jump");
  await expect(shell.getByRole("region", { name: "Chains" })).toContainText(
    "Morgan",
  );
  await expect(
    shell.getByRole("region", { name: "Chains" }).locator(".app-recent-work"),
  ).toHaveCount(1);
  await expect(
    shell.getByLabel("Application location").locator("code"),
  ).toHaveText("/");
});

test("workspace navigation uses real paths, history, titles, and predictable focus", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open Editor" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page).toHaveTitle("Editor · Jumpchain Visualizer");
  await expect(
    page.getByRole("heading", { name: "Create or open a Jump package" }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Open Example Jump" }).click();
  await expect(page).toHaveURL(/\/editor\/ws-7f3a$/);
  await expect(page).toHaveTitle("Example Jump · Editor");
  await expect(
    page.getByRole("heading", { name: "Example Jump" }),
  ).toBeFocused();

  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  await expect(page).toHaveURL(/\/chain$/);
  await expect(
    page.getByRole("heading", { name: "Your chains" }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/editor\/ws-7f3a$/);
  await expect(
    page.getByRole("heading", { name: "Example Jump" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Forward" }).click();
  await expect(page).toHaveURL(/\/chain$/);
});

test("recent work opens addressable Editor and real Chain Tracker workspaces", async ({
  page,
}) => {
  await page
    .getByRole("region", { name: "Editor workspaces" })
    .getByRole("button", { name: "Resume" })
    .click();
  await expect(page).toHaveURL(/\/editor\/ws-7f3a$/);
  await expect(
    page.getByText("The established three-pane Editor will mount here."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/chain\/ch-92b1$/);
  const tracker = page.getByLabel("Interactive Chain Tracker workspace");
  await expect(tracker).toBeVisible();
  await expect(tracker.locator(".chain-mock-header")).toHaveCount(0);
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Chain Tracker", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("returning to the mounted chain restores its internal workspace state", async ({
  page,
}) => {
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  const tracker = page.getByLabel("Interactive Chain Tracker workspace");
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByRole("button", { name: "Items", exact: true }).click();

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  await expect(
    tracker.getByRole("tab", { name: /^Inventory/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    tracker.getByRole("button", { name: "Items", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the Chain Tracker hub lists all chains and supports create and rename flows", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open Chain Tracker" }).click();
  await expect(page).toHaveURL(/\/chain$/);
  await expect(
    page.getByRole("heading", { name: "Your chains" }),
  ).toBeFocused();
  await expect(page.locator(".app-chain-card")).toHaveCount(1);
  await expect(page.locator(".app-chain-card").first()).toContainText("Morgan");

  await page.getByLabel("Start a new chain").fill("  Lantern   Road  ");
  await page.getByRole("button", { name: "Start Chain" }).click();
  await expect(page).toHaveURL(/\/chain\/ch-new-1$/);
  await expect(page).toHaveTitle("Lantern Road · Chain Tracker");
  await expect(
    page.getByLabel("Interactive Chain Tracker workspace"),
  ).toContainText("Lantern Road");

  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  await expect(page.locator(".app-chain-card").first()).toContainText(
    "Lantern Road",
  );
  await page.getByRole("button", { name: "Edit Lantern Road" }).click();
  const editingCard = page.locator(".app-chain-card.is-editing");
  const neighboringCard = page
    .locator(".app-chain-card")
    .filter({ hasText: "Morgan" });
  const [editingBox, neighboringBox, listBox] = await Promise.all([
    editingCard.boundingBox(),
    neighboringCard.boundingBox(),
    page.locator(".app-chain-card-list").boundingBox(),
  ]);
  expect(editingBox).not.toBeNull();
  expect(neighboringBox).not.toBeNull();
  expect(listBox).not.toBeNull();
  expect(editingBox!.width).toBeLessThan(listBox!.width * 0.6);
  expect(neighboringBox!.x).toBeGreaterThan(editingBox!.x + editingBox!.width);
  const rename = page.getByLabel("Chain name");
  await expect(rename).toBeFocused();
  await rename.fill("Lantern Sea");
  await page
    .getByLabel("Description")
    .fill("A luminous route through unfamiliar seas.");
  const saveBox = await page
    .getByRole("button", { name: "Save" })
    .boundingBox();
  expect(saveBox).not.toBeNull();
  expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(
    editingBox!.x + editingBox!.width,
  );
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(
    editingBox!.y + editingBox!.height,
  );
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "Lantern Sea" }),
  ).toBeVisible();
  await expect(
    page.getByText("A luminous route through unfamiliar seas."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  const homeChains = page.getByRole("region", { name: "Chains" });
  await expect(homeChains.locator(".app-recent-work")).toHaveCount(2);
  await expect(homeChains.locator(".app-recent-work").first()).toContainText(
    "Lantern Sea",
  );
});

test("saved-chain search and radar summaries preserve the fixed hub", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open Chain Tracker" }).click();
  const hubHeading = page.getByRole("heading", { name: "Your chains" });
  const createBlock = page.locator(".app-new-chain");
  const list = page.locator(".app-chain-card-list");
  const headingTop = await hubHeading.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const createTop = await createBlock.evaluate(
    (element) => element.getBoundingClientRect().top,
  );

  await expect(page.locator(".app-chain-card")).toHaveCount(1);
  expect(
    await hubHeading.evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(headingTop);
  expect(
    await createBlock.evaluate(
      (element) => element.getBoundingClientRect().top,
    ),
  ).toBe(createTop);
  expect(await list.evaluate((element) => element.scrollTop)).toBe(0);
  expect(
    await page
      .locator(".app-primary-views")
      .evaluate((element) => element.scrollTop),
  ).toBe(0);

  const search = page.getByLabel("Search saved chains");
  await search.fill("three-jump demonstration");
  await expect(page.locator(".app-chain-card")).toHaveCount(1);
  await expect(page.locator(".app-chain-card")).toContainText("Morgan");
  await search.fill("no such expedition");
  await expect(page.getByRole("status")).toContainText("No saved chains match");
  await search.fill("");

  const summaryTrigger = page.getByRole("button", {
    name: "Show Morgan tag summary",
  });
  await summaryTrigger.hover();
  const summary = page.getByRole("tooltip");
  await expect(summary).toBeVisible();
  await expect(
    summary.getByRole("img", { name: "Morgan perk category radar" }),
  ).toBeVisible();
  const previewLabels = summary.locator(".radar-label");
  await expect(previewLabels).toHaveCount(12);
  expect(
    await previewLabels
      .first()
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
  ).toBeGreaterThanOrEqual(22);
  expect(
    new Set(
      await previewLabels.evaluateAll((labels) =>
        labels.map((label) => getComputedStyle(label).fill),
      ),
    ).size,
  ).toBeGreaterThan(6);
  await expect(summary).toContainText("Strongest category:");
  expect(
    await summary.evaluate(
      (element) => getComputedStyle(element).pointerEvents,
    ),
  ).toBe("none");
  await page.mouse.move(900, 300);
  await expect(summary).toBeHidden();
  await summaryTrigger.focus();
  await expect(summary).toBeVisible();
  await expect(
    page.locator(".app-chain-card-copy h3.is-primary-tag-colored"),
  ).toHaveCount(0);
});

test("unknown workspace IDs recover inside their owning hub and unknown routes do not fall home", async ({
  page,
}) => {
  await page.goto("/chain/not-a-local-record");
  await expect(page).toHaveTitle("Chain unavailable · Jumpchain Visualizer");
  await expect(
    page.getByRole("heading", { name: "Chain unavailable" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-active-route="true"]').getByText("not-a-local-record"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Chain Tracker", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Return to Chain Tracker" }).click();
  await expect(page).toHaveURL(/\/chain$/);

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Preferences" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Application Settings" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/settings$/);
});

test("the narrow shell follows the proposal without clipping navigation or recent actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 620, height: 900 });
  const shell = page.getByLabel("Jumpchain Visualizer application");
  await expect(
    shell.getByRole("button", { name: "Editor", exact: true }),
  ).toBeVisible();
  await expect(
    shell.getByRole("button", { name: "Chain Tracker", exact: true }),
  ).toBeVisible();
  await expect(
    shell
      .getByRole("region", { name: "Chains" })
      .getByRole("button", {
        name: "Resume",
      })
      .first(),
  ).toBeVisible();

  await shell.getByRole("button", { name: "Open Chain Tracker" }).click();
  const finalChain = page.locator(".app-chain-card").last();
  await finalChain.scrollIntoViewIfNeeded();
  await expect(finalChain).toContainText("Morgan");
  await expect(
    finalChain.getByRole("button", { name: "Edit Morgan" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test("review fixtures remain direct-only development routes", async ({
  page,
}) => {
  await page.goto("/review/chain-tracker");
  await expect(
    page.getByText("Dense deterministic review fixture"),
  ).toBeVisible();
  await expect(page.getByLabel("Jumpchain Visualizer application")).toHaveCount(
    0,
  );
});
