import { expect, test } from "./support/fixtures";

test(
  "Format 1 reference searches contextual syntax and restores the author's place",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(
      "/documentation/guides/format-1-reference.html?embedded=1&theme=dark",
    );

    await expect(page.locator("html")).toHaveAttribute("data-embedded", "true");
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-theme",
      "dark",
    );
    await expect(page.locator(".reference-topbar")).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Author reference" }),
    ).toBeVisible();

    const [sidebarBox, searchBox, contentBox] = await Promise.all([
      page.locator(".reference-sidebar").boundingBox(),
      page.locator("#reference-search").boundingBox(),
      page.locator(".reference-content").boundingBox(),
    ]);
    expect(sidebarBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(sidebarBox!.width).toBeGreaterThanOrEqual(479);
    expect(searchBox!.width).toBeGreaterThan(320);
    expect(Math.abs(contentBox!.x + contentBox!.width - 1600)).toBeLessThan(2);
    await expect(page.locator(".reference-content")).toHaveCSS(
      "padding-left",
      "192px",
    );
    await expect(page.locator(".reference-content")).toHaveCSS(
      "padding-right",
      "192px",
    );

    const search = page.getByRole("searchbox", {
      name: "Search syntax and fields",
    });
    await search.focus();
    await expect(search).toHaveCSS("outline-style", "none");
    await expect(page.locator(".reference-search-control")).not.toHaveCSS(
      "box-shadow",
      "none",
    );
    await search.fill("gender");
    await expect(page.locator("#reference-result-count")).toContainText(
      "results",
    );
    await page
      .locator(".reference-index-group")
      .filter({ has: page.getByRole("heading", { name: "Special cases" }) })
      .getByRole("link", { name: /identity properties/i })
      .click();
    await expect(page.locator("#special-identity-properties")).toHaveAttribute(
      "open",
      "",
    );
    await expect(page.locator("#special-identity-properties")).toContainText(
      "Copied gender requires a select Choice",
    );

    await search.fill("description");
    await page
      .locator('#reference-results a[href="#field-description"]')
      .click();
    await expect(page.locator("#field-description")).toHaveAttribute(
      "open",
      "",
    );

    await page.reload();
    await expect(page.locator("#field-description")).toHaveAttribute(
      "open",
      "",
    );
    await expect(page).toHaveURL(/#field-description$/);
    await expect
      .poll(() =>
        page
          .locator("#field-description")
          .evaluate((entry) => entry.getBoundingClientRect().top),
      )
      .toBeLessThan(100);

    await page.evaluate(() =>
      window.postMessage(
        {
          type: "jumpchain:format-reference-config",
          theme: "light",
          tokens: { "--app-accent-raw": "#4466aa" },
        },
        "*",
      ),
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-theme",
      "light",
    );
    await expect(page.locator("html")).toHaveCSS("--app-accent-raw", "#4466aa");
  },
);

test(
  "embedded Format 1 reference follows every parent application accent text token",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.goto("/");
    await page.locator("html").evaluate((element) => {
      element.dataset.appTheme = "dark";
      element.style.setProperty("--app-accent-raw", "#5577cc");
      element.style.setProperty("--app-accent-text", "#6699ff");
      element.style.setProperty("--app-accent-focus", "#77aaff");
      element.style.setProperty("--app-accent-border", "#6688dd");
      element.style.setProperty("--app-accent-fill", "#5577cc");
      element.style.setProperty("--app-accent-fill-text", "#ffffff");
      element.style.setProperty("--app-accent-soft", "#28334f");
      const frame = document.createElement("iframe");
      frame.title = "Embedded Format 1 reference";
      frame.src = "/documentation/guides/format-1-reference.html?embedded=1";
      frame.style.cssText = "width: 100vw; height: 100vh; border: 0";
      document.body.replaceChildren(frame);
    });

    const reference = page.frameLocator(
      'iframe[title="Embedded Format 1 reference"]',
    );
    await expect(
      reference.getByRole("heading", { name: "Author reference" }),
    ).toBeVisible();
    const accentText = reference.locator(
      ".reference-kicker, .reference-kind, .field-use-context span",
    );
    await expect(accentText.first()).toHaveCSS("color", "rgb(102, 153, 255)");
    expect(await accentText.count()).toBeGreaterThan(100);
    expect(
      await accentText.evaluateAll((elements) =>
        elements.every(
          (element) => getComputedStyle(element).color === "rgb(102, 153, 255)",
        ),
      ),
    ).toBe(true);

    await page.locator("html").evaluate((element) => {
      element.style.setProperty("--app-accent-text", "#cc55aa");
    });
    await expect(accentText.first()).toHaveCSS("color", "rgb(204, 85, 170)");
    expect(
      await accentText.evaluateAll((elements) =>
        elements.every(
          (element) => getComputedStyle(element).color === "rgb(204, 85, 170)",
        ),
      ),
    ).toBe(true);
  },
);

test(
  "declaration summaries stack their type above an unwrapped identifier",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(
      "/documentation/guides/format-1-reference.html?embedded=1&theme=dark",
    );

    const entry = page.locator("#declaration-jump-appearance");
    await entry.scrollIntoViewIfNeeded();
    const summary = entry.locator("summary");
    const badge = summary.locator(".reference-kind");
    const name = summary.locator("code");
    const description = summary.locator(":scope > span:last-of-type");
    const [summaryBox, badgeBox, nameBox, descriptionBox, nameLineHeight] =
      await Promise.all([
        summary.boundingBox(),
        badge.boundingBox(),
        name.boundingBox(),
        description.boundingBox(),
        name.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).lineHeight),
        ),
      ]);
    expect(summaryBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    expect(nameBox).not.toBeNull();
    expect(descriptionBox).not.toBeNull();
    expect(badgeBox!.y + badgeBox!.height).toBeLessThanOrEqual(nameBox!.y);
    expect(nameBox!.height).toBeLessThan(nameLineHeight * 1.3);
    expect(nameBox!.x + nameBox!.width).toBeLessThan(descriptionBox!.x);
    expect(descriptionBox!.x + descriptionBox!.width).toBeLessThan(
      summaryBox!.x + summaryBox!.width - 32,
    );

    const grantSummary = page.locator("#declaration-grant > summary");
    await grantSummary.scrollIntoViewIfNeeded();
    const grantBadge = grantSummary.locator(".reference-kind");
    const grantDescription = grantSummary.locator(":scope > span:last-of-type");
    const [grantBadgeBox, grantDescriptionBox, grantDescriptionLineHeight] =
      await Promise.all([
        grantBadge.boundingBox(),
        grantDescription.boundingBox(),
        grantDescription.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).lineHeight),
        ),
      ]);
    expect(grantBadgeBox).not.toBeNull();
    expect(grantDescriptionBox).not.toBeNull();
    expect(grantDescriptionBox!.height).toBeGreaterThan(
      grantDescriptionLineHeight * 1.5,
    );
    expect(grantBadgeBox!.x + grantBadgeBox!.width).toBeLessThanOrEqual(
      grantDescriptionBox!.x,
    );

    await page.setViewportSize({ width: 700, height: 900 });
    await expect(name).toBeVisible();
    const [narrowSummaryBox, narrowNameBox] = await Promise.all([
      summary.boundingBox(),
      name.boundingBox(),
    ]);
    expect(narrowSummaryBox).not.toBeNull();
    expect(narrowNameBox).not.toBeNull();
    expect(narrowNameBox!.x).toBeGreaterThanOrEqual(narrowSummaryBox!.x);
    expect(narrowNameBox!.x + narrowNameBox!.width).toBeLessThanOrEqual(
      narrowSummaryBox!.x + narrowSummaryBox!.width,
    );
  },
);

test(
  "lexical pattern testers explain matches and restore the author's examples",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(
      "/documentation/guides/format-1-reference.html?embedded=1&theme=dark",
    );

    const lexicalRules = page.locator("#lexical-rules");
    await lexicalRules.locator("summary").click();
    await expect(
      lexicalRules.locator(".schema-rule-list > div").filter({
        has: page.locator("dt", { hasText: "Field Line" }),
      }),
    ).toContainText("One field per physical line");
    await expect(
      lexicalRules.locator(".schema-rule-list > div").filter({
        has: page.locator("dt", { hasText: "Field Order" }),
      }),
    ).toContainText("Insignificant except conditional variants");
    await expect(
      lexicalRules.locator(".schema-rule-list > div").filter({
        has: page.locator("dt", { hasText: "Duplicate Scalar Field" }),
      }),
    ).toContainText("Error");

    const patternRows = lexicalRules.locator(".lexical-pattern-rule");
    const ordinaryRowHeight = await lexicalRules
      .locator(".schema-rule-list > div:not(.lexical-pattern-rule)")
      .first()
      .evaluate((row) => row.getBoundingClientRect().height);
    const tallestPatternRow = await patternRows.evaluateAll((rows) =>
      Math.max(...rows.map((row) => row.getBoundingClientRect().height)),
    );
    expect(tallestPatternRow).toBeLessThanOrEqual(ordinaryRowHeight + 1);

    const handle = page.getByRole("textbox", { name: "Try a handle" });
    const handleTester = handle.locator(
      "xpath=ancestor::*[@data-lexical-tester]",
    );
    await expect(handle).toBeHidden();
    const closedSectionHeight = await lexicalRules.evaluate(
      (entry) => entry.scrollHeight,
    );
    await page.getByRole("button", { name: "Test handle pattern" }).click();
    await expect(handleTester).toBeVisible();
    await expect(handle).toBeFocused();
    await expect(handle).toHaveCSS("outline-style", "none");
    await expect(handleTester.locator(".lexical-tester-control")).not.toHaveCSS(
      "box-shadow",
      "none",
    );
    expect(await lexicalRules.evaluate((entry) => entry.scrollHeight)).toBe(
      closedSectionHeight,
    );
    await expect(handleTester.locator("[data-lexical-status]")).toHaveText(
      "Enter a value to test.",
    );
    await handle.fill("starter_choice");
    await expect(handleTester).toHaveAttribute(
      "data-validation-state",
      "valid",
    );
    await expect(handleTester.locator("[data-lexical-status]")).toHaveText(
      "Matches the handle pattern.",
    );
    await handle.fill("Starter Choice");
    await expect(handle).toHaveAttribute("aria-invalid", "true");
    await expect(handleTester).toHaveAttribute(
      "data-validation-state",
      "invalid",
    );
    await expect(handleTester.locator("[data-lexical-status]")).toContainText(
      "lowercase letters and digits",
    );
    await handle.clear();
    await expect(handleTester).toHaveAttribute(
      "data-validation-state",
      "neutral",
    );
    await expect(handle).not.toHaveAttribute("aria-invalid", "true");

    const integer = page.getByRole("textbox", { name: "Try an integer" });
    const integerTester = integer.locator(
      "xpath=ancestor::*[@data-lexical-tester]",
    );
    await page.getByRole("button", { name: "Test integer pattern" }).click();
    await expect(integerTester).toBeVisible();
    await expect(handleTester).toBeHidden();
    await integer.fill("01");
    await expect(integerTester).toHaveAttribute(
      "data-validation-state",
      "invalid",
    );
    await integer.fill("-42");
    await expect(integerTester).toHaveAttribute(
      "data-validation-state",
      "valid",
    );

    const color = page.getByRole("textbox", { name: "Try a hex color" });
    const colorTester = color.locator(
      "xpath=ancestor::*[@data-lexical-tester]",
    );
    await page.getByRole("button", { name: "Test hex color pattern" }).click();
    await expect(colorTester).toBeVisible();
    await color.fill("#fff");
    await expect(colorTester).toHaveAttribute(
      "data-validation-state",
      "invalid",
    );
    await color.fill("#D4AF37");
    await expect(colorTester).toHaveAttribute("data-validation-state", "valid");
    await expect(colorTester.locator("[data-lexical-preview]")).toHaveCSS(
      "background-color",
      "rgb(212, 175, 55)",
    );

    await page.reload();
    await expect(lexicalRules).not.toHaveAttribute("open", "");
    await lexicalRules.locator("summary").click();
    await expect(integer).toBeHidden();
    await page.getByRole("button", { name: "Test integer pattern" }).click();
    await expect(integer).toHaveValue("-42");
    await page.getByRole("button", { name: "Test hex color pattern" }).click();
    await expect(color).toHaveValue("#D4AF37");
    await expect(colorTester).toHaveAttribute("data-validation-state", "valid");
  },
);

test(
  "declaration builders produce compact contextual starting points",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.addInitScript(() => {
      let copiedText = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: async () => copiedText,
          writeText: async (value: string) => {
            copiedText = value;
          },
        },
      });
    });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(
      "/documentation/guides/format-1-reference.html?embedded=1&theme=dark",
    );

    const entry = page.locator("#declaration-choice");
    await entry.locator("summary").click();
    const closedHeight = await entry.evaluate(
      (element) => element.scrollHeight,
    );
    const trigger = entry.getByRole("button", { name: "Build example" });
    await trigger.focus();
    await trigger.press("Enter");

    const builder = page.locator("#declaration-builder-choice");
    const contextSelect = builder.getByLabel("Form or context");
    const output = builder.locator("[data-skeleton-output]");
    await expect(builder).toBeVisible();
    await expect(contextSelect).toBeFocused();
    expect(await entry.evaluate((element) => element.scrollHeight)).toBe(
      closedHeight,
    );
    await expect(output).toHaveText(
      'choice\n  handle: choice_example\n  name: "Example Choice"',
    );
    const topLevelForm = builder.locator('[data-skeleton-form="0"]');
    const requiredHandle = topLevelForm.locator(
      '[data-skeleton-field-name="handle"]:checked',
    );
    await expect(requiredHandle).toBeChecked();
    await expect(requiredHandle).toBeDisabled();

    const selection = topLevelForm.locator(
      '[data-skeleton-field-name="selection"]',
    );
    await selection.check();
    await expect(output).toContainText("selection: toggle");
    await builder.getByLabel("Find an optional field").fill("selection");
    await expect(selection).toBeVisible();
    await expect(
      topLevelForm.locator('[data-skeleton-field-name="tag"]'),
    ).toBeHidden();

    await contextSelect.selectOption({ label: "section" });
    await expect(output).toContainText("choice\n  handle: choice_example");
    await expect(output).toContainText("target: choice_example");
    await expect(output).not.toContainText("name:");

    const copy = builder.locator("[data-copy-code]");
    await copy.click();
    await expect(copy).toHaveText("Copied");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(await output.textContent());

    await builder
      .getByRole("button", { name: "Close choice declaration builder" })
      .click();
    await expect(builder).toBeHidden();

    const layoutEntry = page.locator("#declaration-section-layout");
    await layoutEntry.locator("summary").click();
    await layoutEntry.getByRole("button", { name: "Build example" }).click();
    await expect(
      page
        .locator("#declaration-builder-section-layout")
        .locator("[data-skeleton-output]"),
    ).toContainText("  stack");
  },
);

test(
  "value checkers validate bounded forms and reveal Tag canonical identity",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(
      "/documentation/guides/format-1-reference.html?embedded=1&theme=dark",
    );

    const openChecker = async (type: string, label: string) => {
      const entry = page.locator(`#type-${type}`);
      if ((await entry.getAttribute("open")) === null)
        await entry.locator("summary").click();
      const closedHeight = await entry.evaluate(
        (element) => element.scrollHeight,
      );
      const trigger = entry.getByRole("button", { name: "Try a value" });
      await trigger.focus();
      await trigger.press("Enter");
      const checker = page.locator(`#value-tester-${type}`);
      const input = checker.getByRole("textbox", { name: label });
      await expect(checker).toBeVisible();
      await expect(input).toBeFocused();
      expect(await entry.evaluate((element) => element.scrollHeight)).toBe(
        closedHeight,
      );
      return { checker, input };
    };

    const cases = [
      ["textSize", "Try a text size", "7px", "8px"],
      ["layoutDimension", "Try a layout dimension", "4097px", "256rem"],
      ["aspectRatio", "Try an aspect ratio", "0/9", "16 / 9"],
      ["imageDimension", "Try an image dimension", "-1px", "0px"],
      ["costAmount", "Try a cost amount", "add_unknown", "add_small"],
      ["grantAmount", "Try a grant amount", "add_small", "large"],
      ["propertyValue", "Try a property value", "01", '"Kanto"'],
    ] as const;
    for (const [type, label, invalid, valid] of cases) {
      const { checker, input } = await openChecker(type, label);
      await input.fill(invalid);
      await expect(checker).toHaveAttribute("data-validation-state", "invalid");
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await input.fill(valid);
      await expect(checker).toHaveAttribute("data-validation-state", "valid");
      await expect(input).not.toHaveAttribute("aria-invalid", "true");
    }

    const { checker: tagChecker, input: tagInput } = await openChecker(
      "tag",
      "Try Tag syntax",
    );
    await tagInput.fill('"Physical_Powers"');
    await expect(tagChecker).toHaveAttribute("data-validation-state", "valid");
    await expect(tagChecker.locator("[data-value-canonical] code")).toHaveText(
      "physical powers",
    );
    await expect(tagChecker).toContainText(
      "The active User Tag profile owns all badge presentation.",
    );

    await page.reload();
    const restored = await openChecker("textSize", "Try a text size");
    await expect(restored.input).toHaveValue("8px");
    await expect(restored.checker).toHaveAttribute(
      "data-validation-state",
      "valid",
    );
  },
);
