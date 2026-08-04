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
  facsimileCropSeamFindings,
  facsimileSourceRowMismatches,
  facsimileSourceRows,
} from "../.agents/jumpify/scripts/facsimile-layout-audit.mjs";

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
    run("validate-ledger.mjs", workspace, "--complete");

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
    writeFileSync(
      join(workspace, "verification", "render-audit.json"),
      `${JSON.stringify({ widths })}\n`,
    );

    ledger.gaps.push({
      id: "narrow_viewport",
      requirement: "Fit inside the narrow viewport.",
      experiment: "Render the valid layout at 390px.",
      evidence: "verification/rendered/390-section-01.png",
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
    join(repository, "documentation", "format-1-author-guide.html"),
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
