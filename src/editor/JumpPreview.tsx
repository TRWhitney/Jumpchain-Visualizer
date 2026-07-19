import { useEffect, useMemo } from "react";
import { evaluateChain, type ActorEntryState } from "../domain";
import type { CanonicalJumpPackage } from "../markup";
import {
  JumpChoiceRendererScope,
  JumpRenderer,
  JumpSectionRendererScope,
  type JumpRendererProps,
} from "../tracker/JumpRenderer";

const emptyActorState = (): ActorEntryState => ({
  choices: {},
  inputs: {},
  choiceRolls: {},
  sourceRolls: {},
});

export type PreviewSelection = {
  kind: "package" | "section" | "choice" | "layout";
  handle?: string;
};

export function JumpPreview({
  packageItem,
  assets,
  selection,
  showBounds,
  hoveredBound,
  onHoveredBoundChange,
}: {
  packageItem: CanonicalJumpPackage;
  assets: Readonly<Record<string, Uint8Array>>;
  selection: PreviewSelection;
  showBounds: boolean;
  hoveredBound: string | null;
  onHoveredBoundChange: (value: string | null) => void;
}) {
  const actorState = useMemo(() => emptyActorState(), []);
  const evaluation = useMemo(
    () =>
      evaluateChain({
        order: ["preview-entry"],
        packageIdByEntry: { "preview-entry": packageItem.id },
        packages: { [packageItem.id]: packageItem },
        jumpState: {
          "preview-entry": {
            actors: { jumper: actorState },
            appliedGauntlet: [],
          },
        },
        jumperName: "Preview Jumper",
      }),
    [actorState, packageItem],
  );
  const assetUrls = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(assets).map(([path, bytes]) => [
          path,
          URL.createObjectURL(new Blob([bytes.slice().buffer])),
        ]),
      ),
    [assets],
  );
  useEffect(
    () => () => {
      for (const url of Object.values(assetUrls)) URL.revokeObjectURL(url);
    },
    [assetUrls],
  );
  const rendererProps: JumpRendererProps = {
    packageItem,
    entryId: "preview-entry",
    actorId: "jumper",
    state: actorState,
    evaluation: evaluation.runtime["preview-entry"]?.actors.jumper ?? {
      balance: packageItem.startingPoints,
      resources: {},
      properties: {},
      choices: {},
      traits: [],
      diagnostics: [],
    },
    preferences: {
      warnUpstreamChanges: true,
      allowMultiplePackageVersions: false,
      allowDuplicateJumps: false,
      allowNegativePointBalances: false,
      allowRerolls: false,
      includeItemTagsInRadar: false,
      aggregateSimilarInventory: true,
      showAdditionalJumpInformation: false,
      showMockData: false,
    },
    tags: {},
    companions: [],
    gauntletActive: packageItem.nativeGauntlet,
    resolveAsset: (path) => assetUrls[path],
    dispatch: () => undefined,
  };
  const section = packageItem.sections.find(
    (item) => item.handle === selection.handle,
  );
  const choice = packageItem.choices.find(
    (item) => item.handle === selection.handle,
  );
  const layout = packageItem.layouts.find(
    (item) => item.handle === selection.handle,
  );
  const layoutSection = layout
    ? (packageItem.sections.find(
        (item) =>
          item.layout === layout.handle ||
          (layout.kind === "section-layout" &&
            packageItem.defaultSectionLayout === layout.handle),
      ) ?? packageItem.sections[0])
    : undefined;
  const layoutChoice = layout
    ? (packageItem.choices.find(
        (item) =>
          item.layout === layout.handle ||
          (layout.kind === "choice-layout" &&
            packageItem.defaultChoiceLayout === layout.handle),
      ) ?? packageItem.choices[0])
    : undefined;

  return (
    <div
      className={`editor-real-preview${showBounds ? " show-layout-bounds" : ""}`}
      data-hovered-bound={hoveredBound ?? undefined}
      onMouseOver={(event) => {
        if (!showBounds) return;
        const target = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-layout-bound]",
        );
        onHoveredBoundChange(target?.dataset.layoutBound ?? null);
      }}
      onMouseLeave={() => onHoveredBoundChange(null)}
    >
      {selection.kind === "section" && section ? (
        <JumpSectionRendererScope
          section={section}
          rendererProps={rendererProps}
        />
      ) : selection.kind === "choice" && choice ? (
        <JumpChoiceRendererScope
          choice={choice}
          rendererProps={rendererProps}
        />
      ) : selection.kind === "layout" &&
        layout?.kind === "choice-layout" &&
        layoutChoice ? (
        <JumpChoiceRendererScope
          choice={{ ...layoutChoice, layout: layout.handle }}
          rendererProps={rendererProps}
        />
      ) : selection.kind === "layout" && layoutSection ? (
        <JumpSectionRendererScope
          section={{ ...layoutSection, layout: layout?.handle }}
          rendererProps={rendererProps}
        />
      ) : (
        <JumpRenderer {...rendererProps} />
      )}
    </div>
  );
}
