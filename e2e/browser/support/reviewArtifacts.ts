import type { Locator, Page, TestInfo } from "@playwright/test";

export const reviewArtifactsEnabled =
  process.env.UPDATE_REVIEW_ARTIFACTS === "1";

export function shouldCaptureReviewArtifacts(
  testInfo: TestInfo,
  chromiumOnly = true,
) {
  return (
    reviewArtifactsEnabled &&
    (!chromiumOnly || testInfo.project.name === "chromium")
  );
}

export async function captureReviewScreenshot(target: Page | Locator) {
  const page = "page" in target ? target.page() : target;
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((image) => !image.complete)
        .map(
          (image) =>
            new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
        ),
    );
  });
  const stabilizer = await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition: none !important;
      }
    `,
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  try {
    await target.screenshot({
      animations: "disabled",
      caret: "hide",
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    return await target.screenshot({ animations: "disabled", caret: "hide" });
  } finally {
    await stabilizer.evaluate((element) => element.remove());
  }
}
