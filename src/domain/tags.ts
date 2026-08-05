import { shiftInheritedTagColor } from "./tagColor";

export const tagCategories = [
  "social",
  "mental",
  "spiritual",
  "magic",
  "meta",
  "stealth",
  "physical",
  "combat",
  "defense",
  "crafting",
  "technology",
  "miscellaneous",
] as const;

export type TagCategory = (typeof tagCategories)[number];

export type TagPresentation = {
  background: "solid" | "gradient" | "transparent";
  colors: readonly string[];
  positions: readonly number[];
  angle: number;
  borderColor: string;
  borderWidth: "none" | "thin" | "medium";
  corners: "pill" | "rounded" | "square";
  padding: "compact" | "standard" | "roomy";
  textMode: "auto" | "custom";
  textColor: string;
  weight: "normal" | "medium" | "bold";
  fontStyle: "normal" | "italic";
  decoration: "none" | "underline" | "strike";
  textEffect: "none" | "outline" | "shadow" | "glow";
  animation: "none" | "rainbow" | "marquee" | "ghost" | "bounce";
};

export type TagDefinition = {
  id: string;
  label: string;
  parent?: string;
  aliases: readonly string[];
  color: string;
  to: string;
  style: "solid" | "soft" | "outline" | "gradient";
  presentation?: TagPresentation;
};

export function inheritedTagPresentation(
  parent: TagPresentation,
  tagName: string,
): TagPresentation {
  return {
    ...parent,
    colors: parent.colors.map((color, index) =>
      shiftInheritedTagColor(color, tagName, index),
    ),
    borderColor: shiftInheritedTagColor(parent.borderColor, tagName, 31),
  };
}

export function tagReferenceId(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[\s_\p{Dash_Punctuation}]+/gu, "-");
}

export function tagDefinitionForReference(
  definitions: Readonly<Record<string, TagDefinition>>,
  reference: string,
) {
  const normalized = tagReferenceId(reference);
  return (
    definitions[reference] ??
    definitions[normalized] ??
    Object.values(definitions).find(
      (definition) =>
        tagReferenceId(definition.label) === normalized ||
        definition.aliases.some(
          (alias) => tagReferenceId(alias) === normalized,
        ),
    )
  );
}

export function tagDefinitionForDisplay(
  definitions: Readonly<Record<string, TagDefinition>>,
  reference: string,
): TagDefinition | undefined {
  const label = reference.trim();
  if (!label) return undefined;
  const resolved = tagDefinitionForReference(definitions, label);
  if (resolved) return resolved;
  return inheritedMiscellaneousTagDefinition(
    tagDefinitionForReference(definitions, "miscellaneous"),
    label,
  );
}

function inheritedMiscellaneousTagDefinition(
  miscellaneous: TagDefinition | undefined,
  label: string,
): TagDefinition {
  const basePresentation =
    miscellaneous?.presentation ??
    presentationForTagDefinition(
      miscellaneous?.color ?? "#68707c",
      miscellaneous?.to ?? "#454b54",
      miscellaneous?.style ?? "soft",
    );
  const presentation = inheritedTagPresentation(basePresentation, label);
  return {
    id: tagReferenceId(label),
    label,
    parent: "miscellaneous",
    aliases: [],
    color: presentation.colors[0],
    to: presentation.colors[1] ?? presentation.colors[0],
    style:
      presentation.background === "gradient"
        ? "gradient"
        : presentation.background === "transparent"
          ? "outline"
          : "solid",
    presentation,
  };
}

export function tagDefinitionsWithFallbacks(
  definitions: Readonly<Record<string, TagDefinition>>,
  references: Iterable<string>,
): Record<string, TagDefinition> {
  const knownReferences = new Set(
    Object.entries(definitions).flatMap(([key, definition]) =>
      [key, definition.id, definition.label, ...definition.aliases].map(
        tagReferenceId,
      ),
    ),
  );
  const miscellaneous = tagDefinitionForReference(definitions, "miscellaneous");
  let result: Record<string, TagDefinition> | undefined;
  for (const reference of references) {
    const label = reference.trim();
    const id = tagReferenceId(label);
    if (!label || knownReferences.has(id)) continue;
    const fallback = inheritedMiscellaneousTagDefinition(miscellaneous, label);
    result ??= { ...definitions };
    result[fallback.id] = fallback;
    knownReferences.add(id);
  }
  return result ?? (definitions as Record<string, TagDefinition>);
}

const rgb = (hex: string) =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));

const hex = (channels: number[]) =>
  `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

export const mixHex = (first: string, second: string, weight = 0.3) =>
  hex(
    rgb(first).map(
      (value, index) => value + (rgb(second)[index] - value) * weight,
    ),
  );

const relativeLuminance = (color: string) =>
  rgb(color)
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );

export const tagTextContrast = (text: string, background: string) => {
  const values = [relativeLuminance(text), relativeLuminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

export const readableTagText = (backgrounds: readonly string[]) =>
  ["#ffffff", "#111111"]
    .map((color) => ({
      color,
      minimum: Math.min(
        ...backgrounds.map((background) => tagTextContrast(color, background)),
      ),
    }))
    .sort((first, second) => second.minimum - first.minimum)[0].color;

export function presentationForTagDefinition(
  color: string,
  to: string,
  style: TagDefinition["style"],
): TagPresentation {
  return {
    background:
      style === "outline"
        ? "transparent"
        : style === "gradient"
          ? "gradient"
          : "solid",
    colors: [color, to, mixHex(color, "#ffffff", 0.16)],
    positions: [0, 50, 100],
    angle: 120,
    borderColor: color,
    borderWidth: style === "outline" ? "medium" : "thin",
    corners: "pill",
    padding: "compact",
    textMode: "auto",
    textColor: "#ffffff",
    weight: "bold",
    fontStyle: "normal",
    decoration: "none",
    textEffect: "none",
    animation: "none",
  };
}
