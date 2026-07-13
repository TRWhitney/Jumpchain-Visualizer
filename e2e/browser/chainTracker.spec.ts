import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.goto("/review/chain-tracker");
});

const trackerFor = (page: import("@playwright/test").Page) =>
  page.getByLabel("Interactive Chain Tracker workspace");

test("renders the complete dense Chain Tracker frame and fixed workspace tabs", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await expect(tracker).toBeVisible();
  await expect(
    tracker.getByRole("tab", { name: /^Chain & Jump/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(8);
  await expect(tracker.getByRole("tab", { name: /^Inventory/ })).toContainText(
    "60",
  );
  await expect(tracker.getByRole("tab", { name: /^Forms/ })).toContainText("8");
  await expect(tracker.getByRole("tab", { name: /^Companions/ })).toContainText(
    "7",
  );
  await expect(
    tracker.getByRole("heading", {
      name: "Jump rendering is not connected yet",
    }),
  ).toBeVisible();
  const stack = tracker.locator(".chain-page-stack");
  await expect
    .poll(() => stack.evaluate((node) => node.scrollWidth <= node.clientWidth))
    .toBe(true);
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
  await actor.selectOption("ren");
  await expect(tracker.locator(".tracker-budget output")).toHaveText("-150 CP");
  await tracker.getByRole("button", { name: "Clear fixture deficit" }).click();
  await expect(tracker.locator(".tracker-budget output")).toHaveText("0 CP");

  await tracker.getByRole("button", { name: /2\. Arcane Realms/ }).click();
  await expect(
    tracker.getByRole("heading", { name: "Arcane Realms" }).first(),
  ).toBeVisible();
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  await expect(
    tracker.getByLabel("Forms through historical cutoff"),
  ).toHaveValue("entry-1");
  await expect(tracker.locator(".chain-form-grid > article")).toHaveCount(2);
});

test("reorder review supports cancel, commit, drag-equivalent controls, and undo", async ({
  page,
}) => {
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
  await expect(tracker.locator(".tracker-undo")).toContainText(
    "Reorder complete",
  );
  await tracker.getByRole("button", { name: "Undo" }).click();
  await expect(
    tracker.getByRole("button", { name: /7\. War of Seven Crowns/ }),
  ).toBeVisible();

  const source = tracker
    .locator(".chain-jump-entry")
    .filter({ hasText: "Clockwork Sea" });
  const target = tracker
    .locator(".chain-jump-entry")
    .filter({ hasText: "The Long Shadow Court" });
  await source.dragTo(target);
  await expect(
    tracker.getByRole("dialog", { name: "Review move" }),
  ).toBeVisible();
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
  await expect(tracker.locator(".tracker-undo")).toContainText(
    "Reorder complete",
  );
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
  await expect(tracker.locator(".tracker-undo")).toContainText(
    "Remove Jump complete",
  );
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
  await expect(tracker.locator(".tracker-undo")).toContainText(
    "Reorder complete",
  );
});

test("remove reports impacts, commits, and restores the entry through undo", async ({
  page,
}) => {
  await page.goto("/review/chain-tracker?upstreamWarnings=on");
  const tracker = trackerFor(page);
  await tracker
    .getByRole("button", { name: "Remove Cosmic Odyssey from the chain" })
    .click();
  const review = tracker.getByRole("dialog", { name: "Review remove" });
  await expect(review).toContainText("Io");
  await expect(review).toContainText("Cosmic Odyssey");
  await expect(review).toContainText("The Long Shadow Court");
  await review.getByRole("button", { name: "Remove Jump" }).click();
  await expect(
    tracker.getByRole("button", { name: /Cosmic Odyssey/ }),
  ).toHaveCount(0);
  await tracker.getByRole("button", { name: "Undo" }).click();
  await expect(
    tracker.getByRole("button", { name: /3\. Cosmic Odyssey/ }),
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
    .getByRole("button", { name: "Open chain entry" })
    .click();
  await expect(
    tracker.getByRole("heading", { name: "Arcane Realms" }).first(),
  ).toBeVisible();
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("revision");
  await tracker.getByRole("button", { name: "Add to chain" }).click();
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(9);
  await expect(
    tracker.getByText("Version 1.1 · Imported package"),
  ).toBeVisible();
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("does not exist");
  await expect(
    tracker.getByText("No available jumps match this filter."),
  ).toBeVisible();
});

test("Inventory combines historical, kind, relationship, alias, text, empty, and record-detail behavior", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await expect(tracker.locator(".chain-record-list > article")).toHaveCount(60);
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
  await expect(tracker.locator(".chain-record-list > article")).toHaveCount(40);
  await tracker.getByRole("button", { name: /◆ Magic/ }).click();
  const magicCount = await tracker
    .locator(".chain-record-list > article")
    .count();
  expect(magicCount).toBeGreaterThan(0);
  expect(magicCount).toBeLessThan(40);
  await tracker.getByLabel("Search inventory").fill("Fire Control");
  await expect(tracker.getByText("Warded Soul", { exact: true })).toBeVisible();
  await tracker.getByText("Warded Soul", { exact: true }).click();
  const detail = tracker.getByRole("dialog", {
    name: /perk details: Warded Soul/i,
  });
  await expect(detail).toContainText("Acquired in Arcane Realms");
  await expect(detail.locator(".tag-profile-badge")).toHaveCount(4);
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

test("the settled radar and pie reproduce selection, correlation, popping, sorting, drilling, ellipsis, and navigation", async ({
  page,
}) => {
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
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  await tracker
    .getByLabel("Forms through historical cutoff")
    .selectOption("entry-2");
  await expect(tracker.locator(".chain-form-grid > article")).toHaveCount(3);
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

test("Companions use historical roster, profile imports, and stacked perk/item details", async ({
  page,
}) => {
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: /^Companions/ }).click();
  await tracker
    .getByLabel("Roster through historical cutoff")
    .selectOption("entry-3");
  await expect(tracker.locator(".chain-companion-grid > article")).toHaveCount(
    4,
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
  await expect(profile).toContainText("Imported into");
  await profile.locator(".companion-profile-columns button").first().click();
  const details = tracker.getByRole("dialog", { name: /details:/ });
  await expect(details).toBeVisible();
  await expect(
    tracker.locator(".companion-profile-layer").locator("xpath=.."),
  ).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("Escape");
  await expect(profile).toBeVisible();
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
});

test("reference fixture retains the documented three-Jump composition", async ({
  page,
}) => {
  await page.goto("/review/chain-tracker?fixture=reference");
  const tracker = trackerFor(page);
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(3);
  await expect(
    tracker.getByRole("heading", { name: "Arcane Realms" }).first(),
  ).toBeVisible();
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await expect(tracker.locator(".chain-record-list > article")).toHaveCount(5);
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  await expect(tracker.locator(".chain-form-grid > article")).toHaveCount(2);
});
