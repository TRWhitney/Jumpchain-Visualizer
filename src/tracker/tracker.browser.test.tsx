import { useReducer } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "./ChainTracker";
import { createDenseTrackerFixture } from "./fixtures";
import { TagRadar } from "./TagRadar";
import { trackerReducer } from "./model";
import "../../documentation/styles.css";
import "../../documentation/chain-tracker-design.css";
import "../../documentation/tags-design.css";
import "./review.css";

function RadarHarness() {
  const [state, dispatch] = useReducer(
    trackerReducer,
    undefined,
    createDenseTrackerFixture,
  );
  return <TagRadar state={state} dispatch={dispatch} />;
}

function TrackerHarness() {
  const [state, dispatch] = useReducer(
    trackerReducer,
    undefined,
    createDenseTrackerFixture,
  );
  return (
    <SupplementProviders>
      <ChainTracker state={state} dispatch={dispatch} />
    </SupplementProviders>
  );
}

test("category radar supports selection and breakdown", async () => {
  render(<RadarHarness />);
  const magic = page.getByRole("button", { name: "Magic" });
  await magic.click();
  await expect.element(magic).toHaveAttribute("aria-pressed", "true");
  await magic.click();
  await expect.element(page.getByText("Magic breakdown")).toBeVisible();
  expect(document.querySelectorAll(".pie-slice")).toHaveLength(10);
  expect(document.querySelectorAll("[data-pie-row]")).toHaveLength(10);
  const pyrokinesis = page.getByRole("button", {
    name: /Pyrokinesis, .* records/i,
  });
  await pyrokinesis.click();
  await expect.element(pyrokinesis).toHaveAttribute("aria-pressed", "true");
  pyrokinesis
    .element()
    .dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  await expect
    .element(page.getByText("Pyrokinesis", { exact: true }).first())
    .toBeVisible();
});

test("canonical tag badges retain their distinct presentation styles", async () => {
  render(<TrackerHarness />);
  await page.getByRole("tab", { name: /^Inventory/ }).click();
  const badges = [
    ...document.querySelectorAll<HTMLElement>(
      ".chain-record-list .category-list-badge",
    ),
  ];
  const byStyle = (style: string) =>
    badges.find((badge) => badge.classList.contains(`is-${style}`));
  const solid = getComputedStyle(byStyle("solid")!);
  const gradient = getComputedStyle(byStyle("gradient")!);
  const soft = getComputedStyle(byStyle("soft")!);
  const outline = getComputedStyle(byStyle("outline")!);
  expect(solid.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(gradient.backgroundImage).toContain("linear-gradient");
  expect(soft.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(outline.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(new Set([soft.borderColor, outline.borderColor]).size).toBe(2);
});

test("workspace tabs select pages and preserve the bounded frame", async () => {
  render(<TrackerHarness />);
  await page.getByRole("tab", { name: "Supplements" }).click();
  await expect
    .element(page.getByRole("tab", { name: "Supplements" }))
    .toHaveAttribute("aria-selected", "true");
  const frame = document.querySelector<HTMLElement>(".tracker-review-frame");
  expect(frame).not.toBeNull();
  expect(frame?.clientHeight).toBeGreaterThan(0);
});
