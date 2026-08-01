import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  evaluateChain,
  type ActorEntryState,
  type ChainEvaluation,
} from "../domain";
import type { CanonicalJumpPackage, JumpChoice } from "../markup";
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
import { selectedChoicePreviewPackage } from "./selectionPreview";
import { useAssetObjectUrls } from "../tracker/useAssetObjectUrls";
import { assetRelativePath } from "../markup/assetPath";
import type { PreviewSelection } from "./previewSelection";
import { stripPreviewColors } from "./previewColors";
import { translate } from "../localization";
import {
  createPreviewActorState,
  reducePreviewActorState,
} from "./previewActorState";
import {
  annotateAppearanceInspectionTargets,
  appearanceInspectionAtPoint,
  type AppearanceColorInspection,
} from "./appearanceInspection";

const layoutPreviewImageUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#d8d3c6"/><path d="M24 142l72-72 48 48 42-42 110 66" fill="none" stroke="#6f766f" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="246" cy="48" r="22" fill="#b58b37"/></svg>',
)}`;

function appearancePreviewPackage(
  packageItem: CanonicalJumpPackage,
): CanonicalJumpPackage {
  const choice = (
    handle: string,
    name: string,
    selection: JumpChoice["selection"],
    extra: Partial<JumpChoice> = {},
  ): JumpChoice => ({
    handle,
    name: { base: name, variants: [] },
    tags: [],
    groups: [],
    selection,
    resolution: "manual",
    options: [],
    text: [],
    images: [],
    inputs: [],
    costs: [],
    grants: [],
    ...extra,
  });
  const choices = [
    choice(
      "appearance_toggle",
      translate("ui.editorWorkspace.appearancePreview.toggleChoice"),
      "toggle",
      {
        tags: ["appearance_example"],
        text: [
          {
            handle: "body",
            content: {
              base: translate(
                "ui.editorWorkspace.appearancePreview.choiceBody",
              ),
              variants: [],
            },
          },
        ],
        images: [
          {
            handle: "appearance_image",
            src: layoutPreviewImagePath,
            alt: {
              base: translate("ui.editorWorkspace.appearancePreview.imageAlt"),
              variants: [],
            },
            effects: {
              roundedCorners: false,
              roundedIntensity: 25,
              fadeEdges: false,
              fadeIntensity: 25,
            },
          },
        ],
      },
    ),
    choice(
      "appearance_text",
      translate("ui.editorWorkspace.appearancePreview.textChoice"),
      "text",
    ),
    choice(
      "appearance_integer",
      translate("ui.editorWorkspace.appearancePreview.integerChoice"),
      "integer",
      {
        min: 0,
        max: 10,
      },
    ),
    choice(
      "appearance_select",
      translate("ui.editorWorkspace.appearancePreview.selectChoice"),
      "select",
      {
        options: [
          {
            base: translate("ui.editorWorkspace.appearancePreview.optionOne"),
            variants: [],
          },
          {
            base: translate("ui.editorWorkspace.appearancePreview.optionTwo"),
            variants: [],
          },
        ],
      },
    ),
    choice(
      "appearance_cost",
      translate("ui.editorWorkspace.appearancePreview.standardCost"),
      "toggle",
      {
        costs: [{ resource: "jump_points", amount: 100, mode: "flat" }],
      },
    ),
    choice(
      "appearance_benefit",
      translate("ui.editorWorkspace.appearancePreview.benefit"),
      "toggle",
    ),
    choice(
      "appearance_award",
      translate("ui.editorWorkspace.appearancePreview.award"),
      "toggle",
      {
        costs: [{ resource: "jump_points", amount: -100, mode: "flat" }],
      },
    ),
    choice(
      "appearance_pending",
      translate("ui.editorWorkspace.appearancePreview.pendingRoll"),
      "integer",
      {
        min: 1,
        max: 6,
        resolution: "random",
        costs: [{ resource: "jump_points", amount: 100, mode: "flat" }],
      },
    ),
    choice(
      "appearance_grouped",
      translate("ui.editorWorkspace.appearancePreview.groupedChoice"),
      "toggle",
      { groups: ["appearance_group"] },
    ),
  ];
  return {
    ...packageItem,
    id: `${packageItem.id}:appearance-preview`,
    name: {
      base: translate("ui.editorWorkspace.appearancePreview.title"),
      variants: [],
    },
    description: translate("ui.editorWorkspace.appearancePreview.description"),
    choices,
    sections: [
      {
        handle: "appearance_components",
        name: {
          base: translate("ui.editorWorkspace.appearancePreview.section"),
          variants: [],
        },
        sources: [
          {
            handle: "appearance_group",
            group: "appearance_group",
            mode: "single",
            resolution: "manual",
          },
        ],
        directChoices: choices
          .filter((item) => item.handle !== "appearance_grouped")
          .map((item) => ({
            handle: item.handle,
            target: item.handle,
          })),
        members: [
          { kind: "source", handle: "appearance_group" },
          ...choices
            .filter((item) => item.handle !== "appearance_grouped")
            .map((item) => ({
              kind: "choice" as const,
              handle: item.handle,
            })),
        ],
        text: [],
        images: [],
      },
    ],
  };
}

export type LayoutBoundHover = {
  path: string;
  kind: "container" | "slot" | "reference";
};

export type JumpPreviewSnapshot = {
  packageItem: CanonicalJumpPackage;
  actorState: ActorEntryState;
  evaluation: ChainEvaluation;
  selectionKind: PreviewSelection["kind"];
};

export function JumpPreview({
  packageItem,
  layoutPackageItem,
  choicePackageItem,
  assets,
  assetUrlOverrides,
  tags,
  selection,
  showBounds,
  stripColor,
  layoutPreviewPlaceholderCharacterLimit,
  layoutPreviewChoiceLayout,
  hoveredBound,
  onHoveredBoundChange,
  onBoundActivate,
  hoveredAppearanceColor,
  onHoveredAppearanceColorChange,
  onAppearanceColorActivate,
  onSnapshotChange,
}: {
  packageItem: CanonicalJumpPackage;
  layoutPackageItem?: CanonicalJumpPackage;
  choicePackageItem?: CanonicalJumpPackage;
  assets: Readonly<Record<string, Uint8Array>>;
  assetUrlOverrides?: Readonly<Record<string, string>>;
  tags: JumpRendererProps["tags"];
  selection: PreviewSelection;
  showBounds: boolean;
  stripColor: boolean;
  layoutPreviewPlaceholderCharacterLimit: number | null;
  layoutPreviewChoiceLayout?: string;
  hoveredBound: LayoutBoundHover | null;
  onHoveredBoundChange: (value: LayoutBoundHover | null) => void;
  onBoundActivate?: (value: LayoutBoundHover) => void;
  hoveredAppearanceColor: AppearanceColorInspection | null;
  onHoveredAppearanceColorChange: (
    value: AppearanceColorInspection | null,
  ) => void;
  onAppearanceColorActivate?: (value: AppearanceColorInspection) => void;
  onSnapshotChange?: (snapshot: JumpPreviewSnapshot) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeInspectionRef = useRef<HTMLElement | null>(null);
  const activeInspectionKeyRef = useRef("");
  const selectionHandle = "handle" in selection ? selection.handle : undefined;
  const authoredLayout = (layoutPackageItem ?? packageItem).layouts.find(
    (item) =>
      selection.kind === "layout" &&
      item.kind === selection.layoutKind &&
      item.handle === selectionHandle,
  );
  const layoutPreview = useMemo(
    () =>
      selection.kind === "layout" && authoredLayout
        ? createLayoutPreviewFixture(
            layoutPackageItem ?? packageItem,
            authoredLayout,
            layoutPreviewPlaceholderCharacterLimit,
            layoutPreviewChoiceLayout,
          )
        : null,
    [
      authoredLayout,
      layoutPackageItem,
      layoutPreviewPlaceholderCharacterLimit,
      layoutPreviewChoiceLayout,
      packageItem,
      selection.kind,
    ],
  );
  const contextualPackage = useMemo(
    () =>
      selection.kind === "choice" && choicePackageItem
        ? selectedChoicePreviewPackage(
            packageItem,
            choicePackageItem,
            selection.handle,
          )
        : packageItem,
    [choicePackageItem, packageItem, selection],
  );
  const previewPackage = useMemo(
    () =>
      selection.kind === "appearance" && selection.mode === "components"
        ? appearancePreviewPackage(contextualPackage)
        : (layoutPreview?.packageItem ?? contextualPackage),
    [contextualPackage, layoutPreview?.packageItem, selection],
  );
  const renderedPackage = useMemo(
    () => (stripColor ? stripPreviewColors(previewPackage) : previewPackage),
    [previewPackage, stripColor],
  );
  const appearanceComponents =
    selection.kind === "appearance" && selection.mode === "components";
  const appearancePreview = selection.kind === "appearance";
  const activeChoiceHandlesKey = (
    layoutPreview?.activeChoiceHandles ?? []
  ).join("\0");
  const previewActorKey = [
    selection.kind,
    "mode" in selection ? selection.mode : "",
    selection.kind === "layout" ? selection.layoutKind : "",
    selectionHandle ?? "",
    activeChoiceHandlesKey,
  ].join(":");
  const initialActorState = useMemo(() => {
    const state = createPreviewActorState();
    if (appearanceComponents) {
      state.choices.appearance_toggle = true;
      state.choices.appearance_integer = 3;
    }
    for (const handle of activeChoiceHandlesKey
      ? activeChoiceHandlesKey.split("\0")
      : [])
      state.choices[handle] = true;
    return state;
  }, [activeChoiceHandlesKey, appearanceComponents]);
  const [previewActor, setPreviewActor] = useState(() => ({
    key: previewActorKey,
    state: initialActorState,
  }));
  const actorState =
    previewActor.key === previewActorKey
      ? previewActor.state
      : initialActorState;
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
  useEffect(() => {
    onSnapshotChange?.({
      packageItem: renderedPackage,
      actorState,
      evaluation,
      selectionKind: selection.kind,
    });
  }, [
    actorState,
    evaluation,
    onSnapshotChange,
    renderedPackage,
    selection.kind,
  ]);
  const storedAssetUrls = useAssetObjectUrls(assets, true);
  const assetUrls = useMemo(
    () => ({
      ...storedAssetUrls,
      ...Object.fromEntries(
        Object.entries(assetUrlOverrides ?? {}).map(([path, url]) => [
          assetRelativePath(path),
          url,
        ]),
      ),
    }),
    [assetUrlOverrides, storedAssetUrls],
  );
  const previewCompanions = [
    {
      id: "companion:preview-prior:jumper:preview_companion_one:0",
      name: translate("ui.editorWorkspace.previewCompanion.first"),
    },
    {
      id: "companion:preview-prior:jumper:preview_companion_two:0",
      name: translate("ui.editorWorkspace.previewCompanion.second"),
    },
  ];
  useEffect(() => {
    if (showBounds) return;
    activeInspectionRef.current?.classList.remove(
      "is-preview-inspection-active",
    );
    activeInspectionRef.current?.removeAttribute("data-appearance-active-kind");
    activeInspectionRef.current = null;
    activeInspectionKeyRef.current = "";
    onHoveredBoundChange(null);
    onHoveredAppearanceColorChange(null);
  }, [onHoveredAppearanceColorChange, onHoveredBoundChange, showBounds]);
  useLayoutEffect(() => {
    if (!showBounds || !appearancePreview || !rootRef.current) return;
    const cleanup = annotateAppearanceInspectionTargets(rootRef.current);
    return () => {
      cleanup();
      activeInspectionRef.current?.classList.remove(
        "is-preview-inspection-active",
      );
      activeInspectionRef.current?.removeAttribute(
        "data-appearance-active-kind",
      );
      activeInspectionRef.current = null;
      activeInspectionKeyRef.current = "";
      onHoveredAppearanceColorChange(null);
    };
  }, [
    appearancePreview,
    onHoveredAppearanceColorChange,
    packageItem,
    previewActorKey,
    selection.kind,
    showBounds,
    stripColor,
  ]);
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
      allowNegativePointBalances: true,
      allowRerolls: false,
      includeItemTagsInRadar: false,
      aggregateSimilarInventory: true,
      showAdditionalJumpInformation: false,
      showMockData: false,
    },
    tags:
      selection.kind === "appearance" && selection.mode === "components"
        ? {
            ...tags,
            appearance_example: {
              id: "appearance_example",
              label: translate(
                "ui.editorWorkspace.appearancePreview.exampleTag",
              ),
              parent: "miscellaneous",
              aliases: [],
              color: "#7f5aa2",
              to: "#4f326d",
              style: "soft",
            },
          }
        : tags,
    companions: previewCompanions,
    gauntletActive: renderedPackage.nativeGauntlet,
    resolveAsset: (path) =>
      path === layoutPreviewImagePath ? layoutPreviewImageUrl : assetUrls[path],
    dispatch: (action) =>
      setPreviewActor((current) => {
        const state =
          current.key === previewActorKey ? current.state : initialActorState;
        return {
          key: previewActorKey,
          state: reducePreviewActorState(state, action),
        };
      }),
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
    (item) =>
      selection.kind === "layout" &&
      item.kind === selection.layoutKind &&
      item.handle === selectionHandle,
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
      ref={rootRef}
      className={`editor-real-preview${showBounds ? (appearancePreview ? " show-appearance-colors" : " show-layout-bounds") : ""}`}
      data-hovered-bound={hoveredBound?.path ?? undefined}
      data-hovered-appearance-color={hoveredAppearanceColor?.field}
      data-hovered-appearance-owner={
        hoveredAppearanceColor?.layout ? "layout" : "appearance"
      }
      onPointerMove={(event) => {
        if (!showBounds) return;
        if (appearancePreview) {
          const inspected = appearanceInspectionAtPoint(
            event.target as HTMLElement,
            event.clientX,
            event.clientY,
          );
          const key = inspected
            ? `${inspected.layout?.kind ?? "appearance"}:${inspected.layout?.handle ?? ""}:${inspected.layout?.path ?? ""}:${inspected.field}:${inspected.kind}`
            : "";
          if (
            inspected?.element === activeInspectionRef.current &&
            key === activeInspectionKeyRef.current
          )
            return;
          activeInspectionRef.current?.classList.remove(
            "is-preview-inspection-active",
          );
          activeInspectionRef.current?.removeAttribute(
            "data-appearance-active-kind",
          );
          activeInspectionRef.current = inspected?.element ?? null;
          activeInspectionKeyRef.current = key;
          inspected?.element.classList.add("is-preview-inspection-active");
          if (inspected)
            inspected.element.dataset.appearanceActiveKind = inspected.kind;
          onHoveredAppearanceColorChange(
            inspected
              ? {
                  field: inspected.field,
                  kind: inspected.kind,
                  layout: inspected.layout,
                }
              : null,
          );
          return;
        }
        const target = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-layout-bound]",
        );
        if (target === activeInspectionRef.current) return;
        activeInspectionRef.current?.classList.remove(
          "is-preview-inspection-active",
        );
        activeInspectionRef.current = target;
        target?.classList.add("is-preview-inspection-active");
        const kind = target?.dataset.layoutBoundKind;
        onHoveredBoundChange(
          target?.dataset.layoutBound &&
            (kind === "container" || kind === "slot" || kind === "reference")
            ? { path: target.dataset.layoutBound, kind }
            : null,
        );
      }}
      onPointerLeave={() => {
        activeInspectionRef.current?.classList.remove(
          "is-preview-inspection-active",
        );
        activeInspectionRef.current?.removeAttribute(
          "data-appearance-active-kind",
        );
        activeInspectionRef.current = null;
        activeInspectionKeyRef.current = "";
        onHoveredBoundChange(null);
        onHoveredAppearanceColorChange(null);
      }}
      onClickCapture={(event) => {
        if (!showBounds) return;
        if (appearancePreview && onAppearanceColorActivate) {
          const inspected = appearanceInspectionAtPoint(
            event.target as HTMLElement,
            event.clientX,
            event.clientY,
          );
          if (!inspected) return;
          event.preventDefault();
          event.stopPropagation();
          onAppearanceColorActivate({
            field: inspected.field,
            kind: inspected.kind,
            layout: inspected.layout,
          });
          return;
        }
        if (selection.kind !== "layout" || !onBoundActivate) return;
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
            effects: {
              roundedCorners: selection.roundedCorners,
              roundedIntensity: selection.roundedIntensity,
              fadeEdges: selection.fadeEdges,
              fadeIntensity: selection.fadeIntensity,
            },
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
