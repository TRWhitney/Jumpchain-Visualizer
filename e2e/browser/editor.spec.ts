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
  animations: "allow" | "disabled" = "disabled",
) {
  const bytes = await production.screenshot({ animations });
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
  await attachComparison(testInfo, "editor-layout-bounds-hover", mock, editor);
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
  await attachComparison(testInfo, "editor-expanded-diagnostics", mock, editor);

  await reference.close();
});

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
  await page.waitForTimeout(800);
  await attachProductionState(
    testInfo,
    "editor-sidebar-overflow-title-corrected",
    editor.locator(".editor-explorer"),
  );
  await expect(shortEntry).not.toHaveAttribute("title");
  await expect(longEntry).toHaveAttribute("title", longLabel);
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
  await editor.screenshot({
    path: "artifacts/editor-visual/editor-structured-handle-collision-corrected.png",
  });
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
    "allow",
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
      size: lg`
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
      target: portrait${sharedPresentation}
      size: md
      fit: cover
`,
    "complete_leaf_presentation",
  );
  for (const kind of ["slot", "text", "input", "image"]) {
    const leaf = preview.locator(`[data-layout-kind="${kind}"]`);
    await expect(leaf).toHaveCSS("padding", "8px");
    await expect(leaf).toHaveCSS("background-color", "rgb(18, 52, 86)");
    await expect(leaf).toHaveCSS("justify-self", "end");
    await expect(leaf).toHaveCSS("text-align", "center");
    await expect(leaf).toHaveCSS("font-size", "14.4px");
    await expect(leaf).toHaveCSS("color", "rgb(255, 255, 255)");
  }
  const presentedImage = preview.locator('[data-layout-kind="image"]');
  await expect(presentedImage).toHaveCSS("width", "80px");
  await expect(presentedImage).toHaveCSS("height", "80px");
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
    editor.getByText(
      "Properties describe the current selection and are read-only.",
    ),
  ).toBeVisible();
  await expect(
    editor.getByText("Definition file", { exact: true }),
  ).toBeVisible();
  await expect(editor.getByText("Authors", { exact: true })).toHaveCount(0);
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
}, testInfo) => {
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
  await expect(editor.getByRole("tab", { name: "Source" })).toHaveCount(0);
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
  await expect(properties).toContainText("References");
  await expect(properties).not.toContainText("Authors");
  await expect(properties.getByRole("button")).toHaveCount(0);
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
  const binaryImage = editor.locator(".editor-asset-source-panel img");
  await expect(binaryImage).toBeVisible();
  await expect
    .poll(() => binaryImage.evaluate((node) => node.naturalWidth))
    .toBe(80);
  await expect(editor.locator(".editor-real-preview")).toBeVisible();
  await expect(editor.locator(".editor-asset-preview-panel")).toHaveCount(0);
  await attachProductionState(
    testInfo,
    "editor-asset-files-binary-source-corrected",
    editor,
  );

  await editor.getByRole("tab", { name: "Content" }).click();
  await editor.getByRole("button", { name: "Remove asset" }).click();
  const removal = editor.getByRole("dialog", {
    name: "Remove art/icons/hero.png?",
  });
  await expect(removal).toContainText("referenced by 1 image block");
  await removal.getByRole("button", { name: "Cancel" }).click();
  await expect(editor.getByRole("button", { name: "hero.png" })).toBeVisible();
  await editor.getByRole("button", { name: "Remove asset" }).click();
  await editor
    .getByRole("dialog", { name: "Remove art/icons/hero.png?" })
    .getByRole("button", { name: "Remove asset" })
    .click();
  await expect(editor.getByRole("button", { name: "hero.png" })).toHaveCount(0);
  await editor.getByRole("button", { name: "Undo" }).click();
  await expect(editor.getByRole("button", { name: "hero.png" })).toBeVisible();

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
  await expect(
    page.getByText(
      "That asset is unsafe, unsupported, or over the effective limit.",
    ),
  ).toBeVisible();
});

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
  await page.waitForTimeout(150);

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
}) => {
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
  await editor.screenshot({
    path: "artifacts/editor-visual/editor-section-text-preview-corrected.png",
  });
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
  await editor.screenshot({
    path: "artifacts/editor-visual/editor-section-image-preview-corrected.png",
  });

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
  await editor.screenshot({
    path: "artifacts/editor-visual/editor-section-direct-choice-preview-corrected.png",
  });

  await openSection();
  await editor
    .getByRole("button", { name: "available choice source", exact: true })
    .click();
  await expect(
    preview.getByText("Alpha Choice", { exact: true }),
  ).toBeVisible();
  await expect(preview.getByText("Beta Choice", { exact: true })).toBeVisible();
  await editor.screenshot({
    path: "artifacts/editor-visual/editor-section-choice-source-preview-corrected.png",
  });
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

test("Source-authored choice and trait layouts remain completely editable in Structured", async ({
  page,
}, testInfo) => {
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
  await expect(builder.locator('[data-layout-node-kind="input"]')).toHaveCount(
    1,
  );
  await attachProductionState(
    testInfo,
    "editor-layout-complete-choice-production",
    editor,
  );
  const imageRow = builder.locator('[data-layout-node-kind="image"]');
  await imageRow
    .getByRole("button", { name: "Edit Image presentation fields" })
    .click();
  await expect(imageRow.getByLabel("width", { exact: true })).toHaveValue("xl");
  await expect(imageRow.getByLabel("height", { exact: true })).toHaveValue(
    "lg",
  );
  await imageRow.getByLabel("size", { exact: true }).selectOption("md");
  await expect(imageRow.getByLabel("width", { exact: true })).toHaveValue("");
  await expect(imageRow.getByLabel("height", { exact: true })).toHaveValue("");
  await attachProductionState(
    testInfo,
    "editor-layout-choice-image-presentation-production",
    editor,
  );
  const imagePresentationButton = imageRow.getByRole("button", {
    name: "Edit Image presentation fields",
  });
  await imagePresentationButton.click();
  await expect(imageRow.locator(".editor-layout-row-node-fields")).toHaveCount(
    0,
  );
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
  await expect(imageRow.getByLabel("size", { exact: true })).toHaveValue("md");
  await imagePresentationButton.click();
  await expect(imageRow.locator(".editor-layout-row-node-fields")).toHaveCount(
    0,
  );

  await builder.getByLabel("Flow").selectOption("stack");
  await expect(builder.getByLabel("columns", { exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "0 errors" })).toBeVisible();
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
  await expect(builder.locator(".editor-layout-invalid-fields")).toContainText(
    "Unknown field “handle” on stack.",
  );
  await attachProductionState(
    testInfo,
    "editor-layout-needs-attention-production",
    editor,
  );
  await builder
    .locator(".editor-layout-invalid-fields")
    .getByRole("button", { name: "Remove invalid field" })
    .click();
  await expect(builder.locator(".editor-layout-invalid-fields")).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "0 errors" })).toBeVisible();
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
  await expect(builder.locator('[data-layout-node-kind="image"]')).toHaveCount(
    1,
  );
  await expect(builder.locator('[data-layout-node-kind="rule"]')).toHaveCount(
    1,
  );
  await attachProductionState(
    testInfo,
    "editor-layout-complete-trait-production",
    editor,
  );
});

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
  await expect(traitImage).toHaveCSS("width", "48px");
  await expect(traitImage).toHaveCSS("height", "48px");
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
});
