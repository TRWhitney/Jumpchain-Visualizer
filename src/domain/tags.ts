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

export const adaptTagTextToSurfaces = (
  preferred: string,
  backgrounds: readonly string[],
  minimumContrast = 4.5,
) => {
  const normalized = preferred.toLowerCase();
  if (
    backgrounds.every(
      (background) =>
        tagTextContrast(normalized, background) >= minimumContrast,
    )
  )
    return normalized;

  const fallback = readableTagText(backgrounds);
  let inaccessibleWeight = 0;
  let accessibleWeight = 1;
  let closestAccessible = fallback;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const weight = (inaccessibleWeight + accessibleWeight) / 2;
    const candidate = mixHex(normalized, fallback, weight);
    if (
      backgrounds.every(
        (background) =>
          tagTextContrast(candidate, background) >= minimumContrast,
      )
    ) {
      accessibleWeight = weight;
      closestAccessible = candidate;
    } else inaccessibleWeight = weight;
  }
  return closestAccessible;
};

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
