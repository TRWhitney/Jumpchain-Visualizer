import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "./support/fixtures";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { unzipSync, zipSync } from "fflate";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  captureReviewScreenshot,
  reviewArtifactsEnabled,
  shouldCaptureReviewArtifacts,
} from "./support/reviewArtifacts";

async function openCreatedEditor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Editor" }).click();
  await page.getByRole("button", { name: "Create Project" }).click();
  const editor = page.locator(".production-editor");
  await expect(editor).toBeVisible();
  return editor;
}

async function expectInside(parent: Locator, child: Locator) {
  const [parentBox, childBox] = await Promise.all([
    parent.boundingBox(),
    child.boundingBox(),
  ]);
  expect(parentBox).not.toBeNull();
  expect(childBox).not.toBeNull();
  expect(childBox!.x).toBeGreaterThanOrEqual(parentBox!.x - 1);
  expect(childBox!.y).toBeGreaterThanOrEqual(parentBox!.y - 1);
  expect(childBox!.x + childBox!.width).toBeLessThanOrEqual(
    parentBox!.x + parentBox!.width + 1,
  );
  expect(childBox!.y + childBox!.height).toBeLessThanOrEqual(
    parentBox!.y + parentBox!.height + 1,
  );
  return childBox!;
}

async function resolveColorToken(page: Page, token: string) {
  return page.locator("html").evaluate((element, customProperty) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${customProperty})`;
    element.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

async function openReference(page: Page, width: number, height: number) {
  const reference = await page.context().newPage();
  await reference.setViewportSize(await page.viewportSize()!);
  await reference.goto("/documentation/editor-design.html");
  await reference.addStyleTag({
    content: `
      body { margin: 0 !important; overflow: hidden !important; background: #20201e !important; }
      body > :not(main) { display: none !important; }
      main > :not(.mockup-section) { display: none !important; }
      .mockup-section { margin: 0 !important; }
      .mockup-section > :not(.editor-mockup) { display: none !important; }
      .editor-mockup { width: ${width}px !important; height: ${height}px !important; grid-template-rows: 3rem minmax(0, 1fr) auto !important; border-radius: 0 !important; box-sizing: border-box !important; }
      .mock-explorer { height: auto !important; min-height: 0 !important; }
    `,
  });
  return { reference, mock: reference.locator(".editor-mockup") };
}

async function openAssetReference(
  page: Page,
  width: number,
  height: number,
  mode: "svg" | "raster",
  state: "ready" | "rendering" | "warning" | "error",
) {
  const reference = await page.context().newPage();
  await reference.setViewportSize(await page.viewportSize()!);
  await reference.goto("/documentation/editor-design.html");
  await reference.selectOption("#asset-design-mode", mode);
  await reference.selectOption("#asset-design-state", state);
  await reference.addStyleTag({
    content: `
      body { margin: 0 !important; overflow: hidden !important; background: #20201e !important; }
      body > :not(main) { display: none !important; }
      main > :not(.mockup-section) { display: none !important; }
      .mockup-section { margin: 0 !important; }
      .mockup-section > :not(.asset-editor-design) { display: none !important; }
      .asset-editor-design { width: ${width}px !important; height: ${height}px !important; margin: 0 !important; border-radius: 0 !important; box-sizing: border-box !important; }
    `,
  });
  return { reference, mock: reference.locator(".asset-editor-design") };
}

async function attachComparison(
  testInfo: TestInfo,
  name: string,
  reference: Locator,
  production: Locator,
) {
  if (!reviewArtifactsEnabled) {
    const [referenceBox, productionBox] = await Promise.all([
      reference.boundingBox(),
      production.boundingBox(),
    ]);
    expect(referenceBox).not.toBeNull();
    expect(productionBox).not.toBeNull();
    expect(
      Math.abs(referenceBox!.width - productionBox!.width),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(referenceBox!.height - productionBox!.height),
    ).toBeLessThanOrEqual(2);
    return;
  }
  const saveState = production.page().locator(".editor-save-state:visible");
  if ((await saveState.count()) > 0)
    await expect(saveState).toHaveText("Saved");
  const referenceBytes = await captureReviewScreenshot(reference);
  const productionBytes = await captureReviewScreenshot(production);
  const left = PNG.sync.read(referenceBytes);
  const right = PNG.sync.read(productionBytes);
  const width = Math.max(left.width, right.width);
  const height = Math.max(left.height, right.height);
  const leftCanvas = new PNG({ width, height, fill: true });
  const rightCanvas = new PNG({ width, height, fill: true });
  PNG.bitblt(left, leftCanvas, 0, 0, left.width, left.height, 0, 0);
  PNG.bitblt(right, rightCanvas, 0, 0, right.width, right.height, 0, 0);
  const difference = new PNG({ width, height, fill: true });
  const changed = pixelmatch(
    leftCanvas.data,
    rightCanvas.data,
    difference.data,
    width,
    height,
    { threshold: 0.12, includeAA: false },
  );
  const sideBySide = new PNG({ width: width * 2, height, fill: true });
  PNG.bitblt(leftCanvas, sideBySide, 0, 0, width, height, 0, 0);
  PNG.bitblt(rightCanvas, sideBySide, 0, 0, width, height, width, 0);
  const differenceBytes = PNG.sync.write(difference);
  const sideBySideBytes = PNG.sync.write(sideBySide);
  const summaryBytes = Buffer.from(
    JSON.stringify(
      {
        changedPixels: changed,
        totalPixels: width * height,
        ratio: changed / (width * height),
      },
      null,
      2,
    ) + "\n",
  );
  await testInfo.attach(`${name}-reference`, {
    body: referenceBytes,
    contentType: "image/png",
  });
  await testInfo.attach(`${name}-production`, {
    body: productionBytes,
    contentType: "image/png",
  });
  await testInfo.attach(`${name}-difference`, {
    body: differenceBytes,
    contentType: "image/png",
  });
  await testInfo.attach(`${name}-side-by-side`, {
    body: sideBySideBytes,
    contentType: "image/png",
  });
  await testInfo.attach(`${name}-difference-summary`, {
    body: summaryBytes,
    contentType: "application/json",
  });
  if (shouldCaptureReviewArtifacts(testInfo)) {
    const artifactDirectory = join(process.cwd(), "artifacts", "editor-visual");
    await mkdir(artifactDirectory, { recursive: true });
    await Promise.all([
      writeFile(
        join(artifactDirectory, `${name}-reference.png`),
        referenceBytes,
      ),
      writeFile(
        join(artifactDirectory, `${name}-production.png`),
        productionBytes,
      ),
      writeFile(
        join(artifactDirectory, `${name}-difference.png`),
        differenceBytes,
      ),
      writeFile(
        join(artifactDirectory, `${name}-side-by-side.png`),
        sideBySideBytes,
      ),
      writeFile(
        join(artifactDirectory, `${name}-difference-summary.json`),
        summaryBytes,
      ),
    ]);
  }
  expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(2);
}

async function attachProductionState(
  testInfo: TestInfo,
  name: string,
  production: Locator,
) {
  if (!reviewArtifactsEnabled) return;
  const saveState = production.page().locator(".editor-save-state:visible");
  if ((await saveState.count()) > 0)
    await expect(saveState).toHaveText("Saved");
  const bytes = await captureReviewScreenshot(production);
  await testInfo.attach(name, { body: bytes, contentType: "image/png" });
  if (shouldCaptureReviewArtifacts(testInfo)) {
    const artifactDirectory = join(process.cwd(), "artifacts", "editor-visual");
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(join(artifactDirectory, `${name}.png`), bytes);
  }
}

test("Editor hub project cards stay compact without mangling their content", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1117, height: 850 });
  const workspaceEditor = await openCreatedEditor(page);
  const longDescription =
    "A deliberately detailed Jump description that explains the premise, expected tone, starting situation, and authoring intent without becoming generic advertising copy, while remaining useful when the project is browsed later.";
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  const shortCard = page.locator(".editor-project-card").first();
  const shortCardBox = await shortCard.boundingBox();
  expect(shortCardBox).not.toBeNull();
  await shortCard.locator(".editor-project-card-description").hover();
  const shortTooltipCount = await shortCard.getByRole("tooltip").count();
  await shortCard.getByRole("button", { name: "Open Project" }).click();
  await workspaceEditor
    .locator(".editor-schema-field")
    .filter({ hasText: "description" })
    .locator("textarea")
    .fill(longDescription);
  await page.getByRole("button", { name: "Editor", exact: true }).click();

  const card = page.locator(".editor-project-card").first();
  const list = page.locator(".editor-project-card-list");
  await card.scrollIntoViewIfNeeded();
  const main = card.locator(".editor-project-card-main");
  const description = card.locator(".editor-project-card-description");
  const metadata = card.locator("dl");
  const star = card.locator(".app-chain-star");
  const actions = card.locator(".app-chain-card-actions");
  const [listBox, cardBox, mainBox, , metadataBox] = await Promise.all([
    list.boundingBox(),
    card.boundingBox(),
    expectInside(card, main),
    expectInside(card, description),
    expectInside(card, metadata),
    expectInside(card, star),
    expectInside(card, actions),
  ]);
  expect(listBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.width).toBeLessThan(listBox!.width * 0.6);
  expect(mainBox.width).toBeGreaterThan(200);
  await expect(description).toContainText("A deliberately detailed Jump");
  await expect(description).toHaveCSS("font-weight", "400");
  await expect(description).toHaveCSS("text-transform", "none");
  await expect(description).not.toHaveAttribute("title", /.+/);
  await expect(description).toHaveCSS("-webkit-line-clamp", "3");
  await description.hover();
  const tooltip = card.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-hub-project-description-production",
    page.locator(".app-primary-views"),
  );
  const [descriptionBox, tooltipBox, deleteBox, actionsBox] = await Promise.all(
    [
      description.boundingBox(),
      tooltip.boundingBox(),
      card.getByRole("button", { name: "Delete Untitled Jump" }).boundingBox(),
      actions.boundingBox(),
    ],
  );
  expect(descriptionBox).not.toBeNull();
  expect(tooltipBox).not.toBeNull();
  expect(deleteBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(
    Math.min(deleteBox!.y, actionsBox!.y) -
      (descriptionBox!.y + descriptionBox!.height),
  ).toBeGreaterThanOrEqual(7.5);
  await page.mouse.move(1000, 800);
  await expect(tooltip).toBeHidden();
  await attachProductionState(
    testInfo,
    "editor-hub-project-card-spacing-production",
    card,
  );
  await description.hover();
  await expect(tooltip).toBeVisible();
  const descriptionMetrics = await description.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      lineHeight: Number.parseFloat(style.lineHeight),
      scrollHeight: element.scrollHeight,
      whiteSpace: style.whiteSpace,
    };
  });
  expect(descriptionMetrics.whiteSpace).toBe("normal");
  expect(descriptionBox!.height).toBeGreaterThanOrEqual(
    descriptionMetrics.lineHeight * 2.8,
  );
  expect(descriptionBox!.height).toBeLessThanOrEqual(
    descriptionMetrics.lineHeight * 3.2,
  );
  expect(descriptionMetrics.scrollHeight).toBeGreaterThan(
    descriptionMetrics.clientHeight + 1,
  );
  expect(Math.abs(cardBox!.height - shortCardBox!.height)).toBeLessThanOrEqual(
    1,
  );
  expect(
    Math.abs(tooltipBox!.width - descriptionBox!.width),
  ).toBeLessThanOrEqual(2);
  await expect(tooltip).toContainText(longDescription);
  expect(
    await tooltip.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        ) === element
      );
    }),
  ).toBe(true);
  expect(shortTooltipCount).toBe(0);
  expect(metadataBox.width).toBeGreaterThan(130);
  const detailRows = await metadata.locator(":scope > div").all();
  const detailBoxes = [];
  for (const tile of detailRows) {
    const tileBox = await expectInside(card, tile);
    expect(tileBox.width).toBeGreaterThan(130);
    detailBoxes.push(tileBox);
  }
  expect(new Set(detailBoxes.map((box) => Math.round(box.x))).size).toBe(1);
  expect(detailBoxes.map((box) => box.y)).toEqual(
    [...detailBoxes].map((box) => box.y).sort((left, right) => left - right),
  );
  if (shouldCaptureReviewArtifacts(testInfo)) {
    await testInfo.attach("editor-hub-project-card-desktop", {
      body: await card.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  }

  await page.setViewportSize({ width: 640, height: 700 });
  await card.scrollIntoViewIfNeeded();
  await expect(metadata).toBeVisible();
  const narrowMain = await expectInside(card, main);
  await expectInside(card, metadata);
  await expectInside(card, star);
  await expectInside(card, actions);
  expect(narrowMain.width).toBeGreaterThan(300);
  if (shouldCaptureReviewArtifacts(testInfo)) {
    await testInfo.attach("editor-hub-project-card-narrow", {
      body: await card.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  }

  await page.setViewportSize({ width: 520, height: 700 });
  await card.scrollIntoViewIfNeeded();
  await expect(metadata).toBeHidden();
  await expectInside(card, main);
  await expectInside(card, star);
  await expectInside(card, actions);
});

test("Open Project Folder is a persisted default-off Developer setting", async ({
  page,
}, testInfo) => {
  await page.goto("/editor");
  await expect(
    page.getByRole("button", { name: "Open Project Folder" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByPlaceholder("Search settings").fill("open project folder");
  await page.getByRole("button", { name: /Show Open Project Folder/ }).click();
  await attachProductionState(
    testInfo,
    "settings-open-project-folder-production",
    page.getByLabel("Application Settings", { exact: true }),
  );
  const toggle = page.getByLabel("Show folder action");
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  const folderAction = page.getByRole("button", {
    name: "Open Project Folder",
  });
  await expect(folderAction).toBeVisible();
  await expect(folderAction).toBeDisabled();
  await attachProductionState(
    testInfo,
    "editor-hub-open-project-folder-enabled-production",
    page.locator(".app-primary-views"),
  );
  await page.reload();
  await expect(folderAction).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Developer" }).click();
  await page
    .locator(".setting-row")
    .filter({ hasText: "Show Open Project Folder" })
    .getByRole("button", { name: "Reset" })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(folderAction).toHaveCount(0);
});

test("Editor project cards delete only after the shared confirmation", async ({
  page,
}, testInfo) => {
  await openCreatedEditor(page);
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  const card = page.locator(".editor-project-card").first();
  const remove = card.getByRole("button", { name: "Delete Untitled Jump" });
  const open = card.getByRole("button", { name: "Open Project" });
  const star = card.getByRole("button", { name: "Star Untitled Jump" });
  const [removeBox, openBox, starBox] = await Promise.all([
    remove.boundingBox(),
    open.boundingBox(),
    star.boundingBox(),
  ]);
  expect(removeBox).not.toBeNull();
  expect(openBox).not.toBeNull();
  expect(starBox).not.toBeNull();
  expect(removeBox!.x).toBeLessThan(openBox!.x);
  expect(starBox!.x).toBeGreaterThan(openBox!.x + openBox!.width - 1);

  await remove.click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Delete Untitled Jump?",
  });
  await expect(confirmation).toContainText(
    "Are you sure you want to delete “Untitled Jump”?",
  );
  await expect(confirmation).toHaveCSS(
    "border-color",
    await resolveColorToken(page, "--app-accent-border"),
  );
  const confirmDelete = confirmation.getByRole("button", {
    name: "Delete project",
  });
  await expect(confirmDelete).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await confirmDelete.hover();
  await expect(confirmDelete).toHaveCSS(
    "background-color",
    await resolveColorToken(page, "--app-danger-surface"),
  );
  await attachProductionState(
    testInfo,
    "editor-project-delete-confirmation-production",
    page.locator(".app-primary-shell"),
  );
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(card).toBeVisible();
  await page.reload();
  await expect(card).toBeVisible();

  await remove.click();
  await confirmation.getByRole("button", { name: "Delete project" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".editor-project-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await expect(
    page
      .getByRole("region", { name: "Editor workspaces" })
      .getByText("Untitled Jump"),
  ).toHaveCount(0);
});

test(
  "Editor follows the mock across structured, source, layout, and diagnostic states",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    const editor = await openCreatedEditor(page);
    const bounds = await editor.boundingBox();
    expect(bounds).not.toBeNull();
    const { reference, mock } = await openReference(
      page,
      Math.round(bounds!.width),
      Math.round(bounds!.height),
    );

    await editor.getByRole("button", { name: "introduction" }).click();
    await mock.locator('[data-mock-view="origins"]').click();
    await attachComparison(testInfo, "editor-structured-section", mock, editor);
    await editor.getByPlaceholder("Search content").fill("welcome");
    await mock.getByPlaceholder("Find content").fill("welcome");
    await attachComparison(testInfo, "editor-sidebar-filtered", mock, editor);
    await editor.getByPlaceholder("Search content").fill("");
    await mock.getByPlaceholder("Find content").fill("");

    await editor.getByRole("tab", { name: "Source" }).click();
    await mock.getByRole("tab", { name: "Source" }).click();
    await attachComparison(testInfo, "editor-source-collapsed", mock, editor);
    const sourceEditor = editor.getByLabel("jump.jdef source");
    await sourceEditor.click();
    await sourceEditor.press("Home");
    const activeLine = editor.locator(".cm-activeLine");
    const caret = editor.locator(".cm-cursor");
    await expect(activeLine).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(activeLine).not.toHaveCSS("box-shadow", "none");
    await expect(caret).toHaveCSS("border-left-width", "2px");
    await expect(caret).not.toHaveCSS("border-left-color", "rgba(0, 0, 0, 0)");
    await expect(editor.locator(".cm-selectionBackground")).toHaveCount(0);
    await attachComparison(testInfo, "editor-source-single-line", mock, editor);
    await sourceEditor.press("Shift+ArrowDown");
    await sourceEditor.press("Shift+ArrowDown");
    await expect(editor.locator(".cm-selected-source-line").first()).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(editor.locator(".cm-selectionBackground")).not.toHaveCount(0);
    await attachComparison(testInfo, "editor-source-multi-line", mock, editor);

    await editor.getByRole("button", { name: "Find", exact: true }).click();
    await editor.getByPlaceholder("Find").fill("name");
    await editor.getByLabel("Match whole word").click();
    await attachComparison(
      testInfo,
      "editor-source-advanced-find",
      mock,
      editor,
    );
    await editor.getByRole("button", { name: "Find", exact: true }).click();
    await editor.getByRole("button", { name: "Quick Add" }).click();
    await mock.getByRole("button", { name: "Quick add" }).click();
    await attachComparison(testInfo, "editor-source-quick-add", mock, editor);

    await editor.getByLabel("Close Quick Add").click();
    await editor.getByRole("button", { name: "Add", exact: true }).click();
    await editor.getByRole("button", { name: "Choice", exact: true }).click();
    await editor.getByRole("button", { name: "Add", exact: true }).click();
    await editor.getByRole("button", { name: "Choice layout" }).click();
    await editor.getByRole("tab", { name: "Structured" }).click();
    await editor.getByRole("button", { name: "new_choice_layout" }).click();
    await editor.getByLabel("Show bounds").check();
    await mock.getByLabel("Close Quick add").click();
    await mock.getByRole("tab", { name: "Structured" }).click();
    await mock
      .locator("summary")
      .filter({ hasText: /^Layouts/ })
      .click();
    await mock.locator('[data-mock-view="origin-section-layout"]').click();
    await mock.getByLabel("Show bounds").check();
    await mock.locator("[data-preview-bound]").first().hover();
    const firstBound = editor.locator("[data-layout-bound]").first();
    const firstBoundPath = await firstBound.getAttribute("data-layout-bound");
    expect(firstBoundPath).toMatch(/^[a-z]+\[1\](?:\/[a-z]+\[\d+\])*$/);
    await firstBound.hover();
    await expect(editor.locator(".editor-bound-readout")).toContainText(
      firstBoundPath!,
    );
    await attachComparison(
      testInfo,
      "editor-layout-bounds-hover",
      mock,
      editor,
    );
    await attachProductionState(
      testInfo,
      "editor-layout-structural-path-bounds-production",
      editor,
    );

    await editor.getByRole("tab", { name: "Source" }).click();
    const source = editor.getByLabel(/source$/);
    await source.press("Control+End");
    await source.press("Enter");
    await source.pressSequentially("invalid syntax here");
    await source.press("Enter");
    await editor.getByRole("button", { name: "Diagnostics" }).click();
    await mock.getByRole("button", { name: "Diagnostics" }).click();
    await attachComparison(
      testInfo,
      "editor-expanded-diagnostics",
      mock,
      editor,
    );

    await reference.close();
  },
);

test("sidebar entry hover text appears only for visually truncated labels", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section", exact: true }).click();
  await editor.getByLabel("handle", { exact: true }).fill("short_section");
  await editor.getByLabel("handle", { exact: true }).press("Tab");
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section layout" }).click();
  const longLabel = "section_layout_with_a_deliberately_long_handle";
  await editor.getByLabel("handle", { exact: true }).fill(longLabel);
  await editor.getByLabel("handle", { exact: true }).press("Tab");

  const outline = editor.locator(".editor-outline-scroll");
  const shortEntry = outline.getByRole("button", {
    name: "short_section",
    exact: true,
  });
  const longEntry = outline.getByRole("button", {
    name: `${longLabel} section`,
    exact: true,
  });
  await expect(shortEntry).toBeVisible();
  await expect(longEntry).toBeVisible();
  const isTruncated = (entry: Locator) =>
    entry
      .locator(":scope > span")
      .evaluate((label) => label.scrollWidth > label.clientWidth);
  expect(await isTruncated(shortEntry)).toBe(false);
  expect(await isTruncated(longEntry)).toBe(true);
  await shortEntry.hover();
  await expect(shortEntry).not.toHaveAttribute("title");
  await expect(longEntry).toHaveAttribute("title", longLabel);
  await attachProductionState(
    testInfo,
    "editor-sidebar-overflow-title-corrected",
    editor.locator(".editor-explorer"),
  );
  await shortEntry.evaluate((entry) => {
    entry.style.gridTemplateColumns = "2rem auto";
  });
  await expect.poll(() => isTruncated(shortEntry)).toBe(true);
  await expect(shortEntry).toHaveAttribute("title", "short_section");
  await shortEntry.evaluate((entry) => {
    entry.style.gridTemplateColumns = "";
  });
  await expect.poll(() => isTruncated(shortEntry)).toBe(false);
  await expect(shortEntry).not.toHaveAttribute("title");
});

test("sidebar context menus move declarations and assets through Trash", async ({
  page,
}, testInfo) => {
  const editor = await openCreatedEditor(page);
  const section = editor.getByRole("button", {
    name: "introduction",
    exact: true,
  });
  await section.click({ button: "right" });
  const liveMenu = editor.getByRole("menu", { name: "Sidebar item actions" });
  await expect(liveMenu).toBeVisible();
  await expect(liveMenu.getByRole("menuitem")).toHaveText(["Open", "Delete"]);
  await attachProductionState(
    testInfo,
    "editor-sidebar-trash-context-corrected",
    editor,
  );
  await liveMenu.getByRole("menuitem", { name: "Open" }).click();
  await expect(section).toHaveClass(/is-selected/);

  await section.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Delete" })
    .click();
  await expect(section).toHaveCount(0);
  await expect(editor.locator(".editor-trash-group > summary")).toContainText(
    "Trash1",
  );
  const trashedSection = editor
    .locator(".editor-trash-group")
    .getByRole("button", { name: "introduction Section", exact: true });
  await expect(trashedSection).toHaveClass(/is-selected/);
  await expect(editor.getByRole("tab", { name: "Structured" })).toHaveCount(0);
  await expect(editor.getByRole("tab", { name: "Source" })).toBeVisible();
  await expect(editor.locator(".editor-trash-source-panel pre")).toContainText(
    "section\n  handle: introduction",
  );
  await expect(
    editor.locator(".editor-trash-source-panel pre"),
  ).not.toContainText("jump\n");
  await attachProductionState(
    testInfo,
    "editor-trash-declaration-source-corrected",
    editor,
  );

  await editor.getByRole("button", { name: "Undo" }).click();
  await expect(
    editor.getByRole("button", { name: "introduction", exact: true }),
  ).toBeVisible();
  await expect(editor.locator(".editor-trash-group > summary")).toContainText(
    "Trash0",
  );
  await editor.getByRole("button", { name: "Redo" }).click();
  const redoneTrashSection = editor
    .locator(".editor-trash-group")
    .getByRole("button", { name: "introduction Section", exact: true });
  await expect(redoneTrashSection).toBeVisible();

  await redoneTrashSection.click({ button: "right" });
  const trashMenu = editor.getByRole("menu", { name: "Sidebar item actions" });
  await expect(trashMenu.getByRole("menuitem")).toHaveText([
    "Open",
    "Restore",
    "Delete",
  ]);
  await trashMenu.getByRole("menuitem", { name: "Restore" }).click();
  await expect(
    editor.getByRole("button", { name: "introduction", exact: true }),
  ).toBeVisible();
  await expect(editor.locator(".editor-trash-group > summary")).toContainText(
    "Trash0",
  );

  const restored = editor.getByRole("button", {
    name: "introduction",
    exact: true,
  });
  await restored.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Delete" })
    .click();
  const trashedAgain = editor
    .locator(".editor-trash-group")
    .getByRole("button", { name: "introduction Section", exact: true });
  await trashedAgain.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Delete" })
    .click();
  const permanentDialog = editor.getByRole("alertdialog", {
    name: "Permanently delete introduction?",
  });
  await expect(permanentDialog.locator("..")).toHaveClass(
    /is-application-confirmation/,
  );
  await expect(
    permanentDialog.getByRole("button", { name: "Cancel" }),
  ).toBeFocused();
  await expect(permanentDialog).toContainText("cannot be undone");
  await expect(permanentDialog).toContainText("undo and redo history");
  await attachProductionState(
    testInfo,
    "editor-trash-permanent-delete-dialog-shared",
    editor,
  );
  await permanentDialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(editor.locator(".editor-trash-group > summary")).toContainText(
    "Trash0",
  );
  await expect(editor.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("the Editor preference confirms permanent sidebar deletion and hides only empty Trash", async ({
  page,
}, testInfo) => {
  const editor = await openCreatedEditor(page);
  const section = editor.getByRole("button", {
    name: "introduction",
    exact: true,
  });
  await expect(editor.locator(".editor-trash-group > summary")).toContainText(
    "Trash0",
  );

  await section.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Delete" })
    .click();
  await expect(editor.locator(".editor-trash-group > summary")).toContainText(
    "Trash1",
  );

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Editor" }).click();
  const permanentDelete = page.getByLabel("Permanently delete sidebar items");
  await expect(permanentDelete).not.toBeChecked();
  await permanentDelete.check();
  await attachProductionState(
    testInfo,
    "settings-editor-permanent-sidebar-delete-enabled",
    page.getByLabel("Application Settings", { exact: true }),
  );
  await page.getByRole("button", { name: "Close Settings" }).click();

  const trashedSection = editor
    .locator(".editor-trash-group")
    .getByRole("button", { name: "introduction Section", exact: true });
  await expect(trashedSection).toBeVisible();
  await trashedSection.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Restore" })
    .click();
  await expect(section).toBeVisible();
  await expect(editor.locator(".editor-trash-group")).toHaveCount(0);
  await editor.getByRole("tab", { name: "Files" }).click();
  await expect(editor.locator(".editor-trash-group")).toHaveCount(0);
  await editor.getByRole("tab", { name: "Content" }).click();

  await section.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Delete" })
    .click();
  const confirmation = editor.getByRole("alertdialog", {
    name: "Permanently delete introduction?",
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "Cancel" }),
  ).toBeFocused();
  await attachProductionState(
    testInfo,
    "editor-sidebar-permanent-delete-confirmation",
    page.locator("body"),
  );
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(section).toBeVisible();
  await expect(editor.locator(".editor-trash-group")).toHaveCount(0);

  await section.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Delete" })
    .click();
  await editor
    .getByRole("alertdialog", { name: "Permanently delete introduction?" })
    .getByRole("button", { name: "Delete forever" })
    .click();
  await expect(section).toHaveCount(0);
  await expect(editor.locator(".editor-trash-group")).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Undo" })).toBeDisabled();

  const image = new PNG({ width: 1, height: 1 });
  image.data.set([36, 112, 190, 255]);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Asset…" }).click();
  await (
    await chooserPromise
  ).setFiles({
    name: "direct.png",
    mimeType: "image/png",
    buffer: PNG.sync.write(image),
  });
  const asset = editor.getByRole("button", { name: /^direct\.png/ });
  await expect(asset).toBeVisible();
  const assetAddedToast = page.locator(".app-toast").filter({
    hasText: "Asset added",
  });
  await expect(assetAddedToast).toBeVisible();
  await assetAddedToast
    .getByRole("button", { name: "Dismiss notification" })
    .click();
  await asset.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Delete" })
    .click();
  await editor
    .getByRole("alertdialog", { name: "Permanently delete direct.png?" })
    .getByRole("button", { name: "Delete forever" })
    .click();
  await expect(asset).toHaveCount(0);
  await expect(editor.locator(".editor-trash-group")).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Undo" })).toBeDisabled();
  await attachProductionState(
    testInfo,
    "editor-sidebar-permanent-delete-empty-trash-hidden",
    editor,
  );
});

test("sidebar group context menus add and toggle their disclosures", async ({
  page,
}, testInfo) => {
  const editor = await openCreatedEditor(page);
  const groupMenu = editor.getByRole("menu", {
    name: "Sidebar group actions",
  });
  const sections = editor.locator(
    'details[data-explorer-group="content:sections"]',
  );
  const sectionsHeader = sections.locator(":scope > summary");

  await sectionsHeader.click({ button: "right" });
  await expect(groupMenu.getByRole("menuitem")).toHaveText([
    "Add Section",
    "Collapse",
  ]);
  await expect(
    groupMenu.getByRole("menuitem", { name: "Add Section" }),
  ).toBeFocused();
  await attachProductionState(
    testInfo,
    "editor-sidebar-section-header-context-menu-corrected",
    editor,
  );
  await groupMenu.getByRole("menuitem", { name: "Collapse" }).click();
  await expect(sections).not.toHaveAttribute("open");

  await sectionsHeader.click({ button: "right" });
  await expect(groupMenu.getByRole("menuitem")).toHaveText([
    "Add Section",
    "Expand",
  ]);
  await groupMenu.getByRole("menuitem", { name: "Expand" }).click();
  await expect(sections).toHaveAttribute("open", "");

  await sectionsHeader.click({ button: "right" });
  await groupMenu.getByRole("menuitem", { name: "Add Section" }).click();
  await expect(
    editor.getByRole("button", { name: "new_section", exact: true }),
  ).toHaveClass(/is-selected/);
  await expect(
    editor
      .locator(".editor-authoring-pane")
      .getByRole("heading", { name: "New Section" }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Add", exact: true }),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-sidebar-section-header-add-corrected",
    editor,
  );

  const layoutsHeader = editor
    .locator('details[data-explorer-group="content:layouts"]')
    .locator(":scope > summary");
  await layoutsHeader.click({ button: "right" });
  await expect(groupMenu.getByRole("menuitem")).toHaveText([
    "Add Section layout",
    "Add Choice layout",
    "Add Trait layout",
    "Collapse",
  ]);
  await page.keyboard.press("Escape");

  for (const [groupId, item] of [
    ["resources", "Resource"],
    ["choices", "Choice"],
    ["themes", "Theme"],
  ] as const) {
    await editor
      .locator(`details[data-explorer-group="content:${groupId}"]`)
      .locator(":scope > summary")
      .click({ button: "right" });
    await expect(groupMenu.getByRole("menuitem")).toHaveText([
      `Add ${item}`,
      "Collapse",
    ]);
    await page.keyboard.press("Escape");
  }

  const assetsHeader = editor
    .locator('details[data-explorer-group="content:assets"]')
    .locator(":scope > summary");
  await assetsHeader.click({ button: "right" });
  await expect(groupMenu.getByRole("menuitem")).toHaveText([
    "Add Asset…",
    "Collapse",
  ]);
  const fileChooserPromise = page.waitForEvent("filechooser");
  await groupMenu.getByRole("menuitem", { name: "Add Asset…" }).click();
  const fileChooser = await fileChooserPromise;
  expect(fileChooser.isMultiple()).toBe(false);
  await fileChooser.setFiles([]);

  const trashHeader = editor
    .locator('details[data-explorer-group="content:trash"]')
    .locator(":scope > summary");
  await trashHeader.click({ button: "right" });
  await expect(groupMenu.getByRole("menuitem")).toHaveText(["Collapse"]);
  await page.keyboard.press("Escape");

  await editor.getByRole("tab", { name: "Files" }).click();
  const fileAssetsHeader = editor
    .locator('details[data-explorer-group="files:assets"]')
    .locator(":scope > summary");
  await fileAssetsHeader.click({ button: "right" });
  await expect(groupMenu.getByRole("menuitem")).toHaveText([
    "Add Asset…",
    "Collapse",
  ]);
});

test("Structured handle editing preserves declaration identity through temporary collisions", async ({
  page,
}) => {
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section", exact: true }).click();
  await editor.getByLabel("handle", { exact: true }).fill("abc");
  await editor.getByLabel("handle", { exact: true }).press("Tab");
  await editor.getByLabel("name", { exact: true }).fill("Existing ABC");
  await editor.getByLabel("name", { exact: true }).press("Tab");

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section", exact: true }).click();
  const handle = editor.getByLabel("handle", { exact: true });
  await handle.fill("");
  for (const character of "abc") {
    await handle.pressSequentially(character);
    await expect(editor.getByLabel("name", { exact: true })).toHaveValue(
      "New Section",
    );
  }
  if (reviewArtifactsEnabled) {
    await editor.screenshot({
      path: "artifacts/editor-visual/editor-structured-handle-collision-corrected.png",
    });
  }
  await handle.pressSequentially("2");
  await expect(handle).toHaveValue("abc2");
  await expect(editor.getByLabel("name", { exact: true })).toHaveValue(
    "New Section",
  );
  await editor.getByRole("tab", { name: "Source" }).click();
  const sourceEditor = editor.getByLabel("jump.jdef source");
  await expect
    .poll(() => sourceEditor.textContent())
    .toMatch(/handle:\s*abc\s+name:\s*"Existing ABC"/);
  await expect
    .poll(() => sourceEditor.textContent())
    .toMatch(/handle:\s*abc2\s+name:\s*"New Section"/);
});

test("Show bounds does not extend the authored preview surface", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1400, height: 900 });
  const editor = await openCreatedEditor(page);
  const previewSurface = editor.locator(".editor-preview-scroll");
  const renderedJump = editor.locator(".format-one-jump-renderer");

  const surfaceBefore = await previewSurface.boundingBox();
  const jumpBefore = await renderedJump.boundingBox();
  expect(surfaceBefore).not.toBeNull();
  expect(jumpBefore).not.toBeNull();
  await attachProductionState(
    testInfo,
    "editor-preview-bounds-off-production",
    editor.locator(".editor-context-pane"),
  );

  await editor.getByLabel("Show bounds").check();
  const surfaceAfter = await previewSurface.boundingBox();
  const jumpAfter = await renderedJump.boundingBox();
  expect(surfaceAfter).not.toBeNull();
  expect(jumpAfter).not.toBeNull();
  expect(
    Math.abs(surfaceAfter!.height - surfaceBefore!.height),
  ).toBeLessThanOrEqual(2);
  expect(Math.abs(jumpAfter!.height - jumpBefore!.height)).toBeLessThanOrEqual(
    2,
  );
  await expect(editor.locator(".editor-bounds-legend")).toBeVisible();
  await expect(editor.locator(".editor-bound-readout")).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-preview-bounds-on-production",
    editor.locator(".editor-context-pane"),
  );
});

test("Strip color changes only the live preview and keeps authored colors intact", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1400, height: 900 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Choice layout" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();

  const source = editor.getByLabel(/source$/);
  const authoredMarkup = `theme
  handle: preview_surface
  color: "#123456"

choice-layout
  handle: colored_preview

  stack
    gap: sm
    background: preview_surface
    text-color: "#FEDCBA"

    slot: name

    text: description

    rule
      color: "#C85A71"
      thickness: 4
      style: rounded
`;
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(authoredMarkup);
  await editor.getByRole("button", { name: "colored_preview" }).click();
  await expect(editor.locator(".editor-save-state")).toHaveText("Saved", {
    timeout: 2_000,
  });

  const markupBeforeToggle = await source.textContent();
  const preview = editor.locator(".editor-real-preview");
  const container = preview.locator('[data-layout-kind="stack"]').first();
  const rule = preview.locator('[data-layout-kind="rule"] hr');
  await expect(container).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(container).toHaveCSS("color", "rgb(254, 220, 186)");
  await expect(rule).toHaveCSS("background-color", "rgb(200, 90, 113)");

  const showBounds = editor.getByLabel("Show bounds");
  const stripColor = editor.getByLabel("Strip color");
  const [boundsLabel, stripLabel] = await Promise.all([
    showBounds.locator("..").boundingBox(),
    stripColor.locator("..").boundingBox(),
  ]);
  expect(boundsLabel).not.toBeNull();
  expect(stripLabel).not.toBeNull();
  expect(stripLabel!.x).toBeGreaterThanOrEqual(
    boundsLabel!.x + boundsLabel!.width,
  );
  expect(stripLabel!.y).toBeCloseTo(boundsLabel!.y, 0);
  await attachProductionState(
    testInfo,
    "editor-preview-strip-color-off-production",
    editor.locator(".editor-context-pane"),
  );

  await stripColor.check();
  await expect(container).not.toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(container).not.toHaveCSS("color", "rgb(254, 220, 186)");
  await expect(rule).not.toHaveCSS("background-color", "rgb(200, 90, 113)");
  await expect(source).toHaveText(markupBeforeToggle!);
  await expect(editor.locator(".editor-save-state")).toHaveText("Saved");
  await attachProductionState(
    testInfo,
    "editor-preview-strip-color-on-production",
    editor.locator(".editor-context-pane"),
  );

  await stripColor.uncheck();
  await expect(container).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(container).toHaveCSS("color", "rgb(254, 220, 186)");
  await expect(rule).toHaveCSS("background-color", "rgb(200, 90, 113)");
  await expect(source).toHaveText(markupBeforeToggle!);
  await expect(editor.locator(".editor-save-state")).toHaveText("Saved");
});

test("Show bounds matches the mock boundary language and exact hover behavior", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1400, height: 900 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Choice layout" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel(/source$/);
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`choice-layout
  handle: bounds_debugger

  stack
    slot: name
    text: description
    slot: control
`);
  await editor.getByRole("button", { name: "bounds_debugger" }).click();

  await editor.getByLabel("Show bounds").check();
  const legend = editor.locator(".editor-bounds-legend");
  const readout = editor.locator(".editor-bound-readout");
  const preview = editor.locator(".editor-preview-scroll");
  const [legendBox, readoutBox, previewBox] = await Promise.all([
    legend.boundingBox(),
    readout.boundingBox(),
    preview.boundingBox(),
  ]);
  expect(legendBox).not.toBeNull();
  expect(readoutBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  expect(readoutBox!.y).toBeGreaterThanOrEqual(
    legendBox!.y + legendBox!.height,
  );
  expect(readoutBox!.y + readoutBox!.height).toBeLessThanOrEqual(previewBox!.y);
  expect(readoutBox!.height).toBeLessThanOrEqual(32);

  const legendStyles = await legend.evaluate((element) =>
    ["container", "slot", "reference"].map((kind) => {
      const item = element.querySelector(`.is-${kind}`)!;
      const marker = getComputedStyle(item, "::before");
      return {
        color: getComputedStyle(item).color,
        style: marker.borderStyle,
      };
    }),
  );
  expect(legendStyles).toEqual([
    { color: "rgb(8, 126, 170)", style: "dashed" },
    { color: "rgb(32, 123, 70)", style: "solid" },
    { color: "rgb(142, 61, 176)", style: "dotted" },
  ]);

  const containerBound = editor.locator(
    '[data-layout-bound-kind="container"][data-layout-bound="stack[1]"]',
  );
  const slotBound = editor.locator(
    '[data-layout-bound-kind="slot"][data-layout-bound="stack[1]/slot[1]"]',
  );
  const referenceBound = editor.locator(
    '[data-layout-bound-kind="reference"][data-layout-bound="stack[1]/text[2]"]',
  );
  await expect(containerBound).toHaveCSS("outline-style", "dashed");
  await expect(containerBound).toHaveCSS(
    "outline-color",
    "rgba(8, 126, 170, 0.72)",
  );
  await expect(slotBound).toHaveCSS("outline-style", "solid");
  await expect(slotBound).toHaveCSS("outline-color", "rgba(32, 123, 70, 0.78)");
  await expect(referenceBound).toHaveCSS("outline-style", "dotted");
  await expect(referenceBound).toHaveCSS(
    "outline-color",
    "rgba(142, 61, 176, 0.78)",
  );

  await referenceBound.hover();
  await expect(referenceBound).toHaveClass(/is-layout-bound-active/);
  await expect(referenceBound).toHaveCSS("outline-style", "solid");
  await expect(referenceBound).toHaveCSS("outline-width", "2px");
  await expect(containerBound).not.toHaveClass(/is-layout-bound-active/);
  await expect(slotBound).not.toHaveClass(/is-layout-bound-active/);
  await expect(
    editor.locator("[data-layout-bound].is-layout-bound-active"),
  ).toHaveCount(1);
  await expect(readout).toContainText("Reference · stack[1]/text[2]");
  await expect(readout.locator("i")).toHaveCSS(
    "background-color",
    "rgb(142, 61, 176)",
  );
  await attachProductionState(
    testInfo,
    "editor-layout-bounds-mock-parity-production",
    editor.locator(".editor-context-pane"),
  );
});

test("clicking layout preview bounds outlines the exact Structured node or selects its Source keyword", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1400, height: 900 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Choice layout" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("layout.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`choice-layout
  handle: bounds_navigation

  stack
    slot: name

    inline
      padding: sm
      text: description

      text
        target: details
        text-align: end

      slot: control
`);
  await editor.getByRole("button", { name: "bounds_navigation" }).click();
  await editor.getByRole("tab", { name: "Structured" }).click();
  await editor.getByLabel("Show bounds").check();

  const inlinePath = "stack[1]/inline[2]";
  const textPath = `${inlinePath}/text[1]`;
  const blockTextPath = `${inlinePath}/text[2]`;
  const inlineBound = editor.locator(
    `[data-layout-bound-kind="container"][data-layout-bound="${inlinePath}"]`,
  );
  const textBound = editor.locator(
    `[data-layout-bound-kind="reference"][data-layout-bound="${textPath}"]`,
  );
  const blockTextBound = editor.locator(
    `[data-layout-bound-kind="reference"][data-layout-bound="${blockTextPath}"]`,
  );

  await textBound.click();
  const inspectedContainer = editor.locator(
    `[data-layout-container-editor-path="${inlinePath}"]`,
  );
  const inspectedText = editor.locator(`[data-layout-node-path="${textPath}"]`);
  await expect(inspectedContainer).toBeVisible();
  await expect(inspectedText).toBeVisible();
  await expect(inspectedText).toHaveClass(/is-layout-inspected/);
  await expect(inspectedText.locator("input").first()).not.toBeFocused();
  await expect(
    inspectedText.locator(".editor-layout-row-node-fields"),
  ).toHaveCount(0);

  await blockTextBound.click();
  const inspectedBlockText = editor.locator(
    `[data-layout-node-path="${blockTextPath}"]`,
  );
  await expect(inspectedBlockText).toBeVisible();
  await expect(inspectedBlockText).toHaveClass(/is-layout-inspected/);
  await expect(inspectedBlockText.locator("input").first()).not.toBeFocused();
  await expect(
    inspectedBlockText.locator(".editor-layout-row-node-fields"),
  ).toHaveCount(0);

  const clickInlineBoundary = async () => {
    await inlineBound.click({ position: { x: 2, y: 2 } });
  };
  await clickInlineBoundary();
  await expect(inspectedContainer).toHaveClass(/is-layout-inspected/);
  await expect(inspectedContainer.locator("select").first()).not.toBeFocused();

  await textBound.click();
  await attachProductionState(
    testInfo,
    "editor-layout-bound-click-structured-inspection-production",
    editor,
  );

  await editor.getByRole("tab", { name: "Source" }).click();
  await clickInlineBoundary();
  await expect(editor.locator(".cm-activeLine")).toContainText("inline");
  await expect(editor.locator(".cm-selectionBackground")).toHaveCount(1);

  await textBound.click();
  await expect(editor.locator(".cm-activeLine")).toContainText(
    "text: description",
  );
  const selectedKeyword = editor.locator(".cm-selectionBackground");
  await expect(selectedKeyword).toHaveCount(1);
  const keywordBox = await selectedKeyword.boundingBox();
  expect(keywordBox).not.toBeNull();
  expect(keywordBox!.width).toBeGreaterThan(20);
  expect(keywordBox!.width).toBeLessThan(55);
  await attachProductionState(
    testInfo,
    "editor-layout-bound-click-source-keyword-production",
    editor,
  );
});

test("layout presentation controls render complete leaf and flow alignment semantics", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1400, height: 900 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Choice layout" }).click();

  const replaceLayout = async (sourceText: string, handle: string) => {
    await editor.getByRole("tab", { name: "Source" }).click();
    const source = editor.getByLabel(/source$/);
    await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
    await page.keyboard.insertText(sourceText);
    await editor.getByRole("button", { name: handle }).click();
    await editor.getByRole("tab", { name: "Structured" }).click();
  };

  await replaceLayout(
    `choice-layout
  handle: text_alignment

  stack
    gap: sm

    text
      target: description
`,
    "text_alignment",
  );
  const preview = editor.locator(".editor-real-preview");
  const textRow = editor.locator('[data-layout-node-kind="text"]');
  await textRow
    .getByRole("button", { name: "Edit Text presentation fields" })
    .click();
  const textBoundary = preview.locator('[data-layout-kind="text"]');
  const renderedText = textBoundary.locator(".jump-layout-text");
  const stretchedTextBox = await textBoundary.boundingBox();
  expect(stretchedTextBox).not.toBeNull();

  await textRow.getByLabel("align", { exact: true }).selectOption("center");
  const centeredTextBox = await textBoundary.boundingBox();
  expect(centeredTextBox).not.toBeNull();
  expect(centeredTextBox!.width).toBeLessThan(stretchedTextBox!.width);
  expect(centeredTextBox!.x).toBeGreaterThan(stretchedTextBox!.x);

  await textRow.getByLabel("align", { exact: true }).selectOption("end");
  const endedTextBox = await textBoundary.boundingBox();
  expect(endedTextBox).not.toBeNull();
  expect(endedTextBox!.x).toBeGreaterThan(centeredTextBox!.x);
  await attachProductionState(
    testInfo,
    "editor-layout-text-leaf-align-end-production",
    editor.locator(".editor-context-pane"),
  );

  await textRow.getByLabel("align", { exact: true }).selectOption("center");
  await textRow
    .getByLabel("text align", { exact: true })
    .selectOption("center");
  await expect(renderedText).toHaveCSS("text-align", "center");
  const centeredTextContentBox = await renderedText.boundingBox();
  expect(centeredTextContentBox).not.toBeNull();
  expect(centeredTextContentBox!.width).toBeCloseTo(centeredTextBox!.width, 0);

  const containerPresentationButton = editor.getByRole("button", {
    name: "Edit Stack presentation fields",
  });
  await containerPresentationButton.click();
  const containerEditor = editor.locator(".editor-layout-selected-editor");
  await containerEditor
    .getByLabel("text align", { exact: true })
    .selectOption("end");
  await expect(renderedText).toHaveCSS("text-align", "center");
  await textRow
    .getByRole("button", { name: "Edit Text presentation fields" })
    .click();
  await textRow
    .getByLabel("text align", { exact: true })
    .selectOption({ label: "Not set" });
  await expect(renderedText).toHaveCSS("text-align", "end");
  await attachProductionState(
    testInfo,
    "editor-layout-text-align-inheritance-production",
    editor.locator(".editor-context-pane"),
  );

  for (const flow of ["stack", "inline", "wrap", "grid"] as const) {
    const image =
      flow === "wrap"
        ? `    image
      target: portrait
      size: sm`
        : "    image: portrait";
    await replaceLayout(
      `choice-layout
  handle: flow_alignment

  ${flow}
${flow === "grid" ? "    columns: 2\n" : ""}    gap: sm
    text: description
${image}
`,
      "flow_alignment",
    );
    await editor
      .getByRole("button", {
        name: `Edit ${flow[0].toLocaleUpperCase() + flow.slice(1)} presentation fields`,
      })
      .click();
    const flowEditor = editor.locator(".editor-layout-selected-editor");
    const flowContainer = preview.locator(
      '[data-layout-bound-kind="container"]',
    );
    const flowText = preview.locator('[data-layout-kind="text"]');
    const flowImage = preview.locator('[data-layout-kind="image"]');
    const imageElement = flowImage.locator("img");
    await expect(imageElement).toBeVisible();
    const [containerBox, imageBefore] = await Promise.all([
      flowContainer.boundingBox(),
      flowImage.boundingBox(),
    ]);
    expect(containerBox).not.toBeNull();
    expect(imageBefore).not.toBeNull();
    expect(imageBefore!.width).toBeGreaterThan(0);
    expect(imageBefore!.height).toBeGreaterThan(0);

    await flowEditor.getByLabel("align", { exact: true }).selectOption("start");
    const textAtStart = await flowText.boundingBox();
    await flowEditor
      .getByLabel("align", { exact: true })
      .selectOption("center");
    const textAtCenter = await flowText.boundingBox();
    await flowEditor.getByLabel("align", { exact: true }).selectOption("end");
    const textAtEnd = await flowText.boundingBox();
    expect(textAtStart).not.toBeNull();
    expect(textAtCenter).not.toBeNull();
    expect(textAtEnd).not.toBeNull();
    if (flow === "stack") {
      expect(textAtStart!.x).toBeCloseTo(containerBox!.x, 0);
      expect(textAtCenter!.x).toBeGreaterThan(textAtStart!.x);
      expect(textAtEnd!.x).toBeGreaterThan(textAtCenter!.x);
    } else {
      expect(textAtStart!.y).toBeCloseTo(containerBox!.y, 0);
      expect(textAtCenter!.y).toBeGreaterThan(textAtStart!.y);
      expect(textAtEnd!.y).toBeGreaterThan(textAtCenter!.y);
    }
    await attachProductionState(
      testInfo,
      `editor-layout-${flow}-alignment-production`,
      editor.locator(".editor-context-pane"),
    );

    await flowEditor
      .getByLabel("align", { exact: true })
      .selectOption("stretch");
    const textAtStretch = await flowText.boundingBox();
    expect(textAtStretch).not.toBeNull();
    if (flow === "stack") {
      expect(textAtStretch!.width).toBeCloseTo(containerBox!.width, 0);
    } else {
      expect(textAtStretch!.height).toBeGreaterThan(textAtEnd!.height);
    }
  }

  const sharedPresentation = `
      padding: sm
      background: "#123456"
      align: end
      text-align: center
      text-size: lg
      text-color: white`;
  await replaceLayout(
    `choice-layout
  handle: complete_leaf_presentation

  grid
    columns: 2
    gap: sm

    slot
      target: name${sharedPresentation}

    text
      target: description${sharedPresentation}

    input
      target: quantity${sharedPresentation}

    image
      target: portrait
      padding: sm
      background: "#123456"
      align: end
      size: md
      fit: cover
`,
    "complete_leaf_presentation",
  );
  for (const kind of ["slot", "text", "input"]) {
    const leaf = preview.locator(`[data-layout-kind="${kind}"]`);
    await expect(leaf).toHaveCSS("padding", "8px");
    await expect(leaf).toHaveCSS("background-color", "rgb(18, 52, 86)");
    await expect(leaf).toHaveCSS("justify-self", "end");
    await expect(leaf).toHaveCSS("text-align", "center");
    await expect(leaf).toHaveCSS("font-size", "14.4px");
    await expect(leaf).toHaveCSS("color", "rgb(255, 255, 255)");
  }
  const presentedImage = preview.locator('[data-layout-kind="image"]');
  await expect(presentedImage).toHaveCSS("padding", "8px");
  await expect(presentedImage).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(presentedImage).toHaveCSS("justify-self", "end");
  await expect(presentedImage).toHaveCSS("width", "128px");
  const presentedImageBox = await presentedImage.boundingBox();
  expect(presentedImageBox).not.toBeNull();
  expect(presentedImageBox!.height).toBeCloseTo(presentedImageBox!.width, 0);
  await expect(presentedImage.locator("img")).toHaveCSS("object-fit", "cover");
  await editor.getByLabel("Show bounds").check();
  await presentedImage.hover();
  await expect(
    preview.locator("[data-layout-bound].is-layout-bound-active"),
  ).toHaveCount(1);
  await attachProductionState(
    testInfo,
    "editor-layout-complete-leaf-presentation-production",
    editor.locator(".editor-context-pane"),
  );
});

test("Inline Text alignment uses the row's visible available space", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 2048, height: 1024 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section layout" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("layout.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`section-layout
  handle: introduction_layout

  stack
    gap: md

    inline
      gap: md
      text: welcome

      text
        target: blah
        align: end
        text-align: center

    text: asdf

    inline
      gap: md
      text: asdfdf
      text: sadfdd
`);
  await editor.getByRole("button", { name: "introduction_layout" }).click();
  await editor.getByRole("tab", { name: "Structured" }).click();

  const builder = editor.locator(".editor-layout-builder");
  await builder
    .getByLabel("Editing container")
    .selectOption({ label: "stack[1]/inline[1]" });
  const textRow = builder.locator('[data-layout-node-kind="text"]').nth(1);
  await textRow
    .getByRole("button", { name: "Edit Text presentation fields" })
    .click();
  const preview = editor.locator(".editor-real-preview");
  const inline = preview.locator('[data-layout-kind="inline"]').first();
  const textBoundary = inline.locator('[data-layout-kind="text"]').nth(1);
  const renderedText = textBoundary.locator(".jump-layout-text");
  const glyphBox = () =>
    renderedText.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = range.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width };
    });

  await textRow
    .getByLabel("text align", { exact: true })
    .selectOption({ label: "Not set" });
  await textRow.getByLabel("align", { exact: true }).selectOption("start");
  const atStart = await textBoundary.boundingBox();
  await attachProductionState(
    testInfo,
    "editor-layout-inline-leaf-align-start-corrected",
    editor,
  );
  await textRow.getByLabel("align", { exact: true }).selectOption("center");
  const atCenter = await textBoundary.boundingBox();
  await textRow.getByLabel("align", { exact: true }).selectOption("end");
  const atEnd = await textBoundary.boundingBox();
  await attachProductionState(
    testInfo,
    "editor-layout-inline-leaf-align-end-corrected",
    editor,
  );
  expect(atStart).not.toBeNull();
  expect(atCenter).not.toBeNull();
  expect(atEnd).not.toBeNull();
  expect(atCenter!.x).toBeGreaterThan(atStart!.x);
  expect(atEnd!.x).toBeGreaterThan(atCenter!.x);

  await textRow.getByLabel("align", { exact: true }).selectOption("center");
  await textRow.getByLabel("text align", { exact: true }).selectOption("start");
  const glyphAtStart = await glyphBox();
  await attachProductionState(
    testInfo,
    "editor-layout-inline-text-align-start-corrected",
    editor,
  );
  await textRow
    .getByLabel("text align", { exact: true })
    .selectOption("center");
  const glyphAtCenter = await glyphBox();
  await textRow.getByLabel("text align", { exact: true }).selectOption("end");
  const glyphAtEnd = await glyphBox();
  await attachProductionState(
    testInfo,
    "editor-layout-inline-text-align-end-corrected",
    editor,
  );
  expect(glyphAtCenter.x).toBeGreaterThan(glyphAtStart.x);
  expect(glyphAtEnd.x).toBeGreaterThan(glyphAtCenter.x);

  const textArea = textBoundary.locator("..");
  const firstTextBoundary = inline.locator('[data-layout-kind="text"]').first();
  const firstTextArea = firstTextBoundary.locator("..");
  await textRow.getByLabel("align", { exact: true }).selectOption("stretch");
  const [singleStretchArea, singleStretchBoundary, intrinsicArea] =
    await Promise.all([
      textArea.boundingBox(),
      textBoundary.boundingBox(),
      firstTextArea.boundingBox(),
    ]);
  expect(singleStretchArea).not.toBeNull();
  expect(singleStretchBoundary).not.toBeNull();
  expect(intrinsicArea).not.toBeNull();
  expect(singleStretchBoundary!.width).toBeCloseTo(singleStretchArea!.width, 0);
  expect(singleStretchArea!.width).toBeGreaterThan(intrinsicArea!.width);
  await attachProductionState(
    testInfo,
    "editor-layout-inline-leaf-align-stretch-corrected",
    editor,
  );

  const firstTextRow = builder
    .locator('[data-layout-node-kind="text"]')
    .first();
  await firstTextRow
    .getByRole("button", { name: "Edit Text presentation fields" })
    .click();
  const firstRenderedText = firstTextBoundary.locator(".jump-layout-text");
  const firstGlyphBox = () =>
    firstRenderedText.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = range.getBoundingClientRect();
      return { x: bounds.x, width: bounds.width };
    });
  await firstTextRow
    .getByLabel("align", { exact: true })
    .selectOption("center");
  await firstTextRow
    .getByLabel("text align", { exact: true })
    .selectOption("start");
  const firstGlyphAtStart = await firstGlyphBox();
  await attachProductionState(
    testInfo,
    "editor-layout-inline-first-text-align-start-corrected",
    editor,
  );
  await firstTextRow
    .getByLabel("text align", { exact: true })
    .selectOption("end");
  const firstGlyphAtEnd = await firstGlyphBox();
  expect(firstGlyphAtEnd.x).toBeGreaterThan(firstGlyphAtStart.x);
  await attachProductionState(
    testInfo,
    "editor-layout-inline-first-text-align-end-corrected",
    editor,
  );
  await firstTextRow
    .getByLabel("align", { exact: true })
    .selectOption("stretch");
  const [firstStretchArea, secondStretchArea] = await Promise.all([
    firstTextArea.boundingBox(),
    textArea.boundingBox(),
  ]);
  expect(firstStretchArea).not.toBeNull();
  expect(secondStretchArea).not.toBeNull();
  expect(firstStretchArea!.width).toBeCloseTo(secondStretchArea!.width, 0);
  await attachProductionState(
    testInfo,
    "editor-layout-inline-two-stretched-leaves-corrected",
    editor,
  );

  await firstTextRow.getByLabel("align", { exact: true }).selectOption("start");
  await textRow
    .getByRole("button", { name: "Edit Text presentation fields" })
    .click();
  await textRow.getByLabel("align", { exact: true }).selectOption("end");
  await textRow
    .getByLabel("text align", { exact: true })
    .selectOption("center");
  const [areaBox, finalBoundary] = await Promise.all([
    textArea.boundingBox(),
    textBoundary.boundingBox(),
  ]);
  expect(areaBox).not.toBeNull();
  expect(finalBoundary).not.toBeNull();
  expect(finalBoundary!.x + finalBoundary!.width).toBeCloseTo(
    areaBox!.x + areaBox!.width,
    0,
  );
  expect(
    await textArea.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).marginLeft),
    ),
  ).toBeGreaterThan(0);
  await expect(renderedText).toHaveCSS("text-align", "center");
  await attachProductionState(
    testInfo,
    "editor-layout-inline-text-alignment-corrected",
    editor,
  );
});

test("Inline Image alignment separates leaf growth from authored image size and honors preview placeholder limits", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 2048, height: 1080 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section layout" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("layout.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`section-layout
  handle: inline_image_stretch

  stack
    gap: md

    inline
      gap: md
      text: welcome
      text: blah

    text: asdf

    inline
      gap: md
      text: asdf2
      text: asdf3
      slot: name
      image: pic
`);
  await editor.getByRole("button", { name: "inline_image_stretch" }).click();
  await editor.getByRole("tab", { name: "Structured" }).click();

  const builder = editor.locator(".editor-layout-builder");
  await builder
    .getByLabel("Editing container")
    .selectOption({ label: "stack[1]/inline[3]" });
  const imageRow = builder.locator('[data-layout-node-kind="image"]');
  await imageRow
    .getByRole("button", { name: "Edit Image presentation fields" })
    .click();
  const align = imageRow.getByLabel("align", { exact: true });
  const preview = editor.locator(".editor-real-preview");
  const imageBoundary = preview.locator('[data-layout-kind="image"]');
  const imageArea = imageBoundary.locator("..");
  const image = imageBoundary.locator("img");

  await editor.getByLabel("Show bounds").check();
  await align.scrollIntoViewIfNeeded();
  await align.selectOption("");
  await expect(imageArea).toHaveCSS("flex", "0 1 auto");
  await expect(preview).toContainText("Example content for “asdf2”.");
  await attachProductionState(
    testInfo,
    "editor-layout-inline-image-full-placeholder-production",
    editor,
  );

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Editor" }).click();
  const placeholderLimit = page.getByLabel("Layout preview placeholder length");
  await expect(placeholderLimit).toHaveValue("");
  await expect(placeholderLimit).toHaveAttribute("placeholder", "Unlimited");
  await expect(
    page.getByTitle("Increase Layout preview placeholder length"),
  ).toBeVisible();
  await expect(
    page.getByTitle("Decrease Layout preview placeholder length"),
  ).toBeVisible();
  const saving = page.getByLabel("Saving");
  const [placeholderColors, savingColors] = await Promise.all([
    placeholderLimit.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderColor,
        color: style.color,
      };
    }),
    saving.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderColor,
        color: style.color,
      };
    }),
  ]);
  expect(placeholderColors).toEqual(savingColors);
  await placeholderLimit.fill("8");
  await attachProductionState(
    testInfo,
    "settings-editor-layout-preview-placeholder-limit-corrected",
    page.getByLabel("Application Settings", { exact: true }),
  );
  await page.getByRole("tab", { name: "Developer" }).click();
  await page.getByLabel("Use custom package limits").click();
  await page
    .getByRole("alertdialog", {
      name: "Increase package limits at your own risk",
    })
    .getByRole("button", { name: "I understand, enable" })
    .click();
  const packageLimits = page.getByRole("spinbutton", { name: / limit$/ });
  await expect(packageLimits).toHaveCount(4);
  for (const label of [
    "Archive",
    "Definition file",
    "Asset file",
    "Expanded package",
  ]) {
    await expect(page.getByTitle(`Increase ${label} limit`)).toBeVisible();
    await expect(page.getByTitle(`Decrease ${label} limit`)).toBeVisible();
  }
  const archiveLimit = page.getByRole("spinbutton", {
    name: "Archive limit",
  });
  await archiveLimit.scrollIntoViewIfNeeded();
  const archiveColors = await archiveLimit.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderColor,
      color: style.color,
    };
  });
  expect(archiveColors).toEqual(savingColors);
  await attachProductionState(
    testInfo,
    "settings-developer-package-limit-steppers-corrected",
    page.locator(".developer-package-limits"),
  );
  await page.getByRole("button", { name: "Close Settings" }).click();

  const textLeaves = preview.locator('[data-layout-kind="text"]');
  await expect(textLeaves).toHaveCount(5);
  for (const textLeaf of await textLeaves.all())
    await expect(textLeaf).toHaveText("Example ");
  await expect(preview.locator('[data-layout-kind="slot"]')).toHaveText(
    "Example ",
  );

  await align.selectOption("start");
  const imageAtStart = await imageBoundary.boundingBox();
  await align.selectOption("center");
  const imageAtCenter = await imageBoundary.boundingBox();
  await align.selectOption("end");
  const imageAtEnd = await imageBoundary.boundingBox();
  expect(imageAtStart).not.toBeNull();
  expect(imageAtCenter).not.toBeNull();
  expect(imageAtEnd).not.toBeNull();
  expect(imageAtCenter!.x).toBeGreaterThan(imageAtStart!.x);
  expect(imageAtEnd!.x).toBeGreaterThan(imageAtCenter!.x);

  await align.selectOption("stretch");
  await expect(imageArea).toHaveCSS("flex", "1 1 0px");
  const [stretchedArea, stretchedBoundary, stretchedImage] = await Promise.all([
    imageArea.boundingBox(),
    imageBoundary.boundingBox(),
    image.boundingBox(),
  ]);
  expect(stretchedArea).not.toBeNull();
  expect(stretchedBoundary).not.toBeNull();
  expect(stretchedImage).not.toBeNull();
  expect(stretchedArea!.width).toBeGreaterThan(imageAtStart!.width);
  expect(stretchedBoundary!.width).toBeCloseTo(stretchedArea!.width, 0);
  expect(stretchedImage!.width).toBeCloseTo(stretchedArea!.width, 0);
  await attachProductionState(
    testInfo,
    "editor-layout-inline-image-unsized-stretch-corrected",
    editor,
  );

  await align.selectOption("start");
  await imageRow.getByLabel("size", { exact: true }).fill("200px");
  const [authoredArea, authoredBoundary, authoredImage] = await Promise.all([
    imageArea.boundingBox(),
    imageBoundary.boundingBox(),
    image.boundingBox(),
  ]);
  expect(authoredArea).not.toBeNull();
  expect(authoredBoundary).not.toBeNull();
  expect(authoredImage).not.toBeNull();
  await align.selectOption("stretch");
  await expect(imageArea).toHaveCSS("flex", "1 1 auto");
  const [
    stretchedAuthoredArea,
    stretchedAuthoredBoundary,
    stretchedAuthoredImage,
  ] = await Promise.all([
    imageArea.boundingBox(),
    imageBoundary.boundingBox(),
    image.boundingBox(),
  ]);
  expect(stretchedAuthoredArea).not.toBeNull();
  expect(stretchedAuthoredBoundary).not.toBeNull();
  expect(stretchedAuthoredImage).not.toBeNull();
  expect(stretchedAuthoredArea!.width).toBeGreaterThan(
    stretchedAuthoredBoundary!.width,
  );
  expect(stretchedAuthoredBoundary!.width).toBeCloseTo(
    authoredBoundary!.width,
    0,
  );
  expect(stretchedAuthoredBoundary!.height).toBeCloseTo(
    authoredBoundary!.height,
    0,
  );
  expect(stretchedAuthoredImage!.width).toBeCloseTo(authoredImage!.width, 0);
  expect(stretchedAuthoredImage!.height).toBeCloseTo(authoredImage!.height, 0);
  expect(authoredArea!.width).toBeCloseTo(authoredBoundary!.width, 0);
  expect(authoredImage!.width).toBeCloseTo(200, 0);
  expect(authoredImage!.height).toBeCloseTo(200, 0);
  await expect(imageBoundary).toHaveCSS("flex", "0 1 auto");
  await attachProductionState(
    testInfo,
    "editor-layout-inline-image-sized-leaf-stretch-corrected",
    editor,
  );
});

test("Editor retains mock proportions at desktop, two-pane, and single-column viewports", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["two-pane", { width: 900, height: 800 }],
    ["single-column", { width: 600, height: 760 }],
  ] as const) {
    await page.setViewportSize(viewport);
    const editor = await openCreatedEditor(page);
    const bounds = await editor.boundingBox();
    expect(bounds).not.toBeNull();
    if (name === "desktop") {
      expect(bounds!.x).toBeLessThanOrEqual(1);
      expect(Math.abs(bounds!.width - viewport.width)).toBeLessThanOrEqual(2);
      await expect(
        editor.getByRole("button", { name: "← Editor", exact: true }),
      ).toHaveCount(0);
    }
    const { reference, mock } = await openReference(
      page,
      Math.round(bounds!.width),
      Math.round(bounds!.height),
    );
    await attachComparison(testInfo, `editor-responsive-${name}`, mock, editor);
    await reference.close();
    await page.evaluate(() => indexedDB.deleteDatabase("jumpchain-visualizer"));
  }
});

test(
  "all six workspace tabs and source keyboard functions are operable",
  { tag: "@cross-browser" },
  async ({ page }) => {
    const editor = await openCreatedEditor(page);
    for (const tab of [
      "Content",
      "Files",
      "Structured",
      "Source",
      "Preview",
      "Properties",
    ])
      await expect(editor.getByRole("tab", { name: tab })).toBeVisible();

    const description = editor.getByLabel("description", { exact: true });
    await expect(description).toHaveValue("An untitled Jump.");
    await description.fill("A library-ready premise authored at Jump level.");
    await expect(editor.locator(".editor-save-state")).toHaveText("Unsaved");
    await expect(editor.locator(".editor-save-state")).toHaveText("Saved", {
      timeout: 2_000,
    });
    await expect(editor.locator(".editor-real-preview")).toContainText(
      "A library-ready premise authored at Jump level.",
    );

    await editor.getByRole("tab", { name: "Files" }).click();
    await editor.getByRole("button", { name: "jump.jdef" }).click();
    const source = editor.getByLabel("jump.jdef source");
    await expect(source).toContainText(
      'description: "A library-ready premise authored at Jump level."',
    );
    const [authoringBox, stageBox, statusBox] = await Promise.all([
      editor.locator(".editor-authoring-pane").boundingBox(),
      editor.locator(".editor-code-stage").boundingBox(),
      editor.locator(".editor-source-status").boundingBox(),
    ]);
    expect(authoringBox).not.toBeNull();
    expect(stageBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(statusBox!.height).toBeLessThan(40);
    expect(stageBox!.height).toBeGreaterThan(authoringBox!.height * 0.75);
    expect(
      Math.abs(stageBox!.y + stageBox!.height - statusBox!.y),
    ).toBeLessThan(2);
    await source.press(process.platform === "darwin" ? "Meta+f" : "Control+f");
    await expect(editor.getByPlaceholder("Replace")).toHaveCount(0);
    await editor.getByRole("checkbox", { name: "Replace" }).check();
    await expect(
      editor.getByRole("button", { name: "Replace all" }),
    ).toBeVisible();
    await source.press("Escape");
    await source.press(
      process.platform === "darwin" ? "Meta+Enter" : "Control+Enter",
    );
    await expect(
      editor.getByRole("complementary", { name: "Quick add" }),
    ).toBeVisible();
    await editor.getByLabel("Close Quick Add").click();
    await source.press(
      process.platform === "darwin" ? "Meta+Space" : "Control+Space",
    );
    await expect(
      editor.getByRole("listbox", { name: "All completions" }),
    ).toBeVisible();
    await editor.getByLabel("Close completions").click();
    await editor.getByRole("tab", { name: "Preview" }).click();
    await editor.getByRole("tab", { name: "Properties" }).click();
    await expect(
      editor.getByText(
        "Properties describe the current selection and are read-only.",
      ),
    ).toBeVisible();
    await expect(
      editor.getByText("Definition file", { exact: true }),
    ).toBeVisible();
    await expect(editor.getByText("Authors", { exact: true })).toHaveCount(0);
  },
);

test("Files exposes only Source while Content retains Structured and Source", async ({
  page,
}, testInfo) => {
  const editor = await openCreatedEditor(page);
  const editingViews = editor.getByRole("tablist", { name: "Editing view" });

  await editor.getByRole("tab", { name: "Files" }).click();
  await editor.getByRole("button", { name: "jump.jdef" }).click();
  await expect(
    editingViews.getByRole("tab", { name: "Structured" }),
  ).toHaveCount(0);
  await expect(
    editingViews.getByRole("tab", { name: "Source" }),
  ).toHaveAttribute("aria-selected", "true");
  await attachProductionState(
    testInfo,
    "editor-files-source-only-production",
    editor,
  );

  await editor.getByRole("tab", { name: "Content" }).click();
  await expect(
    editingViews.getByRole("tab", { name: "Structured" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(editingViews.getByRole("tab", { name: "Source" })).toBeVisible();

  await editingViews.getByRole("tab", { name: "Source" }).click();
  await editor.getByRole("tab", { name: "Files" }).click();
  await editor.getByRole("tab", { name: "Content" }).click();
  await expect(
    editingViews.getByRole("tab", { name: "Source" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    editingViews.getByRole("tab", { name: "Structured" }),
  ).toBeVisible();
});

test("the Editor Add menu closes when clicking outside it", async ({
  page,
}) => {
  const editor = await openCreatedEditor(page);
  const add = editor.getByRole("button", { name: "Add", exact: true });

  await add.click();
  await expect(add).toHaveAttribute("aria-expanded", "true");
  await expect(
    editor.getByRole("button", { name: "Resource", exact: true }),
  ).toBeVisible();

  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(add).toHaveAttribute("aria-expanded", "false");
  await expect(
    editor.getByRole("button", { name: "Resource", exact: true }),
  ).toHaveCount(0);

  await add.click();
  await editor.getByRole("button", { name: "Resource", exact: true }).click();
  await expect(
    editor.getByRole("heading", { name: "New Resource" }),
  ).toBeVisible();
});

test("Structured controls and Source palette shortcuts use consistent precise controls", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const editor = await openCreatedEditor(page);

  const format = editor.getByRole("spinbutton", { name: "format" });
  await expect(format).not.toHaveAttribute("readonly");
  await format.fill("");
  await format.fill("1");
  await expect(format).toHaveValue("1");

  const startingPoints = editor.locator(
    '.editor-schema-field:has(input[aria-label="starting-points"])',
  );
  expect(
    await startingPoints
      .locator(".number-stepper-buttons path")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
  ).toEqual(["M2 6 6 2l4 4", "m2 2 4 4 4-4"]);
  const points = startingPoints.getByRole("spinbutton");
  await expect(points).toHaveValue("1000");
  await startingPoints.getByRole("button", { name: "Increase" }).click();
  await expect(points).toHaveValue("1001");

  const gauntletField = editor.locator(
    '.editor-schema-field:has(input[aria-label="gauntlet"])',
  );
  const gauntlet = gauntletField.getByRole("checkbox");
  await expect(gauntlet).not.toBeChecked();
  await gauntletField
    .locator(".editor-field-occurrence > span")
    .first()
    .click();
  await expect(gauntlet).not.toBeChecked();
  await gauntlet.click();
  await expect(gauntlet).toBeChecked();
  await attachProductionState(
    testInfo,
    "editor-structured-controls-production",
    editor,
  );

  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(
    'jump\n  description: "A deliberately incomplete package."\n',
  );
  const quickAddShortcut =
    process.platform === "darwin" ? "Meta+Enter" : "Control+Enter";
  await source.press(quickAddShortcut);
  const palette = editor.getByRole("complementary", { name: "Quick add" });
  await expect(palette).toBeVisible();
  const pointsName = palette.getByRole("button", { name: /points-name/i });
  await expect(pointsName.locator(".editor-quick-add-mnemonic")).toHaveText(
    /p/i,
  );
  await expect(pointsName.locator("kbd")).toHaveText("⌘ P");
  await pointsName.scrollIntoViewIfNeeded();
  await attachProductionState(
    testInfo,
    "editor-source-quick-add-shortcuts-production",
    editor,
  );
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+p" : "Control+p",
  );
  await expect(palette).toHaveCount(0);
  await expect(source).toContainText('points-name: ""');
  await page.keyboard.insertText("Choice Points");
  await expect(source).toContainText('points-name: "Choice Points"');

  await source.press(quickAddShortcut);
  await expect(palette).toBeVisible();
  await expect(
    palette
      .getByRole("button", { name: /author/i })
      .locator(".editor-quick-add-mnemonic"),
  ).toHaveText(/a/i);
  await expect(
    palette.getByRole("button", { name: /author/i }).locator("kbd"),
  ).toHaveText("⌘ A");
  await source.press(quickAddShortcut);
  await expect(palette).toHaveCount(0);
  await source.press(quickAddShortcut);
  await expect(palette).toBeVisible();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+a" : "Control+a",
  );
  await expect(palette).toHaveCount(0);
  await expect(source).toContainText('author: ""');
  await page.keyboard.insertText("Test Author");
  await expect(source).toContainText('author: "Test Author"');

  const completionShortcut =
    process.platform === "darwin" ? "Meta+Space" : "Control+Space";
  await source.press(quickAddShortcut);
  await palette.getByRole("button", { name: /All completions/i }).click();
  await expect(palette).toBeVisible();
  await expect(
    editor.getByRole("listbox", { name: "All completions" }),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-source-completions-over-quick-add-production",
    editor,
  );
  await source.press(completionShortcut);
  await expect(
    editor.getByRole("listbox", { name: "All completions" }),
  ).toHaveCount(0);
  await expect(palette).toBeVisible();
  await source.press(quickAddShortcut);
  await expect(palette).toHaveCount(0);

  const sourceToolbar = editor.locator(".editor-source-toolbar");
  for (const [label, shortcut] of [
    ["Find", /⌘ F/],
    ["Quick Add", /⌘ Enter/],
    ["Format", /⌘ Shift F/],
    ["Quick Fix", /⌘ \./],
  ] as const)
    await expect(
      sourceToolbar.getByRole("button", { name: label }).locator("kbd"),
    ).toHaveText(shortcut);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Key bindings" }).click();
  await attachProductionState(
    testInfo,
    "settings-editor-keybindings-production",
    page.getByLabel("Application Settings", { exact: true }),
  );
  const completionBinding = page
    .locator(".keybinding-row")
    .filter({ hasText: "All Completions" });
  await completionBinding.getByRole("button", { name: "Change" }).click();
  await completionBinding
    .getByRole("button", { name: "Cancel" })
    .press("Control+Shift+9");
  await expect(completionBinding.locator("kbd")).toHaveText("⌘ Shift 9");
  await page.getByRole("button", { name: "Close Settings" }).click();
  await expect(
    page.getByLabel("Application Settings", { exact: true }),
  ).toHaveCount(0);
  const reboundCompletion =
    process.platform === "darwin" ? "Meta+Shift+9" : "Control+Shift+9";
  await expect(source).toBeVisible();
  await source.click();
  await source.press(quickAddShortcut);
  await expect(palette).toBeVisible();
  await expect(
    palette.getByRole("button", { name: /All completions/i }).locator("kbd"),
  ).toHaveText("⌘ Shift 9");
  await source.press(quickAddShortcut);
  await source.press(reboundCompletion);
  await expect(
    editor.getByRole("listbox", { name: "All completions" }),
  ).toBeVisible();
  await source.press(reboundCompletion);
  await expect(
    editor.getByRole("listbox", { name: "All completions" }),
  ).toHaveCount(0);

  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`jump
  format: 1
  name: "Cursor Test"
  author: "Test Author"
  version: "1.0"

section
  handle: introduction
  name: "Introduction"
`);
  await source.press(process.platform === "darwin" ? "Meta+f" : "Control+f");
  await editor.getByPlaceholder("Find").fill("section");
  await editor.getByPlaceholder("Find").press("Escape");
  await source.press(quickAddShortcut);
  await palette.getByRole("button", { name: /^text/i }).click();
  await expect(source).toContainText("handle: new_text");
  await page.keyboard.insertText("intro_text");
  await expect(source).toContainText("handle: intro_text");
  await expect(source).not.toContainText("new_textintro_text");
});

test("Structured fields show localized omission defaults from first render and after boolean toggles", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const editor = await openCreatedEditor(page);
  const fieldsCard = editor
    .locator(".editor-form-card")
    .filter({ hasText: "Fields and behavior" });
  const gauntletField = editor.locator(
    '.editor-schema-field:has(input[aria-label="gauntlet"])',
  );
  const gauntlet = gauntletField.getByRole("checkbox");
  const gauntletDefault = gauntletField.getByText("Default: false", {
    exact: true,
  });

  await expect(gauntlet).not.toBeChecked();
  await expect(gauntletDefault).toBeVisible();
  await expect(
    editor.getByLabel("section-layout", { exact: true }),
  ).toHaveAttribute("placeholder", "Default: built-in section layout");
  await expect(
    editor.getByLabel("choice-layout", { exact: true }),
  ).toHaveAttribute("placeholder", "Default: built-in choice layout");
  await expect(
    editor.getByLabel("trait-layout", { exact: true }),
  ).toHaveAttribute("placeholder", "Default: built-in trait layout");
  await attachProductionState(
    testInfo,
    "editor-default-shadowtext-initial-production",
    fieldsCard,
  );

  await gauntlet.check();
  await expect(gauntletDefault).toHaveCount(0);
  await gauntlet.uncheck();
  await expect(gauntletDefault).toBeVisible();
  await editor.getByRole("tab", { name: "Source" }).click();
  await expect(editor.getByLabel("jump.jdef source")).not.toContainText(
    "gauntlet:",
  );
  await editor.getByRole("tab", { name: "Structured" }).click();
  await attachProductionState(
    testInfo,
    "editor-default-shadowtext-boolean-restored-production",
    fieldsCard,
  );

  const format = editor.getByLabel("format", { exact: true });
  const startingPoints = editor.getByLabel("starting-points", { exact: true });
  await format.fill("");
  await startingPoints.fill("");
  await editor.getByLabel("points-name", { exact: true }).fill("");
  await editor.getByLabel("points-abbreviation", { exact: true }).fill("");
  await expect(format).not.toHaveAttribute("placeholder");
  await expect(startingPoints).toHaveAttribute("placeholder", "Default: 1000");
  await expect(
    editor.getByLabel("points-name", { exact: true }),
  ).toHaveAttribute("placeholder", "Default: Choice Points");
  await expect(
    editor.getByLabel("points-abbreviation", { exact: true }),
  ).toHaveAttribute("placeholder", "Default: CP");
  await expect(editor.locator(".editor-diagnostics-summary")).toContainText(
    "Only Format 1 packages are supported.",
  );
  await gauntlet.check();
  await expect(startingPoints).toHaveAttribute("placeholder", "Default: 0");
  await gauntlet.uncheck();
  await expect(startingPoints).toHaveAttribute("placeholder", "Default: 1000");
  await attachProductionState(
    testInfo,
    "editor-default-shadowtext-jump-fields-production",
    fieldsCard,
  );

  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await expect(editor.getByLabel("layout", { exact: true })).toHaveAttribute(
    "placeholder",
    "Default: built-in section layout",
  );

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Choice", exact: true }).click();
  const choiceLayout = editor.getByLabel("layout", { exact: true });
  const selection = editor.getByLabel("selection", { exact: true });
  await expect(selection).toHaveValue("toggle");
  await expect(editor.getByLabel("resolution", { exact: true })).toHaveCount(0);
  await expect(selection.locator("option:checked")).toHaveText("toggle");
  await expect(selection.getByRole("option", { name: /Default:/ })).toHaveCount(
    0,
  );
  await selection.selectOption("integer");
  const resolution = editor.getByLabel("resolution", { exact: true });
  await expect(resolution).toHaveValue("manual");
  await expect(resolution.locator("option:checked")).toHaveText("manual");
  await expect(
    resolution.getByRole("option", { name: /Default:/ }),
  ).toHaveCount(0);
  await resolution.selectOption("random");
  await resolution.selectOption("manual");
  await editor.getByRole("tab", { name: "Source" }).click();
  await expect(editor.getByLabel("choices.jdef source")).not.toContainText(
    "resolution:",
  );
  await editor.getByRole("tab", { name: "Structured" }).click();
  await expect(choiceLayout).toHaveAttribute(
    "placeholder",
    "Default: built-in choice layout",
  );
  await expect(resolution.locator("option:checked")).toHaveText("manual");
  await attachProductionState(
    testInfo,
    "editor-default-shadowtext-choice-fields-production",
    editor
      .locator(".editor-form-card")
      .filter({ hasText: "Fields and behavior" }),
  );

  await selection.selectOption("integer");
  await editor.getByRole("button", { name: "+ Grant", exact: true }).click();
  const contentSearch = editor.getByPlaceholder("Search content");
  await contentSearch.fill("New grant");
  await editor
    .locator(".editor-outline-scroll")
    .getByRole("button", { name: "grant grant", exact: true })
    .click();
  await editor.getByLabel("kind", { exact: true }).selectOption("trait");
  await expect(editor.getByLabel("layout", { exact: true })).toHaveAttribute(
    "placeholder",
    "Default: built-in trait layout",
  );
  await expect(
    editor.getByLabel("measure", { exact: true }).locator("option:checked"),
  ).toHaveText("rank");
  await attachProductionState(
    testInfo,
    "editor-default-shadowtext-trait-grant-fields-production",
    editor
      .locator(".editor-form-card")
      .filter({ hasText: "Fields and behavior" }),
  );

  await contentSearch.fill("New Choice");
  await editor
    .locator(".editor-outline-scroll")
    .getByRole("button", { name: "new_choice", exact: true })
    .click();
  await editor.getByRole("button", { name: "+ Input", exact: true }).click();
  await contentSearch.fill("new_input");
  await editor
    .locator(".editor-outline-scroll")
    .getByRole("button", { name: "new_input input", exact: true })
    .click();
  await editor
    .getByLabel("selection", { exact: true })
    .selectOption("companions");
  await expect(editor.getByLabel("min", { exact: true })).toHaveAttribute(
    "placeholder",
    "Default: 0",
  );
  await attachProductionState(
    testInfo,
    "editor-default-shadowtext-companion-input-fields-production",
    editor
      .locator(".editor-form-card")
      .filter({ hasText: "Fields and behavior" }),
  );
});

test("Structured section references and handles show live localized diagnostics", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const editor = await openCreatedEditor(page);
  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();

  const layout = editor.getByLabel("layout", { exact: true });
  const layoutField = editor.locator(
    '.editor-schema-field:has(input[aria-label="layout"])',
  );
  await layout.fill("missing_layout");
  await expect(layout).toHaveAttribute("aria-invalid", "true");
  await expect(layout).toHaveAttribute("aria-describedby", /diagnostics$/);
  await expect(layoutField.locator(".editor-field-diagnostics")).toContainText(
    "layout reference “missing_layout” does not resolve to a section-layout declaration.",
  );
  await expect(layoutField.locator(".editor-field-occurrence")).toHaveClass(
    /is-warning/,
  );
  await expect(editor.locator(".editor-diagnostics-summary")).toContainText(
    "missing_layout",
  );
  await attachProductionState(
    testInfo,
    "editor-section-unresolved-layout-inline-warning-production",
    editor,
  );

  await layout.fill("Not A Handle!");
  await expect(layoutField.locator(".editor-field-diagnostics")).toContainText(
    "is not a legal handle reference",
  );
  await expect(layoutField.locator(".editor-field-occurrence")).toHaveClass(
    /is-error/,
  );
  const handle = editor.getByLabel("handle", { exact: true });
  await handle.fill("Not A Handle!");
  const handleField = editor.locator(
    '.editor-schema-field:has(input[aria-label="handle"])',
  );
  await expect(handleField.locator(".editor-field-diagnostics")).toContainText(
    "is not a legal handle",
  );
  await attachProductionState(
    testInfo,
    "editor-section-illegal-handles-inline-errors-production",
    editor,
  );

  await editor
    .getByRole("button", { name: "Diagnostics", exact: true })
    .click();
  await editor
    .locator(".editor-diagnostics-details button")
    .filter({ hasText: "is not a legal handle reference" })
    .click();
  await expect(editor.getByRole("tab", { name: "Source" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(editor.locator(".cm-selectionBackground")).toHaveCount(1);
  await expect(editor.locator(".cm-lintRange-error")).toHaveCount(2);
  await attachProductionState(
    testInfo,
    "editor-section-illegal-handles-source-markers-production",
    editor.locator(".editor-authoring-pane"),
  );

  await editor.getByRole("tab", { name: "Content" }).click();
  await editor
    .getByRole("button", { name: "Not A Handle!", exact: true })
    .click();
  await editor.getByRole("tab", { name: "Structured" }).click();
  await handle.fill("introduction");
  await layout.fill("missing_layout");
  await editor.getByRole("button", { name: "Export .jmp" }).click();
  await page.getByRole("button", { name: "Export Package" }).click();
  await expect(page.locator(".editor-export-error")).toContainText(
    "The package is malformed",
  );
  await expect(page.locator(".editor-export-error")).toContainText(
    "missing_layout",
  );
  await attachProductionState(
    testInfo,
    "editor-unresolved-layout-distribution-error-production",
    page.getByRole("alertdialog"),
  );
});

test("Structured choice-source groups distinguish missing, unmatched, and illegal handles", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const editor = await openCreatedEditor(page);
  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "+ Choice source", exact: true })
    .click();
  await editor.getByPlaceholder("Search content").fill("new_source");
  await editor
    .getByRole("button", { name: "new_source choice-source", exact: true })
    .click();

  const group = editor.getByLabel("group", { exact: true });
  const groupField = editor.locator(
    '.editor-schema-field:has(input[aria-label="group"])',
  );
  await expect(groupField.locator(".editor-field-diagnostics")).toContainText(
    "has no group and cannot match choices",
  );

  await group.fill("missing_group");
  await expect(groupField.locator(".editor-field-diagnostics")).toContainText(
    "matches no choices in group “missing_group”",
  );
  await expect(groupField.locator(".editor-field-occurrence")).toHaveClass(
    /is-warning/,
  );

  await group.fill("Not A Handle!");
  await expect(groupField.locator(".editor-field-diagnostics")).toContainText(
    "is not a legal handle",
  );
  await expect(
    groupField.locator(".editor-field-diagnostics"),
  ).not.toContainText("matches no choices");
  const handle = editor.getByLabel("handle", { exact: true });
  await handle.fill("Not A Handle!");
  await expect(handle).toHaveAttribute("aria-invalid", "true");
  await attachProductionState(
    testInfo,
    "editor-choice-source-missing-unmatched-illegal-diagnostics-production",
    editor,
  );
});

test("Quick Add offers and focuses an existing empty required field", async ({
  page,
}, testInfo) => {
  const editor = await openCreatedEditor(page);
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`jump
  format: 1
  name: "Required Field Test"
  author: "Author"
  version: ""

section
  handle: introduction
  name: "Introduction"
`);
  await source.press(
    process.platform === "darwin" ? "Meta+Home" : "Control+Home",
  );
  await source.press("ArrowDown");
  await editor.getByRole("button", { name: "Quick Add" }).click();
  const palette = editor.getByRole("complementary", { name: "Quick add" });
  const version = palette.getByRole("button", { name: /version/i });
  await expect(version).toBeVisible();
  await expect(version).toContainText("Complete existing field");
  await attachProductionState(
    testInfo,
    "editor-source-empty-required-quick-add-production",
    editor,
  );
  await version.click();
  await page.keyboard.insertText("1.0");
  await expect(source).toContainText('version: "1.0"');
  expect((await source.textContent())?.match(/version:/g)).toHaveLength(1);
  await expect(editor.locator(".cm-lintRange-error")).toHaveCount(0);
  await editor.getByRole("button", { name: "Quick Add" }).click();
  await expect(
    editor
      .getByRole("complementary", { name: "Quick add" })
      .getByRole("button", { name: /version/i }),
  ).toHaveCount(0);
});

test("Structured field edits never consume adjacent fields", async ({
  page,
}) => {
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "introduction" }).click();
  const layout = editor.getByLabel("layout", { exact: true });

  await layout.pressSequentially("nonsense_layout");
  await layout.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await layout.press("Backspace");

  await expect(layout).toHaveValue("");
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel(/source$/);
  await expect(source).toContainText("handle: introduction");
  expect(await source.innerText()).not.toMatch(/layout:\s*handle:/);
});

test("Source search, replacement, folding, feedback, and grouped undo are operable", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");

  await source.press(process.platform === "darwin" ? "Meta+f" : "Control+f");
  const find = editor.getByPlaceholder("Find");
  const findBar = editor.locator(".editor-find-bar");
  const findShell = editor.locator(".editor-find-field-shell");
  const replaceToggle = editor.getByRole("checkbox", { name: "Replace" });
  await expect(editor.getByLabel("Close find")).toHaveCount(0);
  await expect(replaceToggle).not.toBeChecked();
  await expect(editor.getByPlaceholder("Replace")).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Replace all" })).toHaveCount(
    0,
  );
  expect(
    await findShell.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
    ),
  ).toBeGreaterThan(0);
  await expect(find).toHaveAttribute("placeholder", "Find");
  await expect(
    findShell.getByRole("button", { name: "Match case" }),
  ).toBeVisible();
  await find.fill("Untitled");
  await expect(editor.locator(".cm-searchMatch")).toHaveCount(2);
  await expect(editor.locator(".editor-find-count")).toHaveText("1 of 2");
  const [findBox, previousBox, nextBox, countBox, replaceToggleBox] =
    await Promise.all([
      findShell.boundingBox(),
      editor.getByRole("button", { name: "Previous match" }).boundingBox(),
      editor.getByRole("button", { name: "Next match" }).boundingBox(),
      editor.locator(".editor-find-count").boundingBox(),
      editor.locator(".editor-replace-toggle").boundingBox(),
    ]);
  for (const box of [findBox, previousBox, nextBox, countBox, replaceToggleBox])
    expect(box).not.toBeNull();
  expect(previousBox!.x).toBeGreaterThan(findBox!.x + findBox!.width - 1);
  expect(nextBox!.x).toBeGreaterThan(previousBox!.x + previousBox!.width - 1);
  expect(countBox!.x).toBeGreaterThan(nextBox!.x + nextBox!.width - 1);
  expect(replaceToggleBox!.x).toBeGreaterThan(
    countBox!.x + countBox!.width - 1,
  );
  const matchCase = editor.getByLabel("Match case");
  const disabledModeColor = await matchCase.evaluate(
    (element) => getComputedStyle(element).color,
  );
  await matchCase.click();
  await expect(matchCase).toHaveAttribute("aria-pressed", "true");
  expect(
    await matchCase.evaluate((element) => getComputedStyle(element).color),
  ).not.toBe(disabledModeColor);
  await matchCase.click();
  await editor.getByLabel("Match whole word").click();
  await editor.getByRole("button", { name: "Next match" }).click();
  await expect(editor.locator(".editor-find-count")).toHaveText("2 of 2");
  await editor.getByRole("button", { name: "Previous match" }).click();
  await expect(editor.locator(".editor-find-count")).toHaveText("1 of 2");
  await find.press("ArrowDown");
  await expect(editor.locator(".editor-find-count")).toHaveText("2 of 2");
  await find.press("ArrowUp");
  await expect(editor.locator(".editor-find-count")).toHaveText("1 of 2");
  await attachProductionState(
    testInfo,
    "editor-source-modern-find-collapsed-production",
    findBar,
  );
  await editor.getByLabel("Use regular expression").click();
  await find.fill("[");
  await expect(find).toHaveAttribute("aria-invalid", "true");
  const collapsedBox = await findBar.boundingBox();
  await replaceToggle.check();
  const replaceInput = editor.getByPlaceholder("Replace");
  await expect(replaceInput).toHaveAttribute("placeholder", "Replace");
  await expect(
    editor.getByRole("button", { name: "Replace all" }),
  ).toBeDisabled();
  const expandedBox = await findBar.boundingBox();
  expect(collapsedBox).not.toBeNull();
  expect(expandedBox).not.toBeNull();
  expect(expandedBox!.height).toBeGreaterThan(collapsedBox!.height);

  await editor.getByLabel("Use regular expression").click();
  await find.fill("Untitled");
  await replaceInput.fill("Renamed");
  await replaceInput.press("ArrowDown");
  await expect(editor.locator(".editor-find-count")).toHaveText("2 of 2");
  await replaceInput.press("ArrowUp");
  await expect(editor.locator(".editor-find-count")).toHaveText("1 of 2");
  const [replaceInputBox, replaceButtonBox, replaceAllButtonBox] =
    await Promise.all([
      replaceInput.boundingBox(),
      editor
        .getByRole("button", { name: "Replace", exact: true })
        .boundingBox(),
      editor.getByRole("button", { name: "Replace all" }).boundingBox(),
    ]);
  expect(replaceInputBox).not.toBeNull();
  expect(replaceButtonBox).not.toBeNull();
  expect(replaceAllButtonBox).not.toBeNull();
  expect(replaceButtonBox!.x).toBeGreaterThan(
    replaceInputBox!.x + replaceInputBox!.width - 1,
  );
  expect(replaceAllButtonBox!.x).toBeGreaterThan(
    replaceButtonBox!.x + replaceButtonBox!.width - 1,
  );
  expect(
    Math.abs(
      replaceButtonBox!.y +
        replaceButtonBox!.height / 2 -
        (replaceInputBox!.y + replaceInputBox!.height / 2),
    ),
  ).toBeLessThan(2);
  await attachProductionState(
    testInfo,
    "editor-source-modern-find-expanded-production",
    findBar,
  );
  await replaceInput.press("Enter");
  await expect(source).toContainText("Renamed Jump");
  await expect(editor.locator(".cm-searchMatch")).toHaveCount(1);
  await source.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(editor.locator(".cm-searchMatch")).toHaveCount(2);

  await replaceInput.press("ArrowUp");
  await editor.getByRole("button", { name: "Replace", exact: true }).click();
  await expect(source).toContainText("Renamed Jump");
  await source.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(source).toContainText("Untitled Jump");

  await find.press("Escape");
  await source.press(
    process.platform === "darwin" ? "Meta+End" : "Control+End",
  );
  await source.press("Enter");
  await source.pressSequentially("# grouped typing burst");
  await expect(source).toContainText("grouped typing burst");
  await source.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(source).not.toContainText("grouped typing burst");
  const firstFold = editor
    .locator(".cm-foldGutter .cm-gutterElement")
    .filter({
      hasText: "▾",
    })
    .first();
  await firstFold.click();
  await expect(editor.locator(".cm-foldPlaceholder")).toBeHidden();
  await expect(
    editor
      .locator(".cm-foldGutter .cm-gutterElement")
      .filter({ hasText: "▸" })
      .last(),
  ).toBeVisible();

  await source.press(
    process.platform === "darwin" ? "Meta+Shift+f" : "Control+Shift+f",
  );
  await editor.getByRole("button", { name: "Format", exact: true }).click();
  await expect(page.getByText("Nothing to format").last()).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Quick Fix", exact: true }),
  ).toBeDisabled();
});

test("Source diagnostics, folds, and multiline selections remain precise in dark mode", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(
    'jump\n  description: "A deliberately incomplete package."\n',
  );

  const lintRanges = editor.locator(".cm-lintRange-error");
  await expect(lintRanges).toHaveCount(1);
  const lintRange = lintRanges.first();
  await expect(lintRange).toHaveText("jump");
  const lintBox = await lintRange.boundingBox();
  expect(lintBox).not.toBeNull();
  expect(lintBox!.width).toBeLessThan(48);
  await editor.locator(".cm-lint-marker-error").hover();
  const lintTooltip = page.locator(".cm-tooltip-lint");
  await expect(lintTooltip).toBeVisible();
  await expect(lintTooltip).toHaveCSS("background-color", "rgb(36, 36, 34)");
  await expect(lintTooltip).toHaveCSS("color", "rgb(216, 216, 210)");
  await attachProductionState(
    testInfo,
    "editor-source-diagnostics-tooltip-production",
    editor,
  );

  await editor
    .locator(".cm-foldGutter .cm-gutterElement")
    .filter({ hasText: "▾" })
    .first()
    .click();
  await expect(editor.locator(".cm-foldPlaceholder")).toBeHidden();
  const foldControl = editor
    .locator(".cm-foldGutter .cm-gutterElement")
    .filter({ hasText: "▸" })
    .last();
  await expect(foldControl).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-source-folded-production",
    editor,
  );
  await foldControl.click();

  await source.press(
    process.platform === "darwin" ? "Meta+Home" : "Control+Home",
  );
  await source.press("Shift+ArrowDown");
  await source.press("Shift+ArrowDown");
  const selectionRects = await editor
    .locator(".cm-selectionBackground")
    .evaluateAll((items) =>
      items
        .map((item) => item.getBoundingClientRect())
        .sort((left, right) => left.top - right.top)
        .map((box) => ({ left: box.left, right: box.right })),
    );
  expect(selectionRects.length).toBeGreaterThanOrEqual(2);
  expect(
    Math.abs(selectionRects[0].left - selectionRects[1].left),
  ).toBeLessThanOrEqual(0.5);
  await attachProductionState(
    testInfo,
    "editor-source-multiline-precise-production",
    editor,
  );
});

test("a field embedded on another field line is diagnosed and blocks current preview", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  const validSource = `jump
  format: 1
  name: "Syntax Test"
  description: "A valid premise."
  author: "Author"
  version: "1.0"
  starting-points: 1
  points-name: "Choice Points"
  points-abbreviation: "CP"

section
  handle: introduction
  name: "Introduction"
`;
  const malformedSource = validSource.replace(
    'points-name: "Choice Points"',
    'layout: points-name: "Choice Points"',
  );
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(malformedSource);

  const message = "Field “points-name” must start on its own line.";
  await expect(editor.locator(".editor-diagnostics-summary")).toContainText(
    message,
  );
  await expect(editor.getByRole("button", { name: "1 error" })).toBeVisible();
  await expect(editor.locator(".cm-lintRange-error")).toHaveCount(1);
  await expect(editor.locator(".editor-source-status")).toContainText(
    "Preview retains the last valid package.",
  );
  await editor.locator(".editor-diagnostics-toggle").click();
  await expect(
    editor.locator(".editor-diagnostics-details").getByText(message),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-source-embedded-field-diagnostic-production",
    editor,
  );

  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(validSource);
  await expect(editor.locator(".cm-lintRange-error")).toHaveCount(0);
  await expect(editor.locator(".editor-diagnostics-summary")).toContainText(
    "No included diagnostics.",
  );
  await expect(editor.locator(".editor-source-status")).toContainText(
    "Source parses without errors.",
  );
});

test("Asset add, validation, Trash, and package history use the secure boundary", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const editor = await openCreatedEditor(page);
  const image = new PNG({ width: 80, height: 50 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = 40;
    image.data[offset + 1] = 112;
    image.data[offset + 2] = 190;
    image.data[offset + 3] = 255;
  }
  const png = PNG.sync.write(image);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Asset…" }).click();
  await (
    await chooserPromise
  ).setFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(editor.getByRole("button", { name: "pixel.png" })).toBeVisible();
  await expect(editor.getByRole("tab", { name: "Structured" })).toBeVisible();
  await expect(editor.getByRole("tab", { name: "Source" })).toBeVisible();
  await expect(
    editor.locator(".editor-outline-scroll .is-selected"),
  ).toHaveCount(1);
  await expect(
    editor.locator(".editor-outline-scroll .is-selected"),
  ).toContainText("pixel.png");
  await expect(editor.getByLabel("Filename")).toHaveValue("pixel.png");
  await expect(editor.getByLabel("Folder")).toHaveValue("");
  const assetPreview = editor.locator(".editor-asset-preview-panel img");
  await expect(assetPreview).toBeVisible();
  await expect
    .poll(() => assetPreview.evaluate((node) => node.naturalWidth))
    .toBe(80);
  await attachProductionState(
    testInfo,
    "editor-asset-content-structured-corrected",
    editor,
  );

  await editor.getByRole("tab", { name: "Properties" }).click();
  const properties = editor.locator(".editor-properties-panel");
  await expect(properties).toContainText("80 × 50");
  await expect(properties).toContainText("PNG");
  await expect(properties).toContainText("Color model");
  await expect(properties).toContainText("RGBA");
  await expect(properties).toContainText("Bit depth");
  await expect(properties).toContainText("8 bits");
  await expect(properties).toContainText("Interlaced");
  await expect(properties).toContainText("Alpha channel");
  await expect(properties).toContainText("Yes");
  await expect(properties).toContainText("References");
  await expect(properties).not.toContainText("Authors");
  await expect(properties.getByRole("button")).toHaveCount(0);
  await expect(editor.locator(".editor-save-state")).toHaveText("Saved");
  await attachProductionState(
    testInfo,
    "editor-asset-header-metadata-production",
    editor.locator(".editor-context-pane"),
  );
  await editor.getByRole("tab", { name: "Preview" }).click();

  await editor.getByLabel("Folder").fill("art/icons");
  await expect(
    editor.getByRole("button", { name: "Move", exact: true }),
  ).toHaveCount(0);
  await expect(
    editor.locator("summary").filter({ hasText: /^art1$/ }),
  ).toBeVisible();
  await expect(
    editor.locator("summary").filter({ hasText: /^icons1$/ }),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-asset-folder-move-corrected",
    editor,
  );
  await expect(editor.getByRole("button", { name: "pixel.png" })).toBeVisible();
  await expect(editor.getByLabel("Folder")).toHaveValue("art/icons");
  await editor.getByLabel("Folder").fill("../escape");
  await expect(editor.getByRole("alert")).toHaveText(
    "Asset folders cannot be empty, current-directory, parent-directory, or non-canonical segments.",
  );
  await expect(
    editor.locator("summary").filter({ hasText: /^icons1$/ }),
  ).toBeVisible();
  await expect(editor.getByRole("button", { name: "pixel.png" })).toBeVisible();
  await editor.getByLabel("Folder").fill("art/icons");
  await expect(editor.getByRole("alert")).toHaveCount(0);

  await editor.getByRole("button", { name: "Jump details" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.locator(".cm-content");
  await source.click();
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`jump
  format: 1
  name: "Asset workflow"
  description: "Asset workflow"
  author: "Tester"
  version: "1"
  section-layout: image_layout

section
  handle: introduction
  name: "Introduction"

  image
    handle: visual
    src: "art/icons/pixel.png"
    alt: "A blue rectangle"

section-layout
  handle: image_layout

  stack
    image: visual
`);
  await expect(editor.locator(".cm-lintRange-error")).toHaveCount(0);

  await editor.getByRole("button", { name: "pixel.png" }).click();
  await expect(editor.getByText("Referenced by 1 image block.")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Rename" })).toHaveCount(0);
  await editor.getByLabel("Filename").fill("hero.png");
  await expect(editor.getByRole("button", { name: "hero.png" })).toBeVisible();
  await expect(editor.getByLabel("Filename")).toHaveValue("hero.png");
  await editor.getByRole("button", { name: "Undo" }).click();
  await expect(editor.getByRole("button", { name: "pixel.png" })).toBeVisible();
  await expect(editor.getByLabel("Filename")).toHaveValue("pixel.png");
  await editor.getByRole("button", { name: "Redo" }).click();
  await expect(editor.getByRole("button", { name: "hero.png" })).toBeVisible();
  await expect(editor.getByLabel("Filename")).toHaveValue("hero.png");

  await editor.getByRole("button", { name: "Jump details" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  await expect(editor.locator(".cm-content")).toContainText(
    'src: "art/icons/hero.png"',
  );
  await editor.getByRole("button", { name: "introduction" }).click();
  await editor.getByRole("tab", { name: "Structured" }).click();
  await editor.getByRole("button", { name: "visual image" }).click();
  const srcSelect = editor.getByRole("combobox", { name: "src" });
  await expect(srcSelect).toHaveValue("art/icons/hero.png");
  await expect(editor.getByRole("textbox", { name: "src" })).toHaveCount(0);
  const renderedImage = editor.locator(
    '.editor-real-preview img[alt="A blue rectangle"]',
  );
  await expect(renderedImage).toBeVisible();
  await expect
    .poll(() => renderedImage.evaluate((node) => node.naturalWidth))
    .toBe(80);
  await attachProductionState(
    testInfo,
    "editor-image-src-asset-dropdown-corrected",
    editor,
  );

  await editor.getByRole("tab", { name: "Files" }).click();
  await editor.getByRole("button", { name: "hero.png" }).click();
  await expect(editor.getByRole("tab", { name: "Source" })).toBeVisible();
  await expect(editor.getByRole("tab", { name: "Structured" })).toHaveCount(0);
  await expect(
    editor.locator(".editor-outline-scroll .is-selected"),
  ).toHaveCount(1);
  await expect(
    editor.locator(".editor-outline-scroll .is-selected"),
  ).toContainText("hero.png");
  await expect(editor.locator(".asset-source-workspace")).toBeVisible();
  await expect(editor.getByText("Local copy", { exact: true })).toBeVisible();
  await expect(editor.getByRole("toolbar", { name: "Tools" })).toBeVisible();
  await expect(editor.locator(".editor-real-preview")).toBeVisible();
  await expect(editor.locator(".editor-asset-preview-panel")).toHaveCount(0);
  await attachProductionState(
    testInfo,
    "editor-asset-files-binary-source-corrected",
    editor,
  );

  await editor.getByRole("tab", { name: "Content" }).click();
  await attachProductionState(
    testInfo,
    "editor-asset-no-delete-button-corrected",
    editor,
  );
  const heroAsset = editor.getByRole("button", {
    name: /^hero\.png/,
  });
  await heroAsset.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Delete" })
    .click();
  await expect(
    editor.locator("summary").filter({ hasText: /^Assets\s*0$/ }),
  ).toBeVisible();
  const trashedAsset = editor
    .locator(".editor-trash-group")
    .getByRole("button", { name: "hero.png asset", exact: true });
  await expect(trashedAsset).toHaveClass(/is-selected/);
  const trashedImage = editor.locator(".editor-asset-source-panel img");
  await expect(trashedImage).toBeVisible();
  await expect
    .poll(() => trashedImage.evaluate((node) => node.naturalWidth))
    .toBe(80);
  await attachProductionState(
    testInfo,
    "editor-trash-asset-source-corrected",
    editor,
  );
  await trashedAsset.click({ button: "right" });
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Restore" })
    .click();
  await expect(
    editor.getByRole("button", { name: /^hero\.png/ }),
  ).toBeVisible();
  await editor.getByRole("tab", { name: "Files" }).click();
  await editor.getByRole("button", { name: /^hero\.png/ }).click({
    button: "right",
  });
  await expect(
    editor.getByRole("menu", { name: "Sidebar item actions" }),
  ).toBeVisible();
  await editor
    .getByRole("menu", { name: "Sidebar item actions" })
    .getByRole("menuitem", { name: "Open" })
    .click();
  await expect(editor.locator(".asset-source-workspace")).toBeVisible();
  await expect(editor.getByRole("toolbar", { name: "Tools" })).toBeVisible();
  await editor.getByRole("tab", { name: "Content" }).click();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const dismiss = page.getByRole("button", { name: "Dismiss notification" });
    if ((await dismiss.count()) === 0) break;
    await dismiss.first().click();
  }

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const forgedChooserPromise = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Asset…" }).click();
  await (
    await forgedChooserPromise
  ).setFiles({
    name: "forged.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(editor.getByRole("button", { name: "forged.png" })).toHaveCount(
    0,
  );
  const signatureToast = page.locator(".app-toast").filter({
    hasText:
      "Asset rejected: the file contents do not match its image filename extension.",
  });
  await expect(signatureToast).toBeVisible();
  await signatureToast.hover();
  await attachProductionState(
    testInfo,
    "editor-asset-signature-rejection-specific",
    page.locator("body"),
  );
  await signatureToast
    .getByRole("button", { name: "Dismiss notification" })
    .click();

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const unsupportedChooserPromise = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Asset…" }).click();
  await (
    await unsupportedChooserPromise
  ).setFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  const unsupportedToast = page.locator(".app-toast").filter({
    hasText:
      "Asset rejected: the filename must use PNG, JPEG, SVG, GIF, WebP, or AVIF.",
  });
  await expect(unsupportedToast).toBeVisible();
  await unsupportedToast
    .getByRole("button", { name: "Dismiss notification" })
    .click();

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const oversizedChooserPromise = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Asset…" }).click();
  await (
    await oversizedChooserPromise
  ).setFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: Buffer.from(oversizedValidPng()),
  });
  const oversizedToast = page.locator(".app-toast").filter({
    hasText:
      "Asset rejected: the file exceeds the configured per-asset size limit.",
  });
  await expect(oversizedToast).toBeVisible();
  await oversizedToast.hover();
  await attachProductionState(
    testInfo,
    "editor-asset-rejection-reasons-specific",
    page.locator("body"),
  );
});

test(
  "SVG, PNG, and JPEG Source editors update Preview and retain local layered state",
  {
    tag: ["@slow", "@visual"],
  },
  async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const editor = await openCreatedEditor(page);
    const addAsset = async (name: string, mimeType: string, buffer: Buffer) => {
      await editor.getByRole("button", { name: "Add", exact: true }).click();
      const chooserPromise = page.waitForEvent("filechooser");
      await editor.getByRole("button", { name: "Asset…" }).click();
      await (await chooserPromise).setFiles({ name, mimeType, buffer });
      await expect(
        editor.getByRole("button", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    };

    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40"><rect width="64" height="40" fill="#235a91"/></svg>\n',
    );
    const originalSvg = Buffer.from(svg);
    await addAsset("mark.svg", "image/svg+xml", svg);
    const editingViews = editor.getByRole("tablist", { name: "Editing view" });
    await expect(
      editingViews.getByRole("tab", { name: "Structured" }),
    ).toBeVisible();
    await editingViews.getByRole("tab", { name: "Source" }).click();
    const svgPreview = editor.locator(".editor-asset-preview-panel img");
    await expect(svgPreview).toBeVisible();
    await expect(editor.getByText("Local copy", { exact: true })).toBeVisible();
    const svgSource = editor.getByLabel("assets/mark.svg SVG source");
    const svgGutter = editor.locator(".asset-svg-editor-host .cm-gutters");
    await expect(svgGutter).toBeVisible();
    expect(
      await svgGutter.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe("rgb(255, 255, 255)");
    await expect(
      editor.locator(".asset-svg-editor-host .cm-svg-tag"),
    ).not.toHaveCount(0);
    await expect(
      editor.locator(".asset-svg-editor-host .cm-svg-attribute"),
    ).not.toHaveCount(0);
    await expect(
      editor.locator(".asset-svg-editor-host .cm-svg-string"),
    ).not.toHaveCount(0);
    const svgActiveLine = editor.locator(
      ".asset-svg-editor-host .cm-activeLine",
    );
    await expect(svgActiveLine).toBeVisible();
    expect(
      await svgActiveLine.evaluate(
        (element) => getComputedStyle(element).boxShadow,
      ),
    ).toContain("inset");
    const firstPreviewUrl = await svgPreview.getAttribute("src");
    await svgSource.press(
      process.platform === "darwin" ? "Meta+a" : "Control+a",
    );
    await page.keyboard.insertText(
      svg.toString().replace("#235a91", "#b54a62"),
    );
    await expect(
      editor.locator(".asset-source-workspace-status"),
    ).toContainText("Preview updated");
    await expect
      .poll(() => svgPreview.getAttribute("src"))
      .not.toBe(firstPreviewUrl);
    const lastValidPreviewUrl = await svgPreview.getAttribute("src");
    await svgSource.press(
      process.platform === "darwin" ? "Meta+a" : "Control+a",
    );
    await page.keyboard.insertText(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await expect(editor.locator(".asset-editor-diagnostics")).toContainText(
      "Active or embedded",
    );
    await expect(svgPreview).toHaveAttribute("src", lastValidPreviewUrl!);
    const svgAuthoring = editor.locator(".editor-authoring-pane");
    const svgAuthoringBox = await svgAuthoring.boundingBox();
    expect(svgAuthoringBox).not.toBeNull();
    const svgReference = await openAssetReference(
      page,
      Math.round(svgAuthoringBox!.width),
      Math.round(svgAuthoringBox!.height),
      "svg",
      "error",
    );
    await attachComparison(
      testInfo,
      "editor-asset-svg-validation-mock-parity",
      svgReference.mock,
      svgAuthoring,
    );
    await svgReference.reference.close();
    await editor.getByRole("button", { name: "Undo" }).click();
    await expect(svgSource).toContainText("#b54a62");
    await editor.getByRole("button", { name: "Redo" }).click();
    await expect(editor.locator(".asset-editor-diagnostics")).toContainText(
      "Active or embedded",
    );
    await editor.getByRole("button", { name: "Undo" }).click();
    await attachProductionState(
      testInfo,
      "editor-asset-svg-source-preview-production",
      editor,
    );

    const pngImage = new PNG({ width: 48, height: 32 });
    for (let offset = 0; offset < pngImage.data.length; offset += 4) {
      pngImage.data[offset] = 42;
      pngImage.data[offset + 1] = 102;
      pngImage.data[offset + 2] = 168;
      pngImage.data[offset + 3] = 255;
    }
    const png = PNG.sync.write(pngImage);
    const originalPng = Buffer.from(png);
    await addAsset("photo.png", "image/png", png);
    await editingViews.getByRole("tab", { name: "Source" }).click();
    const pngPreview = editor.locator(".editor-asset-preview-panel img");
    const pngPreviewUrl = await pngPreview.getAttribute("src");
    const showOriginal = editor.getByRole("button", { name: "Show original" });
    await showOriginal.click();
    await expect(showOriginal).toHaveAttribute("aria-pressed", "true");
    await showOriginal.click();
    await expect(showOriginal).toHaveAttribute("aria-pressed", "false");
    const rasterBody = editor.locator(".asset-raster-body");
    const bodyBeforeTooltip = await rasterBody.boundingBox();
    expect(bodyBeforeTooltip).not.toBeNull();
    const paintTool = editor.getByRole("button", { name: "Paint" });
    await paintTool.hover();
    const paintTooltip = editor.getByRole("tooltip");
    await expect(paintTooltip).toContainText("Paint");
    await expect(paintTooltip).toContainText("B");
    const bodyWithTooltip = await rasterBody.boundingBox();
    expect(bodyWithTooltip).toEqual(bodyBeforeTooltip);
    await attachProductionState(
      testInfo,
      "editor-asset-raster-paint-tooltip-production",
      editor,
    );

    await paintTool.click();
    const rasterStage = editor.locator(".asset-raster-stage");
    const markupCanvas = rasterStage.locator("canvas").nth(1);
    const canvasBox = await markupCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    const blankMarkup = await markupCanvas.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    const startX = canvasBox!.x + canvasBox!.width * 0.2;
    const startY = canvasBox!.y + canvasBox!.height * 0.35;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(
      canvasBox!.x + canvasBox!.width * 0.5,
      canvasBox!.y + canvasBox!.height * 0.65,
      { steps: 8 },
    );
    await expect
      .poll(() =>
        markupCanvas.evaluate((canvas) =>
          (canvas as HTMLCanvasElement).toDataURL(),
        ),
      )
      .not.toBe(blankMarkup);
    await expect
      .poll(() =>
        markupCanvas.evaluate((canvas) => {
          const element = canvas as HTMLCanvasElement;
          const context = element.getContext("2d")!;
          return Array.from({ length: 9 }, (_, index) => {
            const progress = index / 8;
            const x = Math.round(
              element.width * (0.2 + (0.5 - 0.2) * progress),
            );
            const y = Math.round(
              element.height * (0.35 + (0.65 - 0.35) * progress),
            );
            return context.getImageData(x, y, 1, 1).data[3] > 0;
          }).every(Boolean);
        }),
      )
      .toBe(true);
    await attachProductionState(
      testInfo,
      "editor-asset-raster-live-paint-production",
      editor,
    );
    const firstLiveStroke = await markupCanvas.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    await page.mouse.move(
      canvasBox!.x + canvasBox!.width * 0.8,
      canvasBox!.y + canvasBox!.height * 0.35,
      { steps: 8 },
    );
    await expect
      .poll(() =>
        markupCanvas.evaluate((canvas) =>
          (canvas as HTMLCanvasElement).toDataURL(),
        ),
      )
      .not.toBe(firstLiveStroke);
    await page.mouse.up();
    await expect(
      editor.locator(".asset-source-workspace-status"),
    ).toContainText("Preview updated");
    await expect(editor.getByRole("region", { name: "Layers" })).toContainText(
      "Paint",
    );
    await rasterStage.focus();
    await rasterStage.press(
      process.platform === "darwin" ? "Meta+z" : "Control+z",
    );
    await expect(
      editor.getByRole("region", { name: "Layers" }),
    ).not.toContainText("Paint");
    await rasterStage.press(
      process.platform === "darwin" ? "Meta+Shift+z" : "Control+Shift+z",
    );
    await expect(editor.getByRole("region", { name: "Layers" })).toContainText(
      "Paint",
    );
    const deletePaint = editor.getByRole("button", { name: "Delete Paint" });
    await deletePaint.hover();
    await expect(editor.getByRole("tooltip")).toContainText("Delete Paint");
    await deletePaint.click();
    await expect(editor.getByRole("tooltip")).toHaveCount(0);
    await expect(
      editor.getByRole("region", { name: "Layers" }),
    ).not.toContainText("Paint");

    const inspector = editor.getByRole("complementary", {
      name: "Tool inspector",
    });
    const exposure = inspector.getByRole("slider", { name: "Exposure" });
    await inspector.getByText("Exposure", { exact: true }).click();
    await expect(
      inspector.getByRole("spinbutton", { name: "Exposure value" }),
    ).toHaveCount(0);
    await inspector
      .getByRole("button", { name: "Edit Exposure value" })
      .click();
    const exposureValue = inspector.getByRole("spinbutton", {
      name: "Exposure value",
    });
    await exposureValue.fill("37");
    await exposureValue.press("Enter");
    await expect(exposure).toHaveValue("37");
    await inspector.getByRole("button", { name: "Reset Exposure" }).click();
    await expect(exposure).toHaveValue("0");
    await exposure.fill("30");
    await exposure.dispatchEvent("pointerup");
    await expect(
      editor.locator(".asset-source-workspace-status"),
    ).toContainText("Preview updated");
    await expect
      .poll(() => pngPreview.getAttribute("src"))
      .not.toBe(pngPreviewUrl);
    const correctedBaseCanvas = rasterStage.locator("canvas").first();
    const baseBeforeTemperature = await correctedBaseCanvas.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    const temperature = inspector.getByRole("slider", { name: "Temperature" });
    await temperature.fill("68");
    await expect
      .poll(() =>
        correctedBaseCanvas.evaluate((canvas) =>
          (canvas as HTMLCanvasElement).toDataURL(),
        ),
      )
      .not.toBe(baseBeforeTemperature);
    await attachProductionState(
      testInfo,
      "editor-asset-raster-correction-proxy-production",
      editor,
    );
    await temperature.dispatchEvent("pointerup");
    await expect(
      editor.locator(".asset-source-workspace-status"),
    ).toContainText("Preview updated");
    const canvasCenterPixel = await correctedBaseCanvas.evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement;
      return Array.from(
        element
          .getContext("2d")!
          .getImageData(
            Math.floor(element.width / 2),
            Math.floor(element.height / 2),
            1,
            1,
          ).data,
      );
    });
    const previewCenterPixel = await pngPreview.evaluate(async (image) => {
      const element = image as HTMLImageElement;
      await element.decode();
      const canvas = document.createElement("canvas");
      canvas.width = element.naturalWidth;
      canvas.height = element.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(element, 0, 0);
      return Array.from(
        context.getImageData(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1,
          1,
        ).data,
      );
    });
    expect(
      canvasCenterPixel.every(
        (channel, index) => Math.abs(channel - previewCenterPixel[index]) <= 3,
      ),
    ).toBe(true);
    const beforeWarmPreset = await correctedBaseCanvas.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    await inspector.getByRole("button", { name: "Warm" }).click();
    await expect(exposure).toHaveValue("0");
    await expect(temperature).toHaveValue("24");
    await expect(
      inspector.getByRole("slider", { name: "Vibrance" }),
    ).toHaveValue("12");
    await expect(inspector.getByRole("slider", { name: "Tint" })).toHaveValue(
      "0",
    );
    await expect
      .poll(() =>
        correctedBaseCanvas.evaluate((canvas) =>
          (canvas as HTMLCanvasElement).toDataURL(),
        ),
      )
      .not.toBe(beforeWarmPreset);
    const correctedWarmCanvas = await correctedBaseCanvas.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    await showOriginal.click();
    await expect(showOriginal).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        correctedBaseCanvas.evaluate((canvas) =>
          (canvas as HTMLCanvasElement).toDataURL(),
        ),
      )
      .not.toBe(correctedWarmCanvas);
    await showOriginal.click();
    await expect(showOriginal).toHaveAttribute("aria-pressed", "false");
    await expect
      .poll(() =>
        correctedBaseCanvas.evaluate((canvas) =>
          (canvas as HTMLCanvasElement).toDataURL(),
        ),
      )
      .toBe(correctedWarmCanvas);
    const correctionSummary = inspector.getByText("Corrections", {
      exact: true,
    });
    const strokeWidthField = inspector
      .locator("label")
      .filter({ hasText: "Stroke width" })
      .first();
    const rasterSteppers = strokeWidthField.locator(
      ".number-stepper-buttons button",
    );
    await expect(rasterSteppers).toHaveCount(2);
    await expect(rasterSteppers.first().locator("svg path")).toHaveAttribute(
      "d",
      "M2 6 6 2l4 4",
    );
    await page.mouse.move(0, 0);
    await expect(rasterSteppers.first()).toBeVisible();
    await correctionSummary.click();
    await expect(exposure).not.toBeVisible();
    await correctionSummary.click();
    await expect(exposure).toBeVisible();

    await editor.getByRole("button", { name: "Select" }).focus();
    await page.keyboard.press("t");
    const textCanvasBox = await markupCanvas.boundingBox();
    expect(textCanvasBox).not.toBeNull();
    await page.mouse.move(
      textCanvasBox!.x + textCanvasBox!.width * 0.15,
      textCanvasBox!.y + textCanvasBox!.height * 0.15,
    );
    await page.mouse.down();
    await page.mouse.move(
      textCanvasBox!.x + textCanvasBox!.width * 0.75,
      textCanvasBox!.y + textCanvasBox!.height * 0.45,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(editor.getByRole("region", { name: "Layers" })).toContainText(
      "Text",
    );
    await expect(rasterStage).toHaveAttribute(
      "data-transformer-active",
      "false",
    );
    await editor.getByRole("button", { name: "Select" }).click();
    await expect(rasterStage).toHaveAttribute(
      "data-transformer-active",
      "true",
    );
    await editor.getByRole("button", { name: "Undo" }).click();
    await expect(
      editor.getByRole("region", { name: "Layers" }),
    ).not.toContainText("Text");
    await editor.getByRole("button", { name: "Redo" }).click();
    await expect(editor.getByRole("region", { name: "Layers" })).toContainText(
      "Text",
    );
    const textSize = inspector.getByRole("spinbutton", {
      name: "Size",
      exact: true,
    });
    const initialTextSize = await textSize.inputValue();
    const textBoxWidth = inspector.getByRole("spinbutton", {
      name: "Text box width",
    });
    const initialTextWidth = await textBoxWidth.inputValue();
    const selectedTextCanvasBox = await markupCanvas.boundingBox();
    expect(selectedTextCanvasBox).not.toBeNull();
    await page.mouse.move(
      selectedTextCanvasBox!.x + selectedTextCanvasBox!.width * 0.75,
      selectedTextCanvasBox!.y + selectedTextCanvasBox!.height * 0.3,
    );
    await page.mouse.down();
    await page.mouse.move(
      selectedTextCanvasBox!.x + selectedTextCanvasBox!.width * 0.9,
      selectedTextCanvasBox!.y + selectedTextCanvasBox!.height * 0.3,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(textSize).toHaveValue(initialTextSize);
    await expect(textBoxWidth).not.toHaveValue(initialTextWidth);
    await attachProductionState(
      testInfo,
      "editor-asset-raster-text-box-resized-production",
      editor,
    );
    const resizedTextWidth = await textBoxWidth.inputValue();
    await inspector.getByLabel("Alignment").selectOption("right");
    await expect(textBoxWidth).toHaveValue(resizedTextWidth);

    const layers = editor.getByRole("region", { name: "Layers" });
    await editor.getByRole("button", { name: "Rectangle" }).click();
    await expect(layers).not.toContainText("Rectangle");
    const rectangleCanvasBox = await markupCanvas.boundingBox();
    expect(rectangleCanvasBox).not.toBeNull();
    await page.mouse.move(
      rectangleCanvasBox!.x + rectangleCanvasBox!.width * 0.2,
      rectangleCanvasBox!.y + rectangleCanvasBox!.height * 0.5,
    );
    await page.mouse.down();
    await page.mouse.move(
      rectangleCanvasBox!.x + rectangleCanvasBox!.width * 0.65,
      rectangleCanvasBox!.y + rectangleCanvasBox!.height * 0.85,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(layers).toContainText("Rectangle");
    await layers.getByRole("button", { name: /Rectangle shape/ }).dblclick();
    const renameRectangle = layers.getByRole("textbox", {
      name: "Rename Rectangle",
    });
    await renameRectangle.fill("Frame");
    await renameRectangle.press("Enter");
    await expect(layers).toContainText("Frame");
    await layers.getByRole("button", { name: "Lock Frame" }).click();
    await expect(
      layers.getByRole("button", { name: "Unlock Frame" }),
    ).toBeVisible();
    await layers.getByRole("button", { name: "Hide Frame" }).click();
    await expect(
      layers.getByRole("button", { name: "Show Frame" }),
    ).toBeVisible();
    await expect(rasterStage).toHaveAttribute(
      "aria-label",
      /Selected Frame, hidden and locked/,
    );
    await attachProductionState(
      testInfo,
      "editor-asset-raster-hidden-locked-layer-production",
      editor,
    );

    await editor.getByRole("button", { name: "Line" }).click();
    await expect(layers).not.toContainText("Line");
    const lineCanvasBox = await markupCanvas.boundingBox();
    expect(lineCanvasBox).not.toBeNull();
    await page.mouse.move(
      lineCanvasBox!.x + lineCanvasBox!.width * 0.1,
      lineCanvasBox!.y + lineCanvasBox!.height * 0.8,
    );
    await page.mouse.down();
    await page.mouse.move(
      lineCanvasBox!.x + lineCanvasBox!.width * 0.7,
      lineCanvasBox!.y + lineCanvasBox!.height * 0.2,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(layers).toContainText("Line");
    await editor.getByRole("button", { name: "Arrow" }).click();
    await expect(layers).not.toContainText("Arrow");
    const arrowCanvasBox = await markupCanvas.boundingBox();
    expect(arrowCanvasBox).not.toBeNull();
    await page.mouse.move(
      arrowCanvasBox!.x + arrowCanvasBox!.width * 0.15,
      arrowCanvasBox!.y + arrowCanvasBox!.height * 0.15,
    );
    await page.mouse.down();
    await page.mouse.move(
      arrowCanvasBox!.x + arrowCanvasBox!.width * 0.85,
      arrowCanvasBox!.y + arrowCanvasBox!.height * 0.7,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(layers).toContainText("Arrow");
    await expect(
      inspector.getByRole("option", { name: "Current markup color" }).first(),
    ).toHaveText("Current markup color");
    const cropTool = editor.getByRole("button", { name: "Crop" });
    await cropTool.click();
    await expect(cropTool).toHaveAttribute("aria-pressed", "true");
    const aspectLock = inspector.getByRole("checkbox", {
      name: "Lock aspect ratio",
    });
    const aspectLockBounds = await aspectLock.boundingBox();
    expect(aspectLockBounds).not.toBeNull();
    expect(aspectLockBounds!.width).toBeLessThanOrEqual(20);
    expect(aspectLockBounds!.height).toBeLessThanOrEqual(20);
    await aspectLock.scrollIntoViewIfNeeded();
    await attachProductionState(
      testInfo,
      "editor-asset-raster-aspect-lock-production",
      editor,
    );
    await expect(
      rasterStage.getByText("Drag across the image to set the crop bounds."),
    ).toBeVisible();
    const previewBeforeCrop = await pngPreview.getAttribute("src");
    const cropCanvasBox = await markupCanvas.boundingBox();
    expect(cropCanvasBox).not.toBeNull();
    await page.mouse.move(
      cropCanvasBox!.x + cropCanvasBox!.width * 0.1,
      cropCanvasBox!.y + cropCanvasBox!.height * 0.1,
    );
    await page.mouse.down();
    await page.mouse.move(
      cropCanvasBox!.x + cropCanvasBox!.width * 0.85,
      cropCanvasBox!.y + cropCanvasBox!.height * 0.8,
      { steps: 5 },
    );
    await expect(rasterStage.getByText(/^Crop 3[56] × 2[1-3]$/)).toBeVisible();
    await page.mouse.up();
    await expect(
      rasterStage.getByText("Drag across the image to set the crop bounds."),
    ).toBeVisible();
    await expect(editor.locator(".asset-raster-status")).toContainText(
      /3[56] × 2[1-3]/,
    );
    await expect
      .poll(() => pngPreview.getAttribute("src"))
      .not.toBe(previewBeforeCrop);

    const rasterAuthoring = editor.locator(".editor-authoring-pane");
    const rasterAuthoringBox = await rasterAuthoring.boundingBox();
    expect(rasterAuthoringBox).not.toBeNull();
    const rasterReference = await openAssetReference(
      page,
      Math.round(rasterAuthoringBox!.width),
      Math.round(rasterAuthoringBox!.height),
      "raster",
      "ready",
    );
    await attachComparison(
      testInfo,
      "editor-asset-raster-ready-mock-parity",
      rasterReference.mock,
      rasterAuthoring,
    );
    await rasterReference.reference.close();

    await page.setViewportSize({ width: 820, height: 760 });
    await expect(editor.locator(".asset-raster-inspector")).toBeVisible();
    await attachProductionState(
      testInfo,
      "editor-asset-raster-narrow-production",
      editor,
    );
    await page.locator("html").evaluate((element) => {
      element.dataset.appTheme = "light";
    });
    await editor.getByRole("button", { name: "Select" }).focus();
    await attachProductionState(
      testInfo,
      "editor-asset-raster-light-focus-production",
      editor,
    );
    await page.locator("html").evaluate((element) => {
      element.dataset.appTheme = "dark";
    });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await expect(editor.locator(".editor-save-state")).toHaveText("Saved");
    await page.reload();
    const reloadedEditor = page.locator(".production-editor");
    await expect(reloadedEditor).toBeVisible();
    await reloadedEditor.getByRole("button", { name: /^photo\.png/ }).click();
    await reloadedEditor.getByRole("tab", { name: "Source" }).click();
    await expect(
      reloadedEditor.getByRole("region", { name: "Layers" }),
    ).toContainText("Text");
    const reloadedLayers = reloadedEditor.getByRole("region", {
      name: "Layers",
    });
    const reloadedMarkupCanvas = reloadedEditor
      .locator(".asset-raster-stage canvas")
      .nth(1);
    const layerCountBeforePaint = await reloadedLayers.locator("li").count();
    await reloadedEditor
      .getByRole("button", { name: "Paint", exact: true })
      .click();
    for (const y of [0.28, 0.72]) {
      const bounds = await reloadedMarkupCanvas.boundingBox();
      expect(bounds).not.toBeNull();
      await page.mouse.move(
        bounds!.x + bounds!.width * 0.2,
        bounds!.y + bounds!.height * y,
      );
      await page.mouse.down();
      await page.mouse.move(
        bounds!.x + bounds!.width * 0.55,
        bounds!.y + bounds!.height * y,
        { steps: 6 },
      );
      await page.mouse.up();
    }
    await expect(reloadedLayers.locator("li")).toHaveCount(
      layerCountBeforePaint + 2,
    );
    await expect(
      reloadedLayers.locator("li").filter({ hasText: /^Paintpaint/ }),
    ).toHaveCount(2);

    const selectedPaint = reloadedLayers
      .locator("li")
      .filter({ hasText: /^Paintpaint/ })
      .first();
    await selectedPaint.locator("button").first().dblclick();
    const renamePaint = reloadedLayers.getByRole("textbox", {
      name: "Rename Paint",
    });
    await renamePaint.fill("Movable Paint");
    await renamePaint.press("Enter");
    await expect(reloadedEditor.locator(".asset-raster-stage")).toHaveAttribute(
      "aria-label",
      /Selected Movable Paint, visible and editable/,
    );
    await reloadedEditor.getByRole("button", { name: "Select" }).click();
    const paintMoveBounds = await reloadedMarkupCanvas.boundingBox();
    expect(paintMoveBounds).not.toBeNull();
    const previewBeforePaintMove = await reloadedEditor
      .locator(".editor-asset-preview-panel img")
      .getAttribute("src");
    await page.mouse.move(
      paintMoveBounds!.x + paintMoveBounds!.width * 0.4,
      paintMoveBounds!.y + paintMoveBounds!.height * 0.72,
    );
    await page.mouse.down();
    await page.mouse.move(
      paintMoveBounds!.x + paintMoveBounds!.width * 0.52,
      paintMoveBounds!.y + paintMoveBounds!.height * 0.62,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect
      .poll(() =>
        reloadedEditor
          .locator(".editor-asset-preview-panel img")
          .getAttribute("src"),
      )
      .not.toBe(previewBeforePaintMove);
    await reloadedLayers
      .locator("li")
      .filter({ hasText: /^Paintpaint/ })
      .first()
      .locator("button")
      .first()
      .click();
    await page.mouse.click(
      paintMoveBounds!.x + paintMoveBounds!.width * 0.52,
      paintMoveBounds!.y + paintMoveBounds!.height * 0.62,
    );
    await expect(reloadedEditor.locator(".asset-raster-stage")).toHaveAttribute(
      "aria-label",
      /Selected Movable Paint, visible and editable/,
    );

    const layerCountBeforeDrawingOverSelection = await reloadedLayers
      .locator("li")
      .count();
    await reloadedEditor
      .getByRole("button", { name: "Paint", exact: true })
      .click();
    await expect(reloadedEditor.locator(".asset-raster-stage")).toHaveAttribute(
      "data-transformer-active",
      "false",
    );
    await page.mouse.move(
      paintMoveBounds!.x + paintMoveBounds!.width * 0.52,
      paintMoveBounds!.y + paintMoveBounds!.height * 0.62,
    );
    await page.mouse.down();
    await page.mouse.move(
      paintMoveBounds!.x + paintMoveBounds!.width * 0.72,
      paintMoveBounds!.y + paintMoveBounds!.height * 0.82,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect(reloadedLayers.locator("li")).toHaveCount(
      layerCountBeforeDrawingOverSelection + 1,
    );

    await reloadedLayers
      .getByRole("button", { name: "Lock Movable Paint" })
      .click();
    const layerCountBeforeErase = await reloadedLayers.locator("li").count();
    const reloadedPreview = reloadedEditor.locator(
      ".editor-asset-preview-panel img",
    );
    const readPreviewBytes = () =>
      reloadedPreview.evaluate(async (image) => {
        const element = image as HTMLImageElement;
        await element.decode();
        const canvas = document.createElement("canvas");
        canvas.width = element.naturalWidth;
        canvas.height = element.naturalHeight;
        canvas.getContext("2d")!.drawImage(element, 0, 0);
        return canvas.toDataURL("image/png");
      });
    const previewBeforeErase = await readPreviewBytes();
    await reloadedEditor
      .getByRole("button", { name: "Eraser", exact: true })
      .click();
    await page.mouse.move(
      paintMoveBounds!.x + paintMoveBounds!.width * 0.5,
      paintMoveBounds!.y + paintMoveBounds!.height * 0.62,
    );
    await page.mouse.down();
    await page.mouse.move(
      paintMoveBounds!.x + paintMoveBounds!.width * 0.7,
      paintMoveBounds!.y + paintMoveBounds!.height * 0.82,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect(reloadedLayers.locator("li")).toHaveCount(
      layerCountBeforeErase,
    );
    await expect(
      reloadedLayers.locator("li").filter({ hasText: /^Eraser/ }),
    ).toHaveCount(0);
    await expect.poll(readPreviewBytes).not.toBe(previewBeforeErase);
    const previewAfterErase = await readPreviewBytes();
    const reloadedStage = reloadedEditor.locator(".asset-raster-stage");
    await reloadedStage.focus();
    await reloadedStage.press(
      process.platform === "darwin" ? "Meta+z" : "Control+z",
    );
    await expect.poll(readPreviewBytes).toBe(previewBeforeErase);
    await reloadedStage.press(
      process.platform === "darwin" ? "Meta+Shift+z" : "Control+Shift+z",
    );
    await expect.poll(readPreviewBytes).toBe(previewAfterErase);
    await attachProductionState(
      testInfo,
      "editor-asset-raster-move-draw-erase-production",
      reloadedEditor,
    );

    const stageBeforeResize = await reloadedMarkupCanvas.boundingBox();
    expect(stageBeforeResize).not.toBeNull();
    const resizeWidth = reloadedEditor
      .getByRole("complementary", { name: "Tool inspector" })
      .getByLabel("Width", { exact: true });
    await resizeWidth.fill("72");
    await resizeWidth.press("Tab");
    await expect(reloadedEditor.locator(".asset-raster-status")).toContainText(
      /72 × 4[3-6]/,
    );
    await expect
      .poll(async () => (await reloadedMarkupCanvas.boundingBox())?.width ?? 0)
      .toBeGreaterThan(stageBeforeResize!.width * 1.9);
    await attachProductionState(
      testInfo,
      "editor-asset-raster-paint-layers-resized-production",
      reloadedEditor,
    );

    const rawJpeg = Buffer.from(
      await page.evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 30;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#d78345";
        context.fillRect(0, 0, 40, 30);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error("JPEG unavailable")),
            "image/jpeg",
            0.92,
          ),
        );
        return [...new Uint8Array(await blob.arrayBuffer())];
      }),
    );
    const invalidIccPayload = Buffer.concat([
      Buffer.from("ICC_PROFILE\0", "latin1"),
      Buffer.from([1, 1]),
      Buffer.from("not-a-valid-srgb-profile"),
    ]);
    const invalidIccLength = invalidIccPayload.length + 2;
    const jpeg = Buffer.concat([
      rawJpeg.subarray(0, 2),
      Buffer.from([
        0xff,
        0xe2,
        invalidIccLength >>> 8,
        invalidIccLength & 0xff,
      ]),
      invalidIccPayload,
      rawJpeg.subarray(2),
    ]);
    const originalJpeg = Buffer.from(jpeg);
    await addAsset("portrait.jpg", "image/jpeg", jpeg);
    await reloadedEditor.getByRole("tab", { name: "Source" }).click();
    await expect(
      reloadedEditor.locator(".asset-source-workspace-status"),
    ).toContainText("normalized to safe sRGB");
    await expect(reloadedEditor.getByLabel("JPEG quality")).toHaveValue("92");
    await expect(
      reloadedEditor.getByLabel("Transparency background"),
    ).toHaveValue("#ffffff");
    await attachProductionState(
      testInfo,
      "editor-asset-raster-metadata-warning-production",
      reloadedEditor,
    );

    const largeImage = new PNG({ width: 1200, height: 800 });
    for (let offset = 0; offset < largeImage.data.length; offset += 4) {
      largeImage.data[offset] = 38;
      largeImage.data[offset + 1] = 82;
      largeImage.data[offset + 2] = 128;
      largeImage.data[offset + 3] = 255;
    }
    await addAsset(
      "render-progress.png",
      "image/png",
      PNG.sync.write(largeImage),
    );
    await reloadedEditor.getByRole("tab", { name: "Source" }).click();
    const largeStage = reloadedEditor.locator(".asset-raster-stage");
    const largeStageBox = await largeStage.boundingBox();
    expect(largeStageBox).not.toBeNull();
    const previewBeforePan = await reloadedEditor
      .locator(".editor-asset-preview-panel img")
      .getAttribute("src");
    await reloadedEditor.getByRole("button", { name: "Paint" }).click();
    await page.mouse.move(
      largeStageBox!.x + largeStageBox!.width * 0.55,
      largeStageBox!.y + largeStageBox!.height * 0.55,
    );
    await page.mouse.down({ button: "middle" });
    await expect(
      reloadedEditor.getByRole("button", { name: "Pan" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(
      largeStageBox!.x + largeStageBox!.width * 0.25,
      largeStageBox!.y + largeStageBox!.height * 0.25,
      { steps: 6 },
    );
    await expect
      .poll(() =>
        largeStage.evaluate((element) => ({
          left: element.scrollLeft,
          top: element.scrollTop,
        })),
      )
      .toMatchObject({ left: expect.any(Number), top: expect.any(Number) });
    expect(
      await largeStage.evaluate(
        (element) => element.scrollLeft > 0 && element.scrollTop > 0,
      ),
    ).toBe(true);
    await page.mouse.up({ button: "middle" });
    await expect(
      reloadedEditor.getByRole("button", { name: "Paint" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      reloadedEditor.locator(".editor-asset-preview-panel img"),
    ).toHaveAttribute("src", previewBeforePan!);
    const pannedOverlay = largeStage.locator("canvas").last();
    const pannedOverlayBox = await pannedOverlay.boundingBox();
    expect(pannedOverlayBox).not.toBeNull();
    const pannedStrokeStart = {
      x: largeStageBox!.x + largeStageBox!.width * 0.45,
      y: largeStageBox!.y + largeStageBox!.height * 0.45,
    };
    const pannedStrokeEnd = {
      x: pannedStrokeStart.x + 48,
      y: pannedStrokeStart.y + 28,
    };
    await page.mouse.move(pannedStrokeStart.x, pannedStrokeStart.y);
    await page.mouse.down();
    await page.mouse.move(pannedStrokeEnd.x, pannedStrokeEnd.y, { steps: 8 });
    await expect
      .poll(() =>
        pannedOverlay.evaluate(
          (canvas, position) => {
            const context = (canvas as HTMLCanvasElement).getContext("2d")!;
            const x = Math.round(
              (position.x / (canvas as HTMLCanvasElement).clientWidth) *
                (canvas as HTMLCanvasElement).width,
            );
            const y = Math.round(
              (position.y / (canvas as HTMLCanvasElement).clientHeight) *
                (canvas as HTMLCanvasElement).height,
            );
            return context.getImageData(x, y, 1, 1).data[3];
          },
          {
            x: pannedStrokeEnd.x - pannedOverlayBox!.x,
            y: pannedStrokeEnd.y - pannedOverlayBox!.y,
          },
        ),
      )
      .toBeGreaterThan(0);
    await attachProductionState(
      testInfo,
      "editor-asset-raster-panned-cursor-alignment-production",
      reloadedEditor,
    );
    await page.mouse.up();

    const progressExposure = reloadedEditor
      .getByRole("complementary", { name: "Tool inspector" })
      .getByRole("slider")
      .first();
    await progressExposure.fill("20");
    await progressExposure.dispatchEvent("pointerup");
    await expect(
      reloadedEditor.locator(".asset-raster-editor"),
    ).toHaveAttribute("aria-busy", "true");
    await expect(
      reloadedEditor.locator(".asset-source-workspace-status"),
    ).toContainText("Preview updated");
    await attachProductionState(
      testInfo,
      "editor-asset-raster-render-progress-production",
      reloadedEditor,
    );

    const downloadPromise = page.waitForEvent("download");
    await reloadedEditor.getByRole("button", { name: "Export .jmp" }).click();
    await page.getByRole("button", { name: "Export Package" }).click();
    const download = await downloadPromise;
    const archive = unzipSync(
      new Uint8Array(await readFile(await download.path())),
    );
    expect(archive["assets/photo.png"]).toBeDefined();
    expect(archive["assets/portrait.jpg"]).toBeDefined();
    expect(archive["assets/mark.svg"]).toBeDefined();
    expect(Buffer.from(archive["assets/photo.png"])).not.toEqual(originalPng);
    expect(svg).toEqual(originalSvg);
    expect(png).toEqual(originalPng);
    expect(jpeg).toEqual(originalJpeg);
  },
);

test(
  "paint canvas drag, resize, and base-only corrections track exact document bounds",
  { tag: "@cross-browser" },
  async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const editor = await openCreatedEditor(page);
    const image = new PNG({ width: 400, height: 300 });
    for (let offset = 0; offset < image.data.length; offset += 4) {
      image.data[offset] = 36;
      image.data[offset + 1] = 92;
      image.data[offset + 2] = 148;
      image.data[offset + 3] = 255;
    }
    await editor.getByRole("button", { name: "Add", exact: true }).click();
    const chooserPromise = page.waitForEvent("filechooser");
    await editor.getByRole("button", { name: "Asset…" }).click();
    await (
      await chooserPromise
    ).setFiles({
      name: "transform-paint.png",
      mimeType: "image/png",
      buffer: PNG.sync.write(image),
    });
    await editor.getByRole("tab", { name: "Source" }).click();

    const stage = editor.locator(".asset-raster-stage");
    const stageCanvas = stage.locator("canvas").first();
    const stageBox = await stageCanvas.boundingBox();
    expect(stageBox).not.toBeNull();
    await editor.getByRole("button", { name: "Paint", exact: true }).click();
    await page.mouse.move(
      stageBox!.x + stageBox!.width * 0.2,
      stageBox!.y + stageBox!.height * 0.3,
    );
    await page.mouse.down();
    await page.mouse.move(
      stageBox!.x + stageBox!.width * 0.5,
      stageBox!.y + stageBox!.height * 0.55,
      { steps: 12 },
    );
    await page.mouse.up();
    await expect(
      editor.locator(".asset-source-workspace-status"),
    ).toContainText("Preview updated");

    const inspector = editor.getByRole("complementary", {
      name: "Tool inspector",
    });
    await editor.getByRole("button", { name: "Select", exact: true }).click();
    const paintX = inspector.getByRole("spinbutton", {
      name: "Paint X position",
    });
    const paintY = inspector.getByRole("spinbutton", {
      name: "Paint Y position",
    });
    const paintWidth = inspector.getByRole("spinbutton", {
      name: "Paint width",
    });
    const paintHeight = inspector.getByRole("spinbutton", {
      name: "Paint height",
    });
    const initial = {
      x: Number(await paintX.inputValue()),
      y: Number(await paintY.inputValue()),
      width: Number(await paintWidth.inputValue()),
      height: Number(await paintHeight.inputValue()),
    };

    const dragDelta = { x: 50, y: 30 };
    await page.mouse.move(
      stageBox!.x + initial.x + initial.width / 2,
      stageBox!.y + initial.y + initial.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      stageBox!.x + initial.x + initial.width / 2 + dragDelta.x,
      stageBox!.y + initial.y + initial.height / 2 + dragDelta.y,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect
      .poll(async () => Number(await paintX.inputValue()))
      .toBeCloseTo(initial.x + dragDelta.x, 0);
    await expect
      .poll(async () => Number(await paintY.inputValue()))
      .toBeCloseTo(initial.y + dragDelta.y, 0);
    await expect(paintWidth).toHaveValue(String(initial.width));
    await expect(paintHeight).toHaveValue(String(initial.height));

    const moved = {
      x: Number(await paintX.inputValue()),
      y: Number(await paintY.inputValue()),
      width: Number(await paintWidth.inputValue()),
      height: Number(await paintHeight.inputValue()),
    };
    await page.mouse.move(
      stageBox!.x + moved.x + moved.width,
      stageBox!.y + moved.y + moved.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      stageBox!.x + moved.x + moved.width + 60,
      stageBox!.y + moved.y + moved.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(paintX).toHaveValue(String(moved.x));
    await expect(paintY).toHaveValue(String(moved.y));
    await expect
      .poll(async () => Number(await paintWidth.inputValue()))
      .toBeCloseTo(moved.width + 60, 0);
    await expect(paintHeight).toHaveValue(String(moved.height));

    const paintLayerCanvas = stage.locator("canvas").nth(1);
    const paintBeforeCorrection = await paintLayerCanvas.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    const baseBeforeCorrection = await stageCanvas.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    const temperature = inspector.getByRole("slider", { name: "Temperature" });
    await temperature.fill("70");
    await expect
      .poll(() =>
        stageCanvas.evaluate((canvas) =>
          (canvas as HTMLCanvasElement).toDataURL(),
        ),
      )
      .not.toBe(baseBeforeCorrection);
    expect(
      await paintLayerCanvas.evaluate((canvas) =>
        (canvas as HTMLCanvasElement).toDataURL(),
      ),
    ).toBe(paintBeforeCorrection);
    await temperature.dispatchEvent("pointerup");
    await expect(
      editor.locator(".asset-source-workspace-status"),
    ).toContainText("Preview updated");
    await attachProductionState(
      testInfo,
      "editor-asset-raster-paint-transform-exact-production",
      editor,
    );
  },
);

test("asset explorers show the byte-derived canonical file extension", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const editor = await openCreatedEditor(page);
  const jpeg = Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 54;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#2870be";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("JPEG unavailable")),
          "image/jpeg",
          0.9,
        ),
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    }),
  );

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Asset…" }).click();
  await (
    await chooserPromise
  ).setFiles({
    name: "portrait.jpeg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });

  const contentAsset = editor
    .locator(".editor-outline-scroll button")
    .filter({ hasText: "portrait.jpeg" });
  await expect(contentAsset).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-asset-canonical-extension-content-corrected",
    editor,
  );
  await expect(contentAsset.locator("small")).toHaveText("jpg");

  await editor.getByRole("tab", { name: "Files" }).click();
  const fileAsset = editor
    .locator(".editor-outline-scroll button")
    .filter({ hasText: "portrait.jpeg" });
  await expect(fileAsset.locator("small")).toHaveText("jpg");
  await attachProductionState(
    testInfo,
    "editor-asset-canonical-extension-files-corrected",
    editor,
  );
});

test("Structured authors representative Format 1 fields, children, repeats, and variants", async ({
  page,
}) => {
  const editor = await openCreatedEditor(page);

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Resource", exact: true }).click();
  await expect(
    editor.getByRole("heading", { name: "New Resource" }),
  ).toBeVisible();
  const initial = editor.getByLabel("initial");
  await initial.fill("25");
  await expect(initial).toHaveValue("25");

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Choice", exact: true }).click();
  await editor.getByLabel("selection").selectOption("select");
  await editor.getByRole("button", { name: "+ Add option" }).click();
  await editor.getByRole("textbox", { name: "option 1" }).fill("First option");
  await editor.getByRole("button", { name: "+ Add tag" }).click();
  await editor.getByRole("textbox", { name: "tag 1" }).fill("audit-tag");

  await editor.getByRole("button", { name: "introduction" }).click();
  await editor.getByRole("button", { name: "+ Text" }).click();
  await editor.getByPlaceholder("Search content").fill("new_text");
  await editor.getByRole("button", { name: /new_text text/ }).click();
  await editor
    .getByRole("textbox", { name: "content", exact: true })
    .fill("First line\nSecond line");
  await editor
    .getByRole("button", { name: "+ Add conditional variant" })
    .click();
  const propertyPicker = editor.getByPlaceholder("Choose a property…");
  await expect(propertyPicker).toBeFocused();
  await propertyPicker.fill("gauntlet");
  await page.getByRole("option", { name: /^gauntlet\b/ }).click();
  await editor
    .getByRole("textbox", { name: "content conditional value" })
    .fill("Advanced line");

  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await source.press(
    process.platform === "darwin" ? "Meta+End" : "Control+End",
  );
  await expect(source).toContainText("initial: 25");
  await editor.getByRole("button", { name: "Find", exact: true }).click();
  for (const query of ["First line", "Second line", "content when gauntlet"]) {
    await editor.getByPlaceholder("Find").fill(query);
    await expect(editor.locator(".editor-find-count")).toContainText("of 1");
  }
  await editor.getByPlaceholder("Find").press("Escape");
  await editor.getByRole("tab", { name: "Files" }).click();
  await editor.getByRole("button", { name: "choices.jdef" }).click();
  await expect(editor.getByLabel("choices.jdef source")).toContainText(
    'option: "First option"',
  );
  await expect(editor.getByLabel("choices.jdef source")).toContainText(
    "audit-tag",
  );
});

test("Structured condition builder guides typed rules without writing incomplete drafts", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Jump details" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`jump
  format: 1
  name: "Guided conditions"
  author: "Tester"
  version: "1"

section
  handle: introduction
  name: "Introduction"

  choice-source
    handle: options
    group: conditions
    mode: multi

  text
    handle: body
    content: "Base content"

choice
  handle: tier_control
  name: "Tier"
  group: conditions
  selection: integer
  min: 0
  max: 5
  grant
    kind: property
    handle: tier

choice
  handle: enabled_control
  name: "Enabled"
  group: conditions
  selection: toggle
  grant
    kind: property
    handle: enabled
    value: true

choice
  handle: path_control
  name: "Path"
  group: conditions
  selection: select
  option: "North"
  option: "South"
  grant
    kind: property
    handle: path
`);
  await expect(editor.locator(".cm-lintRange-error")).toHaveCount(0);
  await editor.getByRole("tab", { name: "Structured" }).click();
  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await editor.getByRole("button", { name: "body text", exact: true }).click();

  await editor
    .getByRole("button", { name: "+ Add conditional variant" })
    .click();
  const draftPicker = editor.getByPlaceholder("Choose a property…");
  await expect(draftPicker).toBeFocused();
  await expect(
    editor.getByText("Not saved until the first rule is complete."),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-condition-guided-property-picker-production",
    editor,
  );

  await editor.getByRole("tab", { name: "Source" }).click();
  await expect(source).not.toContainText("content when");
  await editor.getByRole("tab", { name: "Structured" }).click();
  await expect(editor.getByText("New variant draft")).toHaveCount(0);

  await editor
    .getByRole("button", { name: "+ Add conditional variant" })
    .click();
  await editor.getByPlaceholder("Choose a property…").fill("tier");
  await page.getByRole("option", { name: /^tier\b/ }).click();
  const variant = editor.locator(".editor-condition-variant-card").first();
  await variant
    .locator(".editor-condition-rule-row > select")
    .selectOption("greater-equal");
  await variant.getByRole("spinbutton", { name: "Condition value" }).fill("4");
  await variant
    .getByRole("textbox", { name: "content conditional value" })
    .fill("Advanced content");
  await expect(
    variant.locator(".editor-condition-rule-row > select"),
  ).toHaveValue("greater-equal");
  await attachProductionState(
    testInfo,
    "editor-condition-guided-integer-rule-production",
    editor,
  );

  await editor
    .getByRole("button", { name: "+ Add conditional variant" })
    .click();
  await expect(editor.getByText("New variant draft")).toBeVisible();
  const documentGeometry = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    scrollTop: document.scrollingElement?.scrollTop ?? 0,
  }));
  expect(documentGeometry.scrollHeight).toBe(documentGeometry.clientHeight);
  expect(documentGeometry.scrollTop).toBe(0);
  await attachProductionState(
    testInfo,
    "editor-condition-second-variant-draft-no-page-scroll-production",
    editor,
  );
  await editor.getByRole("button", { name: "Cancel draft" }).click();

  await variant
    .getByRole("button", { name: "+ Add condition", exact: true })
    .click();
  await variant.getByPlaceholder("Choose a property…").last().fill("enabled");
  await page
    .getByRole("option", {
      name: /^enabled\b/,
    })
    .click();
  await expect(
    variant.getByRole("group", { name: "Condition group" }),
  ).toBeVisible();
  await expect(variant.getByText("Match")).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-condition-guided-all-group-production",
    editor,
  );

  await variant
    .getByRole("button", { name: "+ Add nested group", exact: true })
    .click();
  await variant.getByPlaceholder("Choose a property…").last().fill("path");
  await page.getByRole("option", { name: /^path\b/ }).click();
  await expect(
    variant.getByRole("group", { name: "Condition group" }),
  ).toHaveCount(2);
  await expect(
    variant.getByRole("button", { name: "Remove condition group" }),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-condition-guided-nested-group-production",
    editor,
  );

  await variant.getByRole("button", { name: "Expression" }).click();
  const expression = variant.locator(
    ".editor-condition-expression-input .cm-content",
  );
  await expect(expression).toContainText("tier >= 4 and enabled");
  await expression.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+a" : "Control+a",
  );
  await page.keyboard.insertText("tier + 4");
  await expect(
    variant.getByText("Repair this expression before switching"),
  ).toBeVisible();
  await expect(
    variant.locator(".editor-field-diagnostics .is-error"),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-condition-expression-diagnostic-production",
    editor,
  );
  const syntaxDiagnostics = editor.getByText(
    /not valid Format 1 expression syntax/,
  );
  await expect(syntaxDiagnostics).toHaveCount(2);
  await expect(syntaxDiagnostics.first()).toBeVisible();
  await expect(syntaxDiagnostics.last()).toBeVisible();
});

test("Structured color fields accept precise hex colors, picker colors, and visual tokens", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(window, "EyeDropper", {
      configurable: true,
      value: class {
        async open() {
          return { sRGBHex: "#0a5bcd" };
        }
      },
    });
  });
  const editor = await openCreatedEditor(page);

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Theme", exact: true }).click();
  await expect(
    editor.getByRole("heading", { name: "new_theme", exact: true }),
  ).toBeVisible();
  await expect(editor.getByLabel("name", { exact: true })).toHaveCount(0);
  const themeColor = editor.getByLabel("color", { exact: true });
  const themePicker = editor.getByLabel("Choose color with color picker");
  const themeScreenSampler = editor.getByRole("button", {
    name: "Sample a screen color for color",
  });
  await expect(themeColor).toHaveValue("#68707c");
  await expect(themePicker).toHaveValue("#68707c");
  await expect(themeScreenSampler).toBeVisible();
  await themeScreenSampler.click();
  await expect(themeColor).toHaveValue("#0A5BCD");
  await attachProductionState(
    testInfo,
    "editor-theme-screen-color-sampler-corrected",
    editor.locator(".editor-color-control"),
  );
  await editor.getByRole("button", { name: "Undo" }).click();
  await expect(themeColor).toHaveValue("#68707c");
  await editor.getByRole("button", { name: "Redo" }).click();
  await expect(themeColor).toHaveValue("#0A5BCD");
  await page.evaluate(() => {
    Object.defineProperty(window, "EyeDropper", {
      configurable: true,
      value: class {
        async open(): Promise<{ sRGBHex: string }> {
          throw new DOMException("cancelled", "AbortError");
        }
      },
    });
  });
  await themeScreenSampler.click();
  await expect(themeColor).toHaveValue("#0A5BCD");
  await editor.getByRole("button", { name: "Undo" }).click();
  await expect(themeColor).toHaveValue("#68707c");
  await editor.getByRole("button", { name: "Redo" }).click();
  await expect(themeColor).toHaveValue("#0A5BCD");
  await themeColor.fill("#1A2B3C");
  await expect(themeColor).toHaveValue("#1A2B3C");
  await themePicker.fill("#123456");
  await expect(themeColor).toHaveValue("#123456");
  const themeSidebarEntry = editor.getByRole("button", {
    name: "new_theme",
    exact: true,
  });
  const themeSidebarPreview = themeSidebarEntry.locator(
    ".editor-theme-color-preview",
  );
  await expect(themeSidebarPreview).toBeVisible();
  await expect(themeSidebarPreview).toHaveAttribute(
    "title",
    "Theme color #123456",
  );
  await expect(themeSidebarEntry).toHaveAccessibleName("new_theme");
  await expect(themeSidebarPreview).toHaveCSS(
    "background-color",
    "rgb(18, 52, 86)",
  );
  await expect(themeSidebarPreview).not.toHaveAttribute("tabindex");
  await expect(themeSidebarPreview.locator("input, button")).toHaveCount(0);
  await attachProductionState(
    testInfo,
    "editor-theme-sidebar-color-preview-corrected",
    editor.locator(".editor-explorer"),
  );
  await themeColor.fill("not-a-color");
  await themeColor.blur();
  await expect(
    themeSidebarEntry.locator(".editor-theme-color-preview"),
  ).toHaveCount(0);
  await themeColor.fill("#123456");
  await themeColor.blur();
  await expect(
    themeSidebarEntry.locator(".editor-theme-color-preview"),
  ).toHaveAttribute("title", "Theme color #123456");
  await attachProductionState(
    testInfo,
    "editor-color-unified-theme-production",
    editor,
  );
  await attachProductionState(
    testInfo,
    "editor-theme-handle-only-corrected",
    editor,
  );

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section layout" }).click();
  const builder = editor.locator(".editor-layout-builder");
  await builder
    .getByRole("button", { name: "Edit Stack presentation fields" })
    .click();
  const background = builder.getByLabel("background", { exact: true });
  const backgroundPicker = builder.getByLabel(
    "Choose background with color picker",
  );
  await background.fill("#A1B2C3");
  await expect(background).toHaveValue("#A1B2C3");
  await backgroundPicker.fill("#2468ac");
  await expect(background).toHaveValue("#2468AC");

  await backgroundPicker.evaluate((element) => {
    const picker = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setValue) throw new Error("Native color value setter is unavailable");
    for (const color of [
      "#332211",
      "#443322",
      "#554433",
      "#665544",
      "#776655",
      "#887766",
      "#998877",
      "#aa9988",
    ]) {
      setValue.call(picker, color);
      picker.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await expect(background).toHaveValue("#AA9988");
  await expect(editor.locator(".editor-save-state")).toHaveText("Saved");

  const backgroundField = background.locator(
    "xpath=ancestor::div[contains(@class, 'editor-schema-field')]",
  );
  await attachProductionState(
    testInfo,
    "editor-color-picker-drag-coalesced-corrected",
    backgroundField,
  );
  const choiceTrigger = backgroundField.getByRole("button", {
    name: "Show color choices for background",
  });
  await expect(
    backgroundField.getByRole("button", {
      name: "Sample a screen color for background",
    }),
  ).toHaveCount(0);
  const colorShell = backgroundField.locator(".editor-color-combobox");
  await expect(colorShell).toBeVisible();
  await expect(backgroundPicker).toHaveCSS("border-right-style", "none");
  await expect(choiceTrigger).toHaveCSS("border-left-style", "none");
  await expect(
    backgroundField.getByRole("button", { name: "Tokens", exact: true }),
  ).toHaveCount(0);
  const builderHeightBeforeChoices = (await builder.boundingBox())!.height;
  await choiceTrigger.click();
  await expect(choiceTrigger).toHaveAttribute("aria-expanded", "true");
  await backgroundPicker.click();
  await expect(choiceTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(backgroundPicker).toBeFocused();
  await choiceTrigger.click();
  await expect(backgroundPicker).not.toBeFocused();
  await expect(choiceTrigger).toHaveAttribute("aria-expanded", "true");
  const choicePopover = backgroundField.getByRole("group", {
    name: "Available color tokens",
  });
  const choicePopoverBox = await choicePopover.boundingBox();
  expect(choicePopoverBox).not.toBeNull();
  expect(choicePopoverBox!.width).toBeLessThanOrEqual(180);
  expect(choicePopoverBox!.height).toBeLessThanOrEqual(144);
  expect((await builder.boundingBox())!.height).toBe(
    builderHeightBeforeChoices,
  );
  const redToken = backgroundField.getByRole("button", {
    name: "Use red color token",
  });
  await expect(redToken.locator("i")).toHaveCSS(
    "background-color",
    "rgb(184, 74, 79)",
  );
  await redToken.click();
  await expect(background).toHaveValue("red");
  await expect(backgroundPicker).toHaveValue("#b84a4f");

  await background.fill("Not A Color!");
  await expect(background).toHaveAttribute("aria-invalid", "true");
  await expect(
    backgroundField.locator(".editor-field-diagnostics"),
  ).toContainText("not a valid color value");
  await expect(
    editor.locator(".editor-diagnostics-summary-text"),
  ).toContainText("not a valid color value");
  await attachProductionState(
    testInfo,
    "editor-color-unified-invalid-diagnostic-production",
    editor,
  );

  await choiceTrigger.click();
  const themeToken = backgroundField.getByRole("button", {
    name: "Use new_theme color token",
  });
  await expect(themeToken.locator("i")).toHaveCSS(
    "background-color",
    "rgb(18, 52, 86)",
  );
  await themeToken.click();
  await expect(background).toHaveValue("new_theme");
  await expect(backgroundPicker).toHaveValue("#123456");
  await expect(background).not.toHaveAttribute("aria-invalid", "true");
  await choiceTrigger.click();
  await expect(choiceTrigger).toHaveAttribute("aria-expanded", "true");
  await attachProductionState(
    testInfo,
    "editor-color-unified-compact-popover-production",
    editor,
  );
  await choiceTrigger.press("Escape");
  await expect(choiceTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(
    backgroundField.getByRole("group", { name: "Available color tokens" }),
  ).toHaveCount(0);

  await editor.getByRole("tab", { name: "Source" }).click();
  const source = await editor.getByLabel("layout.jdef source").innerText();
  expect(source).toContain('color: "#123456"');
  expect(source).toContain("background: new_theme");
  expect(source).not.toContain('name: "New Theme"');

  const sourceEditor = editor.getByLabel("layout.jdef source");
  await sourceEditor.press(
    process.platform === "darwin" ? "Meta+a" : "Control+a",
  );
  await page.keyboard.insertText(
    source.replace(
      "  handle: new_theme",
      '  handle: new_theme\n  name: "Redundant Theme Name"',
    ),
  );
  await expect(
    editor.locator(".editor-diagnostics-summary-text"),
  ).toContainText("Unknown field “name” on theme.");
  await editor
    .locator(".editor-outline-scroll")
    .getByRole("button", { name: "new_theme", exact: true })
    .click();
  await editor.getByRole("tab", { name: "Structured" }).click();
  await expect(
    editor.getByRole("heading", { name: "new_theme", exact: true }),
  ).toBeVisible();
  const needsAttention = editor.locator(".editor-needs-attention");
  await expect(needsAttention).toContainText("Unknown field “name” on theme.");
  await expect(needsAttention.getByLabel("name", { exact: true })).toHaveValue(
    "Redundant Theme Name",
  );
  await attachProductionState(
    testInfo,
    "editor-theme-invalid-name-diagnostic-production",
    editor,
  );
  await needsAttention
    .getByRole("button", { name: "Remove invalid field" })
    .click();
  await expect(needsAttention).toHaveCount(0);
  await expect(editor.getByLabel("name", { exact: true })).toHaveCount(0);
});

test("Structured declaration breadcrumbs space hierarchy separators consistently", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const editor = await openCreatedEditor(page);

  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await editor
    .locator(".editor-child-list")
    .getByRole("button", { name: "welcome text", exact: true })
    .click();

  const breadcrumbs = editor.locator(".editor-breadcrumbs");
  await expect(breadcrumbs).toContainText("Package›introduction›text›welcome");
  await attachProductionState(
    testInfo,
    "editor-structured-breadcrumb-separator-spacing-corrected",
    breadcrumbs,
  );

  const separators = breadcrumbs.locator(
    ":scope > .editor-breadcrumb-separator",
  );
  await expect(separators).toHaveCount(3);
  expect(
    await separators.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-hidden")),
    ),
  ).toEqual(["true", "true", "true"]);
  const gaps = await breadcrumbs.evaluate((element) =>
    Array.from(element.children)
      .filter((child) =>
        child.classList.contains("editor-breadcrumb-separator"),
      )
      .map((separator) => {
        const separatorBox = separator.getBoundingClientRect();
        const nextBox = separator.nextElementSibling?.getBoundingClientRect();
        return nextBox ? nextBox.left - separatorBox.right : 0;
      }),
  );
  expect(gaps).toHaveLength(3);
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(4);
});

test("Structured contextual additions open editable fields without redesigning the workspace", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const editor = await openCreatedEditor(page);

  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  const breadcrumbs = editor.locator(".editor-breadcrumbs");
  const expectSectionHandleBreadcrumb = async () => {
    await expect(
      breadcrumbs.getByText("introduction", { exact: true }),
    ).toBeVisible();
    await expect(
      breadcrumbs.getByText("Introduction", { exact: true }),
    ).toHaveCount(0);
  };
  await expectSectionHandleBreadcrumb();
  await editor.getByRole("button", { name: "+ Text", exact: true }).click();
  const content = editor.getByLabel("content", { exact: true });
  await expect(
    editor.getByRole("heading", { name: "new_text", exact: true }),
  ).toBeVisible();
  await expect(content).toBeFocused();
  await expect(content).toHaveAttribute("aria-invalid", "true");
  await expect(editor.locator(".editor-field-diagnostics")).toContainText(
    "This text block has no content and renders nothing.",
  );
  await expect(
    editor.locator(".editor-diagnostics-summary-text"),
  ).toContainText("This text block has no content and renders nothing.");
  await expectSectionHandleBreadcrumb();
  await attachProductionState(
    testInfo,
    "editor-structured-handle-breadcrumb-corrected",
    editor,
  );
  await attachProductionState(
    testInfo,
    "editor-structured-child-text-feedback-production",
    editor,
  );

  await editor
    .locator(".editor-breadcrumbs")
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  const childList = editor.locator(".editor-child-list");
  await expect(childList).toContainText("new_text");
  await expect(
    childList.getByRole("button", { name: "Remove new_text" }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "+ Choice source", exact: true })
    .click();
  await expectSectionHandleBreadcrumb();
  await expect(editor.getByLabel("group", { exact: true })).toBeFocused();
  await expect(editor.locator(".editor-field-diagnostics")).toContainText(
    "has no group and cannot match choices",
  );
  await attachProductionState(
    testInfo,
    "editor-structured-child-choice-source-feedback-production",
    editor,
  );

  await editor
    .locator(".editor-breadcrumbs")
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await editor.getByRole("button", { name: "+ Image", exact: true }).click();
  await expectSectionHandleBreadcrumb();
  const imageSource = editor.getByLabel("src", { exact: true });
  await expect(imageSource).toBeFocused();
  await expect(imageSource).toHaveValue("");
  await expect(imageSource.locator("option")).toHaveText(["Not set"]);
  await attachProductionState(
    testInfo,
    "editor-structured-image-src-unset-corrected",
    editor,
  );
  await expect(
    editor.locator(".editor-field-diagnostics").filter({ hasText: "source" }),
  ).toContainText("This image has no source and is incomplete for export.");
  await editor
    .locator(".editor-breadcrumbs")
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "+ Direct choice", exact: true })
    .click();
  await expectSectionHandleBreadcrumb();
  await expect(editor.getByLabel("target", { exact: true })).toBeFocused();
  await expect(editor.locator(".editor-field-diagnostics")).toContainText(
    "does not resolve to a choice declaration",
  );
  await attachProductionState(
    testInfo,
    "editor-structured-child-image-direct-choice-production",
    editor,
  );

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Choice", exact: true }).click();
  await editor.getByRole("button", { name: "+ Cost", exact: true }).click();
  await editor
    .getByRole("button", { name: "Create resource…", exact: true })
    .click();
  const resourceDialog = page.getByRole("dialog", {
    name: "Create resource",
  });
  await resourceDialog.getByLabel("Handle").fill("mana");
  await resourceDialog.getByLabel("Name").fill("Mana");
  await resourceDialog.getByLabel("Abbreviation").fill("MP");
  const initialBalance = resourceDialog.locator(".editor-number-stepper");
  expect(
    await initialBalance
      .locator(".number-stepper-buttons path")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
  ).toEqual(["M2 6 6 2l4 4", "m2 2 4 4 4-4"]);
  await initialBalance.getByRole("button", { name: "Increase" }).click();
  await expect(resourceDialog.getByLabel("Initial balance")).toHaveValue("1");
  await initialBalance.getByRole("button", { name: "Decrease" }).click();
  await expect(resourceDialog.getByLabel("Initial balance")).toHaveValue("0");
  await resourceDialog
    .getByRole("button", { name: "Create and use resource" })
    .click();
  await expect(
    editor.getByRole("heading", { name: "Mana", exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Back to cost" }),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-contextual-resource-production",
    editor,
  );
  await editor.getByRole("button", { name: "Back to cost" }).click();
  await expect(editor.getByLabel("resource", { exact: true })).toHaveValue(
    "mana",
  );
  await editor
    .locator(".editor-outline-scroll")
    .getByRole("button", { name: "new_choice", exact: true })
    .click();
  await editor.getByRole("button", { name: "+ Grant", exact: true }).click();
  await editor.getByLabel("kind", { exact: true }).selectOption("resource");
  await expect(editor.getByLabel("resource", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("amount", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("layout", { exact: true })).toHaveCount(0);
  await expect(
    editor.getByRole("heading", { name: "Needs attention" }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Remove invalid field" }).click();
  await attachProductionState(
    testInfo,
    "editor-contextual-grant-fields-production",
    editor,
  );

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section layout" }).click();
  await expect(
    editor.getByRole("heading", { name: "new_section_layout", exact: true }),
  ).toBeVisible();
  await expect(editor.getByLabel("name", { exact: true })).toHaveCount(0);
  const outline = editor.locator(".editor-outline-scroll");
  await expect(
    outline.getByRole("button", { name: "introduction", exact: true }),
  ).toBeVisible();
  await expect(
    outline.getByRole("button", { name: "new_choice", exact: true }),
  ).toBeVisible();
  await expect(
    outline.getByRole("button", {
      name: "new_section_layout section",
      exact: true,
    }),
  ).toBeVisible();
  await expect(editor.getByLabel("Flow")).toHaveValue("stack");
  const containerPresentationButton = editor.getByRole("button", {
    name: "Edit Stack presentation fields",
    exact: true,
  });
  const slotPresentationButton = editor.getByRole("button", {
    name: "Edit Slot presentation fields",
    exact: true,
  });
  const [containerButtonBox, slotButtonBox] = await Promise.all([
    containerPresentationButton.boundingBox(),
    slotPresentationButton.boundingBox(),
  ]);
  expect(containerButtonBox?.width).toBe(slotButtonBox?.width);
  expect(containerButtonBox?.height).toBe(slotButtonBox?.height);
  await attachProductionState(
    testInfo,
    "editor-layout-container-presentation-button-production",
    editor,
  );
  await containerPresentationButton.click();
  const padding = editor.getByLabel("padding", { exact: true });
  await expect(padding).toHaveValue("none");
  await expect(
    padding.getByRole("option", { name: "none", exact: true }),
  ).toHaveCount(1);
  await expect(padding.getByRole("option", { name: /Default:/ })).toHaveCount(
    0,
  );
  await attachProductionState(
    testInfo,
    "editor-layout-enum-default-value-production",
    editor.locator(".editor-layout-selected-editor"),
  );
  await expect(
    editor.locator(".editor-layout-node-fields").getByLabel("handle"),
  ).toHaveCount(0);
  await expect(editor.getByLabel(/layout node$/)).toHaveCount(0);
  await expect(editor.locator(".editor-preview-toolbar small")).toHaveText(
    "Layout preview",
  );
  await expect(editor.locator(".editor-real-preview")).toContainText(
    "Example section",
  );
  await expect(
    editor.locator(".editor-real-preview .format-one-jump-renderer"),
  ).toHaveCount(0);
  await attachProductionState(
    testInfo,
    "editor-layout-node-fields-production",
    editor,
  );
  await attachProductionState(
    testInfo,
    "editor-sidebar-handle-labels-production",
    editor,
  );
  await containerPresentationButton.click();
  await expect(editor.getByLabel("padding", { exact: true })).toHaveCount(0);
  await expect(containerPresentationButton).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await attachProductionState(
    testInfo,
    "editor-layout-container-presentation-collapsed-production",
    editor,
  );

  await editor.getByRole("tab", { name: "Source" }).click();
  const layoutSource = editor.getByLabel("layout.jdef source");
  await layoutSource.press(
    process.platform === "darwin" ? "Meta+a" : "Control+a",
  );
  await page.keyboard.insertText(`section-layout
  handle: new_section_layout
  name: "Invalid layout label"

  stack
`);
  await editor.getByRole("button", { name: "Diagnostics" }).click();
  await expect(editor.locator(".editor-diagnostics-details")).toContainText(
    "Unknown field “name” on section-layout.",
  );
  await attachProductionState(
    testInfo,
    "editor-layout-name-generic-diagnostic-production",
    editor,
  );

  await layoutSource.press(
    process.platform === "darwin" ? "Meta+a" : "Control+a",
  );
  await page.keyboard.insertText(`section-layout
  handle: new_section_layout

  stack
    handle: obsolete_container_id
`);
  await expect(editor.locator(".editor-diagnostics-details")).toContainText(
    "Unknown field “handle” on stack.",
  );
  await attachProductionState(
    testInfo,
    "editor-container-handle-generic-diagnostic-production",
    editor,
  );
});

test("Structured section child rails use the application accent", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const editor = await openCreatedEditor(page);

  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await editor.getByRole("button", { name: "+ Text", exact: true }).click();
  await editor
    .locator(".editor-breadcrumbs")
    .getByRole("button", { name: "introduction", exact: true })
    .click();

  const childRow = editor
    .locator(".editor-child-list > div")
    .filter({ hasText: "new_text" });
  await expect(childRow).toContainText("new_text");
  await attachProductionState(
    testInfo,
    "editor-section-content-rail-corrected",
    editor,
  );
  await expect(childRow).toHaveCSS(
    "border-left-color",
    await resolveColorToken(page, "--app-accent-raw"),
  );
});

test("Structured section content keeps a directly relevant preview scope", async ({
  page,
}, testInfo) => {
  const editor = await openCreatedEditor(page);
  const image = new PNG({ width: 64, height: 40 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = 40;
    image.data[offset + 1] = 112;
    image.data[offset + 2] = 190;
    image.data[offset + 3] = 255;
  }
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Asset…" }).click();
  await (
    await chooserPromise
  ).setFiles({
    name: "relevant.png",
    mimeType: "image/png",
    buffer: PNG.sync.write(image),
  });

  await editor.getByRole("button", { name: "Jump details" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`jump
  format: 1
  name: "Relevant previews"
  author: "Tester"
  version: "1"

section
  handle: introduction
  name: "Introduction"

  text
    handle: body
    content: "Section body"

  image
    handle: visual
    src: "relevant.png"
    alt: "Relevant blue asset"

  choice-source
    handle: available
    group: options
    mode: multi

  choice
    handle: featured
    target: alpha

choice
  handle: alpha
  name: "Alpha Choice"
  group: options
  selection: toggle

choice
  handle: beta
  name: "Beta Choice"
  group: options
  selection: toggle
`);
  await expect(editor.locator(".cm-lintRange-error")).toHaveCount(0);
  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await editor.getByRole("tab", { name: "Structured" }).click();
  await editor.getByRole("button", { name: "body text", exact: true }).click();
  if (reviewArtifactsEnabled) {
    await editor.screenshot({
      path: "artifacts/editor-visual/editor-section-text-preview-corrected.png",
    });
  }
  await expect(
    editor.locator(".editor-real-preview > .rendered-jump-section"),
  ).toBeVisible();
  await expect(
    editor.locator(".editor-real-preview .shared-jump-renderer"),
  ).toHaveCount(0);

  const openSection = () =>
    editor
      .locator(".editor-breadcrumbs")
      .getByRole("button", { name: "introduction", exact: true })
      .click();
  await openSection();
  await editor
    .getByRole("button", { name: "visual image", exact: true })
    .click();
  const imagePreview = editor.locator(
    '.editor-real-preview > .jump-image-preview img[alt="Relevant blue asset"]',
  );
  await expect(imagePreview).toBeVisible();
  await expect
    .poll(() => imagePreview.evaluate((image) => image.naturalWidth))
    .toBe(64);
  const imageBlockTooltip = editor
    .locator(".editor-real-preview > .jump-image-preview")
    .getByRole("tooltip");
  await expect(imageBlockTooltip).toBeHidden();
  await imagePreview.hover();
  await expect(imageBlockTooltip).toHaveText("Relevant blue asset");
  await expect(imageBlockTooltip).toBeVisible();
  if (reviewArtifactsEnabled) {
    await editor.screenshot({
      path: "artifacts/editor-visual/editor-section-image-preview-corrected.png",
    });
  }
  await attachProductionState(
    testInfo,
    "editor-image-block-alt-tooltip-corrected",
    editor,
  );

  await openSection();
  await editor
    .getByRole("button", { name: "featured choice", exact: true })
    .click();
  const preview = editor.locator(".editor-real-preview");
  await expect(
    preview.getByText("Alpha Choice", { exact: true }),
  ).toBeVisible();
  await expect(preview.getByText("Beta Choice", { exact: true })).toHaveCount(
    0,
  );
  if (reviewArtifactsEnabled) {
    await writeFile(
      "artifacts/editor-visual/editor-section-direct-choice-preview-corrected.png",
      await captureReviewScreenshot(editor),
    );
  }

  await openSection();
  await editor
    .getByRole("button", { name: "available choice source", exact: true })
    .click();
  await expect(
    preview.getByText("Alpha Choice", { exact: true }),
  ).toBeVisible();
  await expect(preview.getByText("Beta Choice", { exact: true })).toBeVisible();
  if (reviewArtifactsEnabled) {
    await writeFile(
      "artifacts/editor-visual/editor-section-choice-source-preview-corrected.png",
      await captureReviewScreenshot(editor),
    );
  }
});

test("Structured section previews disclose image alternative text on hover", async ({
  page,
}, testInfo) => {
  const editor = await openCreatedEditor(page);
  const image = new PNG({ width: 64, height: 40 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = 40;
    image.data[offset + 1] = 112;
    image.data[offset + 2] = 190;
    image.data[offset + 3] = 255;
  }
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Asset…" }).click();
  await (
    await chooserPromise
  ).setFiles({
    name: "section-image.png",
    mimeType: "image/png",
    buffer: PNG.sync.write(image),
  });

  await editor.getByRole("button", { name: "Jump details" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`jump
  format: 1
  name: "Section image tooltip"
  author: "Tester"
  version: "1"

section
  handle: introduction
  name: "Introduction"
  layout: image_section

  image
    handle: visual
    src: "section-image.png"
    alt: "Relevant blue asset"

section-layout
  handle: image_section

  stack
    image: visual
`);
  await expect(editor.locator(".cm-lintRange-error")).toHaveCount(0);
  await editor
    .getByRole("button", { name: "introduction", exact: true })
    .click();
  await editor.getByRole("tab", { name: "Structured" }).click();

  const sectionImage = editor.locator(
    '.editor-real-preview > .rendered-jump-section img[alt="Relevant blue asset"]',
  );
  await expect(sectionImage).toBeVisible();
  const sectionImageTooltip = editor
    .locator(
      '.editor-real-preview > .rendered-jump-section [data-layout-kind="image"]',
    )
    .getByRole("tooltip");
  await expect(sectionImageTooltip).toBeHidden();
  await sectionImage.hover();
  await expect(sectionImageTooltip).toHaveText("Relevant blue asset");
  await expect(sectionImageTooltip).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-section-image-alt-tooltip-corrected",
    editor,
  );
});

test("Structured layout tree safely edits hierarchy through the mock-aligned container workflow", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section layout" }).click();

  const builder = editor.locator(".editor-layout-builder");
  const addRow = builder.locator(".editor-layout-add-row");
  const editingContainer = builder.getByLabel("Editing container");
  const chooseNewNode = async (kind: string) => {
    await addRow.getByLabel("New node type").selectOption(kind);
  };
  const sourceText = async () => {
    await editor.getByRole("tab", { name: "Source" }).click();
    const text = await editor.getByLabel("layout.jdef source").innerText();
    await editor.getByRole("tab", { name: "Structured" }).click();
    return text;
  };

  await expect(
    builder.getByText("Children of stack[1]", { exact: true }),
  ).toBeVisible();
  await expect(
    builder.getByRole("button", { name: "Move Slot up" }),
  ).toBeDisabled();
  await expect(
    builder.getByRole("button", { name: "Move Slot down" }),
  ).toBeDisabled();

  await chooseNewNode("grid");
  await addRow.getByRole("button", { name: "Add child" }).click();
  await expect(editingContainer).toHaveValue(/node:/);
  await expect(
    builder.getByText(/Children of stack\[1\]\/grid\[2\]/),
  ).toBeVisible();
  expect(await sourceText()).toContain("grid\n      columns: 2");
  await attachProductionState(
    testInfo,
    "editor-layout-mock-aligned-nested-grid-production",
    editor,
  );

  await editingContainer.selectOption({ label: "stack[1]" });
  await chooseNewNode("inline");
  await addRow.getByRole("button", { name: "Add child" }).click();
  await expect(
    builder.getByText(/Children of stack\[1\]\/inline\[3\]/),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-layout-mock-aligned-nested-container-production",
    editor,
  );

  await editingContainer.selectOption({ label: "stack[1]" });
  const inlineRow = builder.locator('[data-layout-node-kind="inline"]');
  const slotRow = builder.locator('[data-layout-node-kind="slot"]');
  const gridRow = builder.locator('[data-layout-node-kind="grid"]');
  const slotPresentationButton = slotRow.getByRole("button", {
    name: "Edit Slot presentation fields",
  });
  await slotPresentationButton.click();
  await expect(slotRow.locator(".editor-layout-row-node-fields")).toBeVisible();
  const gridContainerValue = await editingContainer
    .locator("option")
    .filter({ hasText: "grid" })
    .getAttribute("value");
  await editingContainer.selectOption(gridContainerValue!);
  await editingContainer.selectOption({ label: "stack[1]" });
  await attachProductionState(
    testInfo,
    "editor-layout-child-expansion-container-change-corrected",
    editor,
  );
  await expect(slotRow.locator(".editor-layout-row-node-fields")).toHaveCount(
    0,
  );
  await attachProductionState(
    testInfo,
    "editor-layout-child-action-columns-corrected",
    builder,
  );
  const rowColumnBoxes = async (row: Locator) => {
    const labels = row.locator(":scope > label");
    const actions = row.locator(":scope > .editor-layout-row-actions");
    return Promise.all([
      labels.nth(0).boundingBox(),
      labels.nth(1).boundingBox(),
      labels.nth(2).boundingBox(),
      actions
        .getByRole("button", { name: /^Move .* container$/ })
        .boundingBox(),
      actions.getByRole("button", { name: /^Move .* up$/ }).boundingBox(),
      actions.getByRole("button", { name: /^Move .* down$/ }).boundingBox(),
      actions.getByRole("button", { name: /^Remove / }).boundingBox(),
    ]);
  };
  const [slotColumns, gridColumns, inlineColumns] = await Promise.all([
    rowColumnBoxes(slotRow),
    rowColumnBoxes(gridRow),
    rowColumnBoxes(inlineRow),
  ]);
  // Container rows omit the leaf-presentation action, but reserve its column so
  // every field and action remains aligned with leaf rows.
  for (const columnIndex of [0, 1, 2, 3, 4, 5, 6]) {
    expect(slotColumns[columnIndex]).not.toBeNull();
    expect(gridColumns[columnIndex]).not.toBeNull();
    expect(inlineColumns[columnIndex]).not.toBeNull();
    expect(
      Math.abs(gridColumns[columnIndex]!.x - slotColumns[columnIndex]!.x),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(inlineColumns[columnIndex]!.x - slotColumns[columnIndex]!.x),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        gridColumns[columnIndex]!.width - slotColumns[columnIndex]!.width,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        inlineColumns[columnIndex]!.width - slotColumns[columnIndex]!.width,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await inlineRow.dragTo(slotRow, { targetPosition: { x: 20, y: 60 } });
  const dragReorderedSource = await sourceText();
  expect(dragReorderedSource.indexOf("inline")).toBeLessThan(
    dragReorderedSource.indexOf("grid"),
  );
  await attachProductionState(
    testInfo,
    "editor-layout-sibling-drag-reorder-production",
    editor,
  );

  await slotPresentationButton.click();
  await expect(slotRow.locator(".editor-layout-row-node-fields")).toBeVisible();
  const slotDragHandle = slotRow.locator(".editor-layout-drag-handle");
  await gridRow.scrollIntoViewIfNeeded();
  const gridBounds = await gridRow.boundingBox();
  expect(gridBounds).not.toBeNull();
  const dragData = await page.evaluateHandle(() => new DataTransfer());
  await slotDragHandle.dispatchEvent("dragstart", { dataTransfer: dragData });
  await gridRow.dispatchEvent("dragover", {
    clientX: gridBounds!.x + gridBounds!.width / 2,
    clientY: gridBounds!.y + gridBounds!.height / 2,
    dataTransfer: dragData,
  });
  await expect(gridRow).toHaveClass(/drop-inside/);
  await attachProductionState(
    testInfo,
    "editor-layout-drag-reparent-target-production",
    editor,
  );
  await gridRow.dispatchEvent("drop", { dataTransfer: dragData });
  await expect(builder.locator('[data-layout-node-kind="slot"]')).toHaveCount(
    0,
  );
  const dragReparentedSource = await sourceText();
  expect(dragReparentedSource).toContain(
    "    grid\n      columns: 2\n      slot\n        target: name",
  );
  await gridRow
    .getByRole("button", { name: /Open .*grid.* container/ })
    .click();
  await expect(builder.locator('[data-layout-node-kind="slot"]')).toBeVisible();
  await expect(
    builder
      .locator('[data-layout-node-kind="slot"]')
      .locator(".editor-layout-row-node-fields"),
  ).toHaveCount(0);
  await attachProductionState(
    testInfo,
    "editor-layout-drag-reparented-production",
    editor,
  );
  await attachProductionState(
    testInfo,
    "editor-layout-child-expansion-drag-reparent-corrected",
    editor,
  );

  const nestedSlotRow = builder.locator('[data-layout-node-kind="slot"]');
  const moveSlotButton = nestedSlotRow.getByRole("button", {
    name: "Move Slot to another container",
  });
  await moveSlotButton.click();
  await expect(moveSlotButton).toHaveAttribute("aria-expanded", "true");
  await expect(
    nestedSlotRow.locator(".editor-layout-move-panel"),
  ).toBeVisible();
  await expect(
    nestedSlotRow.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCount(0);
  await attachProductionState(
    testInfo,
    "editor-layout-move-expansion-production",
    editor,
  );
  await moveSlotButton.click();
  await expect(moveSlotButton).toHaveAttribute("aria-expanded", "false");
  await expect(nestedSlotRow.locator(".editor-layout-move-panel")).toHaveCount(
    0,
  );
  await attachProductionState(
    testInfo,
    "editor-layout-move-collapsed-production",
    editor,
  );
  const nestedSlotPresentationButton = nestedSlotRow.getByRole("button", {
    name: "Edit Slot presentation fields",
  });
  await nestedSlotPresentationButton.click();
  await expect(
    nestedSlotRow.locator(".editor-layout-row-node-fields"),
  ).toBeVisible();
  await moveSlotButton.click();
  const returnDestination = await nestedSlotRow
    .getByLabel("Move to container")
    .getByRole("option", { name: "stack[1]", exact: true })
    .getAttribute("value");
  await nestedSlotRow
    .getByLabel("Move to container")
    .selectOption(returnDestination!);
  await nestedSlotRow
    .getByRole("button", { name: "Move", exact: true })
    .click();
  await builder.getByRole("button", { name: "stack[1]", exact: true }).click();
  const returnedSlotRow = builder.locator('[data-layout-node-kind="slot"]');
  await expect(
    returnedSlotRow.locator(".editor-layout-row-node-fields"),
  ).toHaveCount(0);
  await attachProductionState(
    testInfo,
    "editor-layout-child-expansion-move-reparent-corrected",
    returnedSlotRow,
  );
  await returnedSlotRow.getByRole("button", { name: "Move Slot up" }).click();

  await chooseNewNode("text");
  await addRow.getByLabel("Target").fill("introduction");
  await addRow.getByRole("button", { name: "Add child" }).click();
  const textRow = builder.locator('[data-layout-node-kind="text"]');
  await expect(textRow).toBeVisible();
  const textTarget = textRow.getByLabel("Text target");
  await textTarget.focus();
  await attachProductionState(
    testInfo,
    "editor-layout-target-text-control-corrected",
    textRow,
  );
  await expect(textTarget).toHaveCSS("appearance", "none");
  await textRow.evaluate((element) => {
    element.addEventListener(
      "dragstart",
      (event) =>
        element.setAttribute(
          "data-target-dragstart-cancelled",
          String(event.defaultPrevented),
        ),
      { once: true },
    );
  });
  const textTargetBounds = await textTarget.boundingBox();
  expect(textTargetBounds).not.toBeNull();
  await page.mouse.move(
    textTargetBounds!.x + 12,
    textTargetBounds!.y + textTargetBounds!.height / 2,
  );
  await page.mouse.down();
  await expect(textRow).toHaveAttribute("draggable", "false");
  await page.mouse.move(
    textTargetBounds!.x + Math.min(110, textTargetBounds!.width - 12),
    textTargetBounds!.y + textTargetBounds!.height / 2,
    { steps: 8 },
  );
  const selectedTargetText = await textTarget.evaluate((element) => {
    const input = element as HTMLInputElement;
    return input.value.slice(
      input.selectionStart ?? 0,
      input.selectionEnd ?? 0,
    );
  });
  expect(selectedTargetText.length).toBeGreaterThan(0);
  expect(
    await textRow.getAttribute("data-target-dragstart-cancelled"),
  ).not.toBe("false");
  await page.mouse.up();
  await expect(textRow).toHaveAttribute("draggable", "true");

  for (const control of [
    textRow.getByLabel("Node type"),
    textRow.getByRole("button", { name: "Move Text to another container" }),
  ]) {
    await control.dispatchEvent("pointerdown");
    await expect(textRow).toHaveAttribute("draggable", "false");
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })),
    );
    await expect(textRow).toHaveAttribute("draggable", "true");
  }
  const textPresentationButton = textRow.getByRole("button", {
    name: "Edit Text presentation fields",
  });
  await textPresentationButton.click();
  await expect(textRow.locator(".editor-layout-row-node-fields")).toBeVisible();
  await expect(textPresentationButton).toHaveAttribute("aria-expanded", "true");
  await expect(
    textRow.getByRole("button", { name: "Use compact form" }),
  ).toHaveCount(0);
  const childTable = builder.locator(".editor-layout-table");
  await expect(childTable).toHaveCSS("overflow-y", "visible");
  const childTableDimensions = await childTable.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(childTableDimensions.scrollHeight).toBe(
    childTableDimensions.clientHeight,
  );
  const structuredScroll = editor.locator(".editor-structured-scroll");
  await expect(structuredScroll).toHaveCSS("overflow-y", "auto");
  const structuredDimensions = await structuredScroll.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(structuredDimensions.scrollHeight).toBeGreaterThan(
    structuredDimensions.clientHeight,
  );
  const textBackground = textRow.getByLabel("background", { exact: true });
  await textBackground.fill("#123456");
  await textBackground.press("Tab");
  await expect(textBackground).toHaveValue("#123456");
  await textRow.evaluate((element) => {
    element.addEventListener(
      "dragstart",
      (event) =>
        element.setAttribute(
          "data-observed-dragstart-cancelled",
          String(event.defaultPrevented),
        ),
      { once: true },
    );
  });
  const textBackgroundBounds = await textBackground.boundingBox();
  expect(textBackgroundBounds).not.toBeNull();
  await page.mouse.move(
    textBackgroundBounds!.x + 10,
    textBackgroundBounds!.y + textBackgroundBounds!.height / 2,
  );
  await page.mouse.down();
  await expect(textRow).toHaveAttribute("draggable", "false");
  await page.mouse.move(
    textBackgroundBounds!.x + 85,
    textBackgroundBounds!.y + textBackgroundBounds!.height / 2,
    { steps: 6 },
  );
  expect(
    await textRow.getAttribute("data-observed-dragstart-cancelled"),
  ).not.toBe("false");
  await expect(textRow).not.toHaveClass(/dragging/);
  await page.mouse.up();
  await expect(textRow).toHaveAttribute("draggable", "true");
  await attachProductionState(
    testInfo,
    "editor-layout-color-text-selection-production",
    textRow,
  );
  await textBackground.fill("");
  await textBackground.press("Tab");
  await expect(textBackground).toHaveValue("");
  await textRow.scrollIntoViewIfNeeded();
  await attachProductionState(
    testInfo,
    "editor-layout-child-presentation-expanded-production",
    editor,
  );
  await attachProductionState(
    testInfo,
    "editor-layout-child-presentation-expanded-full-production",
    textRow,
  );
  await textPresentationButton.click();
  await expect(textRow.locator(".editor-layout-row-node-fields")).toHaveCount(
    0,
  );
  await expect(textPresentationButton).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await textRow.scrollIntoViewIfNeeded();
  await attachProductionState(
    testInfo,
    "editor-layout-child-presentation-collapsed-production",
    editor,
  );
  await textRow.getByRole("button", { name: "Move Text up" }).click();
  const reorderedSource = await sourceText();
  expect(reorderedSource.indexOf("text: introduction")).toBeLessThan(
    reorderedSource.indexOf("grid"),
  );

  await textRow
    .getByRole("button", { name: "Move Text to another container" })
    .click();
  const moveSelect = textRow.getByLabel("Move to container");
  const gridDestination = await moveSelect
    .locator("option")
    .filter({ hasText: "grid" })
    .getAttribute("value");
  await moveSelect.selectOption(gridDestination!);
  await textRow.getByRole("button", { name: "Move", exact: true }).click();
  await expect(builder.locator('[data-layout-node-kind="text"]')).toHaveCount(
    0,
  );
  await builder
    .locator('[data-layout-node-kind="grid"]')
    .getByRole("button", { name: /Open .*grid.* container/ })
    .click();
  await expect(builder.locator('[data-layout-node-kind="text"]')).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-layout-cross-container-move-production",
    editor,
  );

  await builder.getByRole("button", { name: "stack[1]", exact: true }).click();
  await builder
    .locator('[data-layout-node-kind="grid"]')
    .getByRole("button", { name: "Remove Grid" })
    .click();
  await expect(builder.locator('[data-layout-node-kind="grid"]')).toHaveCount(
    0,
  );
  await expect(builder.locator('[data-layout-node-kind="text"]')).toBeVisible();
  const promotedSource = await sourceText();
  expect(promotedSource).not.toContain("grid\n");
  expect(promotedSource).toContain("    text: introduction");
  await attachProductionState(
    testInfo,
    "editor-layout-container-removal-promotes-children-production",
    editor,
  );

  const promotedTextTarget = builder
    .locator('[data-layout-node-kind="text"]')
    .getByLabel("Text target");
  await promotedTextTarget.fill("Not A Handle!");
  await promotedTextTarget.press("Tab");
  await expect(promotedTextTarget).toHaveAttribute("aria-invalid", "true");
  await expect(builder.locator('[data-layout-node-kind="text"]')).toContainText(
    "legal handle reference",
  );
  await builder
    .locator('[data-layout-node-kind="text"]')
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  await attachProductionState(
    testInfo,
    "editor-layout-invalid-target-inline-diagnostic-production",
    editor,
  );
  await textPresentationButton.click();
  const diagnosticPresentation = textRow.locator(
    ".editor-layout-row-node-fields",
  );
  await expect(diagnosticPresentation).toBeVisible();
  await expect(diagnosticPresentation).toContainText("legal handle reference");
  await attachProductionState(
    testInfo,
    "editor-layout-diagnostic-field-row-corrected",
    diagnosticPresentation,
  );
  const expandedTarget = diagnosticPresentation.getByLabel("target", {
    exact: true,
  });
  const expandedPadding = diagnosticPresentation.getByLabel("padding", {
    exact: true,
  });
  const expandedBackground = diagnosticPresentation.getByLabel("background", {
    exact: true,
  });
  const [targetBox, paddingBox, backgroundBox] = await Promise.all([
    expandedTarget.boundingBox(),
    expandedPadding.boundingBox(),
    expandedBackground.boundingBox(),
  ]);
  expect(targetBox).not.toBeNull();
  expect(paddingBox).not.toBeNull();
  expect(backgroundBox).not.toBeNull();
  // A multiline diagnostic may make the grid row taller, but it must not
  // stretch neighboring field wrappers and distribute that height internally.
  expect(Math.abs(paddingBox!.y - targetBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(backgroundBox!.y - targetBox!.y)).toBeLessThanOrEqual(1);
  await textPresentationButton.click();
  await promotedTextTarget.fill("introduction");
  await promotedTextTarget.press("Tab");
  await expect(editor.getByRole("button", { name: "0 errors" })).toBeVisible();

  await chooseNewNode("choice");
  await addRow.getByLabel("Target").fill("new_choice");
  await addRow.getByRole("button", { name: "Add child" }).click();
  await chooseNewNode("expand");
  await addRow.getByRole("button", { name: "Add child" }).click();
  await expect(
    builder.locator('[data-layout-node-kind="choice"]'),
  ).toBeVisible();
  await expect(
    builder.locator('[data-layout-node-kind="expand"]'),
  ).toBeVisible();
  await expect(
    builder.locator(".editor-field-diagnostics .is-error"),
  ).toHaveCount(0);
  await attachProductionState(
    testInfo,
    "editor-layout-complete-section-capabilities-production",
    editor,
  );
});

test("Structured layouts remember their active container across sidebar work", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const editor = await openCreatedEditor(page);

  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section layout" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("layout.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`section-layout
  handle: alpha_layout

  stack
    slot: name

    grid
      columns: 2
      slot: roll

section-layout
  handle: beta_layout

  stack
    slot: name

    inline
      slot: roll
`);
  await editor.getByRole("tab", { name: "Structured" }).click();

  const outline = editor.locator(".editor-outline-scroll");
  const editingContainer = editor.getByLabel("Editing container");
  await outline.getByRole("button", { name: /^alpha_layout/ }).click();
  await editingContainer.selectOption({ label: "stack[1]/grid[2]" });
  await expect(
    editor.getByText("Children of stack[1]/grid[2]", { exact: true }),
  ).toBeVisible();

  await outline.getByRole("button", { name: /^beta_layout/ }).click();
  await editingContainer.selectOption({ label: "stack[1]/inline[2]" });
  await outline
    .getByRole("button", { name: "Jump details", exact: true })
    .click();
  await editor.getByLabel("name", { exact: true }).fill("Sidebar work");

  await outline.getByRole("button", { name: /^alpha_layout/ }).click();
  await expect(editingContainer).toHaveValue(/node:/);
  await expect(editingContainer.locator("option:checked")).toHaveText(
    "stack[1]/grid[2]",
  );
  await expect(
    editor.locator('[data-layout-container-editor-path="stack[1]/grid[2]"]'),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-layout-active-container-restored-production",
    editor,
  );

  await outline.getByRole("button", { name: /^beta_layout/ }).click();
  await expect(editingContainer.locator("option:checked")).toHaveText(
    "stack[1]/inline[2]",
  );
});

test(
  "Source-authored choice and trait layouts remain completely editable in Structured",
  {
    tag: "@slow",
  },
  async ({ page }, testInfo) => {
    test.slow();
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    const editor = await openCreatedEditor(page);
    const replaceSelectedSource = async (source: string, handle: string) => {
      await editor.getByRole("tab", { name: "Source" }).click();
      const sourceEditor = editor.getByLabel("layout.jdef source");
      await sourceEditor.press(
        process.platform === "darwin" ? "Meta+a" : "Control+a",
      );
      await page.keyboard.insertText(source);
      await editor.getByRole("tab", { name: "Structured" }).click();
      await editor
        .locator(".editor-outline-scroll")
        .getByRole("button", { name: new RegExp(`^${handle}`) })
        .click();
    };

    await editor.getByRole("button", { name: "Add", exact: true }).click();
    await editor.getByRole("button", { name: "Choice layout" }).click();
    await replaceSelectedSource(
      `choice-layout
  handle: complete_choice_card

  grid
    columns: 3
    gap: sm
    slot: name
    slot: cost
    slot: control
    slot: roll
    slot: tags
    input: quantity
    text: description

    image
      target: portrait
      width: xl
      height: lg
      fit: cover

    rule
`,
      "complete_choice_card",
    );

    const builder = editor.locator(".editor-layout-builder");
    const columnsField = builder.locator(
      '.editor-schema-field:has(input[aria-label="columns"])',
    );
    expect(
      await columnsField
        .locator(".number-stepper-buttons path")
        .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
    ).toEqual(["M2 6 6 2l4 4", "m2 2 4 4 4-4"]);
    await columnsField.getByRole("button", { name: "Increase" }).click();
    await expect(columnsField.getByRole("spinbutton")).toHaveValue("4");
    await columnsField.getByRole("button", { name: "Decrease" }).click();
    await expect(columnsField.getByRole("spinbutton")).toHaveValue("3");
    const newNodeType = builder.getByLabel("New node type");
    await expect(newNodeType.locator('option[value="input"]')).toHaveCount(1);
    await expect(newNodeType.locator('option[value="choice"]')).toHaveCount(0);
    await expect(newNodeType.locator('option[value="expand"]')).toHaveCount(0);
    await expect(builder.locator('[data-layout-node-kind="slot"]')).toHaveCount(
      5,
    );
    await expect(
      builder.locator('[data-layout-node-kind="input"]'),
    ).toHaveCount(1);
    await attachProductionState(
      testInfo,
      "editor-layout-complete-choice-production",
      editor,
    );
    const imageRow = builder.locator('[data-layout-node-kind="image"]');
    await imageRow
      .getByRole("button", { name: "Edit Image presentation fields" })
      .click();
    await expect(imageRow.getByLabel("width", { exact: true })).toHaveValue(
      "xl",
    );
    await expect(imageRow.getByLabel("height", { exact: true })).toHaveValue(
      "lg",
    );
    await expect(
      imageRow.getByLabel("text align", { exact: true }),
    ).toHaveCount(0);
    await expect(imageRow.getByLabel("text size", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      imageRow.getByLabel("text color", { exact: true }),
    ).toHaveCount(0);
    await imageRow.getByLabel("width", { exact: true }).fill("96px");
    await imageRow.getByLabel("height", { exact: true }).fill("72px");
    const renderedImage = editor.locator('[data-layout-kind="image"]');
    await expect(renderedImage).toHaveCSS("width", "96px");
    await expect(renderedImage).toHaveCSS("height", "72px");
    await imageRow.getByLabel("size", { exact: true }).fill("112px");
    await expect(imageRow.getByLabel("width", { exact: true })).toHaveValue("");
    await expect(imageRow.getByLabel("height", { exact: true })).toHaveValue(
      "",
    );
    await expect(renderedImage).toHaveCSS("width", "112px");
    await expect(renderedImage).toHaveCSS("height", "112px");
    await imageRow
      .getByRole("button", { name: "Show size choices for size" })
      .click();
    await expect(
      imageRow.getByRole("listbox", { name: "Available image size tokens" }),
    ).toBeVisible();
    await attachProductionState(
      testInfo,
      "editor-layout-choice-image-presentation-production",
      editor,
    );
    await imageRow
      .getByRole("listbox", { name: "Available image size tokens" })
      .getByRole("option", { name: "md", exact: true })
      .click();
    await expect(renderedImage).toHaveCSS("width", "128px");
    await expect(renderedImage).toHaveCSS("height", "128px");
    await imageRow.getByLabel("size", { exact: true }).fill("");
    await builder.getByLabel("columns", { exact: true }).fill("1");
    await imageRow.getByLabel("align", { exact: true }).selectOption("start");
    const imageAtStart = await renderedImage.boundingBox();
    expect(imageAtStart).not.toBeNull();
    await imageRow.getByLabel("align", { exact: true }).selectOption("stretch");
    const imageAtStretch = await renderedImage.boundingBox();
    expect(imageAtStretch).not.toBeNull();
    expect(imageAtStretch!.width).toBeGreaterThan(imageAtStart!.width);
    await attachProductionState(
      testInfo,
      "editor-layout-image-stretch-corrected",
      editor,
    );
    const imagePresentationButton = imageRow.getByRole("button", {
      name: "Edit Image presentation fields",
    });
    await imagePresentationButton.click();
    await expect(
      imageRow.locator(".editor-layout-row-node-fields"),
    ).toHaveCount(0);
    await expect(imagePresentationButton).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(
      imageRow.getByRole("button", { name: "Use compact form" }),
    ).toHaveCount(0);
    await attachProductionState(
      testInfo,
      "editor-layout-choice-image-presentation-collapsed-production",
      editor,
    );
    await imagePresentationButton.click();
    await expect(imageRow.getByLabel("size", { exact: true })).toHaveValue("");
    await imagePresentationButton.click();
    await expect(
      imageRow.locator(".editor-layout-row-node-fields"),
    ).toHaveCount(0);

    await builder.getByLabel("Flow").selectOption("stack");
    await expect(builder.getByLabel("columns", { exact: true })).toHaveCount(0);
    await expect(
      editor.getByRole("button", { name: "0 errors" }),
    ).toBeVisible();
    await attachProductionState(
      testInfo,
      "editor-layout-source-authored-edited-structured-production",
      editor,
    );

    await replaceSelectedSource(
      `choice-layout
  handle: complete_choice_card

  stack
    handle: obsolete_container_id
    slot: name
`,
      "complete_choice_card",
    );
    await expect(
      builder.locator(".editor-layout-invalid-fields"),
    ).toContainText("Unknown field “handle” on stack.");
    await attachProductionState(
      testInfo,
      "editor-layout-needs-attention-production",
      editor,
    );
    await builder
      .locator(".editor-layout-invalid-fields")
      .getByRole("button", { name: "Remove invalid field" })
      .click();
    await expect(builder.locator(".editor-layout-invalid-fields")).toHaveCount(
      0,
    );
    await expect(
      editor.getByRole("button", { name: "0 errors" }),
    ).toBeVisible();
    await attachProductionState(
      testInfo,
      "editor-layout-needs-attention-repaired-production",
      editor,
    );

    await editor.getByRole("button", { name: "Add", exact: true }).click();
    await editor.getByRole("button", { name: "Trait layout" }).click();
    await replaceSelectedSource(
      `trait-layout
  handle: complete_trait_card

  wrap
    gap: sm
    slot: name
    text: description
    image: portrait
    rule
`,
      "complete_trait_card",
    );
    await expect(newNodeType.locator('option[value="input"]')).toHaveCount(0);
    await expect(newNodeType.locator('option[value="choice"]')).toHaveCount(0);
    await expect(newNodeType.locator('option[value="expand"]')).toHaveCount(0);
    await expect(builder.locator('[data-layout-node-kind="slot"]')).toHaveCount(
      1,
    );
    await expect(builder.locator('[data-layout-node-kind="text"]')).toHaveCount(
      1,
    );
    await expect(
      builder.locator('[data-layout-node-kind="image"]'),
    ).toHaveCount(1);
    await expect(builder.locator('[data-layout-node-kind="rule"]')).toHaveCount(
      1,
    );
    await attachProductionState(
      testInfo,
      "editor-layout-complete-trait-production",
      editor,
    );
  },
);

test("container children and rules expose inline presentation editors", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const editor = await openCreatedEditor(page);
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByRole("button", { name: "Section layout" }).click();
  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("layout.jdef source");
  await source.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await page.keyboard.insertText(`section-layout
  handle: inline_presentation

  stack
    inline
      slot: name

    rule
`);
  await editor.getByRole("tab", { name: "Structured" }).click();
  await editor
    .locator(".editor-outline-scroll")
    .getByRole("button", { name: /^inline_presentation section$/ })
    .click();

  const builder = editor.locator(".editor-layout-builder");
  const inlineRow = builder.locator('[data-layout-node-kind="inline"]');
  const ruleRow = builder.locator('[data-layout-node-kind="rule"]');
  await expect(inlineRow).toBeVisible();
  await expect(ruleRow).toBeVisible();
  const inlinePresentation = inlineRow.getByRole("button", {
    name: "Edit Inline presentation fields",
  });
  const rulePresentation = ruleRow.getByRole("button", {
    name: "Edit Rule presentation fields",
  });
  await expect(inlinePresentation).toBeVisible();
  await expect(rulePresentation).toBeVisible();
  await inlinePresentation.click();
  await expect(inlineRow.getByLabel("gap", { exact: true })).toBeVisible();
  await expect(inlineRow.getByLabel("justify", { exact: true })).toBeVisible();
  await inlinePresentation.click();
  await expect(inlineRow.locator(".editor-layout-row-node-fields")).toHaveCount(
    0,
  );
  await inlinePresentation.click();
  await expect(inlineRow.getByLabel("gap", { exact: true })).toBeVisible();

  await rulePresentation.click();
  await expect(inlineRow.locator(".editor-layout-row-node-fields")).toHaveCount(
    0,
  );
  const color = ruleRow.getByLabel("color", { exact: true });
  const thickness = ruleRow.getByLabel("thickness", { exact: true });
  const style = ruleRow.getByLabel("style", { exact: true });
  const previewRule = editor.locator(
    '.editor-real-preview .jump-layout-leaf-boundary[data-layout-kind="rule"] hr',
  );
  await expect(color).toBeVisible();
  await expect(thickness).toHaveValue("");
  await expect(thickness).toHaveAttribute("placeholder", "Default: 1");
  await expect(style).toHaveValue("solid");
  await thickness.hover();
  const thicknessStepper = ruleRow.locator(".editor-number-stepper");
  expect(
    await thicknessStepper
      .locator(".number-stepper-buttons path")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
  ).toEqual(["M2 6 6 2l4 4", "m2 2 4 4 4-4"]);
  const increaseThickness = thicknessStepper.getByRole("button", {
    name: "Increase",
  });
  const decreaseThickness = thicknessStepper.getByRole("button", {
    name: "Decrease",
  });
  await expect(decreaseThickness).toBeDisabled();
  await attachProductionState(
    testInfo,
    "editor-layout-rule-thickness-chevron-corrected",
    editor,
  );
  await increaseThickness.click();
  await expect(thickness).toHaveValue("2");
  await decreaseThickness.click();
  await expect(thickness).toHaveValue("1");
  await expect(previewRule).toHaveCSS("border-top-width", "1px");
  await expect(previewRule).toHaveCSS("border-top-style", "solid");
  await color.fill("#C85A71");
  await color.press("Tab");
  await thickness.fill("3");
  await thickness.press("Tab");
  await style.selectOption("dash");

  await expect(previewRule).toHaveCSS("border-top-color", "rgb(200, 90, 113)");
  await expect(previewRule).toHaveCSS("border-top-width", "3px");
  await expect(previewRule).toHaveCSS("border-top-style", "dashed");
  await attachProductionState(
    testInfo,
    "editor-layout-container-rule-presentation-corrected",
    editor,
  );

  await expect(style.locator('option[value="rounded"]')).toHaveText("rounded");
  await thickness.fill("10");
  await thickness.press("Tab");
  await style.selectOption("rounded");
  await expect(previewRule).toHaveCSS("height", "10px");
  await expect(previewRule).toHaveCSS("background-color", "rgb(200, 90, 113)");
  await expect(previewRule).toHaveCSS("border-radius", "9999px");
  await expect(previewRule).toHaveCSS("border-top-style", "none");
  await attachProductionState(
    testInfo,
    "editor-layout-rule-rounded-production",
    editor,
  );
  await rulePresentation.click();
  await expect(ruleRow.locator(".editor-layout-row-node-fields")).toHaveCount(
    0,
  );

  await editor.getByRole("tab", { name: "Source" }).click();
  await expect(source).toContainText('color: "#C85A71"');
  await expect(source).toContainText("thickness: 10");
  await expect(source).toContainText("style: rounded");
});

test("layout declarations preview representative content without a valid package fallback", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1400, height: 900 });
  const editor = await openCreatedEditor(page);
  const preview = editor.locator(".editor-real-preview");
  const replaceSelectedSource = async (source: string) => {
    await editor.getByRole("tab", { name: "Source" }).click();
    const sourceEditor = editor.getByLabel(/source$/);
    await sourceEditor.press(
      process.platform === "darwin" ? "Meta+a" : "Control+a",
    );
    await page.keyboard.insertText(source);
    await expect(editor.locator(".editor-preview-toolbar small")).toHaveText(
      "Layout preview",
    );
    await expect(editor.locator(".editor-source-status")).toContainText(
      "Layout preview uses representative content",
    );
    await expect(preview.locator(".format-one-jump-renderer")).toHaveCount(0);
  };
  const addLayout = async (name: string) => {
    await editor.getByRole("button", { name: "Add", exact: true }).click();
    await editor.getByRole("button", { name, exact: true }).click();
  };

  await addLayout("Choice layout");
  await replaceSelectedSource(`choice-layout
  handle: new_choice_layout

  stack
    gap: sm
    slot: name
    slot: cost
    slot: tags
    text: description
    image
      target: hero
      size: sm
      fit: cover
    input: notes
    slot: control
    slot: roll
`);
  await expect(preview).toContainText("Example choice 1");
  await expect(preview).toContainText("100 CP");
  await expect(preview).toContainText("example");
  await expect(preview).toContainText("Example content for “description”.");
  await expect(preview.getByAltText("Example image for hero")).toBeVisible();
  await expect(preview.getByRole("textbox")).toBeVisible();
  await expect(preview.getByRole("button", { name: "Roll" })).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-choice-layout-dummy-preview-production",
    editor,
  );

  await addLayout("Section layout");
  await replaceSelectedSource(`choice-layout
  handle: new_choice_layout

  stack
    gap: sm
    slot: name
    slot: cost
    text: description
    image
      target: hero
      size: sm
    slot: control

section-layout
  handle: new_section_layout

  stack
    gap: md
    slot: name
    slot: roll
    text: introduction
    image
      target: banner
      size: md
      fit: cover
    expand
      source: main
      using: new_choice_layout
    choice: featured
`);
  await expect(preview).toContainText("Example section");
  await expect(preview).toContainText("Example content for “introduction”.");
  await expect(preview.getByAltText("Example image for banner")).toBeVisible();
  await expect(preview).toContainText("Example choice 1");
  await expect(preview).toContainText("Example choice 2");
  await expect(preview).toContainText("Example direct choice 1");
  await expect(
    preview.locator(".source-roll-controls").getByRole("button", {
      name: "Roll",
    }),
  ).toBeVisible();
  await attachProductionState(
    testInfo,
    "editor-section-layout-dummy-preview-production",
    editor,
  );
  await preview
    .getByText("Example direct choice 1", { exact: true })
    .scrollIntoViewIfNeeded();
  await attachProductionState(
    testInfo,
    "editor-section-layout-direct-choice-preview-production",
    editor,
  );

  await addLayout("Trait layout");
  await replaceSelectedSource(`trait-layout
  handle: new_trait_layout

  stack
    gap: sm
    slot: name
    text: details
    image
      target: icon
      size: sm
`);
  await expect(preview).toContainText("Example trait");
  await expect(preview).toContainText("Example content for “details”.");
  const traitImage = preview.getByAltText("Example image for icon");
  await expect(traitImage).toBeVisible();
  await expect(traitImage).toHaveCSS("width", "64px");
  await expect(traitImage).toHaveCSS("height", "64px");
  await attachProductionState(
    testInfo,
    "editor-trait-layout-dummy-preview-production",
    editor,
  );
});

test("diagnostics reproduce the mock icons and open upward", async ({
  page,
}) => {
  const editor = await openCreatedEditor(page);
  const diagnostics = editor.locator(".editor-diagnostics");
  const toggle = diagnostics.getByRole("button", { name: "Diagnostics" });
  const chevron = diagnostics.locator(".editor-diagnostics-chevron");
  await expect(diagnostics.locator(".editor-diagnostic-icon")).toHaveCount(3);
  await expect(chevron).toHaveText("›");
  await expect(chevron).toHaveCSS("transform", "none");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(chevron).not.toHaveCSS("transform", "none");
  const [barBox, detailsBox] = await Promise.all([
    diagnostics.locator(".editor-diagnostics-bar").boundingBox(),
    diagnostics.locator(".editor-diagnostics-details").boundingBox(),
  ]);
  expect(barBox).not.toBeNull();
  expect(detailsBox).not.toBeNull();
  expect(detailsBox!.y + detailsBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
  expect(Math.abs(detailsBox!.height - 128)).toBeLessThanOrEqual(2);
});

const warningPackage = () =>
  zipSync(
    {
      "jump.jdef": new TextEncoder().encode(`jump
  format: 1
  name: "Warning Review"
  author: "Package Author"
  version: "1.0"

section
  handle: introduction
  name: "Introduction"

  choice-source
    handle: ungrouped
    mode: multi
`),
    },
    { level: 0 },
  );

test(
  "contrasting accent projects through Editor hub, workspace, import review, and Developer limits",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.goto("/settings");
    await page.locator("#accent").evaluate((element) => {
      const input = element as HTMLInputElement;
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "#2f7bdc");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate((element) =>
            getComputedStyle(element)
              .getPropertyValue("--app-accent-raw")
              .trim(),
          ),
      )
      .toBe("#2f7bdc");
    await page.getByRole("button", { name: "Close Settings" }).click();
    await page.getByRole("button", { name: "Open Editor" }).click();
    if (shouldCaptureReviewArtifacts(testInfo)) {
      await testInfo.attach("editor-hub-custom-accent-dark", {
        body: await page.locator(".editor-hub-content").screenshot(),
        contentType: "image/png",
      });
    }
    await page.getByRole("button", { name: "Create Project" }).click();
    const accentBorder = await page.locator("html").evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.color = getComputedStyle(element).getPropertyValue(
        "--app-accent-border",
      );
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(
      page.locator('.editor-tabs button[aria-selected="true"]').first(),
    ).toHaveCSS("border-bottom-color", accentBorder);
    if (shouldCaptureReviewArtifacts(testInfo)) {
      await testInfo.attach("editor-workspace-custom-accent-dark", {
        body: await page.locator(".production-editor").screenshot(),
        contentType: "image/png",
      });
    }

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Developer" }).click();
    await page.getByLabel("Use custom package limits").click();
    await page.getByRole("button", { name: "I understand, enable" }).click();
    if (shouldCaptureReviewArtifacts(testInfo)) {
      await testInfo.attach("developer-package-limits-custom-accent-dark", {
        body: await page.locator(".app-settings-surface").screenshot(),
        contentType: "image/png",
      });
    }
    await page.getByRole("button", { name: "Close Settings" }).click();
    await page.getByRole("button", { name: "Editor", exact: true }).click();
    const projectCard = page.locator(".editor-project-card").first();
    await projectCard
      .getByRole("button", { name: "Delete Untitled Jump" })
      .click();
    const deleteConfirmation = page.getByRole("alertdialog", {
      name: "Delete Untitled Jump?",
    });
    await expect(deleteConfirmation).toHaveCSS(
      "border-color",
      await resolveColorToken(page, "--app-accent-border"),
    );
    const customAccentDelete = deleteConfirmation.getByRole("button", {
      name: "Delete project",
    });
    await expect(customAccentDelete).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(customAccentDelete).toHaveCSS(
      "color",
      await resolveColorToken(page, "--app-danger-text"),
    );
    await customAccentDelete.hover();
    await expect(customAccentDelete).toHaveCSS(
      "background-color",
      await resolveColorToken(page, "--app-danger-surface"),
    );
    if (shouldCaptureReviewArtifacts(testInfo)) {
      await testInfo.attach("editor-delete-confirmation-custom-accent-dark", {
        body: await deleteConfirmation.screenshot(),
        contentType: "image/png",
      });
    }
    await deleteConfirmation.getByRole("button", { name: "Cancel" }).click();
    await page.locator('input[type="file"][accept^=".jmp"]').setInputFiles({
      name: "warning.jmp",
      mimeType: "application/zip",
      buffer: Buffer.from(warningPackage()),
    });
    const review = page.getByRole("alertdialog");
    await expect(
      review.getByRole("button", { name: "Import Anyway" }),
    ).toBeVisible();
    await expect(review.getByText("At your own risk.")).toBeVisible();
    if (shouldCaptureReviewArtifacts(testInfo)) {
      await testInfo.attach("editor-import-warning-custom-accent-dark", {
        body: await review.screenshot(),
        contentType: "image/png",
      });
    }
    const warningBorder = await review
      .locator(".package-review-risk")
      .evaluate((element) => getComputedStyle(element).borderColor);
    expect(warningBorder).not.toBe("rgb(47, 123, 220)");
    await review.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "General" }).click();
    await page.locator("#theme").selectOption("light");
    await page.getByRole("button", { name: "Close Settings" }).click();
    if (shouldCaptureReviewArtifacts(testInfo)) {
      await testInfo.attach("editor-hub-custom-accent-light", {
        body: await page.locator(".editor-hub-content").screenshot(),
        contentType: "image/png",
      });
    }
  },
);

function oversizedValidPng() {
  const image = new PNG({ width: 2048, height: 2200 });
  let random = 0x12345678;
  for (let index = 0; index < image.data.length; index += 4) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    image.data[index] = random & 0xff;
    image.data[index + 1] = (random >>> 8) & 0xff;
    image.data[index + 2] = (random >>> 16) & 0xff;
    image.data[index + 3] = 255;
  }
  return PNG.sync.write(image, { deflateLevel: 0, deflateStrategy: 0 });
}

test(
  "an oversized package is blocked by defaults and admitted only by a confirmed byte override",
  {
    tag: "@slow",
  },
  async ({ page }) => {
    test.setTimeout(120_000);
    const source = new TextEncoder().encode(`jump
  format: 1
  name: "Large Asset Package"
  author: "Boundary Test"
  version: "1.0"

section
  handle: introduction
  name: "Introduction"

  image
    handle: large
    src: "large.png"
    alt: "A one-pixel validation image"
`);
    const archive = zipSync(
      { "jump.jdef": source, "assets/large.png": oversizedValidPng() },
      { level: 0 },
    );
    await page.goto("/editor");
    const input = page.locator('input[type="file"][accept^=".jmp"]');
    await input.setInputFiles({
      name: "large.jmp",
      mimeType: "application/zip",
      buffer: Buffer.from(archive),
    });
    const blocked = page.getByRole("alertdialog");
    await expect(
      blocked.getByRole("heading", {
        name: "This package may be unsafe or malformed",
      }),
    ).toBeVisible();
    await expect(blocked).toContainText("effective 16 MiB limit");
    await expect(page.locator(".editor-project-card")).toHaveCount(0);
    await blocked.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Developer" }).click();
    await page.getByLabel("Use custom package limits").click();
    await page.getByRole("button", { name: "I understand, enable" }).click();
    await page.getByRole("spinbutton", { name: /Asset file/ }).fill("20");
    await page.getByRole("button", { name: "Close Settings" }).click();
    await input.setInputFiles({
      name: "large.jmp",
      mimeType: "application/zip",
      buffer: Buffer.from(archive),
    });
    const review = page.getByRole("alertdialog");
    await expect(
      review.getByRole("heading", { name: /Large Asset Package/ }),
    ).toBeVisible();
    await expect(review).toContainText("Asset 20 MiB");
    await expect(review).toContainText("At your own risk");
    await review.getByRole("button", { name: "Import Project" }).click();
    await expect(page.getByLabel("Large Asset Package Editor")).toBeVisible();
  },
);
