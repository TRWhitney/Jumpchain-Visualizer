import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

test.describe.configure({ timeout: 60_000 });

const trackerFor = (page: Page) =>
  page.getByLabel("Interactive Chain Tracker workspace");

async function openFreshLastTrial(
  page: Page,
  options: { rerolls?: boolean; negativeBalances?: boolean } = {},
) {
  const query = new URLSearchParams({ duplicateJumps: "on" });
  if (options.rerolls) query.set("rerolls", "on");
  if (options.negativeBalances) query.set("negativeBalances", "on");
  await page.goto(`/review/chain-tracker?${query}`);
  const tracker = trackerFor(page);
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("The Last Trial");
  await tracker
    .getByRole("button", { name: "Add to chain again (x2)" })
    .click();
  await expect(
    tracker.getByRole("heading", { name: "The Last Trial" }).first(),
  ).toBeVisible();
  return tracker;
}

async function attach(testInfo: TestInfo, name: string, locator: Locator) {
  if (testInfo.project.name !== "chromium") return;
  await testInfo.attach(name, {
    body: await locator.screenshot(),
    contentType: "image/png",
  });
}

async function attachFullRenderer(
  testInfo: TestInfo,
  name: string,
  locator: Locator,
) {
  if (testInfo.project.name !== "chromium") return;
  const captureId = `jump-renderer-capture-${name}`;
  await locator.evaluate(
    (element, { captureId }) => {
      const capture = document.createElement("div");
      capture.id = captureId;
      capture.style.width = `${element.getBoundingClientRect().width}px`;
      capture.style.background = "#f5f1e6";
      capture.append(element.cloneNode(true));
      document.body.replaceChildren(capture);
      document.body.style.margin = "0";
      document.body.style.overflow = "visible";
    },
    { captureId },
  );
  await testInfo.attach(name, {
    body: await locator.page().locator(`#${captureId}`).screenshot(),
    contentType: "image/png",
  });
}

const card = (tracker: ReturnType<typeof trackerFor>, name: string) =>
  tracker
    .locator(".format-one-jump-renderer")
    .getByText(name, { exact: true })
    .locator("xpath=ancestor::article[1]");

test("negative-balance rejection uses the danger toast in the shared stack", async ({
  page,
}, testInfo) => {
  const tracker = await openFreshLastTrial(page);
  await card(tracker, "The Trial's Allowance").getByRole("checkbox").check();
  await card(tracker, "Extra Attempts").getByRole("spinbutton").fill("1");
  await card(tracker, "Manual Training").getByRole("spinbutton").fill("5");
  await card(tracker, "Power Rank").getByRole("spinbutton").fill("1");
  await card(tracker, "Technique Ranks").getByRole("spinbutton").fill("5");
  await card(tracker, "Element").getByRole("combobox").selectOption("Fire");
  await card(tracker, "Starting Region")
    .getByRole("combobox")
    .selectOption("Central Arena");
  await card(tracker, "Trial Gender")
    .getByRole("combobox")
    .selectOption("Female");

  const manualAssignment = tracker
    .getByRole("heading", { name: "Manual Assignment" })
    .locator("xpath=ancestor::section[1]");
  await manualAssignment.getByRole("radio", { name: /Scholar/ }).check();
  const manualElectives = tracker
    .getByRole("heading", { name: "Manual Electives" })
    .locator("xpath=ancestor::section[1]");
  await manualElectives.getByRole("checkbox", { name: /Arcane Study/ }).check();
  await card(tracker, "Trial Requisition")
    .getByRole("combobox")
    .selectOption("Field Kit");
  const aster = card(tracker, "Aster").getByRole("checkbox");
  await aster.click();
  if (await aster.isChecked()) {
    const sentinel = card(tracker, "Sentinel").getByRole("checkbox");
    await sentinel.click();
    await expect(sentinel).not.toBeChecked();
  } else await expect(aster).not.toBeChecked();

  const toast = page.locator(".app-toast-host .app-toast").filter({
    hasText: "Choice rejected, negative balance",
  });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveClass(/is-danger/);
  await expect(toast.locator(":scope > span")).toHaveText("×");
  await attach(testInfo, "negative-balance-danger-toast", page.locator("body"));
});

test("the Last Trial exposes the complete manual, random, either, and source matrix", async ({
  page,
}, testInfo) => {
  const tracker = await openFreshLastTrial(page, {
    negativeBalances: true,
  });
  const jump = tracker.locator(".format-one-jump-renderer");
  await expect(
    jump.getByRole("checkbox", { name: /Trial Oath/ }),
  ).toBeVisible();
  await expect(jump.getByRole("textbox", { name: "Trial Name" })).toBeVisible();
  await expect(
    jump.getByRole("spinbutton", { name: "Extra Attempts" }),
  ).toBeVisible();
  await expect(
    jump.getByRole("spinbutton", { name: "Manual Training" }),
  ).toBeVisible();
  await expect(
    jump.getByRole("combobox", { name: "Starting Region" }),
  ).toBeVisible();
  await expect(
    card(tracker, "Destiny").locator("[data-roll-output]"),
  ).toBeVisible();
  await expect(jump.getByRole("combobox", { name: "Element" })).toBeVisible();

  const age = card(tracker, "Random Age");
  await age.getByRole("button", { name: "Roll" }).click();
  await expect(age.locator("[data-roll-output]")).toHaveText("18");
  await age.getByRole("button", { name: "Clear" }).click();
  await expect(age.getByRole("button", { name: "Claim" })).toBeEnabled();
  await expect(age.locator("[data-roll-output]")).toHaveText("18");
  await attach(testInfo, "cleared-roll-retains-claim-value", age);

  for (const source of [
    "Manual Assignment",
    "Random Assignment",
    "Chosen or Random Assignment",
  ])
    await expect(
      jump
        .getByRole("heading", { name: source, exact: true })
        .locator("xpath=ancestor::section[1]")
        .getByRole("radio"),
    ).toHaveCount(2);
  for (const source of [
    "Manual Electives",
    "Random Electives",
    "Chosen or Random Electives",
  ])
    await expect(
      jump
        .getByRole("heading", { name: source, exact: true })
        .locator("xpath=ancestor::section[1]")
        .getByRole("checkbox"),
    ).toHaveCount(2);
  await attachFullRenderer(testInfo, "complete-random-control-matrix", jump);
});

test("integer selector arrows visually match the authoritative control mock", async ({
  page,
}, testInfo) => {
  const tracker = await openFreshLastTrial(page, { negativeBalances: true });
  const realControl = card(tracker, "Extra Attempts").locator(
    ".number-stepper",
  );
  await realControl.getByRole("spinbutton").fill("2");
  await expect(
    realControl.getByRole("button", { name: "Increase" }),
  ).toBeVisible();
  await expect(
    realControl.getByRole("button", { name: "Decrease" }),
  ).toBeVisible();
  await attach(testInfo, "integer-selector-real", realControl);

  await page.goto(
    pathToFileURL(path.resolve("documentation/choice-rendering-design.html"))
      .href,
  );
  const mockControl = page
    .locator(".control-specimen")
    .filter({ hasText: "Extra Lives" })
    .getByRole("spinbutton")
    .locator("xpath=ancestor::span[1]");
  await expect(mockControl).toBeVisible();
  await attach(testInfo, "integer-selector-mock", mockControl);
});

test("Threshold renders identity, prose, imagery, rich text, and nested manual inputs", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker");
  const tracker = trackerFor(page);
  await tracker
    .getByRole("button", { name: /1\. Threshold of a Thousand Roads/ })
    .click();
  const jump = tracker.locator(".format-one-jump-renderer");
  await expect(
    jump.getByRole("img", {
      name: "A bright doorway at the center of the Threshold",
    }),
  ).toBeVisible();
  await expect(jump.locator("strong")).not.toHaveCount(0);
  await expect(jump.locator("em")).not.toHaveCount(0);
  await expect(jump.locator("u")).not.toHaveCount(0);
  await expect(jump.locator("s")).not.toHaveCount(0);
  await expect(jump.locator("table")).toBeVisible();
  await expect(jump.getByRole("textbox", { name: "Road Name" })).toHaveValue(
    "Wayfinder",
  );
  const door = card(tracker, "Custom Door");
  await expect(door.getByRole("textbox", { name: "Door Name" })).toHaveValue(
    "Homeward",
  );
  await expect(
    door.getByRole("spinbutton", { name: "Door Count" }),
  ).toHaveValue("2");
  await expect(
    door.getByRole("combobox", { name: "Door Material" }),
  ).toHaveValue("Brass");
  await attachFullRenderer(
    testInfo,
    "threshold-identity-and-manual-controls",
    jump,
  );
});

test("Confluence renders layouts, themes, resources, measures, and conditions", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker");
  const tracker = trackerFor(page);
  await tracker
    .getByRole("button", { name: /2\. The Confluence Engine/ })
    .click();
  const jump = tracker.locator(".format-one-jump-renderer");
  await expect(jump.locator(".jump-layout-grid").first()).toBeVisible();
  await expect(jump.locator(".jump-layout-inline").first()).toBeVisible();
  await expect(jump.locator(".jump-layout-wrap").first()).toBeVisible();
  await expect(jump.locator("hr")).not.toHaveCount(0);
  await expect(
    jump.getByRole("img", { name: /Confluence/i }).first(),
  ).toBeVisible();
  await expect(
    jump.getByText("Adaptive Mastery", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    jump.getByText("Facet Crates", { exact: true }).first(),
  ).toBeVisible();
  const currency = tracker
    .getByLabel("Current jump summary")
    .locator("dd")
    .first();
  await currency.focus();
  await expect(currency.getByRole("tooltip")).toContainText("Resonance");
  await expect(currency.getByRole("tooltip")).toContainText("Facets");
  await expect(currency.getByRole("tooltip")).toContainText("Paradox");
  await attachFullRenderer(
    testInfo,
    "confluence-layout-theme-token-gallery",
    jump,
  );
});

test("native Gauntlet costs, awards, replacement rolls, and companion input render together", async ({
  page,
}, testInfo) => {
  await page.goto("/review/chain-tracker?rerolls=on&negativeBalances=on");
  const tracker = trackerFor(page);
  const jump = tracker.locator(".format-one-jump-renderer");
  await expect(
    tracker.getByRole("button", { name: "Native Gauntlet" }),
  ).toBeDisabled();
  await expect(
    card(tracker, "The Trial's Allowance").locator(".cost-badge"),
  ).toBeVisible();
  await expect(
    card(tracker, "Trial Requisition").locator(".cost-badge"),
  ).toContainText(/Rolled|CP|Trial Marks/);
  const companions = card(tracker, "Trial Company").getByRole("group");
  await expect(companions.getByRole("checkbox")).not.toHaveCount(0);
  await attachFullRenderer(
    testInfo,
    "native-gauntlet-multi-resource-companions",
    jump,
  );
});
