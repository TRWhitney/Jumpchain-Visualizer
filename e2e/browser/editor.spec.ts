import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { zipSync } from "fflate";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

async function attachComparison(
  testInfo: TestInfo,
  name: string,
  reference: Locator,
  production: Locator,
) {
  const referenceBytes = await reference.screenshot({ animations: "disabled" });
  const productionBytes = await production.screenshot({
    animations: "disabled",
  });
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
  if (testInfo.project.name === "chromium") {
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
  expect(left.width).toBe(right.width);
  expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(2);
}

async function attachProductionState(
  testInfo: TestInfo,
  name: string,
  production: Locator,
) {
  const bytes = await production.screenshot({ animations: "disabled" });
  await testInfo.attach(name, { body: bytes, contentType: "image/png" });
  if (testInfo.project.name === "chromium") {
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
  await testInfo.attach("editor-hub-project-card-desktop", {
    body: await card.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });

  await page.setViewportSize({ width: 640, height: 700 });
  await card.scrollIntoViewIfNeeded();
  await expect(metadata).toBeVisible();
  const narrowMain = await expectInside(card, main);
  await expectInside(card, metadata);
  await expectInside(card, star);
  await expectInside(card, actions);
  expect(narrowMain.width).toBeGreaterThan(300);
  await testInfo.attach("editor-hub-project-card-narrow", {
    body: await card.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });

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

test("Editor follows the mock across structured, source, layout, and diagnostic states", async ({
  page,
}, testInfo) => {
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

  await editor.getByRole("button", { name: "Introduction" }).click();
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
  await attachComparison(testInfo, "editor-source-advanced-find", mock, editor);
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
  await editor.getByRole("button", { name: "New Choice Layout" }).click();
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
  await editor.locator("[data-layout-bound]").first().hover();
  await attachComparison(testInfo, "editor-layout-bounds-hover", mock, editor);

  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel(/source$/);
  await source.press("Control+End");
  await source.press("Enter");
  await source.pressSequentially("invalid syntax here");
  await source.press("Enter");
  await editor.getByRole("button", { name: "Diagnostics" }).click();
  await mock.getByRole("button", { name: "Diagnostics" }).click();
  await attachComparison(testInfo, "editor-expanded-diagnostics", mock, editor);

  await reference.close();
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

test("all six workspace tabs and source keyboard functions are operable", async ({
  page,
}) => {
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
  await page.waitForTimeout(300);
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
  expect(Math.abs(stageBox!.y + stageBox!.height - statusBox!.y)).toBeLessThan(
    2,
  );
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
    editor.getByText("Properties are derived from canonical source."),
  ).toBeVisible();
});

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
    .locator(".keybinding-list > div")
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
  await source.press(quickAddShortcut);
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
  await expect(editor.locator(".editor-diagnostics-summary")).toContainText(
    "No included diagnostics.",
  );
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
  await editor.getByRole("button", { name: "Introduction" }).click();
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
  await page.waitForTimeout(700);
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

test("Asset add, validation, removal, and package history use the secure boundary", async ({
  page,
}) => {
  const editor = await openCreatedEditor(page);
  const png = PNG.sync.write(new PNG({ width: 1, height: 1 }));
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
  await expect(
    editor.getByRole("button", { name: "assets/pixel.png" }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "assets/pixel.png" }).click();
  await expect(
    editor.getByRole("heading", { name: "assets/pixel.png" }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Remove asset" }).click();
  await expect(
    editor.getByRole("button", { name: "assets/pixel.png" }),
  ).toHaveCount(0);
  await editor.getByRole("button", { name: "Undo" }).click();
  await expect(
    editor.getByRole("button", { name: "assets/pixel.png" }),
  ).toBeVisible();

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
  await expect(
    editor.getByRole("button", { name: "assets/forged.png" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "That asset is unsafe, unsupported, or over the effective limit.",
    ),
  ).toBeVisible();
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

  await editor.getByRole("button", { name: "Introduction" }).click();
  await editor.getByRole("button", { name: "+ Text" }).click();
  await editor.getByPlaceholder("Search content").fill("new_text");
  await editor.getByRole("button", { name: /new_text text/ }).click();
  await editor
    .getByRole("textbox", { name: "content", exact: true })
    .fill("First line\nSecond line");
  await editor
    .getByRole("button", { name: "+ Add conditional variant" })
    .click();
  const variant = editor.locator(".editor-conditional-variants > div").first();
  await variant.getByLabel("When").fill("actor.level > 2");
  await variant.getByLabel("Value").fill("Advanced line");

  await editor.getByRole("tab", { name: "Source" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await source.press(
    process.platform === "darwin" ? "Meta+End" : "Control+End",
  );
  await expect(source).toContainText("initial: 25");
  await editor.getByRole("button", { name: "Find", exact: true }).click();
  for (const query of [
    "First line",
    "Second line",
    "content when actor.level > 2",
  ]) {
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

test("contrasting accent projects through Editor hub, workspace, import review, and Developer limits", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "One retained visual set is sufficient.",
  );
  await page.goto("/settings");
  await page.locator("#accent").evaluate((element) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "#2f7bdc");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "Close Settings" }).click();
  await page.getByRole("button", { name: "Open Editor" }).click();
  await testInfo.attach("editor-hub-custom-accent-dark", {
    body: await page.locator(".editor-hub-content").screenshot(),
    contentType: "image/png",
  });
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
  await testInfo.attach("editor-workspace-custom-accent-dark", {
    body: await page.locator(".production-editor").screenshot(),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Developer" }).click();
  await page.getByLabel("Use custom package limits").click();
  await page.getByRole("button", { name: "I understand, enable" }).click();
  await testInfo.attach("developer-package-limits-custom-accent-dark", {
    body: await page.locator(".app-settings-surface").screenshot(),
    contentType: "image/png",
  });
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
  await testInfo.attach("editor-delete-confirmation-custom-accent-dark", {
    body: await deleteConfirmation.screenshot(),
    contentType: "image/png",
  });
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
  await testInfo.attach("editor-import-warning-custom-accent-dark", {
    body: await review.screenshot(),
    contentType: "image/png",
  });
  const warningBorder = await review
    .locator(".package-review-risk")
    .evaluate((element) => getComputedStyle(element).borderColor);
  expect(warningBorder).not.toBe("rgb(47, 123, 220)");
  await review.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "General" }).click();
  await page.locator("#theme").selectOption("light");
  await page.getByRole("button", { name: "Close Settings" }).click();
  await testInfo.attach("editor-hub-custom-accent-light", {
    body: await page.locator(".editor-hub-content").screenshot(),
    contentType: "image/png",
  });
});

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}

function oversizedValidPng() {
  const base = PNG.sync.write(new PNG({ width: 1, height: 1 }));
  const payload = new Uint8Array(17 * 1024 * 1024);
  let random = 0x12345678;
  for (let index = 0; index < payload.length; index += 1) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    payload[index] = random & 0xff;
  }
  const type = new TextEncoder().encode("juMp");
  const chunk = new Uint8Array(12 + payload.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  chunk.set(type, 4);
  chunk.set(payload, 8);
  const crcInput = new Uint8Array(type.length + payload.length);
  crcInput.set(type);
  crcInput.set(payload, type.length);
  view.setUint32(8 + payload.length, crc32(crcInput));
  const output = new Uint8Array(base.length + chunk.length);
  output.set(base.subarray(0, 33));
  output.set(chunk, 33);
  output.set(base.subarray(33), 33 + chunk.length);
  return output;
}

test("an oversized package is blocked by defaults and admitted only by a confirmed byte override", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Large boundary fixture runs once.",
  );
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
    src: "assets/large.png"
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
});
