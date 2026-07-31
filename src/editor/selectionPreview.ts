import type { CanonicalJumpPackage } from "../markup";

export function currentChoicesPreviewPackage(
  fallback: CanonicalJumpPackage,
  current: CanonicalJumpPackage,
): CanonicalJumpPackage {
  const currentByHandle = new Map(
    current.choices.map((choice) => [choice.handle, choice]),
  );
  const fallbackHandles = new Set(
    fallback.choices.map((choice) => choice.handle),
  );
  const currentChoiceLayouts = current.layouts.filter(
    (layout) => layout.kind === "choice-layout",
  );
  const currentLayoutsByHandle = new Map(
    currentChoiceLayouts.map((layout) => [layout.handle, layout]),
  );
  const fallbackChoiceLayoutHandles = new Set(
    fallback.layouts
      .filter((layout) => layout.kind === "choice-layout")
      .map((layout) => layout.handle),
  );
  return {
    ...fallback,
    defaultChoiceLayout: current.defaultChoiceLayout,
    choices: [
      ...fallback.choices.map(
        (choice) => currentByHandle.get(choice.handle) ?? choice,
      ),
      ...[...currentByHandle.values()].filter(
        (choice) => !fallbackHandles.has(choice.handle),
      ),
    ],
    layouts: [
      ...fallback.layouts.map((layout) =>
        layout.kind === "choice-layout"
          ? (currentLayoutsByHandle.get(layout.handle) ?? layout)
          : layout,
      ),
      ...[...currentLayoutsByHandle.values()].filter(
        (layout) => !fallbackChoiceLayoutHandles.has(layout.handle),
      ),
    ],
    resources: current.resources,
    themes: current.themes,
  };
}

export function selectedChoicePreviewPackage(
  fallback: CanonicalJumpPackage,
  current: CanonicalJumpPackage,
  handle: string,
): CanonicalJumpPackage {
  const choice = current.choices.find(
    (candidate) => candidate.handle === handle,
  );
  if (!choice) return fallback;

  return {
    ...fallback,
    defaultChoiceLayout: current.defaultChoiceLayout,
    choices: [
      ...fallback.choices.filter((candidate) => candidate.handle !== handle),
      choice,
    ],
    layouts: [
      ...fallback.layouts.filter((layout) => layout.kind !== "choice-layout"),
      ...current.layouts.filter((layout) => layout.kind === "choice-layout"),
    ],
    resources: current.resources,
    themes: current.themes,
  };
}
