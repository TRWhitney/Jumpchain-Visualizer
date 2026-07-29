import type { CanonicalJumpPackage } from "../markup";

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
