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
import "../../documentation/choice-rendering-design.css";
import "./jumpRenderer.css";
import "../../documentation/tags-design.css";
import "./review.css";

function RadarHarness() {
  const [state, dispatch] = useReducer(trackerReducer, undefined, () => {
    const fixture = createDenseTrackerFixture();
    return {
      ...fixture,
      records: fixture.records.map((record) => ({
        ...record,
        ownerActorId: "jumper",
      })),
    };
  });
  return <TagRadar state={state} dispatch={dispatch} />;
}

function TrackerHarness() {
  const [state, dispatch] = useReducer(
    trackerReducer,
    undefined,
    createDenseTrackerFixture,
  );
  return (
    <SupplementProviders
      bodyMod={state.bodyMod}
      onBodyModChange={(value) => dispatch({ type: "set-body-mod", value })}
      supplementState={state.supplements}
      supplementDispatch={(action) =>
        dispatch({ type: "supplement-action", action })
      }
    >
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
      ".chain-record-list .tag-profile-badge",
    ),
  ];
  const styles = badges.map((badge) => getComputedStyle(badge));
  expect(
    new Set(styles.map((style) => style.backgroundColor)).size,
  ).toBeGreaterThan(6);
  expect(
    styles.some((style) => style.backgroundImage.includes("linear-gradient")),
  ).toBe(true);
  expect(
    styles.some((style) => style.backgroundColor === "rgba(0, 0, 0, 0)"),
  ).toBe(true);
  expect(
    styles.some(
      (style) =>
        style.backgroundImage === "none" &&
        style.backgroundColor !== "rgba(0, 0, 0, 0)",
    ),
  ).toBe(true);
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

test("Earth is unnumbered, immutable, and establishes identity continuity", async () => {
  render(<TrackerHarness />);
  await expect
    .element(page.getByRole("button", { name: /^Earth/ }))
    .toBeVisible();
  const earthEntry = document.querySelector<HTMLElement>(
    ".chain-jump-entry.is-earth",
  );
  expect(earthEntry).not.toBeNull();
  expect(earthEntry?.querySelector(".chain-jump-handle")).toBeNull();
  expect(earthEntry?.querySelector(".chain-jump-actions")).toBeNull();
  await page.getByRole("button", { name: /^Earth/ }).click();
  await expect
    .element(page.getByText("Before Jump 1", { exact: true }))
    .toBeVisible();
  expect(
    [...document.querySelectorAll(".chain-jump-summary dd")].map(
      (element) => element.firstChild?.textContent,
    ),
  ).toEqual(["0 CP", "Human", "Unknown", "Unknown"]);

  await page.getByLabelText("Earth gender").selectOptions("Female");
  await page.getByLabelText("Earth age").fill("24");
  await page.getByRole("button", { name: /1\. First Step/ }).click();
  await expect.element(page.getByLabelText("Gender")).toHaveValue("Female");
  await expect
    .element(page.getByRole("spinbutton", { name: "Age" }))
    .toHaveValue(24);
});
