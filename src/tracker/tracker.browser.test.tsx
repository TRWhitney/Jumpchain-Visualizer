import { useReducer } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "./ChainTracker";
import { createDenseTrackerFixture } from "./fixtures";
import { evaluateTracker, projectEvaluation } from "./evaluateTracker";
import { TagRadar } from "./TagRadar";
import { trackerReducer, type TrackerAction } from "./model";
import { JumpRenderer, RenderedJumpImage } from "./JumpRenderer";
import { canonicalizePackage } from "../markup";
import { emptyActorEntryState, evaluateChain } from "../domain";
import { SettingsProvider } from "../settings/SettingsProvider";
import { MemorySettingsRepository } from "../settings/repository";
import { defaultSettings } from "../settings/model";
import { createDefaultTagProfile } from "../settings/tagProfile";
import { ContextMenuProvider } from "../ui";
import "../../documentation/styles.css";
import "../../documentation/chain-tracker-design.css";
import "../../documentation/choice-rendering-design.css";
import "./jumpRenderer.css";
import "../../documentation/tags-design.css";
import "./review.css";

const controlPackage = canonicalizePackage({
  id: "control-browser",
  exactHash: "c".repeat(64),
  files: {
    "jump.jdef": `jump
  format: 1
  name: "Control browser"
  author: "Tester"
  version: "1"

section
  handle: controls
  name: "Controls"

  choice
    handle: companions
    target: companions

  choice
    handle: prompt
    target: prompt

choice
  handle: companions
  name: "Traveling company"
  selection: companions
  placeholder: "Find an earlier companion"
  max: 2

  grant
    kind: resource
    resource: jump_points
    amount: 100
    companion: companions

choice
  handle: prompt
  name: "Prompt"
  selection: text
  placeholder: "Primary response"

  text
    handle: description
    content: "Waiting for the follow-up."
    content when prompt = "Ready" and follow_up = "Ready" and score >= 2 and route = "North": "Primary {{prompt}} · follow-up {{follow_up}} · score {{score}} · route {{route}}"

  input
    handle: follow_up
    selection: text
    placeholder: "Follow-up response"

  input
    handle: score
    selection: integer
    placeholder: "Score response"
    min: 0
    max: 5

  input
    handle: route
    selection: select
    placeholder: "Route response"
    option: "North"
    option: ""
    option: "South"
`,
  },
});

function ControlHarness({
  companions = [
    { id: "lyra", name: "Lyra" },
    { id: "aster", name: "Aster" },
  ],
}: {
  companions?: readonly { id: string; name: string }[];
}) {
  const fixture = createDenseTrackerFixture();
  const [state, dispatch] = useReducer(
    (
      current: ReturnType<typeof emptyActorEntryState>,
      action: TrackerAction,
    ) => {
      if (action.type === "set-choice")
        return {
          ...current,
          choices: {
            ...current.choices,
            [action.choiceHandle]: action.value,
          },
        };
      if (action.type === "set-input")
        return {
          ...current,
          inputs: {
            ...current.inputs,
            [action.choiceHandle]: {
              ...current.inputs[action.choiceHandle],
              [action.inputHandle]: action.value,
            },
          },
        };
      return current;
    },
    {
      ...emptyActorEntryState(),
      choices: { prompt: "Ready" },
    },
  );
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: controlPackage.id },
    packages: { [controlPackage.id]: controlPackage },
    jumpState: {
      entry: { actors: { jumper: state }, appliedGauntlet: [] },
    },
    jumperName: "Tester",
  }).runtime.entry.actors.jumper;
  return (
    <JumpRenderer
      packageItem={controlPackage}
      entryId="entry"
      actorId="jumper"
      state={state}
      evaluation={evaluation}
      preferences={fixture.preferences}
      tags={fixture.tags}
      companions={companions}
      gauntletActive={false}
      dispatch={dispatch}
    />
  );
}

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

function SimplifiedTrackerHarness() {
  const settings = defaultSettings(createDefaultTagProfile());
  settings.chain.compactJumpActions = true;
  settings.chain.collapseInventoryTagFilters = true;
  return (
    <ContextMenuProvider>
      <SettingsProvider repository={new MemorySettingsRepository(settings)}>
        <TrackerHarness />
      </SettingsProvider>
    </ContextMenuProvider>
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

test("tiled images repeat visually while retaining one semantic image", async () => {
  render(
    <div className="jump-layout-leaf-boundary" data-layout-kind="image">
      <RenderedJumpImage
        source="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='24'/%3E"
        alternativeText="A tiled route marker"
        style={{ width: "12rem", height: "6rem" }}
        tiled
      />
      <RenderedJumpImage
        source="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'/%3E"
        alternativeText=""
        tiled
      />
    </div>,
  );

  const semanticImage = page.getByAltText("A tiled route marker");
  await expect.element(semanticImage).toBeInTheDocument();
  expect(getComputedStyle(semanticImage.element()).opacity).toBe("0");
  const tile = semanticImage.element().parentElement!;
  expect(tile.classList.contains("jump-tiled-image")).toBe(true);
  expect(getComputedStyle(tile).backgroundRepeat).toBe("repeat");
  expect(getComputedStyle(tile).backgroundPosition).toBe("0px 0px");
  expect(tile.getBoundingClientRect().width).toBeCloseTo(192);
  expect(tile.getBoundingClientRect().height).toBeCloseTo(96);
  expect(document.querySelectorAll(".jump-tiled-image img")).toHaveLength(2);
  expect(
    document.querySelectorAll(
      '.jump-tiled-image img[alt="A tiled route marker"]',
    ),
  ).toHaveLength(1);
  expect(
    document.querySelectorAll('.jump-tiled-image img[alt=""]'),
  ).toHaveLength(1);
  await userEvent.hover(tile);
  await expect
    .element(page.getByRole("tooltip"))
    .toHaveTextContent("A tiled route marker");
});

test("image effects apply independently to visible and tiled images", async () => {
  render(
    <div>
      <RenderedJumpImage
        source="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='48'/%3E"
        alternativeText="Rounded route marker"
        effects={{
          roundedCorners: true,
          roundedIntensity: 100,
          fadeEdges: false,
          fadeIntensity: 25,
        }}
      />
      <RenderedJumpImage
        source="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='48'/%3E"
        alternativeText="Faded route marker"
        effects={{
          roundedCorners: false,
          roundedIntensity: 25,
          fadeEdges: true,
          fadeIntensity: 60,
        }}
      />
      <RenderedJumpImage
        source="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'/%3E"
        alternativeText="Tiled effects marker"
        effects={{
          roundedCorners: true,
          roundedIntensity: 50,
          fadeEdges: true,
          fadeIntensity: 40,
        }}
        tiled
      />
    </div>,
  );

  const roundedLocator = page.getByAltText("Rounded route marker");
  await expect.element(roundedLocator).toBeInTheDocument();
  const rounded = roundedLocator.element();
  expect(getComputedStyle(rounded).borderRadius).toBe("24px");
  expect(getComputedStyle(rounded).maskImage).toBe("none");

  const fadedLocator = page.getByAltText("Faded route marker");
  await expect.element(fadedLocator).toBeInTheDocument();
  const faded = fadedLocator.element();
  expect(getComputedStyle(faded).borderRadius).toBe("0px");
  expect(getComputedStyle(faded).maskImage).toContain("data:image/svg+xml");
  expect(getComputedStyle(faded).maskImage).toContain("feGaussianBlur");
  expect(getComputedStyle(faded).maskSize).toBe("100% 100%");
  expect(getComputedStyle(faded).maskRepeat).toBe("no-repeat");

  const tiledLocator = page.getByAltText("Tiled effects marker");
  await expect.element(tiledLocator).toBeInTheDocument();
  const tiled = tiledLocator.element().parentElement!;
  expect(getComputedStyle(tiled).borderRadius).toBe("2px");
  expect(getComputedStyle(tiled).maskImage).toContain("feGaussianBlur");
});

test("layout backgrounds preserve image effects without masking choice content", async () => {
  const packageItem = canonicalizePackage(
    {
      id: "background-effects-browser",
      exactHash: "b".repeat(64),
      files: {
        "jump.jdef": `jump
  format: 1
  name: "Background effects"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"

  choice
    handle: card_placement
    target: card

choice
  handle: card
  name: "Effect card"
  layout: effect_card
  selection: toggle

  image
    handle: backdrop
    src: "backdrop.svg"
    alt: "Blue backdrop"
    rounded-corners: true
    rounded-intensity: 100
    fade-edges: true
    fade-intensity: 80

choice-layout
  handle: effect_card

  stack
    background-image: backdrop
    background-fit: cover
    slot: name
    slot: control
`,
      },
    },
    { assetPaths: ["backdrop.svg"] },
  );
  const fixture = createDenseTrackerFixture();
  const state = emptyActorEntryState();
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: {
      entry: { actors: { jumper: state }, appliedGauntlet: [] },
    },
    jumperName: "Tester",
  }).runtime.entry.actors.jumper;
  render(
    <JumpRenderer
      packageItem={packageItem}
      entryId="entry"
      actorId="jumper"
      state={state}
      evaluation={evaluation}
      preferences={fixture.preferences}
      tags={fixture.tags}
      companions={[]}
      gauntletActive={false}
      resolveAsset={() =>
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='100'%3E%3Cpath fill='%232369be' d='M0 0h160v100H0z'/%3E%3C/svg%3E"
      }
      dispatch={() => undefined}
    />,
  );

  await expect
    .element(page.getByText("Effect card", { exact: true }))
    .toBeVisible();
  await expect.element(page.getByRole("checkbox")).toBeVisible();
  const background = document.querySelector<HTMLElement>(
    ".jump-layout-authored-background",
  );
  expect(background).not.toBeNull();
  expect(getComputedStyle(background!).backgroundImage).toContain(
    "data:image/svg+xml",
  );
  expect(getComputedStyle(background!).maskImage).toContain("feGaussianBlur");
  expect(getComputedStyle(background!).borderRadius).not.toBe("0px");
  expect(getComputedStyle(background!.parentElement!).backgroundImage).toBe(
    "none",
  );
  expect(getComputedStyle(page.getByRole("checkbox").element()).maskImage).toBe(
    "none",
  );
});

test("Jump, Section, and Choice labels interpolate evaluated properties", async () => {
  const fixture = createDenseTrackerFixture();
  const state = {
    ...emptyActorEntryState(),
    choices: { prompt: "Ready" },
  };
  const packageItem = {
    ...controlPackage,
    name: { base: "Control {{gender}}", variants: [] },
    description: "Description for {{gender}}",
    sections: controlPackage.sections.map((section) => ({
      ...section,
      name: { base: "Choices for {{gender}}", variants: [] },
    })),
    choices: controlPackage.choices.map((choice) =>
      choice.handle === "prompt"
        ? {
            ...choice,
            name: { base: "{{gender}} prompt", variants: [] },
          }
        : choice,
    ),
  };
  const evaluated = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: {
      entry: { actors: { jumper: state }, appliedGauntlet: [] },
    },
    jumperName: "Tester",
    initialIdentity: {
      gender: { value: "Female", sourceLabel: "Preview identity" },
    },
  }).runtime.entry.actors.jumper;

  render(
    <JumpRenderer
      packageItem={packageItem}
      entryId="entry"
      actorId="jumper"
      state={state}
      evaluation={evaluated}
      preferences={fixture.preferences}
      tags={fixture.tags}
      companions={[]}
      gauntletActive={false}
      dispatch={() => undefined}
    />,
  );

  await expect
    .element(page.getByRole("heading", { name: "Control Female" }))
    .toBeVisible();
  await expect
    .element(page.getByText("Description for Female", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("heading", { name: "Choices for Female" }))
    .toBeVisible();
  expect(
    [...document.querySelectorAll(".default-choice-heading strong")].map(
      (element) => element.textContent,
    ),
  ).toContain("Female prompt");
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

test("choice and supporting Input placeholders render through the shared renderer", async () => {
  render(<ControlHarness />);

  await expect
    .element(page.getByPlaceholder("Follow-up response"))
    .toBeVisible();
  await expect.element(page.getByPlaceholder("Score response")).toBeVisible();
  await expect
    .element(page.getByRole("combobox", { name: "Route" }))
    .toHaveValue("");
  expect(
    [
      ...(
        page
          .getByRole("combobox", { name: "Route" })
          .element() as HTMLSelectElement
      ).options,
    ].map((option) => option.textContent),
  ).toEqual(["Route response", "North", "South"]);
  expect(
    [...document.querySelectorAll(".jump-nested-inputs > label > strong")].map(
      (label) => label.textContent,
    ),
  ).toEqual(["Follow Up", "Score", "Route"]);
  const primary = page.getByPlaceholder("Primary response");
  await expect.element(primary).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).last().click();
  await expect.element(primary).toHaveValue("");
});

test("Text, Integer, and Select Input answers drive conditions and literal interpolation", async () => {
  render(<ControlHarness />);

  const followUp = page.getByPlaceholder("Follow-up response");
  const score = page.getByPlaceholder("Score response");
  const route = page.getByRole("combobox", { name: "Route" });
  await followUp.fill("Ready");
  await score.fill("2");
  await route.selectOptions("North");

  await expect
    .element(
      page.getByText(
        "Primary Ready · follow-up Ready · score 2 · route North",
        {
          exact: true,
        },
      ),
    )
    .toBeVisible();

  await followUp.fill("**Ready**");
  await expect
    .element(page.getByText("Waiting for the follow-up.", { exact: true }))
    .toBeVisible();
});

test("companion selection supports keyboard search, limits, pills, and deterministic removal focus", async () => {
  render(<ControlHarness />);
  const picker = page.getByRole("combobox", { name: "Traveling company" });
  await expect
    .element(picker)
    .toHaveAttribute("placeholder", "Find an earlier companion");

  await picker.click();
  await userEvent.keyboard("{End}{Enter}");
  await expect
    .element(page.getByRole("button", { name: "Remove Aster" }))
    .toBeVisible();
  await picker.fill("Lyr");
  await userEvent.keyboard("{Enter}");
  await expect.element(picker).toBeDisabled();
  await expect
    .element(page.getByText("2 selected · minimum 1 · maximum 2"))
    .toBeVisible();

  await page.getByRole("button", { name: "Remove Aster" }).click();
  await expect.element(picker).not.toBeDisabled();
  await expect
    .element(page.getByRole("button", { name: "Remove Lyra" }))
    .toHaveFocus();
});

test("companion selection explains when no earlier companions are available", async () => {
  render(<ControlHarness companions={[]} />);
  const picker = page.getByRole("combobox", { name: "Traveling company" });
  await picker.click();
  await expect
    .element(page.getByText("No companions from earlier Jumps are available."))
    .toBeVisible();
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

test("simplified Chain controls retain identity, history, actions, and active tag state", async () => {
  render(<SimplifiedTrackerHarness />);
  const moreActions = page.getByRole("button", {
    name: /More actions for Threshold of a Thousand Roads/,
  });
  await expect.element(moreActions).toBeVisible();
  await moreActions.click();
  await expect
    .element(
      page.getByRole("menu", {
        name: /Threshold of a Thousand Roads chain entry actions/,
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("menuitem", { name: "Move earlier" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("menuitem", { name: "Move later" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("menuitem", { name: "Remove from chain…" }))
    .toBeVisible();
  page
    .getByRole("menu")
    .element()
    .dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

  await page.getByRole("button", { name: /^Earth/ }).click();
  await expect.element(page.getByLabelText("Earth gender")).toBeVisible();
  await expect.element(page.getByLabelText("Earth age")).toBeVisible();

  await page.getByRole("button", { name: /3\. The Last Trial/ }).click();
  await page.getByRole("tab", { name: /^Inventory/ }).click();
  await expect.element(page.getByLabelText("Inventory through")).toBeVisible();
  const tags = page.getByRole("button", { name: "Tags: All" });
  await expect.element(tags).toHaveAttribute("aria-expanded", "false");
  await expect
    .element(page.getByRole("complementary", { name: "Tag search" }))
    .not.toBeInTheDocument();
  await tags.click();
  await expect
    .element(page.getByRole("complementary", { name: "Tag search" }))
    .toBeVisible();
  const firstTag = document.querySelector<HTMLButtonElement>(
    ".inventory-tag-select",
  )!;
  const tagLabel = firstTag
    .querySelector("span")!
    .textContent!.replace(/^◆\s*/, "");
  firstTag.click();
  const activeTags = page.getByRole("button", { name: `Tags: ${tagLabel}` });
  await expect.element(activeTags).toBeVisible();
  await activeTags.click();
  await expect.element(activeTags).toHaveAttribute("aria-expanded", "false");
  await expect.element(activeTags).toBeVisible();
});
