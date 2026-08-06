import type { EffectiveTheme, ThemePreference } from "./model";

export const resolveThemePreference = (
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme =>
  preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;

const rgbFromHex = (value: string) =>
  [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
const hexFromRgb = (value: number[]) =>
  `#${value
    .map((channel) =>
      Math.round(Math.max(0, Math.min(255, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
const luminance = (value: number[]) =>
  value
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
export const contrastRatio = (first: string, second: string) => {
  const values = [luminance(rgbFromHex(first)), luminance(rgbFromHex(second))];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

const toward = (base: string, target: string, amount: number) => {
  const destination = rgbFromHex(target);
  return hexFromRgb(
    rgbFromHex(base).map(
      (channel, index) => channel + (destination[index] - channel) * amount,
    ),
  );
};

const accessible = (base: string, background: string, ratio: number) => {
  const targets = ["#ffffff", "#000000"];
  let best = base;
  let bestRatio = contrastRatio(base, background);
  for (const target of targets)
    for (let step = 0; step <= 100; step += 1) {
      const candidate = toward(base, target, step / 100);
      const candidateRatio = contrastRatio(candidate, background);
      if (candidateRatio >= ratio) return candidate;
      if (candidateRatio > bestRatio) {
        best = candidate;
        bestRatio = candidateRatio;
      }
    }
  return best;
};

export function accentTokens(accent: string, theme: "light" | "dark") {
  const background = theme === "dark" ? "#171717" : "#f6f5f1";
  const surface = theme === "dark" ? "#292927" : "#ffffff";
  const text = accessible(accent, background, 4.5);
  const focus = accessible(accent, background, 3);
  const border = accessible(accent, surface, 3);
  const fillText =
    contrastRatio("#171717", accent) >= 4.5 ? "#171717" : "#ffffff";
  return {
    "--app-accent-raw": accent,
    "--app-accent-text": text,
    "--app-accent-focus": focus,
    "--app-accent-border": border,
    "--app-accent-fill": accent,
    "--app-accent-fill-text": fillText,
    "--app-accent-soft": toward(
      accent,
      surface,
      theme === "dark" ? 0.82 : 0.84,
    ),
  };
}
