import { useEffect, useMemo, useRef } from "react";
import { evaluateChain, type ActorEntryState } from "../domain";
import type { CanonicalJumpPackage } from "../markup";
import {
  JumpChoiceRendererScope,
  JumpChoiceSourceRendererScope,
  JumpImageRendererScope,
  JumpRenderer,
  JumpSectionRendererScope,
  JumpTraitRendererScope,
  type JumpRendererProps,
} from "../tracker/JumpRenderer";
import {
  createLayoutPreviewFixture,
  layoutPreviewImagePath,
} from "./layoutPreview";
import { useAssetObjectUrls } from "../tracker/useAssetObjectUrls";
import type { PreviewSelection } from "./previewSelection";

const layoutPreviewImageUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#d8d3c6"/><path d="M24 142l72-72 48 48 42-42 110 66" fill="none" stroke="#6f766f" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="246" cy="48" r="22" fill="#b58b37"/></svg>',
)}`;

const emptyActorState = (): ActorEntryState => ({
  choices: {},
  inputs: {},
  choiceRolls: {},
  sourceRolls: {},
});

export type LayoutBoundHover = {
  path: string;
  kind: "container" | "slot" | "reference";
};

export function JumpPreview({
  packageItem,
  layoutPackageItem,
  assets,
  selection,
  showBounds,
  hoveredBound,
  onHoveredBoundChange,
  onBoundActivate,
}: {
  packageItem: CanonicalJumpPackage;
  layoutPackageItem?: CanonicalJumpPackage;
  assets: Readonly<Record<string, Uint8Array>>;
  selection: PreviewSelection;
  showBounds: boolean;
  hoveredBound: LayoutBoundHover | null;
  onHoveredBoundChange: (value: LayoutBoundHover | null) => void;
  onBoundActivate?: (value: LayoutBoundHover) => void;
}) {
  const activeBoundRef = useRef<HTMLElement | null>(null);
  const selectionHandle = "handle" in selection ? selection.handle : undefined;
  const authoredLayout = (layoutPackageItem ?? packageItem).layouts.find(
    (item) => item.handle === selectionHandle,
  );
  const layoutPreview = useMemo(
    () =>
      selection.kind === "layout" && authoredLayout
        ? createLayoutPreviewFixture(
            layoutPackageItem ?? packageItem,
            authoredLayout,
          )
        : null,
    [authoredLayout, layoutPackageItem, packageItem, selection.kind],
  );
  const renderedPackage = layoutPreview?.packageItem ?? packageItem;
  const actorState = useMemo(() => {
    const state = emptyActorState();
    for (const handle of layoutPreview?.activeChoiceHandles ?? [])
      state.choices[handle] = true;
    return state;
  }, [layoutPreview]);
  const evaluation = useMemo(
    () =>
      evaluateChain({
        order: ["preview-entry"],
        packageIdByEntry: { "preview-entry": renderedPackage.id },
        packages: { [renderedPackage.id]: renderedPackage },
        jumpState: {
          "preview-entry": {
            actors: { jumper: actorState },
            appliedGauntlet: [],
          },
        },
        jumperName: "Preview Jumper",
      }),
    [actorState, renderedPackage],
  );
  const assetUrls = useAssetObjectUrls(assets, true);
  useEffect(() => {
    if (showBounds) return;
    activeBoundRef.current?.classList.remove("is-layout-bound-active");
    activeBoundRef.current = null;
    onHoveredBoundChange(null);
  }, [onHoveredBoundChange, showBounds]);
  const rendererProps: JumpRendererProps = {
    packageItem: renderedPackage,
    entryId: "preview-entry",
    actorId: "jumper",
    state: actorState,
    evaluation: evaluation.runtime["preview-entry"]?.actors.jumper ?? {
      balance: renderedPackage.startingPoints,
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
    gauntletActive: renderedPackage.nativeGauntlet,
    resolveAsset: (path) =>
      path === layoutPreviewImagePath ? layoutPreviewImageUrl : assetUrls[path],
    dispatch: () => undefined,
  };
  const section = renderedPackage.sections.find(
    (item) => item.handle === selectionHandle,
  );
  const choice = renderedPackage.choices.find(
    (item) => item.handle === selectionHandle,
  );
  const sourceSection =
    selection.kind === "choice-source"
      ? renderedPackage.sections.find(
          (item) => item.handle === selection.sectionHandle,
        )
      : undefined;
  const choiceSource = sourceSection?.sources.find(
    (item) => item.handle === selectionHandle,
  );
  const layout = renderedPackage.layouts.find(
    (item) => item.handle === selectionHandle,
  );
  const layoutSection = layout
    ? (renderedPackage.sections.find(
        (item) =>
          item.layout === layout.handle ||
          (layout.kind === "section-layout" &&
            renderedPackage.defaultSectionLayout === layout.handle),
      ) ?? renderedPackage.sections[0])
    : undefined;
  const layoutChoice = layout
    ? (renderedPackage.choices.find(
        (item) =>
          item.layout === layout.handle ||
          (layout.kind === "choice-layout" &&
            renderedPackage.defaultChoiceLayout === layout.handle),
      ) ?? renderedPackage.choices[0])
    : undefined;

  return (
    <div
      className={`editor-real-preview${layoutPreview ? " format-one-jump-renderer" : ""}${showBounds ? " show-layout-bounds" : ""}`}
      data-hovered-bound={hoveredBound?.path ?? undefined}
      onPointerOver={(event) => {
        if (!showBounds) return;
        const target = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-layout-bound]",
        );
        if (target === activeBoundRef.current) return;
        activeBoundRef.current?.classList.remove("is-layout-bound-active");
        activeBoundRef.current = target;
        target?.classList.add("is-layout-bound-active");
        const kind = target?.dataset.layoutBoundKind;
        onHoveredBoundChange(
          target?.dataset.layoutBound &&
            (kind === "container" || kind === "slot" || kind === "reference")
            ? { path: target.dataset.layoutBound, kind }
            : null,
        );
      }}
      onPointerLeave={() => {
        activeBoundRef.current?.classList.remove("is-layout-bound-active");
        activeBoundRef.current = null;
        onHoveredBoundChange(null);
      }}
      onClickCapture={(event) => {
        if (!showBounds || selection.kind !== "layout" || !onBoundActivate)
          return;
        const target = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-layout-bound]",
        );
        const kind = target?.dataset.layoutBoundKind;
        const path = target?.dataset.layoutBound;
        if (
          !path ||
          (kind !== "container" && kind !== "slot" && kind !== "reference")
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        onBoundActivate({ path, kind });
      }}
    >
      {layoutPreview?.kind === "section-layout" ? (
        <JumpSectionRendererScope
          section={layoutPreview.section}
          rendererProps={rendererProps}
        />
      ) : layoutPreview?.kind === "choice-layout" ? (
        <JumpChoiceRendererScope
          choice={layoutPreview.choice}
          rendererProps={rendererProps}
        />
      ) : layoutPreview?.kind === "trait-layout" ? (
        <JumpTraitRendererScope
          trait={layoutPreview.trait}
          rendererProps={rendererProps}
        />
      ) : selection.kind === "section" && section ? (
        <JumpSectionRendererScope
          section={section}
          rendererProps={rendererProps}
        />
      ) : selection.kind === "choice" && choice ? (
        <JumpChoiceRendererScope
          choice={choice}
          rendererProps={rendererProps}
        />
      ) : selection.kind === "choice-source" && choiceSource ? (
        <JumpChoiceSourceRendererScope
          source={choiceSource}
          sectionHandle={selection.sectionHandle}
          rendererProps={rendererProps}
        />
      ) : selection.kind === "image" ? (
        <JumpImageRendererScope
          image={{
            handle: selection.handle,
            src: selection.src,
            alt: { base: selection.alt, variants: [] },
          }}
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
