import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

test.describe.configure({ timeout: 60_000 });

const trackerFor = (page: Page) =>
  page.getByLabel("Interactive Chain Tracker workspace");

async function openHeroAcademy(
  page: Page,
  rerolls = false,
  allowNegativePointBalances = true,
) {
  const parameters = new URLSearchParams();
  if (rerolls) parameters.set("rerolls", "on");
  if (allowNegativePointBalances) parameters.set("negativeBalances", "on");
  await page.goto(`/review/chain-tracker?${parameters}`);
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Hero Academy");
  await tracker.getByRole("button", { name: "Add to chain" }).click();
  await expect(
    tracker.getByRole("heading", { name: "Hero Academy" }).first(),
  ).toBeVisible();
  return tracker;
}

test("negative-balance policy blocks only active choices that would overspend", async ({
  page,
}, testInfo) => {
  const tracker = await openHeroAcademy(page, false, false);
  const jump = tracker.locator(".format-one-jump-renderer");
  const card = (name: string) =>
    jump.getByText(name, { exact: true }).locator("xpath=ancestor::article[1]");
  const currency = tracker
    .getByLabel("Current jump summary")
    .locator("dd")
    .first();

  const stipend = card("Danger Stipend");
  await stipend.getByRole("combobox").selectOption("Accept");
  await expect(currency).toContainText("600 CP");

  await card("Power Rank").getByRole("spinbutton").fill("1");
  await card("Element").getByRole("combobox").selectOption("Fire");

  const nightVision = jump.getByRole("checkbox", {
    name: "Take Night Vision",
  });
  await nightVision.check();
  await expect(currency).toContainText("0 CP");

  const manualElectives = jump
    .getByRole("heading", { name: "Manual Electives", exact: true })
    .locator("xpath=ancestor::section[1]");
  const flight = manualElectives.getByRole("checkbox", {
    name: "Take Flight",
  });
  await flight.click();
  await expect(flight).not.toBeChecked();
  await expect(currency).toContainText("0 CP");
  await expect(
    page.locator(".app-toast", {
      hasText: "Choice rejected, negative balance",
    }),
  ).toBeVisible();
  await testInfo.attach("active-overspend-selection-rejected", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await stipend.getByRole("button", { name: "Clear" }).click();
  await expect(stipend.getByRole("combobox")).toHaveValue("");
  await expect(currency).toContainText("-100 CP");
  const metadata = tracker.locator(
    ".chain-context-header > div:first-child > span",
  );
  const warning = tracker.locator(".chain-negative-status");
  await expect(metadata).not.toContainText("Negative balance");
  await expect(warning).toHaveCount(1);
  const metadataBox = await metadata.boundingBox();
  const warningBox = await warning.boundingBox();
  expect(metadataBox).not.toBeNull();
  expect(warningBox).not.toBeNull();
  expect(warningBox!.y).toBeGreaterThanOrEqual(
    metadataBox!.y + metadataBox!.height + 4,
  );
  await testInfo.attach("inactive-clear-deficit-allowed", {
    body: await tracker.screenshot(),
    contentType: "image/png",
  });

  await nightVision.uncheck();
  await expect(nightVision).not.toBeChecked();
  await expect(currency).toContainText("0 CP");
});

test("a rejected overspend explains itself with a validation toast", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Hero Academy");
  await tracker.getByRole("button", { name: "Add to chain" }).click();
  const jump = tracker.locator(".format-one-jump-renderer");
  const card = (name: string) =>
    jump.getByText(name, { exact: true }).locator("xpath=ancestor::article[1]");
  await card("Danger Stipend").getByRole("combobox").selectOption("Accept");
  await card("Power Rank").getByRole("spinbutton").fill("1");
  await card("Element").getByRole("combobox").selectOption("Fire");
  await jump.getByRole("checkbox", { name: "Take Night Vision" }).check();
  await jump
    .getByRole("heading", { name: "Manual Electives", exact: true })
    .locator("xpath=ancestor::section[1]")
    .getByRole("checkbox", { name: "Take Flight" })
    .click();
  const rejectionToast = page.locator(".app-toast", {
    hasText: "Choice rejected, negative balance",
  });
  await expect(rejectionToast).toBeVisible();
  await expect(rejectionToast).toHaveClass(/is-danger/);
  await expect(rejectionToast.locator(":scope > span")).toHaveText("×");
  await testInfo.attach("overspend-validation-toast", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("Format 1 controls use the mock-authoritative control types and roll persistence", async ({
  page,
}, testInfo) => {
  const tracker = await openHeroAcademy(page);
  const jump = tracker.locator(".format-one-jump-renderer");

  await expect(
    jump.getByRole("checkbox", { name: "Take Night Vision" }),
  ).toBeVisible();
  await expect(jump.getByRole("textbox", { name: "Alias" })).toBeVisible();
  await expect(
    jump.getByRole("spinbutton", { name: "Extra Lives" }),
  ).toBeVisible();
  await expect(
    jump.getByRole("spinbutton", { name: "Combat Training" }),
  ).toBeVisible();
  await expect(
    jump.getByRole("combobox", { name: "Starting Region" }),
  ).toBeVisible();
  await expect(jump.getByRole("combobox", { name: "Element" })).toBeVisible();

  const alias = jump.getByRole("textbox", { name: "Alias" });
  const aliasCard = alias.locator("xpath=ancestor::article[1]");
  const clearAlias = aliasCard.getByRole("button", { name: "Clear" });
  await expect(clearAlias).toBeDisabled();
  await alias.fill("The Lantern");
  await expect(clearAlias).toBeEnabled();
  await clearAlias.click();
  await expect(alias).toHaveValue("");

  const ageCard = jump
    .getByText("Starting Age", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await expect(ageCard.locator(".cost-badge")).toHaveText("Roll for Free");
  await ageCard.getByRole("button", { name: "Roll" }).click();
  await expect(ageCard.locator("[data-roll-output]")).toHaveText("18");
  await expect(ageCard.locator(".cost-badge")).toContainText("Rolled");
  await ageCard.getByRole("button", { name: "Clear" }).click();
  await expect(ageCard.getByRole("button", { name: "Claim" })).toBeEnabled();
  await expect(ageCard.locator("[data-roll-output]")).toHaveText("18");
  await testInfo.attach("cleared-roll-retains-visible-value", {
    body: await ageCard.screenshot(),
    contentType: "image/png",
  });
  await ageCard.getByRole("button", { name: "Claim" }).click();
  await expect(ageCard.locator("[data-roll-output]")).toHaveText("18");

  const powerCard = jump
    .getByText("Power Rank", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await powerCard.getByRole("button", { name: "Roll" }).click();
  await expect(powerCard.locator(".cost-badge")).toContainText(
    "Rolled · was 300 CP",
  );
  await powerCard.getByRole("spinbutton").fill("3");
  await expect(powerCard.locator(".cost-badge")).toContainText(
    "Rolled 1 is Free",
  );

  const randomSingle = jump
    .getByRole("heading", { name: "Random Assignment", exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(randomSingle.getByRole("radio")).toHaveCount(2);
  await expect(randomSingle.getByRole("radio").first()).toBeDisabled();
  await randomSingle.getByRole("button", { name: "Roll" }).click();
  await expect(randomSingle.getByRole("radio").first()).toBeEnabled();
  await randomSingle.getByRole("button", { name: "Clear" }).click();
  await expect(
    randomSingle.getByRole("button", { name: "Roll" }),
  ).toBeDisabled();

  const manualMulti = jump
    .locator(".rendered-jump-section")
    .filter({ hasText: "Manual Electives" });
  await expect(manualMulti.getByRole("checkbox")).toHaveCount(2);
  await manualMulti.getByRole("checkbox").first().check();
  await expect(manualMulti.locator(".spent-total output")).toHaveText("100 CP");

  const scroller = tracker.locator(".tracker-renderer-placeholder");
  await scroller.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    jump.getByRole("heading", { name: "Chosen or Random Electives" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      scroller.evaluate(
        (node) => node.scrollTop + node.clientHeight >= node.scrollHeight - 1,
      ),
    )
    .toBe(true);
});

test("default prose contrast and renderer corner joins follow their visual states", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  const tracker = trackerFor(page);
  await tracker.getByRole("button", { name: /1\. First Step/ }).click();
  const introduction = tracker.getByText(
    "Begin a chain with dependable foundations, a clear identity, and a few practical advantages.",
    { exact: true },
  );
  const wanderer = tracker.getByText(
    "You arrive without local ties or obligations.",
    { exact: true },
  );
  await expect
    .poll(async () =>
      introduction.evaluate((element) => getComputedStyle(element).color),
    )
    .toBe(
      await wanderer.evaluate((element) => getComputedStyle(element).color),
    );

  const renderer = tracker.locator(".shared-jump-renderer");
  await expect(renderer).toHaveCSS("border-top-left-radius", "4.8px");
  await testInfo.attach("default-prose-and-rounded-jump-top", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Developer" }).click();
  await page.getByLabel("Enable extra information").check();
  await page.getByRole("button", { name: "Close Settings" }).click();
  await expect(tracker.locator(".shared-renderer-label")).toBeVisible();
  await expect(renderer).toHaveCSS("border-top-left-radius", "0px");
  await testInfo.attach("developer-info-joined-square-jump-top", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("integer steppers, canonical tags, authored surfaces, and trait text match their owning mocks", async ({
  page,
}, testInfo) => {
  const tracker = await openHeroAcademy(page);
  const jump = tracker.locator(".format-one-jump-renderer");
  const extraLives = jump
    .getByText("Extra Lives", { exact: true })
    .locator("xpath=ancestor::article[1]");
  const stepper = extraLives.locator(".number-stepper");
  const integerInput = stepper.getByRole("spinbutton");
  await stepper.getByRole("button", { name: "Increase" }).click();
  await expect(integerInput).toHaveValue("0");
  await stepper.getByRole("button", { name: "Increase" }).click();
  await expect(integerInput).toHaveValue("1");

  const magicTag = jump
    .getByText("Element", { exact: true })
    .locator("xpath=ancestor::article[1]")
    .locator(".tag-profile-badge")
    .first();
  await expect(magicTag).toHaveClass(/tag-profile-badge/);
  await expect(magicTag).toHaveCSS("border-radius", "999px");
  await expect(magicTag.locator(".tag-animated-text")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(magicTag.locator(".tag-animated-text")).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(magicTag.locator(".tag-animated-text")).toHaveCSS(
    "padding-top",
    "0px",
  );
  await expect(extraLives).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(integerInput).toHaveCSS(
    "background-color",
    "rgb(255, 253, 247)",
  );
  await expect(extraLives.getByRole("button", { name: "Clear" })).toHaveCSS(
    "background-color",
    "rgb(255, 253, 247)",
  );
  const elementChoice = jump
    .getByText("Element", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await expect(elementChoice.getByRole("combobox")).toHaveCSS(
    "background-color",
    "rgb(255, 253, 247)",
  );
  await expect(elementChoice.getByRole("button", { name: "Roll" })).toHaveCSS(
    "background-color",
    "rgb(255, 253, 247)",
  );
  await testInfo.attach("integer-stepper-and-canonical-tags", {
    body: await extraLives.screenshot(),
    contentType: "image/png",
  });

  const jumpBadgePresentation = await magicTag.evaluate((badge) => {
    const outer = getComputedStyle(badge);
    const inner = getComputedStyle(
      badge.querySelector(".tag-animated-text") as Element,
    );
    return {
      backgroundColor: outer.backgroundColor,
      backgroundImage: outer.backgroundImage,
      border: outer.border,
      borderRadius: outer.borderRadius,
      color: outer.color,
      padding: outer.padding,
      innerBackground: inner.backgroundColor,
      innerBorder: inner.border,
      innerPadding: inner.padding,
    };
  });
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  const inventoryMagicTag = tracker
    .locator(".chain-record-list .tag-profile-badge")
    .filter({ hasText: /^Magic$/ })
    .first();
  await expect(inventoryMagicTag).toBeVisible();
  const inventoryBadgePresentation = await inventoryMagicTag.evaluate(
    (badge) => {
      const outer = getComputedStyle(badge);
      const inner = getComputedStyle(
        badge.querySelector(".tag-animated-text") as Element,
      );
      return {
        backgroundColor: outer.backgroundColor,
        backgroundImage: outer.backgroundImage,
        border: outer.border,
        borderRadius: outer.borderRadius,
        color: outer.color,
        padding: outer.padding,
        innerBackground: inner.backgroundColor,
        innerBorder: inner.border,
        innerPadding: inner.padding,
      };
    },
  );
  expect(jumpBadgePresentation).toEqual(inventoryBadgePresentation);

  await tracker.getByRole("tab", { name: "Chain & Jump" }).click();

  await tracker.getByRole("button", { name: /1\. First Step/ }).click();
  const rendererHeader = tracker.locator(".format-one-jump-renderer > header");
  await expect(rendererHeader).toHaveCSS("position", "static");
  const authoredCard = tracker
    .getByText("Adaptable Baseline", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await expect(authoredCard).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(authoredCard).toHaveCSS("color", "rgb(38, 35, 31)");

  await tracker
    .getByRole("button", { name: /7\. War of Seven Crowns/ })
    .click();
  const traits = tracker.getByRole("heading", {
    name: "Current Jump traits",
  });
  await expect(traits).toHaveCSS("color", "rgb(38, 35, 31)");
  await testInfo.attach("readable-current-jump-traits", {
    body: await traits.locator("xpath=ancestor::section[1]").screenshot(),
    contentType: "image/png",
  });
});

test("integer selector arrows visually match the choice-rendering mock", async ({
  page,
}, testInfo) => {
  const tracker = await openHeroAcademy(page);
  const realControl = tracker
    .getByText("Extra Lives", { exact: true })
    .locator("xpath=ancestor::article[1]")
    .locator(".number-stepper");
  await realControl.getByRole("spinbutton").fill("2");
  await testInfo.attach("integer-selector-real", {
    body: await realControl.screenshot(),
    contentType: "image/png",
  });

  await page.goto(
    new URL("../../documentation/choice-rendering-design.html", import.meta.url)
      .href,
  );
  const mockInput = page
    .locator(".control-specimen")
    .filter({ hasText: "Extra Lives" })
    .getByRole("spinbutton");
  await testInfo.attach("integer-selector-mock", {
    body: await mockInput.locator("xpath=ancestor::span[1]").screenshot(),
    contentType: "image/png",
  });
});

test("ranked, award, multi-resource, reroll, and replacement badges follow the documented states", async ({
  page,
}, testInfo) => {
  const tracker = await openHeroAcademy(page, true);
  const jump = tracker.locator(".format-one-jump-renderer");

  const ranks = jump
    .getByText("Technique Ranks", { exact: true })
    .locator("xpath=ancestor::article[1]");
  const rankRoll = ranks.getByRole("button", { name: "Roll" });
  await rankRoll.click();
  await rankRoll.click();
  await rankRoll.click();
  await expect(ranks.locator(".cost-badge")).toContainText("2 rolled");
  await ranks.getByRole("spinbutton").fill("3");
  await expect(ranks.locator(".cost-badge")).toContainText(
    "2 ranks Free · Rolled",
  );
  await expect(ranks.locator(".cost-badge")).toContainText("1 paid × 50 CP");

  const award = jump
    .getByText("Danger Stipend", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await award.getByRole("button", { name: "Roll" }).click();
  await expect(award.locator(".cost-badge")).toContainText(
    "replaces +100 CP award",
  );

  const resources = jump
    .getByText("Academy Requisition", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await resources.getByRole("combobox").selectOption("Field Kit");
  await expect(resources.locator(".cost-badge")).toHaveCount(2);
  await expect(resources.locator(".cost-badge").first()).toHaveText("100 CP");
  await expect(resources.locator(".cost-badge").nth(1)).toHaveText("2 Merit");
  await resources.getByRole("button", { name: "Roll" }).click();
  await expect(resources.locator(".cost-badge")).toContainText(
    "Rolled · was 100 CP + 2 Merit",
  );

  await testInfo.attach("format-1-implementation-controls", {
    body: await jump.screenshot(),
    contentType: "image/png",
  });
  await page.goto(
    pathToFileURL(
      path.join(process.cwd(), "documentation/choice-rendering-design.html"),
    ).href,
  );
  const reference = page.locator(".control-library-grid");
  await expect(reference).toBeVisible();
  await testInfo.attach("controls-documentation-reference", {
    body: await reference.screenshot(),
    contentType: "image/png",
  });
});

test("authored direct choices, expansions, nested inputs, and empty slots stay in their authored positions", async ({
  page,
}) => {
  const tracker = await openHeroAcademy(page);
  const controls = tracker.locator(".jump-layout-grid").first();
  await expect(controls.locator(":scope > article")).toHaveCount(13);
  await expect(controls).toBeVisible();

  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Clockwork Sea");
  await tracker.getByRole("button", { name: "Open chain entity" }).click();
  const seamanship = tracker
    .getByText("Brass Seamanship", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await expect(
    seamanship.getByText("vessel name", { exact: true }),
  ).toBeVisible();
  await expect(seamanship.locator(".jump-nested-inputs")).toHaveCount(1);
  await seamanship.getByRole("textbox").fill("Resolute II");
  await expect(seamanship.getByRole("textbox")).toHaveValue("Resolute II");
});

test("single, multi, random, either, and companion-source controls retain the documented provenance", async ({
  page,
}, testInfo) => {
  const tracker = await openHeroAcademy(page);
  const jump = tracker.locator(".format-one-jump-renderer");
  const section = (name: string) =>
    jump
      .getByRole("heading", { name, exact: true })
      .locator("xpath=ancestor::section[1]");

  const manualSingle = section("Manual Assignment");
  await expect(manualSingle.getByRole("radio")).toHaveCount(2);
  await manualSingle.getByRole("radio").first().check();
  await manualSingle.getByRole("radio").last().check();
  await expect(manualSingle.getByRole("radio").first()).not.toBeChecked();
  await expect(manualSingle.getByRole("radio").last()).toBeChecked();
  await manualSingle.getByRole("button", { name: "Clear" }).click();

  const randomSingle = section("Random Assignment");
  await expect(randomSingle.getByRole("radio")).toHaveCount(2);
  await expect(randomSingle.getByRole("radio").first()).toBeDisabled();
  await randomSingle.getByRole("button", { name: "Roll" }).click();
  await expect(randomSingle.getByRole("radio").first()).toBeEnabled();
  await expect(randomSingle.getByRole("radio").first()).toBeChecked();
  await randomSingle.getByRole("button", { name: "Clear" }).click();
  await expect(randomSingle.locator("[data-group-status]")).toContainText(
    "Rolled",
  );

  const eitherSingle = section("Chosen or Random Assignment");
  await expect(eitherSingle.getByRole("radio")).toHaveCount(2);
  await eitherSingle.getByRole("button", { name: "Roll" }).click();
  await eitherSingle.getByRole("radio").last().check();
  await expect(eitherSingle.getByRole("radio").last()).toBeChecked();
  await expect(eitherSingle.getByText("Rolled", { exact: true })).toHaveCount(
    1,
  );
  await eitherSingle.getByRole("button", { name: "Clear" }).click();

  const manualMulti = section("Manual Electives");
  await expect(manualMulti.getByRole("checkbox")).toHaveCount(2);
  await manualMulti.getByRole("checkbox").first().check();
  await manualMulti.getByRole("checkbox").last().check();
  await expect(manualMulti.getByRole("checkbox")).toHaveCount(2);
  await manualMulti.getByRole("button", { name: "Clear" }).click();

  const randomMulti = section("Random Electives");
  await expect(randomMulti.getByRole("checkbox").first()).toBeDisabled();
  await randomMulti.getByRole("button", { name: "Roll" }).click();
  await expect(randomMulti.getByRole("checkbox").first()).toBeChecked();
  await randomMulti.getByRole("checkbox").first().uncheck();
  await expect(randomMulti.locator("[data-group-status]")).toContainText(
    "Rolled",
  );

  const eitherMulti = section("Chosen or Random Electives");
  await eitherMulti.getByRole("button", { name: "Roll" }).click();
  await eitherMulti.getByRole("checkbox").last().check();
  await expect(eitherMulti.getByRole("checkbox")).toHaveCount(2);
  await expect(eitherMulti.getByText("Rolled", { exact: true })).toHaveCount(1);

  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Beyond the Last Horizon");
  await tracker.getByRole("button", { name: "Open chain entity" }).click();
  const roster = tracker.locator(".companion-roster");
  await expect(roster.getByRole("checkbox")).toHaveCount(7);
  await expect(roster.locator(".check-control").first()).toHaveCSS(
    "color",
    "rgb(38, 35, 31)",
  );
  const companionInput = roster.locator("xpath=parent::fieldset");
  await expect(companionInput.locator("legend")).toHaveCSS(
    "color",
    "rgb(79, 74, 64)",
  );
  await roster.getByRole("checkbox").first().check();
  await expect(roster.getByRole("checkbox").first()).toBeChecked();
  await testInfo.attach("readable-companion-roster", {
    body: await companionInput.screenshot(),
    contentType: "image/png",
  });
});

test("rich content, package images, wrap/rule layout, conditions, and resource grants use real projections", async ({
  page,
}) => {
  await page.goto("/review/chain-tracker");
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("Dream Archive");
  await tracker.getByRole("button", { name: "Add to chain" }).click();
  const jump = tracker.locator(".format-one-jump-renderer");

  await expect(jump.locator(".jump-layout-wrap")).toBeVisible();
  await expect(jump.locator("hr")).toHaveCount(1);
  await expect(
    jump.locator("strong").filter({ hasText: "remembered worlds" }),
  ).toBeVisible();
  const image = jump.getByRole("img", {
    name: "A geometric moon above an open archive",
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((node) => node.naturalWidth))
    .toBeGreaterThan(0);

  await jump.getByRole("checkbox", { name: "Take Lucid Reserve" }).check();
  const currency = tracker
    .getByLabel("Current jump summary")
    .locator("dd")
    .first();
  await currency.focus();
  await expect(currency.getByRole("tooltip")).toContainText("5 LU · Lucidity");

  await tracker.getByRole("button", { name: "Apply Gauntlet rules" }).click();
  await expect(
    jump.getByText(/archive is sealed during this Gauntlet/),
  ).toBeVisible();
  await expect(jump.getByText(/Shelve remembered worlds/)).toHaveCount(0);
});
