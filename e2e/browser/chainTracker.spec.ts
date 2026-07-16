import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.goto("/review/chain-tracker");
});

const trackerFor = (page: import("@playwright/test").Page) =>
  page.getByLabel("Interactive Chain Tracker workspace");
const chainToast = (page: import("@playwright/test").Page, message: string) =>
  page.locator(".app-toast-host .app-toast").filter({ hasText: message });

test("renders the complete dense Chain Tracker frame and fixed workspace tabs", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await expect(tracker).toBeVisible();
  await expect(
    tracker.getByRole("tab", { name: /^Chain & Jump/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(9);
  await expect(tracker.locator(".chain-rail-panel > header strong")).toHaveText(
    "8 Jumps",
  );
  await expect(tracker.getByRole("tab", { name: /^Inventory/ })).toContainText(
    "70",
  );
  await expect(tracker.getByRole("tab", { name: /^Forms/ })).toContainText("1");
  await expect(tracker.getByRole("tab", { name: /^Companions/ })).toContainText(
    "7",
  );
  await expect(tracker.locator(".shared-renderer-label")).toHaveCount(0);
  const stack = tracker.locator(".chain-page-stack");
  await expect
    .poll(() => stack.evaluate((node) => node.scrollWidth <= node.clientWidth))
    .toBe(true);
  await expect(stack).toHaveCSS("overflow-y", "hidden");
  await expect
    .poll(() =>
      stack.evaluate((node) => node.scrollHeight <= node.clientHeight),
    )
    .toBe(true);
});

test("only truncated rail metadata exposes its complete text on hover", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  const truncated = tracker
    .locator(".chain-jump-entry .chain-jump-select small[title]")
    .first();
  await expect(truncated).toBeVisible();
  await expect(truncated).toHaveAttribute("title", /Negative balance|Gauntlet/);
  await truncated.hover();
  await expect(
    tracker.locator(".chain-jump-entry.is-earth .chain-jump-select small"),
  ).not.toHaveAttribute("title", /.+/);
  await testInfo.attach("truncated-rail-metadata-hover", {
    body: await tracker.locator(".chain-rail-panel").screenshot(),
    contentType: "image/png",
  });
});

test("persisted Earth metadata is replaced by the system label", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await expect(tracker).toBeVisible();
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const request = indexedDB.open("jumpchain-visualizer", 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("chains", "readwrite");
    const store = transaction.objectStore("chains");
    const aggregate = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const read = store.get("ch-92b1");
        read.onsuccess = () => resolve(read.result as Record<string, unknown>);
        read.onerror = () => reject(read.error);
      },
    );
    const entries = aggregate.entries as Record<
      string,
      Record<string, unknown>
    >;
    aggregate.name = "Persisted stale Earth label";
    entries["entry-earth"] = {
      ...entries["entry-earth"],
      status: "Identity setup",
    };
    store.put(aggregate);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  await expect(
    tracker.getByText("Persisted stale Earth label", { exact: true }),
  ).toBeVisible();
  const earth = tracker.locator(".chain-jump-entry.is-earth");
  await earth.getByRole("button", { name: /^Earth/ }).click();
  await expect(earth).toContainText("The Beginning");
  await expect(earth).not.toContainText("Identity setup");
  await testInfo.attach("persisted-earth-system-label", {
    body: await earth.screenshot(),
    contentType: "image/png",
  });
});

test("Jump content owns vertical scrolling and the Supp layer matches Settings", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await tracker.getByRole("button", { name: /1\. First Step/ }).click();
  await expect(tracker.getByText("Current Jump", { exact: true })).toHaveCSS(
    "color",
    "rgb(23, 23, 23)",
  );

  const stack = tracker.locator(".chain-page-stack");
  const renderer = tracker.locator(".tracker-renderer-placeholder");
  await expect(stack).toHaveCSS("overflow-y", "hidden");
  await expect
    .poll(() =>
      stack.evaluate((node) => node.scrollHeight <= node.clientHeight),
    )
    .toBe(true);
  await expect
    .poll(() =>
      renderer.evaluate((node) => node.scrollHeight > node.clientHeight),
    )
    .toBe(true);

  const actor = tracker.getByLabel("Make choices as");
  const gauntlet = tracker.getByRole("button", {
    name: "Apply Gauntlet rules",
  });
  const actorBox = await actor.boundingBox();
  const gauntletBox = await gauntlet.boundingBox();
  expect(actorBox).not.toBeNull();
  expect(gauntletBox).not.toBeNull();
  expect(gauntletBox!.y).toBeGreaterThan(actorBox!.y + actorBox!.height);
  expect(Math.abs(gauntletBox!.x - actorBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(gauntletBox!.width - actorBox!.width)).toBeLessThanOrEqual(1);
  await testInfo.attach("first-step-single-scroll-region", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await tracker.getByRole("button", { name: "Supp" }).click();
  const suppLayer = page.locator(".tracker-supp-application-layer");
  const suppDialog = page.getByRole("dialog", {
    name: "First Step current-Jump supplements",
  });
  const suppLayerBox = await suppLayer.boundingBox();
  const suppDialogBox = await suppDialog.boundingBox();
  expect(suppLayerBox).not.toBeNull();
  expect(suppDialogBox).not.toBeNull();
  expect(
    Math.abs(
      suppDialogBox!.x +
        suppDialogBox!.width / 2 -
        (suppLayerBox!.x + suppLayerBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      suppDialogBox!.y +
        suppDialogBox!.height / 2 -
        (suppLayerBox!.y + suppLayerBox!.height / 2),
    ),
  ).toBeLessThanOrEqual(1);
  await testInfo.attach("supp-overlay-application-layer", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const tools = suppDialog.locator(
    'nav[aria-label="Enabled supplement tools"] > button',
  );
  const overflowingTools: { name: string; client: number; scroll: number }[] =
    [];
  for (let index = 0; index < (await tools.count()); index += 1) {
    await tools.nth(index).click();
    const dimensions = await suppDialog
      .locator(".chain-supp-context-content")
      .evaluate((node) => ({
        client: node.clientHeight,
        scroll: node.scrollHeight,
      }));
    if (dimensions.scroll > dimensions.client + 1)
      overflowingTools.push({
        name: (await tools.nth(index).innerText()).split("\n")[0],
        ...dimensions,
      });
  }
  expect(overflowingTools).toEqual([]);
  await suppDialog
    .getByRole("button", { name: "Close current-Jump supplements" })
    .click();

  await page.getByRole("button", { name: "Settings" }).click();
  const settingsLayerBox = await page
    .locator(".app-settings-layer")
    .boundingBox();
  expect(settingsLayerBox).toEqual(suppLayerBox);
});

test("Gauntlet, Quest Mode, and Personal Reality alter the selected Jump balance", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker?negativeBalances=on");
  const tracker = trackerFor(page);
  await tracker.getByRole("button", { name: /1\. First Step/ }).click();
  const currency = tracker
    .getByLabel("Current jump summary")
    .locator("dd")
    .first();
  const balance = async () =>
    Number.parseInt(
      (await currency.textContent())?.replace(/[^\d-]/g, "") ?? "0",
      10,
    );

  const questRow = () =>
    tracker
      .locator(".supplement-manage-list article")
      .filter({ hasText: "Quest Mode" });
  await tracker.getByRole("tab", { name: "Supplements" }).click();
  await questRow().getByRole("checkbox").uncheck();
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  const ordinary = await balance();

  await tracker.getByRole("button", { name: "Apply Gauntlet rules" }).click();
  expect(await balance()).toBe(ordinary - 1000);
  expect(await balance()).toBeLessThan(0);
  await page.waitForTimeout(100);
  const gauntletRenderer = tracker.locator(".format-one-jump-renderer");
  await expect(gauntletRenderer).toHaveCSS(
    "background-color",
    "rgb(245, 241, 230)",
  );
  const gauntletRendererBox = await gauntletRenderer.boundingBox();
  expect(gauntletRendererBox).not.toBeNull();
  await testInfo.attach("first-step-applied-gauntlet-negative-balance", {
    body: await page.screenshot({ clip: gauntletRendererBox! }),
    contentType: "image/png",
  });
  await tracker.getByRole("button", { name: "Remove Gauntlet rules" }).click();
  expect(await balance()).toBe(ordinary);

  await tracker.getByRole("tab", { name: "Supplements" }).click();
  await questRow().getByRole("checkbox").check();
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  expect(await balance()).toBe(ordinary - 1000);
  expect(await balance()).toBeLessThan(0);

  await tracker.getByRole("tab", { name: "Supplements" }).click();
  await questRow().getByRole("checkbox").uncheck();
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await tracker.getByRole("button", { name: "Supp" }).click();
  const dialog = tracker.getByRole("dialog", {
    name: "First Step current-Jump supplements",
  });
  await dialog
    .getByRole("button", { name: "Personal Reality Spend new points" })
    .click();
  await dialog
    .getByRole("group", { name: "CP to WP conversion" })
    .getByRole("button", { name: /100 CP/ })
    .click();
  await dialog
    .getByRole("button", { name: "Close current-Jump supplements" })
    .click();
  expect(await balance()).toBe(ordinary - 100);
  await testInfo.attach("first-step-personal-reality-conversion", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await tracker.getByRole("tab", { name: "Supplements" }).click();
  await tracker
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Personal Reality" })
    .getByRole("checkbox")
    .uncheck();
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  expect(await balance()).toBe(ordinary);
});

test("summary tooltips, actor deficit, Jump selection, and inspection point stay synchronized", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  const currency = tracker.locator(".chain-jump-summary dd").first();
  await currency.hover();
  await expect(currency.getByRole("tooltip")).toContainText(
    "Alternative currencies remaining",
  );
  const origin = tracker.locator(".chain-summary-origin dd");
  await origin.focus();
  await expect(origin.getByRole("tooltip")).toContainText("Location:");

  const actor = tracker.getByLabel("Make choices as");
  const renValue = await actor
    .locator("option")
    .filter({ hasText: "Ren" })
    .getAttribute("value");
  await actor.selectOption(renValue!);
  await expect(tracker.locator(".tracker-budget output")).toHaveText("-900 CP");
  await tracker
    .getByRole("checkbox", { name: "Take Reality Rewrite" })
    .uncheck();
  await expect(tracker.locator(".tracker-budget output")).toHaveText("0 CP");

  await tracker.getByRole("button", { name: /2\. Arcane Realms/ }).click();
  await expect(
    tracker.getByRole("heading", { name: "Arcane Realms" }).first(),
  ).toBeVisible();
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  await expect(
    tracker.getByLabel("Forms through historical cutoff"),
  ).toHaveValue("entry-1");
  await expect(tracker.locator(".chain-form-grid > article")).toHaveCount(1);
});

test("companion imports and purchases require targeted currency before exposing actor choices", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/review/chain-tracker?negativeBalances=on");
  const tracker = trackerFor(page);
  const actor = tracker.getByLabel("Make choices as");
  const horizon = tracker
    .locator(".default-choice-card")
    .filter({ hasText: "Horizon Company" });
  await horizon.scrollIntoViewIfNeeded();
  await expect(
    horizon.getByText("Import companions", { exact: true }),
  ).toBeVisible();
  await expect(horizon).toContainText(
    "Each selected companion receives 500 CP.",
  );
  const renImport = horizon.getByRole("checkbox", { name: "Ren" });
  await expect(renImport).toBeChecked();
  await expect(actor.locator("option").filter({ hasText: "Ren" })).toHaveCount(
    1,
  );
  await renImport.scrollIntoViewIfNeeded();
  await testInfo.attach("active-companion-import", {
    body: await horizon.locator(".companion-selection-input").screenshot(),
    contentType: "image/png",
  });

  await renImport.uncheck();
  await expect(actor.locator("option").filter({ hasText: "Ren" })).toHaveCount(
    0,
  );
  await tracker.getByRole("tab", { name: /^Companions/ }).click();
  await tracker
    .locator(".chain-companion-grid > article")
    .filter({ hasText: "Ren" })
    .getByRole("button", { name: "View" })
    .click();
  await tracker.getByRole("button", { name: "Full profile" }).click();
  const renProfile = tracker.getByRole("dialog", {
    name: /Companion profile: Ren/,
  });
  await expect(
    renProfile.getByText("Companion has not been imported into any jumps", {
      exact: true,
    }),
  ).toBeVisible();
  await testInfo.attach("cleared-companion-import", {
    body: await renProfile.screenshot(),
    contentType: "image/png",
  });
  await renProfile
    .getByRole("button", { name: "Close companion profile" })
    .click();

  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await horizon.scrollIntoViewIfNeeded();
  await renImport.check();
  await expect(actor.locator("option").filter({ hasText: "Ren" })).toHaveCount(
    1,
  );

  await tracker.getByRole("checkbox", { name: "Take Aster" }).check();
  const asterOption = actor.locator("option").filter({ hasText: "Aster" });
  await expect(asterOption).toHaveCount(1);
  await actor.selectOption((await asterOption.getAttribute("value"))!);
  await expect(tracker.locator(".tracker-budget output")).toHaveText("500 CP");
  await testInfo.attach("funded-purchased-companion", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await tracker.getByRole("tab", { name: /^Companions/ }).click();
  await tracker
    .locator(".chain-companion-grid > article")
    .filter({ hasText: "Aster" })
    .getByRole("button", { name: "View" })
    .click();
  await tracker.getByRole("button", { name: "Full profile" }).click();
  const asterProfile = tracker.getByRole("dialog", {
    name: /Companion profile: Aster/,
  });
  await expect(asterProfile).toContainText("Boundary Instinct");
  await testInfo.attach("purchased-companion-targeted-perk", {
    body: await asterProfile.screenshot(),
    contentType: "image/png",
  });
});

test("Earth is unnumbered, immutable, and drives identity continuity", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  const earth = tracker.locator(".chain-jump-entry.is-earth");
  await expect(earth).toBeVisible();
  await expect(earth.locator(".chain-jump-handle")).toHaveCount(0);
  await expect(earth.locator(".chain-jump-actions")).toHaveCount(0);
  await expect(tracker.locator(".chain-jump-entry").last()).toHaveClass(
    /is-earth/,
  );

  await earth.getByRole("button", { name: /^Earth/ }).click();
  await expect(earth).toHaveClass(/is-selected/);
  await expect(earth).toContainText("The Beginning");
  await expect(
    tracker.getByText("Before Jump 1", { exact: true }),
  ).toBeVisible();
  await expect(tracker.getByText("The Beginning", { exact: true })).toHaveCount(
    2,
  );
  await testInfo.attach("earth-selected-accent-edge-and-beginning-label", {
    body: await tracker.screenshot(),
    contentType: "image/png",
  });
  const summary = tracker.locator(".chain-jump-summary");
  await expect(summary.locator("dd").nth(0)).toContainText("0 CP");
  await expect(summary.locator("dd").nth(1)).toContainText("Human");
  await expect(summary.locator("dd").nth(2)).toHaveText("Unknown");
  await expect(summary.locator("dd").nth(3)).toHaveText("Unknown");
  const origin = summary.locator(".chain-summary-origin dd");
  await origin.focus();
  await expect(origin.getByRole("tooltip")).toContainText("Species: Human");
  await expect(origin.getByRole("tooltip")).toContainText("Location: Earth");

  await tracker.getByLabel("Earth gender").selectOption("Female");
  await tracker.getByLabel("Earth age").fill("24");
  await expect(summary.locator("dd").nth(2)).toHaveText("Female");
  await expect(summary.locator("dd").nth(3)).toHaveText("24");

  await tracker.getByRole("button", { name: /1\. First Step/ }).click();
  const firstGender = tracker.getByLabel("Gender");
  await expect(firstGender).toHaveValue("Female");
  await firstGender.selectOption("Male");
  await expect(firstGender).toHaveValue("Male");

  await tracker.getByRole("button", { name: /2\. Arcane Realms/ }).click();
  await expect(tracker.getByLabel("Gender")).toHaveValue("Male");
  await origin.focus();
  await expect(origin.getByRole("tooltip")).toContainText("Species: Elf");

  await tracker
    .getByRole("button", { name: /8\. Beyond the Last Horizon/ })
    .click();
  await expect(tracker.getByLabel("Horizon Identity")).toHaveValue("");
  await expect(
    tracker.getByLabel("Horizon Identity").locator("option").nth(1),
  ).toContainText("Free");
});

test("Classic Body Mod supplies only the fallback species on the real chain route", async ({
  page,
}) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Supplements" }).click();
  await tracker.getByRole("button", { name: "Open page" }).first().click();
  await tracker.getByRole("button", { name: /Bestial/ }).click();
  await tracker.getByLabel("Bestial animal").fill("Wolf");
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await tracker
    .getByRole("button", { name: /8\. Beyond the Last Horizon/ })
    .click();
  const origin = tracker.locator(".chain-summary-origin dd");
  await origin.focus();
  await expect(origin).toContainText("Unknown");
  await expect(origin.getByRole("tooltip")).toContainText(
    "Species: Wolf Demi-Human",
  );
  await expect(origin.getByRole("tooltip")).toContainText("Location: Unknown");

  await tracker.getByRole("tab", { name: "Supplements" }).click();
  await tracker.getByRole("tab", { name: "Manage" }).click();
  await tracker
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Classic Body Mod" })
    .getByRole("checkbox")
    .uncheck();
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await origin.focus();
  await expect(origin.getByRole("tooltip")).toContainText("Species: Human");
});

test("reorder review supports cancel, commit, drag-equivalent controls, and undo", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker?upstreamWarnings=on");
  const tracker = trackerFor(page);
  const move = tracker.getByRole("button", {
    name: "Move War of Seven Crowns later in the chain",
  });
  await move.click();
  const review = tracker.getByRole("dialog", { name: "Review move" });
  await expect(review).toContainText("Affected dependencies");
  await expect(review).toContainText("Ren");
  await expect(review).toContainText("Beyond the Last Horizon");
  await review.getByRole("button", { name: "Cancel" }).click();
  await expect(review).toHaveCount(0);
  await move.click();
  await review.getByRole("button", { name: "Commit reorder" }).click();
  const undoToast = chainToast(page, "Reorder complete");
  await expect(undoToast).toContainText("Reorder complete");
  await expect(tracker.locator(".tracker-undo")).toHaveCount(0);
  await testInfo.attach("chain-reorder-timed-undo-toast", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await undoToast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(undoToast).toHaveCount(0);
  await expect(
    tracker.getByRole("button", { name: /7\. War of Seven Crowns/ }),
  ).toBeVisible();

  const source = tracker
    .locator(".chain-jump-entry")
    .filter({ hasText: "Clockwork Sea" });
  const target = tracker
    .locator(".chain-jump-entry")
    .filter({ hasText: "The Long Shadow Court" });
  const sourceHandle = source.locator(".chain-jump-handle");
  const previewTransfer = await page.evaluateHandle(() => new DataTransfer());
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await sourceHandle.dispatchEvent("dragstart", {
    dataTransfer: previewTransfer,
  });
  await target.dispatchEvent("dragover", {
    dataTransfer: previewTransfer,
    clientX: targetBox!.x + targetBox!.width / 2,
    clientY: targetBox!.y + 2,
  });
  await expect(source).toHaveClass(/is-dragging/);
  await expect(target).toHaveClass(/is-drop-before/);
  await testInfo.attach("chain-jump-accent-insertion-line", {
    body: await tracker.screenshot(),
    contentType: "image/png",
  });
  await sourceHandle.dispatchEvent("dragend", {
    dataTransfer: previewTransfer,
  });
  await expect(target).not.toHaveClass(/is-drop-/);

  await sourceHandle.dragTo(target, {
    targetPosition: { x: 10, y: Math.max(1, targetBox!.height - 2) },
  });
  const reorderedEntries = tracker.locator(".chain-jump-entry");
  await expect(
    reorderedEntries.filter({ hasText: "The Long Shadow Court" }),
  ).toHaveCount(1);
  expect(
    await reorderedEntries
      .filter({ hasText: "Clockwork Sea" })
      .evaluate((entry) =>
        Array.from(entry.parentElement?.children ?? []).indexOf(entry),
      ),
  ).toBeGreaterThan(
    await reorderedEntries
      .filter({ hasText: "The Long Shadow Court" })
      .evaluate((entry) =>
        Array.from(entry.parentElement?.children ?? []).indexOf(entry),
      ),
  );
  await testInfo.attach("chain-jump-reordered-after-indicated-drop", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await expect(undoToast).toBeVisible();
  await expect(undoToast).toHaveCount(0, { timeout: 7_000 });
  await testInfo.attach("chain-reorder-toast-auto-dismissed", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await expect(
    tracker.getByRole("dialog", { name: "Review move" }),
  ).toHaveCount(0);
});

test("reorder Undo uses the shared notification stack and its settings", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Notifications" }).click();
  await page.getByLabel("Maximum visible").selectOption("1");
  await page.getByLabel("Toast duration").selectOption("3000");
  await expect(page.getByLabel("Toast duration")).toHaveValue("3000");
  await page.getByRole("button", { name: "Close Settings" }).click();

  const preferenceToast = page
    .locator(".app-toast-host .app-toast")
    .filter({ hasText: "Preferences updated" });
  await expect(preferenceToast).toBeVisible();
  await tracker
    .getByRole("button", {
      name: "Move War of Seven Crowns later in the chain",
    })
    .click();
  const reorderToast = chainToast(page, "Reorder complete");
  await page.waitForTimeout(600);
  await expect(page.locator(".app-toast-host .app-toast")).toHaveCount(1);
  await expect(reorderToast).toHaveCount(0);
  await preferenceToast
    .getByRole("button", { name: "Dismiss notification" })
    .click();
  await expect(reorderToast).toBeVisible();
  await expect(
    reorderToast.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".tracker-undo-toast")).toHaveCount(0);
  await testInfo.attach("chain-reorder-shared-notification-stack", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await tracker
    .getByRole("heading", { name: "Beyond the Last Horizon" })
    .first()
    .click();
  await expect(reorderToast).toHaveCount(0, { timeout: 4_000 });
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("tab", { name: "Notifications" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Chain activity").uncheck();
  await page.getByRole("button", { name: "Close Settings" }).click();
  await expect(preferenceToast).toBeVisible();
  await preferenceToast
    .getByRole("button", { name: "Dismiss notification" })
    .click();

  await tracker
    .getByRole("button", {
      name: "Move Clockwork Sea later in the chain",
    })
    .click();
  await page.waitForTimeout(700);
  await expect(reorderToast).toHaveCount(0);
  await expect(page.locator(".app-toast-host .app-toast")).toHaveCount(0);
  await testInfo.attach("chain-reorder-notification-class-disabled", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("material upstream changes commit without review by default", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker
    .getByRole("button", {
      name: "Move War of Seven Crowns later in the chain",
    })
    .click();
  await expect(
    tracker.getByRole("dialog", { name: "Review move" }),
  ).toHaveCount(0);
  await expect(chainToast(page, "Reorder complete")).toBeVisible();
});

test("enabled upstream warnings ignore deletion of a downstream importer", async ({
  page,
}) => {
  await page.goto("/review/chain-tracker?upstreamWarnings=on");
  const tracker = trackerFor(page);
  await tracker
    .getByRole("button", {
      name: "Remove Beyond the Last Horizon from the chain",
    })
    .click();
  await expect(
    tracker.getByRole("dialog", { name: "Review remove" }),
  ).toHaveCount(0);
  await expect(chainToast(page, "Remove Jump complete")).toBeVisible();
});

test("an unaffected newly added Jump reorders without a review dialog", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Hero Academy");
  await tracker.getByRole("button", { name: "Add to chain" }).click();
  await tracker
    .getByRole("button", { name: "Move Hero Academy earlier in the chain" })
    .click();
  await expect(
    tracker.getByRole("dialog", { name: "Review move" }),
  ).toHaveCount(0);
  await expect(chainToast(page, "Reorder complete")).toBeVisible();
});

test("remove reports impacts, commits, and restores the entry through undo", async ({
  page,
}) => {
  await page.goto("/review/chain-tracker?upstreamWarnings=on");
  const tracker = trackerFor(page);
  await tracker
    .getByRole("button", {
      name: "Remove War of Seven Crowns from the chain",
    })
    .click();
  const review = tracker.getByRole("dialog", { name: "Review remove" });
  await expect(review).toContainText("Ren");
  await expect(review).toContainText("War of Seven Crowns");
  await expect(review).toContainText("Beyond the Last Horizon");
  await review.getByRole("button", { name: "Remove Jump" }).click();
  await expect(
    tracker.getByRole("button", { name: /War of Seven Crowns/ }),
  ).toHaveCount(0);
  await chainToast(page, "Remove Jump complete")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(
    tracker.getByRole("button", { name: /7\. War of Seven Crowns/ }),
  ).toBeVisible();
});

test("library filters provenance, handles empty results, opens exact versions, and adds parallel versions", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Arcane Realms");
  await tracker.getByRole("button", { name: "Imported" }).click();
  await expect(tracker.locator(".chain-library-card")).toHaveCount(2);
  await expect(tracker.getByText("Arcane Realms · v1.1")).toBeVisible();
  await tracker
    .locator(".chain-library-card")
    .filter({ hasText: "v1.0" })
    .getByRole("button", { name: "Open chain entity" })
    .click();
  await expect(
    tracker.getByRole("heading", { name: "Arcane Realms" }).first(),
  ).toBeVisible();
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("revision");
  await tracker.getByRole("button", { name: "Add to chain" }).click();
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(10);
  await expect(
    tracker.getByText("Version 1.1 · Imported package"),
  ).toBeVisible();
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("does not exist");
  await expect(
    tracker.getByText("No available jumps match this filter."),
  ).toBeVisible();
});

test("duplicate Jump setting adds independent exact entries and aggregates matching ranks", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  await page.getByLabel("Allow duplicate jumps").check();
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Arcane Realms");
  const exact = tracker
    .locator(".chain-library-card")
    .filter({ hasText: "v1.0" });
  await expect(
    exact.getByRole("button", { name: "Add to chain again (x2)" }),
  ).toBeVisible();
  await testInfo.attach("duplicate-jump-library-action", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await exact.getByRole("button", { name: "Add to chain again (x2)" }).click();
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(10);
  await expect(
    tracker.getByRole("checkbox", { name: "Take Dragon Form" }),
  ).not.toBeChecked();
  await expect(
    tracker.getByRole("checkbox", { name: "Take Draconic Resilience" }),
  ).toBeDisabled();
  await tracker.getByLabel("Technique Ranks").fill("2");

  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByLabel("Search inventory").fill("Technique Ranks");
  const aggregate = tracker
    .locator(".chain-record-list > article")
    .filter({ hasText: "Technique Ranks" });
  await expect(aggregate).toHaveCount(1);
  await expect(aggregate.locator(".record-measure")).toHaveText([
    "Rank 2",
    "x2",
  ]);
  await aggregate.click();
  const aggregateDetail = tracker.getByRole("dialog", {
    name: /perk details: Technique Ranks/i,
  });
  await expect(aggregateDetail.locator(".record-detail-measure")).toHaveText([
    "Rank2",
    "Quantity2",
  ]);
  await expect(
    aggregateDetail.locator(".record-detail-acquisitions li"),
  ).toHaveCount(2);
  await testInfo.attach("duplicate-ranked-grant-aggregation", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");

  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Arcane Realms");
  await expect(
    tracker
      .locator(".chain-library-card")
      .filter({ hasText: "v1.0" })
      .getByRole("button", { name: "Add to chain again (x3)" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  await page.getByLabel("Allow duplicate jumps").uncheck();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await tracker.getByRole("tab", { name: "Chain", exact: true }).click();
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(10);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await expect(
    tracker
      .locator(".chain-library-card")
      .filter({ hasText: "v1.0" })
      .getByRole("button", { name: "Open chain entity" }),
  ).toBeVisible();
});

test("Inventory combines historical, kind, relationship, alias, text, empty, and record-detail behavior", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  expect(
    await tracker.locator(".chain-record-list > article").count(),
  ).toBeGreaterThanOrEqual(60);
  const badgeStyles = await tracker
    .locator(".chain-record-list .tag-profile-badge")
    .evaluateAll((badges) =>
      badges.map((badge) => {
        const style = getComputedStyle(badge);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderColor: style.borderColor,
        };
      }),
    );
  expect(
    new Set(
      badgeStyles.map(
        (style) => `${style.backgroundColor}|${style.backgroundImage}`,
      ),
    ).size,
  ).toBeGreaterThan(6);
  expect(
    badgeStyles.some((style) =>
      style.backgroundImage.includes("linear-gradient"),
    ),
  ).toBe(true);
  expect(
    badgeStyles.some(
      (style) =>
        style.backgroundImage === "none" &&
        style.backgroundColor !== "rgba(0, 0, 0, 0)",
    ),
  ).toBe(true);
  expect(
    badgeStyles.some((style) => style.backgroundColor === "rgba(0, 0, 0, 0)"),
  ).toBe(true);
  await tracker.getByRole("button", { name: "Perks", exact: true }).click();
  const perkCount = await tracker
    .locator(".chain-record-list > article")
    .count();
  expect(perkCount).toBeGreaterThan(40);
  await tracker.getByRole("button", { name: /◆ Magic/ }).click();
  const magicCount = await tracker
    .locator(".chain-record-list > article")
    .count();
  expect(magicCount).toBeGreaterThan(0);
  expect(magicCount).toBeLessThan(perkCount);
  await tracker.getByLabel("Search inventory").fill("Fire Control");
  await expect(tracker.getByText("Warded Soul", { exact: true })).toBeVisible();
  await tracker.getByText("Warded Soul", { exact: true }).click();
  const detail = tracker.getByRole("dialog", {
    name: /perk details: Warded Soul/i,
  });
  await expect(detail).toContainText("Acquired in Arcane Realms");
  await expect(detail.locator(".tag-profile-badge")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await tracker
    .getByLabel("Search inventory")
    .fill("nothing matches this query");
  await expect(
    tracker.getByText("No inventory records match these filters."),
  ).toBeVisible();
  await tracker
    .getByLabel("Inventory through historical cutoff")
    .selectOption("entry-1");
  await expect(tracker.getByRole("status")).toContainText(
    "through Arcane Realms",
  );
});

test("Inventory scopes companion purchases and projects ranked, conditional perk details", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  const search = tracker.getByLabel("Search inventory");

  await search.fill("Impossible Vessel");
  await expect(
    tracker.getByText("Impossible Vessel", { exact: true }),
  ).toHaveCount(1);
  await testInfo.attach("inventory-single-impossible-vessel", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await search.fill("Random Training");
  const training = tracker
    .locator(".chain-record-list > article")
    .filter({ hasText: "Random Training" });
  await expect(training).toContainText("Rank 3");
  await training.click();
  const trainingDetail = tracker.getByRole("dialog", {
    name: /perk details: Random Training/i,
  });
  await expect(trainingDetail.locator(".record-detail-measure")).toContainText(
    "Rank3",
  );
  await testInfo.attach("ranked-perk-inventory-and-detail", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");

  await search.fill("Training Manuals");
  const manuals = tracker
    .locator(".chain-record-list > article")
    .filter({ hasText: "Training Manuals" });
  await expect(manuals.locator(".record-measure")).toHaveText("x3");
  await manuals.click();
  await expect(
    tracker.getByRole("dialog", { name: /item details: Training Manuals/i }),
  ).toContainText("Quantity3");
  await testInfo.attach("quantity-item-inventory-and-detail", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");

  await search.fill("Draconic Resilience");
  await expect(tracker.locator(".chain-record-list > article")).toHaveCount(0);

  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await tracker
    .getByRole("button", { name: /5\. Pilgrims of the Spirit Road/ })
    .click();
  await tracker.getByRole("button", { name: "Apply Gauntlet rules" }).click();
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await search.fill("Shrine Keeper");
  await tracker.getByText("Shrine Keeper", { exact: true }).click();
  const shrineDetail = tracker.getByRole("dialog", {
    name: /perk details: Shrine Keeper/i,
  });
  await expect(shrineDetail).toContainText(
    "Even without supernatural power, your discipline preserves sacred ground.",
  );
  await testInfo.attach("conditional-perk-detail-description", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("the settled radar and pie reproduce selection, correlation, popping, sorting, drilling, ellipsis, and navigation", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByRole("tab", { name: "Stats" }).click();
  await expect(tracker.locator(".radar-axis")).toHaveCount(12);
  await expect(tracker.locator(".radar-point")).toHaveCount(12);
  const radarLabels = tracker.locator("#category-radar-svg .radar-label");
  await expect(radarLabels).toHaveCount(12);
  expect(
    await radarLabels
      .first()
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
  ).toBeGreaterThanOrEqual(15);
  expect(
    new Set(
      await radarLabels.evaluateAll((labels) =>
        labels.map((label) => getComputedStyle(label).fill),
      ),
    ).size,
  ).toBeGreaterThan(6);
  await expect(tracker.locator(".category-radar-data tbody tr")).toHaveCount(
    12,
  );
  await testInfo.attach("radar-default-record-scope", {
    body: await tracker.locator(".tracker-radar-page").screenshot(),
    contentType: "image/png",
  });
  expect(
    (
      await tracker.locator(".category-radar-data tbody td").allTextContents()
    ).every((value) => Number(value) > 0),
  ).toBe(true);
  await tracker.getByLabel("Sort radar categories").selectOption("tag");
  await expect(
    tracker.locator(".category-radar-data tbody tr").first(),
  ).toContainText("Combat");
  const magic = tracker
    .locator(".category-radar-data button")
    .filter({ hasText: "Magic" });
  await magic.focus();
  await page.keyboard.press("Enter");
  await expect(magic).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(tracker.getByText("Magic breakdown")).toBeVisible();
  await expect(tracker.locator(".pie-slice")).toHaveCount(10);
  await expect(tracker.locator("[data-pie-row]")).toHaveCount(10);
  await expect(tracker.locator(".pie-center-label")).toHaveText("Magic");
  await expect(
    tracker.getByRole("button", { name: /more tags, .* records/i }),
  ).toBeVisible();

  const pathsBeforeSort = await tracker
    .locator(".pie-slice")
    .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  await tracker.getByLabel("Sort radar categories").selectOption("tag");
  expect(
    await tracker
      .locator(".pie-slice")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
  ).toEqual(pathsBeforeSort);

  const pyrokinesis = tracker.getByRole("button", {
    name: /Pyrokinesis, .* records/i,
  });
  const pieKey = await pyrokinesis
    .locator("xpath=ancestor::tr")
    .getAttribute("data-pie-row");
  await pyrokinesis.hover();
  await expect(tracker.locator("#category-radar-caption")).toContainText(
    "aka Fire Control +1",
  );
  await expect(
    tracker.locator(`.pie-slice[data-pie-key="${pieKey}"]`),
  ).toHaveClass(/is-hovered/);
  await pyrokinesis.click();
  await expect(pyrokinesis).toHaveAttribute("aria-pressed", "true");
  await expect(
    tracker.locator(`.pie-slice[data-pie-key="${pieKey}"]`),
  ).toHaveClass(/is-popped/);
  await pyrokinesis.press("Enter");
  await expect(tracker.locator("#category-radar-title")).toHaveText(
    "Pyrokinesis",
  );
  await expect(tracker.locator("#category-chart-breadcrumbs")).toContainText(
    "All categories / Magic / Pyrokinesis",
  );
  await tracker.getByRole("button", { name: "← Magic" }).click();
  await expect(tracker.locator(".pie-center-label")).toHaveText("Magic");
  await tracker
    .getByRole("button", { name: /more tags, .* records/i })
    .dblclick();
  await expect(tracker.locator("#category-radar-title")).toHaveText(
    "More in Magic",
  );
  await tracker.getByRole("button", { name: "All categories" }).click();
  await expect(tracker.locator(".radar-axis")).toHaveCount(12);
});

test("Forms use historical roster, detail, profile, nested perk details, and ordered focus restoration", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  await tracker
    .getByLabel("Forms through historical cutoff")
    .selectOption("entry-2");
  await expect(tracker.locator(".chain-form-grid > article")).toHaveCount(1);
  await tracker
    .locator(".chain-form-grid > article")
    .filter({ hasText: "Dragon Form" })
    .getByRole("button", { name: "View" })
    .click();
  await expect(tracker.locator(".chain-form-detail")).toContainText(
    "Dragon Form",
  );
  await tracker.getByRole("button", { name: "Full details" }).click();
  const profile = tracker.getByRole("dialog", {
    name: /Form details: Dragon Form/,
  });
  await expect(profile).toContainText("Form perks");
  await expect(profile).toContainText("Draconic Resilience");
  await testInfo.attach("granted-form-profile", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const perk = profile.locator(".companion-profile-columns button").first();
  await perk.click();
  const record = tracker.getByRole("dialog", { name: /details:/ });
  await expect(record).toBeVisible();
  await record
    .getByRole("button", { name: "Close perk or item details" })
    .click();
  await expect(profile).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(profile).toHaveCount(0);
});

test("removing a granted form reviews and clears its assigned perks", async ({
  page,
}, testInfo) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("button", { name: /2\. Arcane Realms/ }).click();
  await tracker.getByRole("checkbox", { name: "Take Dragon Form" }).click();
  const review = tracker.getByRole("dialog", { name: "Review clear-form" });
  await expect(review).toContainText("Draconic Resilience");
  await testInfo.attach("form-removal-dependency-review", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await review.getByRole("button", { name: "Remove form and perks" }).click();
  await expect(
    tracker.getByRole("checkbox", { name: "Take Dragon Form" }),
  ).not.toBeChecked();
  await expect(
    tracker.getByRole("checkbox", { name: "Take Draconic Resilience" }),
  ).toBeDisabled();
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  await expect(tracker.locator(".chain-form-grid > article")).toHaveCount(0);
});

test("Companions use historical roster, profile imports, and stacked perk/item details", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker?fixture=companion-profiles");
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Companions/ }).click();
  await tracker
    .getByLabel("Roster through historical cutoff")
    .selectOption("entry-7");
  await expect(tracker.locator(".chain-companion-grid > article")).toHaveCount(
    7,
  );
  await tracker
    .locator(".chain-companion-grid > article")
    .filter({ hasText: "Mira" })
    .getByRole("button", { name: "View" })
    .click();
  await tracker.getByRole("button", { name: "Full profile" }).click();
  const profile = tracker.getByRole("dialog", {
    name: /Companion profile: Mira/,
  });
  const profileWidth = (await profile.boundingBox())!.width;
  const profileSections = profile.locator(".companion-profile-columns section");
  const perks = profileSections.nth(0).locator(".companion-profile-list");
  const items = profileSections.nth(1).locator(".companion-profile-list");
  const imports = profileSections.nth(2).locator(".companion-profile-list");
  await expect(perks.locator("li")).toHaveCount(10);
  await expect(perks).toHaveClass(/is-scrollable/);
  await expect(items.locator("li")).toHaveCount(6);
  await expect(items).toHaveClass(/is-scrollable/);
  await expect(imports).not.toHaveClass(/is-scrollable/);
  await expect
    .poll(() => perks.evaluate((list) => list.scrollHeight > list.clientHeight))
    .toBe(true);
  await expect
    .poll(() => items.evaluate((list) => list.scrollHeight > list.clientHeight))
    .toBe(true);
  await expect
    .poll(() =>
      imports.evaluate((list) => list.scrollHeight <= list.clientHeight),
    )
    .toBe(true);
  await testInfo.attach("companion-full-profile", {
    body: await profile.screenshot(),
    contentType: "image/png",
  });
  await perks.hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => perks.evaluate((list) => list.scrollTop))
    .toBeGreaterThan(0);
  await items.hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => items.evaluate((list) => list.scrollTop))
    .toBeGreaterThan(0);
  await testInfo.attach("companion-full-profile-scrolled", {
    body: await profile.screenshot(),
    contentType: "image/png",
  });
  await expect(profile).toContainText("Imported into");
  await expect(profile).toContainText("Impossible Vessel");
  await profile
    .locator(".companion-profile-columns button")
    .filter({ hasText: "Impossible Vessel" })
    .click();
  const details = tracker.getByRole("dialog", { name: /details:/ });
  await expect(details).toBeVisible();
  await expect(
    tracker.locator(".companion-profile-layer").locator("xpath=.."),
  ).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("Escape");
  await expect(profile).toBeVisible();
  await profile
    .getByRole("button", { name: "Close companion profile" })
    .click();

  await tracker
    .locator(".chain-companion-grid > article")
    .filter({ hasText: "Cala" })
    .getByRole("button", { name: "View" })
    .click();
  await tracker.getByRole("button", { name: "Full profile" }).click();
  const emptyProfile = tracker.getByRole("dialog", {
    name: /Companion profile: Cala/,
  });
  await expect(
    emptyProfile.getByText("Companion has no perks", { exact: true }),
  ).toBeVisible();
  await expect(
    emptyProfile.getByText("Companion has no items", { exact: true }),
  ).toBeVisible();
  await expect(
    emptyProfile.getByText("Companion has not been imported into any jumps", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    emptyProfile.getByRole("heading", { name: "Perks" }),
  ).toHaveCount(0);
  await expect(
    emptyProfile.getByRole("heading", { name: "Items" }),
  ).toHaveCount(0);
  await expect(
    emptyProfile.getByRole("heading", { name: "Imported into" }),
  ).toHaveCount(0);
  expect((await emptyProfile.boundingBox())!.width).toBe(profileWidth);
  await testInfo.attach("empty-companion-full-profile", {
    body: await emptyProfile.screenshot(),
    contentType: "image/png",
  });
});

test("embedded supplements preserve module behavior and Supp disappears when all modules are disabled", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Supplements" }).click();
  await expect(
    tracker.getByRole("heading", { name: "Manage supplements" }),
  ).toBeVisible();
  const toggles = tracker.locator(".supplement-manage-list input");
  for (let index = 0; index < (await toggles.count()); index += 1) {
    if (await toggles.nth(index).isChecked())
      await toggles.nth(index).uncheck();
  }
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await expect(tracker.getByRole("button", { name: "Supp" })).toHaveCount(0);
  await tracker.getByRole("tab", { name: "Supplements" }).click();
  await tracker
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Story" })
    .getByRole("checkbox")
    .check();
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await tracker.getByRole("button", { name: /2\. Arcane Realms/ }).click();
  await tracker.getByRole("button", { name: "Supp" }).click();
  const overlay = tracker.getByRole("dialog", {
    name: "Arcane Realms current-Jump supplements",
  });
  await expect(
    overlay.getByRole("button", { name: "Story Write this Jump" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    overlay.getByText("Selected Jump · Arcane Realms"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    tracker.getByRole("button", { name: "Supp", exact: true }),
  ).toBeFocused();
});

test("primary tabs support keyboard navigation and the narrow frame exposes intentional overflow", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  const jump = tracker.getByRole("tab", { name: /^Chain & Jump/ });
  await jump.focus();
  await page.keyboard.press("End");
  await expect(
    tracker.getByRole("tab", { name: "Supplements" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(jump).toHaveAttribute("aria-selected", "true");
  await page.setViewportSize({ width: 620, height: 820 });
  await expect
    .poll(() =>
      tracker.evaluate((node) => node.scrollWidth >= node.clientWidth),
    )
    .toBe(true);
  const list = tracker.locator(".chain-jump-list");
  await list.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    tracker.getByRole("button", { name: /1\. First Step/ }),
  ).toBeVisible();
  await expect(tracker.locator(".chain-jump-entry.is-earth")).toBeVisible();
});

test("reference fixture retains the documented three-Jump composition", async ({
  page,
}) => {
  await page.goto("/review/chain-tracker?fixture=reference");
  const tracker = trackerFor(page);
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(4);
  await expect(tracker.getByText("3 Jumps", { exact: true })).toBeVisible();
  await expect(
    tracker.getByRole("heading", { name: "Arcane Realms" }).first(),
  ).toBeVisible();
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await expect(tracker.locator(".chain-record-list > article")).toHaveCount(18);
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  await expect(tracker.locator(".chain-form-grid > article")).toHaveCount(1);
});
