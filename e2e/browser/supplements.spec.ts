import { expect, test } from "./support/fixtures";
import { shouldCaptureReviewArtifacts } from "./support/reviewArtifacts";

test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.goto("/review/supplements");
});

test("renders both exact Chain Tracker review scenarios", async ({ page }) => {
  await expect(
    page.getByLabel("Chain and Jump contextual supplement scenario"),
  ).toBeVisible();
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  await expect(workspace).toBeVisible();
  await expect(
    workspace.getByRole("tab", { name: "Supplements" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    workspace.getByRole("heading", { name: "Manage supplements" }),
  ).toBeVisible();
  await expect(
    workspace.locator(".supplement-manage-list > article"),
  ).toHaveCount(8);
});

test(
  "uses the wider desktop review frame without horizontal workspace scrolling",
  { tag: "@cross-browser" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const jump = page.getByLabel(
      "Chain and Jump contextual supplement scenario",
    );
    const workspace = page.getByLabel(
      "Chain Tracker Supplements workspace scenario",
    );
    const jumpBox = await jump.boundingBox();
    const workspaceBox = await workspace.boundingBox();
    expect(jumpBox?.width).toBeGreaterThan(1000);
    expect(workspaceBox?.width).toBe(jumpBox?.width);
    await expect
      .poll(() =>
        jump
          .locator(".chain-page-stack")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
  },
);

test(
  "mutual exclusion updates tabs, tools, and preserves the alternative's local state",
  { tag: "@smoke" },
  async ({ page }) => {
    const workspace = page.getByLabel(
      "Chain Tracker Supplements workspace scenario",
    );
    const essentialRow = workspace
      .locator(".supplement-manage-list article")
      .filter({ hasText: "Essential Body Modification" });
    await essentialRow.getByRole("checkbox").check();
    await expect(
      workspace.getByRole("tab", { name: "Essential Body Mod" }),
    ).toBeVisible();
    await expect(
      workspace.getByRole("tab", { name: "Body Mod", exact: true }),
    ).toHaveCount(0);
    await expect(
      workspace
        .locator(".supplement-manage-list article")
        .filter({ hasText: "Classic Body Mod" })
        .getByRole("checkbox"),
    ).not.toBeChecked();

    await essentialRow.getByRole("button", { name: "Open page" }).click();
    await workspace.getByRole("button", { name: "Essences" }).click();
    await workspace.getByRole("button", { name: "Scholar" }).click();
    await workspace.getByRole("tab", { name: "Manage" }).click();
    await essentialRow.getByRole("checkbox").uncheck();
    await essentialRow.getByRole("checkbox").check();
    await essentialRow.getByRole("button", { name: "Open page" }).click();
    await workspace.getByRole("button", { name: "Essences" }).click();
    await expect(
      workspace.getByRole("button", { name: "Scholar" }),
    ).toHaveAttribute("aria-pressed", "true");
  },
);

test("hides Supp when every supplement is disabled and restores it when one is enabled", async ({
  page,
}) => {
  const jump = page.getByLabel("Chain and Jump contextual supplement scenario");
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const toggles = workspace.locator(".supplement-manage-list input");

  for (let index = 0; index < (await toggles.count()); index += 1) {
    const toggle = toggles.nth(index);
    if (await toggle.isChecked()) await toggle.uncheck();
  }

  await expect(jump.getByRole("button", { name: "Supp" })).toHaveCount(0);
  const storyToggle = workspace
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Story" })
    .getByRole("checkbox");
  await storyToggle.check();
  await expect(jump.getByRole("button", { name: "Supp" })).toBeVisible();
});

test("Limited Inheritance pool controls align, retain their limit, and keep later pools reachable", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const row = workspace
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Limited Inheritance" });
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "Open page" }).click();

  const supplement = workspace.locator(".limited-full-mock");
  await expect
    .poll(() =>
      supplement.evaluate((element) => {
        const body = element.querySelector(".limited-full-body");
        if (!(body instanceof HTMLElement)) return Number.POSITIVE_INFINITY;
        const supplementBox = element.getBoundingClientRect();
        const bodyBox = body.getBoundingClientRect();
        return Math.abs(supplementBox.bottom - bodyBox.bottom);
      }),
    )
    .toBeLessThan(1);
  const firstPool = supplement.locator(".limited-pool-card").first();
  await expect(firstPool.locator("fieldset input")).toHaveCount(0);
  const perkPill = firstPool.getByRole("button", { name: "Perks" });
  await expect(perkPill).toHaveAttribute("aria-pressed", "true");
  await perkPill.click();
  await expect(perkPill).toHaveAttribute("aria-pressed", "false");

  const allowance = firstPool.locator(".limited-unlimited-toggle");
  const stepper = firstPool.locator(".number-stepper");
  const [allowanceBox, stepperBox] = await Promise.all([
    allowance.boundingBox(),
    stepper.boundingBox(),
  ]);
  expect(Math.abs((allowanceBox?.y ?? 0) - (stepperBox?.y ?? 0))).toBeLessThan(
    1,
  );
  expect(
    Math.abs((allowanceBox?.height ?? 0) - (stepperBox?.height ?? 0)),
  ).toBeLessThan(1);

  const limit = firstPool.getByRole("spinbutton", {
    name: "Per-Jump limit",
  });
  const unlimited = firstPool.getByRole("checkbox", { name: "Unlimited" });
  await expect(limit).toHaveValue("2");
  await unlimited.check();
  await expect(limit).toBeDisabled();
  await expect(limit).toHaveValue("2");
  await unlimited.uncheck();
  await firstPool.getByTitle("Increase Per-Jump limit").click();
  await expect(limit).toHaveValue("3");

  for (let index = 0; index < 8; index += 1)
    await supplement.getByRole("button", { name: "+ Add pool" }).click();
  const poolList = supplement.locator(".limited-pool-list");
  const expectStepperRailInsideInput = async (pool: typeof firstPool) => {
    const [inputBox, railBox] = await Promise.all([
      pool.getByRole("spinbutton", { name: "Per-Jump limit" }).boundingBox(),
      pool.locator(".number-stepper-buttons").boundingBox(),
    ]);
    expect(railBox?.y ?? 0).toBeGreaterThanOrEqual(inputBox?.y ?? 0);
    expect((railBox?.y ?? 0) + (railBox?.height ?? 0)).toBeLessThanOrEqual(
      (inputBox?.y ?? 0) + (inputBox?.height ?? 0),
    );
    expect(
      Math.abs(
        (inputBox?.x ?? 0) +
          (inputBox?.width ?? 0) -
          ((railBox?.x ?? 0) + (railBox?.width ?? 0)),
      ),
    ).toBeLessThan(2);
  };
  await expect
    .poll(() =>
      poolList.evaluate((element) => ({
        scrollable: element.scrollHeight > element.clientHeight,
        overflow: getComputedStyle(element).overflowY,
      })),
    )
    .toEqual({ scrollable: true, overflow: "auto" });
  const lastPool = supplement.locator(".limited-pool-card").last();
  await lastPool.scrollIntoViewIfNeeded();
  await expect(lastPool).toBeInViewport();
  const lastLimit = lastPool.getByRole("spinbutton", {
    name: "Per-Jump limit",
  });
  await lastPool.getByTitle("Increase Per-Jump limit").click();
  await expect(lastLimit).toHaveValue("2");
  await expectStepperRailInsideInput(lastPool);
  const lastPerkPill = lastPool.getByRole("button", { name: "Perks" });
  await lastPerkPill.click();
  await expect(lastPerkPill).toHaveAttribute("aria-pressed", "true");
  await lastPool.getByRole("button", { name: "Remove" }).click();
  await expect(
    page.getByRole("dialog", { name: "Remove inheritance pool?" }),
  ).toHaveCount(0);
  await expect(supplement.locator(".limited-pool-card")).toHaveCount(10);
  const finalPool = supplement.locator(".limited-pool-card").last();
  await expectStepperRailInsideInput(finalPool);

  await page.evaluate(() => {
    document.documentElement.dataset.appTheme = "light";
  });
  await expect(supplement.locator(".limited-pool-heading p")).toHaveCSS(
    "color",
    "rgb(165, 43, 100)",
  );
  await page.setViewportSize({ width: 720, height: 900 });
  await expect
    .poll(() =>
      supplement.locator(".limited-full-body").evaluate((element) => ({
        columns:
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
        contained: element.scrollWidth <= element.clientWidth,
      })),
    )
    .toEqual({ columns: 1, contained: true });
});

test("Limited Inheritance confirms only assigned pool removal and uses its Cancel action", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const row = workspace
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Limited Inheritance" });
  await row.getByRole("checkbox").check();

  const scenario = page.getByLabel(
    "Chain and Jump contextual supplement scenario",
  );
  await scenario.getByRole("button", { name: "Supp" }).click();
  let dialog = scenario.getByRole("dialog");
  await dialog
    .getByRole("button", { name: /Limited Inheritance.*Choose what continues/ })
    .click();
  await dialog
    .locator(".limited-candidate-list article")
    .filter({ hasText: "Gate Scholar" })
    .getByRole("button", { name: "Keep" })
    .click();
  await page.keyboard.press("Escape");

  await row.getByRole("button", { name: "Open page" }).click();
  const supplement = workspace.locator(".limited-full-mock");
  const firstPool = supplement.locator(".limited-pool-card").first();
  await firstPool.getByRole("button", { name: "Remove" }).click();
  dialog = page.getByRole("dialog", { name: "Remove inheritance pool?" });
  await expect(dialog).toContainText(
    "Jump choices and companion import history remain unchanged.",
  );
  await expect(
    dialog.getByRole("button", { name: "Close Remove inheritance pool?" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(supplement.locator(".limited-pool-card")).toHaveCount(3);

  await firstPool.getByRole("button", { name: "Remove" }).click();
  dialog = page.getByRole("dialog", { name: "Remove inheritance pool?" });
  await dialog.getByRole("button", { name: "Remove pool" }).click();
  await expect(supplement.locator(".limited-pool-card")).toHaveCount(2);
});

test("Limited Inheritance Supp pools collapse and retain their selection summaries", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const row = workspace
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Limited Inheritance" });
  await row.getByRole("checkbox").check();

  const scenario = page.getByLabel(
    "Chain and Jump contextual supplement scenario",
  );
  await scenario.getByRole("button", { name: "Supp" }).click();
  const dialog = scenario.getByRole("dialog");
  await dialog
    .getByRole("button", { name: /Limited Inheritance.*Choose what continues/ })
    .click();

  const pools = dialog.locator(".limited-dialog-pool");
  await expect(pools).toHaveCount(3);
  const firstPool = pools.first();
  const disclosure = firstPool.locator(".limited-pool-disclosure");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(firstPool).toContainText("0 of 2 selected");
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(firstPool.locator(".limited-candidate-list")).toBeHidden();
  await expect(firstPool).toContainText("0 of 2 selected");
  await disclosure.click();

  for (const name of ["Gate Scholar", "Traveler's Pack", "Lyra", "Prism Form"])
    await pools
      .locator(".limited-candidate-list article")
      .filter({ hasText: name })
      .getByRole("button", { name: "Keep" })
      .click();
  await expect(dialog.getByText("Unselect")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(scenario.getByRole("button", { name: "Supp" })).toBeFocused();
});

test("Limited Inheritance suppresses empty pools, explains capacity, and applies unlimited pools automatically", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const row = workspace
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Limited Inheritance" });
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "Open page" }).click();
  const supplement = workspace.locator(".limited-full-mock");
  await supplement.getByRole("button", { name: "+ Add pool" }).click();
  const firstPool = supplement.locator(".limited-pool-card").first();
  await firstPool.getByTitle("Decrease Per-Jump limit").click();

  const scenario = page.getByLabel(
    "Chain and Jump contextual supplement scenario",
  );
  await scenario.getByRole("button", { name: "Supp" }).click();
  let dialog = scenario.getByRole("dialog");
  await dialog
    .getByRole("button", { name: /Limited Inheritance.*Choose what continues/ })
    .click();
  await expect(dialog.locator(".limited-dialog-pool")).toHaveCount(3);
  await dialog
    .locator(".limited-candidate-list article")
    .filter({ hasText: "Gate Scholar" })
    .getByRole("button", { name: "Keep" })
    .click();
  const blocked = dialog
    .locator(".limited-candidate-list article")
    .filter({ hasText: "Traveler's Pack" });
  await expect(blocked.getByRole("button", { name: "Keep" })).toBeDisabled();
  await expect(blocked).toContainText(
    "This pool cannot accept another selection.",
  );
  await page.keyboard.press("Escape");

  await firstPool.getByRole("checkbox", { name: "Unlimited" }).check();
  await scenario.getByRole("button", { name: "Supp" }).click();
  dialog = scenario.getByRole("dialog");
  await expect(
    dialog
      .locator(".limited-candidate-list article")
      .filter({ hasText: "Traveler's Pack" }),
  ).toContainText("Automatic");
});

test("context overlay highlights and switches its embedded supplement tool without a second dialog", async ({
  page,
}) => {
  const scenario = page.getByLabel(
    "Chain and Jump contextual supplement scenario",
  );
  const supp = scenario.getByRole("button", { name: "Supp" });
  await supp.click();
  const menu = scenario.getByRole("dialog");
  await expect(
    menu.getByRole("button", { name: /Classic Body Mod/ }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", { name: /Classic Body Mod/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    menu.getByRole("heading", { name: "Body Mod at a glance" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", { name: /Essential Body Mod/ }),
  ).toHaveCount(0);
  const questTool = menu.getByRole("button", {
    name: "Quest Mode Quest checklist",
  });
  await questTool.click();
  await expect(questTool).toHaveAttribute("aria-pressed", "true");
  await expect(
    menu.getByRole("button", { name: /Classic Body Mod/ }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.locator(".review-modal-layer")).toHaveCount(0);
  const dialog = menu;
  await expect(
    dialog.getByRole("heading", { name: "Quest progress" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("300 CP", { exact: true }).first(),
  ).toBeVisible();
  await dialog.getByLabel("Become a master").check();
  await expect(
    dialog.getByText("500 CP", { exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(supp).toBeFocused();
});

test(
  "supplement tabs support keyboard navigation and module controls remain live",
  { tag: "@cross-browser" },
  async ({ page }) => {
    const workspace = page.getByLabel(
      "Chain Tracker Supplements workspace scenario",
    );
    const manage = workspace.getByRole("tab", { name: "Manage" });
    await manage.focus();
    await page.keyboard.press("End");
    await expect(workspace.getByRole("tab", { name: "Story" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Home");
    await expect(manage).toHaveAttribute("aria-selected", "true");
    await workspace.getByRole("button", { name: "Open page" }).nth(0).click();
    await workspace.getByRole("tab", { name: "Stats" }).click();
    const strength = workspace.getByRole("button", {
      name: "Increase Strength",
    });
    await strength.click();
    await expect(strength.locator("xpath=../output")).toHaveText("2");
  },
);

test("Classic Body Mod Bestial configuration, descriptions, overspend, and dialog stay synchronized", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  await workspace.getByRole("button", { name: "Open page" }).first().click();
  await workspace.getByRole("button", { name: /Bestial/ }).click();
  await expect(workspace.getByLabel("Bestial animal")).toBeVisible();
  await workspace.getByLabel("Bestial animal").fill("Fox");
  await expect(workspace.locator(".bodymod-free-grants")).toContainText(
    "Sense 2 · Color 1 · Speed 1",
  );

  await workspace.getByRole("tab", { name: "Stats" }).click();
  await expect(
    workspace.getByText("Bench press roughly 180 pounds."),
  ).toBeVisible();
  await workspace.getByRole("tab", { name: "Perks" }).click();
  await expect(
    workspace.getByText(
      "Adjust height up to one foot from the current age-group average.",
    ),
  ).toBeVisible();
  await workspace.getByRole("button", { name: "Increase Endowed" }).click();
  await workspace.getByRole("button", { name: "Increase Winged" }).click();
  await workspace.getByRole("button", { name: "Increase Genderswap" }).click();
  await workspace.getByRole("tab", { name: "Review" }).click();
  const diagnostic = workspace.locator(".bodymod-review-diagnostic");
  await expect(diagnostic).toContainText("over budget");
  await expect(diagnostic).toHaveClass(/is-negative/);

  const jump = page.getByLabel("Chain and Jump contextual supplement scenario");
  await jump.getByRole("button", { name: "Supp" }).click();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: /Classic Body Mod/ })
    .click();
  const dialog = jump.getByRole("dialog");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    dialog.getByRole("heading", { name: "Body Mod at a glance" }),
  ).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Bestial" })).toBeVisible();
  await expect(
    dialog.locator("dt", { hasText: "Jump species" }).locator("xpath=../dd"),
  ).toHaveText("Fox Demi-Human");
  await expect(
    dialog.locator("dt", { hasText: "Body Mod" }).locator("xpath=../dd"),
  ).toHaveText("Bestial");
  await expect(dialog.locator(".bodymod-dialog-stat")).toHaveCount(7);
  const strength = dialog
    .locator(".bodymod-dialog-stat")
    .filter({ hasText: "Strength" });
  await expect(strength.locator(".bodymod-dialog-bar i")).toHaveAttribute(
    "style",
    /25%/,
  );
  await strength.hover();
  await expect(strength.getByRole("tooltip")).toContainText(
    "Bench press roughly 180 pounds.",
  );
  await dialog.getByRole("button", { name: "Height 1" }).click();
  await expect(dialog.locator(".bodymod-dialog-perk-detail")).toContainText(
    "Adjust height up to one foot",
  );
});

test("Classic Body Mod replaces old body-type grants instead of stacking them", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  await workspace.getByRole("button", { name: "Open page" }).first().click();
  await workspace.getByRole("button", { name: /Bodybuilder/ }).click();
  await workspace.getByRole("tab", { name: "Stats" }).click();
  await expect(
    workspace
      .getByRole("button", { name: "Increase Dexterity" })
      .locator("xpath=../output"),
  ).toHaveText("0");
  await expect(
    workspace
      .getByRole("button", { name: "Increase Endurance" })
      .locator("xpath=../output"),
  ).toHaveText("2");
  await workspace.getByRole("tab", { name: "Perks" }).click();
  await expect(
    workspace
      .getByRole("button", { name: "Increase Flexibility" })
      .locator("xpath=../output"),
  ).toHaveText("0");

  await workspace.getByRole("tab", { name: "Build & body" }).click();
  await workspace.getByRole("button", { name: /Charmer/ }).click();
  await workspace.getByRole("tab", { name: "Stats" }).click();
  await expect(
    workspace
      .getByRole("button", { name: "Increase Endurance" })
      .locator("xpath=../output"),
  ).toHaveText("0");
  await expect(
    workspace
      .getByRole("button", { name: "Increase Appeal" })
      .locator("xpath=../output"),
  ).toHaveText("2");
  await workspace.getByRole("tab", { name: "Perks" }).click();
  await expect(
    workspace
      .getByRole("button", { name: "Increase Height" })
      .locator("xpath=../output"),
  ).toHaveText("1");
  await expect(
    workspace
      .getByRole("button", { name: "Increase Endowed" })
      .locator("xpath=../output"),
  ).toHaveText("3");
});

test("Story editor applies formatting and reports a focus-out save", async ({
  page,
}, testInfo) => {
  const scenario = page.getByLabel(
    "Chain and Jump contextual supplement scenario",
  );
  await scenario.getByRole("button", { name: "Supp" }).click();
  await scenario
    .getByRole("dialog")
    .getByRole("button", { name: /Story/ })
    .click();
  const dialog = scenario.getByRole("dialog");
  const outerScroller = dialog.locator(".chain-supp-context-content");
  await expect
    .poll(() =>
      outerScroller.evaluate(
        (node) => node.scrollHeight <= node.clientHeight + 1,
      ),
    )
    .toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    dialog.getByRole("heading", { name: "Story · Arcane Realms" }),
  ).toBeVisible();
  const source = dialog.getByLabel("Chapter 1 text");
  await source.fill("A new chapter");
  await source.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await dialog.getByRole("button", { name: "Bold" }).click();
  await expect(source.locator(".story-rich-token")).toHaveText("A new chapter");
  await expect(source.locator(".story-rich-token")).toHaveClass(/is-source/);
  await source.focus();
  const initialChapterCount = await dialog
    .locator(".story-chapter-editor")
    .count();
  await dialog.getByRole("button", { name: "+ Add chapter" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Saved");
  await expect(dialog.locator(".story-chapter-editor")).toHaveCount(
    initialChapterCount + 1,
  );

  const titles = dialog.locator(".story-chapter-editor > header input");
  const secondTitle = await titles.nth(1).inputValue();
  const firstChapter = dialog.locator(".story-chapter-editor").first();
  const secondChapter = dialog.locator(".story-chapter-editor").nth(1);
  const firstChapterHandle = firstChapter.locator(".story-chapter-handle");
  const previewTransfer = await page.evaluateHandle(() => new DataTransfer());
  await firstChapterHandle.dispatchEvent("dragstart", {
    dataTransfer: previewTransfer,
  });
  await expect(firstChapter).toHaveClass(/is-dragging/);
  const secondChapterBox = await secondChapter.boundingBox();
  expect(secondChapterBox).not.toBeNull();
  await secondChapter.dispatchEvent("dragover", {
    dataTransfer: previewTransfer,
    clientX: secondChapterBox!.x + secondChapterBox!.width / 2,
    clientY: secondChapterBox!.y + secondChapterBox!.height - 2,
  });
  await expect(secondChapter).toHaveClass(/is-drop-after/);
  if (shouldCaptureReviewArtifacts(testInfo)) {
    await testInfo.attach("story-chapter-accent-insertion-line-and-delete-x", {
      body: await dialog.screenshot(),
      contentType: "image/png",
    });
  }
  await firstChapterHandle.dispatchEvent("dragend", {
    dataTransfer: previewTransfer,
  });
  await expect(secondChapter).not.toHaveClass(/is-drop-/);
  await firstChapterHandle.dragTo(secondChapter, {
    targetPosition: {
      x: 10,
      y: Math.max(1, secondChapterBox!.height - 2),
    },
  });
  await expect(titles.first()).toHaveValue(secondTitle);
  if (shouldCaptureReviewArtifacts(testInfo)) {
    await testInfo.attach("story-chapter-reordered-after-indicated-drop", {
      body: await dialog.screenshot(),
      contentType: "image/png",
    });
  }

  await dialog.getByRole("button", { name: "Remove chapter 1" }).click();
  const confirmation = dialog.getByRole("alertdialog", {
    name: "Remove chapter?",
  });
  await expect(confirmation).toContainText("Are you sure");
  if (shouldCaptureReviewArtifacts(testInfo)) {
    await testInfo.attach("story-chapter-reorder-and-remove-confirmation", {
      body: await dialog.screenshot(),
      contentType: "image/png",
    });
  }
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog.locator(".story-chapter-editor")).toHaveCount(
    initialChapterCount + 1,
  );
  await dialog.getByRole("button", { name: "Remove chapter 1" }).click();
  await dialog
    .getByRole("alertdialog", { name: "Remove chapter?" })
    .getByRole("button", { name: "Remove chapter" })
    .click();
  await expect(dialog.locator(".story-chapter-editor")).toHaveCount(
    initialChapterCount,
  );
});

test("Story Live Preview reveals markers only for the cursor-local token and keeps its footer visible", async ({
  page,
}) => {
  const scenario = page.getByLabel(
    "Chain and Jump contextual supplement scenario",
  );
  await scenario.getByRole("button", { name: "Supp" }).click();
  await scenario
    .getByRole("dialog")
    .getByRole("button", { name: /Story/ })
    .click();
  const dialog = scenario.getByRole("dialog");
  const editor = dialog.getByLabel("Chapter 1 text");
  const token = editor.locator(".story-rich-token").first();

  await expect(dialog.locator("textarea")).toHaveCount(0);
  await expect(dialog.locator(".story-rich-token.is-source")).toHaveCount(0);
  await token.click();
  await expect(token).toHaveClass(/is-source/);

  await editor.evaluate((element) => {
    const plain = [...element.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.length,
    );
    if (!plain) throw new Error("Expected a plain-text segment");
    const range = document.createRange();
    range.setStart(plain, 1);
    range.collapse(true);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await expect(dialog.locator(".story-rich-token.is-source")).toHaveCount(0);

  const add = dialog.getByRole("button", { name: "+ Add chapter" });
  const [buttonBox, dialogBox] = await Promise.all([
    add.boundingBox(),
    dialog.boundingBox(),
  ]);
  expect(buttonBox).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(
    dialogBox!.y + dialogBox!.height,
  );
});

test("opens every detailed full page and exercises the searchable catalogs", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const open = async (name: string, heading: string) => {
    await workspace.getByRole("tab", { name: "Manage" }).click();
    const row = workspace
      .locator(".supplement-manage-list article")
      .filter({ hasText: name });
    if (!(await row.getByRole("checkbox").isChecked()))
      await row.getByRole("checkbox").check();
    await row.getByRole("button", { name: "Open page" }).click();
    await expect(
      workspace.getByRole("heading", { name: heading }).first(),
    ).toBeVisible();
  };

  await open("Classic Body Mod", "Classic Body Mod");
  await open("Essential Body Modification", "Essential Body Modification");
  await workspace.getByRole("button", { name: "Physical" }).click();
  await workspace
    .getByPlaceholder("Find a perk or ability")
    .fill("Regeneration");
  await expect(workspace.getByText(/^Regeneration/)).toBeVisible();
  await open("Cosmic Warehouse", "Cosmic Warehouse");
  await open("Personal Reality", "Personal Reality");
  await workspace.getByRole("button", { name: /Utilities/ }).click();
  await workspace.getByPlaceholder("Find an upgrade").fill("Portal");
  await expect(
    workspace.getByText("Portal Link", { exact: true }),
  ).toBeVisible();
  await open("Universal Drawbacks", "Universal Drawbacks");
  await workspace.getByRole("button", { name: "Chain 1 selected" }).click();
  await workspace
    .getByPlaceholder("Name, effect, or restriction")
    .fill("Without Why");
  await expect(
    workspace.getByText("Without Why", { exact: true }),
  ).toBeVisible();
  await open("Quest Mode", "Quest Mode");
  await open("Story", "Morgan’s Story");
});

test("Essential and Personal Reality projections share build and progression state", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const jump = page.getByLabel("Chain and Jump contextual supplement scenario");
  const enable = async (name: string) => {
    await workspace.getByRole("tab", { name: "Manage" }).click();
    const row = workspace
      .locator(".supplement-manage-list article")
      .filter({ hasText: name });
    if (!(await row.getByRole("checkbox").isChecked()))
      await row.getByRole("checkbox").check();
    await row.getByRole("button", { name: "Open page" }).click();
  };

  await enable("Essential Body Modification");
  await workspace.getByRole("button", { name: "Essences" }).click();
  await workspace.getByRole("button", { name: "Scholar" }).click();
  await jump.getByRole("button", { name: "Supp" }).click();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: "Essential Body Mod At a glance" })
    .click();
  await expect(
    jump.getByRole("dialog").getByRole("heading", { name: "Scholar Essence" }),
  ).toBeVisible();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: "Physical Perfection II" })
    .click();
  await expect(
    jump.getByRole("dialog").locator(".essential-dialog-detail"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(jump.getByRole("dialog")).toHaveCount(0);

  await enable("Personal Reality");
  await workspace.getByRole("button", { name: /Unlimited Core Mode/ }).click();
  await jump.getByRole("button", { name: "Supp" }).click();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: "Personal Reality Spend new points" })
    .click();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: /100 CP/ })
    .click();
  await expect(
    jump.getByRole("dialog").getByText("-400 WP available"),
  ).toBeVisible();
});

test("Warehouse, Universal Drawbacks, and Quest tools expose their mock interactions", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const jump = page.getByLabel("Chain and Jump contextual supplement scenario");
  await workspace.getByRole("tab", { name: "Manage" }).click();
  const warehouse = workspace
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Cosmic Warehouse" });
  await warehouse.getByRole("checkbox").check();
  await warehouse.getByRole("button", { name: "Open page" }).click();
  await workspace.getByRole("tab", { name: "Miscellaneous" }).click();
  await workspace.getByRole("button", { name: /Portal/ }).click();
  await expect(workspace.getByRole("button", { name: /Link/ })).toBeDisabled();

  await workspace.getByRole("tab", { name: "Universal Drawbacks" }).click();
  await workspace.getByRole("button", { name: "Without Why" }).click();
  await expect(workspace.locator(".uds-card-detail")).toContainText(
    "Current rule",
  );
  await jump.getByRole("button", { name: "Supp" }).click();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: "Universal Drawbacks Current effects" })
    .click();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: "Use hiatus" })
    .first()
    .click();
  await expect(
    jump.getByRole("dialog").getByRole("button", { name: "Resume here" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await workspace.getByRole("tab", { name: "Quest Mode" }).click();
  await workspace.getByRole("tab", { name: "Optional rules" }).click();
  await expect(workspace.locator(".quest-rule-list > button")).toHaveCount(2);
  await expect(
    workspace.getByRole("button", { name: /Switching Out Quests/ }),
  ).toBeVisible();
  await expect(
    workspace.getByText("Custom Quests", { exact: true }),
  ).toHaveCount(0);
  await jump.getByRole("button", { name: "Supp" }).click();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: "Quest Mode Quest checklist" })
    .click();
  await jump
    .getByRole("dialog")
    .getByLabel("Switching-out quest name")
    .fill("Seal the Violet Gate");
  await expect(
    jump
      .getByRole("dialog")
      .getByText("Arcane Realms switching-out quests", { exact: true }),
  ).toBeVisible();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: "Add quest" })
    .click();
  await expect(
    jump.getByRole("dialog").getByText("Seal the Violet Gate"),
  ).toBeVisible();
});

test("Story renders all chapters and synchronizes formatted editor changes", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const jump = page.getByLabel("Chain and Jump contextual supplement scenario");
  await jump.getByRole("button", { name: "Supp" }).click();
  await jump
    .getByRole("dialog")
    .getByRole("button", { name: "Story Write this Jump" })
    .click();
  const dialog = jump.getByRole("dialog");
  await expect(dialog.locator(".story-chapter-editor")).toHaveCount(3);
  const source = dialog.getByLabel("Chapter 1 text");
  await source.fill("The **Violet Gate** opened.");
  await dialog.getByRole("button", { name: "+ Add chapter" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Saved");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(jump.getByRole("button", { name: "Supp" })).toBeFocused();
  const storyTab = workspace.getByRole("tab", { name: "Story" });
  await storyTab.click();
  await expect(storyTab).toHaveAttribute("aria-selected", "true");
  await expect(workspace.locator(".story-full-chapter")).toHaveCount(3);
  await expect(
    workspace.getByText("Violet Gate", { exact: true }),
  ).toBeVisible();
});

test("contextual supplement controls use the documented themed layouts", async ({
  page,
}) => {
  const jump = page.getByLabel("Chain and Jump contextual supplement scenario");
  await jump.getByRole("button", { name: "Supp" }).click();
  const dialog = jump.getByRole("dialog");

  await dialog
    .getByRole("button", { name: "Personal Reality Spend new points" })
    .click();
  const conversion = dialog.locator(".reality-conversion-options");
  await expect(conversion).toHaveCSS("display", "grid");
  await expect(conversion.locator("button")).toHaveCount(3);
  await expect(conversion.locator("button").first()).not.toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );

  await dialog
    .getByRole("button", { name: "Universal Drawbacks Current effects" })
    .click();
  await dialog.getByRole("button", { name: "Choose for this Jump" }).click();
  const jumpSearch = dialog.locator(".uds-jump-search input");
  await expect(jumpSearch).toHaveCSS("background-color", "rgb(21, 18, 16)");
  await expect(dialog.locator(".uds-jump-choice-list")).toHaveCSS(
    "display",
    "grid",
  );

  await dialog
    .getByRole("button", { name: "Quest Mode Quest checklist" })
    .click();
  await expect(dialog.locator(".quest-dialog-rule-status")).toHaveCSS(
    "display",
    "grid",
  );
  await expect(dialog.locator(".quest-dialog-rule-status > span")).toHaveCount(
    2,
  );
  await expect(dialog.locator(".quest-special-section")).toHaveCount(2);
  await expect(dialog.locator("#quest-custom-form")).toHaveCSS(
    "display",
    "grid",
  );
  await expect(dialog.getByLabel("Switching-out quest name")).not.toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
});

test(
  "audits every non-Classic supplement page and contextual surface",
  { tag: ["@visual", "@slow", "@chromium-only"] },
  async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    const workspace = page.getByLabel(
      "Chain Tracker Supplements workspace scenario",
    );
    const scenario = page.getByLabel(
      "Chain and Jump contextual supplement scenario",
    );
    const attach = async (name: string, target = workspace) => {
      if (shouldCaptureReviewArtifacts(testInfo, false)) {
        await testInfo.attach(`${testInfo.project.name}-${name}`, {
          body: await target.screenshot(),
          contentType: "image/png",
        });
      }
      await expect(target).not.toContainText(
        /pinned v|source-defined capability/i,
      );
    };
    const open = async (name: string) => {
      await workspace.getByRole("tab", { name: "Manage" }).click();
      const row = workspace
        .locator(".supplement-manage-list article")
        .filter({ hasText: name });
      if (!(await row.getByRole("checkbox").isChecked()))
        await row.getByRole("checkbox").check();
      await row.getByRole("button", { name: "Open page" }).click();
    };
    const assertBottomReachable = async (selector: string) => {
      const scroller = workspace.locator(selector);
      await scroller.evaluate((element) =>
        element.scrollTo({ top: element.scrollHeight, behavior: "instant" }),
      );
      await expect
        .poll(() =>
          scroller.evaluate(
            (element) =>
              element.scrollHeight - element.scrollTop - element.clientHeight,
          ),
        )
        .toBe(0);
    };

    await attach("manage");
    await open("Essential Body Modification");
    for (const category of [
      "Setup",
      "Essences",
      "Basic",
      "Physical",
      "Mental",
      "Spiritual",
      "Skills",
      "Supernatural",
      "Items",
      "Companions",
      "Drawbacks",
    ] as const) {
      await workspace
        .locator("#essential-category-nav")
        .getByRole("button", { name: new RegExp(`^${category}\\b`) })
        .click();
      await attach(`essential-${category.toLowerCase()}`);
      await assertBottomReachable(".essential-workspace-content");
    }

    await open("Cosmic Warehouse");
    for (const tab of [
      "Explanation",
      "Utilities",
      "Structures",
      "Miscellaneous",
      "Review",
    ]) {
      await workspace.getByRole("tab", { name: tab }).click();
      await attach(`warehouse-${tab.toLowerCase()}`);
      await assertBottomReachable(".warehouse-panel");
    }

    await open("Personal Reality");
    const realityCategories = [
      ["Setup", "setup"],
      ["Basics", "basics"],
      ["Utilities", "utilities"],
      ["Cosmetic", "cosmetic"],
      ["Facilities", "facilities"],
      ["Extensions", "extensions"],
      ["Items & equipment", "items"],
      ["Companions", "companions"],
      ["Misc", "misc"],
      ["Limitations", "limitations"],
    ] as const;
    for (const [label, id] of realityCategories) {
      await workspace
        .locator("#reality-category-nav")
        .getByRole("button", { name: new RegExp(`^${label}\\b`) })
        .click();
      await attach(`reality-${id}`);
      await assertBottomReachable(".reality-workspace-content");
    }

    await open("Universal Drawbacks");
    const udsButtons = workspace.locator("#uds-category-nav button");
    for (let index = 0; index < 8; index += 1) {
      await udsButtons.nth(index).click();
      await attach(`uds-${index + 1}`);
      await assertBottomReachable(".uds-catalog");
    }

    await open("Quest Mode");
    for (const tab of ["Explanation", "Quest tiers", "Optional rules"]) {
      await workspace.getByRole("tab", { name: tab }).click();
      await attach(`quest-${tab.toLowerCase()}`);
      await assertBottomReachable(".quest-panel-stack");
    }

    await open("Story");
    await attach("story-reader-top");
    await assertBottomReachable(".story-full-reader");
    await attach("story-reader-bottom");

    await open("Limited Inheritance");
    await attach("limited-inheritance");
    await assertBottomReachable(".limited-pool-list");

    await scenario.getByRole("button", { name: "Supp" }).click();
    const dialog = scenario.getByRole("dialog");
    for (const tool of [
      /Essential Body Mod.*At a glance/,
      /Essential Body Mod.*Progression/,
      /Personal Reality.*At a glance/,
      /Personal Reality.*Spend new points/,
      /Universal Drawbacks/,
      /Quest Mode/,
      /Story/,
      /Limited Inheritance/,
    ]) {
      await dialog.getByRole("button", { name: tool }).click();
      if (shouldCaptureReviewArtifacts(testInfo, false)) {
        await testInfo.attach(
          `${testInfo.project.name}-dialog-${tool.source}`,
          {
            body: await page.screenshot(),
            contentType: "image/png",
          },
        );
      }
    }
    await page.keyboard.press("Escape");
    await workspace.getByRole("tab", { name: "Manage" }).click();
    const warehouseRow = workspace
      .locator(".supplement-manage-list article")
      .filter({ hasText: "Cosmic Warehouse" });
    await warehouseRow.getByRole("checkbox").check();
    await scenario.getByRole("button", { name: "Supp" }).click();
    const warehouseDialog = scenario.getByRole("dialog");
    await warehouseDialog
      .getByRole("button", { name: /Cosmic Warehouse/ })
      .click();
    if (shouldCaptureReviewArtifacts(testInfo, false)) {
      await testInfo.attach(`${testInfo.project.name}-dialog-warehouse`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }
  },
);

test("progression tiers, requirements, and special quests follow the mock mechanics", async ({
  page,
}) => {
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const scenario = page.getByLabel(
    "Chain and Jump contextual supplement scenario",
  );
  const essentialRow = workspace
    .locator(".supplement-manage-list article")
    .filter({ hasText: "Essential Body Modification" });
  await essentialRow.getByRole("checkbox").check();
  await essentialRow.getByRole("button", { name: "Open page" }).click();
  await workspace
    .locator(".essential-mode-field")
    .filter({ hasText: "Advancement Mode" })
    .getByRole("combobox")
    .selectOption("heroic");

  await scenario.getByRole("button", { name: "Supp" }).click();
  const dialog = scenario.getByRole("dialog");
  await dialog
    .getByRole("button", { name: /Essential Body Mod.*Progression/ })
    .click();
  await expect(dialog.getByText("Physical Perfection III")).toBeVisible();
  await dialog.getByRole("button", { name: "Greater" }).click();
  await dialog.getByRole("button", { name: "Buy · 50 EP" }).first().click();
  await expect(
    dialog.getByText("Acquired in Arcane Realms · Jump 2").first(),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Record 50 EP" }).click();
  await expect(
    dialog.getByRole("button", { name: "50 EP recorded" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await workspace.getByRole("tab", { name: "Universal Drawbacks" }).click();
  await workspace
    .locator("#uds-category-nav")
    .getByRole("button", { name: /^Warehouse & items/ })
    .click();
  const readyAccess = workspace
    .locator(".uds-card")
    .filter({ has: page.getByText("Ready Access", { exact: true }) });
  const noInsurance = workspace
    .locator(".uds-card")
    .filter({ has: page.getByText("No Insurance", { exact: true }) });
  await noInsurance.getByRole("button", { name: "Add to chain" }).click();
  await expect(
    readyAccess.getByRole("button", { name: "Remove from chain" }),
  ).toBeVisible();
  await readyAccess.getByRole("button", { name: "Remove from chain" }).click();
  await expect(
    noInsurance.getByRole("button", { name: "Add to chain" }),
  ).toBeVisible();

  await scenario.getByRole("button", { name: "Supp" }).click();
  const questDialog = scenario.getByRole("dialog");
  await questDialog.getByRole("button", { name: /Quest Mode/ }).click();
  await questDialog
    .getByRole("checkbox", { name: /Work off: Oathbound/ })
    .check();
  await expect(
    questDialog.getByText("500 CP", { exact: true }).first(),
  ).toBeVisible();
  await questDialog
    .getByLabel("Switching-out quest name")
    .fill("Seal the Violet Gate");
  await questDialog.getByLabel("Switching-out quest award").selectOption("400");
  await questDialog.getByRole("button", { name: "Add quest" }).click();
  await questDialog
    .getByRole("checkbox", { name: /Seal the Violet Gate/ })
    .check();
  await expect(
    questDialog.getByText("900 CP", { exact: true }).first(),
  ).toBeVisible();
});
