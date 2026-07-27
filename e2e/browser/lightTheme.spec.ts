import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "./support/fixtures";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  captureReviewScreenshot,
  shouldCaptureReviewArtifacts,
} from "./support/reviewArtifacts";
import { waitForStoredSetting } from "./support/storedSettings";

test.describe.configure({ timeout: 120_000 });

const artifactDirectory = join(process.cwd(), "artifacts", "light-theme");

async function dismissTransientToasts(page: Page) {
  const visibleDismissButtons = page.locator(".app-toast-dismiss:visible");
  while ((await visibleDismissButtons.count()) > 0) {
    await visibleDismissButtons.first().click();
  }
  await expect(page.locator(".app-toast-host .app-toast")).toHaveCount(0);
}

async function retainScreenshot(
  testInfo: TestInfo,
  name: string,
  target: Page | Locator,
  clearToasts = true,
) {
  if (!shouldCaptureReviewArtifacts(testInfo)) return;
  const page = "page" in target ? target.page() : target;
  if (clearToasts) await dismissTransientToasts(page);
  const body = await captureReviewScreenshot(target);
  await testInfo.attach(name, { body, contentType: "image/png" });
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(join(artifactDirectory, `${name}.png`), body);
}

async function setAppearance(
  page: Page,
  theme: "light" | "dark",
  accent?: string,
) {
  await page.goto("/settings");
  await page.locator("#theme").selectOption(theme);
  if (accent) {
    await page.locator("#accent").evaluate((element, value) => {
      const input = element as HTMLInputElement;
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, accent);
  }
  await page.getByRole("tab", { name: "Developer" }).click();
  await page.getByLabel("Show mock fixtures").check();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
  await waitForStoredSetting(page, ["appearance", "theme"], theme);
  await page.getByRole("button", { name: "Close Settings" }).click();
  await dismissTransientToasts(page);
}

async function resumeMorgan(page: Page) {
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  return page.getByLabel("Interactive Chain Tracker workspace");
}

const rgb = (value: string) =>
  value
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map(Number);

const luminance = (value: number[]) =>
  value
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );

const contrast = (first: string, second: string) => {
  const values = [luminance(rgb(first)), luminance(rgb(second))];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

async function expectTextContrast(
  foreground: Locator,
  background: Locator,
  minimum = 4.5,
) {
  const [color, backgroundColor] = await Promise.all([
    foreground.evaluate((element) => getComputedStyle(element).color),
    background.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(contrast(color, backgroundColor)).toBeGreaterThanOrEqual(minimum);
}

function exactPixelCount(image: PNG, color: readonly [number, number, number]) {
  let count = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    if (
      image.data[index] === color[0] &&
      image.data[index + 1] === color[1] &&
      image.data[index + 2] === color[2] &&
      image.data[index + 3] === 255
    )
      count += 1;
  }
  return count;
}

test(
  "light shell, hubs, searches, saved cards, Delete controls, and confirmations",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light");

    const html = page.locator("html");
    await expect(html).toHaveCSS("color-scheme", "light");
    await expect(page.locator(".app-mock-header")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(page.locator(".app-entry-grid article").first()).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(testInfo, "home-light", page);

    const resume = page
      .getByRole("region", { name: "Chains" })
      .getByRole("button", { name: "Resume" });
    await resume.hover();
    await expectTextContrast(resume, resume);
    await expect(resume).not.toHaveCSS("background-color", "rgb(37, 37, 35)");
    await retainScreenshot(testInfo, "home-resume-hover-light", resume, false);

    await page.getByRole("button", { name: "Open Editor" }).click();
    await page.getByRole("button", { name: "Create Project" }).click();
    await page.getByRole("button", { name: "Editor", exact: true }).click();
    const editorSearch = page.getByLabel("Search saved projects");
    await expect(editorSearch).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(page.locator(".editor-create-callout")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(testInfo, "editor-hub-light", page);

    const projectCard = page.locator(".editor-project-card").first();
    const projectDelete = projectCard.getByRole("button", {
      name: "Delete Untitled Jump",
    });
    await expect(projectDelete).toHaveCSS("color", "rgb(159, 41, 50)");
    await expect(projectDelete).toHaveCSS("border-color", "rgb(184, 60, 69)");
    await expectTextContrast(projectDelete, projectCard);
    await projectDelete.click();
    const projectConfirmation = page.getByRole("alertdialog", {
      name: "Delete Untitled Jump?",
    });
    await expect(projectConfirmation).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(testInfo, "editor-delete-dialog-light", page);
    await projectConfirmation.getByRole("button", { name: "Cancel" }).click();

    await page
      .getByRole("button", { name: "Chain Tracker", exact: true })
      .click();
    const chainSearch = page.getByLabel("Search saved chains");
    await expect(chainSearch).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    const chainHeading = page.getByRole("heading", {
      name: "All saved chains",
    });
    await expectTextContrast(
      chainHeading,
      page.locator(".app-chain-hub-route"),
    );
    await retainScreenshot(testInfo, "chain-hub-light", page);

    const chainCard = page
      .locator(".app-chain-hub-route .app-chain-card")
      .first();
    const chainDelete = chainCard.getByRole("button", {
      name: "Delete Morgan",
    });
    await expect(chainDelete).toHaveCSS("color", "rgb(159, 41, 50)");
    await expect(chainDelete).toHaveCSS("border-color", "rgb(184, 60, 69)");
    await chainDelete.click();
    const chainConfirmation = page.getByRole("alertdialog", {
      name: "Delete Morgan?",
    });
    await expect(chainConfirmation).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(testInfo, "chain-delete-dialog-light", page);
  },
);

test(
  "welcome-tour branch and interface icons retain light surfaces",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await setAppearance(page, "light");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "General" }).click();
    await page.getByRole("button", { name: "Restart welcome tour" }).click();
    await page.getByRole("button", { name: "Start tour" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const branchIcons = page.locator(".welcome-tour-branch-icon");
    await expect(branchIcons).toHaveCount(2);
    for (const icon of await branchIcons.all()) {
      await expect(icon).not.toHaveCSS("background-color", "rgb(41, 42, 46)");
      await expectTextContrast(icon, icon);
    }
    await retainScreenshot(
      testInfo,
      "welcome-tour-branch-icons-light",
      page.getByRole("dialog"),
      false,
    );

    await page.getByRole("button", { name: "Exit tour" }).click();
    const modeIcons = page.locator(".welcome-tour-mode-grid > button > span");
    await expect(modeIcons).toHaveCount(2);
    for (const icon of await modeIcons.all()) {
      await expect(icon).not.toHaveCSS("background-color", "rgb(41, 42, 46)");
      await expectTextContrast(icon, icon);
    }
    await retainScreenshot(
      testInfo,
      "welcome-tour-mode-icons-light",
      page.getByRole("dialog"),
      false,
    );
  },
);

test(
  "light Editor source, Properties, scrollbars, and diagnostics hover states",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light");
    await page.getByRole("button", { name: "Open Editor" }).click();
    await page.getByRole("button", { name: "Create Project" }).click();
    const editor = page.locator(".production-editor");
    await editor.getByRole("tab", { name: "Source" }).click();
    const source = editor.getByLabel("jump.jdef source");
    await expect(editor.locator(".cm-editor")).toHaveCSS(
      "background-color",
      "rgb(236, 234, 228)",
    );
    await expect(editor.locator(".cm-gutters")).toHaveCSS(
      "background-color",
      "rgb(222, 219, 210)",
    );
    const scrollerStyle = await editor
      .locator(".cm-scroller")
      .evaluate((element) => ({
        colorScheme: getComputedStyle(element).colorScheme,
        scrollbarColor: getComputedStyle(element).scrollbarColor,
      }));
    expect(scrollerStyle.colorScheme).toBe("light");
    expect(scrollerStyle.scrollbarColor).not.toBe("auto");
    await retainScreenshot(testInfo, "editor-source-light", editor);

    await source.press("Control+End");
    await source.press("Enter");
    await source.pressSequentially("invalid syntax here");
    await source.press("Enter");
    await expect(editor.locator(".cm-lint-marker-error")).toBeVisible();

    const diagnostics = editor.locator(".editor-diagnostics");
    await diagnostics.getByRole("button", { name: "Diagnostics" }).hover();
    await retainScreenshot(
      testInfo,
      "editor-diagnostics-toggle-hover-light",
      editor,
    );
    for (const severity of ["error", "warning", "info"] as const) {
      const control = diagnostics.locator(
        `.editor-diagnostic-filters .is-${severity}`,
      );
      await control.hover();
      await expect(control).toHaveCSS("background-color", "rgb(220, 217, 209)");
      await retainScreenshot(
        testInfo,
        `editor-diagnostics-${severity}-hover-light`,
        diagnostics,
      );
    }
    await diagnostics.getByRole("button", { name: "Diagnostics" }).click();
    await expect(diagnostics.locator(".editor-diagnostics-details")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(
      testInfo,
      "editor-diagnostics-expanded-light",
      editor,
    );

    await editor.getByRole("tab", { name: "Preview" }).click();
    await editor.getByRole("tab", { name: "Properties" }).click();
    const propertyHint = editor.locator(".editor-property-note");
    await expect(propertyHint).toContainText(
      "Properties describe the current selection and are read-only.",
    );
    await expect(propertyHint).toHaveCSS(
      "background-color",
      "rgb(236, 234, 228)",
    );
    await expectTextContrast(propertyHint, propertyHint);
    await retainScreenshot(testInfo, "editor-properties-hint-light", editor);
  },
);

test(
  "authored section text color is identical in light and dark Editor previews",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await setAppearance(page, "light");
    await page.getByRole("button", { name: "Open Editor" }).click();
    await page.getByRole("button", { name: "Create Project" }).click();
    const editor = page.locator(".production-editor");

    await editor.getByRole("button", { name: "Add", exact: true }).click();
    await editor
      .getByRole("button", { name: "Section layout", exact: true })
      .click();
    await editor.getByRole("tab", { name: "Source" }).click();
    const source = editor.getByLabel("layout.jdef source");
    await source.press("Control+a");
    await page.keyboard.insertText(`theme
  handle: primary
  color: "#7D91AA"

theme
  handle: text
  color: "#383333"

section-layout
  handle: introduction_layout

  stack
    gap: md
    background: primary
    text-color: text

    text: welcome
    text: asdf
`);
    await editor
      .getByRole("button", { name: /^introduction_layout section$/ })
      .click();
    await expect(editor.locator(".editor-save-state")).toHaveText("Saved");

    const preview = editor.locator(".editor-real-preview");
    const stack = preview.locator('[data-layout-kind="stack"]').first();
    const paragraphs = stack.locator(".jump-layout-text");
    const authoredText = "rgb(56, 51, 51)";
    const authoredBackground = "rgb(125, 145, 170)";
    await expect(stack).toHaveCSS("color", authoredText);
    await expect(stack).toHaveCSS("background-color", authoredBackground);
    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.first()).toHaveCSS("color", authoredText);
    await expect(paragraphs.last()).toHaveCSS("color", authoredText);
    await retainScreenshot(
      testInfo,
      "editor-authored-section-text-light",
      stack,
    );
    const lightScreenshot = await stack.screenshot({ animations: "disabled" });
    const lightImage = PNG.sync.read(lightScreenshot);
    expect(exactPixelCount(lightImage, [56, 51, 51])).toBeGreaterThan(0);
    expect(exactPixelCount(lightImage, [104, 104, 97])).toBe(0);

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "General" }).click();
    await page.locator("#theme").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-theme",
      "dark",
    );
    await page.getByRole("button", { name: "Close Settings" }).click();
    await expect(editor).toBeVisible();
    await expect(stack).toHaveCSS("color", authoredText);
    await expect(stack).toHaveCSS("background-color", authoredBackground);
    await expect(paragraphs.first()).toHaveCSS("color", authoredText);
    await expect(paragraphs.last()).toHaveCSS("color", authoredText);
    await retainScreenshot(
      testInfo,
      "editor-authored-section-text-dark",
      stack,
    );
    const darkScreenshot = await stack.screenshot({ animations: "disabled" });
    const darkImage = PNG.sync.read(darkScreenshot);
    expect(exactPixelCount(darkImage, [56, 51, 51])).toBeGreaterThan(0);
    expect(exactPixelCount(darkImage, [104, 104, 97])).toBe(0);
    expect(darkImage.width).toBe(lightImage.width);
    expect(darkImage.height).toBe(lightImage.height);
    const difference = new PNG({
      width: lightImage.width,
      height: lightImage.height,
    });
    expect(
      pixelmatch(
        lightImage.data,
        darkImage.data,
        difference.data,
        lightImage.width,
        lightImage.height,
        { includeAA: true, threshold: 0 },
      ),
    ).toBe(0);
  },
);

test(
  "light Earth and Editor inspection surfaces use the application visual system",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light");
    const tracker = await resumeMorgan(page);
    await tracker.getByRole("button", { name: /^Earth/ }).click();
    const earth = tracker.locator(".earth-jump-renderer");
    const identityCard = earth.locator(".control-specimen").first();
    await expect(earth).toHaveCSS("background-color", "rgb(236, 234, 228)");
    await expect(earth).toHaveCSS("border-radius", "6.4px");
    await expect(earth).toHaveCSS("color-scheme", "light");
    await expect(identityCard).toHaveCSS(
      "background-color",
      "rgb(243, 241, 235)",
    );
    await expect(identityCard).toHaveCSS("border-radius", "6.4px");
    await expect(tracker.getByLabel("Earth gender")).toHaveCSS(
      "background-repeat",
      "no-repeat",
    );
    await retainScreenshot(testInfo, "tracker-earth-light", earth);

    await page.getByRole("button", { name: "Editor", exact: true }).click();
    await page.getByRole("button", { name: "Create Project" }).click();
    const editor = page.locator(".production-editor");
    await editor
      .getByRole("button", { name: "Jump appearance", exact: true })
      .click();
    const appearanceGroup = editor.locator(".editor-appearance-group").first();
    await expect(appearanceGroup).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(appearanceGroup).toHaveCSS("border-radius", "0px");
    await expect(appearanceGroup).toHaveCSS("border-left-width", "0px");
    await expect(appearanceGroup).toHaveCSS("border-bottom-width", "1px");
    await editor.getByLabel("Inspect colors").check();
    const inspectionLegend = editor.locator(".editor-appearance-color-legend");
    await expect(inspectionLegend).toHaveCSS(
      "background-color",
      "rgb(236, 234, 228)",
    );
    await retainScreenshot(
      testInfo,
      "editor-jump-appearance-inspect-light",
      editor,
    );

    await editor.getByRole("button", { name: "Add", exact: true }).click();
    await editor
      .getByRole("button", { name: "Choice layout", exact: true })
      .click();
    await editor.getByLabel("Show bounds").check();
    const boundsLegend = editor.locator(".editor-bounds-legend");
    await expect(boundsLegend).toHaveCSS(
      "background-color",
      "rgb(236, 234, 228)",
    );
    await expect(boundsLegend.locator(".is-container")).toHaveCSS(
      "color",
      "rgb(0, 103, 140)",
    );
    await retainScreenshot(testInfo, "editor-show-bounds-light", editor);
  },
);

test(
  "light Editor structured, layout, sidebar, and asset states stay coherent",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light");
    await page.getByRole("button", { name: "Open Editor" }).click();
    await page.getByRole("button", { name: "Create Project" }).click();
    const editor = page.locator(".production-editor");
    const outline = editor.locator(".editor-outline-scroll");

    await outline
      .getByRole("button", { name: "introduction", exact: true })
      .click();
    await editor.getByRole("button", { name: "+ Text" }).click();
    await outline
      .getByRole("button", { name: "introduction", exact: true })
      .click();
    const contentTile = editor.locator(".editor-child-list > div").last();
    await expect(contentTile).toHaveCSS(
      "background-color",
      "rgb(236, 234, 228)",
    );
    await expect(contentTile.getByRole("button").first()).toHaveCSS(
      "color",
      "rgb(52, 52, 48)",
    );
    await expect(editor.locator(".editor-form-card").first()).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await retainScreenshot(testInfo, "editor-content-tiles-light", editor);

    await contentTile.getByRole("button").first().click();
    await editor
      .getByRole("button", { name: "+ Add conditional variant" })
      .click();
    const variants = editor.locator(".editor-conditional-variants");
    await expect(variants).toHaveCSS("background-color", "rgb(236, 234, 228)");
    await expect(variants.locator(".editor-condition-draft")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(
      testInfo,
      "editor-conditional-variants-light",
      editor,
    );
    await editor.getByRole("button", { name: "Cancel draft" }).click();

    await editor.getByRole("button", { name: "Add", exact: true }).click();
    await editor
      .getByRole("button", { name: "Choice layout", exact: true })
      .click();
    const activeLayoutBreadcrumb = editor.locator(
      '.editor-layout-breadcrumb button[aria-current="page"]',
    );
    await expect(activeLayoutBreadcrumb).toHaveCSS("color", "rgb(23, 23, 23)");
    await expect(activeLayoutBreadcrumb).not.toHaveCSS(
      "background-color",
      "rgb(56, 56, 52)",
    );
    await retainScreenshot(testInfo, "editor-layout-stack-light", editor);

    const sectionsHeader = editor.locator(
      'details[data-explorer-group="content:sections"] > summary',
    );
    await sectionsHeader.click({ button: "right" });
    const sidebarMenu = page.getByRole("menu", {
      name: "Sidebar group actions",
    });
    await expect(sidebarMenu).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(sidebarMenu).toHaveCSS("color", "rgb(52, 52, 48)");
    await retainScreenshot(
      testInfo,
      "editor-sidebar-context-menu-light",
      editor,
    );
    await page.keyboard.press("Escape");

    const introductionItem = outline.getByRole("button", {
      name: "introduction",
      exact: true,
    });
    await introductionItem.click({ button: "right" });
    const sidebarItemMenu = page.getByRole("menu", {
      name: "Sidebar item actions",
    });
    await expect(sidebarItemMenu).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(
      sidebarItemMenu.getByRole("menuitem", { name: "Delete" }),
    ).toHaveCSS("color", "rgb(159, 41, 50)");
    await retainScreenshot(
      testInfo,
      "editor-sidebar-item-context-menu-light",
      editor,
    );
    await page.keyboard.press("Escape");

    const addAsset = async (file: string, name: RegExp) => {
      await editor.getByRole("button", { name: "Add", exact: true }).click();
      const chooserPromise = page.waitForEvent("filechooser");
      await editor.getByRole("button", { name: "Asset…" }).click();
      await (await chooserPromise).setFiles(join(process.cwd(), file));
      const asset = editor.getByRole("button", { name });
      await expect(asset).toBeVisible();
      await asset.click();
      await editor
        .getByRole("tablist", { name: "Editing view" })
        .getByRole("tab", { name: "Source" })
        .click();
    };

    await addAsset("src-tauri/icons/128x128.png", /^128x128\.png/);
    const paint = editor.getByRole("button", { name: "Paint", exact: true });
    const fit = editor.getByRole("button", { name: "Fit", exact: true });
    const inspector = editor.getByRole("button", {
      name: "Inspector",
      exact: true,
    });
    await paint.click();
    await expect(paint).toHaveAttribute("aria-pressed", "true");
    await expect(inspector).toHaveAttribute("aria-pressed", "true");
    const [paintBackground, fitBackground, inspectorBackground] =
      await Promise.all(
        [paint, fit, inspector].map((control) =>
          control.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        ),
      );
    expect(paintBackground).not.toBe(fitBackground);
    expect(inspectorBackground).not.toBe(fitBackground);
    await retainScreenshot(testInfo, "editor-raster-controls-light", editor);

    await page.setViewportSize({ width: 820, height: 760 });
    const rasterToolrail = editor.locator(".asset-raster-toolrail");
    const toolrailOverflow = await rasterToolrail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
    expect(toolrailOverflow.scrollWidth).toBeLessThanOrEqual(
      toolrailOverflow.clientWidth,
    );
    expect(toolrailOverflow.overflowX).toBe("hidden");
    await retainScreenshot(
      testInfo,
      "editor-raster-toolrail-narrow-light",
      editor,
    );
    await page.setViewportSize({ width: 1600, height: 1000 });

    await addAsset("public/assets/threshold-mark.svg", /^threshold-mark\.svg/);
    const svgDiagnostics = editor.locator(".asset-editor-diagnostics");
    await expect(svgDiagnostics).toHaveText("No SVG diagnostics.");
    await expect(svgDiagnostics).toHaveCSS(
      "background-color",
      "rgb(231, 239, 229)",
    );
    await expect(svgDiagnostics).toHaveCSS("color", "rgb(55, 99, 59)");
    await retainScreenshot(testInfo, "editor-svg-diagnostics-light", editor);
  },
);

test(
  "light Chain Tracker inventory, forms, companions, and their dialogs",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light");
    const tracker = await resumeMorgan(page);
    await expect(page.locator(".app-mock-header")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(tracker.locator(".chain-main-tabs")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(testInfo, "tracker-chain-and-jump-light", page);

    await tracker.getByRole("tab", { name: /^Inventory/ }).click();
    await expect(tracker.getByLabel("Search inventory")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(testInfo, "tracker-inventory-search-light", page);
    await tracker.getByRole("tab", { name: "Stats" }).click();
    await retainScreenshot(testInfo, "tracker-inventory-stats-light", page);
    await tracker.getByRole("tab", { name: "Search" }).click();
    await tracker.locator(".chain-record-list article").first().click();
    const recordDialog = page.getByRole("dialog", {
      name: /(?:perk|item) details:/i,
    });
    await expect(recordDialog).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(
      testInfo,
      "tracker-inventory-record-dialog-light",
      page,
    );
    await page
      .getByRole("button", { name: "Close perk or item details" })
      .click();

    await tracker.getByRole("tab", { name: /^Forms/ }).click();
    await retainScreenshot(testInfo, "tracker-forms-light", page);
    await tracker
      .locator(".chain-form-grid article")
      .filter({ hasText: "Prism Form" })
      .getByRole("button", { name: "View" })
      .click();
    await retainScreenshot(testInfo, "tracker-form-detail-light", page);
    await tracker.getByRole("button", { name: "Full details" }).click();
    const formDialog = page.getByRole("dialog", {
      name: "Form details: Prism Form",
    });
    await expect(formDialog).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(testInfo, "tracker-form-dialog-light", page);
    await page.getByRole("button", { name: "Close form details" }).click();

    await tracker.getByRole("tab", { name: /^Companions/ }).click();
    await retainScreenshot(testInfo, "tracker-companions-light", page);
    await tracker
      .locator(".chain-companion-grid article")
      .filter({ hasText: "Lyra" })
      .getByRole("button", { name: "View" })
      .click();
    await retainScreenshot(testInfo, "tracker-companion-detail-light", page);
    await tracker.getByRole("button", { name: "Full profile" }).click();
    const companionDialog = page.getByRole("dialog", {
      name: "Companion profile: Lyra",
    });
    await expect(companionDialog).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await retainScreenshot(testInfo, "tracker-companion-dialog-light", page);
  },
);

test(
  "light supplement pages and contextual tools retain scoped module palettes",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light", "#2f7bdc");
    const tracker = await resumeMorgan(page);
    await tracker.getByRole("tab", { name: /^Supplements/ }).click();
    await retainScreenshot(testInfo, "tracker-supplements-manage-light", page);

    const openModule = async (name: string, slug: string) => {
      await tracker.getByRole("tab", { name: "Manage" }).click();
      const row = tracker
        .locator(".supplement-manage-list article")
        .filter({ hasText: name });
      if (!(await row.getByRole("checkbox").isChecked()))
        await row.getByRole("checkbox").check();
      await row.getByRole("button", { name: "Open page" }).click();
      const modulePage = tracker.locator(
        ".review-module-page:not([hidden]) > [class$='-full-mock']",
      );
      await expect(modulePage).toHaveCSS(
        "background-color",
        "rgb(246, 245, 241)",
      );
      await retainScreenshot(
        testInfo,
        `tracker-supplement-${slug}-light`,
        page,
      );
    };

    await openModule("Classic Body Mod", "body-mod");
    await openModule("Essential Body Modification", "essential-body-mod");
    await openModule("Cosmic Warehouse", "cosmic-warehouse");
    await openModule("Personal Reality", "personal-reality");
    await openModule("Universal Drawbacks", "universal-drawbacks");
    await openModule("Quest Mode", "quest-mode");
    await openModule("Story", "story");

    await tracker.getByRole("tab", { name: "Chain & Jump" }).click();
    await tracker.getByRole("button", { name: /3\. The Last Trial/ }).click();
    await tracker.getByRole("button", { name: "Supp", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: /current-Jump supplements/,
    });
    const expectedLightAccent = await page
      .locator("html")
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--app-accent-text").trim(),
      );
    const accentProbe = await page.locator("html").evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.color =
        getComputedStyle(element).getPropertyValue("--app-accent-text");
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(expectedLightAccent).not.toBe("");
    await expect(dialog.locator(":scope > header p")).toHaveCSS(
      "color",
      accentProbe,
    );
    await expect(dialog.locator(".tracker-supp-jump-label")).toHaveCSS(
      "color",
      accentProbe,
    );
    await expect(dialog.locator("nav button[aria-pressed='true']")).toHaveCSS(
      "border-left-color",
      "rgb(47, 123, 220)",
    );
    await expect(dialog.locator(":scope > header")).toHaveCSS(
      "background-color",
      "rgb(243, 241, 235)",
    );
    await retainScreenshot(
      testInfo,
      "tracker-supp-context-custom-accent-light",
      page,
    );

    for (const [tool, slug] of [
      [/Essential Body Mod.*Progression/, "essential-progression"],
      [/Personal Reality.*At a glance/, "personal-reality"],
      [/Personal Reality.*Spend new points/, "personal-reality-progression"],
      [/Universal Drawbacks/, "universal-drawbacks"],
      [/Quest Mode/, "quest-mode"],
      [/Story/, "story"],
    ] as const) {
      await dialog.getByRole("button", { name: tool }).click();
      await expect(dialog.locator(".embedded-supplement-dialog")).toHaveCSS(
        "background-color",
        "rgb(246, 245, 241)",
      );
      await retainScreenshot(testInfo, `tracker-supp-tool-${slug}-light`, page);
    }
    await page.keyboard.press("Escape");

    await tracker.getByRole("tab", { name: /^Supplements/ }).click();
    await tracker.getByRole("tab", { name: "Manage" }).click();
    const warehouseRow = tracker
      .locator(".supplement-manage-list article")
      .filter({ hasText: "Cosmic Warehouse" });
    if (!(await warehouseRow.getByRole("checkbox").isChecked()))
      await warehouseRow.getByRole("checkbox").check();
    await tracker.getByRole("tab", { name: "Chain & Jump" }).click();
    await tracker.getByRole("button", { name: /3\. The Last Trial/ }).click();
    await tracker.getByRole("button", { name: "Supp", exact: true }).click();
    const warehouseDialog = page.getByRole("dialog", {
      name: /current-Jump supplements/,
    });
    await warehouseDialog
      .getByRole("button", { name: /Cosmic Warehouse/ })
      .click();
    await retainScreenshot(
      testInfo,
      "tracker-supp-tool-cosmic-warehouse-light",
      page,
    );
    await page.keyboard.press("Escape");

    await setAppearance(page, "dark", "#2f7bdc");
    const darkTracker = await resumeMorgan(page);
    await darkTracker
      .getByRole("button", { name: /3\. The Last Trial/ })
      .click();
    await darkTracker
      .getByRole("button", { name: "Supp", exact: true })
      .click();
    const darkDialog = page.getByRole("dialog", {
      name: /current-Jump supplements/,
    });
    const darkAccentProbe = await page.locator("html").evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.color =
        getComputedStyle(element).getPropertyValue("--app-accent-text");
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(darkDialog.locator(":scope > header p")).toHaveCSS(
      "color",
      darkAccentProbe,
    );
    await expect(darkDialog.locator(".tracker-supp-jump-label")).toHaveCSS(
      "color",
      darkAccentProbe,
    );
    await expect(
      darkDialog.locator("nav button[aria-pressed='true']"),
    ).toHaveCSS("border-left-color", "rgb(47, 123, 220)");
    await expect(darkDialog.locator(":scope > header")).toHaveCSS(
      "background-color",
      "rgb(23, 23, 23)",
    );
    await retainScreenshot(
      testInfo,
      "tracker-supp-context-custom-accent-dark",
      page,
    );
  },
);

test(
  "remaining Logs, Editor hub, Add menu, and Library surfaces are light",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light");

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Key bindings" }).click();
    const quickAdd = page
      .locator(".keybinding-row")
      .filter({ hasText: "Quick Add" });
    await quickAdd.getByRole("button", { name: "Change" }).click();
    await quickAdd.getByRole("button", { name: "Cancel" }).press("Control+f");
    await expect(quickAdd.getByRole("alert")).toContainText("already assigned");
    await page.getByRole("tab", { name: "Developer" }).click();
    await page.getByRole("tab", { name: "Logs" }).click();
    const logDetail = page.getByLabel("Selected log event details");
    await expect(logDetail).toBeVisible();
    await retainScreenshot(testInfo, "settings-logs-light", page);
    await expect
      .soft(logDetail)
      .toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect
      .soft(page.locator(".log-severity.warn").first())
      .toHaveCSS("color", "rgb(121, 88, 0)");
    await expect
      .soft(page.locator(".log-severity.info").first())
      .toHaveCSS("color", "rgb(29, 95, 157)");

    await page.getByRole("button", { name: "Close Settings" }).click();
    await page.getByRole("button", { name: "Open Editor" }).click();
    await page.getByRole("button", { name: "Create Project" }).click();
    await dismissTransientToasts(page);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const addMenu = page.locator(".editor-add-options");
    await retainScreenshot(testInfo, "editor-add-menu-light", page, false);
    await expect
      .soft(addMenu)
      .toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect.soft(addMenu).toHaveCSS("border-color", "rgb(170, 167, 158)");

    await page.getByRole("button", { name: "Editor", exact: true }).click();
    const metadata = page.locator(".editor-project-card dl > div").first();
    const importButton = page.getByRole("button", { name: "Import .jmp" });
    await retainScreenshot(testInfo, "editor-hub-residual-light", page);
    await expect
      .soft(metadata)
      .toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect
      .soft(importButton)
      .toHaveCSS("background-color", "rgb(243, 241, 235)");
    await expect.soft(importButton).toHaveCSS("color", "rgb(52, 52, 48)");

    const tracker = await resumeMorgan(page);
    await tracker.getByRole("tab", { name: "Library" }).click();
    const libraryCard = tracker.locator(".chain-library-card").first();
    await retainScreenshot(testInfo, "tracker-library-light", page);
    await expect
      .soft(libraryCard)
      .toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect
      .soft(libraryCard.locator("strong"))
      .toHaveCSS("color", "rgb(23, 23, 23)");
  },
);

test(
  "transparent tag text adapts at render time in both themes",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Tags" }).click();
    const form = page.locator(".tag-profile-form-scroll");
    await form
      .locator("label")
      .filter({ hasText: /^Background/ })
      .locator("select")
      .selectOption("transparent");
    await form
      .locator("label")
      .filter({ hasText: /^Text color mode/ })
      .locator("select")
      .selectOption("custom");
    const savedTextColor = form
      .locator("label")
      .filter({ hasText: /^Text color/ })
      .locator('input[type="color"]');
    await savedTextColor.fill("#ffffff");

    const lightPreview = page.locator(
      ".tag-profile-preview-surface.is-light .tag-profile-badge",
    );
    const darkPreview = page.locator(
      ".tag-profile-preview-surface.is-dark .tag-profile-badge",
    );
    await retainScreenshot(testInfo, "transparent-tag-preview-light", page);
    await expect.soft(savedTextColor).toHaveValue("#ffffff");
    await expect
      .soft(lightPreview)
      .not.toHaveCSS("color", "rgb(255, 255, 255)");
    await expectTextContrast(
      lightPreview,
      page.locator(".tag-profile-preview-surface.is-light"),
    );
    await expect.soft(darkPreview).toHaveCSS("color", "rgb(255, 255, 255)");

    await page.getByRole("button", { name: "Close Settings" }).click();
    await page.goto("/chain/ch-92b1");
    await page.getByRole("tab", { name: /^Inventory/ }).click();
    const lightTag = page
      .locator(".chain-record-list .tag-profile-badge")
      .filter({ hasText: /^Physical$/ })
      .first();
    await expect(lightTag).toBeVisible();
    await retainScreenshot(testInfo, "transparent-tags-light", page);
    await expect.soft(lightTag).not.toHaveCSS("color", "rgb(255, 255, 255)");
    await expectTextContrast(
      lightTag,
      lightTag.locator("xpath=ancestor::article[1]"),
    );

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Tags" }).click();
    const darkThemeTextColor = page
      .locator(".tag-profile-form-scroll label")
      .filter({ hasText: /^Text color/ })
      .locator('input[type="color"]');
    await darkThemeTextColor.fill("#000000");
    await expect(darkThemeTextColor).toHaveValue("#000000");
    await waitForStoredSetting(
      page,
      ["tags", "profile", "tags", "physical", "presentation", "textColor"],
      "#000000",
    );
    await page.getByRole("tab", { name: "General" }).click();
    await page.locator("#theme").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-theme",
      "dark",
    );
    await waitForStoredSetting(page, ["appearance", "theme"], "dark");
    await page.getByRole("button", { name: "Close Settings" }).click();

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Tags" }).click();
    const darkSavedTextColor = page
      .locator(".tag-profile-form-scroll label")
      .filter({ hasText: /^Text color/ })
      .locator('input[type="color"]');
    const darkThemePreview = page.locator(
      ".tag-profile-preview-surface.is-dark .tag-profile-badge",
    );
    await retainScreenshot(testInfo, "transparent-tag-preview-dark", page);
    await expect.soft(darkSavedTextColor).toHaveValue("#000000");
    await expect.soft(darkThemePreview).not.toHaveCSS("color", "rgb(0, 0, 0)");
    await expectTextContrast(
      darkThemePreview,
      page.locator(".tag-profile-preview-surface.is-dark"),
    );
    await page.getByRole("button", { name: "Close Settings" }).click();
    await page.goto("/chain/ch-92b1");
    await page.getByRole("tab", { name: /^Inventory/ }).click();
    const darkTag = page
      .locator(".chain-record-list .tag-profile-badge")
      .filter({ hasText: /^Physical$/ })
      .first();
    await expect(darkTag).toBeVisible();
    await retainScreenshot(testInfo, "transparent-tags-dark", page);
    await expect.soft(darkTag).not.toHaveCSS("color", "rgb(0, 0, 0)");
    await expectTextContrast(
      darkTag,
      darkTag.locator("xpath=ancestor::article[1]"),
    );
  },
);

test(
  "Settings tag actions and interactive hover states remain light",
  {
    tag: ["@visual", "@chromium-only"],
  },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setAppearance(page, "light");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Tags" }).click();

    const importJson = page.getByRole("button", { name: "Import JSON" });
    const exportJson = page.getByRole("button", { name: "Export JSON" });
    const resetTag = page
      .locator(".tag-profile-form-actions")
      .getByRole("button", { name: /^Reset/ });
    await retainScreenshot(testInfo, "settings-tag-actions-light", page);
    for (const button of [importJson, exportJson, resetTag]) {
      await expect.soft(button).toHaveCSS("color", "rgb(52, 52, 48)");
      await expect
        .soft(button)
        .toHaveCSS("background-color", "rgb(243, 241, 235)");
      await expect.soft(button).toHaveCSS("border-color", "rgb(170, 167, 158)");
    }

    await exportJson.hover();
    await retainScreenshot(
      testInfo,
      "settings-tag-action-hover-light",
      page,
      false,
    );
    for (const button of [importJson, exportJson, resetTag]) {
      await button.hover();
      await expect
        .soft(button)
        .toHaveCSS("background-color", "rgb(232, 229, 221)");
      await expect.soft(button).toHaveCSS("color", "rgb(23, 23, 23)");
      await expectTextContrast(button, button);
    }

    await page.getByRole("tab", { name: "Notifications" }).click();
    const triggerRow = page
      .locator(".notification-class-settings label")
      .filter({ hasText: "Action confirmations" });
    await triggerRow.hover();
    await retainScreenshot(
      testInfo,
      "settings-notification-trigger-hover-light",
      page,
      false,
    );
    await expect
      .soft(triggerRow)
      .toHaveCSS("background-color", "rgb(243, 241, 235)");
    await expectTextContrast(triggerRow.locator("strong"), triggerRow);

    await page.getByRole("button", { name: "Close Settings" }).click();
    await setAppearance(page, "dark");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Tags" }).click();
    await retainScreenshot(testInfo, "settings-tag-actions-dark", page);
    await expect(page.getByRole("button", { name: "Import JSON" })).toHaveCSS(
      "background-color",
      "rgb(41, 41, 39)",
    );
    await page.getByRole("tab", { name: "Notifications" }).click();
    const darkTriggerRow = page
      .locator(".notification-class-settings label")
      .filter({ hasText: "Action confirmations" });
    await darkTriggerRow.hover();
    await retainScreenshot(
      testInfo,
      "settings-notification-trigger-hover-dark",
      page,
      false,
    );
    await expect(darkTriggerRow).toHaveCSS(
      "background-color",
      "rgb(51, 51, 48)",
    );
  },
);
