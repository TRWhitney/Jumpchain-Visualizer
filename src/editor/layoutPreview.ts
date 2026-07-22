import type { EvaluatedGrantRecord } from "../domain";
import { translate } from "../localization";
import type {
  CanonicalJumpPackage,
  ChoiceSource,
  ImageBlock,
  JumpChoice,
  JumpInput,
  JumpLayout,
  LayoutNode,
  Renderable,
  TextBlock,
} from "../markup";

export const layoutPreviewImagePath = "layout-preview-placeholder.svg";

export type LayoutPreviewFixture =
  | {
      kind: "section-layout";
      packageItem: CanonicalJumpPackage;
      section: CanonicalJumpPackage["sections"][number];
      activeChoiceHandles: readonly string[];
    }
  | {
      kind: "choice-layout";
      packageItem: CanonicalJumpPackage;
      choice: JumpChoice;
      activeChoiceHandles: readonly string[];
    }
  | {
      kind: "trait-layout";
      packageItem: CanonicalJumpPackage;
      trait: EvaluatedGrantRecord;
      activeChoiceHandles: readonly string[];
    };

const renderable = (base: string): Renderable => ({ base, variants: [] });

function walk(node: LayoutNode): readonly LayoutNode[] {
  return [node, ...node.children.flatMap(walk)];
}

function uniqueTargets(nodes: readonly LayoutNode[], kind: LayoutNode["kind"]) {
  return [
    ...new Set(
      nodes.flatMap((node) =>
        node.kind === kind && node.target ? [node.target] : [],
      ),
    ),
  ];
}

function textBlocks(nodes: readonly LayoutNode[]): readonly TextBlock[] {
  return uniqueTargets(nodes, "text").map((target) => ({
    handle: target,
    content: renderable(
      translate("ui.editorWorkspace.layoutPreview.textContent", { target }),
    ),
  }));
}

function imageBlocks(nodes: readonly LayoutNode[]): readonly ImageBlock[] {
  return uniqueTargets(nodes, "image").map((target) => ({
    handle: target,
    src: layoutPreviewImagePath,
    alt: renderable(
      translate("ui.editorWorkspace.layoutPreview.imageAlt", { target }),
    ),
  }));
}

function inputs(nodes: readonly LayoutNode[]): readonly JumpInput[] {
  return uniqueTargets(nodes, "input").map((target) => ({
    handle: target,
    selection: "text",
    options: [],
    grants: [],
  }));
}

function dummyChoice(
  handle: string,
  name: string,
  nodes: readonly LayoutNode[] = [],
  groups: readonly string[] = [],
  layout?: string,
): JumpChoice {
  return {
    handle,
    name: renderable(name),
    layout,
    tags: [translate("ui.editorWorkspace.layoutPreview.tag")],
    groups,
    selection: "toggle",
    resolution: "either",
    options: [renderable(translate("ui.editorWorkspace.layoutPreview.option"))],
    text: textBlocks(nodes),
    images: imageBlocks(nodes),
    inputs: inputs(nodes),
    costs: [{ resource: "jump_points", amount: 100, mode: "flat" }],
    grants: [],
  };
}

function previewPackage(
  packageItem: CanonicalJumpPackage,
  sections: CanonicalJumpPackage["sections"],
  choices: readonly JumpChoice[],
): CanonicalJumpPackage {
  return {
    ...packageItem,
    id: `${packageItem.id}-layout-preview`,
    logicalId: `${packageItem.logicalId}-layout-preview`,
    name: renderable(translate("ui.editorWorkspace.layoutPreview.packageName")),
    description: translate(
      "ui.editorWorkspace.layoutPreview.packageDescription",
    ),
    startingPoints: 100_000,
    defaultSectionLayout: undefined,
    defaultChoiceLayout: undefined,
    defaultTraitLayout: undefined,
    sections,
    choices,
    diagnostics: [],
  };
}

function referencedChoiceLayout(
  packageItem: CanonicalJumpPackage,
  handle: string | undefined,
) {
  return handle
    ? packageItem.layouts.find(
        (layout) => layout.kind === "choice-layout" && layout.handle === handle,
      )
    : undefined;
}

function sectionFixture(
  packageItem: CanonicalJumpPackage,
  layout: JumpLayout,
): LayoutPreviewFixture {
  const nodes = walk(layout.root);
  const expandNodes = nodes.filter((node) => node.kind === "expand");
  const sourceHandles = [
    ...new Set(
      expandNodes.map(
        (node, index) => node.source ?? `preview_source_${index + 1}`,
      ),
    ),
  ];
  if (
    sourceHandles.length === 0 &&
    nodes.some((node) => node.kind === "slot" && node.target === "roll")
  )
    sourceHandles.push("preview_source_1");

  const sources: ChoiceSource[] = sourceHandles.map((handle, index) => ({
    handle,
    group: `preview_group_${index + 1}`,
    mode: "multi",
    resolution: "either",
  }));
  let choiceNumber = 0;
  const choices: JumpChoice[] = [];
  for (const [sourceIndex, source] of sources.entries()) {
    const expand = expandNodes.find(
      (node, index) =>
        (node.source ?? `preview_source_${index + 1}`) === source.handle,
    );
    const choiceLayout = referencedChoiceLayout(packageItem, expand?.using);
    const choiceNodes = choiceLayout ? walk(choiceLayout.root) : [];
    for (let index = 0; index < 2; index += 1) {
      choiceNumber += 1;
      choices.push(
        dummyChoice(
          `preview_source_${sourceIndex + 1}_choice_${index + 1}`,
          translate("ui.editorWorkspace.layoutPreview.choiceName", {
            number: choiceNumber,
          }),
          choiceNodes,
          source.group ? [source.group] : [],
          choiceLayout?.handle,
        ),
      );
    }
  }
  const activeChoiceHandles = choices.map((choice) => choice.handle);

  const directTargets = uniqueTargets(nodes, "choice");
  const directChoices = directTargets.map((target, index) => {
    choiceNumber += 1;
    const handle = `preview_direct_choice_${index + 1}`;
    choices.push(
      dummyChoice(
        handle,
        translate("ui.editorWorkspace.layoutPreview.directChoiceName", {
          number: index + 1,
        }),
      ),
    );
    return { handle: target, target: handle };
  });
  const section = {
    handle: "preview_section",
    name: renderable(translate("ui.editorWorkspace.layoutPreview.sectionName")),
    layout: layout.handle,
    sources,
    directChoices,
    members: [
      ...sources.map((source) => ({
        kind: "source" as const,
        handle: source.handle,
      })),
      ...directChoices.map((choice) => ({
        kind: "choice" as const,
        handle: choice.handle,
      })),
    ],
    text: textBlocks(nodes),
    images: imageBlocks(nodes),
  };
  return {
    kind: "section-layout",
    packageItem: previewPackage(packageItem, [section], choices),
    section,
    activeChoiceHandles,
  };
}

function choiceFixture(
  packageItem: CanonicalJumpPackage,
  layout: JumpLayout,
): LayoutPreviewFixture {
  const choice = dummyChoice(
    "preview_choice",
    translate("ui.editorWorkspace.layoutPreview.choiceName", { number: 1 }),
    walk(layout.root),
    [],
    layout.handle,
  );
  return {
    kind: "choice-layout",
    packageItem: previewPackage(packageItem, [], [choice]),
    choice,
    activeChoiceHandles: [choice.handle],
  };
}

function traitFixture(
  packageItem: CanonicalJumpPackage,
  layout: JumpLayout,
): LayoutPreviewFixture {
  const nodes = walk(layout.root);
  const trait: EvaluatedGrantRecord = {
    id: "preview_trait",
    kind: "trait",
    name: translate("ui.editorWorkspace.layoutPreview.traitName"),
    sourceEntryId: "preview-entry",
    grantHandle: "preview_trait",
    sourcePackageId: packageItem.id,
    sourcePackageExactHash: packageItem.exactHash,
    tags: [translate("ui.editorWorkspace.layoutPreview.tag")],
    description: translate("ui.editorWorkspace.layoutPreview.traitDescription"),
    layout: layout.handle,
    text: textBlocks(nodes),
    images: imageBlocks(nodes),
  };
  return {
    kind: "trait-layout",
    packageItem: previewPackage(packageItem, [], []),
    trait,
    activeChoiceHandles: [],
  };
}

export function createLayoutPreviewFixture(
  packageItem: CanonicalJumpPackage,
  layout: JumpLayout,
): LayoutPreviewFixture {
  if (layout.kind === "choice-layout")
    return choiceFixture(packageItem, layout);
  if (layout.kind === "trait-layout") return traitFixture(packageItem, layout);
  return sectionFixture(packageItem, layout);
}
