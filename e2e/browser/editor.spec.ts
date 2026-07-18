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

test("Editor hub project cards stay compact without mangling their content", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1117, height: 850 });
  await openCreatedEditor(page);
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
  await expect(description).toContainText("An untitled Jump.");
  await expect(description).toHaveCSS("font-weight", "400");
  await expect(description).toHaveCSS("text-transform", "none");
  await expect(description).toHaveAttribute("title", "An untitled Jump.");
  await description.hover();
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

  await editor.getByRole("tab", { name: "Source" }).click();
  await mock.getByRole("tab", { name: "Source" }).click();
  await attachComparison(testInfo, "editor-source-collapsed", mock, editor);
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
  await source.fill(`${await source.inputValue()}\ninvalid syntax here\n`);
  await editor.getByRole("button", { name: "Diagnostics" }).click();
  await mock.getByRole("button", { name: "Diagnostics" }).click();
  await attachComparison(testInfo, "editor-expanded-diagnostics", mock, editor);

  await reference.close();
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

  const description = editor.locator(
    ".editor-form-card label:has-text('Description') textarea",
  );
  await expect(description).toHaveValue("An untitled Jump.");
  await description.fill("A library-ready premise authored at Jump level.");
  await expect(editor.locator(".editor-real-preview")).toContainText(
    "A library-ready premise authored at Jump level.",
  );

  await editor.getByRole("tab", { name: "Files" }).click();
  await editor.getByRole("button", { name: "jump.jdef" }).click();
  const source = editor.getByLabel("jump.jdef source");
  await expect(source).toHaveValue(
    /description: "A library-ready premise authored at Jump level\."/,
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
  await expect(editor.getByText("Replace all")).toBeVisible();
  await source.press("Escape");
  await source.press(
    process.platform === "darwin" ? "Meta+Enter" : "Control+Enter",
  );
  await expect(
    editor.getByRole("complementary", { name: "Quick add" }),
  ).toBeVisible();
  await editor.getByLabel("Close Quick Add").click();
  await source.press(process.platform === "darwin" ? "Meta+ " : "Control+ ");
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
