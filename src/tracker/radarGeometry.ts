import { tagCategories, type TagCategory } from "../domain/tags";

const minimumShoulderRatio = 0.08;
const shoulderPeakRatio = 0.25;

export function radarAreaRatios(
  counts: Readonly<Record<TagCategory, number>>,
  maximum: number,
) {
  const divisor = Math.max(1, maximum);
  const exact = tagCategories.map((category) =>
    Math.max(0, counts[category] / divisor),
  );
  const area = [...exact];

  for (const [index, ratio] of exact.entries()) {
    if (ratio === 0) continue;
    const previous = (index - 1 + exact.length) % exact.length;
    const next = (index + 1) % exact.length;
    if (exact[previous] !== 0 || exact[next] !== 0) continue;

    const shoulder = Math.min(
      ratio,
      Math.max(minimumShoulderRatio, ratio * shoulderPeakRatio),
    );
    area[previous] = Math.max(area[previous], shoulder);
    area[next] = Math.max(area[next], shoulder);
  }

  return area;
}
