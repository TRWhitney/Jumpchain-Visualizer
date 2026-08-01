import type { CSSProperties, Dispatch } from "react";
import type {
  ActorEntryState,
  EvaluatedActorJump,
  RandomIndexSource,
} from "../domain";
import type { TagDefinition } from "../domain/tags";
import type { CanonicalJumpPackage, ImageEffects } from "../markup";
import {
  JumpRenderer as NeutralJumpRenderer,
  RenderedJumpImage as NeutralRenderedJumpImage,
} from "../renderer/JumpRenderer";
import type { JumpAssetResolver } from "../renderer/jumpImages";
import { useOptionalSettings } from "../settings/SettingsContext";
import type { TrackerAction, TrackerPreferences } from "./model";
import { createTrackerRendererActions } from "./rendererAdapter";

export {
  JumpChoiceRendererScope,
  JumpChoiceSourceRendererScope,
  JumpImageRendererScope,
  JumpSectionRendererScope,
  JumpTraitRendererScope,
} from "../renderer/JumpRenderer";

export type JumpRendererProps = {
  packageItem: CanonicalJumpPackage;
  entryId: string;
  actorId: string;
  state: ActorEntryState;
  evaluation: EvaluatedActorJump;
  preferences: TrackerPreferences;
  tags: Readonly<Record<string, TagDefinition>>;
  companions: readonly { id: string; name: string }[];
  gauntletActive: boolean;
  resolveAsset?: JumpAssetResolver;
  randomIndex?: RandomIndexSource;
  dispatch: Dispatch<TrackerAction>;
};

export function JumpRenderer({
  dispatch,
  preferences,
  ...model
}: JumpRendererProps) {
  const settings = useOptionalSettings();
  return (
    <NeutralJumpRenderer
      {...model}
      preferences={{
        allowRerolls: preferences.allowRerolls,
        showAdditionalJumpInformation:
          preferences.showAdditionalJumpInformation,
        imageAltTextHover:
          settings?.settings.accessibility.imageAltTextHover ?? true,
      }}
      actions={createTrackerRendererActions(
        model.entryId,
        model.actorId,
        dispatch,
      )}
    />
  );
}

export function RenderedJumpImage({
  source,
  alternativeText,
  style,
  effects,
  tiled,
}: {
  source: string;
  alternativeText: string;
  style?: CSSProperties;
  effects?: ImageEffects;
  tiled?: boolean;
}) {
  const settings = useOptionalSettings();
  return (
    <NeutralRenderedJumpImage
      source={source}
      alternativeText={alternativeText}
      style={style}
      effects={effects}
      tiled={tiled}
      showAltTextOnHover={
        settings?.settings.accessibility.imageAltTextHover ?? true
      }
    />
  );
}
