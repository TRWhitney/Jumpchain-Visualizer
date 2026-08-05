import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "./support/fixtures";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync } from "fflate";
import {
  reviewArtifactsEnabled,
  shouldCaptureReviewArtifacts,
} from "./support/reviewArtifacts";
import { waitForStoredSetting } from "./support/storedSettings";

test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/review/chain-tracker");
});

const trackerFor = (page: Page) =>
  page.getByLabel("Interactive Chain Tracker workspace");

async function attachScreenshot(
  testInfo: TestInfo,
  name: string,
  locator: Locator,
) {
  if (!shouldCaptureReviewArtifacts(testInfo)) return;
  await testInfo.attach(name, {
    body: await locator.screenshot(),
    contentType: "image/png",
  });
}

async function holdAssetResponse(page: Page, url: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    const response = await route.fetch();
    await released;
    await route.fulfill({ response });
  });
  return release;
}

async function holdAssetAfterFirstResponse(page: Page, url: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let responseCount = 0;
  await page.route(url, async (route) => {
    const response = await route.fetch();
    responseCount += 1;
    if (responseCount > 1) await released;
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "cache-control": "no-store",
      },
    });
  });
  return release;
}

async function writeImportArchive(
  testInfo: TestInfo,
  fileName: string,
  version: string,
  description: string,
) {
  const definition = `jump
  format: 1
  name: "Import Identity Fixture"
  description: "${description}"
  author: "Fixture Author"
  version: "${version}"

section
  handle: introduction
  name: "Introduction"
`;
  await mkdir(testInfo.outputDir, { recursive: true });
  const path = join(testInfo.outputDir, fileName);
  await writeFile(
    path,
    zipSync({ "jump.jdef": new TextEncoder().encode(definition) }),
  );
  return path;
}

async function writeAuthoredTagArchive(testInfo: TestInfo) {
  const definition = `jump
  format: 1
  name: "Authored Tag Fixture"
  author: "Fixture Author"
  version: "1.0"

section
  handle: content
  name: "Content"
  choice
    handle: tagged_placement
    target: tagged

choice
  handle: tagged
  name: "Profile-owned tag"
  tag: "Physical"
  layout: authored_card

choice-layout
  handle: authored_card
  stack
    background: "#404040"
    text-color: "#00ffff"
    slot: tags
    slot: control
`;
  await mkdir(testInfo.outputDir, { recursive: true });
  const path = join(testInfo.outputDir, "authored-tag-profile.jmp");
  await writeFile(
    path,
    zipSync({ "jump.jdef": new TextEncoder().encode(definition) }),
  );
  return path;
}

async function importTrackerPackage(page: Page, archivePath: string) {
  const tracker = trackerFor(page);
  await tracker
    .locator('input[type="file"][accept^=".jmp"]')
    .setInputFiles(archivePath);
  const review = page.getByRole("alertdialog");
  await expect(review).toContainText("Secure inspection complete");
  const digest = review.locator(".package-review-hash code");
  await expect(digest).toHaveCSS("color", "rgb(216, 216, 210)");
  await expect(digest).toHaveCSS("background-color", "rgb(34, 34, 32)");
  await review.getByRole("button", { name: "Import Project" }).click();
}

test(
  "renders one three-Jump Morgan chain and its evaluator-derived totals",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const tracker = trackerFor(page);
    await expect(tracker.locator(".chain-jump-entry")).toHaveCount(4);
    await expect(
      tracker.locator(".chain-rail-panel > header strong"),
    ).toHaveText("3 Jumps");
    await expect(tracker.getByRole("button", { name: /^Earth/ })).toContainText(
      "The Beginning",
    );
    await expect(tracker.getByRole("tab", { name: /^Forms/ })).toContainText(
      "1",
    );
    await expect(
      tracker.getByRole("tab", { name: /^Companions/ }),
    ).toContainText("4");
    const inventoryText = await tracker
      .getByRole("tab", { name: /^Inventory/ })
      .textContent();
    expect(Number(inventoryText?.match(/\d+/)?.[0])).toBe(27);
    await attachScreenshot(testInfo, "morgan-three-jump-chain", tracker);
  },
);

test("new-user Chain controls keep identity and history visible while compacting only actions and tag filters", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByRole("combobox", { name: "Interface experience" })
    .selectOption("beginner-friendly");
  await waitForStoredSetting(page, ["chain", "compactJumpActions"], true);
  await page.goto("/review/chain-tracker");
  const tracker = trackerFor(page);

  const more = tracker.getByRole("button", {
    name: "More actions for Threshold of a Thousand Roads",
  });
  await expect(more).toBeVisible();
  await more.click();
  const menu = page.getByRole("menu", {
    name: "Threshold of a Thousand Roads chain entry actions",
  });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Open",
    "Move later",
    "Move earlier",
    "Remove from chain…",
  ]);
  await page.keyboard.press("Escape");

  await tracker.getByRole("button", { name: /^Earth/ }).click();
  await expect(tracker.getByLabel("Earth gender")).toBeVisible();
  await expect(tracker.getByLabel("Earth age")).toBeVisible();
  await expect(
    tracker.getByText("Before Jump 1", { exact: true }),
  ).toBeVisible();

  await tracker.getByRole("button", { name: /3\. The Last Trial/ }).click();
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await expect(tracker.getByLabel("Inventory through")).toBeVisible();
  const tags = tracker.getByRole("button", { name: "Tags: All" });
  await expect(tags).toHaveAttribute("aria-expanded", "false");
  await expect(tracker.getByLabel("Tag search")).toHaveCount(0);
  await tags.click();
  await expect(tracker.getByLabel("Tag search")).toBeVisible();
  const firstTag = tracker.locator(".inventory-tag-select").first();
  const tagLabel = (await firstTag.locator("span").innerText()).replace(
    /^◆\s*/,
    "",
  );
  await firstTag.click();
  const activeTags = tracker.getByRole("button", {
    name: `Tags: ${tagLabel}`,
  });
  await expect(activeTags).toBeVisible();
  await activeTags.click();
  await expect(tracker.getByLabel("Tag search")).toHaveCount(0);
  await expect(activeTags).toBeVisible();
  await expect(tracker.getByLabel("Inventory through")).toBeVisible();
});

test("inventory tag filter setting updates the mounted tracker immediately", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Developer" }).click();
  await page.getByLabel("Show mock fixtures").check();
  await page.getByRole("button", { name: "Close Settings" }).click();
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  const tracker = page.getByLabel("Interactive Chain Tracker workspace");
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await expect(tracker.getByLabel("Tag search")).toBeVisible();
  await expect(tracker.getByRole("button", { name: "Tags: All" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  await page.getByLabel("Start inventory tag filters collapsed").check();
  await page.getByRole("button", { name: "Close Settings" }).click();

  await expect(tracker.getByLabel("Tag search")).toHaveCount(0);
  await expect(
    tracker.getByRole("button", { name: "Tags: All" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(tracker.getByLabel("Inventory through")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  await page.getByLabel("Start inventory tag filters collapsed").uncheck();
  await page.getByRole("button", { name: "Close Settings" }).click();

  await expect(tracker.getByLabel("Tag search")).toBeVisible();
  await expect(tracker.getByRole("button", { name: "Tags: All" })).toHaveCount(
    0,
  );
});

test("the Library contains exactly the three canonical packages", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await expect(tracker.locator(".chain-library-card")).toHaveCount(3);
  await expect(tracker.locator(".chain-library-list")).toContainText(
    "Threshold of a Thousand Roads",
  );
  await expect(tracker.locator(".chain-library-list")).toContainText(
    "The Confluence Engine",
  );
  await expect(tracker.locator(".chain-library-list")).toContainText(
    "The Last Trial",
  );
  await expect(
    tracker.locator(".chain-library-card").getByRole("button"),
  ).toHaveText(["Open chain entity", "Open chain entity", "Open chain entity"]);
  await attachScreenshot(testInfo, "three-package-library", tracker);
});

test("package imports enforce author-name-version identity and expose an adjacent removal action", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker?multipleVersions=off");
  const first = await writeImportArchive(
    testInfo,
    "identity-first.jmp",
    "1.0",
    "First archive bytes.",
  );
  const rebuilt = await writeImportArchive(
    testInfo,
    "identity-rebuilt.jmp",
    "1.0",
    "Different archive bytes for the same version.",
  );
  const secondVersion = await writeImportArchive(
    testInfo,
    "identity-second-version.jmp",
    "2.0",
    "A genuinely different version.",
  );
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();

  await importTrackerPackage(page, first);
  await expect(
    tracker.getByText(/Import Identity Fixture · v1\.0/),
  ).toHaveCount(1);

  await importTrackerPackage(page, rebuilt);
  let blocked = page.getByRole("alertdialog");
  await expect(blocked).toContainText("Package already installed");
  await expect(blocked).toContainText("version 1.0 is already installed");
  await blocked.getByRole("button", { name: "Close" }).click();
  await expect(
    tracker.getByText(/Import Identity Fixture · v1\.0/),
  ).toHaveCount(1);

  await importTrackerPackage(page, secondVersion);
  blocked = page.getByRole("alertdialog");
  await expect(blocked).toContainText("Allow second version is off");
  await blocked.getByRole("button", { name: "Close" }).click();

  const firstCard = tracker
    .getByText(/Import Identity Fixture · v1\.0/)
    .locator("xpath=ancestor::article");
  await firstCard.getByRole("button", { name: "Add to chain" }).click();
  await tracker.getByRole("tab", { name: "Library" }).click();
  const actions = firstCard.locator(".chain-library-actions");
  const open = actions.getByRole("button", { name: "Open chain entity" });
  const remove = actions.getByRole("button", {
    name: "Remove imported package Import Identity Fixture from the library",
  });
  const [openBounds, removeBounds] = await Promise.all([
    open.boundingBox(),
    remove.boundingBox(),
  ]);
  expect(openBounds).not.toBeNull();
  expect(removeBounds).not.toBeNull();
  expect(
    Math.abs(
      openBounds!.y +
        openBounds!.height / 2 -
        (removeBounds!.y + removeBounds!.height / 2),
    ),
  ).toBeLessThanOrEqual(1);
  expect(removeBounds!.x).toBeGreaterThan(openBounds!.x + openBounds!.width);
  expect(
    Math.abs(removeBounds!.height - openBounds!.height),
  ).toBeLessThanOrEqual(0.1);
  expect(
    Math.abs(removeBounds!.width - removeBounds!.height),
  ).toBeLessThanOrEqual(1);
  await expect(remove.locator("span")).toHaveCSS("font-size", "20px");
  await attachScreenshot(
    testInfo,
    "imported-package-adjacent-remove",
    firstCard,
  );

  await remove.click();
  const removal = page.getByRole("dialog", {
    name: "Remove Import Identity Fixture",
  });
  await expect(removal).toContainText("will also remove the 1 chain entity");
  await removal
    .getByRole("button", { name: "Remove package and 1 chain entity" })
    .click();
  await expect(
    tracker.getByText(/Import Identity Fixture · v1\.0/),
  ).toHaveCount(0);
  await expect(
    tracker.getByText(/Import Identity Fixture · v2\.0/),
  ).toHaveCount(0);
});

test("an imported authored Tag string always uses the active User Tag profile", async ({
  page,
}, testInfo) => {
  const renderedBadgeStyle = (locator: Locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        color: style.color,
        border: style.border,
        borderRadius: style.borderRadius,
        padding: style.padding,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        textDecoration: style.textDecoration,
        textShadow: style.textShadow,
      };
    });

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Tags" }).click();
  const profileBadge = page
    .locator(".tag-profile-preview-surface.is-dark .tag-profile-badge")
    .first();
  await expect(profileBadge).toContainText("Physical");
  const profileStyle = await renderedBadgeStyle(profileBadge);

  await page.goto("/review/chain-tracker");
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await importTrackerPackage(page, await writeAuthoredTagArchive(testInfo));
  const imported = tracker
    .getByText(/Authored Tag Fixture · v1\.0/)
    .locator("xpath=ancestor::article");
  await imported.getByRole("button", { name: "Add to chain" }).click();

  const authoredBadge = tracker
    .locator(".default-choice-tags .tag-profile-badge")
    .filter({ hasText: /^Physical$/ });
  await expect(authoredBadge).toBeVisible();
  expect(await renderedBadgeStyle(authoredBadge)).toEqual(profileStyle);
  await attachScreenshot(
    testInfo,
    "imported-authored-tag-uses-user-profile",
    tracker,
  );
});

test("Allow second version permits a different author-and-name package version", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker?multipleVersions=on");
  const first = await writeImportArchive(
    testInfo,
    "parallel-first.jmp",
    "1.0",
    "First permitted version.",
  );
  const second = await writeImportArchive(
    testInfo,
    "parallel-second.jmp",
    "2.0",
    "Second permitted version.",
  );
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await importTrackerPackage(page, first);
  await importTrackerPackage(page, second);
  await expect(
    tracker.getByText(/Import Identity Fixture · v[12]\.0/),
  ).toHaveCount(2);
});

test("renders and captures every canonical Format 1 Jump", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  const jumps = [
    [
      /1\. Threshold of a Thousand Roads/,
      "Threshold of a Thousand Roads",
      "threshold-full-render",
    ],
    [
      /2\. The Confluence Engine/,
      "The Confluence Engine",
      "confluence-full-render",
    ],
    [/3\. The Last Trial/, "The Last Trial", "last-trial-full-render"],
  ] as const;
  for (const [name, heading, artifact] of jumps) {
    await tracker.getByRole("button", { name }).click();
    const workspace = tracker.locator(
      ".chain-jump-workspace:not(.is-atomic-stage)",
    );
    await expect(workspace.locator(".chain-context-header h3")).toHaveText(
      heading,
    );
    const renderer = workspace.locator(".format-one-jump-renderer");
    await expect(renderer).toBeVisible();
    await attachScreenshot(testInfo, artifact, renderer);
  }
  await expect(
    tracker.getByRole("button", { name: "Native Gauntlet" }),
  ).toBeDisabled();
  await expect(tracker.getByText(/Gauntlet · Jump 3 of 3/)).toBeVisible();
});

test(
  "an image Jump switches atomically after its images decode",
  { tag: "@cross-browser" },
  async ({ page }, testInfo) => {
    const tracker = trackerFor(page);
    await tracker.getByRole("button", { name: /^Earth/ }).click();
    await expect(
      tracker.locator(
        ".chain-jump-workspace:not(.is-atomic-stage) .chain-context-header h3",
      ),
    ).toHaveText("Earth");
    const releaseImage = await holdAssetResponse(
      page,
      "**/assets/confluence-engine.svg",
    );

    await tracker
      .getByRole("button", { name: /2\. The Confluence Engine/ })
      .click();
    const activeWorkspace = tracker.locator(
      ".chain-jump-workspace:not(.is-atomic-stage)",
    );
    const stagedWorkspace = tracker.locator(
      ".chain-jump-workspace.is-atomic-stage",
    );
    await expect(
      activeWorkspace.getByRole("heading", { name: "Earth", level: 3 }),
    ).toBeVisible();
    await expect(stagedWorkspace.locator("h3")).toHaveText(
      "The Confluence Engine",
    );
    await expect(stagedWorkspace).toHaveAttribute("aria-hidden", "true");
    const stagedImage = stagedWorkspace
      .locator(
        '.format-one-jump-renderer img[src="/assets/confluence-engine.svg"]',
      )
      .first();
    expect(
      await stagedImage.evaluate(
        (element: HTMLImageElement) => element.complete,
      ),
    ).toBe(false);
    const stagedImageElement = await stagedImage.elementHandle();
    expect(stagedImageElement).not.toBeNull();
    await attachScreenshot(
      testInfo,
      "image-jump-held-until-decode",
      tracker.locator(".atomic-jump-switcher"),
    );

    releaseImage();
    await expect(
      activeWorkspace.getByRole("heading", {
        name: "The Confluence Engine",
        level: 3,
      }),
    ).toBeVisible();
    const image = activeWorkspace
      .locator(
        '.format-one-jump-renderer img[src="/assets/confluence-engine.svg"]',
      )
      .first();
    await expect
      .poll(() =>
        image.evaluate(
          (element: HTMLImageElement) =>
            element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(
      await stagedImageElement!.evaluate(
        (element: HTMLImageElement) =>
          element.isConnected &&
          element.complete &&
          element.naturalWidth > 0 &&
          !element
            .closest(".chain-jump-workspace")
            ?.classList.contains("is-atomic-stage"),
      ),
    ).toBe(true);
    await expect(stagedWorkspace).toHaveCount(0);
    await image.scrollIntoViewIfNeeded();
    await attachScreenshot(
      testInfo,
      "image-jump-revealed-after-decode",
      tracker.locator(".atomic-jump-switcher"),
    );
  },
);

test("a newer Jump selection cancels a stale staged promotion", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("button", { name: /^Earth/ }).click();
  await expect(
    tracker.locator(
      ".chain-jump-workspace:not(.is-atomic-stage) .chain-context-header h3",
    ),
  ).toHaveText("Earth");
  const releaseImage = await holdAssetResponse(
    page,
    "**/assets/confluence-engine.svg",
  );
  await tracker
    .getByRole("button", { name: /2\. The Confluence Engine/ })
    .click();
  const activeWorkspace = tracker.locator(
    ".chain-jump-workspace:not(.is-atomic-stage)",
  );
  const stagedWorkspace = tracker.locator(
    ".chain-jump-workspace.is-atomic-stage",
  );
  await expect(stagedWorkspace.locator(".chain-context-header h3")).toHaveText(
    "The Confluence Engine",
  );

  await tracker
    .getByRole("button", { name: /1\. Threshold of a Thousand Roads/ })
    .click();
  await expect(activeWorkspace.locator(".chain-context-header h3")).toHaveText(
    "Threshold of a Thousand Roads",
  );
  releaseImage();
  await expect(activeWorkspace.locator(".chain-context-header h3")).toHaveText(
    "Threshold of a Thousand Roads",
  );
  await expect(stagedWorkspace).toHaveCount(0);
});

test("returning from Inventory keeps an image Jump staged until decode", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  const releaseImage = await holdAssetAfterFirstResponse(
    page,
    "**/assets/confluence-engine.svg",
  );
  await tracker
    .getByRole("button", { name: /2\. The Confluence Engine/ })
    .evaluate((element: HTMLButtonElement) => element.click());
  const activeWorkspace = tracker.locator(
    ".chain-jump-workspace:not(.is-atomic-stage)",
  );
  await expect(activeWorkspace.locator(".chain-context-header h3")).toHaveText(
    "The Confluence Engine",
  );
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByRole("tab", { name: "Chain & Jump" }).click();

  const stagedWorkspace = tracker.locator(
    ".chain-jump-workspace.is-atomic-stage",
  );
  await expect
    .poll(
      async () =>
        (await activeWorkspace.count()) + (await stagedWorkspace.count()),
    )
    .toBe(1);
  if (await stagedWorkspace.count()) {
    await expect(activeWorkspace).toHaveCount(0);
    await expect(
      stagedWorkspace.locator(".chain-context-header h3"),
    ).toHaveText("The Confluence Engine");
    await expect(
      tracker.getByText("Preparing selected Jump…", { exact: true }),
    ).toBeVisible();
    const stagedImage = stagedWorkspace
      .locator('img[src="/assets/confluence-engine.svg"]')
      .first();
    expect(
      await stagedImage.evaluate(
        (element: HTMLImageElement) =>
          element.complete || element.naturalWidth > 0,
      ),
    ).toBe(false);
    await attachScreenshot(
      testInfo,
      "inventory-return-image-jump-preparing",
      tracker.locator(".chain-jump-page"),
    );
  } else {
    const alreadyDecodedImage = activeWorkspace
      .locator('img[src="/assets/confluence-engine.svg"]')
      .first();
    expect(
      await alreadyDecodedImage.evaluate(
        (element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
      ),
    ).toBe(true);
  }

  releaseImage();
  await expect(activeWorkspace.locator(".chain-context-header h3")).toHaveText(
    "The Confluence Engine",
  );
  const decodedImage = activeWorkspace
    .locator('img[src="/assets/confluence-engine.svg"]')
    .first();
  await expect
    .poll(() =>
      decodedImage.evaluate(
        (element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await decodedImage.scrollIntoViewIfNeeded();
  await attachScreenshot(
    testInfo,
    "inventory-return-image-jump-decoded",
    decodedImage,
  );
});

test("a cold Chain Tracker mount never promotes its initial image Jump early", async ({
  page,
}, testInfo) => {
  await page.goto("/editor");
  const releaseImage = await holdAssetResponse(
    page,
    "**/assets/confluence-engine.svg",
  );
  await page.goto("/review/chain-tracker?initialEntry=entry-1", {
    waitUntil: "domcontentloaded",
  });
  const tracker = trackerFor(page);
  const activeWorkspace = tracker.locator(
    ".chain-jump-workspace:not(.is-atomic-stage)",
  );
  const stagedWorkspace = tracker.locator(
    ".chain-jump-workspace.is-atomic-stage",
  );
  await expect(activeWorkspace).toHaveCount(0);
  await expect(stagedWorkspace.locator(".chain-context-header h3")).toHaveText(
    "The Confluence Engine",
  );
  await expect(
    tracker.getByText("Preparing selected Jump…", { exact: true }),
  ).toBeVisible();
  await attachScreenshot(
    testInfo,
    "cold-route-image-jump-preparing",
    tracker.locator(".chain-jump-page"),
  );

  releaseImage();
  await expect(activeWorkspace.locator(".chain-context-header h3")).toHaveText(
    "The Confluence Engine",
  );
  await expect(stagedWorkspace).toHaveCount(0);
  const decodedImage = activeWorkspace
    .locator('img[src="/assets/confluence-engine.svg"]')
    .first();
  await expect
    .poll(() =>
      decodedImage.evaluate(
        (element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
      ),
    )
    .toBe(true);
});

test("inventory shows rank, quantity, and conditional detail projections", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  const search = tracker.getByLabel("Search inventory");
  await attachScreenshot(
    testInfo,
    "inventory-search-layout",
    tracker.locator(".chain-inventory-panel"),
  );

  await search.fill("Adaptive Mastery");
  const ranked = tracker.locator(".chain-record-list > article");
  await expect(ranked).toHaveCount(1);
  await expect(ranked).toContainText("Rank 3");
  await ranked.click();
  const rankDialog = page.getByRole("dialog", {
    name: /perk details: Adaptive Mastery/i,
  });
  await expect(rankDialog).toContainText("Rank");
  await expect(rankDialog).toContainText("practiced discipline at rank 3");
  await page
    .getByRole("button", { name: "Close perk or item details" })
    .click();

  await search.fill("Facet Crates");
  const counted = tracker.locator(".chain-record-list > article");
  await expect(counted).toContainText("x3");
  await counted.click();
  const quantityDialog = page.getByRole("dialog", {
    name: /item details: Facet Crates/i,
  });
  await expect(quantityDialog).toContainText("Quantity");
  await expect(quantityDialog).toContainText(
    "useful stack of 3 aligned facet crates",
  );
  await attachScreenshot(
    testInfo,
    "inventory-rank-and-quantity-detail",
    page.locator("body"),
  );
});

test("similar acquisitions aggregate with per-copy details and a bounded list", async ({
  page,
}, testInfo) => {
  await page.goto(
    "/review/chain-tracker?duplicateJumps=on&negativeBalances=on",
  );
  const tracker = trackerFor(page);
  const selectManualFlight = async () => {
    const manualElectives = tracker
      .getByRole("heading", { name: "Manual Electives" })
      .locator("xpath=ancestor::section[1]");
    await manualElectives.getByRole("checkbox", { name: /Flight/ }).check();
  };

  await tracker.getByRole("button", { name: /3\. The Last Trial/ }).click();
  await selectManualFlight();
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("The Last Trial");
  await tracker
    .getByRole("button", { name: "Add to chain again (x2)" })
    .click();
  await selectManualFlight();

  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByLabel("Search inventory").fill("Flight");
  const aggregate = tracker.locator(".chain-record-list > article");
  await expect(aggregate).toHaveCount(1);
  await expect(aggregate).toContainText("4 acquisitions");
  await expect(aggregate.locator(".record-measure")).toHaveText("x4");
  await expect(
    aggregate.locator(".inventory-record-tags > .tag-profile-badge"),
  ).toHaveText(["Physical", "Flight", "Magic", "Aerokinesis", "Spiritual"]);
  await expect(
    aggregate.locator(".inventory-tag-overflow-list > .tag-profile-badge"),
  ).toHaveCount(6);
  await aggregate.click();

  const dialog = page.getByRole("dialog", { name: /perk details: Flight/i });
  const acquisitions = dialog.getByLabel("Acquisition details");
  await expect(acquisitions.locator(":scope > li")).toHaveCount(4);
  await expect(acquisitions).toHaveClass(/is-scrollable/);
  await expect(acquisitions).toHaveCSS("overflow-y", "auto");
  expect(
    await acquisitions.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await expect(acquisitions).toContainText(
    "Acquired in The Last Trial · Jump 3",
  );
  await expect(acquisitions).toContainText(
    "Acquired in The Last Trial · Jump 4",
  );
  await expect(acquisitions).toContainText(
    "Chosen training lets you fly under your own power.",
  );
  await expect(acquisitions).toContainText(
    "The random trial result grants mystical flight.",
  );
  await expect(acquisitions).toContainText(
    "The claimed trial result lifts your spirit into flight.",
  );
  await acquisitions.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(acquisitions.locator(":scope > li").last()).toBeInViewport();
  await attachScreenshot(
    testInfo,
    "similar-inventory-four-acquisition-scrolled-detail",
    page.locator("body"),
  );
});

test("disabling similar aggregation restores distinct Flight records", async ({
  page,
}) => {
  await page.goto(
    "/review/chain-tracker?aggregateSimilar=off&negativeBalances=on",
  );
  const tracker = trackerFor(page);
  await tracker.getByRole("button", { name: /3\. The Last Trial/ }).click();
  const manualElectives = tracker
    .getByRole("heading", { name: "Manual Electives" })
    .locator("xpath=ancestor::section[1]");
  await manualElectives.getByRole("checkbox", { name: /Flight/ }).check();
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByLabel("Search inventory").fill("Flight");
  await expect(tracker.locator(".chain-record-list > article")).toHaveCount(3);
});

test("inventory cards disclose the complete tag projection", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker?negativeBalances=on");
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByLabel("Search inventory").fill("Gate Scholar");
  const record = tracker.locator(".chain-record-list > article");
  await expect(record).toHaveCount(1);
  await expect(record.locator(".tag-profile-badge")).toHaveCount(5);
  await attachScreenshot(
    testInfo,
    "gate-scholar-complete-inventory-tags",
    tracker.locator(".inventory-results-pane"),
  );

  await record.click();
  const details = page.getByRole("dialog", {
    name: "perk details: Gate Scholar",
  });
  await expect(
    details.locator(".record-detail-tags .tag-profile-badge"),
  ).toHaveCount(5);
  await attachScreenshot(testInfo, "gate-scholar-detail-tags", details);

  await details
    .getByRole("button", { name: "Close perk or item details" })
    .click();
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  const manualElectives = tracker
    .getByRole("heading", { name: "Manual Electives" })
    .locator("xpath=ancestor::section[1]");
  await manualElectives.getByRole("checkbox", { name: /Flight/ }).check();
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByLabel("Search inventory").fill("Flight Survival");
  const overflowRecord = tracker.locator(".chain-record-list > article");
  await expect(overflowRecord).toHaveCount(1);
  await expect(
    overflowRecord.locator(".inventory-record-tags > .tag-profile-badge"),
  ).toHaveCount(5);
  await expect(
    overflowRecord
      .locator(".inventory-record-tags > .tag-profile-badge")
      .filter({ hasText: "Survival" }),
  ).toHaveCount(1);
  const overflow = overflowRecord.locator(".inventory-tag-overflow");
  const tooltip = overflow.getByRole("tooltip");
  await expect(overflow).toBeVisible();
  await expect(tooltip).toBeHidden();
  const restingBackground = await overflowRecord.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await overflow.hover();
  await expect(tooltip).toBeVisible();
  await expect(overflowRecord).toHaveCSS("background-color", restingBackground);
  await expect(
    tooltip.locator(".inventory-tag-overflow-list > .tag-profile-badge"),
  ).toHaveCount(6);
  await attachScreenshot(
    testInfo,
    "inventory-tag-overflow-tooltip",
    tracker.locator(".inventory-results-pane"),
  );
  await page.mouse.move(0, 0);
  await overflow.focus();
  await expect(tooltip).toBeVisible();
});

test("unknown authored Tags render in inventory cards and details", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByLabel("Search inventory").fill("Keeper of Homeward");

  const record = tracker.locator(".chain-record-list > article");
  await expect(record).toHaveCount(1);
  const fallbackBadge = record
    .locator(".tag-profile-badge")
    .filter({ hasText: "door craft" });
  await expect(fallbackBadge).toHaveCount(1);
  await expect(fallbackBadge).toHaveCSS(
    "background-color",
    "rgb(93, 105, 152)",
  );
  await expect(fallbackBadge).toHaveCSS("border-color", "rgb(87, 88, 141)");

  await record.click();
  const details = page.getByRole("dialog", {
    name: "perk details: Keeper of Homeward",
  });
  await expect(
    details
      .locator(".record-detail-tags .tag-profile-badge")
      .filter({ hasText: "door craft" }),
  ).toHaveCount(1);
});

test("inventory record highlight follows the active application accent", async ({
  page,
}, testInfo) => {
  await page.locator("html").evaluate((element) => {
    const root = element as HTMLElement;
    root.style.setProperty("--app-accent-raw", "#7657e8");
    root.style.setProperty("--app-accent-focus", "#9a86ee");
    root.style.setProperty("--app-accent-border", "#9a86ee");
    root.style.setProperty("--app-accent-soft", "#373044");
  });
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByLabel("Search inventory").fill("Gate Scholar");
  const record = tracker.locator(".chain-record-list > article");
  await expect(record).toHaveCount(1);
  await record.hover();
  const expected = await page.locator("html").evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.background = "var(--app-accent-soft)";
    probe.style.border =
      "1px solid color-mix(in srgb, var(--app-accent-border) 62%, #41413d)";
    element.append(probe);
    const style = getComputedStyle(probe);
    const colors = {
      background: style.backgroundColor,
      border: style.borderColor,
    };
    probe.remove();
    return colors;
  });
  await expect(record).toHaveCSS("background-color", expected.background);
  await expect(record).toHaveCSS("border-color", expected.border);
  await attachScreenshot(
    testInfo,
    "inventory-record-active-accent-highlight",
    tracker.locator(".inventory-results-pane"),
  );
});

test("inventory breakdown renders direct-only tags without false drilldown", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByRole("tab", { name: "Stats" }).click();
  await tracker.getByRole("button", { name: "Combat", exact: true }).click();
  await tracker.getByRole("button", { name: "Open breakdown" }).click();
  await expect(tracker.locator("circle.pie-slice")).toHaveCount(1);
  await expect(tracker.locator("path.pie-slice")).toHaveCount(0);
  await expect(tracker.locator(".pie-center-backplate")).toHaveCount(0);
  await attachScreenshot(
    testInfo,
    "inventory-direct-only-breakdown",
    tracker.locator(".tracker-radar-page"),
  );
  await tracker.getByRole("button", { name: "← Radar" }).click();
  await tracker.getByRole("button", { name: "Mental", exact: true }).click();
  await tracker.getByRole("button", { name: "Open breakdown" }).click();
  const learning = tracker.getByRole("button", {
    name: /Learning, 1 records/i,
  });
  await expect(learning).toBeVisible();
  await expect(learning.locator(".pie-drill-marker")).toHaveCount(0);
  await learning.dblclick();
  await expect(
    tracker.getByRole("heading", { name: "Mental", exact: true }),
  ).toBeVisible();
  await attachScreenshot(
    testInfo,
    "inventory-learning-without-false-drilldown",
    tracker.locator(".tracker-radar-page"),
  );
});

test("inventory tag navigation prunes, expands, and scrolls independently", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  const search = tracker.getByLabel("Search inventory");
  const allTags = tracker.locator(".inventory-all-tags");
  const tagScroller = tracker.locator(".inventory-tag-tree-scroll");
  const resultsScroller = tracker.locator(".inventory-results-pane");
  const initialSearchBox = await search.boundingBox();
  const initialAllTagsBox = await allTags.boundingBox();

  await tracker.getByRole("button", { name: "Expand Mental tags" }).click();
  const learning = tracker
    .locator(".inventory-tag-descendant")
    .filter({ hasText: "Learning" });
  await expect(learning).toBeVisible();
  await expect(
    tracker.getByRole("button", { name: "Expand Learning tags" }),
  ).toHaveCount(0);
  await tagScroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await tagScroller.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  expect(await search.boundingBox()).toEqual(initialSearchBox);
  expect(await allTags.boundingBox()).toEqual(initialAllTagsBox);
  const tagScrollTop = await tagScroller.evaluate(
    (element) => element.scrollTop,
  );
  await resultsScroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await resultsScroller.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  expect(await tagScroller.evaluate((element) => element.scrollTop)).toBe(
    tagScrollTop,
  );
  expect(await search.boundingBox()).toEqual(initialSearchBox);
  expect(await allTags.boundingBox()).toEqual(initialAllTagsBox);
  await attachScreenshot(
    testInfo,
    "inventory-independent-tag-scroll",
    tracker.locator(".chain-inventory-panel"),
  );

  await tagScroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await tracker.getByRole("button", { name: "Items" }).click();
  await expect(
    tracker.locator(".inventory-tag-root-row").filter({ hasText: "Social" }),
  ).toHaveCount(0);
  await expect(
    tracker.locator(".inventory-tag-root-row").filter({ hasText: "Crafting" }),
  ).toBeVisible();
  await attachScreenshot(
    testInfo,
    "inventory-pruned-item-tags-and-independent-scroll",
    tracker.locator(".chain-inventory-panel"),
  );
});

test("duplicate packages aggregate identical ranked perks with dual badges", async ({
  page,
}, testInfo) => {
  await page.goto(
    "/review/chain-tracker?duplicateJumps=on&negativeBalances=on",
  );
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("The Confluence Engine");
  await tracker
    .getByRole("button", { name: "Add to chain again (x2)" })
    .click();
  const mastery = tracker
    .getByText("Adaptive Mastery", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await mastery.getByRole("checkbox").check();
  await mastery.getByRole("spinbutton").fill("3");
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByLabel("Search inventory").fill("Adaptive Mastery");
  const aggregated = tracker.locator(".chain-record-list > article");
  await expect(aggregated).toHaveCount(1);
  await expect(aggregated.locator(".record-measure")).toHaveText([
    "Rank 3",
    "x2",
  ]);
  await attachScreenshot(testInfo, "dual-rank-and-quantity-badges", aggregated);
});

test("form-targeted perks stay on the Prism Form profile", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  const prism = tracker.locator(".chain-form-grid article").filter({
    hasText: "Prism Form",
  });
  await expect(prism).toBeVisible();
  await prism.getByRole("button", { name: "View" }).click();
  await tracker.getByRole("button", { name: "Full details" }).click();
  const profile = page.getByRole("dialog", {
    name: "Form details: Prism Form",
  });
  await expect(profile).toContainText("Refractive Hide");
  await expect(profile).toContainText("Spectrum Mind");
  await attachScreenshot(testInfo, "prism-form-targeted-perks", profile);
});

test("populated and empty companion profiles reflect imports and owned records", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  const prism = tracker.locator(".chain-form-grid article").filter({
    hasText: "Prism Form",
  });
  await prism.getByRole("button", { name: "View" }).click();
  await tracker.getByRole("button", { name: "Full details" }).click();
  await page.getByRole("button", { name: "Close form details" }).click();
  await tracker.getByRole("tab", { name: /^Companions/ }).click();

  const lyra = tracker.locator(".chain-companion-grid article").filter({
    hasText: "Lyra",
  });
  await lyra.getByRole("button", { name: "View" }).click();
  await tracker.getByRole("button", { name: "Full profile" }).click();
  await attachScreenshot(
    testInfo,
    "companion-profile-after-viewing-form",
    page.getByRole("dialog"),
  );
  const populated = page.getByRole("dialog", {
    name: "Companion profile: Lyra",
  });
  await expect(populated).toContainText("Imported into");
  await expect(populated).toContainText("The Last Trial");
  await expect(
    populated.locator(".companion-profile-list.is-scrollable"),
  ).toHaveCount(2);
  await attachScreenshot(
    testInfo,
    "populated-imported-companion-profile",
    populated,
  );
  await page.getByRole("button", { name: "Close companion profile" }).click();

  const quiet = tracker.locator(".chain-companion-grid article").filter({
    hasText: "The Quiet Witness",
  });
  await quiet.getByRole("button", { name: "View" }).click();
  await tracker.getByRole("button", { name: "Full profile" }).click();
  const empty = page.getByRole("dialog", {
    name: "Companion profile: The Quiet Witness",
  });
  await expect(empty).toContainText("Companion has no perks");
  await expect(empty).toContainText("Companion has no items");
  await expect(empty).toContainText(
    "Companion has not been imported into any jumps",
  );
  await attachScreenshot(testInfo, "empty-companion-profile", empty);
});

test("the imported companion is selectable only in the funded Last Trial", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker
    .getByRole("button", { name: /2\. The Confluence Engine/ })
    .click();
  const activeWorkspace = tracker.locator(
    ".chain-jump-workspace:not(.is-atomic-stage)",
  );
  await expect(activeWorkspace.locator(".chain-context-header h3")).toHaveText(
    "The Confluence Engine",
  );
  await expect(
    activeWorkspace.getByLabel("Make choices as").locator("option"),
  ).toHaveCount(1);
  await tracker.getByRole("button", { name: /3\. The Last Trial/ }).click();
  await expect(activeWorkspace.locator(".chain-context-header h3")).toHaveText(
    "The Last Trial",
  );
  const actor = activeWorkspace.getByLabel("Make choices as");
  await expect(actor.locator("option").filter({ hasText: "Lyra" })).toHaveCount(
    1,
  );
  const lyraValue = await actor
    .locator("option")
    .filter({ hasText: "Lyra" })
    .getAttribute("value");
  await actor.selectOption(lyraValue!);
  await expect(tracker.locator(".tracker-budget output")).toBeVisible();
  await attachScreenshot(testInfo, "imported-companion-actor-state", tracker);
});

test(
  "dragging a Jump exposes the accent insertion line and its context action reorders through the shared undo toast",
  { tag: "@cross-browser" },
  async ({ page }, testInfo) => {
    const tracker = trackerFor(page);
    const source = tracker.locator(".chain-jump-entry").filter({
      hasText: "The Last Trial",
    });
    const target = tracker.locator(".chain-jump-entry").filter({
      hasText: "The Confluence Engine",
    });
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await source.dispatchEvent("dragstart", { dataTransfer });
    const targetBox = await target.boundingBox();
    expect(targetBox).not.toBeNull();
    await target.dispatchEvent("dragover", {
      dataTransfer,
      clientY: targetBox!.y + 2,
    });
    await expect(target).toHaveClass(/is-drop-before/);
    expect(
      await target.evaluate((element) => {
        const style = getComputedStyle(element, "::before");
        return [style.height, style.backgroundColor];
      }),
    ).not.toEqual(["0px", "rgba(0, 0, 0, 0)"]);
    await attachScreenshot(
      testInfo,
      "chain-drag-accent-insertion-line",
      tracker.locator(".chain-rail-panel"),
    );
    await source.dispatchEvent("dragend", { dataTransfer });

    await source.click({ button: "right" });
    const menu = page.getByRole("menu", {
      name: "The Last Trial chain entry actions",
    });
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Open",
      "Move later",
      "Move earlier",
      "Remove from chain…",
    ]);
    await menu.getByRole("menuitem", { name: "Move earlier" }).click();
    const toast = page.locator(".app-toast-host .app-toast").filter({
      hasText: "Reorder complete",
    });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible();
    await attachScreenshot(
      testInfo,
      "reorder-shared-undo-toast",
      page.locator("body"),
    );
    await toast.getByRole("button", { name: "Undo" }).click();

    const threshold = tracker.locator(".chain-jump-entry").filter({
      hasText: "Threshold of a Thousand Roads",
    });
    await threshold.click({ button: "right" });
    await page
      .getByRole("menu", {
        name: "Threshold of a Thousand Roads chain entry actions",
      })
      .getByRole("menuitem", { name: "Remove from chain…" })
      .click();
    await expect(threshold).toHaveCount(0);
    const removalToast = page.locator(".app-toast-host .app-toast").filter({
      hasText: "Remove Jump complete.",
    });
    await expect(removalToast).toBeVisible();
    await removalToast.getByRole("button", { name: "Undo" }).click();
    await expect(threshold).toBeVisible();
  },
);

test("a stale canonical demo hash rebinds without losing selections or reaching recovery UI", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await expect(tracker).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const request = indexedDB.open("jumpchain-visualizer", 4);
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction("chains", "readonly");
        const record = await new Promise<unknown>((resolve, reject) => {
          const read = transaction.objectStore("chains").get("ch-92b1");
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
        });
        database.close();
        return Boolean(record);
      }),
    )
    .toBe(true);

  await page.evaluate(async () => {
    const request = indexedDB.open("jumpchain-visualizer", 4);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("chains", "readwrite");
    const store = transaction.objectStore("chains");
    type StoredAggregate = {
      entries: Record<string, { packageExactHash: string }>;
      jumpState: Record<
        string,
        { actors: Record<string, { choices: Record<string, unknown> }> }
      >;
      lastValidatedEvaluation: { forms?: unknown };
    };
    const aggregate = await new Promise<StoredAggregate>((resolve, reject) => {
      const read = store.get("ch-92b1");
      read.onsuccess = () => resolve(read.result as StoredAggregate);
      read.onerror = () => reject(read.error);
    });
    aggregate.entries["entry-2"].packageExactHash = "sha256:stale-package";
    aggregate.jumpState["entry-2"].actors.jumper.choices.trial_name =
      "Persistence Marker";
    delete aggregate.lastValidatedEvaluation.forms;
    store.put(aggregate);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  await expect(tracker).toBeVisible();
  await expect(
    tracker.getByText(
      "This exact package is unavailable. Stored selections are preserved until it is restored.",
    ),
  ).toHaveCount(0);
  const activeJump = tracker.locator(
    ".chain-jump-workspace:not(.is-atomic-stage)",
  );
  await expect(activeJump.locator(".format-one-jump-renderer")).toBeVisible();
  await expect(
    activeJump.getByRole("textbox", { name: "Trial Name" }),
  ).toHaveValue("Persistence Marker");
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await attachScreenshot(testInfo, "stale-demo-package-rebound", tracker);
});

test("a route-loaded chain renders a recoverable placeholder when its exact package is not installed", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await expect(tracker).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const request = indexedDB.open("jumpchain-visualizer", 4);
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction("chains", "readonly");
        const record = await new Promise<unknown>((resolve, reject) => {
          const read = transaction.objectStore("chains").get("ch-92b1");
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
        });
        database.close();
        return Boolean(record);
      }),
    )
    .toBe(true);

  await page.evaluate(async () => {
    const request = indexedDB.open("jumpchain-visualizer", 4);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("chains", "readwrite");
    const store = transaction.objectStore("chains");
    type StoredAggregate = {
      entries: Record<string, { packageId: string }>;
    };
    const aggregate = await new Promise<StoredAggregate>((resolve, reject) => {
      const read = store.get("ch-92b1");
      read.onsuccess = () => resolve(read.result as StoredAggregate);
      read.onerror = () => reject(read.error);
    });
    aggregate.entries["entry-2"].packageId = "unavailable-imported-package";
    store.put(aggregate);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  await expect(tracker).toBeVisible();
  await expect(
    tracker.getByText("Unavailable Jump package", { exact: true }),
  ).toBeVisible();
  await expect(
    tracker.getByText(
      "This exact package is unavailable. Stored selections are preserved until it is restored.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await attachScreenshot(testInfo, "unavailable-package-recovery", tracker);
});

test("Earth remains immutable and drives previous continuity into Jump 1", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  const earth = tracker.locator(".chain-jump-entry.is-earth");
  await earth.getByRole("button", { name: /^Earth/ }).click();
  await expect(earth.locator(".chain-jump-handle")).toHaveCount(0);
  await expect(earth.locator(".chain-jump-actions")).toHaveCount(0);
  const earthControls = tracker.locator(".earth-identity-controls");
  await expect(earthControls.locator(".control-specimen").first()).toHaveCSS(
    "background-color",
    "rgb(41, 41, 39)",
  );
  await expect(
    earthControls.locator(".control-specimen > header").first(),
  ).toHaveCSS("background-color", "rgb(32, 32, 30)");
  const earthRenderer = tracker.locator(".earth-jump-renderer");
  await expect(earthRenderer).toHaveCSS("background-color", "rgb(36, 36, 34)");
  await expect(earthRenderer).toHaveCSS("border-radius", "6.4px");
  await expect(earthRenderer).toHaveCSS("color-scheme", "dark");
  await expect(tracker.getByLabel("Earth gender")).toHaveCSS(
    "background-repeat",
    "no-repeat",
  );
  await expect(tracker.getByLabel("Earth gender")).toHaveCSS(
    "background-size",
    "12px 8px",
  );
  for (const heading of await earthControls
    .locator(".default-choice-heading > strong")
    .all())
    await expect(heading).toHaveCSS("color", "rgb(241, 241, 235)");
  const ageInput = tracker.getByLabel("Earth age");
  await expect(ageInput).toHaveCSS("color", "rgb(241, 241, 235)");
  await expect(ageInput).toHaveCSS("background-color", "rgb(48, 48, 46)");
  await expect(earthControls.locator(".number-stepper-buttons")).toHaveCSS(
    "background-color",
    "rgb(48, 48, 46)",
  );
  await expect(
    earthControls.locator(".number-stepper-buttons button").first(),
  ).toHaveCSS("color", "rgb(170, 169, 163)");
  await attachScreenshot(testInfo, "earth-dark-appearance", earthRenderer);
  if (reviewArtifactsEnabled)
    await earthRenderer.screenshot({
      path: testInfo.outputPath("earth-dark-appearance.png"),
      animations: "disabled",
    });
  await tracker.getByLabel("Earth gender").selectOption("Male");
  await tracker.getByLabel("Earth age").fill("31");
  await earth.click({ button: "right" });
  const earthMenu = page.getByRole("menu", {
    name: "Earth chain entry actions",
  });
  await expect(earthMenu.getByRole("menuitem")).toHaveText([
    "Open identity setup",
    "Clear starting gender",
    "Clear starting age",
  ]);
  await earthMenu
    .getByRole("menuitem", { name: "Open identity setup" })
    .click();
  await expect(tracker.getByLabel("Earth gender")).toHaveValue("Male");
  await expect(tracker.getByLabel("Earth age")).toHaveValue("31");

  await earth.click({ button: "right" });
  await page
    .getByRole("menu", { name: "Earth chain entry actions" })
    .getByRole("menuitem", { name: "Clear starting gender" })
    .click();
  await expect(tracker.getByLabel("Earth gender")).toHaveValue("");
  await expect(tracker.locator(".chain-jump-summary")).not.toContainText(
    "Male",
  );
  await earth.click({ button: "right" });
  await page
    .getByRole("menu", { name: "Earth chain entry actions" })
    .getByRole("menuitem", { name: "Clear starting age" })
    .click();
  await expect(tracker.getByLabel("Earth age")).toHaveValue("");
  await earth.click({ button: "right" });
  await expect(
    page
      .getByRole("menu", { name: "Earth chain entry actions" })
      .getByRole("menuitem", { name: "Clear starting age" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await tracker.getByLabel("Earth gender").selectOption("Male");
  await tracker.getByLabel("Earth age").fill("31");
  await tracker
    .getByRole("button", { name: /1\. Threshold of a Thousand Roads/ })
    .click();
  const activeWorkspace = tracker.locator(
    ".chain-jump-workspace:not(.is-atomic-stage)",
  );
  await expect(activeWorkspace.locator(".chain-context-header h3")).toHaveText(
    "Threshold of a Thousand Roads",
  );
  await expect(activeWorkspace.getByLabel("Gender")).toHaveValue("Male");
  await expect(
    activeWorkspace.getByRole("spinbutton", { name: "Age" }),
  ).toHaveValue("");
  await attachScreenshot(
    testInfo,
    "earth-to-threshold-identity-continuity",
    tracker,
  );
});
