import { expect, test } from "@playwright/test";

test("contextual Settings preserves its inert workspace, history, focus, and category", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Settings" });
  await opener.click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("dialog", { name: "Application Settings" }),
  ).toBeVisible();
  await expect(page.locator("main.app-primary-views")).toHaveAttribute(
    "inert",
    "",
  );
  await expect(
    page.getByRole("heading", { name: "Preferences" }),
  ).toBeFocused();

  await page.getByRole("tab", { name: "Tags" }).click();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("tab", { name: "Tags" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await testInfo.attach("settings-reopens-last-category", {
    body: await page
      .getByLabel("Application Settings", { exact: true })
      .screenshot(),
    contentType: "image/png",
  });

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(opener).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("dialog", { name: "Application Settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close Settings" }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const location of ["/chain", "/chain/ch-92b1"]) {
  test(`contextual Settings restores ${location}`, async ({ page }) => {
    await page.goto(location);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(
      page.getByRole("dialog", { name: "Application Settings" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`${location.replaceAll("/", "\\/")}$`),
    );
    await expect(page.getByRole("button", { name: "Settings" })).toBeFocused();
  });
}

test("direct Settings is a full destination and preferences persist through IndexedDB", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(
    page.getByLabel("Application Settings", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Application Settings" }),
  ).toHaveCount(0);
  await expect(page.locator("main.app-primary-views")).toBeHidden();

  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  const warning = page.getByLabel("Warn about upstream changes");
  await expect(warning).not.toBeChecked();
  await warning.check();
  await page.waitForFunction(async () => {
    const request = indexedDB.open("jumpchain-visualizer");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("aggregates", "readonly");
    const read = transaction.objectStore("aggregates").get("settings");
    const stored = await new Promise<unknown>((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    database.close();
    return Boolean(
      (stored as { chain?: { warnUpstreamChanges?: boolean } } | null)?.chain
        ?.warnUpstreamChanges,
    );
  });
  await page.reload();
  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  await expect(page.getByLabel("Warn about upstream changes")).toBeChecked();
  await page.getByRole("button", { name: "Reset category" }).click();
  await expect(
    page.getByLabel("Warn about upstream changes"),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Reset all settings" }).click();
  const reset = page.getByRole("alertdialog", {
    name: "Reset every application setting?",
  });
  await expect(reset).toBeVisible();
  await reset.getByRole("button", { name: "Cancel" }).click();
  await expect(reset).toHaveCount(0);

  await page.getByRole("button", { name: "Close Settings" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("additional Jump information exposes only the package format", async ({
  page,
}) => {
  await page.goto("/chain/ch-92b1");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Developer" }).click();
  const control = page.getByLabel("Enable extra information");
  await expect(control).not.toBeChecked();
  await control.check();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const tracker = page.getByLabel("Interactive Chain Tracker workspace");
  await expect(tracker.locator(".shared-renderer-label")).toHaveText(
    "Format 1 evaluated package",
  );
  await expect(tracker).not.toContainText("Shared Jump renderer");
  await tracker.getByRole("button", { name: /^Earth/ }).click();
  await expect(tracker.locator(".shared-renderer-label")).toHaveCount(0);
  await expect(tracker).not.toContainText("System-owned chain beginning");
});

test("every Settings category preserves the fixed frame and has a fresh visual audit", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1360, height: 920 });
  await page.goto("/settings");
  const categories = [
    "General",
    "Editor",
    "Chain Tracker",
    "Notifications",
    "Tags",
    "Key bindings",
    "Accessibility",
    "Developer",
  ];
  const frame = page.getByLabel("Application Settings", { exact: true });
  const initial = await frame.boundingBox();
  expect(initial).not.toBeNull();
  for (const category of categories) {
    await page.getByRole("tab", { name: category, exact: true }).click();
    const current = await frame.boundingBox();
    expect(current).not.toBeNull();
    expect(Math.round(current!.width)).toBe(Math.round(initial!.width));
    expect(Math.round(current!.height)).toBe(Math.round(initial!.height));
    if (testInfo.project.name === "chromium")
      await testInfo.attach(
        `settings-${category.toLocaleLowerCase().replaceAll(" ", "-")}`,
        {
          body: await frame.screenshot(),
          contentType: "image/png",
        },
      );
  }
});

test("appearance, motion, and keybinding validation apply through their real controls", async ({
  page,
}, testInfo) => {
  await page.goto("/settings");
  await page.getByLabel("Appearance").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "light");
  if (testInfo.project.name === "chromium")
    await testInfo.attach("settings-light-theme", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  await page.getByRole("tab", { name: "Tags" }).click();
  if (testInfo.project.name === "chromium")
    await testInfo.attach("settings-tags-light-theme", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  await page.getByPlaceholder("Search settings").fill("#d4af37");
  await expect(
    page.getByRole("button", { name: /Accent color/ }),
  ).toBeVisible();
  await page.getByPlaceholder("Search settings").fill("");
  await page.getByRole("tab", { name: "Accessibility" }).click();
  await page.getByLabel("Motion", { exact: true }).selectOption("reduced");
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-motion",
    "reduced",
  );

  await page.getByRole("tab", { name: "Key bindings" }).click();
  const quickAdd = page
    .locator(".keybinding-list > div")
    .filter({ hasText: "Quick Add" });
  await quickAdd.getByRole("button", { name: "Change" }).click();
  await quickAdd.getByRole("button", { name: "Cancel" }).press("Control+f");
  await expect(quickAdd.getByRole("alert")).toContainText("already assigned");
  await quickAdd
    .getByRole("button", { name: "Cancel" })
    .press("Control+Shift+k");
  await expect(quickAdd.locator("kbd")).toContainText(
    /Ctrl\+Shift\+K|⌘\+Shift\+K/,
  );
  await quickAdd.getByRole("button", { name: "Reset" }).click();
  await expect(quickAdd.locator("kbd")).toContainText(/Ctrl\+Enter|⌘\+Enter/);
});

test("continuous accent changes stay bounded and project through the complete application", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/settings");
  await expect(
    page.locator(".setting-state", { hasText: "Agreed" }),
  ).toHaveCount(0);
  const accent = page.locator("#accent");
  await accent.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    for (let index = 0; index < 600; index += 1) {
      setValue.call(
        input,
        `#${(0x100000 + ((index * 7919) % 0xefffff)).toString(16).padStart(6, "0")}`,
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setValue.call(input, "#15933b");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(accent).toHaveValue("#15933b");
  await expect
    .poll(() =>
      page
        .locator("html")
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--app-accent-raw").trim(),
        ),
    )
    .toBe("#15933b");
  await expect(page.locator(".app-crash-surface")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "Close Settings" }).click();
  await expect(page).toHaveURL("/");
  expect(
    await page
      .locator(".app-mock-brand > span")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(21, 147, 59)");
  expect(
    await page
      .locator(".app-entry-grid article button")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(21, 147, 59)");

  const resolvedAccent = await page.locator("html").evaluate((element) => {
    const root = getComputedStyle(element);
    const probe = document.createElement("span");
    probe.style.color = root.getPropertyValue("--app-accent-border");
    element.append(probe);
    const border = getComputedStyle(probe).color;
    probe.style.color = root.getPropertyValue("--app-accent-text");
    const text = getComputedStyle(probe).color;
    probe.remove();
    return { border, text };
  });
  const resume = page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first();
  await expect(resume).toHaveCSS("border-color", resolvedAccent.border);
  await resume.hover();
  await expect(resume).toHaveCSS("color", resolvedAccent.text);

  const viewAll = page.getByRole("button", { name: "View all 8 chains" });
  await expect(viewAll).toHaveCSS("border-style", "dashed");
  const viewDefault = await viewAll.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    border: getComputedStyle(element).borderColor,
  }));
  const defaultBorderChannels = viewDefault.border.match(/\d+/g)!.map(Number);
  expect(defaultBorderChannels[1]).toBeGreaterThan(defaultBorderChannels[0]);
  expect(defaultBorderChannels[1]).toBeGreaterThan(defaultBorderChannels[2]);
  await viewAll.hover();
  await expect(viewAll).toHaveCSS("border-style", "solid");
  await expect(viewAll).toHaveCSS("border-color", resolvedAccent.border);
  await expect(viewAll).toHaveCSS("color", resolvedAccent.text);
  const viewHover = await viewAll.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(viewHover).not.toBe(viewDefault.background);
  if (testInfo.project.name === "chromium")
    await testInfo.attach("application-accent-home-hover", {
      body: await viewAll.screenshot(),
      contentType: "image/png",
    });

  await page.goto("/chain");
  const newChain = page.locator(".app-new-chain");
  const hubAccent = await newChain.evaluate((element) => {
    const style = getComputedStyle(element);
    const channels = style.borderColor.match(/\d+(?:\.\d+)?/g)?.map(Number);
    return {
      background: style.backgroundImage,
      border: channels ?? [],
    };
  });
  expect(hubAccent.background).toContain("linear-gradient");
  expect(hubAccent.border[1]).toBeGreaterThan(hubAccent.border[0]);
  expect(hubAccent.border[1]).toBeGreaterThan(hubAccent.border[2]);
  await expect(
    page
      .locator(".app-chain-card")
      .first()
      .getByRole("button", { name: /Edit/ }),
  ).toHaveCSS("border-color", resolvedAccent.border);
  if (testInfo.project.name === "chromium")
    await testInfo.attach("application-accent-chain-hub", {
      body: await newChain.screenshot(),
      contentType: "image/png",
    });

  await page.goto("/chain/ch-92b1");
  await expect(
    page.locator('.chain-main-tabs button[aria-selected="true"]'),
  ).toHaveCSS("border-bottom-color", "rgb(21, 147, 59)");
  await page.getByRole("tab", { name: /^Inventory/ }).click();
  await page.getByRole("tab", { name: "Stats" }).click();
  await expect(page.locator("#category-radar-svg > .radar-area")).toHaveCSS(
    "stroke",
    "rgb(21, 147, 59)",
  );
  if (testInfo.project.name === "chromium")
    await testInfo.attach("application-accent-projection", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
});

test("the Settings preview and tracker use one canonical badge renderer with visible rainbow motion", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const badgeStyle = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          color: style.color,
          padding: style.padding,
          border: style.border,
          borderRadius: style.borderRadius,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textDecoration: style.textDecoration,
          textShadow: style.textShadow,
        };
      });

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Tags" }).click();
  const previewStyle = await badgeStyle(
    ".tag-profile-preview-surface.is-dark .tag-profile-badge",
  );
  await page.getByRole("button", { name: "Close Settings" }).click();
  await page.goto("/chain/ch-92b1");
  await page.getByRole("tab", { name: /^Inventory/ }).click();
  const inventoryPhysical = page
    .locator(".chain-record-list .tag-profile-badge")
    .filter({ hasText: /^Physical$/ })
    .first();
  await expect(inventoryPhysical).toBeVisible();
  const inventoryStyle = await inventoryPhysical.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      color: style.color,
      padding: style.padding,
      border: style.border,
      borderRadius: style.borderRadius,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      textDecoration: style.textDecoration,
      textShadow: style.textShadow,
    };
  });
  expect(inventoryStyle).toEqual(previewStyle);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Tags" }).click();
  await page
    .locator(".tag-profile-form-scroll label")
    .filter({ hasText: /^Text color mode/ })
    .locator("select")
    .selectOption("custom");
  await page
    .locator(".tag-profile-form-scroll label")
    .filter({ hasText: /^Text color/ })
    .locator('input[type="color"]')
    .fill("#ffffff");
  await page.locator(".tag-animation-trigger").click();
  await page.getByRole("option", { name: "Rainbow" }).click();
  const rainbow = page.locator(
    ".tag-profile-preview-surface.is-dark .tag-animated-text.is-rainbow",
  );
  await expect(rainbow).toHaveCSS("animation-name", "tag-rainbow");
  const firstColor = await rainbow.evaluate(
    (element) => getComputedStyle(element).color,
  );
  await page.waitForTimeout(450);
  const secondColor = await rainbow.evaluate(
    (element) => getComputedStyle(element).color,
  );
  expect(firstColor).not.toBe("rgb(255, 255, 255)");
  expect(secondColor).not.toBe(firstColor);
  if (testInfo.project.name === "chromium")
    await testInfo.attach("canonical-rainbow-tag-badge", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
});

test("default child badges visibly shift from their parent and siblings in Inventory", async ({
  page,
}, testInfo) => {
  await page.goto("/chain/ch-92b1");
  await page.getByRole("tab", { name: /^Inventory/ }).click();
  const list = page.locator(".chain-record-list");
  // Kept in the attachment metadata during failures to show the actual fixture labels.
  const renderedLabels = [
    ...new Set(await list.locator(".tag-profile-badge").allTextContents()),
  ];
  const badge = (name: string) =>
    list
      .locator(".tag-profile-badge")
      .filter({ hasText: new RegExp(`^${name}$`) })
      .first();
  const parent = badge("Magic");
  const firstChild = badge("Cryokinesis");
  const secondChild = badge("Enchanting");
  await expect(parent).toBeVisible();
  await expect(
    firstChild,
    `Rendered tags: ${renderedLabels.join(", ")}`,
  ).toBeVisible();
  await expect(
    secondChild,
    `Rendered tags: ${renderedLabels.join(", ")}`,
  ).toBeVisible();
  const renderedBackground = (locator: typeof parent) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.backgroundImage}|${style.borderColor}`;
    });
  const [parentColor, firstChildColor, secondChildColor] = await Promise.all([
    renderedBackground(parent),
    renderedBackground(firstChild),
    renderedBackground(secondChild),
  ]);
  expect(firstChildColor).not.toBe(parentColor);
  expect(secondChildColor).not.toBe(parentColor);
  expect(firstChildColor).not.toBe(secondChildColor);
  await testInfo.attach("shifted-parent-and-child-tag-badges", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("global search opens nested Logs and session controls use real events", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  for (let index = 0; index < 24; index += 1)
    await page.getByLabel("Warn about upstream changes").click();
  await page.getByPlaceholder("Search settings").fill("session logs");
  await page.getByRole("button", { name: /Session logs/ }).click();
  await expect(page.getByRole("tab", { name: "Logs" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.locator(".logging-event-list code", { hasText: "app.started" }),
  ).toBeVisible();
  const eventList = page.locator(".logging-event-list");
  await eventList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await eventList.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  expect(
    await eventList.evaluate((element) =>
      Math.ceil(element.scrollTop + element.clientHeight),
    ),
  ).toBeGreaterThanOrEqual(
    await eventList.evaluate((element) => element.scrollHeight),
  );

  await page.getByRole("button", { name: "Export…" }).click();
  await expect(
    page.getByRole("dialog", { name: "Export session events" }),
  ).toContainText("Redaction");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(page.getByText("Session logs cleared.")).toBeVisible();

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByLabel("Capture debug events").check();
  await page.getByRole("tab", { name: "Logs" }).click();
  await expect(
    page.locator(".logging-event-list code", {
      hasText: "renderer.cache.reused",
    }),
  ).toBeVisible();
});

test("notifications preview, queue controls, and live regions follow preferences", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Notifications" }).click();
  await page.getByRole("button", { name: "Preview toast" }).click();
  const toast = page.locator(".app-toast");
  await expect(toast).toContainText("Notification preferences updated.");
  await toast.hover();
  await page.waitForTimeout(600);
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(toast).toHaveCount(0);

  await page.getByLabel("Enable toast notifications").uncheck();
  await expect(
    page.getByRole("button", { name: "Preview toast" }),
  ).toBeDisabled();
  const panel = page.locator(".settings-notifications-panel");
  await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    page.getByText("Errors and recovery", { exact: true }),
  ).toBeVisible();
});

test("Chain Tracker policies apply immediately without deferred renderer controls", async ({
  page,
}) => {
  await page.goto("/chain/ch-92b1");
  const tracker = page.getByLabel("Interactive Chain Tracker workspace");
  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("revision");
  await tracker.getByRole("button", { name: "Add to chain" }).click();
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(9);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  await page.getByLabel("Allow second version").check();
  await page.getByLabel("Warn about upstream changes").check();
  await page.getByRole("button", { name: "Close Settings" }).click();

  await tracker.getByRole("tab", { name: "Library" }).click();
  await tracker.getByPlaceholder("Find a jump").fill("revision");
  await tracker.getByRole("button", { name: "Add to chain" }).click();
  await expect(tracker.locator(".chain-jump-entry")).toHaveCount(10);
  await tracker.getByRole("tab", { name: /^Chain & Jump/ }).click();
  await tracker
    .getByRole("button", {
      name: "Move War of Seven Crowns later in the chain",
    })
    .click();
  await expect(
    tracker.getByRole("dialog", { name: "Review move" }),
  ).toContainText("Affected dependencies");
});

test("tag profile supports keyboard creation, relationships, presentation, and reviewed import", async ({
  page,
}, testInfo) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Tags" }).click();
  const editor = page.locator(".tag-profile-editor");
  await expect(editor.locator(".tag-profile-workspace > *")).toHaveCount(3);
  await page.getByRole("button", { name: "Enter tag manually" }).click();
  await page.getByPlaceholder("Example: Summoning").fill("  storm_control  ");
  await page.getByPlaceholder("Example: Summoning").press("Enter");
  await expect(page.locator("#tag-profile-form-heading")).toHaveText(
    "Storm Control",
  );
  await page.getByLabel("Parent", { exact: true }).selectOption("magic");
  await page.getByLabel("Background", { exact: true }).selectOption("gradient");
  await page.getByRole("button", { name: "+ Add stop" }).click();
  await expect(page.locator(".tag-gradient-node")).toHaveCount(4);
  const track = page.locator(".tag-gradient-track");
  const node = page.locator(".tag-gradient-node").nth(1);
  const [trackBox, nodeBox] = await Promise.all([
    track.boundingBox(),
    node.boundingBox(),
  ]);
  expect(trackBox).not.toBeNull();
  expect(nodeBox).not.toBeNull();
  const beforePosition = await node.getAttribute("aria-label");
  await page.mouse.move(
    nodeBox!.x + nodeBox!.width / 2,
    nodeBox!.y + nodeBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    trackBox!.x + trackBox!.width * 0.32,
    trackBox!.y + trackBox!.height / 2,
  );
  await page.mouse.up();
  await expect(node).not.toHaveAttribute("aria-label", beforePosition!);
  await page.locator(".tag-animation-trigger").click();
  await page.getByRole("option", { name: "Ghost" }).click();

  await page.getByRole("button", { name: /Import JSON/ }).click();
  await page.getByLabel("JSON document").fill(
    JSON.stringify({
      schemaVersion: 1,
      tags: [
        {
          name: "Weather Working",
          parent: "Magic",
          appearanceSource: "derived",
        },
      ],
      aliasLinks: [],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await expect(page.locator(".tag-json-panel [role='status']")).toContainText(
    "No changes have been applied",
  );
  await expect(page.getByText("Weather Working", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Apply reviewed import" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByPlaceholder("Find tag").fill("Weather Working");
  const weather = page.getByRole("button", { name: /Weather Working/ });
  await expect(weather).toBeVisible();
  await weather.click();
  await page
    .getByLabel("Tag to link as an alias")
    .selectOption("storm-control");
  await page.getByRole("button", { name: "Link alias" }).click();
  await page.getByPlaceholder("Find tag").fill("Storm Control");
  await page
    .locator(".tag-profile-item")
    .filter({ hasText: /^Storm Control/ })
    .click();
  await expect(
    page
      .locator(".tag-profile-preview-pane dd")
      .filter({ hasText: /^Weather Working$/ }),
  ).toBeVisible();

  await testInfo.attach("settings-tags-wide", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("tag catalog separates collapsible presets and refreshes installed Jump tags on demand", async ({
  page,
}, testInfo) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Tags" }).click();
  const primary = page.locator('[data-tag-group="primary"]');
  const builtin = page.locator('[data-tag-group="builtin"]');
  const acquired = page.locator('[data-tag-group="acquired"]');
  await expect(primary.getByRole("button").first()).toContainText(
    "Primary Tags",
  );
  const primaryHeading = primary.getByRole("button").first();
  await expect(primaryHeading).toHaveAttribute("aria-expanded", "false");
  await primaryHeading.click();
  await expect(primary.locator(".tag-profile-item")).toHaveCount(12);
  await expect(
    primary
      .locator(".tag-profile-item")
      .filter({ hasText: /^Physical/ })
      .locator("small"),
  ).toHaveText("Built-in");
  await primaryHeading.click();
  const builtinHeading = builtin.getByRole("button").first();
  await expect(builtinHeading).toHaveAttribute("aria-expanded", "false");
  await builtinHeading.click();
  expect(await builtin.locator(".tag-profile-item").count()).toBeGreaterThan(
    130,
  );
  await expect(acquired.getByRole("button").first()).toContainText(
    "Acquired Tags",
  );
  await expect(acquired.locator(".tag-profile-item")).toHaveCount(0);

  await builtinHeading.click();
  await expect(builtinHeading).toHaveAttribute("aria-expanded", "false");
  await expect(builtin.locator(".tag-profile-item")).toHaveCount(0);
  await page.getByPlaceholder("Find tag").fill("Vehicles");
  const vehicle = builtin.locator(".tag-profile-item").filter({
    hasText: /^Vehicle/,
  });
  await expect(vehicle).toBeVisible();
  await expect(vehicle.locator("small")).toHaveText(
    "Built-in · From Technology",
  );
  await vehicle.click();
  await expect(page.getByLabel("Parent", { exact: true })).toBeEnabled();
  await expect(page.locator(".tag-alias-chip")).toContainText("Vehicles");
  await page
    .getByLabel("Parent", { exact: true })
    .selectOption("miscellaneous");
  await expect(vehicle.locator("small")).toHaveText(
    "Built-in · From Miscellaneous",
  );
  await expect(
    page
      .locator(".tag-profile-preview-pane dd")
      .filter({ hasText: /^Miscellaneous$/ }),
  ).toBeVisible();
  await page.getByPlaceholder("Find tag").fill("");

  await page.getByRole("button", { name: "Refresh acquired tags" }).click();
  await expect(
    page.locator(".tag-add-panel li").filter({
      hasText: "Highcourt Etiquette",
    }),
  ).toBeVisible();
  const addDetected = page.getByRole("button", { name: /Add \d+ detected/ });
  await addDetected.click();
  await expect(acquired).toBeVisible();
  const installed = acquired.locator(".tag-profile-item").filter({
    hasText: /^Highcourt Etiquette/,
  });
  await expect(installed).toContainText("Installed jump · From Miscellaneous");
  await page.getByRole("button", { name: "Refresh acquired tags" }).click();
  await expect(
    page.getByText(
      "Every normalized tag string from installed Jumps is already in this profile.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Enter tag manually" }).click();
  await page.getByPlaceholder("Example: Summoning").fill("Archive Favorite");
  await page.getByRole("button", { name: "Add tag" }).click();
  const custom = acquired.locator(".tag-profile-item").filter({
    hasText: /^Archive Favorite/,
  });
  await expect(custom).toContainText("Custom · From Miscellaneous");

  const acquiredHeading = acquired.getByRole("button").first();
  await acquiredHeading.click();
  await expect(acquiredHeading).toHaveAttribute("aria-expanded", "false");
  await expect(acquired.locator(".tag-profile-item")).toHaveCount(0);
  if (testInfo.project.name === "chromium")
    await testInfo.attach("settings-tags-expanded-catalog", {
      body: await page.locator(".tag-profile-list-pane").screenshot(),
      contentType: "image/png",
    });
});

test("Settings remains internally scrollable and unclipped at the narrow breakpoint", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 720, height: 760 });
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Tags" }).click();
  const surface = page.getByLabel("Application Settings", { exact: true });
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(720);
  const scroller = page.locator(".tag-profile-form-scroll");
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await scroller.evaluate((element) =>
      Math.ceil(element.scrollTop + element.clientHeight),
    ),
  ).toBeGreaterThanOrEqual(
    await scroller.evaluate((element) => element.scrollHeight),
  );
  await testInfo.attach("settings-tags-narrow-bottom", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("window failures open the recoverable, reviewable crash report surface", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("Fixture window failure");
    });
  });
  await expect(
    page.getByRole("heading", {
      name: "Jumpchain Visualizer encountered an error",
    }),
  ).toBeVisible();
  await expect(page.getByText(/Fixture window failure/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy report" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save report…" }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium")
    await testInfo.attach("recoverable-crash-surface", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
});
