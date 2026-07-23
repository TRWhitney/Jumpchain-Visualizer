import { useReducer } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "./ChainTracker";
import { createDenseTrackerFixture } from "./fixtures";
import { evaluateTracker, projectEvaluation } from "./evaluateTracker";
import { TagRadar } from "./TagRadar";
import { trackerReducer } from "./model";
import { RenderedJumpImage } from "./JumpRenderer";
import { SettingsProvider } from "../settings/SettingsProvider";
import { MemorySettingsRepository } from "../settings/repository";
import { defaultSettings } from "../settings/model";
import { createDefaultTagProfile } from "../settings/tagProfile";
import "../../documentation/styles.css";
import "../../documentation/chain-tracker-design.css";
import "../../documentation/choice-rendering-design.css";
import "./jumpRenderer.css";
import "../../documentation/tags-design.css";
import "./review.css";

function RadarHarness() {
  const [state, dispatch] = useReducer(trackerReducer, undefined, () => {
    const fixture = createDenseTrackerFixture();
    const projected = projectEvaluation(
      fixture,
      evaluateTracker(fixture, fixture.bodyMod),
    );
    return {
      ...projected,
      records: projected.records.map((record) => ({
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

test("rendered images disclose authored alternative text on hover", async () => {
  render(
    <article className="jump-image-preview">
      <span className="jump-image-preview-content">
        <RenderedJumpImage
          source="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='24'/%3E"
          alternativeText="A blue route marker"
        />
        <RenderedJumpImage
          source="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='24'/%3E"
          alternativeText=""
        />
      </span>
    </article>,
  );

  await page.getByAltText("A blue route marker").hover();
  await expect
    .element(page.getByRole("tooltip"))
    .toHaveTextContent("A blue route marker");
  await expect.element(page.getByRole("tooltip")).toBeVisible();
  expect(document.querySelectorAll(".jump-image-alt-tooltip")).toHaveLength(1);
});

test("the accessibility preference suppresses only the visual image alt tooltip", async () => {
  const settings = defaultSettings(createDefaultTagProfile());
  settings.accessibility.imageAltTextHover = false;
  render(
    <SettingsProvider repository={new MemorySettingsRepository(settings)}>
      <article className="jump-image-preview">
        <span className="jump-image-preview-content">
          <RenderedJumpImage
            source="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='24'/%3E"
            alternativeText="A blue route marker"
          />
        </span>
      </article>
    </SettingsProvider>,
  );

  const image = page.getByAltText("A blue route marker");
  await expect.element(image).toBeVisible();
  await image.hover();
  await expect.element(page.getByRole("tooltip")).not.toBeInTheDocument();
  expect(image.element().getAttribute("alt")).toBe("A blue route marker");
});

test("category radar supports selection and breakdown", async () => {
  render(<RadarHarness />);
  const magic = page.getByRole("button", { name: "Magic" });
  await magic.click();
  await expect.element(magic).toHaveAttribute("aria-pressed", "true");
  await magic.click();
  await expect.element(page.getByText("Magic breakdown")).toBeVisible();
  expect(document.querySelectorAll(".pie-slice").length).toBeGreaterThan(0);
  expect(document.querySelectorAll("[data-pie-row]").length).toBeGreaterThan(0);
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

test("a direct-only breakdown renders a solid disk", async () => {
  render(<RadarHarness />);
  const combat = page.getByRole("button", { name: "Combat" });
  await combat.click();
  await combat.click();
  expect(document.querySelectorAll("circle.pie-slice")).toHaveLength(1);
  expect(document.querySelectorAll("path.pie-slice")).toHaveLength(0);
  expect(document.querySelectorAll(".pie-center-backplate")).toHaveLength(0);
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
  ).toEqual(["0 CP", "Human", "Female", "28"]);

  await page.getByLabelText("Earth gender").selectOptions("Female");
  await page.getByLabelText("Earth age").fill("24");
  await page
    .getByRole("button", { name: /1\. Threshold of a Thousand Roads/ })
    .click();
  await expect.element(page.getByLabelText("Gender")).toHaveValue("Female");
  expect(
    (
      page
        .getByRole("spinbutton", { name: "Age" })
        .element() as HTMLInputElement
    ).value,
  ).toBe("");
});
