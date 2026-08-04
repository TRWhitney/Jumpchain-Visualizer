function verticalOverlapRatio(left, right) {
  const overlap =
    Math.min(left.y + left.height, right.y + right.height) -
    Math.max(left.y, right.y);
  return Math.max(0, overlap) / Math.min(left.height, right.height);
}

export function facsimileSourceRows(ledger) {
  const rowsByRenderIndex = new Map();
  for (const section of ledger.sections ?? []) {
    const unambiguousPages = new Set(
      (ledger.sourcePages ?? [])
        .filter(
          (page) =>
            page.sectionHandles.length === 1 &&
            page.sectionHandles[0] === section.handle,
        )
        .map((page) => page.page),
    );
    const panels = (ledger.entries ?? [])
      .filter(
        (entry) =>
          entry.sourceKind === "choice" &&
          section.sourcePages.includes(entry.page) &&
          unambiguousPages.has(entry.page),
      )
      .flatMap((entry) => {
        const asset = (ledger.assets ?? []).find(
          (candidate) =>
            candidate.package &&
            candidate.kind === "panel" &&
            candidate.page === entry.page &&
            ["x", "y", "width", "height"].every(
              (field) => candidate.rect[field] === entry.rect[field],
            ),
        );
        return asset ? [{ entry, alt: asset.alt }] : [];
      });
    const relationships = panels.flatMap((left, leftIndex) =>
      panels.slice(leftIndex + 1).flatMap((right) => {
        const horizontalOverlap =
          Math.min(
            left.entry.rect.x + left.entry.rect.width,
            right.entry.rect.x + right.entry.rect.width,
          ) - Math.max(left.entry.rect.x, right.entry.rect.x);
        return verticalOverlapRatio(left.entry.rect, right.entry.rect) >= 0.5 &&
          horizontalOverlap <= 1
          ? [{ left: left.alt, right: right.alt }]
          : [];
      }),
    );
    rowsByRenderIndex.set(section.renderIndex, relationships);
  }
  return rowsByRenderIndex;
}

export function facsimileSourceRowMismatches(relationships, imageBounds) {
  return relationships.flatMap((relationship) => {
    const left = imageBounds.find((image) => image.alt === relationship.left);
    const right = imageBounds.find((image) => image.alt === relationship.right);
    if (!left || !right)
      return [
        {
          ...relationship,
          reason: "matching rendered panel image was not found",
        },
      ];
    return verticalOverlapRatio(left.rect, right.rect) < 0.5
      ? [
          {
            ...relationship,
            reason: "source panels share a row but rendered panels stack",
          },
        ]
      : [];
  });
}

function overlapLength(firstStart, firstLength, secondStart, secondLength) {
  return Math.max(
    0,
    Math.min(firstStart + firstLength, secondStart + secondLength) -
      Math.max(firstStart, secondStart),
  );
}

/**
 * Find adjacent vertical panel cuts whose shared source seam is not a clean
 * structural edge on both crops. Such a seam commonly means that a sentence,
 * glyph, or other shared parent content was cut into two sibling images. The
 * defect can be hidden at the desktop width and becomes obvious when the
 * responsive layout stacks those siblings.
 */
export function facsimileCropSeamFindings(cropAudit) {
  const assets = cropAudit?.assets ?? [];
  return assets.flatMap((first, firstIndex) =>
    assets.slice(firstIndex + 1).flatMap((second) => {
      if (first.page !== second.page) return [];
      const firstRight = first.rect.x + first.rect.width;
      const secondRight = second.rect.x + second.rect.width;
      const firstThenSecond = Math.abs(firstRight - second.rect.x) <= 2;
      const secondThenFirst = Math.abs(secondRight - first.rect.x) <= 2;
      if (!firstThenSecond && !secondThenFirst) return [];
      const overlap = overlapLength(
        first.rect.y,
        first.rect.height,
        second.rect.y,
        second.rect.height,
      );
      if (overlap < Math.min(first.rect.height, second.rect.height) * 0.5)
        return [];
      const left = firstThenSecond ? first : second;
      const right = firstThenSecond ? second : first;
      const leftEdge = left.edges?.right;
      const rightEdge = right.edges?.left;
      if (
        leftEdge?.possibleStructuralEdge === true &&
        rightEdge?.possibleStructuralEdge === true
      )
        return [];
      return [
        {
          page: left.page,
          left: left.id,
          right: right.id,
          x: right.rect.x,
          overlap,
          leftDominantRatio: leftEdge?.dominantRatio ?? null,
          rightDominantRatio: rightEdge?.dominantRatio ?? null,
          reason:
            "adjacent panel crops do not both end on a clean vertical structural edge",
        },
      ];
    }),
  );
}
