import { StrictMode } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { waitForRenderedJumpImages } from "./jumpImages";
import { useAssetObjectUrls } from "./useAssetObjectUrls";

const png = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  ),
  (character) => character.charCodeAt(0),
);
const assets = { "assets/pixel.png": png };

test("asset object URLs remain live through Strict Mode effect replay", async () => {
  function Harness() {
    const urls = useAssetObjectUrls(assets, true);
    return urls["pixel.png"] ? (
      <img src={urls["pixel.png"]} alt="Strict asset" />
    ) : null;
  }

  render(
    <StrictMode>
      <Harness />
    </StrictMode>,
  );

  const image = page.getByRole("img", { name: "Strict asset" });
  await expect.element(image).toBeVisible();
  await expect
    .poll(
      () =>
        document.querySelector<HTMLImageElement>('img[alt="Strict asset"]')
          ?.naturalWidth,
    )
    .toBe(1);
  await expect
    .poll(() =>
      document
        .querySelector<HTMLImageElement>('img[alt="Strict asset"]')
        ?.src.startsWith("blob:"),
    )
    .toBe(true);
});

test("rendered image readiness waits for packaged asset URLs", async () => {
  const root = document.createElement("div");
  const pending = document.createElement("span");
  pending.dataset.jumpAssetsPending = "";
  root.append(pending);
  let resolved = false;
  const readiness = waitForRenderedJumpImages(root).then(() => {
    resolved = true;
  });

  await Promise.resolve();
  expect(resolved).toBe(false);
  pending.remove();
  await readiness;
  expect(resolved).toBe(true);
});

test("rendered image readiness decodes CSS background sources", async () => {
  const root = document.createElement("div");
  const background = document.createElement("span");
  background.dataset.jumpBackgroundImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'/%3E";
  root.append(background);

  await waitForRenderedJumpImages(root);
  expect(background.dataset.jumpBackgroundImage).toContain("image/svg+xml");
});
