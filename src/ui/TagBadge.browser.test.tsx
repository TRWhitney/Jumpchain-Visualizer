import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import type { TagPresentation } from "../domain/tags";
import { CanonicalTagBadge } from "./TagBadge";

const automaticTransparent: TagPresentation = {
  background: "transparent",
  colors: ["#ffffff"],
  positions: [0],
  angle: 0,
  borderColor: "#777777",
  borderWidth: "thin",
  corners: "rounded",
  padding: "standard",
  textMode: "auto",
  textColor: "#ff00ff",
  weight: "normal",
  fontStyle: "normal",
  decoration: "none",
  textEffect: "none",
  animation: "none",
};

test("transparent automatic Tag text follows the rendered surface, not app theme", async () => {
  render(
    <div data-app-theme="dark" style={{ background: "#f5f1e6" }}>
      <CanonicalTagBadge label="Adaptive" presentation={automaticTransparent} />
    </div>,
  );
  const text = page.getByText("Adaptive", { exact: true });
  await expect.element(text).toBeVisible();
  const badge = text.element().closest<HTMLElement>(".tag-profile-badge")!;
  await expect
    .poll(() => getComputedStyle(badge).color)
    .toBe("rgb(17, 17, 17)");
  await expect.poll(() => badge.dataset.renderedSurface).toBe("#f5f1e6");

  const surface = badge.parentElement!;
  surface.style.background = "#20201e";
  await expect
    .poll(() => getComputedStyle(badge).color)
    .toBe("rgb(255, 255, 255)");
  await expect.poll(() => badge.dataset.renderedSurface).toBe("#20201e");
});

test("transparent custom Tag text remains exactly User-selected", async () => {
  render(
    <div style={{ background: "#f5f1e6" }}>
      <CanonicalTagBadge
        label="Custom"
        presentation={{
          ...automaticTransparent,
          textMode: "custom",
          textColor: "#ff00ff",
        }}
      />
    </div>,
  );
  const text = page.getByText("Custom", { exact: true });
  await expect.element(text).toBeVisible();
  const badge = text.element().closest<HTMLElement>(".tag-profile-badge")!;
  expect(getComputedStyle(badge).color).toBe("rgb(255, 0, 255)");
});
