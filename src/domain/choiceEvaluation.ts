import type { CanonicalJumpPackage, JumpChoice } from "../markup";
import { resolveCostAmount } from "../markup";
import type {
  ActorEntryState,
  ChoiceValue,
  EvaluatedCost,
  RollRecord,
} from "./evaluationTypes";

export function choiceValueIsActive(choice: JumpChoice, value: ChoiceValue) {
  if (choice.selection === "toggle") return value === true;
  if (choice.selection === "text")
    return typeof value === "string" && value.trim().length > 0;
  if (choice.selection === "companions")
    return (
      Array.isArray(value) &&
      value.length >= (choice.min ?? 1) &&
      value.length <= (choice.max ?? 1)
    );
  return value !== null && value !== undefined && value !== "";
}

const sourceKey = (sectionHandle: string, sourceHandle: string) =>
  `${sectionHandle}:${sourceHandle}`;

export function choicePlacement(
  packageItem: CanonicalJumpPackage,
  state: ActorEntryState,
  choice: JumpChoice,
) {
  const direct = packageItem.sections.some((section) =>
    section.directChoices.some(
      (placement) => placement.target === choice.handle,
    ),
  );
  const sources = packageItem.sections.flatMap((section) =>
    section.sources
      .filter(
        (source) =>
          source.group !== undefined && choice.groups.includes(source.group),
      )
      .map((source) => sourceKey(section.handle, source.handle)),
  );
  return {
    direct,
    hasSource: sources.length > 0,
    selectedBySource: sources.some((key) =>
      state.sourceSelections[key]?.includes(choice.handle),
    ),
  };
}

export function choiceStateIsActive(
  packageItem: CanonicalJumpPackage,
  state: ActorEntryState,
  choice: JumpChoice,
  value: ChoiceValue = state.choices[choice.handle] ?? null,
) {
  const placement = choicePlacement(packageItem, state, choice);
  const resolvedValue =
    choice.selection === "toggle" && placement.selectedBySource ? true : value;
  return (
    choiceValueIsActive(choice, resolvedValue) &&
    (placement.direct || !placement.hasSource || placement.selectedBySource)
  );
}

export function choicesForSource(
  packageItem: CanonicalJumpPackage,
  sectionHandle: string,
  sourceHandle: string,
) {
  const section = packageItem.sections.find(
    (item) => item.handle === sectionHandle,
  );
  const source = section?.sources.find((item) => item.handle === sourceHandle);
  return source?.group
    ? packageItem.choices.filter((choice) =>
        choice.groups.includes(source.group!),
      )
    : [];
}

export function choiceWasRolledBySource(
  packageItem: CanonicalJumpPackage,
  state: ActorEntryState,
  choiceHandle: string,
) {
  return packageItem.sections.some((section) =>
    section.sources.some(
      (source) =>
        state.sourceRolls[sourceKey(section.handle, source.handle)]?.result ===
        choiceHandle,
    ),
  );
}

export function evaluatedChoiceCosts(
  choice: JumpChoice,
  value: ChoiceValue,
  choiceRoll: RollRecord | undefined,
  sourceRolled: boolean,
) {
  const integerValue =
    typeof value === "number" ? Math.max(0, value) : undefined;
  const allowance =
    choiceRoll && typeof choiceRoll.result === "number"
      ? choiceRoll.result
      : undefined;
  const exactRoll = choiceRoll?.result === value;
  return choice.costs.map((cost): EvaluatedCost => {
    const amount = resolveCostAmount(cost.amount);
    let resolved = amount;
    if (sourceRolled || exactRoll) resolved = 0;
    else if (cost.mode === "each") {
      const paidRanks = Math.max(0, (integerValue ?? 0) - (allowance ?? 0));
      resolved = amount * paidRanks;
    }
    return {
      resource: cost.resource,
      originalAmount:
        cost.mode === "each" ? amount * (integerValue ?? 0) : amount,
      resolvedAmount: resolved,
      mode: cost.mode,
      rankCount: cost.mode === "each" ? integerValue : undefined,
      rolledAllowance: cost.mode === "each" ? allowance : undefined,
    };
  });
}
