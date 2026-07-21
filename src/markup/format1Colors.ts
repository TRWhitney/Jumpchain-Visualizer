export const format1BuiltInColors = {
  black: "#111111",
  white: "#ffffff",
  gray: "#7d7b75",
  red: "#b84a4f",
  orange: "#bd7333",
  yellow: "#c8aa4b",
  green: "#568e63",
  blue: "#587ea8",
  purple: "#8065a8",
  brown: "#85694e",
  pink: "#aa6687",
} as const;

export const isFormat1HexColor = (value: string) =>
  /^#[0-9a-f]{6}$/i.test(value);

export const normalizeFormat1HexColor = (value: string) =>
  isFormat1HexColor(value) ? value.toUpperCase() : null;
