import type {
  ActorEntryState,
  ChoiceValue,
  EvaluatedActorJump,
  InputValue,
} from "../domain";
import type { TagDefinition } from "../domain/tags";
import type { CanonicalJumpPackage } from "../markup";
import type { RandomIndexSource } from "../domain/random";
import type { JumpAssetResolver } from "./jumpImages";

export type RendererModel = {
  packageItem: CanonicalJumpPackage;
  entryId: string;
  actorId: string;
  state: ActorEntryState;
  evaluation: EvaluatedActorJump;
  tags: Readonly<Record<string, TagDefinition>>;
  companions: readonly { id: string; name: string }[];
  gauntletActive: boolean;
  resolveAsset?: JumpAssetResolver;
  randomIndex?: RandomIndexSource;
};

export type RendererPreferences = {
  allowRerolls: boolean;
  showAdditionalJumpInformation: boolean;
  imageAltTextHover: boolean;
};

export type RendererMutation =
  | { type: "set-choice"; choiceHandle: string; value: ChoiceValue }
  | {
      type: "set-input";
      choiceHandle: string;
      inputHandle: string;
      value: InputValue;
    }
  | {
      type: "set-source-selections";
      sourceKey: string;
      mode: "single" | "multi";
      value: readonly string[];
    }
  | {
      type: "record-choice-roll";
      choiceHandle: string;
      result: string | number;
    }
  | {
      type: "record-source-roll";
      sourceKey: string;
      mode: "single" | "multi";
      result: string;
    };

export type RendererActions = {
  setChoice: (choiceHandle: string, value: ChoiceValue) => void;
  setInput: (
    choiceHandle: string,
    inputHandle: string,
    value: InputValue,
  ) => void;
  setSourceSelections: (
    sourceKey: string,
    mode: "single" | "multi",
    value: readonly string[],
  ) => void;
  recordChoiceRoll: (choiceHandle: string, result: string | number) => void;
  recordSourceRoll: (
    sourceKey: string,
    mode: "single" | "multi",
    result: string,
  ) => void;
};

export type JumpRendererProps = RendererModel & {
  preferences: RendererPreferences;
  actions: RendererActions;
};
