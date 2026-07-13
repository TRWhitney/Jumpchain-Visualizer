import { expect, test } from "@playwright/test";

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
  ).toHaveCount(7);
});

test("uses the wider desktop review frame without horizontal workspace scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const jump = page.getByLabel("Chain and Jump contextual supplement scenario");
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
});

test("mutual exclusion updates tabs, tools, and preserves the alternative's local state", async ({
  page,
}) => {
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
});

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

test("supplement tabs support keyboard navigation and module controls remain live", async ({
  page,
}) => {
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
  const strength = workspace.getByRole("button", { name: "Increase Strength" });
  await strength.click();
  await expect(strength.locator("xpath=../output")).toHaveText("2");
});

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
  await dialog.getByRole("button", { name: "+ Add chapter" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Saved");
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
  await workspace.getByRole("tab", { name: "Story" }).click();
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

test("audits every non-Classic supplement page and contextual surface", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const workspace = page.getByLabel(
    "Chain Tracker Supplements workspace scenario",
  );
  const scenario = page.getByLabel(
    "Chain and Jump contextual supplement scenario",
  );
  const attach = async (name: string, target = workspace) => {
    await testInfo.attach(`${testInfo.project.name}-${name}`, {
      body: await target.screenshot(),
      contentType: "image/png",
    });
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
  ]) {
    await dialog.getByRole("button", { name: tool }).click();
    await testInfo.attach(`${testInfo.project.name}-dialog-${tool.source}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
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
  await testInfo.attach(`${testInfo.project.name}-dialog-warehouse`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

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
