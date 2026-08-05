const rgb = (hex: string) =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));

const hex = (channels: readonly number[]) =>
  `#${channels
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

const tagColorHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (const character of value.normalize("NFKC").toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** Derives a child badge color without changing its label or hierarchy. */
export function shiftInheritedTagColor(
  color: string,
  tagName: string,
  salt = 0,
) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const [red, green, blue] = rgb(color).map((channel) => channel / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const lightness = (maximum + minimum) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  const hash = tagColorHash(`${tagName}:${salt}`);
  const hueOffsets = [-22, -17, -12, -7, 7, 12, 17, 22];
  hue = (hue + hueOffsets[hash % hueOffsets.length] + 360) % 360;
  const shiftedSaturation = Math.max(
    0.24,
    Math.min(0.92, saturation + (((hash >>> 5) % 5) - 2) * 0.035),
  );
  const shiftedLightness = Math.max(
    0.2,
    Math.min(0.8, lightness + (((hash >>> 9) % 5) - 2) * 0.035),
  );
  const chroma = (1 - Math.abs(2 * shiftedLightness - 1)) * shiftedSaturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r, g, b] =
    segment < 1
      ? [chroma, x, 0]
      : segment < 2
        ? [x, chroma, 0]
        : segment < 3
          ? [0, chroma, x]
          : segment < 4
            ? [0, x, chroma]
            : segment < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const match = shiftedLightness - chroma / 2;
  return hex([(r + match) * 255, (g + match) * 255, (b + match) * 255]);
}
