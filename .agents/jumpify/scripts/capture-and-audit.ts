#!/usr/bin/env -S node --import tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  facsimileSourceRowMismatches,
  facsimileSourceRows,
} from "./facsimile-layout-audit.mjs";

type Manifest = { archive: string; mode: string; sourceHash: string };
type Ledger = {
  sourcePages?: Array<{ page: number; sectionHandles: string[] }>;
  sections?: Array<{
    handle: string;
    renderIndex: number;
    sourcePages: number[];
  }>;
  entries?: Array<{
    id: string;
    page: number;
    sourceKind: string;
    rect: { x: number; y: number; width: number; height: number };
  }>;
  assets?: Array<{
    page: number;
    kind: string;
    package: boolean;
    alt: string;
    rect: { x: number; y: number; width: number; height: number };
  }>;
};
const workspace = resolve(process.argv[2] ?? "");
const baseURL = process.argv[3] ?? "http://127.0.0.1:4173";
if (!process.argv[2] || !existsSync(join(workspace, "workspace.json"))) {
  console.error(
    "Usage: corepack pnpm exec tsx .agents/jumpify/scripts/capture-and-audit.ts <workspace> [base-url]",
  );
  process.exit(2);
}
const manifest = JSON.parse(
  readFileSync(join(workspace, "workspace.json"), "utf8"),
) as Manifest;
const ledger = JSON.parse(
  readFileSync(join(workspace, "ledger.json"), "utf8"),
) as Ledger;
const archive = join(workspace, manifest.archive);
if (!existsSync(archive))
  throw new Error(`Build the archive before capture: ${archive}`);
const output = join(workspace, "verification", "rendered");
mkdirSync(output, { recursive: true });
const authoredSectionSelector =
  ".format-one-jump-renderer:not(.earth-jump-renderer) section.rendered-jump-section:has(> fieldset.jump-section-content)";

async function ensureChain(page: Page) {
  await page.goto(baseURL);
  const loading = page.getByText("Loading local preferences…");
  if (await loading.isVisible().catch(() => false))
    await loading.waitFor({ state: "hidden" });
  await Promise.race([
    page
      .getByRole("heading", { name: "Welcome to Jumpchain Visualizer" })
      .waitFor(),
    page.getByRole("button", { name: "Open Chain Tracker" }).waitFor(),
    page.getByRole("button", { name: "Chain Tracker", exact: true }).waitFor(),
  ]);
  const exitTour = page.getByRole("button", { name: "Exit tour" });
  if (await exitTour.isVisible().catch(() => false)) {
    await exitTour.dispatchEvent("click");
    const interfaceDialog = page.getByRole("dialog", {
      name: "Choose your interface",
    });
    await interfaceDialog.waitFor();
    await interfaceDialog
      .getByRole("button", { name: /Advanced/ })
      .dispatchEvent("click");
    await interfaceDialog.waitFor({ state: "detached" });
  }
  if (!page.url().endsWith("/chain")) {
    const openTracker = page.getByRole("button", {
      name: "Open Chain Tracker",
    });
    if (await openTracker.isVisible().catch(() => false))
      await openTracker.click();
    else
      await page
        .getByRole("button", { name: "Chain Tracker", exact: true })
        .click();
  }
  const name = page.getByPlaceholder("Chain name");
  if (await name.isVisible().catch(() => false)) {
    await name.fill("Jumpify visual audit");
    await page.getByRole("button", { name: "Start Chain" }).click();
  }
}

async function install(page: Page) {
  const tracker = page.getByLabel("Interactive Chain Tracker workspace");
  const library = tracker.getByRole("tab", { name: "Library" });
  if (await library.isVisible().catch(() => false)) await library.click();
  await tracker
    .locator('input[type="file"][accept^=".jmp"]')
    .setInputFiles(archive);
  const review = page.getByRole("alertdialog");
  await review.waitFor();
  await review
    .getByText("Secure inspection complete", { exact: false })
    .waitFor();
  const text = await review.textContent();
  if (!text?.includes("Secure inspection complete"))
    throw new Error(`Package review was not ready: ${text ?? "empty review"}`);
  await review.getByRole("button", { name: "Import Project" }).click();
  const candidate = tracker
    .getByRole("button", { name: /Add to chain/ })
    .last();
  await candidate.waitFor();
  await candidate.click();
  await page.waitForLoadState("networkidle");
  await page
    .getByLabel("Interactive Chain Tracker workspace")
    .locator(authoredSectionSelector)
    .last()
    .waitFor();
  await page.waitForTimeout(250);
}

function luminance(color: string) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const values = match.slice(1, 4).map((component) => {
    const normalized = Number(component) / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!;
}

const sourceRowsByRenderIndex =
  manifest.mode === "facsimile" ? facsimileSourceRows(ledger) : new Map();

const browser = await chromium.launch();
const widthReports: Record<string, unknown> = {};
const report = {
  schemaVersion: 1,
  sourceHash: manifest.sourceHash,
  baseURL,
  widths: widthReports,
};
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await ensureChain(page);
  await install(page);
  await page.addStyleTag({
    content:
      ".app-toast-host{visibility:hidden!important}" +
      "[data-jumpify-audit-hidden='true']{display:none!important}" +
      "[data-jumpify-audit-ancestor='true']{overflow:visible!important}" +
      ".jump-image-alt-tooltip{display:none!important}" +
      ".chain-rail,.chain-context-header,.chain-main-tabs{display:none!important}" +
      ".chain-mockup,.chain-page-stack,.chain-workspace-page,.atomic-jump-switcher,.chain-jump-workspace{display:block!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;overflow:visible!important}" +
      ".format-one-jump-renderer{width:100%!important;max-width:none!important;margin:0!important}",
  });
  const widths = [1440, 720, 390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(150);
    const sections = page
      .getByLabel("Interactive Chain Tracker workspace")
      .locator(authoredSectionSelector);
    const count = await sections.count();
    const sectionReports = [];
    for (let index = 0; index < count; index += 1) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(50);
      let section = sections.nth(index);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await section.scrollIntoViewIfNeeded();
        const box = await section.boundingBox();
        if (!box) throw new Error(`Section ${index + 1} has no rendered box.`);
        const currentHeight = page.viewportSize()?.height ?? 1000;
        const neededHeight = Math.min(
          30_000,
          Math.max(1000, Math.ceil(Math.max(0, box.y) + box.height + 128)),
        );
        if (neededHeight <= currentHeight) break;
        await page.setViewportSize({ width, height: neededHeight });
        await page.waitForTimeout(100);
        section = page
          .getByLabel("Interactive Chain Tracker workspace")
          .locator(authoredSectionSelector)
          .nth(index);
      }
      await section.scrollIntoViewIfNeeded();
      await section.evaluate((root) => {
        for (
          let ancestor = root.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        )
          ancestor.dataset.jumpifyAuditAncestor = "true";
        const rootRect = root.getBoundingClientRect();
        for (const element of document.body.querySelectorAll<HTMLElement>(
          "*",
        )) {
          if (
            element === root ||
            element.contains(root) ||
            root.contains(element)
          )
            continue;
          const style = getComputedStyle(element);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          )
            continue;
          const rect = element.getBoundingClientRect();
          const intersects =
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right > rootRect.left &&
            rect.left < rootRect.right &&
            rect.bottom > rootRect.top &&
            rect.top < rootRect.bottom;
          if (intersects) element.dataset.jumpifyAuditHidden = "true";
        }
      });
      const screenshot = `verification/rendered/${width}-section-${String(index + 1).padStart(2, "0")}.png`;
      await section.screenshot({
        path: join(workspace, screenshot),
        animations: "disabled",
      });
      const audit = await section.evaluate((root, auditWidth) => {
        const candidates = [
          root,
          ...root.querySelectorAll<HTMLElement>(
            "p,li,h1,h2,h3,h4,h5,h6,article,[class*='layout']",
          ),
        ];
        const overflow = candidates
          .filter(
            (element) =>
              element.scrollWidth > element.clientWidth + 1 ||
              element.scrollHeight > element.clientHeight + 1,
          )
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: element.className,
            client: [element.clientWidth, element.clientHeight],
            scroll: [element.scrollWidth, element.scrollHeight],
            text: element.textContent?.trim().slice(0, 120) ?? "",
          }));
        const missingAlt = [...root.querySelectorAll("img")]
          .filter((image) => !image.getAttribute("alt")?.trim())
          .map((image) => image.getAttribute("src") ?? "unknown image");
        const textColors = [
          ...root.querySelectorAll<HTMLElement>("p,li,h1,h2,h3,h4,h5,h6"),
        ].map((element) => {
          const style = getComputedStyle(element);
          let parent: HTMLElement | null = element;
          let background = "rgba(0, 0, 0, 0)";
          while (parent && /rgba\([^)]*,\s*0\)/.test(background)) {
            background = getComputedStyle(parent).backgroundColor;
            parent = parent.parentElement;
          }
          return {
            text: element.textContent?.trim().slice(0, 80) ?? "",
            color: style.color,
            background,
          };
        });
        const clipped = candidates
          .filter((element) => {
            const style = getComputedStyle(element);
            const clipsX = ["hidden", "clip"].includes(style.overflowX);
            const clipsY = ["hidden", "clip"].includes(style.overflowY);
            return (
              (clipsX && element.scrollWidth > element.clientWidth + 1) ||
              (clipsY && element.scrollHeight > element.clientHeight + 1)
            );
          })
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: element.className,
            text: element.textContent?.trim().slice(0, 120) ?? "",
          }));
        const controls = [
          ...root.querySelectorAll<HTMLElement>("button,input,select"),
        ];
        const actionElements = [
          ...root.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,.control-range,.cost-badge-row,.cost-badge",
          ),
        ].filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        });
        const overlappingActionElements = actionElements.flatMap(
          (left, leftIndex) =>
            actionElements.slice(leftIndex + 1).flatMap((right) => {
              if (left.contains(right) || right.contains(left)) return [];
              const leftStepper = left.closest(".number-stepper");
              if (
                leftStepper &&
                leftStepper === right.closest(".number-stepper")
              )
                return [];
              const leftRect = left.getBoundingClientRect();
              const rightRect = right.getBoundingClientRect();
              const overlapWidth =
                Math.min(leftRect.right, rightRect.right) -
                Math.max(leftRect.left, rightRect.left);
              const overlapHeight =
                Math.min(leftRect.bottom, rightRect.bottom) -
                Math.max(leftRect.top, rightRect.top);
              if (overlapWidth <= 1 || overlapHeight <= 1) return [];
              return [
                {
                  left:
                    left.getAttribute("aria-label") ??
                    left.textContent?.trim().slice(0, 80) ??
                    left.tagName.toLowerCase(),
                  right:
                    right.getAttribute("aria-label") ??
                    right.textContent?.trim().slice(0, 80) ??
                    right.tagName.toLowerCase(),
                  overlap: [overlapWidth, overlapHeight],
                },
              ];
            }),
        );
        const controlBoundaries = controls.flatMap((element) => {
          const surface = element.closest<HTMLElement>("article,fieldset");
          if (!surface) return [];
          const control = element.getBoundingClientRect();
          const boundary = surface.getBoundingClientRect();
          const outside =
            control.left < boundary.left - 1 ||
            control.right > boundary.right + 1 ||
            control.top < boundary.top - 1 ||
            control.bottom > boundary.bottom + 1;
          return outside
            ? [
                {
                  control:
                    element.getAttribute("aria-label") ?? element.tagName,
                  surface: surface.className,
                },
              ]
            : [];
        });
        const stretchedControls = controls.flatMap((element) => {
          const surface = element.closest<HTMLElement>("article,fieldset");
          if (!surface) return [];
          const control = element.getBoundingClientRect();
          const boundary = surface.getBoundingClientRect();
          return control.width > 320 && control.width >= boundary.width - 2
            ? [
                {
                  control:
                    element.getAttribute("aria-label") ?? element.tagName,
                  width: control.width,
                  surfaceWidth: boundary.width,
                },
              ]
            : [];
        });
        const avoidableActionWraps =
          auditWidth === 1440
            ? [
                ...root.querySelectorAll<HTMLElement>(
                  "article.authored-choice-layout",
                ),
              ].flatMap((article) => {
                const roll = [...article.querySelectorAll("button")].find(
                  (button) => {
                    const style = getComputedStyle(button);
                    const rect = button.getBoundingClientRect();
                    return (
                      button.textContent?.trim() === "Roll" &&
                      rect.width > 0 &&
                      rect.height > 0 &&
                      style.display !== "none" &&
                      style.visibility !== "hidden"
                    );
                  },
                );
                const scalar = [
                  ...article.querySelectorAll<HTMLElement>(
                    "input:not([type='checkbox']):not([type='radio']),select,textarea",
                  ),
                ].find((element) => {
                  const style = getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== "none" &&
                    style.visibility !== "hidden"
                  );
                });
                if (!roll || !scalar) return [];
                const rollRect = roll.getBoundingClientRect();
                const scalarRect = scalar.getBoundingClientRect();
                const centerDelta = Math.abs(
                  rollRect.top +
                    rollRect.height / 2 -
                    (scalarRect.top + scalarRect.height / 2),
                );
                if (centerDelta <= 2) return [];
                const actions = [
                  ...article.querySelectorAll<HTMLElement>(
                    "button,input:not([type='checkbox']):not([type='radio']),select,textarea,.cost-badge",
                  ),
                ].filter((element) => {
                  const style = getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== "none" &&
                    style.visibility !== "hidden"
                  );
                });
                const requiredWidth =
                  actions.reduce(
                    (total, element) =>
                      total + element.getBoundingClientRect().width,
                    0,
                  ) +
                  Math.max(0, actions.length - 1) * 8 +
                  16;
                const surfaceWidth = article.getBoundingClientRect().width;
                return requiredWidth <= surfaceWidth + 1
                  ? [
                      {
                        text: article.textContent?.trim().slice(0, 120) ?? "",
                        centerDelta,
                        requiredWidth,
                        surfaceWidth,
                      },
                    ]
                  : [];
              })
            : [];
        const cardBoundaries = [
          ...root.querySelectorAll<HTMLElement>("article"),
        ].flatMap((article) => {
          const card = article.getBoundingClientRect();
          const boundary = root.getBoundingClientRect();
          const outside =
            card.left < boundary.left - 1 ||
            card.right > boundary.right + 1 ||
            card.top < boundary.top - 1 ||
            card.bottom > boundary.bottom + 1;
          return outside
            ? [
                {
                  className: article.className,
                  text: article.textContent?.trim().slice(0, 120) ?? "",
                },
              ]
            : [];
        });
        const rootRect = root.getBoundingClientRect();
        const imageBounds = [...root.querySelectorAll("img")].map((image) => {
          const rect = image.getBoundingClientRect();
          return {
            alt: image.getAttribute("alt") ?? "",
            rect: {
              x: rect.x - rootRect.x,
              y: rect.y - rootRect.y,
              width: rect.width,
              height: rect.height,
            },
          };
        });
        const viewportBoundaries =
          rootRect.left < -1 ||
          rootRect.right > window.innerWidth + 1 ||
          rootRect.width > window.innerWidth + 1
            ? [
                {
                  rect: [
                    rootRect.left,
                    rootRect.top,
                    rootRect.right,
                    rootRect.bottom,
                  ],
                  viewport: [window.innerWidth, window.innerHeight],
                },
              ]
            : [];
        const contentBoundaries = [
          ...root.querySelectorAll<HTMLElement>(
            "img,p,li,h1,h2,h3,h4,h5,h6,button,input,select,textarea,article,[class*='layout'],[class*='leaf']",
          ),
        ].flatMap((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            style.display === "none" ||
            style.visibility === "hidden"
          )
            return [];
          const outside =
            rect.left < rootRect.left - 1 ||
            rect.right > rootRect.right + 1 ||
            rect.top < rootRect.top - 1 ||
            rect.bottom > rootRect.bottom + 1;
          return outside
            ? [
                {
                  tag: element.tagName.toLowerCase(),
                  className: element.className,
                  rect: [rect.left, rect.top, rect.right, rect.bottom],
                  root: [
                    rootRect.left,
                    rootRect.top,
                    rootRect.right,
                    rootRect.bottom,
                  ],
                  text: element.textContent?.trim().slice(0, 120) ?? "",
                },
              ]
            : [];
        });
        return {
          overflow,
          clipped,
          missingAlt,
          imageBounds,
          textColors,
          controlBoundaries,
          overlappingActionElements,
          avoidableActionWraps,
          stretchedControls,
          cardBoundaries,
          contentBoundaries,
          viewportBoundaries,
        };
      }, width);
      await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>(
          "[data-jumpify-audit-hidden='true']",
        ))
          delete element.dataset.jumpifyAuditHidden;
      });
      const contrast = audit.textColors.flatMap((entry) => {
        const foreground = luminance(entry.color);
        const background = luminance(entry.background);
        if (foreground === null || background === null) return [];
        const ratio =
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05);
        return ratio < 4.5
          ? [{ ...entry, ratio: Number(ratio.toFixed(2)) }]
          : [];
      });
      const sourceRowMismatches =
        width === 1440
          ? facsimileSourceRowMismatches(
              sourceRowsByRenderIndex.get(index + 1) ?? [],
              audit.imageBounds,
            )
          : [];
      sectionReports.push({
        index: index + 1,
        screenshot,
        overflow: audit.overflow,
        clipped: audit.clipped,
        missingAlt: audit.missingAlt,
        sourceRowMismatches,
        lowContrast: contrast,
        controlBoundaries: audit.controlBoundaries,
        overlappingActionElements: audit.overlappingActionElements,
        avoidableActionWraps: audit.avoidableActionWraps,
        stretchedControls: audit.stretchedControls,
        cardBoundaries: audit.cardBoundaries,
        contentBoundaries: audit.contentBoundaries,
        viewportBoundaries: audit.viewportBoundaries,
      });
    }
    widthReports[String(width)] = sectionReports;
  }
  await context.close();
} finally {
  await browser.close();
}
writeFileSync(
  join(workspace, "verification", "render-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `${workspace}: captured rendered sections at 1440px, 720px, and 390px`,
);
