import { translate } from "../localization";

export type EditorOptionPresentation = {
  value: string;
  label: string;
  description?: string;
};

export type EditorFieldPresentation = {
  label: string;
  help?: string;
};

const contextualFieldKeys: Readonly<Record<string, string>> = {
  "choice-source.mode": "choiceSourceMode",
  "choice-source.resolution": "resolution",
  "choice.selection": "choiceSelection",
  "choice.placeholder": "placeholder",
  "choice.continuity": "continuity",
  "choice.resolution": "resolution",
  "choice.form": "formRecipient",
  "choice.companion": "companionRecipient",
  "choice.measure": "measure",
  "input.selection": "inputSelection",
  "input.placeholder": "placeholder",
  "cost.mode": "costMode",
  "grant.kind": "grantKind",
  "grant.form": "formRecipient",
  "grant.companion": "companionRecipient",
  "grant.measure": "measure",
  "choice.target": "choiceTarget",
};

const contextualHelpKeys: Readonly<Record<string, string>> = {
  "jump.handle": "handle",
  "resource.handle": "handle",
  "section.handle": "handle",
  "choice-source.handle": "handle",
  "choice.handle": "handle",
  "text.handle": "handle",
  "image.handle": "handle",
  "input.handle": "handle",
  "grant.handle": "grantHandle",
  "section-layout.handle": "handle",
  "choice-layout.handle": "handle",
  "trait-layout.handle": "handle",
  "theme.handle": "handle",
  "jump.gauntlet": "gauntlet",
  "jump.starting-points": "startingPoints",
  "jump.points-name": "pointsName",
  "jump.points-abbreviation": "pointsAbbreviation",
  "jump.section-layout": "defaultSectionLayout",
  "jump.choice-layout": "defaultChoiceLayout",
  "jump.trait-layout": "defaultTraitLayout",
  "section.layout": "layoutOverride",
  "choice.layout": "layoutOverride",
  "choice.min": "minimum",
  "choice.max": "maximum",
  "choice.option": "option",
  "choice.form": "formRecipient",
  "choice.companion": "companionRecipientChoice",
  "choice.measure": "measure",
  "choice.continuity": "continuity",
  "choice.resolution": "resolution",
  "choice.placeholder": "placeholder",
  "choice-source.mode": "choiceSourceMode",
  "choice-source.resolution": "resolution",
  "input.selection": "inputSelection",
  "input.placeholder": "placeholder",
  "input.min": "minimum",
  "input.max": "maximum",
  "input.option": "option",
  "cost.resource": "costResource",
  "cost.amount": "costAmount",
  "cost.mode": "costMode",
  "grant.kind": "grantKind",
  "grant.name": "grantName",
  "grant.resource": "grantResource",
  "grant.amount": "grantAmount",
  "grant.value": "grantValue",
  "grant.layout": "traitLayout",
  "grant.form": "formRecipient",
  "grant.companion": "companionRecipient",
  "grant.measure": "measure",
  "image.src": "imageFile",
  "image.alt": "imageDescription",
  "text.content": "textContent",
};

const describedOptionFields = new Set([
  "choice.selection",
  "input.selection",
  "choice-source.mode",
  "choice-source.resolution",
  "choice.resolution",
  "choice.continuity",
  "cost.mode",
  "grant.kind",
  "choice.measure",
  "grant.measure",
]);

const optionDescriptionGroups: Readonly<Record<string, string>> = {
  "choice.selection": "choiceSelection",
  "input.selection": "inputSelection",
  "choice-source.mode": "choiceSourceMode",
  "choice-source.resolution": "resolution",
  "choice.resolution": "resolution",
  "choice.continuity": "continuity",
  "cost.mode": "costMode",
  "grant.kind": "grantKind",
  "choice.measure": "measure",
  "grant.measure": "measure",
};

export function editorDeclarationLabel(kind: string) {
  return translate(`ui.editorWorkspace.declaration.${kind}`, {
    defaultValue: kind,
  });
}

export function editorFieldPresentation(
  kind: string,
  field: string,
): EditorFieldPresentation {
  const contextualKey = `${kind}.${field}`;
  const labelKey = contextualFieldKeys[contextualKey] ?? field;
  const helpKey = contextualHelpKeys[contextualKey];
  return {
    label: translate(`ui.editorWorkspace.fieldPresentation.label.${labelKey}`, {
      defaultValue: field,
    }),
    help: helpKey
      ? translate(`ui.editorWorkspace.fieldPresentation.help.${helpKey}`)
      : undefined,
  };
}

export function editorOptionPresentation(
  kind: string,
  field: string,
  value: string,
): EditorOptionPresentation {
  const group = optionDescriptionGroups[`${kind}.${field}`];
  return {
    value,
    label: translate(`ui.editorWorkspace.optionLabel.${value}`, {
      defaultValue: value,
    }),
    description:
      group && describedOptionFields.has(`${kind}.${field}`)
        ? translate(`ui.editorWorkspace.optionDescription.${group}.${value}`, {
            defaultValue: "",
          })
        : undefined,
  };
}

export function editorLayoutNodePresentation(
  kind: string,
): EditorOptionPresentation {
  return {
    value: kind,
    label: editorDeclarationLabel(kind),
    description: translate(
      `ui.editorWorkspace.optionDescription.layoutNode.${kind}`,
    ),
  };
}

export function editorLayoutFieldPresentation(
  field: string,
  options: { controlAlignment?: boolean } = {},
): EditorFieldPresentation {
  const presentationField =
    field === "text-align" && options.controlAlignment
      ? "control-align"
      : field;
  const helpFields = new Set([
    "target",
    "align",
    "justify",
    "text-align",
    "control-adornments",
    "fit",
    "clip",
    "source",
    "using",
  ]);
  return {
    label: translate(`ui.editorWorkspace.layoutField.${presentationField}`),
    help: helpFields.has(field)
      ? translate(`ui.editorWorkspace.layoutFieldHelp.${presentationField}`)
      : undefined,
  };
}

export function editorSectionLabel(kind: string) {
  return translate(`ui.editorWorkspace.editorSection.${kind}`, {
    defaultValue: translate("ui.editorWorkspace.editorSection.default"),
  });
}
