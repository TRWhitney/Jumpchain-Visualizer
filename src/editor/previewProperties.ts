import type {
  CanonicalJumpPackage,
  JumpChoice,
  JumpGrant,
  Renderable,
} from "../markup";
import {
  implicitNamedBasicChoiceValue,
  namedBasicChoiceSelectionIsCompatible,
} from "../markup";
import {
  choiceStateIsActive,
  type ActorEntryState,
  type EvaluatedActorJump,
} from "../domain";

export type PreviewPropertySetter = {
  choiceHandle: string;
  choiceName: string;
  inputHandle?: string;
};

export type PreviewPropertyRow = {
  handle: string;
  value?: string | number | boolean;
  sourceLabel?: string;
  setters: readonly PreviewPropertySetter[];
};

export const previewBasicDataGroups = [
  {
    key: "identity",
    handles: ["gender", "age"],
  },
  {
    key: "originAndLocation",
    handles: ["origin", "location"],
  },
] as const;

export const previewBasicDataHandles: ReadonlySet<string> = new Set(
  previewBasicDataGroups.flatMap((group) => [...group.handles]),
);

const interpolationPattern = /\{\{\s*([a-z0-9_]+)\s*}}/g;

const display = (value: Renderable | undefined, fallback: string) =>
  value?.base ?? value?.variants[0]?.value ?? fallback;

function propertyGrantTargets(grants: readonly JumpGrant[]) {
  return grants.flatMap((grant) =>
    grant.kind === "property" && grant.handle ? [grant.handle] : [],
  );
}

function choiceSetters(choice: JumpChoice) {
  const choiceName = display(choice.name, choice.handle);
  const setters: [string, PreviewPropertySetter][] = propertyGrantTargets(
    choice.grants,
  ).map((handle) => [
    handle,
    {
      choiceHandle: choice.handle,
      choiceName,
    },
  ]);
  for (const input of choice.inputs)
    for (const handle of propertyGrantTargets(input.grants))
      setters.push([
        handle,
        {
          choiceHandle: choice.handle,
          choiceName,
          inputHandle: input.handle,
        },
      ]);
  return setters;
}

function reachableChoiceHandles(packageItem: CanonicalJumpPackage) {
  return new Set(
    packageItem.sections.flatMap((section) => [
      ...section.directChoices.map((choice) => choice.target),
      ...packageItem.choices
        .filter((choice) =>
          section.sources.some(
            (source) => source.group && choice.groups.includes(source.group),
          ),
        )
        .map((choice) => choice.handle),
    ]),
  );
}

function choiceBelongsToOriginSource(
  packageItem: CanonicalJumpPackage,
  choice: JumpChoice,
) {
  return (
    choice.groups.some((group) => group === "origin" || group === "origins") ||
    packageItem.sections.some((section) =>
      section.sources.some(
        (source) =>
          source.handle === "origin" &&
          source.group !== undefined &&
          choice.groups.includes(source.group),
      ),
    )
  );
}

function compatibleImplicitBasicChoice(choice: JumpChoice) {
  if (choice.handle === "gender") return choice.selection === "select";
  if (choice.handle === "age") return choice.selection === "integer";
  if (choice.handle === "location" || choice.handle === "origin")
    return namedBasicChoiceSelectionIsCompatible(choice.selection);
  return true;
}

export function interpolationHandles(
  files: Readonly<Record<string, string>>,
): readonly string[] {
  const handles = new Set<string>();
  for (const source of Object.values(files))
    for (const match of source.matchAll(interpolationPattern))
      if (match[1]) handles.add(match[1]);
  return [...handles].sort();
}

export function previewPropertyRowsForHandles(
  packageItem: CanonicalJumpPackage,
  evaluation: EvaluatedActorJump,
  handles: readonly string[],
  actorState?: ActorEntryState,
): readonly PreviewPropertyRow[] {
  const setters = new Map<string, PreviewPropertySetter[]>();
  const contextualValues = new Map<
    string,
    { value: string | number | boolean; sourceLabel: string }[]
  >();
  const addSetter = (handle: string, setter: PreviewPropertySetter) => {
    const current = setters.get(handle) ?? [];
    const key = `${setter.choiceHandle}:${setter.inputHandle ?? ""}`;
    if (
      !current.some(
        (candidate) =>
          `${candidate.choiceHandle}:${candidate.inputHandle ?? ""}` === key,
      )
    )
      current.push(setter);
    setters.set(handle, current);
  };
  const addContextualValue = (
    handle: string,
    value: unknown,
    sourceLabel: string,
  ) => {
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    )
      return;
    const current = contextualValues.get(handle) ?? [];
    current.push({ value, sourceLabel });
    contextualValues.set(handle, current);
  };
  const reachableChoices = reachableChoiceHandles(packageItem);
  for (const choice of packageItem.choices) {
    if (!reachableChoices.has(choice.handle)) continue;
    for (const [handle, setter] of choiceSetters(choice))
      addSetter(handle, setter);
    if (choiceBelongsToOriginSource(packageItem, choice))
      addSetter("origin", {
        choiceHandle: choice.handle,
        choiceName: display(choice.name, choice.handle),
      });
  }

  for (const choice of packageItem.choices) {
    if (!reachableChoices.has(choice.handle)) continue;
    const choiceName = display(choice.name, choice.handle);
    if (
      compatibleImplicitBasicChoice(choice) &&
      (choice.selection !== "companions" ||
        choice.handle === "origin" ||
        choice.handle === "location")
    ) {
      addSetter(choice.handle, {
        choiceHandle: choice.handle,
        choiceName,
      });
      const namedBasicProperty =
        choice.handle === "origin"
          ? "origin"
          : choice.handle === "location"
            ? "location"
            : undefined;
      addContextualValue(
        choice.handle,
        namedBasicProperty
          ? actorState && choiceStateIsActive(packageItem, actorState, choice)
            ? implicitNamedBasicChoiceValue(
                namedBasicProperty,
                choice.selection,
                actorState.choices[choice.handle],
                choiceName,
              )
            : undefined
          : actorState?.choices[choice.handle],
        choiceName,
      );
    }
    for (const input of choice.inputs) {
      addSetter(input.handle, {
        choiceHandle: choice.handle,
        choiceName,
        inputHandle: input.handle,
      });
      addContextualValue(
        input.handle,
        actorState?.inputs[choice.handle]?.[input.handle],
        `${choiceName} · ${input.handle}`,
      );
    }
  }

  return [...new Set(handles)].map((handle) => {
    const property = evaluation.properties[handle];
    const contextual = contextualValues.get(handle) ?? [];
    const contextualKeys = new Set(
      contextual.map(
        (candidate) => `${typeof candidate.value}:${candidate.value}`,
      ),
    );
    const contextualValue =
      contextualKeys.size === 1 ? contextual[0] : undefined;
    return {
      handle,
      value:
        handle === "gauntlet"
          ? packageItem.nativeGauntlet
          : (property?.value ?? contextualValue?.value),
      sourceLabel:
        handle === "gauntlet"
          ? "Jump declaration"
          : (property?.sourceLabel ?? contextualValue?.sourceLabel),
      setters: setters.get(handle) ?? [],
    };
  });
}

export function previewPropertyRows(
  packageItem: CanonicalJumpPackage,
  evaluation: EvaluatedActorJump,
  files: Readonly<Record<string, string>>,
  actorState?: ActorEntryState,
): readonly PreviewPropertyRow[] {
  return previewPropertyRowsForHandles(
    packageItem,
    evaluation,
    interpolationHandles(files),
    actorState,
  );
}
