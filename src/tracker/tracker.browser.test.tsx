import { useReducer } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { SupplementProviders } from "../supplements/TrackerSupplements";
import { ChainTracker } from "./ChainTracker";
import { createDenseTrackerFixture } from "./fixtures";
import { evaluateTracker, projectEvaluation } from "./evaluateTracker";
import { StaticTagRadar, TagRadar } from "./TagRadar";
import { trackerReducer, type TrackerAction } from "./model";
import {
  JumpRenderer,
  JumpTraitRendererScope,
  RenderedJumpImage,
} from "./JumpRenderer";
import { canonicalizePackage } from "../markup";
import { emptyActorEntryState, evaluateChain } from "../domain";
import { SettingsProvider } from "../settings/SettingsProvider";
import { MemorySettingsRepository } from "../settings/repository";
import { defaultSettings } from "../settings/model";
import { createDefaultTagProfile } from "../settings/tagProfile";
import { presentationForTagDefinition, tagTextContrast } from "../domain/tags";
import { ContextMenuProvider } from "../ui";
import "../../documentation/assets/styles.css";
import "../../documentation/development/chain-tracker-design.css";
import "../../documentation/development/choice-rendering-design.css";
import "./jumpRenderer.css";
import "../../documentation/development/tags-design.css";
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
  actionLog,
}: {
  companions?: readonly { id: string; name: string }[];
  actionLog?: TrackerAction[];
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
  const loggedDispatch = (action: TrackerAction) => {
    actionLog?.push(action);
    dispatch(action);
  };
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
      dispatch={loggedDispatch}
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

function NonRemovablePackageTrackerHarness() {
  const [state, dispatch] = useReducer(trackerReducer, undefined, () => {
    const fixture = createDenseTrackerFixture();
    const packageId = fixture.entries["entry-0"].packageId;
    return {
      ...fixture,
      packages: {
        ...fixture.packages,
        [packageId]: {
          ...fixture.packages[packageId],
          source: "builtin" as const,
        },
      },
    };
  });
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

function ImportedPackageTrackerHarness() {
  const [state, dispatch] = useReducer(trackerReducer, undefined, () => {
    const fixture = createDenseTrackerFixture();
    const packageId = fixture.entries["entry-0"].packageId;
    return {
      ...fixture,
      packages: {
        ...fixture.packages,
        [packageId]: {
          ...fixture.packages[packageId],
          source: "imported" as const,
        },
      },
    };
  });
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

function UnavailablePackageTrackerHarness() {
  const [state, dispatch] = useReducer(trackerReducer, undefined, () => {
    const fixture = createDenseTrackerFixture();
    const unavailablePackageId = fixture.entries["entry-2"].packageId;
    return {
      ...fixture,
      packages: Object.fromEntries(
        Object.entries(fixture.packages).filter(
          ([id]) => id !== unavailablePackageId,
        ),
      ),
      lastValidatedEvaluation: evaluateTracker(fixture, fixture.bodyMod),
    };
  });
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

test("authored text alignment uses the full layout boundary", async () => {
  const packageItem = canonicalizePackage({
    id: "centered-layout-text-browser",
    exactHash: "d".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Centered layout text"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"
  layout: centered_section

  text
    handle: centered
    content: "This sentence must be centered across the complete authored layout boundary."

section-layout
  handle: centered_section

  stack
    align: stretch
    text
      target: centered
      align: stretch
      text-align: center
`,
    },
  });
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
      dispatch={() => undefined}
    />,
  );

  const text = page.getByText(
    "This sentence must be centered across the complete authored layout boundary.",
    { exact: true },
  );
  await expect.element(text).toBeVisible();
  const paragraph = text.element().closest("p")!;
  const boundary = paragraph.parentElement!;
  const paragraphBox = paragraph.getBoundingClientRect();
  const boundaryBox = boundary.getBoundingClientRect();
  expect(getComputedStyle(paragraph).maxWidth).toBe("none");
  expect(Math.abs(paragraphBox.width - boundaryBox.width)).toBeLessThanOrEqual(
    1,
  );
  expect(getComputedStyle(paragraph).textAlign).toBe("center");
});

test("vertical rules and Inline siblings share one block extent", async () => {
  const packageItem = canonicalizePackage({
    id: "vertical-rule-browser",
    exactHash: "v".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Vertical rule"
  author: "Tester"
  version: "1"

section
  handle: region
  name: "Region"
  layout: region_layout

  text
    handle: action
    content: "ROLL 1D8 TO DETERMINE YOUR REGION."

  text
    handle: world
    content: "The Pokémon world you are entering has larger cities, longer routes, active civilization, and peaceful authorities ready to intervene."

section-layout
  handle: region_layout

  inline
    align: stretch
    gap: sm

    stack
      text: action

    rule
      orientation: vertical
      color: "#00ffff"
      thickness: 3

    stack
      text: world
`,
    },
  });
  const fixture = createDenseTrackerFixture();
  const state = emptyActorEntryState();
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
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
      dispatch={() => undefined}
    />,
  );

  await expect
    .element(
      page.getByText("ROLL 1D8 TO DETERMINE YOUR REGION.", { exact: true }),
    )
    .toBeVisible();
  const row = document.querySelector<HTMLElement>(".jump-layout-inline")!;
  const areas = [
    ...row.querySelectorAll<HTMLElement>(
      ":scope > .jump-layout-inline-child-area",
    ),
  ];
  expect(areas).toHaveLength(3);
  const heights = areas.map((area) => area.getBoundingClientRect().height);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  const rule = row.querySelector<HTMLElement>(
    'hr[aria-orientation="vertical"]',
  )!;
  expect(rule.getBoundingClientRect().height).toBeGreaterThanOrEqual(
    Math.min(...heights) - 1,
  );
  expect(getComputedStyle(rule).borderLeftWidth).toBe("3px");
});

test("semantic fidelity layout fields stretch visible cards and distribute authored space", async () => {
  await page.viewport(1000, 800);
  const packageItem = canonicalizePackage({
    id: "semantic-fidelity-browser",
    exactHash: "v".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Semantic Fidelity"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"
  layout: section_grid
  choice
    handle: short_field
    target: short
  choice
    handle: long_field
    target: long
  choice
    handle: featured_field
    target: featured
  text
    handle: roll
    content: "Roll"
  text
    handle: pay
    content: "Pay"
  text
    handle: world
    content: "A neighboring column with enough prose to establish the shared row height over several lines of content."
  text
    handle: narrative
    content:
      """
      First line \\
      second line

      - Alpha
      - Beta
      """

choice
  handle: short
  name: "Short"
  layout: card
  cost: 100
  text
    handle: description
    content: "Short body."

choice
  handle: long
  name: "Long"
  layout: card
  cost: 100
  text
    handle: description
    content: "A deliberately longer body that wraps over several lines and establishes the Grid row height."

choice
  handle: featured
  name: "Featured"
  layout: card
  cost: 100
  text
    handle: description
    content: "A full-width final card."

section-layout
  handle: section_grid
  stack
    grid
      columns: 2
      column-weight: 2
      column-weight: 1
      choice: short_field
      choice: long_field
      choice
        target: featured_field
        column-span: 2
    inline
      stack
        grow: 1
        text
          target: roll
          grow: 1
        text
          target: pay
          grow: 1
      text
        target: world
        grow: 1
    text
      target: narrative
      list-marker: dash
      list-indent: sm
      list-gap: xs

choice-layout
  handle: card
  stack
    padding: sm
    slot: name
    slot
      target: cost
      cost-density: compact
    text: description
    slot
      target: control
      control-density: compact
`,
    },
  });
  const fixture = createDenseTrackerFixture();
  const state = emptyActorEntryState();
  const actions: TrackerAction[] = [];
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
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
      dispatch={(action) => actions.push(action)}
    />,
  );

  await expect.element(page.getByText("Short", { exact: true })).toBeVisible();
  const cards = [
    ...document.querySelectorAll<HTMLElement>(
      ".jump-layout-grid > [data-layout-kind='choice'] > article",
    ),
  ];
  expect(cards).toHaveLength(3);
  const cardHeights = cards
    .slice(0, 2)
    .map((card) => card.getBoundingClientRect().height);
  expect(
    Math.max(...cardHeights) - Math.min(...cardHeights),
  ).toBeLessThanOrEqual(1);
  const grid = document.querySelector<HTMLElement>(".jump-layout-grid")!;
  const tracks = getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .map(Number.parseFloat);
  expect(tracks[0] / tracks[1]).toBeCloseTo(2, 1);
  expect(cards[2]!.getBoundingClientRect().width).toBeCloseTo(
    grid.getBoundingClientRect().width,
    0,
  );

  const roll = page.getByText("Roll", { exact: true }).element();
  const pay = page.getByText("Pay", { exact: true }).element();
  const rollBoundary = roll.closest<HTMLElement>("[data-layout-kind='text']")!;
  const payBoundary = pay.closest<HTMLElement>("[data-layout-kind='text']")!;
  expect(
    Math.abs(
      rollBoundary.getBoundingClientRect().height -
        payBoundary.getBoundingClientRect().height,
    ),
  ).toBeLessThanOrEqual(1);
  const narrative = page
    .getByText(/First line/)
    .element()
    .closest<HTMLElement>('[data-layout-kind="text"]')!;
  expect(narrative.querySelector("br")).not.toBeNull();
  expect(
    [...narrative.querySelectorAll("li")].map((item) => item.textContent),
  ).toEqual(["Alpha", "Beta"]);
  expect(narrative.querySelector("ul")?.getAttribute("data-list-marker")).toBe(
    "dash",
  );
  const authoredList = narrative.querySelector<HTMLElement>("ul")!;
  const authoredListItem = authoredList.querySelector<HTMLElement>("li")!;
  expect(getComputedStyle(authoredList).listStyleType).toBe("none");
  expect(getComputedStyle(authoredListItem, "::before").content).toBe('"-"');
  expect(
    Number.parseFloat(getComputedStyle(authoredListItem).paddingInlineStart),
  ).toBeGreaterThan(0);
  expect(authoredListItem.getBoundingClientRect().x).toBeGreaterThanOrEqual(
    narrative.getBoundingClientRect().x,
  );
  authoredList.dataset.listMarker = "disc";
  expect(getComputedStyle(authoredListItem, "::before").content).toBe('"•"');
  authoredList.dataset.listMarker = "dash";
  const shortCard = cards[0]!;
  expect(
    shortCard.querySelector('[data-layout-cost-density="compact"]'),
  ).not.toBeNull();
  const compactControl = shortCard.querySelector<HTMLElement>(
    '[data-layout-control-density="compact"]',
  )!;
  const checkbox = page.getByRole("checkbox", { name: /Short/ }).element();
  expect(compactControl.contains(checkbox)).toBe(true);
  checkbox.focus();
  await userEvent.keyboard(" ");
  expect(actions.some((action) => action.type === "set-choice")).toBe(true);
  const renderer = document.querySelector<HTMLElement>(
    ".format-one-jump-renderer",
  )!;
  renderer.style.width = "30rem";
  await expect
    .poll(() => getComputedStyle(grid).gridTemplateColumns.split(" ").length)
    .toBe(1);
  expect(cards[2]!.getBoundingClientRect().width).toBeCloseTo(
    grid.getBoundingClientRect().width,
    0,
  );
  renderer.style.width = "";
  await page.viewport(414, 800);
  expect(getComputedStyle(grid).gridTemplateColumns.split(" ")).toHaveLength(1);
  expect(cards[2]!.getBoundingClientRect().width).toBeCloseTo(
    grid.getBoundingClientRect().width,
    0,
  );
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    document.documentElement.clientWidth + 1,
  );
});

test("authored Trait layouts own their panel while preserving accessible contrast", async () => {
  const packageItem = canonicalizePackage({
    id: "authored-trait-browser",
    exactHash: "t".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Authored Trait"
  author: "Tester"
  version: "1"

  grant
    kind: trait
    name: "Marked"
    layout: marked_trait

    text
      handle: description
      content: "A local criminal group relentlessly hunts you."

section
  handle: content
  name: "Content"

trait-layout
  handle: marked_trait

  stack
    padding: sm
    background: "#404040"
    border-color: "#00ffff"
    border-width: thin
    border-style: solid
    text-color: "#00ffff"
    slot: name
    text: description
`,
    },
  });
  const fixture = createDenseTrackerFixture();
  const state = emptyActorEntryState();
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
    jumperName: "Tester",
  }).runtime.entry.actors.jumper;
  const trait = evaluation.traits[0];
  render(
    <JumpTraitRendererScope
      trait={trait}
      rendererProps={{
        packageItem,
        entryId: "entry",
        actorId: "jumper",
        state,
        evaluation,
        preferences: {
          allowRerolls: fixture.preferences.allowRerolls,
          showAdditionalJumpInformation:
            fixture.preferences.showAdditionalJumpInformation,
          imageAltTextHover: true,
        },
        tags: fixture.tags,
        companions: [],
        gauntletActive: false,
        actions: {
          setChoice: () => undefined,
          setInput: () => undefined,
          setSourceSelections: () => undefined,
          recordChoiceRoll: () => undefined,
          recordSourceRoll: () => undefined,
        },
      }}
    />,
  );

  await expect.element(page.getByText("Marked", { exact: true })).toBeVisible();
  const article = document.querySelector<HTMLElement>(
    ".authored-trait-layout",
  )!;
  const panel = article.querySelector<HTMLElement>(".jump-layout-stack")!;
  expect(getComputedStyle(article).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(getComputedStyle(article).borderWidth).toBe("0px");
  expect(getComputedStyle(panel).backgroundColor).toBe("rgb(64, 64, 64)");
  expect(getComputedStyle(panel).borderColor).toBe("rgb(0, 255, 255)");
  expect(getComputedStyle(panel).borderWidth).toBe("1px");
  expect(getComputedStyle(panel).color).toBe("rgb(0, 255, 255)");
  expect(tagTextContrast("#00ffff", "#404040")).toBeGreaterThanOrEqual(4.5);
});

test("authored Choice Text inherits its explicit layout color", async () => {
  const packageItem = canonicalizePackage({
    id: "authored-choice-text-color-browser",
    exactHash: "c".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Authored Choice Text color"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"
  choice
    handle: marked_field
    target: marked

choice
  handle: marked
  name: "Marked"
  layout: marked_card

  text
    handle: description
    content: "A local criminal group relentlessly hunts you."

choice-layout
  handle: marked_card

  inline
    background: "#404040"
    text-color: "#00ffff"
    slot: name
    text
      target: description
      text-color: "#00ffff"
    slot: control
`,
    },
  });
  const fixture = createDenseTrackerFixture();
  const state = emptyActorEntryState();
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
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
      dispatch={() => undefined}
    />,
  );

  const description = page.getByText(
    "A local criminal group relentlessly hunts you.",
  );
  await expect.element(description).toBeVisible();
  expect(getComputedStyle(description.element()).color).toBe(
    "rgb(0, 255, 255)",
  );
});

test("authored layouts cannot replace the active User Tag profile", async () => {
  const packageItem = canonicalizePackage({
    id: "user-tag-profile-browser",
    exactHash: "u".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "User Tag profile"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"
  choice
    handle: tagged
    target: tagged

choice
  handle: tagged
  name: "Tagged Choice"
  tag: "Pokemon"
  tag: "Adaptive"
  layout: authored_card

choice-layout
  handle: authored_card

  stack
    background: "#20201e"
    text-size: 2xl
    text-color: "#ff0000"
    slot: tags
`,
    },
  });
  const fixture = createDenseTrackerFixture();
  const state = {
    ...emptyActorEntryState(),
    choices: { tagged: true },
  };
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
    jumperName: "Tester",
  }).runtime.entry.actors.jumper;
  const presentation = {
    ...presentationForTagDefinition("#8a2be2", "#ff1493", "gradient"),
    corners: "square" as const,
    weight: "normal" as const,
    fontStyle: "italic" as const,
    decoration: "underline" as const,
    animation: "ghost" as const,
  };
  render(
    <JumpRenderer
      packageItem={packageItem}
      entryId="entry"
      actorId="jumper"
      state={state}
      evaluation={evaluation}
      preferences={fixture.preferences}
      tags={{
        ...fixture.tags,
        pokemon: {
          id: "pokemon",
          label: "Profile Pokémon",
          parent: "miscellaneous",
          aliases: [],
          color: "#8a2be2",
          to: "#ff1493",
          style: "gradient",
          presentation,
        },
        adaptive: {
          id: "adaptive",
          label: "Adaptive Surface",
          parent: "miscellaneous",
          aliases: [],
          color: "#ffffff",
          to: "#ffffff",
          style: "outline",
          presentation: {
            ...presentationForTagDefinition("#ffffff", "#ffffff", "outline"),
            background: "transparent",
            textMode: "auto",
          },
        },
      }}
      companions={[]}
      gauntletActive={false}
      dispatch={() => undefined}
    />,
  );

  await expect
    .element(page.getByText("Profile Pokémon", { exact: true }))
    .toBeVisible();
  const badge = document.querySelector<HTMLElement>(".tag-profile-badge")!;
  expect(badge.textContent).toBe("Profile Pokémon");
  const style = getComputedStyle(badge);
  expect(style.backgroundImage).toContain("linear-gradient");
  expect(style.borderRadius).toBe("0px");
  expect(style.fontWeight).toBe("400");
  expect(style.fontStyle).toBe("italic");
  expect(style.textDecorationLine).toBe("underline");
  expect(badge.classList).toContain("animation-ghost");
  const adaptive = page
    .getByText("Adaptive Surface", { exact: true })
    .element()
    .closest<HTMLElement>(".tag-profile-badge")!;
  await expect.poll(() => adaptive.dataset.renderedSurface).toBe("#20201e");
  expect(getComputedStyle(adaptive).color).toBe("rgb(255, 255, 255)");
});

test("Source limits and Section locks expose accessible disabled states", async () => {
  const packageItem = canonicalizePackage({
    id: "limit-lock-browser",
    exactHash: "m".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Limits and locks"
  author: "Tester"
  version: "1"

section
  handle: flaws
  name: "Flaws"

  choice-source
    handle: choices
    group: flaws
    mode: multi
    max: 1

section
  handle: restricted
  name: "Restricted"
  locked: true

  choice
    handle: restricted_choice
    target: restricted_choice

choice
  handle: first
  name: "First Flaw"
  group: flaws

choice
  handle: second
  name: "Second Flaw"
  group: flaws

choice
  handle: restricted_choice
  name: "Restricted Choice"
  cost: 100
`,
    },
  });
  const fixture = createDenseTrackerFixture();
  const state = {
    ...emptyActorEntryState(),
    sourceSelections: { "flaws:choices": ["first"] },
    choices: { first: true, restricted_choice: true },
  };
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
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
      dispatch={() => undefined}
    />,
  );

  await expect
    .element(page.getByText("Maximum of 1 selections reached", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("checkbox", { name: "Second Flaw" }))
    .toBeDisabled();
  const restricted = page
    .getByText("Restricted Choice", { exact: true })
    .element()
    .closest<HTMLElement>(".rendered-jump-section")!;
  expect(restricted.getAttribute("aria-disabled")).toBe("true");
  expect(
    restricted.querySelector<HTMLFieldSetElement>("fieldset")!.disabled,
  ).toBe(true);
  expect(evaluation.choices.restricted_choice.active).toBe(false);
  expect(evaluation.balance).toBe(1000);
});

test("an authored source control keeps its geometry when a pick limit disables it", async () => {
  const packageItem = canonicalizePackage({
    id: "authored-limit-browser",
    exactHash: "l".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Authored limits"
  author: "Tester"
  version: "1"

section
  handle: flaws
  name: "Flaws"
  layout: flaws_layout

  choice-source
    handle: choices
    group: flaws
    mode: multi
    max: 1

choice
  handle: first
  name: "First Flaw"
  group: flaws

choice
  handle: second
  name: "Second Flaw"
  group: flaws
`,
      "layout.jdef": `section-layout
  handle: flaws_layout

  stack
    expand
      source: choices
      using: flaw_card

choice-layout
  handle: flaw_card

  inline
    gap: xs
    slot: name
    slot
      target: control
      control-adornments: false
`,
    },
  });
  const fixture = createDenseTrackerFixture();
  function AuthoredLimitHarness() {
    const [state, dispatch] = useReducer(
      (
        current: ReturnType<typeof emptyActorEntryState>,
        action: TrackerAction,
      ) =>
        action.type === "set-source-selections"
          ? {
              ...current,
              sourceSelections: {
                ...current.sourceSelections,
                [action.sourceKey]: action.value,
              },
            }
          : current,
      undefined,
      emptyActorEntryState,
    );
    const evaluation = evaluateChain({
      order: ["entry"],
      packageIdByEntry: { entry: packageItem.id },
      packages: { [packageItem.id]: packageItem },
      jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
      jumperName: "Tester",
    }).runtime.entry.actors.jumper;
    return (
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
        dispatch={dispatch}
      />
    );
  }
  render(<AuthoredLimitHarness />);

  const secondControl = page.getByRole("checkbox", { name: "Second Flaw" });
  await expect.element(secondControl).toBeInTheDocument();
  const secondActions = secondControl
    .element()
    .closest(".default-choice-actions") as HTMLElement;
  const widthBeforeLimit = secondActions.getBoundingClientRect().width;
  await userEvent.click(page.getByRole("checkbox", { name: "First Flaw" }));

  const status = page.getByText("Maximum of 1 selections reached", {
    exact: true,
  });
  await expect.element(status).toBeInTheDocument();
  const statusNode = document.querySelector<HTMLElement>(
    ".authored-choice-layout .source-option-limit-status",
  );
  expect(statusNode?.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  expect(statusNode?.getBoundingClientRect().height).toBeLessThanOrEqual(1);
  await expect.element(secondControl).toBeDisabled();
  const widthAfterLimit = (
    secondControl.element().closest(".default-choice-actions") as HTMLElement
  ).getBoundingClientRect().width;
  expect(Math.abs(widthAfterLimit - widthBeforeLimit)).toBeLessThanOrEqual(1);
  const actionWidths = [...document.querySelectorAll(".authored-choice-layout")]
    .map((card) => card.querySelector(".default-choice-actions"))
    .filter((actions): actions is HTMLElement => actions instanceof HTMLElement)
    .map((actions) => actions.getBoundingClientRect().width);
  expect(actionWidths).toHaveLength(2);
  expect(Math.abs(actionWidths[0] - actionWidths[1])).toBeLessThanOrEqual(1);
});

test("Cost badges retain base price and discount provenance", async () => {
  const packageItem = canonicalizePackage({
    id: "discount-badge-browser",
    exactHash: "q".repeat(64),
    files: {
      "jump.jdef": `jump
  format: 1
  name: "Discount badges"
  author: "Tester"
  version: "1"

section
  handle: content
  name: "Content"
  choice
    handle: origin
    target: origin
  choice
    handle: skill
    target: skill

choice
  handle: origin
  name: "Small Town"
  discount
    group: skills
    mode: percent
    amount: 50

choice
  handle: skill
  name: "Physical Fitness"
  group: skills
  cost: 100
`,
    },
  });
  const fixture = createDenseTrackerFixture();
  const state = {
    ...emptyActorEntryState(),
    choices: { origin: true, skill: false },
  };
  const evaluation = evaluateChain({
    order: ["entry"],
    packageIdByEntry: { entry: packageItem.id },
    packages: { [packageItem.id]: packageItem },
    jumpState: { entry: { actors: { jumper: state }, appliedGauntlet: [] } },
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
      dispatch={() => undefined}
    />,
  );

  const skillName = page.getByText("Physical Fitness", { exact: true });
  await expect.element(skillName).toBeVisible();
  const card = skillName
    .element()
    .closest<HTMLElement>(".default-choice-card")!;
  const badge = card.querySelector<HTMLElement>(".cost-badge")!;
  expect(badge.textContent).toContain("100 CP");
  expect(badge.textContent).toContain("50 CP");
  expect(badge.getAttribute("title")).toBe("Discounted by Small Town");
  expect(badge.getAttribute("aria-label")).toBe(
    "Base price 100 CP; resolved price 50 CP. Discounted by Small Town.",
  );
  expect(
    badge.querySelector<HTMLElement>(".cost-badge-original"),
  ).not.toBeNull();
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

test("renderer controls preserve mutation callback ordering and payloads", async () => {
  const actions: TrackerAction[] = [];
  render(<ControlHarness actionLog={actions} />);

  await userEvent.fill(page.getByPlaceholder("Primary response"), "Answer");
  await userEvent.fill(page.getByPlaceholder("Follow-up response"), "Detail");
  const promptCard = page
    .getByPlaceholder("Primary response")
    .element()
    .closest(".default-choice-card");
  const clear = promptCard?.querySelector<HTMLButtonElement>(
    "button.secondary-control",
  );
  expect(clear).toBeDefined();
  await userEvent.click(clear!);

  expect(
    actions.map((action) =>
      action.type === "set-choice"
        ? [action.type, action.choiceHandle, action.value]
        : action.type === "set-input"
          ? [action.type, action.choiceHandle, action.inputHandle, action.value]
          : [action.type],
    ),
  ).toEqual([
    ["set-choice", "prompt", "Answer"],
    ["set-input", "prompt", "follow_up", "Detail"],
    ["set-choice", "prompt", null],
  ]);
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

test("isolated radar values form visible spikes without drawing zero nodes", async () => {
  const fixture = createDenseTrackerFixture();
  render(
    <StaticTagRadar
      counts={{
        social: 0,
        mental: 3,
        spiritual: 0,
        magic: 0,
        meta: 0,
        stealth: 2,
        physical: 0,
        combat: 0,
        defense: 0,
        crafting: 0,
        technology: 0,
        miscellaneous: 0,
      }}
      tags={fixture.tags}
      label="Sparse perk category radar"
    />,
  );
  await expect
    .element(page.getByRole("img", { name: "Sparse perk category radar" }))
    .toBeVisible();

  const points = document
    .querySelector("polygon.radar-area")!
    .getAttribute("points")!
    .split(" ")
    .map((point) => point.split(",").map(Number));
  const doubledArea = Math.abs(
    points.reduce((area, [x, y], index) => {
      const [nextX, nextY] = points[(index + 1) % points.length];
      return area + x * nextY - nextX * y;
    }, 0),
  );
  expect(doubledArea / 2).toBeGreaterThan(100);

  expect(document.querySelectorAll("circle.radar-point")).toHaveLength(2);
  expect(
    [...document.querySelectorAll("circle.radar-point title")].map(
      (title) => title.textContent,
    ),
  ).toEqual(["Mental: 3 perks", "Stealth: 2 perks"]);
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

test("a saved entry whose exact package is unavailable renders a recoverable Chain state", async () => {
  render(<UnavailablePackageTrackerHarness />);
  await expect
    .element(
      page.getByText("Unavailable Jump package", { exact: true }).first(),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByText(
        "This exact package is unavailable. Stored selections are preserved until it is restored.",
        { exact: true },
      ),
    )
    .toBeVisible();
  const activeRailEntry = document.querySelector<HTMLButtonElement>(
    '.chain-jump-select[aria-pressed="true"]',
  );
  expect(activeRailEntry?.textContent).toContain("Unavailable Jump package");
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

test("built-in and Mock package actions fill cards without a remove action", async () => {
  render(<NonRemovablePackageTrackerHarness />);
  await page.getByRole("tab", { name: "Library" }).click();
  const cards = [
    page.getByText("Built-in ·", { exact: false }).first().element(),
    page.getByText("Mock ·", { exact: false }).first().element(),
  ].map((label) => label.closest<HTMLElement>(".chain-library-card")!);

  for (const card of cards) {
    const actions = card.querySelector<HTMLElement>(".chain-library-actions")!;
    const action = actions.querySelector<HTMLButtonElement>("button")!;
    expect(actions.querySelector(".chain-library-remove")).toBeNull();
    expect(
      Math.abs(
        action.getBoundingClientRect().width -
          actions.getBoundingClientRect().width,
      ),
    ).toBeLessThanOrEqual(0.1);
  }
});

test("an imported package has an adjacent square remove action and a confirmed removal path", async () => {
  render(<ImportedPackageTrackerHarness />);
  await page.getByRole("tab", { name: "Library" }).click();
  const card = page
    .getByText("Threshold of a Thousand Roads", { exact: false })
    .element()
    .closest<HTMLElement>(".chain-library-card")!;
  const open = card.querySelector<HTMLButtonElement>(
    ".chain-library-actions > button:first-child",
  )!;
  const remove = card.querySelector<HTMLButtonElement>(
    ".chain-library-remove",
  )!;
  const openBounds = open.getBoundingClientRect();
  const removeBounds = remove.getBoundingClientRect();
  expect(
    Math.abs(
      openBounds.top +
        openBounds.height / 2 -
        (removeBounds.top + removeBounds.height / 2),
    ),
  ).toBeLessThanOrEqual(1);
  expect(removeBounds.left).toBeGreaterThan(openBounds.right);
  expect(Math.abs(removeBounds.height - openBounds.height)).toBeLessThanOrEqual(
    0.1,
  );
  expect(
    Math.abs(removeBounds.width - removeBounds.height),
  ).toBeLessThanOrEqual(1);
  expect(getComputedStyle(remove.querySelector("span")!).fontSize).toBe("20px");

  await page
    .getByRole("button", {
      name: "Remove imported package Threshold of a Thousand Roads from the library",
    })
    .click();
  const review = page.getByRole("dialog", {
    name: "Remove Threshold of a Thousand Roads",
  });
  await expect
    .element(review)
    .toHaveTextContent("will also remove the 1 chain entity");
  await review
    .getByRole("button", { name: "Remove package and 1 chain entity" })
    .click();
  await expect.element(card).not.toBeInTheDocument();
  await page.getByRole("tab", { name: "Chain", exact: true }).click();
  await expect
    .element(
      page.getByRole("button", { name: /Threshold of a Thousand Roads/ }),
    )
    .not.toBeInTheDocument();
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
