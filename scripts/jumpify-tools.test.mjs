import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { createCanvas } from "@napi-rs/canvas";
import { PNG } from "pngjs";
import {
  addOutputBytes,
  hashSource,
  naturalCompare,
  prepareWorkspace,
  sourceFiles,
} from "../.agents/jumpify/scripts/workspace-lib.mjs";
import {
  duplicateSemanticSlotErrors,
  hasMatchingFacsimilePanel,
  interactionContractErrors,
} from "../.agents/jumpify/scripts/interaction-contracts.mjs";
import {
  avoidableActionRailWrap,
  excessiveImageLetterboxing,
  excessiveActionRailSlack,
  excessiveResponsiveHeight,
  facsimileCropSeamFindings,
  facsimileSourceRowMismatches,
  facsimileSourceRows,
  microscopicTextPanel,
} from "../.agents/jumpify/scripts/facsimile-layout-audit.mjs";
import {
  facsimileContentContractErrors,
  facsimileRenderedAlignmentErrors,
} from "../.agents/jumpify/scripts/facsimile-content-audit.mjs";
import {
  experimentEvidencePaths,
  interactionEvidencePaths,
  reviewEvidenceForLedger,
} from "../.agents/jumpify/scripts/review-evidence.mjs";

const repository = resolve(import.meta.dirname, "..");
const tools = join(repository, ".agents", "jumpify", "scripts");
const tsx = join(repository, "node_modules", ".bin", "tsx");

function temporaryDirectory() {
  return mkdtempSync(join(tmpdir(), "jumpify-test-"));
}

test("bounds cumulative rendered output", () => {
  assert.equal(addOutputBytes(40, 2, 42), 42);
  assert.throws(() => addOutputBytes(40, 3, 42), /workspace limit/);
  assert.throws(() => addOutputBytes(-1, 1, 42), /workspace limit/);
});

test("reports avoidable multi-row action rails for independent review", () => {
  assert.deepEqual(
    avoidableActionRailWrap(320, [
      { y: 0, width: 32, height: 28 },
      { y: 0, width: 72, height: 24 },
      { y: 36, width: 64, height: 24 },
    ]),
    { rows: 2, requiredWidth: 184, railWidth: 320 },
  );
  assert.equal(
    avoidableActionRailWrap(160, [
      { y: 0, width: 72, height: 28 },
      { y: 36, width: 96, height: 24 },
    ]),
    null,
  );
  assert.equal(
    avoidableActionRailWrap(320, [
      { y: 0, width: 72, height: 28 },
      { y: 1, width: 96, height: 24 },
    ]),
    null,
  );
});

test("reports detached empty height around action-rail content", () => {
  assert.deepEqual(
    excessiveActionRailSlack(80, [
      { y: 100, height: 20 },
      { y: 100, height: 20 },
    ]),
    {
      railHeight: 80,
      contentHeight: 20,
      unusedHeight: 60,
      allowedUnusedHeight: 24,
    },
  );
  assert.equal(excessiveActionRailSlack(44, [{ y: 100, height: 20 }]), null);
  assert.equal(excessiveActionRailSlack(80, []), null);
});

test("reports text-bearing facsimile panels rendered at microscopic scale", () => {
  assert.deepEqual(
    microscopicTextPanel({
      alt: "Dense source prose containing enough meaningful alt transcription to identify that a low source-pixel scale threatens body-text readability across the panel.",
      naturalWidth: 1600,
      naturalHeight: 240,
      rect: { width: 320, height: 48 },
    }),
    {
      alt: "Dense source prose containing enough meaningful alt transcription to identify that a low source-pixel scale threatens body-text readability across the panel.",
      scale: 0.2,
      minimumScale: 0.25,
      reason: "dense text at low scale",
      rendered: { width: 320, height: 48 },
      natural: { width: 1600, height: 240 },
    },
  );
  assert.equal(
    microscopicTextPanel({
      alt: "Readable source prose",
      naturalWidth: 800,
      naturalHeight: 160,
      rect: { width: 400, height: 80 },
    }),
    null,
  );
  assert.equal(
    microscopicTextPanel({
      alt: "Large decorative heading with one short line.",
      naturalWidth: 1600,
      naturalHeight: 400,
      rect: { width: 320, height: 80 },
    }),
    null,
  );
});

test("reports text-bearing banners letterboxed into shallow contain boxes", () => {
  assert.deepEqual(
    excessiveImageLetterboxing({
      alt: "A complete source banner with instructions.",
      objectFit: "contain",
      naturalWidth: 1920,
      naturalHeight: 268,
      rect: { width: 1360, height: 80 },
    }),
    {
      alt: "A complete source banner with instructions.",
      objectFit: "contain",
      minimumAxisUse: 0.7,
      inlineUse: 0.421,
      blockUse: 1,
      rendered: { width: 1360, height: 80 },
      content: { width: 573.13, height: 80 },
    },
  );
  assert.equal(
    excessiveImageLetterboxing({
      alt: "Natural banner",
      objectFit: "contain",
      naturalWidth: 1920,
      naturalHeight: 268,
      rect: { width: 960, height: 134 },
    }),
    null,
  );
});

test("reports extreme responsive Section height inflation", () => {
  assert.deepEqual(
    excessiveResponsiveHeight(
      { width: 1920, height: 2160 },
      { width: 720, height: 3398 },
    ),
    {
      ratio: 4.195,
      maximumRatio: 3,
      equalWidthSourceHeight: 810,
      renderedHeight: 3398,
    },
  );
  assert.equal(
    excessiveResponsiveHeight(
      { width: 1920, height: 2160 },
      { width: 720, height: 1800 },
    ),
    null,
  );
});

test("facsimile content contracts enforce semantic identity, grants, Tags, and dynamic ownership", () => {
  const canonical = {
    grants: [
      {
        kind: "item",
        name: { base: "Bag" },
        text: [{ handle: "description", content: { base: "Bigger inside." } }],
      },
      {
        kind: "trait",
        name: { base: "Jump Terms" },
        text: [{ handle: "description", content: { base: "Ten years." } }],
      },
    ],
    choices: [
      {
        handle: "starter_name",
        name: { base: "Starter Pokémon" },
        layout: "panel_text",
        tags: ["Starter"],
        images: [
          {
            handle: "source_panel",
            src: "panels/starter-name.png",
            alt: { base: "Starter name panel" },
          },
        ],
        text: [
          {
            handle: "description",
            content: { base: "Choose the species of your starter Pokémon." },
          },
        ],
        grants: [
          {
            kind: "companion",
            handle: "starter",
            name: { base: "{{species}} (Starter)" },
            text: [
              {
                handle: "description",
                content: { base: "Your chosen starter Pokémon." },
              },
            ],
          },
        ],
      },
      {
        handle: "shiny",
        name: { base: "Shiny" },
        layout: "panel_toggle",
        tags: ["Aesthetic"],
        images: [
          {
            handle: "source_panel",
            src: "panels/shiny.png",
            alt: { base: "Shiny panel" },
          },
        ],
        text: [
          {
            handle: "description",
            content: { base: "Your starter is a Shiny Pokémon." },
          },
        ],
        grants: [
          {
            kind: "perk",
            name: { base: "Shiny" },
            companion: "starter",
            text: [
              {
                handle: "description",
                content: { base: "Your starter is Shiny." },
              },
            ],
          },
        ],
      },
    ],
    layouts: [
      {
        handle: "panel_text",
        root: {
          kind: "inline",
          children: [
            { kind: "image", target: "source_panel", children: [] },
            { kind: "slot", target: "control", children: [] },
            { kind: "slot", target: "tags", children: [] },
            { kind: "slot", target: "cost", children: [] },
          ],
        },
      },
      {
        handle: "panel_toggle",
        root: {
          kind: "inline",
          children: [
            { kind: "image", target: "source_panel", children: [] },
            { kind: "slot", target: "control", children: [] },
            { kind: "slot", target: "tags", children: [] },
            { kind: "slot", target: "cost", children: [] },
          ],
        },
      },
    ],
  };
  const ledger = {
    entries: [
      {
        id: "intro_kit",
        page: 1,
        sourceKind: "prose",
        transcription: "JUMP TERMS. TEN YEARS. BAG. BIGGER INSIDE.",
      },
      {
        id: "starter_name",
        page: 1,
        sourceKind: "choice",
        rect: { x: 0, y: 0, width: 100, height: 40 },
        transcription: "STARTER. CHOOSE THE SPECIES OF YOUR STARTER POKÉMON.",
      },
      {
        id: "starter_shiny",
        page: 1,
        sourceKind: "choice",
        rect: { x: 110, y: 0, width: 100, height: 40 },
        transcription: "SHINY. YOUR STARTER IS A SHINY POKÉMON.",
      },
    ],
    sourcePages: [{ page: 1, sectionHandles: ["other", "starter"] }],
    sections: [{ handle: "starter", sourcePages: [1], renderIndex: 1 }],
    interactionContracts: [
      {
        entryIds: ["starter_name", "starter_shiny"],
        section: "starter",
      },
    ],
    assets: [
      {
        page: 1,
        kind: "panel",
        package: true,
        output: "panels/starter-name.png",
        alt: "Starter name panel",
        rect: { x: 0, y: 0, width: 100, height: 40 },
      },
      {
        page: 1,
        kind: "panel",
        package: true,
        output: "panels/shiny.png",
        alt: "Shiny panel",
        rect: { x: 110, y: 0, width: 100, height: 40 },
      },
    ],
    facsimileContracts: {
      semanticNames: [
        {
          handle: "starter_name",
          sourceEntry: "starter_name",
          sourceText: "STARTER",
          semanticName: "Starter Pokémon",
          sourceEffectText: "CHOOSE THE SPECIES OF YOUR STARTER POKÉMON.",
          liveDescription: "Choose the species of your starter Pokémon.",
          normalizationNote:
            "Adds the source-defined Pokémon role to the semantic label.",
        },
        {
          handle: "shiny",
          sourceEntry: "starter_shiny",
          sourceText: "SHINY",
          semanticName: "Shiny",
          sourceEffectText: "YOUR STARTER IS A SHINY POKÉMON.",
          liveDescription: "Your starter is a Shiny Pokémon.",
        },
      ],
      grantInventory: {
        entryDecisions: [
          {
            entryId: "intro_kit",
            dispositions: ["jump-grant"],
            reason: "The prose gives the Jumper a durable Bag.",
            grantKeys: ["trait:Jump Terms", "item:Bag"],
          },
          {
            entryId: "starter_name",
            dispositions: ["choice-grant"],
            reason: "The entered species creates the Starter companion.",
          },
          {
            entryId: "starter_shiny",
            dispositions: ["choice-grant"],
            reason: "The Choice grants the Starter-owned Shiny perk.",
          },
        ],
        sourceEntryIds: ["intro_kit"],
        status: "complete",
        note: "Reviewed the complete starting kit.",
        grants: [
          {
            entryId: "intro_kit",
            kind: "item",
            name: "Bag",
            description: "Bigger inside.",
          },
          {
            entryId: "intro_kit",
            kind: "trait",
            name: "Jump Terms",
            description: "Ten years.",
          },
        ],
      },
      dynamicEntities: [
        {
          choiceHandle: "starter_name",
          kind: "companion",
          grantHandle: "starter",
          visibleNameTemplate: "{{species}} (Starter)",
          contextLabel: "Starter",
          upgradeHandles: ["shiny"],
          creationEvidence: "verification/starter-control.png",
          trackerEvidence: "verification/starter-companions-tab.png",
          upgradeEvidence: "verification/starter-shiny-owned.png",
        },
      ],
      tagPlacements: [
        {
          choiceHandle: "starter_name",
          decision: "placed",
          tags: ["Starter"],
          layoutHandle: "panel_text",
          railOrder: ["control", "tags", "cost"],
        },
        {
          choiceHandle: "shiny",
          decision: "placed",
          tags: ["Aesthetic"],
          layoutHandle: "panel_toggle",
          railOrder: ["control", "tags", "cost"],
        },
      ],
      alignmentRelationships: [
        {
          id: "starter_pair",
          entryIds: ["starter_name", "starter_shiny"],
          sourceRelation: "The two panels share one horizontal row.",
          relation: "same-row",
          width: 1440,
          sourceBounds: [
            { x: 0, y: 0, width: 100, height: 40 },
            { x: 110, y: 0, width: 100, height: 40 },
          ],
          renderBounds: [
            { x: 0, y: 0, width: 400, height: 100 },
            { x: 410, y: 0, width: 400, height: 100 },
          ],
          status: "pass",
          evidence: "verification/alignment.png",
        },
      ],
      independentReview: {
        reviewer: "clean-context-agent",
        status: "pass",
        evidence: "verification/independent-review.md",
        findings: [
          {
            id: "tag_spacing",
            description: "The initial Tag spacing finding was corrected.",
            status: "resolved",
            evidence: "verification/tag-spacing.png",
          },
        ],
      },
    },
  };

  assert.deepEqual(
    facsimileContentContractErrors(ledger, canonical, { complete: true }),
    [],
  );
  assert.deepEqual(
    ledger.facsimileContracts.grantInventory.entryDecisions[0].grantKeys,
    ["trait:Jump Terms", "item:Bag"],
    "validation must not mutate the converter-authored grant order",
  );
  const independentFacts = reviewEvidenceForLedger(
    { ...ledger, mode: "facsimile", mechanics: [] },
    "a".repeat(64),
  );
  assert.equal(
    independentFacts.facsimileSemantics.semanticNames[1].semanticName,
    "Shiny",
  );
  assert.equal(
    JSON.stringify(independentFacts).includes("independentReview"),
    false,
  );

  const shouted = structuredClone(canonical);
  shouted.choices[1].name.base = "SHINY";
  shouted.choices[1].grants[0].name.base = "SHINY";
  assert(
    facsimileContentContractErrors(ledger, shouted).some((error) =>
      error.includes("all-caps display typography"),
    ),
  );

  const missingTagSlot = structuredClone(canonical);
  missingTagSlot.layouts[1].root.children =
    missingTagSlot.layouts[1].root.children.filter(
      (node) => node.target !== "tags",
    );
  assert(
    facsimileContentContractErrors(ledger, missingTagSlot).some((error) =>
      error.includes("has no live tags slot"),
    ),
  );

  const severedPanel = structuredClone(canonical);
  severedPanel.layouts[0].root.children =
    severedPanel.layouts[0].root.children.filter(
      (node) => node.target !== "source_panel",
    );
  assert(
    facsimileContentContractErrors(ledger, severedPanel).some((error) =>
      error.includes("does not render its intact source panel"),
    ),
  );

  const decomposedLedger = structuredClone(ledger);
  decomposedLedger.facsimileContracts.semanticNames[1].panelStrategy =
    "measured-fragments";
  decomposedLedger.facsimileContracts.semanticNames[1].sourcePanelAssets = [
    "panels/shiny-title.png",
    "panels/shiny-effect.png",
  ];
  decomposedLedger.facsimileContracts.semanticNames[1].decompositionReason =
    "The intact effect prose falls below the measured narrow readability floor.";
  decomposedLedger.assets.splice(
    1,
    1,
    {
      page: 1,
      kind: "panel",
      package: true,
      output: "panels/shiny-title.png",
      alt: "Shiny title",
      rect: { x: 110, y: 0, width: 100, height: 20 },
    },
    {
      page: 1,
      kind: "panel",
      package: true,
      output: "panels/shiny-effect.png",
      alt: "Your starter is a Shiny Pokémon.",
      rect: { x: 110, y: 20, width: 100, height: 20 },
    },
  );
  const decomposedCanonical = structuredClone(canonical);
  decomposedCanonical.choices[1].images = [
    {
      handle: "source_title",
      src: "panels/shiny-title.png",
      alt: { base: "Shiny title" },
    },
    {
      handle: "source_effect",
      src: "panels/shiny-effect.png",
      alt: { base: "Your starter is a Shiny Pokémon." },
    },
  ];
  decomposedCanonical.layouts[1].root.children = [
    { kind: "image", target: "source_title", children: [] },
    { kind: "image", target: "source_effect", children: [] },
    { kind: "slot", target: "control", children: [] },
    { kind: "slot", target: "tags", children: [] },
    { kind: "slot", target: "cost", children: [] },
  ];
  assert.equal(
    facsimileContentContractErrors(decomposedLedger, decomposedCanonical).some(
      (error) =>
        /intact source-panel|measured source fragment|sourcePanelAssets|decompositionReason/.test(
          error,
        ),
    ),
    false,
  );
  decomposedCanonical.layouts[1].root.children =
    decomposedCanonical.layouts[1].root.children.filter(
      (node) => node.target !== "source_effect",
    );
  assert(
    facsimileContentContractErrors(decomposedLedger, decomposedCanonical).some(
      (error) => error.includes("does not render measured source fragment"),
    ),
  );

  const sourceHasNoTag = structuredClone(ledger);
  sourceHasNoTag.facsimileContracts.tagPlacements[1] = {
    choiceHandle: "shiny",
    decision: "not-applicable",
    tags: [],
    reason: "The source supplies no Tag string.",
  };
  assert(
    facsimileContentContractErrors(sourceHasNoTag, canonical).some((error) =>
      error.includes("absence of source Tag strings"),
    ),
  );

  const genericGrantKindTag = structuredClone(ledger);
  genericGrantKindTag.facsimileContracts.tagPlacements[1].tags = ["Companion"];
  assert(
    facsimileContentContractErrors(genericGrantKindTag, canonical).some(
      (error) =>
        error.includes("only repeat a section, cost class, or grant kind"),
    ),
  );

  const paraphrasedDescription = structuredClone(ledger);
  paraphrasedDescription.facsimileContracts.semanticNames[1].liveDescription =
    "Your starter looks different.";
  assert(
    facsimileContentContractErrors(paraphrasedDescription, canonical).some(
      (error) => error.includes("paraphrases or shortens"),
    ),
  );

  const contextFree = structuredClone(ledger);
  contextFree.facsimileContracts.dynamicEntities[0].visibleNameTemplate =
    "{{species}}";
  assert(
    facsimileContentContractErrors(contextFree, canonical).some((error) =>
      error.includes("must include its context label"),
    ),
  );

  const unexplainedRename = structuredClone(ledger);
  delete unexplainedRename.facsimileContracts.semanticNames[0]
    .normalizationNote;
  assert(
    facsimileContentContractErrors(unexplainedRename, canonical).some((error) =>
      error.includes("normalizationNote is required"),
    ),
  );

  const unauthorizedCorrection = structuredClone(ledger);
  unauthorizedCorrection.facsimileContracts.semanticNames[1].semanticName =
    "Advanced Move";
  unauthorizedCorrection.facsimileContracts.semanticNames[1].normalizationNote =
    "Uses conventional grammar.";
  assert(
    facsimileContentContractErrors(unauthorizedCorrection, canonical).some(
      (error) => error.includes("explicit Developer authorization"),
    ),
  );

  const controlOnly = structuredClone(ledger);
  delete controlOnly.facsimileContracts.dynamicEntities[0].trackerEvidence;
  assert(
    facsimileContentContractErrors(controlOnly, canonical).some((error) =>
      error.includes("trackerEvidence is required"),
    ),
  );

  const nameOnlyGrant = structuredClone(canonical);
  nameOnlyGrant.choices[1].grants[0].text = [];
  assert(
    facsimileContentContractErrors(ledger, nameOnlyGrant).some((error) =>
      error.includes("requires a complete live description"),
    ),
  );

  const duplicatedPanelProse = structuredClone(canonical);
  duplicatedPanelProse.choices[1].text = [
    {
      handle: "description",
      content: {
        base: "Your starter is Shiny and visibly sparkles in ordinary light.",
      },
    },
  ];
  duplicatedPanelProse.layouts[1].root = {
    kind: "stack",
    children: [
      { kind: "image", target: "source_panel", children: [] },
      { kind: "text", target: "description", children: [] },
      ...duplicatedPanelProse.layouts[1].root.children,
    ],
  };
  const duplicatedPanelLedger = structuredClone(ledger);
  duplicatedPanelLedger.entries[2].transcription =
    "Shiny. Your starter is Shiny and visibly sparkles in ordinary light.";
  assert(
    facsimileContentContractErrors(
      duplicatedPanelLedger,
      duplicatedPanelProse,
    ).some((error) => error.includes("visibly duplicates its description")),
  );

  const changedJumpGrant = structuredClone(canonical);
  changedJumpGrant.grants[0].text[0].content.base = "A shortened summary.";
  assert(
    facsimileContentContractErrors(ledger, changedJumpGrant).some((error) =>
      error.includes("description does not match its reviewed source contract"),
    ),
  );

  const skippedGrantSweepEntry = structuredClone(ledger);
  skippedGrantSweepEntry.facsimileContracts.grantInventory.entryDecisions =
    skippedGrantSweepEntry.facsimileContracts.grantInventory.entryDecisions.slice(
      0,
      1,
    );
  assert(
    facsimileContentContractErrors(skippedGrantSweepEntry, canonical).some(
      (error) => error.includes("exactly one decision"),
    ),
  );

  const contradictoryGrantSweepEntry = structuredClone(ledger);
  contradictoryGrantSweepEntry.facsimileContracts.grantInventory.entryDecisions[0].dispositions =
    ["jump-grant", "no-grant"];
  assert(
    facsimileContentContractErrors(
      contradictoryGrantSweepEntry,
      canonical,
    ).some((error) => error.includes("cannot combine no-grant")),
  );

  const missingGrantReconciliation = structuredClone(ledger);
  delete missingGrantReconciliation.facsimileContracts.grantInventory
    .entryDecisions[0].grantKeys;
  assert(
    facsimileContentContractErrors(missingGrantReconciliation, canonical).some(
      (error) => error.includes("grantKeys must enumerate every"),
    ),
  );

  const incompleteGrantReconciliation = structuredClone(ledger);
  incompleteGrantReconciliation.facsimileContracts.grantInventory.entryDecisions[0].grantKeys =
    ["item:Wallet"];
  assert(
    facsimileContentContractErrors(
      incompleteGrantReconciliation,
      canonical,
    ).some((error) => error.includes("must exactly reconcile")),
  );

  const missingSharedChoiceGrant = structuredClone(ledger);
  missingSharedChoiceGrant.facsimileContracts.grantInventory.entryDecisions[1].dispositions =
    ["shared-choice-grant"];
  assert(
    facsimileContentContractErrors(missingSharedChoiceGrant, canonical).some(
      (error) => error.includes("sharedEffectText is required"),
    ),
  );
  missingSharedChoiceGrant.facsimileContracts.grantInventory.entryDecisions[1].sharedEffectText =
    "CHOOSE THE SPECIES OF YOUR STARTER POKÉMON.";
  missingSharedChoiceGrant.facsimileContracts.grantInventory.entryDecisions[1].targetHandles =
    ["starter_name"];
  assert(
    facsimileContentContractErrors(missingSharedChoiceGrant, canonical).some(
      (error) => error.includes("does not preserve shared Trait effect"),
    ),
  );

  const paraphrasedJumpGrant = structuredClone(ledger);
  paraphrasedJumpGrant.facsimileContracts.grantInventory.grants[0].description =
    "A spacious bag.";
  assert(
    facsimileContentContractErrors(paraphrasedJumpGrant, canonical).some(
      (error) => error.includes("not an exact contiguous extract"),
    ),
  );

  const misplacedTags = structuredClone(canonical);
  misplacedTags.layouts[0].root.children = [
    { kind: "slot", target: "control", children: [] },
    { kind: "slot", target: "cost", children: [] },
    { kind: "slot", target: "tags", children: [] },
  ];
  assert(
    facsimileContentContractErrors(ledger, misplacedTags).some((error) =>
      error.includes("Control -> Tags -> Cost order"),
    ),
  );
  const sourceRequiredAlternative = structuredClone(ledger);
  sourceRequiredAlternative.facsimileContracts.tagPlacements[0].railOrder = [
    "control",
    "cost",
    "tags",
  ];
  sourceRequiredAlternative.facsimileContracts.tagPlacements[0].reason =
    "The source leaves measured Tag space only after its bottom-right Cost.";
  assert.equal(
    facsimileContentContractErrors(
      sourceRequiredAlternative,
      misplacedTags,
    ).some((error) => error.includes("Control -> Tags -> Cost order")),
    false,
  );

  const compactDiscountedRank = structuredClone(canonical);
  compactDiscountedRank.choices[0].discounts = [
    { group: "discounted_gear", mode: "percent", amount: 50 },
  ];
  compactDiscountedRank.choices[1].groups = ["discounted_gear"];
  compactDiscountedRank.choices[1].costs = [
    { resource: "jump_points", amount: 100, mode: "each" },
  ];
  const costSlot = compactDiscountedRank.layouts[1].root.children.find(
    (node) => node.kind === "slot" && node.target === "cost",
  );
  costSlot.presentation = { costDensity: "compact" };
  assert(
    facsimileContentContractErrors(ledger, compactDiscountedRank).some(
      (error) =>
        error.includes(
          "compact Cost density even though a repeatable discounted total must remain visibly readable",
        ),
    ),
  );

  const rolePerk = structuredClone(canonical);
  rolePerk.choices[1].grants.push({
    kind: "perk",
    name: { base: "Starter" },
    companion: "starter",
  });
  assert(
    facsimileContentContractErrors(ledger, rolePerk).some((error) =>
      error.includes("role as a generic perk"),
    ),
  );

  const stacked = structuredClone(ledger);
  stacked.facsimileContracts.alignmentRelationships[0].renderBounds[1] = {
    x: 0,
    y: 110,
    width: 400,
    height: 100,
  };
  assert(
    facsimileContentContractErrors(stacked, canonical, { complete: true }).some(
      (error) =>
        error.includes("does not preserve its declared rendered relation"),
    ),
  );

  const uneven = structuredClone(ledger);
  uneven.facsimileContracts.alignmentRelationships[0].renderBounds[1].height = 70;
  assert(
    facsimileContentContractErrors(uneven, canonical, { complete: true }).some(
      (error) => error.includes("source-demonstrated bottom-edge alignment"),
    ),
  );

  const selfCertified = structuredClone(ledger);
  selfCertified.facsimileContracts.independentReview.status = "fail";
  selfCertified.facsimileContracts.independentReview.findings[0].status =
    "open";
  assert(
    facsimileContentContractErrors(selfCertified, canonical, {
      complete: true,
    }).some((error) => error.includes("remains open after independent review")),
  );

  const renderedAudit = {
    widths: {
      1440: [
        {
          index: 1,
          imageBounds: [
            {
              alt: "Starter name panel",
              rect: { x: 0, y: 0, width: 400, height: 100 },
            },
            {
              alt: "Shiny panel",
              rect: { x: 410, y: 0, width: 400, height: 100 },
            },
          ],
        },
      ],
    },
  };
  assert.deepEqual(facsimileRenderedAlignmentErrors(ledger, renderedAudit), []);
  renderedAudit.widths[1440][0].imageBounds[1].rect = {
    x: 0,
    y: 110,
    width: 400,
    height: 100,
  };
  assert(
    facsimileRenderedAlignmentErrors(ledger, renderedAudit).some((error) =>
      error.includes("captured DOM geometry"),
    ),
  );

  renderedAudit.widths[1440][0].imageBounds[1].rect = {
    x: 410,
    y: 0,
    width: 400,
    height: 70,
  };
  const unequalCaptured = facsimileRenderedAlignmentErrors(
    uneven,
    renderedAudit,
  );
  assert(
    unequalCaptured.some((error) =>
      error.includes("source-demonstrated bottom-edge alignment"),
    ),
  );
});

test("independent review evidence inventories only direct experiment reports", () => {
  const workspace = temporaryDirectory();
  try {
    const experiments = join(workspace, "verification", "experiments");
    mkdirSync(experiments, { recursive: true });
    writeFileSync(join(experiments, "tracks-report.json"), "{}\n");
    writeFileSync(join(experiments, "notes.json"), "{}\n");
    mkdirSync(join(experiments, "nested"));
    symlinkSync(
      join(experiments, "tracks-report.json"),
      join(experiments, "linked-report.json"),
    );
    assert.deepEqual(experimentEvidencePaths(workspace), [
      "verification/experiments/tracks-report.json",
    ]);
    assert.deepEqual(
      reviewEvidenceForLedger({}, "a".repeat(64), [
        "verification/experiments/tracks-report.json",
      ]).authoritativeExperimentFiles,
      ["verification/experiments/tracks-report.json"],
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("independent review evidence exposes factual unconditional-grant reconciliation", () => {
  const evidence = reviewEvidenceForLedger(
    {
      mode: "facsimile",
      entries: [
        {
          id: "starting_bag",
          page: 1,
          rect: { x: 10, y: 20, width: 30, height: 40 },
          transcription: "A bag, bigger on the inside.",
        },
      ],
      facsimileContracts: {
        grantInventory: {
          grants: [
            {
              entryId: "starting_bag",
              kind: "item",
              name: "Bag",
            },
          ],
          entryDecisions: [
            {
              entryId: "starting_bag",
              dispositions: ["jump-grant"],
              grantKeys: ["item:Bag"],
            },
          ],
        },
      },
    },
    "a".repeat(64),
  );

  assert.deepEqual(evidence.facsimileSemantics.sourceGrantReconciliation, [
    {
      entryId: "starting_bag",
      sourcePage: 1,
      sourceRect: { x: 10, y: 20, width: 30, height: 40 },
      sourceText: "A bag, bigger on the inside.",
      grantKeys: ["item:Bag"],
    },
  ]);
});

test("independent review evidence transitively inventories interaction manifests", () => {
  const workspace = temporaryDirectory();
  try {
    const interactions = join(workspace, "verification", "interactions");
    mkdirSync(interactions, { recursive: true });
    const manifestPath = "verification/interactions/combined.json";
    const manualPath = "verification/interactions/manual.png";
    const rolledPath = "verification/interactions/rolled.png";
    png(join(workspace, manualPath));
    png(join(workspace, rolledPath));
    writeFileSync(
      join(workspace, manifestPath),
      `${JSON.stringify({ manual: manualPath, rolled: rolledPath })}\n`,
    );
    const ledger = { mechanics: [{ evidence: manifestPath }] };
    const authoritative = interactionEvidencePaths(workspace, ledger);
    assert.deepEqual(authoritative, [manifestPath, manualPath, rolledPath]);
    assert.deepEqual(
      reviewEvidenceForLedger(ledger, "a".repeat(64), [], authoritative)
        .authoritativeInteractionFiles,
      [manifestPath, manualPath, rolledPath],
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("interaction contracts enforce native direct scalar controls and required states", () => {
  const bounds = {
    surface: { x: 0, y: 0, width: 320, height: 48 },
    rail: { x: 0, y: 28, width: 320, height: 20 },
    neighbor: { x: 0, y: 52, width: 320, height: 120 },
  };
  const observation = (state, controlValue, resolvedCost) => ({
    controlKind: "number",
    controlValue,
    activationControlKinds: [],
    resolutionStatus: state,
    resolvedCosts: { jump_points: resolvedCost },
    actionSucceeded: state !== "unset",
    bounds: structuredClone(bounds),
    overlaps: [],
  });
  const canonical = {
    sections: [
      {
        handle: "identity",
        sources: [],
        directChoices: [{ handle: "age_field", target: "age" }],
      },
    ],
    choices: [
      {
        handle: "age",
        groups: [],
        selection: "integer",
        resolution: "either",
        costs: [{ resource: "jump_points", amount: 100, mode: "flat" }],
      },
    ],
  };
  const contract = {
    id: "age_control",
    entryIds: ["identity_age"],
    sourcePage: 3,
    sourceBehavior: "Roll or manually choose one age value.",
    section: "identity",
    owner: "choice",
    handle: "age",
    placement: "direct",
    selection: "integer",
    resolution: "either",
    continuity: "none",
    pricing: "rolled-free",
    states: [
      {
        name: "unset",
        evidence: "verification/age-unset.png",
        observation: observation("unset", null, 100),
      },
      {
        name: "manual",
        evidence: "verification/age-manual.png",
        observation: observation("manual", 12, 100),
      },
      {
        name: "rolled",
        evidence: "verification/age-rolled.png",
        observation: observation("rolled", 14, 0),
      },
    ],
    geometry: {
      policy: "stable",
      evidence: "verification/age-geometry.png",
      note: "Outer bounds remain stable.",
    },
  };
  const ledger = {
    entries: [{ id: "identity_age", sourceKind: "choice", handles: ["age"] }],
    interactionContracts: [contract],
  };

  assert.deepEqual(
    interactionContractErrors(ledger, canonical, { complete: true }),
    [],
  );

  const wrongPricing = structuredClone(ledger);
  wrongPricing.interactionContracts[0].pricing = "ordinary";
  assert.ok(
    interactionContractErrors(wrongPricing, canonical, {
      complete: true,
    }).some((error) =>
      /pricing must be rolled-free for a priced either-resolution Choice/.test(
        error,
      ),
    ),
  );

  const splitAge = structuredClone(canonical);
  splitAge.sections[0].sources.push({
    handle: "age_source",
    group: "age_method",
    mode: "multi",
    max: 1,
    resolution: "manual",
  });
  splitAge.sections[0].directChoices = [];
  splitAge.choices[0].handle = "rolled_age";
  splitAge.choices[0].groups = ["age_method"];
  splitAge.choices[0].resolution = "random";
  const errors = interactionContractErrors(ledger, splitAge, {
    complete: true,
  });
  assert.ok(errors.some((error) => /missing Choice age/.test(error)));
  assert.ok(errors.some((error) => /requires direct placement/.test(error)));

  const missingState = structuredClone(ledger);
  missingState.interactionContracts[0].states =
    missingState.interactionContracts[0].states.filter(
      (state) => state.name !== "rolled",
    );
  assert.ok(
    interactionContractErrors(missingState, canonical, {
      complete: true,
    }).some((error) => /missing rolled state/.test(error)),
  );

  const activatedScalar = structuredClone(ledger);
  activatedScalar.interactionContracts[0].states[1].observation.controlKind =
    "checkbox";
  activatedScalar.interactionContracts[0].states[1].observation.activationControlKinds =
    ["checkbox"];
  const activatedErrors = interactionContractErrors(
    activatedScalar,
    canonical,
    { complete: true },
  );
  assert.ok(
    activatedErrors.some((error) => /controlKind expected number/.test(error)),
  );
  assert.ok(
    activatedErrors.some((error) => /generic activation checkbox/.test(error)),
  );

  const reflowed = structuredClone(ledger);
  reflowed.interactionContracts[0].states[1].observation.bounds.surface.height = 72;
  assert.ok(
    interactionContractErrors(reflowed, canonical, { complete: true }).some(
      (error) => /surface geometry changed by 24px/.test(error),
    ),
  );

  const placeholderBounds = structuredClone(ledger);
  placeholderBounds.interactionContracts[0].states[0].observation.bounds.rail =
    { x: 0, y: 0, width: 1, height: 1 };
  assert.ok(
    interactionContractErrors(placeholderBounds, canonical, {
      complete: true,
    }).some((error) => /placeholder, not a measured bound/.test(error)),
  );

  const grouped = structuredClone(canonical);
  grouped.sections[0].sources.push({
    handle: "origin_source",
    group: "origin",
    mode: "single",
    resolution: "manual",
  });
  assert.ok(
    interactionContractErrors(ledger, grouped, {
      requireCoverage: true,
    }).some((error) =>
      /identity:origin_source must have exactly one/.test(error),
    ),
  );

  const duplicatedPlacement = structuredClone(canonical);
  duplicatedPlacement.sections[0].sources.push({
    handle: "age_activation",
    group: "age_activation",
    mode: "single",
    resolution: "manual",
  });
  duplicatedPlacement.choices[0].groups = ["age_activation"];
  assert.ok(
    interactionContractErrors(ledger, duplicatedPlacement, {
      requireCoverage: false,
    }).some((error) =>
      /direct Choice age is also activated through age_activation/.test(error),
    ),
  );
});

test("interaction observations reject unchanged continuity evidence and free changed pricing", () => {
  const bounds = {
    surface: { x: 0, y: 0, width: 320, height: 48 },
    rail: { x: 0, y: 28, width: 320, height: 20 },
  };
  const contract = {
    id: "gender_control",
    entryIds: ["identity_gender"],
    sourcePage: 3,
    sourceBehavior: "Keep the previous value for free or change it for 100 CP.",
    section: "identity",
    owner: "choice",
    handle: "gender",
    placement: "direct",
    selection: "select",
    resolution: "manual",
    continuity: "previous",
    pricing: "continuity-change",
    states: [
      {
        name: "unset",
        evidence: "verification/gender-unset.png",
        observation: {
          controlKind: "select",
          controlValue: "Female",
          activationControlKinds: [],
          resolutionStatus: "unset",
          resolvedCosts: { jump_points: 0 },
          actionSucceeded: false,
          bounds,
          overlaps: [],
        },
      },
      {
        name: "changed",
        evidence: "verification/gender-changed.png",
        observation: {
          controlKind: "select",
          controlValue: "Female",
          activationControlKinds: [],
          resolutionStatus: "changed",
          resolvedCosts: { jump_points: 0 },
          actionSucceeded: true,
          bounds,
          overlaps: [],
        },
      },
    ],
    geometry: {
      policy: "stable",
      evidence: "verification/gender-geometry.png",
      note: "The rail remains fixed.",
    },
  };
  const ledger = {
    entries: [
      {
        id: "identity_gender",
        sourceKind: "choice",
        handles: ["gender"],
      },
    ],
    interactionContracts: [contract],
  };
  const canonical = {
    sections: [
      {
        handle: "identity",
        sources: [],
        directChoices: [{ handle: "gender_field", target: "gender" }],
      },
    ],
    choices: [
      {
        handle: "gender",
        groups: [],
        selection: "select",
        resolution: "manual",
        continuity: "previous",
        costs: [{ resource: "jump_points", amount: 100, mode: "flat" }],
      },
    ],
  };
  const errors = interactionContractErrors(ledger, canonical, {
    complete: true,
  });
  assert.ok(errors.some((error) => /did not change/.test(error)));
  assert.ok(
    errors.some((error) => /must capture a nonzero resolved cost/.test(error)),
  );

  const wrongPricing = structuredClone(ledger);
  wrongPricing.interactionContracts[0].pricing = "ordinary";
  assert.ok(
    interactionContractErrors(wrongPricing, canonical, {
      complete: true,
    }).some((error) =>
      /pricing must be continuity-change for a priced continuity Choice/.test(
        error,
      ),
    ),
  );
});

test("interaction observations reject select values outside the authored option domain", () => {
  const bounds = {
    surface: { x: 0, y: 0, width: 320, height: 48 },
    rail: { x: 0, y: 28, width: 320, height: 20 },
  };
  const ledger = {
    entries: [
      {
        id: "region_free_pick",
        sourceKind: "choice",
        handles: ["free_pick"],
      },
    ],
    interactionContracts: [
      {
        id: "free_pick_control",
        entryIds: ["region_free_pick"],
        sourcePage: 2,
        sourceBehavior: "Choose one named Region.",
        section: "region",
        owner: "choice",
        handle: "free_pick",
        placement: "direct",
        selection: "select",
        resolution: "manual",
        continuity: "none",
        pricing: "ordinary",
        states: [
          {
            name: "unset",
            evidence: "verification/free-pick-unset.png",
            observation: {
              controlKind: "select",
              controlValue: null,
              activationControlKinds: [],
              resolutionStatus: "unset",
              resolvedCosts: { jump_points: 0 },
              actionSucceeded: false,
              bounds,
              overlaps: [],
            },
          },
          {
            name: "manual",
            evidence: "verification/free-pick-manual.png",
            observation: {
              controlKind: "select",
              controlValue: "Female",
              activationControlKinds: [],
              resolutionStatus: "manual",
              resolvedCosts: { jump_points: 0 },
              actionSucceeded: true,
              bounds,
              overlaps: [],
            },
          },
        ],
        geometry: {
          policy: "stable",
          evidence: "verification/free-pick-geometry.png",
        },
      },
    ],
  };
  const canonical = {
    sections: [
      {
        handle: "region",
        sources: [],
        directChoices: [{ handle: "free_pick_field", target: "free_pick" }],
      },
    ],
    choices: [
      {
        handle: "free_pick",
        groups: [],
        selection: "select",
        resolution: "manual",
        continuity: undefined,
        options: [
          { base: "Kanto", variants: [] },
          { base: "Kalos", variants: [] },
        ],
        costs: [],
      },
    ],
  };

  assert.ok(
    interactionContractErrors(ledger, canonical, { complete: true }).some(
      (error) =>
        error.includes(
          'controlValue "Female" is not an authored option for free_pick',
        ),
    ),
  );
});

test("priced either-resolution Sources require rolled-free pricing evidence", () => {
  const bounds = {
    surface: { x: 0, y: 0, width: 640, height: 72 },
    rail: { x: 0, y: 48, width: 640, height: 24 },
  };
  const observation = (state, value, cost) => ({
    controlKind: "radio",
    controlValue: value,
    activationControlKinds: [],
    resolutionStatus: state,
    resolvedCosts: { jump_points: cost },
    actionSucceeded: state !== "unset",
    bounds,
    overlaps: [],
  });
  const canonical = {
    sections: [
      {
        handle: "region",
        sources: [
          {
            handle: "region_source",
            group: "region_group",
            mode: "single",
            resolution: "either",
          },
        ],
        directChoices: [],
      },
    ],
    choices: [
      {
        handle: "kanto",
        groups: ["region_group"],
        selection: "toggle",
        resolution: "manual",
        costs: [{ resource: "jump_points", amount: 100, mode: "flat" }],
      },
    ],
  };
  const contract = {
    id: "region_control",
    entryIds: ["region_kanto"],
    sourcePage: 2,
    sourceBehavior: "Roll a Region for free or select one for 100 CP.",
    section: "region",
    owner: "choice-source",
    handle: "region_source",
    placement: "source",
    selection: "source-members",
    resolution: "either",
    continuity: "none",
    pricing: "rolled-free",
    states: [
      {
        name: "unset",
        evidence: "verification/region-unset.png",
        observation: observation("unset", null, 100),
      },
      {
        name: "manual",
        evidence: "verification/region-manual.png",
        observation: observation("manual", "kanto", 100),
      },
      {
        name: "rolled",
        evidence: "verification/region-rolled.png",
        observation: observation("rolled", "kanto", 0),
      },
    ],
    geometry: {
      policy: "stable",
      evidence: "verification/region-geometry.png",
      note: "The Region header and first card remain fixed.",
    },
  };
  const ledger = {
    entries: [
      {
        id: "region_kanto",
        sourceKind: "choice",
        handles: ["kanto"],
      },
    ],
    interactionContracts: [contract],
  };

  assert.deepEqual(
    interactionContractErrors(ledger, canonical, { complete: true }),
    [],
  );

  const ledgerOnlyMultiSource = structuredClone(ledger);
  for (const state of ledgerOnlyMultiSource.interactionContracts[0].states)
    state.observation.controlKind = "checkbox";
  assert.ok(
    !interactionContractErrors(ledgerOnlyMultiSource, null, {
      complete: true,
    }).some((error) => /controlKind expected radio/.test(error)),
    "ledger-only validation must not assume an unknown Choice Source is single-select",
  );

  ledger.interactionContracts[0].pricing = "ordinary";
  assert.ok(
    interactionContractErrors(ledger, canonical, { complete: true }).some(
      (error) =>
        /pricing must be rolled-free for a priced either-resolution Source/.test(
          error,
        ),
    ),
  );
});

test("non-toggle Source members require a source-evidenced two-stage contract", () => {
  const bounds = {
    surface: { x: 0, y: 0, width: 480, height: 72 },
    rail: { x: 0, y: 48, width: 480, height: 24 },
  };
  const sourceObservation = (state, value, cost) => ({
    controlKind: "radio",
    controlValue: value,
    activationControlKinds: [],
    resolutionStatus: state,
    resolvedCosts: { jump_points: cost },
    actionSucceeded: state !== "unset",
    bounds,
    overlaps: [],
  });
  const textObservation = (state, value) => ({
    controlKind: "text",
    controlValue: value,
    activationControlKinds: ["radio"],
    resolutionStatus: state,
    resolvedCosts: { jump_points: 100 },
    actionSucceeded: state !== "unset",
    bounds,
    overlaps: [],
  });
  const canonical = {
    sections: [
      {
        handle: "starter",
        sources: [
          {
            handle: "starter_source",
            group: "starter_group",
            mode: "single",
            resolution: "either",
          },
        ],
        directChoices: [],
      },
    ],
    choices: [
      {
        handle: "starter_entry",
        groups: ["starter_group"],
        selection: "text",
        resolution: "manual",
        costs: [{ resource: "jump_points", amount: 100, mode: "flat" }],
      },
    ],
  };
  const sourceContract = {
    id: "starter_source_control",
    entryIds: ["starter_entry"],
    sourcePage: 4,
    sourceBehavior: "Choose one starter method or roll it.",
    section: "starter",
    owner: "choice-source",
    handle: "starter_source",
    placement: "source",
    selection: "source-members",
    resolution: "either",
    continuity: "none",
    pricing: "rolled-free",
    states: [
      {
        name: "unset",
        evidence: "verification/starter-unset.png",
        observation: sourceObservation("unset", null, 100),
      },
      {
        name: "manual",
        evidence: "verification/starter-manual.png",
        observation: sourceObservation("manual", "starter_entry", 100),
      },
      {
        name: "rolled",
        evidence: "verification/starter-rolled.png",
        observation: sourceObservation("rolled", "starter_entry", 0),
      },
    ],
    geometry: {
      policy: "stable",
      evidence: "verification/starter-geometry.png",
      note: "The source rail remains stable.",
    },
  };
  const ledger = {
    entries: [
      {
        id: "starter_entry",
        sourceKind: "choice",
        handles: ["starter_entry"],
      },
    ],
    interactionContracts: [sourceContract],
  };

  assert.ok(
    interactionContractErrors(ledger, canonical, {
      complete: true,
    }).some((error) =>
      /requires exactly one source-authored two-stage/.test(error),
    ),
  );

  ledger.interactionContracts.push({
    id: "starter_text_control",
    entryIds: ["starter_entry"],
    sourcePage: 4,
    sourceBehavior:
      "After choosing the source-authored method, enter its distinct value.",
    section: "starter",
    owner: "choice",
    handle: "starter_entry",
    placement: "source",
    sourceHandle: "starter_source",
    sourceActivation: {
      decision: "Choose the starter acquisition method.",
      directInsufficient:
        "The source shows species entry only after that separate method choice.",
      evidence: "verification/source/starter-two-stage.png",
    },
    selection: "text",
    resolution: "manual",
    continuity: "none",
    pricing: "ordinary",
    states: [
      {
        name: "unset",
        evidence: "verification/starter-text-unset.png",
        observation: textObservation("unset", null),
      },
      {
        name: "manual",
        evidence: "verification/starter-text-manual.png",
        observation: textObservation("manual", "Pikachu"),
      },
    ],
    geometry: {
      policy: "intentional-source-reflow",
      evidence: "verification/starter-text-geometry.png",
      note: "The source visibly reveals the species field after choosing the method.",
    },
  });
  assert.deepEqual(
    interactionContractErrors(ledger, canonical, { complete: true }),
    [],
  );
});

test("facsimile Choice panels match one source entry instead of a collection crop", () => {
  const entry = {
    id: "kanto",
    page: 2,
    rect: { x: 20, y: 960, width: 3800, height: 396 },
  };
  assert.equal(
    hasMatchingFacsimilePanel(entry, [
      {
        page: 2,
        rect: { x: 0, y: 900, width: 3840, height: 3000 },
        kind: "panel",
        package: true,
      },
    ]),
    false,
  );
  assert.equal(
    hasMatchingFacsimilePanel(entry, [
      {
        page: 2,
        rect: { ...entry.rect },
        kind: "panel",
        package: true,
      },
    ]),
    true,
  );
});

test("Jumpify layouts reject duplicate live Cost, Control, or Roll slots", () => {
  const canonical = {
    layouts: [
      {
        kind: "choice-layout",
        handle: "duplicated_cost",
        root: {
          kind: "stack",
          children: [
            { kind: "slot", target: "cost", children: [] },
            {
              kind: "inline",
              children: [
                { kind: "slot", target: "control", children: [] },
                { kind: "slot", target: "cost", children: [] },
              ],
            },
          ],
        },
      },
    ],
  };
  assert.deepEqual(duplicateSemanticSlotErrors(canonical), [
    "choice-layout duplicated_cost renders live cost 2 times",
  ]);
});

test("facsimile audits preserve source same-row panel relationships at the primary width", () => {
  const ledger = {
    sourcePages: [
      { page: 3, sectionHandles: ["identity"] },
      { page: 9, sectionHandles: ["shared_a", "shared_b"] },
    ],
    sections: [
      {
        handle: "identity",
        renderIndex: 3,
        sourcePages: [3],
      },
      {
        handle: "shared_a",
        renderIndex: 4,
        sourcePages: [9],
      },
    ],
    entries: [
      {
        id: "age",
        page: 3,
        sourceKind: "choice",
        rect: { x: 0, y: 100, width: 180, height: 80 },
      },
      {
        id: "gender",
        page: 3,
        sourceKind: "choice",
        rect: { x: 200, y: 100, width: 180, height: 80 },
      },
      {
        id: "origin",
        page: 3,
        sourceKind: "choice",
        rect: { x: 0, y: 200, width: 380, height: 100 },
      },
      {
        id: "ambiguous",
        page: 9,
        sourceKind: "choice",
        rect: { x: 0, y: 0, width: 100, height: 50 },
      },
    ],
    assets: [
      {
        page: 3,
        kind: "panel",
        package: true,
        alt: "Age panel",
        rect: { x: 0, y: 100, width: 180, height: 80 },
      },
      {
        page: 3,
        kind: "panel",
        package: true,
        alt: "Gender panel",
        rect: { x: 200, y: 100, width: 180, height: 80 },
      },
      {
        page: 3,
        kind: "panel",
        package: true,
        alt: "Origin panel",
        rect: { x: 0, y: 200, width: 380, height: 100 },
      },
      {
        page: 9,
        kind: "panel",
        package: true,
        alt: "Ambiguous panel",
        rect: { x: 0, y: 0, width: 100, height: 50 },
      },
    ],
  };
  const sourceRows = facsimileSourceRows(ledger);
  assert.deepEqual(sourceRows.get(3), [
    { left: "Age panel", right: "Gender panel" },
  ]);
  assert.deepEqual(sourceRows.get(4), []);

  const stacked = facsimileSourceRowMismatches(sourceRows.get(3), [
    {
      alt: "Age panel",
      rect: { x: 0, y: 0, width: 180, height: 80 },
    },
    {
      alt: "Gender panel",
      rect: { x: 0, y: 100, width: 180, height: 80 },
    },
  ]);
  assert.equal(stacked.length, 1);
  assert.match(stacked[0].reason, /share a row but rendered panels stack/);

  assert.deepEqual(
    facsimileSourceRowMismatches(sourceRows.get(3), [
      {
        alt: "Age panel",
        rect: { x: 0, y: 0, width: 180, height: 80 },
      },
      {
        alt: "Gender panel",
        rect: { x: 200, y: 0, width: 180, height: 80 },
      },
    ]),
    [],
  );

  const cleanEdge = {
    possibleStructuralEdge: true,
    dominantRatio: 1,
  };
  const cutEdge = {
    possibleStructuralEdge: false,
    dominantRatio: 0.8,
  };
  const splitSharedSentence = facsimileCropSeamFindings({
    assets: [
      {
        id: "age_panel",
        page: 3,
        rect: { x: 0, y: 100, width: 200, height: 80 },
        edges: { right: cutEdge, left: cleanEdge },
      },
      {
        id: "gender_panel",
        page: 3,
        rect: { x: 201, y: 100, width: 200, height: 80 },
        edges: { right: cleanEdge, left: cleanEdge },
      },
    ],
  });
  assert.equal(splitSharedSentence.length, 1);
  assert.match(splitSharedSentence[0].reason, /clean vertical structural edge/);
  assert.deepEqual(
    facsimileCropSeamFindings({
      assets: [
        {
          id: "age_panel",
          page: 3,
          rect: { x: 0, y: 100, width: 200, height: 80 },
          edges: { right: cleanEdge, left: cleanEdge },
        },
        {
          id: "gender_panel",
          page: 3,
          rect: { x: 200, y: 100, width: 200, height: 80 },
          edges: { right: cleanEdge, left: cleanEdge },
        },
      ],
    }),
    [],
  );
});

function png(path, color = "#00ffff", width = 24, height = 16) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
  writeFileSync(path, canvas.toBuffer("image/png"));
}

function jpeg(path, color = "#404040") {
  const canvas = createCanvas(20, 12);
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.fillRect(0, 0, 20, 12);
  writeFileSync(path, canvas.toBuffer("image/jpeg"));
}

function pdf(path) {
  const stream = "BT /F1 20 Tf 20 100 Td (Jumpify PDF) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    source += `${String(offset).padStart(10, "0")} 00000 n \n`;
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  writeFileSync(path, source);
}

function run(script, ...arguments_) {
  return execFileSync(process.execPath, [join(tools, script), ...arguments_], {
    cwd: repository,
    encoding: "utf8",
  });
}

test("orders page names naturally and hashes names plus bytes deterministically", () => {
  const root = temporaryDirectory();
  try {
    const pages = join(root, "pages");
    mkdirSync(pages);
    png(join(pages, "page-10.png"), "#101010");
    png(join(pages, "page-2.png"), "#202020");
    jpeg(join(pages, "page-1.jpg"));
    const first = sourceFiles(pages);
    assert.deepEqual(
      first.files.map((file) => file.relativePath),
      ["page-1.jpg", "page-2.png", "page-10.png"],
    );
    assert.deepEqual(
      [...first.files.map((file) => file.relativePath)].sort(naturalCompare),
      ["page-1.jpg", "page-2.png", "page-10.png"],
    );
    const firstHash = hashSource(first.files);
    assert.equal(firstHash, hashSource(sourceFiles(pages).files));
    png(join(pages, "page-2.png"), "#303030");
    assert.notEqual(firstHash, hashSource(sourceFiles(pages).files));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("creates globally numbered resumable workspaces without replacing ledger work", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "My Jump.png");
    png(source);
    const first = prepareWorkspace(source, "semantic", root);
    assert.match(first.workspace, /scratch\/jumpify\/001-my-jump-semantic$/);
    assert.equal(first.manifest.sequence, 1);
    assert.equal(first.manifest.archive, "001-my-jump-semantic.jmp");
    const customLedger = { preserved: true };
    writeFileSync(first.ledgerPath, `${JSON.stringify(customLedger)}\n`);
    const second = prepareWorkspace(source, "semantic", root);
    assert.equal(second.workspace, first.workspace);
    assert.deepEqual(
      JSON.parse(readFileSync(second.ledgerPath, "utf8")),
      customLedger,
    );
    const facsimile = prepareWorkspace(source, "facsimile", root);
    assert.match(
      facsimile.workspace,
      /scratch\/jumpify\/002-my-jump-facsimile$/,
    );
    assert.deepEqual(
      JSON.parse(readFileSync(facsimile.ledgerPath, "utf8")).facsimileContracts,
      {
        semanticNames: [],
        grantInventory: {
          entryDecisions: [],
          sourceEntryIds: [],
          status: "unreviewed",
          note: "",
          grants: [],
        },
        dynamicEntities: [],
        tagPlacements: [],
        alignmentRelationships: [],
        independentReview: {
          reviewer: "clean-context-agent",
          status: "unreviewed",
          evidence: "",
          findings: [],
        },
      },
    );
    png(source, "#303030");
    const changed = prepareWorkspace(source, "semantic", root);
    assert.notEqual(changed.workspace, first.workspace);
    assert.match(changed.workspace, /scratch\/jumpify\/003-my-jump-semantic$/);
    assert.equal(dirname(changed.workspace), dirname(first.workspace));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not repeat a mode already present in the readable source name", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "Already Facsimile.png");
    png(source);
    const prepared = prepareWorkspace(source, "facsimile", root);
    assert.match(
      prepared.workspace,
      /scratch\/jumpify\/001-already-facsimile$/,
    );
    assert.equal(prepared.manifest.archive, "001-already-facsimile.jmp");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("moves a matching legacy workspace into the global sequence", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "Legacy Jump.png");
    png(source);
    const hash = hashSource(sourceFiles(source).files);
    const legacy = join(
      root,
      "scratch",
      "jumpify",
      `legacy-jump-${hash.slice(0, 12)}`,
      "semantic",
    );
    mkdirSync(legacy, { recursive: true });
    writeFileSync(
      join(legacy, "workspace.json"),
      `${JSON.stringify({
        mode: "semantic",
        slug: "legacy-jump",
        sourceHash: hash,
        archive: "legacy-jump-semantic.jmp",
      })}\n`,
    );
    writeFileSync(
      join(legacy, "ledger.json"),
      `${JSON.stringify({ preserved: true })}\n`,
    );
    writeFileSync(join(legacy, "legacy-jump-semantic.jmp"), "archive");
    mkdirSync(join(legacy, "verification"));
    writeFileSync(
      join(legacy, "verification", "package-review.json"),
      `${JSON.stringify({ archive: "legacy-jump-semantic.jmp" })}\n`,
    );

    const prepared = prepareWorkspace(source, "semantic", root);
    assert.match(
      prepared.workspace,
      /scratch\/jumpify\/001-legacy-jump-semantic$/,
    );
    assert.equal(existsSync(legacy), false);
    assert.deepEqual(JSON.parse(readFileSync(prepared.ledgerPath, "utf8")), {
      preserved: true,
    });
    assert.equal(
      existsSync(join(prepared.workspace, "001-legacy-jump-semantic.jmp")),
      true,
    );
    assert.equal(
      JSON.parse(
        readFileSync(
          join(prepared.workspace, "verification", "package-review.json"),
          "utf8",
        ),
      ).archive,
      "001-legacy-jump-semantic.jmp",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("moves the readable hash hierarchy into the global sequence", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "Readable Jump.png");
    png(source);
    const hash = hashSource(sourceFiles(source).files);
    const legacy = join(
      root,
      "scratch",
      "jumpify",
      "readable-jump",
      `facsimile-${hash.slice(0, 12)}`,
    );
    mkdirSync(legacy, { recursive: true });
    writeFileSync(
      join(legacy, "workspace.json"),
      `${JSON.stringify({
        mode: "facsimile",
        slug: "readable-jump",
        sourceHash: hash,
        archive: "readable-jump-facsimile.jmp",
      })}\n`,
    );

    const prepared = prepareWorkspace(source, "facsimile", root);
    assert.match(
      prepared.workspace,
      /scratch\/jumpify\/001-readable-jump-facsimile$/,
    );
    assert.equal(
      existsSync(join(root, "scratch", "jumpify", "readable-jump")),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects symbolic workspace destinations", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "Linked Workspace.png");
    png(source);
    const outside = join(root, "outside");
    mkdirSync(outside);
    const numberedWorkspace = join(
      root,
      "scratch",
      "jumpify",
      "001-linked-workspace-semantic",
    );
    mkdirSync(dirname(numberedWorkspace), { recursive: true });
    symlinkSync(outside, numberedWorkspace, "dir");
    assert.throws(
      () => prepareWorkspace(source, "semantic", root),
      /Symbolic workspace paths are not accepted/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects symbolic inputs and unsupported directory entries", () => {
  const root = temporaryDirectory();
  try {
    const page = join(root, "page.png");
    png(page);
    const link = join(root, "linked.png");
    symlinkSync(page, link);
    assert.throws(() => sourceFiles(link), /Symbolic source paths/);
    const pages = join(root, "pages");
    mkdirSync(pages);
    writeFileSync(join(pages, "notes.txt"), "not a page");
    assert.throws(() => sourceFiles(pages), /only PNG or JPEG/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("bounds ordered page-directory intake", () => {
  const root = temporaryDirectory();
  try {
    const pages = join(root, "pages");
    mkdirSync(pages);
    for (let index = 1; index <= 501; index += 1)
      writeFileSync(join(pages, `${index}.png`), "");
    assert.throws(() => sourceFiles(pages), /limit is 500/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renders PDF, PNG, JPEG, and ordered image-directory sources", async (t) => {
  const root = temporaryDirectory();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const inputs = [];
  const pdfPath = join(root, "source.pdf");
  pdf(pdfPath);
  inputs.push(pdfPath);
  const pngPath = join(root, "source.png");
  png(pngPath);
  inputs.push(pngPath);
  const jpegPath = join(root, "source.jpg");
  jpeg(jpegPath);
  inputs.push(jpegPath);
  const pages = join(root, "pages");
  mkdirSync(pages);
  png(join(pages, "2.png"), "#222222");
  jpeg(join(pages, "10.jpeg"), "#aaaaaa");
  inputs.push(pages);

  for (const input of inputs) {
    const { workspace } = prepareWorkspace(input, "semantic", root);
    run("render-source.mjs", workspace);
    const manifest = JSON.parse(
      readFileSync(join(workspace, "extracted", "pages", "pages.json"), "utf8"),
    );
    assert.equal(manifest.pages.length, input === pages ? 2 : 1);
    assert.ok(
      manifest.pages.every((page) => page.width > 0 && page.height > 0),
    );
    const ledger = JSON.parse(
      readFileSync(join(workspace, "ledger.json"), "utf8"),
    );
    assert.equal(ledger.schemaVersion, 3);
    assert.deepEqual(ledger.interactionContracts, []);
    assert.equal(ledger.sourcePages.length, manifest.pages.length);
    assert.ok(
      ledger.sourcePages.every(
        (page) => page.status === "unreviewed" && page.entryIds.length === 0,
      ),
    );
  }
  const pdfWorkspace = prepareWorkspace(pdfPath, "semantic", root).workspace;
  assert.match(
    readFileSync(
      join(pdfWorkspace, "extracted", "pages", "page-0001.txt"),
      "utf8",
    ),
    /Jumpify PDF/,
  );
});

test("rejects image content that does not match its declared page format", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "false.png");
    writeFileSync(source, "<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const { workspace } = prepareWorkspace(source, "semantic", root);
    const result = spawnSync(
      process.execPath,
      [join(tools, "render-source.mjs"), workspace],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid PNG signature or header/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("crops assets, audits edges, samples colors, and blocks escaping outputs", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "source.png");
    png(source, "#00ffff", 30, 20);
    const { workspace } = prepareWorkspace(source, "semantic", root);
    run("render-source.mjs", workspace);
    const ledgerPath = join(workspace, "ledger.json");
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    ledger.assets.push({
      id: "sample",
      page: 1,
      rect: { x: 2, y: 3, width: 10, height: 8 },
      output: "art/sample.png",
      kind: "artwork",
      alt: "A cyan sample.",
      package: true,
    });
    ledger.colorSamples.push({ id: "cyan", page: 1, x: 5, y: 5, radius: 1 });
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    run("crop-assets.mjs", workspace);
    run("sample-colors.mjs", workspace);
    const crop = PNG.sync.read(
      readFileSync(join(workspace, "project", "assets", "art", "sample.png")),
    );
    assert.deepEqual([crop.width, crop.height], [10, 8]);
    const colors = JSON.parse(
      readFileSync(
        join(workspace, "verification", "color-samples.json"),
        "utf8",
      ),
    );
    assert.equal(colors.samples[0].average, "#00ffff");
    ledger.assets[0].output = "../escape.png";
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    assert.notEqual(
      spawnSync(process.execPath, [join(tools, "crop-assets.mjs"), workspace])
        .status,
      0,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("builds equal-width source and render comparison columns", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "source.png");
    png(source, "#00ffff", 100, 50);
    const { workspace, ledgerPath } = prepareWorkspace(
      source,
      "semantic",
      root,
    );
    run("render-source.mjs", workspace);
    const renderPath = "verification/rendered/1440-section-01.png";
    png(join(workspace, renderPath), "#404040", 40, 30);
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    ledger.comparisons.push({
      id: "introduction_1440",
      section: "introduction",
      width: 1440,
      sourcePage: 1,
      renderPath,
    });
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    run("make-comparison-sheet.mjs", workspace);
    const sheet = PNG.sync.read(
      readFileSync(
        join(workspace, "verification", "comparisons", "introduction_1440.png"),
      ),
    );
    assert.equal(sheet.width, 104);
    const comparisonManifest = JSON.parse(
      readFileSync(
        join(workspace, "verification", "comparison-manifest.json"),
        "utf8",
      ),
    );
    assert.deepEqual(
      comparisonManifest.comparisons[0].displayedSourceSize,
      [40, 20],
    );
    const reviewEvidence = JSON.parse(
      readFileSync(
        join(workspace, "verification", "review-evidence.json"),
        "utf8",
      ),
    );
    assert.equal(reviewEvidence.sourceHash, ledger.sourceHash);
    assert.deepEqual(reviewEvidence.interactionContracts, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validates ledger structure and completion evidence", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "source.png");
    png(source);
    const { workspace, ledgerPath } = prepareWorkspace(
      source,
      "semantic",
      root,
    );
    run("render-source.mjs", workspace);
    run("validate-ledger.mjs", workspace);
    assert.notEqual(
      spawnSync(process.execPath, [
        join(tools, "validate-ledger.mjs"),
        workspace,
        "--complete",
      ]).status,
      0,
    );
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    ledger.sourcePages[0].status = "verified";
    ledger.sourcePages[0].entryIds = ["introduction"];
    ledger.sourcePages[0].sectionHandles = ["introduction"];
    ledger.sections.push({
      handle: "introduction",
      name: "Introduction",
      sourcePages: [1],
      renderIndex: 1,
      status: "complete",
      surfaceTree: "Section > Stack(heading, body)",
    });
    ledger.entries.push({
      id: "introduction",
      page: 1,
      rect: { x: 0, y: 0, width: 24, height: 16 },
      sourceKind: "prose",
      transcription: "Introduction",
      verification: "verified",
      handles: ["introduction"],
      semantic: {},
      presentation: {},
      approximation: "none",
    });
    const interactionEvidence =
      "verification/interactions/introduction-prose.png";
    mkdirSync(dirname(join(workspace, interactionEvidence)), {
      recursive: true,
    });
    png(join(workspace, interactionEvidence));
    ledger.interactionContracts.push({
      id: "introduction_prose",
      entryIds: ["introduction"],
      sourcePage: 1,
      sourceBehavior: "The fixture contains prose and no interaction.",
      section: "introduction",
      owner: "prose",
      placement: "none",
      selection: "none",
      resolution: "none",
      continuity: "none",
      pricing: "none",
      states: [
        {
          name: "prose",
          evidence: interactionEvidence,
          observation: {
            controlKind: "none",
            controlValue: null,
            activationControlKinds: [],
            resolutionStatus: "prose",
            resolvedCosts: {},
            actionSucceeded: true,
            bounds: {},
            overlaps: [],
          },
        },
      ],
      geometry: {
        policy: "stable",
        evidence: interactionEvidence,
        note: "No controls are present.",
      },
    });
    const checks = [
      "structure-and-surfaces",
      "text",
      "artwork-and-crops",
      "costs-and-controls",
      "content-and-semantics",
      "responsive-fit",
    ];
    const comparisonResults = [];
    const widths = {};
    for (const width of [390, 720, 1440]) {
      const screenshot = `verification/rendered/${width}-section-01.png`;
      png(join(workspace, screenshot));
      ledger.comparisons.push({
        id: `introduction_${width}`,
        section: "introduction",
        width,
        sourcePage: 1,
        renderPath: screenshot,
      });
      comparisonResults.push({
        id: `introduction_${width}`,
        status: "created",
        output: `verification/comparisons/introduction_${width}.png`,
      });
      png(
        join(
          workspace,
          "verification",
          "comparisons",
          `introduction_${width}.png`,
        ),
      );
      ledger.acceptance.push(
        ...checks.map((check) => ({
          section: "introduction",
          width,
          check,
          status: "pass",
          evidence: screenshot,
          note: "",
        })),
      );
      widths[String(width)] = [
        {
          index: 1,
          screenshot,
          overflow: [],
          clipped: [],
          missingAlt: [],
          sourceRowMismatches: [],
          lowContrast: [],
          controlBoundaries: [],
          overlappingActionElements: [],
          avoidableActionWraps: [],
          excessiveActionRailSlack: [],
          microscopicTextPanels: [],
          responsiveHeightInflation: [],
          stretchedControls: [],
          cardBoundaries: [],
          contentBoundaries: [],
          viewportBoundaries: [],
        },
      ];
    }
    writeFileSync(join(workspace, "verification", "mechanics.json"), "{}\n");
    ledger.mechanics.push({
      id: "mechanics_review",
      description: "The prose-only fixture has no interactive mechanics.",
      status: "pass",
      evidence: "verification/mechanics.json",
    });
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    writeFileSync(join(workspace, "source-semantic.jmp"), "fixture archive");
    writeFileSync(
      join(workspace, "verification", "package-review.json"),
      `${JSON.stringify({
        status: "ready",
        diagnostics: [],
        archive: "source-semantic.jmp",
      })}\n`,
    );
    writeFileSync(
      join(workspace, "verification", "render-audit.json"),
      `${JSON.stringify({ widths })}\n`,
    );
    writeFileSync(
      join(workspace, "verification", "comparison-manifest.json"),
      `${JSON.stringify({ comparisons: comparisonResults })}\n`,
    );
    writeFileSync(
      join(workspace, ledger.reviewEvidence),
      `${JSON.stringify(reviewEvidenceForLedger(ledger, ledger.sourceHash), null, 2)}\n`,
    );
    run("validate-ledger.mjs", workspace, "--complete");

    const cleanContextEvidence = JSON.parse(
      readFileSync(join(workspace, ledger.reviewEvidence), "utf8"),
    );
    assert.equal(cleanContextEvidence.interactionContracts.length, 1);
    assert.equal(
      cleanContextEvidence.interactionContracts[0].states[0].observation
        .resolutionStatus,
      "prose",
    );
    assert.deepEqual(cleanContextEvidence.authoritativeInteractionFiles, [
      interactionEvidence,
    ]);
    assert.equal(
      JSON.stringify(cleanContextEvidence).includes('"status"'),
      false,
    );

    ledger.gaps.push({
      id: "unsupported_claim",
      requirement: "A claimed limitation needs a reproducible experiment.",
      experiment: "No experiment was preserved.",
      evidence: "verification/assertion.json",
      limitation: "Unknown.",
      fidelityLoss: "Unknown.",
      approximation: "Unknown.",
    });
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    const unsupportedGap = spawnSync(process.execPath, [
      join(tools, "validate-ledger.mjs"),
      workspace,
      "--complete",
    ]);
    assert.notEqual(unsupportedGap.status, 0);
    assert.match(unsupportedGap.stderr.toString(), /minimal experiment report/);
    ledger.gaps = [];
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

    const orphanedEvidence = join(
      workspace,
      "verification",
      "interactions",
      "obsolete.png",
    );
    png(orphanedEvidence);
    const unreferencedEvidenceBeforeReview = spawnSync(process.execPath, [
      join(tools, "validate-ledger.mjs"),
      workspace,
    ]);
    assert.notEqual(unreferencedEvidenceBeforeReview.status, 0);
    assert.match(
      unreferencedEvidenceBeforeReview.stderr.toString(),
      /is not authoritative evidence/,
    );
    const unreferencedEvidence = spawnSync(process.execPath, [
      join(tools, "validate-ledger.mjs"),
      workspace,
      "--complete",
    ]);
    assert.notEqual(unreferencedEvidence.status, 0);
    assert.match(
      unreferencedEvidence.stderr.toString(),
      /is not authoritative evidence/,
    );
    rmSync(orphanedEvidence);

    widths["390"][0].viewportBoundaries.push({
      rect: [0, 0, 420, 100],
      viewport: [390, 1000],
    });
    writeFileSync(
      join(workspace, "verification", "render-audit.json"),
      `${JSON.stringify({ widths })}\n`,
    );
    const unexplainedViewport = spawnSync(process.execPath, [
      join(tools, "validate-ledger.mjs"),
      workspace,
      "--complete",
    ]);
    assert.notEqual(unexplainedViewport.status, 0);
    assert.match(unexplainedViewport.stderr.toString(), /viewportBoundaries/);

    widths["390"][0].viewportBoundaries = [];
    widths["390"][0].overlappingActionElements.push({
      left: "Clear",
      right: "Previous is free",
      overlap: [18, 20],
    });
    writeFileSync(
      join(workspace, "verification", "render-audit.json"),
      `${JSON.stringify({ widths })}\n`,
    );
    const overlappingActions = spawnSync(process.execPath, [
      join(tools, "validate-ledger.mjs"),
      workspace,
      "--complete",
    ]);
    assert.notEqual(overlappingActions.status, 0);
    assert.match(
      overlappingActions.stderr.toString(),
      /overlappingActionElements/,
    );
    widths["390"][0].overlappingActionElements = [];

    widths["1440"][0].avoidableActionWraps.push({
      text: "Age",
      centerDelta: 32,
      requiredWidth: 280,
      surfaceWidth: 640,
    });
    writeFileSync(
      join(workspace, "verification", "render-audit.json"),
      `${JSON.stringify({ widths })}\n`,
    );
    const avoidableWrap = spawnSync(process.execPath, [
      join(tools, "validate-ledger.mjs"),
      workspace,
      "--complete",
    ]);
    assert.notEqual(avoidableWrap.status, 0);
    assert.match(avoidableWrap.stderr.toString(), /avoidableActionWraps/);
    widths["1440"][0].avoidableActionWraps = [];

    widths["390"][0].excessiveActionRailSlack.push({
      text: "Tagged choice",
      railHeight: 80,
      contentHeight: 20,
      unusedHeight: 60,
      allowedUnusedHeight: 24,
    });
    writeFileSync(
      join(workspace, "verification", "render-audit.json"),
      `${JSON.stringify({ widths })}\n`,
    );
    const detachedRail = spawnSync(process.execPath, [
      join(tools, "validate-ledger.mjs"),
      workspace,
      "--complete",
    ]);
    assert.notEqual(detachedRail.status, 0);
    assert.match(detachedRail.stderr.toString(), /excessiveActionRailSlack/);
    widths["390"][0].excessiveActionRailSlack = [];
    writeFileSync(
      join(workspace, "verification", "render-audit.json"),
      `${JSON.stringify({ widths })}\n`,
    );

    const narrowGapEvidence =
      "verification/experiments/narrow-viewport-report.json";
    mkdirSync(dirname(join(workspace, narrowGapEvidence)), { recursive: true });
    writeFileSync(
      join(workspace, narrowGapEvidence),
      `${JSON.stringify({
        id: "narrow_viewport",
        definition: ["grid", "  columns: 2"],
        result: "The valid experiment exceeds 390px.",
        evidence: "verification/rendered/390-section-01.png",
      })}\n`,
    );
    ledger.gaps.push({
      id: "narrow_viewport",
      requirement: "Fit inside the narrow viewport.",
      experiment: "Render the valid layout at 390px.",
      evidence: narrowGapEvidence,
      limitation: "The rendered Section exceeds the viewport.",
      fidelityLoss: "Horizontal scrolling is required.",
      approximation: "Preserve all content at its intrinsic width.",
    });
    ledger.acceptance.find(
      (record) =>
        record.section === "introduction" &&
        record.width === 390 &&
        record.check === "responsive-fit",
    ).status = "gap:narrow_viewport";
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    writeFileSync(
      join(workspace, ledger.reviewEvidence),
      `${JSON.stringify(
        reviewEvidenceForLedger(
          ledger,
          ledger.sourceHash,
          experimentEvidencePaths(workspace),
        ),
        null,
        2,
      )}\n`,
    );
    run("validate-ledger.mjs", workspace, "--complete");

    const incomplete = structuredClone(ledger);
    incomplete.comparisons = incomplete.comparisons.filter(
      (comparison) => comparison.width !== 390,
    );
    writeFileSync(ledgerPath, `${JSON.stringify(incomplete, null, 2)}\n`);
    const missingWidth = spawnSync(process.execPath, [
      join(tools, "validate-ledger.mjs"),
      workspace,
      "--complete",
    ]);
    assert.notEqual(missingWidth.status, 0);
    assert.match(missingWidth.stderr.toString(), /missing comparison/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("builds and reinspects a clean archive at the manifest output path", () => {
  const root = temporaryDirectory();
  try {
    const source = join(root, "source.png");
    png(source);
    const prepared = prepareWorkspace(source, "semantic", root);
    writeFileSync(
      join(prepared.workspace, "project", "jump.jdef"),
      `jump\n  format: 1\n  name: "Tooling Fixture"\n  author: "Fixture"\n  version: "1"\n\nsection\n  handle: introduction\n  name: "Introduction"\n`,
    );
    execFileSync(
      tsx,
      [join(tools, "build-and-inspect.ts"), prepared.workspace],
      {
        cwd: repository,
        stdio: "pipe",
      },
    );
    assert.ok(readFileSync(prepared.archivePath).byteLength > 0);
    const review = JSON.parse(
      readFileSync(
        join(prepared.workspace, "verification", "package-review.json"),
        "utf8",
      ),
    );
    assert.equal(review.status, "ready");
    assert.equal(review.archive, prepared.manifest.archive);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("keeps generated agent and human schema references complete", () => {
  execFileSync(
    process.execPath,
    [join(tools, "generate-format1-reference.mjs"), "--check"],
    {
      cwd: repository,
    },
  );
  const schema = JSON.parse(
    readFileSync(join(repository, "schema", "format-1.json"), "utf8"),
  );
  const guide = readFileSync(
    join(repository, "documentation", "guides", "format-1-author-guide.html"),
    "utf8",
  );
  const reference = readFileSync(
    join(
      repository,
      ".agents",
      "jumpify",
      "references",
      "format-1-authoring.md",
    ),
    "utf8",
  );
  for (const declaration of Object.keys(schema.declarations)) {
    assert.match(guide, new RegExp(`data-schema-declaration="${declaration}"`));
    assert.ok(reference.includes(`### \`${declaration}\``));
  }
  for (const node of Object.keys(schema.layoutNodes)) {
    assert.match(guide, new RegExp(`data-schema-layout-node="${node}"`));
    assert.ok(reference.includes(`### \`${node}\``));
  }
  assert.match(reference, /### `stack`[\s\S]*?\|\s+gap\s+\|\s+spacing\s+\|/);
  assert.match(
    reference,
    /### `section-layout`[\s\S]*?\|\s+handle\s+\|\s+handle\s+\|/,
  );
});
